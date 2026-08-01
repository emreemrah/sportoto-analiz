// RADAR MERKEZİ RENDER TESTLERİ.
//
// NEDEN VAR: RadarScreen 1500 satır, 30+ durum ve kendini besleyen effect'ler
// taşıyor — projedeki en kırılgan ekran. Bölünmeden ÖNCE bu testler yazıldı:
// refactor'ün davranışı değiştirmediğini kanıtlayacak emniyet ağı bu dosyadır.
// Testler ekranın ÇİZİLDİĞİNİ ve dürüstlük metinlerinin kullanıcıya
// ULAŞTIĞINI doğrular (kaynak taraması değil, gerçek render).
//
// Sürüm notu için bkz. ekranlar.test.jsx (RNTL 13.x kullanılır, 14.x DEĞİL).
import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react-native';

import RadarScreen from '../src/screens/RadarScreen';

const nav = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()) };

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));

// Ekran 60 sn'lik otomatik tazeleme ve 30 sn'lik saat sayacı kuruyor.
// Gerçek zamanlayıcı testte sızıntı yapar; sahte zamanlayıcı kullanılır.
beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

// Fikstür, backend'in GERÇEK radar yükünden alındı (radarService.js satır 124
// ve masterRadar.js dönüşü): home/away DÜZ METİNDİR, sınıf anahtarı
// classification'dır. Uydurma bir şekil test yeşil olsa bile hiçbir şey
// kanıtlamaz — ilk denemede tam olarak bu hataya düşüldü.
const MAC = (no, over = {}) => ({
  no, matchId: `m${no}`, home: 'Ev Takımı', away: 'Dep Takımı',
  league: 'Test Ligi', kickoffAt: '2026-08-02T17:00:00Z',
  master: {
    classification: 'strong_candidate', classificationLabel: 'Güçlü Aday',
    mainPrediction: '1', favorite: { symbol: '1', percent: 55 },
    favoriteFailureRisk: 28, dataQuality: 78, confidence: 72,
    activeRadarCount: 4, conflictScore: 20, topReasons: [], riskReasons: [],
    ...(over.master || {}),
  },
  radars: {},
});

const GUNCEL = {
  hasData: true, current: true, roundId: 1600, round: '1. Hafta', year: 2026,
  sealed: false, methodologyVersion: 'radar-1.0.0',
  summary: { avgDataQuality: 78 },
  matches: [MAC(1), MAC(2), MAC(3)],
};

const HAFTALAR = { weeks: [{ roundId: 1600, round: '1. Hafta', year: 2026, current: true, archived: false, locked: false, sealed: false }] };

// Uca göre yanıt veren fetch. Tanımlanmayan uçlar 404 döner — ekranın
// eksik veriye dayanıklı olduğu da böylece test edilir.
function mockUclar(harita) {
  global.fetch.mockImplementation(async (url) => {
    const u = String(url);
    const eslesen = Object.keys(harita).find((k) => u.includes(k));
    if (!eslesen) return { ok: false, status: 404, json: async () => ({ error: 'yok' }), text: async () => 'yok' };
    const govde = harita[eslesen];
    return { ok: true, status: 200, json: async () => govde, text: async () => JSON.stringify(govde) };
  });
}

const VARSAYILAN = {
  '/api/radar/weeks': HAFTALAR,
  '/api/radar/current': GUNCEL,
};

// Render ağacındaki tüm metinleri SIRASIYLA toplar (altın kopya için).
function metinleriTopla(node, out = []) {
  if (node == null || node === false) return out;
  if (typeof node === 'string' || typeof node === 'number') { out.push(String(node)); return out; }
  if (Array.isArray(node)) { for (const c of node) metinleriTopla(c, out); return out; }
  for (const c of node.children || []) metinleriTopla(c, out);
  return out;
}

describe('Radar Merkezi ekranı', () => {
  test('güncel hafta çiziliyor ve çökmüyor', async () => {
    mockUclar(VARSAYILAN);
    render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getByText(/Radar Merkezi/)).toBeTruthy());
    expect(screen.getAllByText(/Ev Takımı/).length).toBe(3);
  });

  test('veri yeterliliği yüzdesi ham sayı olarak DEĞİL, bağlamıyla gösteriliyor', async () => {
    mockUclar(VARSAYILAN);
    render(<RadarScreen navigation={nav} />);
    // Yüzde tek başına değil, aktif radar sayısıyla birlikte ve "tahmin güveni
    // her kartta ayrı" notuyla veriliyor — tek bir rakama indirgenmiyor.
    await waitFor(() => expect(screen.getByText(/Veri yeterliliği: %78/)).toBeTruthy());
    expect(screen.getByText(/Tahmin güveni her kartta ayrı/)).toBeTruthy();
  });

  test('mühürlü haftada "değişmez" güvencesi kullanıcıya ULAŞIYOR', async () => {
    mockUclar({
      ...VARSAYILAN,
      '/api/radar/current': {
        ...GUNCEL, current: false, sealed: true,
        sealedAt: '2026-08-02T16:55:00Z', verificationHash: 'abcdef0123456789',
      },
    });
    render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getByText(/Mühürlü analiz/)).toBeTruthy());
    expect(screen.getByText(/sonuçlar gelse de bu görüntü değişmez/)).toBeTruthy();
    // Doğrulama karması KISALTILMIŞ gösterilir (10 hane).
    expect(screen.getByText(/Doğrulama #abcdef0123/)).toBeTruthy();
  });

  test('sunucu veri döndürmezken sahte radar ÜRETİLMEZ, iskelet ayakta kalır', async () => {
    mockUclar({ '/api/radar/current': { hasData: false, pending: true, round: '1. Hafta' } });
    render(<RadarScreen navigation={nav} />);
    // Boş ekran değil: başlık görünmeye devam eder.
    await waitFor(() => expect(screen.getByText(/Radar Merkezi/)).toBeTruthy());
    // Uydurma maç/yüzde yok.
    expect(screen.queryByText(/Ev Takımı/)).toBeNull();
  });

  test('radar karnesi YOKKEN başarı yüzdesi gösterilmez', async () => {
    mockUclar(VARSAYILAN);          // /api/radar/scorecard 404 döner
    render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getByText(/Radar Merkezi/)).toBeTruthy());
    expect(screen.queryByText(/Radar Karnesi:/)).toBeNull();
  });

  test('radar karnesi VARSA her oran n ile birlikte gösterilir', async () => {
    mockUclar({
      ...VARSAYILAN,
      '/api/radar/scorecard': {
        hasData: true,
        master: {
          allTime: {
            mainAccuracy: { rate: 48, total: 45 },
            strongCandidate: { rate: 61, total: 18 },
            surpriseCandidate: { catchRate: 33, total: 9 },
          },
        },
        note: 'az örneklem',
      },
    });
    render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getByText(/Radar Karnesi/)).toBeTruthy());
    // Yüzde tek başına asla yok: yanında n=… var.
    expect(screen.getByText(/%48 \(n=45\)/)).toBeTruthy();
    expect(screen.getByText(/az örneklem/)).toBeTruthy();
  });

  test('API anahtarları kullanıcıya HAM gösterilmez, insan dili kullanılır', async () => {
    mockUclar(VARSAYILAN);
    render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Ev Takımı/).length).toBeGreaterThan(0));
    // 'strong_candidate' bir API sözleşmesi anahtarıdır; ekranda görünürse
    // kullanıcı ham veri okuyor demektir.
    expect(screen.queryByText(/strong_candidate/)).toBeNull();
    // "banko" kesinlik dili hiçbir yerde geçmez (yeni başlangıç kuralı).
    expect(screen.queryByText(/banko/i)).toBeNull();
  });

  test('veri yeterliliği ve güven AYRI gösterilir (tek rakama indirgenmez)', async () => {
    mockUclar(VARSAYILAN);
    render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Ev Takımı/).length).toBeGreaterThan(0));
    // Kartta ikisi ayrı çip: "Veri %78" ve "Güven %72". Karıştırılırsa
    // kullanıcı eksik veriyi yüksek güven sanar.
    expect(screen.getAllByText('%78').length).toBeGreaterThan(0);
    expect(screen.getAllByText('%72').length).toBeGreaterThan(0);
  });

  // TAŞINAN PANELLER — components/RadarTabHeaders.js.
  // Bu üç panelin metinleri ürünün dürüstlük sözleşmesidir: Radar 3 (oynanma
  // YÜZDESİ) ile Radar 4 (gerçek ORAN) ayrımı ve "mühürlenir, değişmez"
  // güvencesi. Bölme sırasında kaybolurlarsa kullanıcı ikisini karıştırır.
  test('Radar 4 paneli: oran/yüzde ayrımı ve mühür güvencesi ekranda', async () => {
    mockUclar({ ...VARSAYILAN, '/api/radar/daily-odds': { roundId: 1600, days: [], matches: [], note: 'Bu hafta için oran kaydı yok.' } });
    render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Ev Takımı/).length).toBe(3));
    fireEvent.press(screen.getByText('Oran Takibi'));

    expect(await screen.findByText(/Oran Takibi · Günlük 1\/X\/2 Oranları/)).toBeTruthy();
    expect(screen.getByText(/burada yüzde değil, oran vardır/)).toBeTruthy();
    expect(screen.getByText(/mühürlenir ve sonradan değişmez/)).toBeTruthy();
    // Kayıt yokken uydurma oran değil, sunucunun dürüst notu gösterilir.
    expect(screen.getByText('Bu hafta için oran kaydı yok.')).toBeTruthy();
  });

  test('Radar 3 paneli: kaynak yokken UYDURMA YÜZDE gösterilmediği yazıyor', async () => {
    mockUclar({ ...VARSAYILAN, '/api/radar/daily-played': { roundId: 1600, days: [], matches: [], sources: [] } });
    render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Ev Takımı/).length).toBe(3));
    fireEvent.press(screen.getByText('Oynanma DNA'));

    expect(await screen.findByText(/Oynanma DNA · Günlük 1\/X\/2 Yüzdeleri/)).toBeTruthy();
    expect(screen.getByText(/Bu bir ORAN değildir/)).toBeTruthy();
    expect(screen.getByText(/Aktif kaynak yok — sağlayıcı verisi bekleniyor \(uydurma yüzde gösterilmez\)\./)).toBeTruthy();
  });

  test('Radar 5 paneli: dönem çipleri ve veri yokken dürüst not', async () => {
    mockUclar({
      ...VARSAYILAN,
      '/api/radar/position-dna': { hasData: false, note: 'Resmî geçmiş arşiv birikiyor — veri geldikçe sıra yüzdeleri görünür.' },
    });
    render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Ev Takımı/).length).toBe(3));
    fireEvent.press(screen.getByText('Bülten DNA'));

    expect(await screen.findByText('Tüm Haftalar')).toBeTruthy();
    expect(screen.getByText('Son 15 Hafta')).toBeTruthy();
    expect(screen.getByText(/Resmî geçmiş arşiv birikiyor/)).toBeTruthy();
    // Veri yokken uydurma yüzde çipe yazılmaz.
    expect(screen.queryByText(/Tüm Haftalar · %/)).toBeNull();
  });

  // SONSUZ İSTEK DÖNGÜSÜ KORUMASI.
  //
  // Eski kodda her sekme effect'i KENDİ doldurduğu state'e bağımlıydı ve döngüyü
  // yalnız "gelen yanıtın roundId'si istediğimle aynı mı?" kontrolü kesiyordu.
  // Sunucu farklı/eksik roundId dönerse kontrol tutmaz ve ekran sessizce
  // sunucuyu dövmeye başlar. Kilit artık İSTENEN haftada (ref'te) tutuluyor.
  test('sunucu yanlış roundId dönse bile sekme sunucuyu dövmez', async () => {
    mockUclar({
      ...VARSAYILAN,
      // Kritik nokta: istenen 1600, dönen 9999 → eski kontrol ASLA tutmazdı.
      '/api/radar/daily-odds': { roundId: 9999, days: [], matches: [] },
    });
    render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Ev Takımı/).length).toBe(3));

    fireEvent.press(screen.getByText('Oran Takibi'));
    // Effect'lerin yerleşmesi için birkaç tur bekle.
    for (let i = 0; i < 5; i += 1) await act(async () => {});

    const oranIstekleri = global.fetch.mock.calls
      .filter(([u]) => String(u).includes('/api/radar/daily-odds')).length;
    expect(oranIstekleri).toBe(1);
  });

  // ALTIN KOPYA — refactor emniyet ağı.
  // Ekran bölünürken kullanıcının GÖRDÜĞÜ her şeyin aynı kalması gerekir.
  // Yukarıdaki testler belirli cümleleri kontrol eder; bu test ekrandaki TÜM
  // metinleri SIRASIYLA kilitler — sessizce kaybolan bir rozeti veya yer
  // değiştiren bir satırı da yakalar.
  //
  // Not: ağacın tamamı (toJSON) snapshot'a sığmıyor — pretty-format
  // "Invalid string length" ile patlıyor. Zaten önemli olan stil nesneleri
  // değil, kullanıcıya ULAŞAN metin. Bölme sırasında bu liste değişirse
  // davranış değişmiş demektir; kasıtlı bir değişiklikte `jest -u` ile
  // yenilenir ve nedeni commit mesajına yazılır.
  test('altın kopya: bölme öncesi ekran metinleri', async () => {
    mockUclar(VARSAYILAN);
    const { toJSON } = render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Ev Takımı/).length).toBe(3));
    expect(metinleriTopla(toJSON())).toMatchSnapshot();
  });
});
