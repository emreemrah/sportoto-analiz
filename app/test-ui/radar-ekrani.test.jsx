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
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react-native';

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


// Cihazda görünmeyen ok karakterlerine karşı koruma. ⌄ (U+2304) ve ⌃ (U+2303)
// birçok yazı tipinde yoktur; ekranda boş kutu çıkıyordu. Yalnız yaygın
// desteklenen üçgenler kabul edilir.
const GORUNUR_OKLAR = ['▼', '▲'];
function assertGorunurOk(ok) {
  expect(GORUNUR_OKLAR).toContain(ok);
}

describe('Radar Merkezi ekranı', () => {
  test('güncel hafta çiziliyor ve çökmüyor', async () => {
    mockUclar(VARSAYILAN);
    render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getByText(/Radar Merkezi/)).toBeTruthy());
    expect(screen.getAllByText(/Ev Takımı/).length).toBe(3);
  });

  // TEKNİK BAŞLIK BLOĞU KALDIRILDI (kullanıcı kararı 2026-08-01): veri
  // yeterliliği, radar karnesi, kriter karnesi, Sistem Karnesi ve Metodoloji
  // bağlantıları kullanıcı ekranından çıkarıldı; yönetici tarafına taşınacak.
  test('teknik başlık bloğu kullanıcı ekranında GÖSTERİLMEZ', async () => {
    mockUclar({
      ...VARSAYILAN,
      // Karne verisi GELSE BİLE çizilmemeli (uç hâlâ ayakta).
      '/api/radar/scorecard': {
        hasData: true,
        master: { allTime: {
          mainAccuracy: { rate: 48, total: 45 },
          strongCandidate: { rate: 61, total: 18 },
          surpriseCandidate: { catchRate: 33, total: 9 },
        } },
      },
    });
    render(<RadarScreen navigation={nav} />);
    // Olumlu karşılık: ekran çiziliyor ve maçlar duruyor…
    await waitFor(() => expect(screen.getAllByText(/Ev Takımı/).length).toBe(3));
    // …ama teknik satırların hiçbiri yok.
    expect(screen.queryByText(/Veri yeterliliği/)).toBeNull();
    expect(screen.queryByText(/Radar Karnesi/)).toBeNull();
    expect(screen.queryByText(/Kriter Karnesi/)).toBeNull();
    expect(screen.queryByText(/Sistem Karnesi/)).toBeNull();
    expect(screen.queryByText(/Metodoloji/)).toBeNull();
  });

  test('kaldırılan bloklar için SUNUCUYA istek atılmaz (ölü çağrı yok)', async () => {
    mockUclar(VARSAYILAN);
    render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Ev Takımı/).length).toBe(3));
    const urls = global.fetch.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('/api/radar/scorecard'))).toBe(false);
    expect(urls.some((u) => u.includes('/api/radar/methodology'))).toBe(false);
    // Olumlu karşılık: asıl veri yine çekiliyor.
    expect(urls.some((u) => u.includes('/api/radar/current'))).toBe(true);
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
    expect(screen.getByText(/Kaynak yok — veri bekleniyor \(uydurma yüzde gösterilmez\)\./)).toBeTruthy();
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
    // Çipe HİÇBİR koşulda yüzde yazılmaz: önce "veri yoksa uydurma yüzde
    // yazılmaz" kuralıydı, 3 Ağustos 2026'dan beri gösterge tümüyle kaldırıldı
    // ("dönem başarısı kafa karıştırıyor"). Geri gelirse bu satır yakalar.
    expect(screen.queryByText(/Tüm Haftalar · %/)).toBeNull();
  });

  // DOLU VERİYLE SATIRLAR — 2. aşama bölmenin emniyet ağı.
  // Yukarıdaki panel testleri BOŞ veriyle çalışıyor; satır çizicileri
  // (renderMarketRow / renderPublicRow) ancak veri varken çalışır. Bu iki test
  // olmadan o kod taşınırken hiçbir şey onu korumaz.
  const GUN = { date: '2026-08-01', weekday: 'Cuma', label: 'Cuma 01.08', isMatchDay: true, withData: 1 };
  const ONCEKI_GUN = { date: '2026-07-31', weekday: 'Perşembe', label: 'Perşembe 31.07', isMatchDay: false, withData: 1 };

  test('Radar 4 satırı: oran ve önceki güne göre kıyas çiziliyor', async () => {
    mockUclar({
      ...VARSAYILAN,
      '/api/radar/daily-odds': {
        roundId: 1600, days: [ONCEKI_GUN, GUN], counts: { total: 3 },
        matches: [
          { no: 1, cells: { '2026-07-31': { odds: { '1': 1.70, X: 3.30, '2': 4.50 } }, '2026-08-01': { odds: { '1': 1.61, X: 3.20, '2': 4.25 } } } },
          // 2 ve 3 numarada kayıt YOK → sebep satırı.
          { no: 2, cells: {}, notes: { '2026-08-01': { text: 'Bu maç seçili liglerde değil' } } },
        ],
      },
    });
    render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Ev Takımı/).length).toBe(3));
    fireEvent.press(screen.getByText('Oran Takibi'));

    // Oran gösteriliyor ve önceki günle kıyaslandığı SÖYLENİYOR.
    expect(await screen.findByText('Bir önceki güne göre değişim')).toBeTruthy();
    // Kayıt olmayan maçta oran UYDURULMUYOR, sebebi yazılıyor.
    expect(screen.getByText('Bu maç seçili liglerde değil.')).toBeTruthy();
    // Sayaç arka uçtaki gerçek sayıyı veriyor.
    expect(screen.getByText(/3 maçın 1'inde oran var/)).toBeTruthy();
  });

  // ÇEKİM SAATİ SEÇİLİ GÜNE AİTTİR (kullanıcı düzeltmesi, 3 Ağustos 2026).
  // İlk sürüm haftanın EN SON çekimini yazıyordu; kullanıcı Pazar sekmesindeyken
  // Pazartesi'nin saatini görüyordu ("ne alaka"). Ekranda tek gün görünür,
  // dolayısıyla saat de o güne ait olmalı.
  test('Radar 3: SEÇİLİ GÜNÜN çekim saati yazar, gün değişince saat de değişir', async () => {
    mockUclar({
      ...VARSAYILAN,
      '/api/radar/daily-played': {
        roundId: 1600, sources: ['k1'], matches: [],
        days: [
          { ...ONCEKI_GUN, lastObservedLabel: '20:45' },
          { ...GUN, lastObservedLabel: '22:35' },
        ],
      },
    });
    render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Ev Takımı/).length).toBe(3));
    fireEvent.press(screen.getByText('Oynanma DNA'));

    // Varsayılan gün (Cuma 01.08) → kendi saati.
    expect(await screen.findByText(/Cuma 01\.08 · kaynaktan son çekim 22:35/)).toBeTruthy();
    // Başka güne geçilince O GÜNÜN saati gelir — haftanın en sonu değil.
    fireEvent.press(screen.getByText('Perşembe'));
    expect(await screen.findByText(/Perşembe 31\.07 · kaynaktan son çekim 20:45/)).toBeTruthy();
    // Cuma'nın saati SATIRDAN düşer. (Çipinde durmaya devam eder — her çip
    // kendi gününün saatini taşır; kullanıcı hepsini bir bakışta görür.)
    expect(screen.queryByText(/kaynaktan son çekim 22:35/)).toBeNull();
  });

  test('Radar 3: o gün kayıt alınamadıysa UYDURMA saat yazılmaz', async () => {
    mockUclar({
      ...VARSAYILAN,
      '/api/radar/daily-played': {
        roundId: 1600, sources: [], matches: [],
        days: [{ ...GUN, lastObservedLabel: null }],
      },
    });
    render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Ev Takımı/).length).toBe(3));
    fireEvent.press(screen.getByText('Oynanma DNA'));
    expect(await screen.findByText(/kayıt alınamadı/)).toBeTruthy();
    expect(screen.queryByText(/son çekim/)).toBeNull();
  });

  test('Radar 3 satırı: yüzde kaynağıyla birlikte, kaynak yoksa uydurulmuyor', async () => {
    mockUclar({
      ...VARSAYILAN,
      '/api/radar/daily-played': {
        roundId: 1600, days: [ONCEKI_GUN, GUN], sources: ['k1', 'k2'],
        matches: [
          {
            no: 1,
            cells: {
              '2026-07-31': { bySource: { k1: { percentages: { '1': 58, X: 24, '2': 18 } } } },
              '2026-08-01': { bySource: { k1: { percentages: { '1': 62, X: 21, '2': 17 } }, k2: { percentages: { '1': 60, X: 22, '2': 18 } } } },
            },
          },
        ],
      },
    });
    render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Ev Takımı/).length).toBe(3));
    fireEvent.press(screen.getByText('Oynanma DNA'));

    // Aktif kaynaklar RENK LEJANTINDA adıyla yazılır (hangi siteden geldiği
    // gizlenmez) — maç satırında yalnız renkli nokta var.
    expect((await screen.findAllByTestId('kaynak-nokta-k1')).length).toBeGreaterThan(0);
    // Kaynak ADI hiç yazılmaz; yalnız renkli noktalar görünür.
    expect(screen.queryByText(/kaynak$/i)).toBeNull();
    expect(screen.getAllByTestId('kaynak-nokta-k1').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('kaynak-nokta-k2').length).toBeGreaterThan(0);
    // Maç satırında kaynak NOKTAYLA gösterilir; nokta kaynağın adını
    // erişilebilirlik etiketi olarak taşır (renk tek ayırt edici değil).
    const noktalar = screen.getAllByTestId('kaynak-nokta-k1');
    expect(noktalar.length).toBeGreaterThan(0);
    expect(noktalar[0].props.accessibilityLabel).toBe('Sarı kaynak');
    // Yüzde GERÇEKTEN çiziliyor (yalnız kaynak işareti değil).
    expect(screen.getAllByText(/1 %62/).length).toBeGreaterThan(0);
  });

  test('Oynanma DNA paneli: kaynak satırına dokununca açılıyor', async () => {
    mockUclar({
      ...VARSAYILAN,
      '/api/radar/daily-played': {
        roundId: 1600, days: [ONCEKI_GUN, GUN], sources: ['k1'],
        matches: [{
          no: 1,
          cells: { '2026-08-01': { bySource: { k1: { percentages: { '1': 62, X: 21, '2': 17 } } } } },
        }],
      },
      '/api/radar/played-dna': {
        hasData: true, position: 1, weekday: 5, settledMatches: 240,
        current: { '1': 62, X: 21, '2': 17 },
        distribution: {
          hasData: true,
          overall: { text: '18 kayıtta 8 kez 1, 5 kez X, 5 kez 2' },
          byDay: { selected: { text: '6 kayıtta 3 kez 1' }, others: { text: '12 kayıtta 5 kez 1' } },
          byPosition: { own: { text: '4 kayıtta 2 kez 1' }, rest: { text: '14 kayıtta 6 kez 1' } },
          samples: [],
        },
        movement: { words: 'ev sahibine kayış', hasData: false },
      },
    });
    render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Ev Takımı/).length).toBe(3));
    fireEvent.press(screen.getByText('Oynanma DNA'));
    const kaynak = await screen.findAllByTestId('kaynak-nokta-k1');
    fireEvent.press(kaynak[0]);

    // Yakınlık seçimi KULLANICIYA aittir — otomatik genişleme yok.
    expect(await screen.findByText('Birebir aynı')).toBeTruthy();
    expect(screen.getByText('Tüm Maçlar')).toBeTruthy();
    // Örneklem "kaç kayıtta" olarak şeffaf. Güven seviyesi/olasılık iddiası
    // PANELDE yoktur (ekranın başlığındaki "Tahmin güveni…" cümlesiyle
    // karışmasın diye kontrol panelle SINIRLANDIRILIR).
    expect(screen.getByText('18 kayıtta 8 kez 1, 5 kez X, 5 kez 2')).toBeTruthy();
    const panel = within(screen.getByTestId('oynanma-dna-1-k1'));
    expect(panel.queryByText(/güven|olasılık|ihtimal/i)).toBeNull();
    // Kapsam en sonda ve soluk.
    expect(screen.getByText(/arşivde 240 sonuçlanmış maç/)).toBeTruthy();
    // Hareket verisi yoksa uydurulmuyor.
    expect(screen.getByText('Bu harekete yakın geçmiş sonuç yok')).toBeTruthy();
  });

  test('Oynanma DNA paneli: birebir hareket eşleşmesi yoksa GEVŞEK kova gösterilir', async () => {
    mockUclar({
      ...VARSAYILAN,
      '/api/radar/daily-played': {
        roundId: 1600, days: [ONCEKI_GUN, GUN], sources: ['k1'],
        matches: [{
          no: 1,
          cells: { '2026-08-01': { bySource: { k1: { percentages: { '1': 44, X: 30, '2': 26 } } } } },
        }],
      },
      // Backend'in GERÇEK yükü (playedDna.findMovementDna → fallback alanı).
      '/api/radar/played-dna': {
        hasData: true, position: 1, weekday: 5, settledMatches: 15,
        current: { '1': 44, X: 30, '2': 26 },
        distribution: { hasData: false },
        movement: {
          words: '1 düştü · X yükseldi · 2 yükseldi',
          openText: '1 %61 · X %22 · 2 %17', closeText: '1 %44 · X %30 · 2 %26',
          hasData: false,
          fallback: {
            kind: 'moveBand', level: 'gevşek eşleşme — yön kovası',
            label: 'favorisi ≥8 puan düşen maçlar',
            matched: 3,
            overall: { text: '3 benzer kayıt — örneklem yetersiz, yüzde gösterilmez (2 kez berabere bitti, 1 kez deplasman kazandı)' },
            samples: [
              { text: '51. Hafta · 4. sıra · Ilves – Lahti · 1 %58 · X %21 · 2 %21 → 1 %45 · X %28 · 2 %27 · → Berabere bitti' },
            ],
          },
        },
      },
    });
    render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Ev Takımı/).length).toBe(3));
    fireEvent.press(screen.getByText('Oynanma DNA'));
    const kaynak = await screen.findAllByTestId('kaynak-nokta-k1');
    fireEvent.press(kaynak[0]);

    // Birebir eşleşme yok mesajı DURUR (kova onu taklit etmez)…
    expect(await screen.findByText('Bu harekete yakın geçmiş sonuç yok')).toBeTruthy();
    // …ama gevşek kova, etiketi AÇIKÇA "gevşek" olarak gösterilir.
    expect(screen.getByText(/Gevşek eşleşme · favorisi ≥8 puan düşen maçlar/)).toBeTruthy();
    expect(screen.getByText(/2 kez berabere bitti/)).toBeTruthy();
    // Kovadaki gerçek kayıtlar şeffaf.
    expect(screen.getByText(/Ilves – Lahti/)).toBeTruthy();
  });

  // LEGACY GÖRÜNÜM — Radar Merkezi ÖNCESİ haftalar.
  // Bu kod donmuş durumda: eski haftaların görüntüsü değişmemeli. Hiç testi
  // yoktu; kendi dosyasına taşınmadan önce yazıldı.
  test('eski hafta: legacy sürpriz radarı çiziliyor, yeni sistem karışmıyor', async () => {
    mockUclar({
      ...VARSAYILAN,
      '/api/radar/current': {
        hasData: false, legacyOnly: true, roundId: 1400, round: '40. Hafta', year: 2026,
        radar: [
          {
            no: 1, home: 'Eski Ev', away: 'Eski Dep', surpriseScore: 62,
            label: 'SÜRPRİZE AÇIK', labelColor: 'red',
            favorite: { symbol: '1', percent: 48 }, estimated: true,
            probabilities: { '1': 48, X: 28, '2': 24 },
            signals: { position: { home: 3, away: 11 } },
            factors: [{ label: 'Deplasman formda', points: 8 }],
            comment: 'Ev sahibi favori ama fark az.',
          },
        ],
      },
    });
    render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getByText('Eski Ev')).toBeTruthy());
    expect(screen.getByText('Eski Dep')).toBeTruthy();
    expect(screen.getByText('62')).toBeTruthy();
    // Sıra bilgisi eski biçimde ("Sıra 3. – 11.").
    expect(screen.getByText(/Sıra 3\. – 11\./)).toBeTruthy();
    // Oran YOKSA favori yüzdesi "≈" ile işaretlenir — tahmini olduğu gizlenmez.
    expect(screen.getByText(/Favori 1 · %48 ≈/)).toBeTruthy();
    // Yeni sistemin sekmeleri eski haftada GÖRÜNMEZ (iki sistem karışmaz).
    expect(screen.queryByText('Oynanma DNA')).toBeNull();
    expect(screen.queryByText('Bülten DNA')).toBeNull();
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

// RADAR 5 SATIR AÇILIMI — karşılaşmaya dokununca o SIRANIN geçmiş maçları.
// Ürünün "uydurma sayı yok" sözünün görünür hâli: %54.5'in arkasındaki
// maçlar gösterilmezse kullanıcı sayıyı doğrulayamaz.
describe('Radar 5 satır açılımı (sıranın geçmiş maçları)', () => {
  const DNA = {
    hasData: true,
    dna: {
      positions: Array.from({ length: 3 }, (_, i) => ({
        position: i + 1,
        windows: {
          allTime: { sample: 30, pct: { '1': 54.5, X: 13.6, '2': 31.9 } },
          last5: { sample: 5, pct: { '1': 60, X: 20, '2': 20 } },
        },
      })),
    },
  };
  // Backend'in GERÇEK yükü (routes/radar.js → positionMatchList): week/home/
  // away/score/result. Uydurma bir şekil test yeşil olsa bile bir şey kanıtlamaz.
  const MACLAR = {
    hasData: true, position: 1, count: 7,
    matches: [
      { roundId: '1526', week: '52. Hafta', home: 'Club Brugge', away: 'Union SG', score: '1-1', result: 'X' },
      { roundId: '1525', week: '51. Hafta', home: 'AGF Aarhus', away: 'Brondby', score: '1-1', result: 'X' },
      { roundId: '1524', week: '50. Hafta', home: 'AIK Stockholm', away: 'Gais', score: '2-0', result: '1' },
      { roundId: '1521', week: '49. Hafta', home: 'Mjallby', away: 'AIK Stockholm', score: '1-2', result: '2' },
      { roundId: '1520', week: '48. Hafta', home: 'Sirius', away: 'Mjallby', score: '4-4', result: 'X' },
      { roundId: '1519', week: '47. Hafta', home: 'Hammarby', away: 'Degerfors', score: '3-1', result: '1' },
      { roundId: '1518', week: '46. Hafta', home: 'Elfsborg', away: 'Norrkoping', score: '0-2', result: '2' },
    ],
  };

  const radar5 = async (uclar = {}) => {
    mockUclar({
      ...VARSAYILAN,
      '/api/radar/position-dna': DNA,
      '/api/radar/position-matches': MACLAR,
      ...uclar,
    });
    render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Ev Takımı/).length).toBe(3));
    fireEvent.press(screen.getByText('Bülten DNA'));
    await screen.findByText(/Tüm Haftalar/);
  };

  // BUGÜNÜN OYNANMA YÜZDESİ (kullanıcı isteği, 3 Ağustos 2026): maçın yanında
  // "hangi gündeysek o günün" yüzdeleri, GÜN ADIYLA birlikte. Gün yazılmazsa
  // alttaki "Geçmiş N. sıra" satırıyla karışır — biri bu haftanın oynanması,
  // öteki o sırada geçmişte çıkan sonuçlar.
  const GUNLUK_OYNANMA = {
    roundId: 1600,
    sources: ['k1'],
    days: [
      { date: '2026-08-02', weekday: 'Pazar', label: 'Pazar 02.08', future: false },
      { date: '2026-08-03', weekday: 'Pazartesi', label: 'Pazartesi 03.08', future: false },
      { date: '2026-08-04', weekday: 'Salı', label: 'Salı 04.08', future: true },
    ],
    matches: [
      {
        no: 1,
        cells: {
          '2026-08-02': { bySource: { k1: { percentages: { '1': 71, X: 17, '2': 12 } } } },
          '2026-08-03': { bySource: { k1: { percentages: { '1': 72, X: 16, '2': 12 } } } },
          '2026-08-04': {},          // gelecek gün: BOŞ nesne (kaynak böyle gönderiyor)
        },
      },
    ],
  };

  test('bugünün oynanma yüzdesi maçın YANINDA, gün adıyla yazar', async () => {
    await radar5({ '/api/radar/daily-played': GUNLUK_OYNANMA });
    // Gün adı KISALTILIR: satırda maçın yanında dar alan var ("altında değil
    // yanında" kullanıcı kararı). Pazartesi → "Pzt".
    expect(await screen.findByText('Pzt')).toBeTruthy();
    // Yüzdeler ayrı kutularda; harf (1/X/2) kutunun dışında ve renksiz.
    expect(screen.getByText('%72')).toBeTruthy();
    expect(screen.getByText('%16')).toBeTruthy();
    expect(screen.getByText('%12')).toBeTruthy();
    // Kaynak yalnız renkli noktayla görünür; adı hiçbir yerde geçmez.
    expect(screen.getByTestId('radar5-bugun-nokta-k1')).toBeTruthy();
  });

  test('GELECEK günün boş hücresi "bugün" sanılmaz', async () => {
    // radarGun.js'teki doğrulanmış hata: boş nesne `{}` JavaScript'te doğrudur
    // ve gelecek gün "verisi var" sayılıp seçiliyordu. Radar 5 de aynı seçiciyi
    // kullanır; Salı'nın yüzdesi olmadığı için Pazartesi kalmalı.
    await radar5({ '/api/radar/daily-played': GUNLUK_OYNANMA });
    expect(await screen.findByText('Pzt')).toBeTruthy();
    expect(screen.queryByText('Sal')).toBeNull();
    // Salı seçilseydi hücresi boş olduğu için yüzde de değişirdi.
    // Yüzdeler ayrı kutularda; harf (1/X/2) kutunun dışında ve renksiz.
    expect(screen.getByText('%72')).toBeTruthy();
    expect(screen.getByText('%16')).toBeTruthy();
    expect(screen.getByText('%12')).toBeTruthy();
  });

  test('Pazar ile Pazartesi KISALTMADA karışmaz', async () => {
    // "Paz" ilk üç harf kesmesi ikisini de aynı gösterirdi; açık eşleme var.
    await radar5({
      '/api/radar/daily-played': {
        ...GUNLUK_OYNANMA,
        days: [{ date: '2026-08-02', weekday: 'Pazar', label: 'Pazar 02.08', future: false }],
        matches: [{
          no: 1,
          cells: { '2026-08-02': { bySource: { k1: { percentages: { '1': 71, X: 17, '2': 12 } } } } },
        }],
      },
    });
    expect(await screen.findByText('Paz')).toBeTruthy();
    expect(screen.queryByText('Pzt')).toBeNull();
  });

  test('günlük oynanma verisi YOKSA satır hiç çizilmez (uydurma yüzde yok)', async () => {
    await radar5({
      '/api/radar/daily-played': { roundId: 1600, days: [], matches: [], sources: [] },
    });
    await screen.findByText(/Tüm Haftalar/);
    expect(screen.queryByTestId('radar5-bugun-nokta-k1')).toBeNull();
  });

  test('liste KAPALI başlar — maçlar kendiliğinden çizilmez', async () => {
    await radar5();
    // Satırlar duruyor (olumlu karşılık)…
    expect(screen.getAllByText(/Geçmiş 1\. sıra/).length).toBeGreaterThan(0);
    // …ama geçmiş maçlar yok.
    expect(screen.queryByText(/Club Brugge/)).toBeNull();
    expect(screen.queryByText('52. Hafta')).toBeNull();
  });

  test('karşılaşmaya dokununca o sıranın maçları yeniden eskiye listelenir', async () => {
    await radar5();
    fireEvent.press(screen.getAllByText('Ev Takımı – Dep Takımı')[0]);
    // DÜZEN: hafta maçın BAŞINDA, skor iki takımın ORTASINDA (tire'nin yerinde).
    expect(await screen.findByText(/Club Brugge 1-1 Union SG/)).toBeTruthy();
    // Sıra yeniden eskiye: 52 → 51 → 50 …
    expect(screen.getByText('52. Hafta')).toBeTruthy();
    expect(screen.getByText('51. Hafta')).toBeTruthy();
    // Skor ve sonuç birlikte — sonuç tek başına doğrulanamaz.
    expect(screen.getAllByText('1-1').length).toBe(2);   // 52. ve 51. hafta
    expect(screen.getAllByText('X').length).toBeGreaterThan(0);
    // Doğru uç, doğru sıra ile çağrıldı.
    const urls = global.fetch.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('/api/radar/position-matches?position=1'))).toBe(true);
  });

  test('liste SEÇİLİ DÖNEMLE sınırlanır (Son 5 Hafta → 5 maç)', async () => {
    await radar5();
    // Çip artık YALNIZ dönem adıdır — "· %66.7" ve eğilim oku kullanıcı
    // kararıyla kaldırıldı ("dönem başarısı kafa karıştırıyor").
    fireEvent.press(screen.getByText('Son 5 Hafta'));
    fireEvent.press(screen.getAllByText('Ev Takımı – Dep Takımı')[0]);
    // İlk 5 maç görünür…
    expect(await screen.findByText('48. Hafta')).toBeTruthy();
    // …6. ve 7. görünmez: yüzde 5 haftadan hesaplandı, liste de 5 hafta olmalı.
    expect(screen.queryByText('47. Hafta')).toBeNull();
    expect(screen.queryByText('46. Hafta')).toBeNull();
    expect(screen.getByText(/Son 5 Hafta · 5 maç/)).toBeTruthy();
  });

  test('tekrar dokununca kapanır', async () => {
    await radar5();
    const satir = screen.getAllByText('Ev Takımı – Dep Takımı')[0];
    fireEvent.press(satir);
    expect(await screen.findByText('52. Hafta')).toBeTruthy();
    fireEvent.press(satir);
    expect(screen.queryByText('52. Hafta')).toBeNull();
  });

  test('sıra için geçmiş sonuç YOKSA uydurma satır çizilmez', async () => {
    await radar5({
      '/api/radar/position-matches': { hasData: false, position: 1, count: 0, matches: [] },
    });
    fireEvent.press(screen.getAllByText('Ev Takımı – Dep Takımı')[0]);
    expect(await screen.findByText(/doğrulanmış geçmiş sonuç yok/)).toBeTruthy();
  });

  // MAÇIN ALTINDA O HAFTANIN OYNANMA YÜZDESİ (kullanıcı isteği).
  // Yalnız haftanın SON günü (Cuma) yazılır; arşiv 51. haftada başladığı için
  // eski maçlarda veri YOKTUR ve o satırlarda hiçbir şey çizilmemelidir.
  const OYNANMALI = {
    ...MACLAR,
    playedCount: 2,
    matches: MACLAR.matches.map((m, i) => ({
      ...m,
      played: i === 0 ? { gun: '2026-07-31', pct: { '1': 44, X: 30, '2': 26 }, favori: '1', favoriPct: 44 }
        : i === 1 ? { gun: '2026-07-24', pct: { '1': 51, X: 29, '2': 20 }, favori: '1', favoriPct: 51 }
          : null,
    })),
  };

  // TABLO DÜZENİ — kullanıcının verdiği bülten tablosunun aynısı:
  // KARŞILAŞMA | 1 · X · 2 (oynanma) | SONUÇ. Başlık BİR KEZ üstte.
  test('oynanma yüzdeleri sütunlarda, sağında sonuç', async () => {
    await radar5({ '/api/radar/position-matches': OYNANMALI });
    fireEvent.press(screen.getAllByText('Ev Takımı – Dep Takımı')[0]);
    // DÜZEN: hafta maçın BAŞINDA, skor iki takımın ORTASINDA (tire'nin yerinde).
    expect(await screen.findByText(/Club Brugge 1-1 Union SG/)).toBeTruthy();
    // Başlık satırı bir kez — her maçta tekrarlanmıyor.
    expect(screen.getAllByText('KARŞILAŞMA').length).toBe(1);
    expect(screen.getAllByText('SON').length).toBe(1);
    // 52. haftanın hücreleri…
    expect(screen.getByText('%44')).toBeTruthy();
    expect(screen.getByText('%30')).toBeTruthy();
    expect(screen.getByText('%26')).toBeTruthy();
    // …51. haftanınkiler de. Hafta ve skor karşılaşma hücresinde yan yana.
    expect(screen.getByText('%29')).toBeTruthy();
    expect(screen.getByText('52. Hafta')).toBeTruthy();
    expect(screen.getAllByText('1-1').length).toBe(2);
  });

  test('veri OLMAYAN maçta %0 YAZILMAZ — hücreye tire konur', async () => {
    await radar5({ '/api/radar/position-matches': OYNANMALI });
    fireEvent.press(screen.getAllByText('Ev Takımı – Dep Takımı')[0]);
    expect(await screen.findByText('50. Hafta')).toBeTruthy();
    // 7 maçın 5'i kayıtsız → 5×3 = 15 tire. Sıfır UYDURULMADI.
    expect(screen.queryAllByText(/%0\b/).length).toBe(0);
    expect(screen.getAllByText('–').length).toBe(15);
    // Eksiklik alt bilgide de sayıyla söylenir.
    expect(screen.getByText(/5 maçta oynanma kaydı yok/)).toBeTruthy();
  });

  test('hiç oynanma verisi yoksa tablo yine çizilir, hücreler tire', async () => {
    await radar5({ '/api/radar/position-matches': { ...MACLAR, playedCount: 0 } });
    fireEvent.press(screen.getAllByText('Ev Takımı – Dep Takımı')[0]);
    // DÜZEN: hafta maçın BAŞINDA, skor iki takımın ORTASINDA (tire'nin yerinde).
    expect(await screen.findByText(/Club Brugge 1-1 Union SG/)).toBeTruthy();
    expect(screen.getAllByText('–').length).toBe(21);   // 7 maç × 3 sütun
  });

  // LİSTE KISALDI — 50. Hafta ve öncesi backend'de kesiliyor (kullanıcı kararı:
  // "49. haftadan geriye doğru silelim" + "50 de dahil olsun veri yok").
  // Ekran, listenin NEREDE başladığını ve yüzdenin ondan bağımsız hesaplandığını
  // söylemek ZORUNDA: 2 maçlık listeye bakıp %54'ü doğrulamaya çalışan kullanıcı
  // aksi hâlde ekranı bozuk sanır.
  test('kısalan listenin başlangıcı ve yüzdenin kapsamı yazılır', async () => {
    await radar5({
      '/api/radar/position-matches': {
        hasData: true, position: 1, count: 2, playedCount: 2,
        matches: [
          { roundId: '1526', week: '52. Hafta', home: 'Club Brugge', away: 'Union SG', score: '1-1', result: 'X', played: { gun: '2026-07-31', pct: { '1': 44, X: 30, '2': 26 } } },
          { roundId: '1525', week: '51. Hafta', home: 'AGF Aarhus', away: 'Brondby', score: '1-1', result: 'X', played: { gun: '2026-07-24', pct: { '1': 51, X: 29, '2': 20 } } },
        ],
      },
    });
    fireEvent.press(screen.getAllByText('Ev Takımı – Dep Takımı')[0]);
    // DÜZEN: hafta maçın BAŞINDA, skor iki takımın ORTASINDA (tire'nin yerinde).
    expect(await screen.findByText(/Club Brugge 1-1 Union SG/)).toBeTruthy();
    // Listenin en eskisi 51. Hafta → başlangıç olarak O yazılır (sabit değil).
    expect(screen.getByText(/liste 51\. Hafta'ndan başlar/)).toBeTruthy();
    expect(screen.getByText(/yüzde tüm haftalardan hesaplanır/)).toBeTruthy();
    // Kesilen haftalar gerçekten yok.
    expect(screen.queryByText('50. Hafta')).toBeNull();
    expect(screen.queryByText('49. Hafta')).toBeNull();
  });
});

// RADAR 5 SÜZGEÇ MODLARI — "Oynanma %" ve "Oran" (2026-08-08).
//
// Dönem satırındaki iki yeni mod HAFTA değil MAÇ birimiyle çalışır: alt satırda
// ikinci bir çip şeridi açılır (Son 5/10/15 maç · Tüm maçlar). "Oynanma %"
// modunda geçmiş maçlar, GÜNCEL maçın oynanma yüzdesine ±3 puan yakınlığa göre
// süzülür ve satır başlığındaki 1/X/2 YALNIZ o süzülmüş listeden hesaplanır.
//
// NEDEN TEST: başlıktaki yüzde ile açılan liste farklı tabandan gelirse hata
// SESSİZDİR — ekranda yine düzgün bir sayı görünür ama başka bir şeyi ölçer.
// Radar 5'in geçmişteki en pahalı hatası tam olarak buydu (lessons.md §8).
describe('Radar 5 süzgeç modları (Oynanma % / Oran)', () => {
  const DNA = {
    hasData: true,
    dna: {
      positions: Array.from({ length: 3 }, (_, i) => ({
        position: i + 1,
        windows: { allTime: { sample: 30, pct: { '1': 54.5, X: 13.6, '2': 31.9 } } },
      })),
    },
  };

  // Güncel haftanın oynanma yüzdesi — hedef profil: 1 %44 · X %30 · 2 %26.
  // Kaynak k1: geçmiş yüzdeler de arka uçta tek kaynaktan çıkarılıyor, iki
  // farklı kaynağı kıyaslamak iki farklı ölçeği kıyaslamak olurdu.
  const GUNLUK = {
    roundId: 1600,
    sources: ['k1'],
    days: [{ date: '2026-08-03', weekday: 'Pazartesi', label: 'Pazartesi 03.08', future: false }],
    matches: [{
      no: 1,
      cells: { '2026-08-03': { bySource: { k1: { percentages: { '1': 44, X: 30, '2': 26 } } } } },
    }],
  };

  const gecmis = (rid, hafta, ev, dep, result, pct) => ({
    roundId: String(rid), week: hafta, home: ev, away: dep, score: '1-0', result,
    played: pct ? { gun: '2026-07-31', pct } : null,
  });

  // YAKIN üç maç (biri tam ±3 sınırında) + UZAK iki maç.
  const MACLAR = {
    hasData: true,
    position: 1,
    count: 5,
    playedCount: 4,
    matches: [
      gecmis(1526, '52. Hafta', 'Club Brugge', 'Union SG', 'X', { '1': 44, X: 30, '2': 26 }),
      gecmis(1525, '51. Hafta', 'AGF Aarhus', 'Brondby', '1', { '1': 46, X: 28, '2': 26 }),
      gecmis(1524, '50. Hafta', 'AIK Stockholm', 'Gais', 'X', { '1': 41, X: 33, '2': 26 }), // tam 3
      gecmis(1521, '49. Hafta', 'Mjallby', 'Sirius', '2', { '1': 40, X: 34, '2': 26 }),     // 4 → dışarıda
      gecmis(1520, '48. Hafta', 'Hammarby', 'Degerfors', '1', null),                        // yüzdesiz
    ],
  };

  const radar5 = async (uclar = {}) => {
    mockUclar({
      ...VARSAYILAN,
      '/api/radar/position-dna': DNA,
      '/api/radar/position-matches': MACLAR,
      '/api/radar/daily-played': GUNLUK,
      ...uclar,
    });
    render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Ev Takımı/).length).toBe(3));
    fireEvent.press(screen.getByText('Bülten DNA'));
    await screen.findByText(/Tüm Haftalar/);
  };

  test('yeni modlar dönem satırında duruyor, seçilince MAÇ birimli alt satır açılır', async () => {
    await radar5();
    // Kapalıyken alt satır YOK — hafta ile maç birimi aynı anda görünmez.
    expect(screen.queryByText('Son 5 maç')).toBeNull();
    fireEvent.press(screen.getByText('Oynanma %'));
    expect(await screen.findByText('Son 5 maç')).toBeTruthy();
    expect(screen.getByText('Tüm maçlar')).toBeTruthy();
    // Birim farkı ekranda AÇIKÇA yazar (hafta ≠ maç).
    expect(screen.getByText(/Üst satır HAFTA, alt satır MAÇ sayar/)).toBeTruthy();
    // Hafta çipleri kaybolmaz; kullanıcı geri dönebilmeli.
    expect(screen.getByText('Tüm Haftalar')).toBeTruthy();
  });

  test('yüzde SÜZÜLMÜŞ maçlardan hesaplanır; ±3 sınırı ve yüzdesiz maç dışarıda', async () => {
    await radar5();
    fireEvent.press(screen.getByText('Oynanma %'));
    // 3 yakın maç: X, 1, X → X %66.7 · 1 %33.3 · 2 %0.0. Örneklem 5'in
    // altında olduğu için "az" işareti de duruyor (tesadüfe açık).
    expect(await screen.findByText('Benzer oynanma · 3 maç · az')).toBeTruthy();
    expect(screen.getByText('%66.7')).toBeTruthy();
    expect(screen.getByText('%33.3')).toBeTruthy();
    // Eski (hafta penceresi) yüzdeleri artık yazmamalı — taban değişti.
    expect(screen.queryByText('%54.5')).toBeNull();
    expect(screen.queryAllByText(/Geçmiş 1\. sıra/).length).toBe(0);

    // LİSTE ile BAŞLIK aynı diziden gelir: yakın 3 maç var, uzak/yüzdesiz yok.
    fireEvent.press(screen.getAllByText('Ev Takımı – Dep Takımı')[0]);
    expect(await screen.findByText(/Club Brugge 1-0 Union SG/)).toBeTruthy();
    expect(screen.getByText('50. Hafta')).toBeTruthy();
    expect(screen.queryByText('49. Hafta')).toBeNull();   // ±4 → dışarıda
    expect(screen.queryByText('48. Hafta')).toBeNull();   // yüzdesi yok
  });

  test('kapsam notu artık "tüm haftalar" DEMEZ — yüzde bu listeden gelir', async () => {
    // Yanlış cümle bırakılsaydı ekran, tutarsızlığın üstünü örten bir yama
    // olurdu (lessons.md §8): liste 3 maç, cümle "tüm haftalar".
    await radar5();
    fireEvent.press(screen.getByText('Oynanma %'));
    fireEvent.press(screen.getAllByText('Ev Takımı – Dep Takımı')[0]);
    await screen.findByText(/Club Brugge 1-0 Union SG/);
    fireEvent.press(screen.getByLabelText('Bu liste ne kadarını kapsıyor?'));
    expect(await screen.findByText(/yüzde tam olarak bu listeden hesaplanır/)).toBeTruthy();
    expect(screen.queryByText(/yüzde tüm haftalardan hesaplanır/)).toBeNull();
  });

  test('maç limiti listeyi de yüzdeyi de BİRLİKTE daraltır', async () => {
    // Altı yakın maç: "Tüm maçlar" 6'sını da alır, "Son 5 maç" en YENİ 5'ini.
    const alti = [52, 51, 50, 49, 48, 47].map((h, i) => gecmis(
      1530 - i, `${h}. Hafta`, `Ev${h}`, `Dep${h}`, i === 5 ? '2' : '1',
      { '1': 44, X: 30, '2': 26 },
    ));
    await radar5({
      '/api/radar/position-matches': { hasData: true, position: 1, count: 6, playedCount: 6, matches: alti },
    });
    fireEvent.press(screen.getByText('Oynanma %'));
    // Tüm maçlar (varsayılan): 6 maç, 5×'1' + 1×'2' → 1 %83.3.
    expect(await screen.findByText('Benzer oynanma · 6 maç')).toBeTruthy();
    expect(screen.getByText('%83.3')).toBeTruthy();

    fireEvent.press(screen.getByText('Son 5 maç'));
    // En yeni 5 maçın hepsi '1' → %100.0. Başlık ve liste BİRLİKTE daraldı.
    expect(await screen.findByText('Benzer oynanma · 5 maç')).toBeTruthy();
    expect(screen.getByText('%100.0')).toBeTruthy();
    fireEvent.press(screen.getAllByText('Ev Takımı – Dep Takımı')[0]);
    expect(await screen.findByText('48. Hafta')).toBeTruthy();
    expect(screen.queryByText('47. Hafta')).toBeNull();   // limit dışında
  });

  test('güncel yüzdesi olmayan sırada UYDURMA yüzde yazılmaz', async () => {
    // GUNLUK yalnız 1. maçın yüzdesini taşıyor; 2. ve 3. sıra karşılaştırma
    // yapamaz ve bunu dürüstçe söyler.
    await radar5();
    fireEvent.press(screen.getByText('Oynanma %'));
    expect(await screen.findByText('Benzer oynanma · 3 maç · az')).toBeTruthy();
    expect(screen.getAllByText(/oynanma yüzdesi yok — benzerlik kurulamadı/).length).toBe(2);
  });

  test('"Oran" modunda geçmiş oran YOK — yüzde üretilmez, dürüstçe yazılır', async () => {
    await radar5();
    fireEvent.press(screen.getByText('Oran'));
    expect(await screen.findByText('Son 5 maç')).toBeTruthy();   // çip seçilebilir
    expect(screen.getAllByText(/oran kaydı arşivde yok — bu süzgeç veri biriktikçe çalışacak/).length).toBe(3);
    expect(screen.queryByText('%54.5')).toBeNull();
    expect(screen.queryByText('%66.7')).toBeNull();
  });

  // SAĞ TARAF MODA GÖRE DEĞİŞİR (kullanıcı isteği, 8 Ağustos 2026):
  // "Oynanma %" → bugünün oynanma yüzdesi · "Oran" → SON GÜNÜN 1/X/2 oranı.
  // İkisi aynı yerde durduğu için birim karışması en pahalı hatadır: "1.61"
  // ile "%51" aynı köşede yazar, hangisi olduğu gün adının yanındaki değerden
  // okunur. Bu yüzden hem oranın GELDİĞİ hem yüzdenin GİTTİĞİ sınanır.
  const ORANLAR = {
    roundId: 1600,
    days: [
      { date: '2026-08-02', weekday: 'Pazar', future: false },
      { date: '2026-08-03', weekday: 'Pazartesi', future: false },
      { date: '2026-08-07', weekday: 'Cuma', future: true },
    ],
    matches: [
      {
        no: 1,
        cells: {
          '2026-08-02': { odds: { home: 2.10, draw: 3.30, away: 3.40 } },
          '2026-08-03': { odds: { home: 1.61, draw: 3.20, away: 4.25 } },
          // Gelecek günde kayıt olsa bile seçilmemeli.
          '2026-08-07': { odds: { home: 1.40, draw: 4.00, away: 6.50 } },
        },
      },
      { no: 2, cells: { '2026-08-02': { odds: { home: 1.90, draw: 3.40, away: 3.90 } } }, notes: { '2026-08-03': { text: 'Bu gün mühür alınamadı' } } },
      { no: 3, cells: {} },
    ],
  };

  test('"Oran" modunda sağ tarafta SON GÜNÜN oranı yazar; yüzde yerini bırakır', async () => {
    await radar5({ '/api/radar/daily-odds': ORANLAR });
    // Önce "Oynanma %": sağda bu haftanın yüzdesi duruyor.
    fireEvent.press(screen.getByText('Oynanma %'));
    expect(await screen.findByText('%44')).toBeTruthy();

    fireEvent.press(screen.getByText('Oran'));
    // 1. maç: son DOLU ve geçmiş gün Pazartesi — Pazar'ın 2.10'u da, Cuma'nın
    // (gelecek) 1.40'ı da DEĞİL.
    expect(await screen.findByText('1.61')).toBeTruthy();
    expect(screen.getByText('3.20')).toBeTruthy();
    expect(screen.getByText('4.25')).toBeTruthy();
    expect(screen.getAllByText('Pzt').length).toBe(3);
    expect(screen.queryByText('2.10')).toBeNull();
    expect(screen.queryByText('1.40')).toBeNull();
    // Oynanma yüzdesi artık sağda DEĞİL (birim karışmasın).
    expect(screen.queryByText('%44')).toBeNull();
    // Kaydı olmayan maçlarda sayı UYDURULMAZ; sebep arka uçtan taşınır.
    expect(screen.getByText('Bu gün mühür alınamadı')).toBeTruthy();
    expect(screen.getByText('oran kaydı yok')).toBeTruthy();
    expect(screen.queryByText('0.00')).toBeNull();
  });

  test('oran verisi hiç gelmediyse "kayıt yok" DENMEZ (sebep karıştırılmaz)', async () => {
    await radar5();   // /api/radar/daily-odds tanımsız → 404
    fireEvent.press(screen.getByText('Oran'));
    expect(await screen.findByText('Son 5 maç')).toBeTruthy();
    expect(screen.getAllByText('oran yükleniyor…').length).toBe(3);
    expect(screen.queryByText('oran kaydı yok')).toBeNull();
  });

  test('"Oynanma %" modunda sağ taraf ESKİSİ GİBİ yüzde gösterir (gerileme yok)', async () => {
    await radar5({ '/api/radar/daily-odds': ORANLAR });
    fireEvent.press(screen.getByText('Oran'));
    await screen.findByText('1.61');
    fireEvent.press(screen.getByText('Oynanma %'));
    // Yüzde geri gelir, oran gider.
    expect(await screen.findByText('%44')).toBeTruthy();
    expect(screen.getByText('%30')).toBeTruthy();
    expect(screen.queryByText('1.61')).toBeNull();
  });

  test('hafta pencerelerine dönünce ESKİ davranış aynen sürer (gerileme yok)', async () => {
    await radar5();
    fireEvent.press(screen.getByText('Oynanma %'));
    await screen.findByText('Son 5 maç');
    fireEvent.press(screen.getByText('Tüm Haftalar'));
    // Alt satır kapanır, eski etiket ve eski yüzde geri gelir.
    await waitFor(() => expect(screen.queryByText('Son 5 maç')).toBeNull());
    expect(screen.getAllByText(/Geçmiş 1\. sıra/).length).toBe(1);
    expect(screen.getAllByText('%54.5').length).toBe(3);
  });
});

// FİLTRE SATIRI YAPIŞIK — liste kayınca üstte sabit kalır.
describe('Radar 5 filtre satırı yapışık kalır', () => {
  const DNA5 = {
    hasData: true,
    dna: {
      positions: Array.from({ length: 3 }, (_, i) => ({
        position: i + 1,
        windows: { allTime: { sample: 30, pct: { '1': 50, X: 30, '2': 20 } } },
      })),
    },
  };

  test('Radar 5 açıkken başlık YAPIŞIK indekste', async () => {
    mockUclar({ ...VARSAYILAN, '/api/radar/position-dna': DNA5 });
    const { UNSAFE_getByType } = render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Ev Takımı/).length).toBe(3));
    fireEvent.press(screen.getByText('Bülten DNA'));
    await screen.findByText(/Tüm Haftalar/);

    const { FlatList } = require('react-native');
    expect(UNSAFE_getByType(FlatList).props.stickyHeaderIndices).toEqual([0]);
  });

  test('Master sekmesinde yapışık şerit YOK (başlık zaten çizilmiyor)', async () => {
    mockUclar(VARSAYILAN);
    const { UNSAFE_getByType } = render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Ev Takımı/).length).toBe(3));
    // Master sekmesi açık (varsayılan) — üst panel çizilmiyor…
    expect(screen.queryByText(/Tüm Haftalar/)).toBeNull();
    // …bu yüzden sticky indeks de verilmemeli.
    const { FlatList } = require('react-native');
    expect(UNSAFE_getByType(FlatList).props.stickyHeaderIndices).toBeUndefined();
  });
});

// Radar 4 (Oran Takibi) başlığı UZUN bir bilgi panelidir — dondurulursa
// ekranın yarısını kaplar. Yapışıklık yalnız Radar 5'e aittir.
test('Radar 4 sekmesinde başlık YAPIŞIK DEĞİL', async () => {
  mockUclar({ ...VARSAYILAN });
  const { UNSAFE_getByType } = render(<RadarScreen navigation={nav} />);
  await waitFor(() => expect(screen.getAllByText(/Ev Takımı/).length).toBe(3));
  fireEvent.press(screen.getByText('Oran Takibi'));
  // Olumlu karşılık: Radar 4 paneli gerçekten çizildi…
  expect(await screen.findByText(/Oran Takibi · Günlük/)).toBeTruthy();
  // …ama yapışık değil.
  const { FlatList } = require('react-native');
  expect(UNSAFE_getByType(FlatList).props.stickyHeaderIndices).toBeUndefined();
});

// SADE BAŞLIK — yeşil saha paneli ve alt başlık kaldırıldı (kullanıcı kararı).
test('başlıkta yalnız hangi haftaya bakıldığı yazar', async () => {
  mockUclar(VARSAYILAN);
  render(<RadarScreen navigation={nav} />);
  await waitFor(() => expect(screen.getByText('1. Hafta · Radar Merkezi')).toBeTruthy());
  // Alt başlık kaldırıldı.
  expect(screen.queryByText(/açıklanabilir karar desteği/)).toBeNull();
  expect(screen.queryByText(/Sürpriz radarı arşivi/)).toBeNull();
});

test('mühür güvencesi başlığın altında KALIYOR', async () => {
  // Teknik bloklar kalktı ama bu bir teknik gösterge değil: geçmiş haftaya
  // bakan kullanıcıya "sonradan değişmez" sözü verilir.
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
});

// SEZON GEÇİŞİ — 53. haftadan sonra yeni sezon 1. haftayla başlar.
// Ölçüldü: sabit pencereler aktif sezona bağlı olduğu için örneklem
// 51 haftadan 1'e düşüyor ve bir sıra "1 %100.0" gösteriyor.
describe('Sezon geçişi (yeni sezon 1. hafta)', () => {
  const YENI_SEZON_HAFTALAR = {
    weeks: [
      { roundId: 1528, round: '1. Hafta', year: 2027, current: true, archived: false, locked: false, sealed: false },
      { roundId: 1527, round: '53. Hafta', year: 2026, current: false, archived: true, locked: true, sealed: true },
    ],
    currentRoundId: 1528,
  };

  test('SEZON seçici çıkar, hafta listesi seçili sezona göre süzülür', async () => {
    mockUclar({
      ...VARSAYILAN,
      '/api/radar/current': { ...GUNCEL, roundId: 1528, round: '1. Hafta', year: 2027 },
      '/api/radar/weeks': YENI_SEZON_HAFTALAR,
    });
    render(<RadarScreen navigation={nav} />);
    // Bakılan hafta yeni sezonun 1. haftası → sezon ona uyar.
    await waitFor(() => expect(screen.getByText('2026/2027 Sezonu')).toBeTruthy());
    expect(screen.getByText('1. Hafta · Güncel')).toBeTruthy();
    // Hafta listesi KAPALI başlar; eski sezonun haftası görünmez.
    expect(screen.queryByText('53. Hafta')).toBeNull();

    // Eski sezona geç: liste onun haftalarını gösterir, yenininki düşer.
    fireEvent.press(screen.getByText('2026/2027 Sezonu'));
    fireEvent.press(await screen.findByText('2025/2026 Sezonu'));
    expect(await screen.findByText('53. Hafta')).toBeTruthy();
    expect(screen.queryByText('1. Hafta')).toBeNull();
  });

});

// HAFTA SEÇİCİ — resmî listedeki gezinti: [sezon ▼] [hafta ▼].
// Çipler kaldırıldı: yeni sezon 1. haftayla başlayınca numaralar küçülüyor,
// haftalar birikiyor (sezonda 52) ve şerit okunmuyordu.
describe('Hafta seçici (sezon + hafta açılır listeleri)', () => {
  const COK_HAFTA = {
    weeks: [
      { roundId: 1527, round: '53. Hafta', year: 2026, current: true, archived: false, locked: false, sealed: false },
      { roundId: 1526, round: '52. Hafta', year: 2026, current: false, archived: true, locked: true, sealed: true },
      { roundId: 1525, round: '51. Hafta', year: 2026, current: false, archived: true, locked: true, sealed: true },
      { roundId: 1521, round: '49. Hafta', year: 2026, current: false, archived: true, locked: true, sealed: true },
    ],
    currentRoundId: 1527,
  };
  const GUNCEL_53 = { ...GUNCEL, roundId: 1527, round: '53. Hafta', year: 2026 };

  const kur = async (uclar = {}) => {
    mockUclar({ ...VARSAYILAN, '/api/radar/current': GUNCEL_53, '/api/radar/weeks': COK_HAFTA, ...uclar });
    render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getByText('53. Hafta · Güncel')).toBeTruthy());
  };

  test('haftalar çip olarak DİZİLMEZ; liste kapalı başlar', async () => {
    await kur();
    // Sezon düz yazı (tek sezon), hafta düğmesi bakılan haftayı yazar.
    expect(screen.getByText('2025/2026 Sezonu')).toBeTruthy();
    // Öbür haftalar ekranda YOK.
    expect(screen.queryByText('52. Hafta')).toBeNull();
    expect(screen.queryByText('49. Hafta')).toBeNull();
  });

  test('hafta düğmesine basınca TÜM haftalar (güncel dahil) yeniden eskiye', async () => {
    await kur();
    fireEvent.press(screen.getByText('53. Hafta · Güncel'));
    // Güncel hafta da listenin İÇİNDE — resmî listedeki gibi.
    expect(await screen.findByText('53. Hafta')).toBeTruthy();
    expect(screen.getByText('52. Hafta')).toBeTruthy();
    expect(screen.getByText('49. Hafta')).toBeTruthy();
    expect(screen.getAllByText('🔏').length).toBe(3);
    expect(screen.getAllByText('Güncel').length).toBe(1);
    expect(screen.getByTestId('hafta-ok').props.children).toBe('▲');
  });

  test('listeden hafta seçince o hafta yüklenir ve liste kapanır', async () => {
    await kur({
      '/api/radar/1526': {
        ...GUNCEL, roundId: 1526, round: '52. Hafta', current: false, sealed: true,
        sealedAt: '2026-07-28T17:00:00Z', verificationHash: 'feedbeef01',
      },
    });
    fireEvent.press(screen.getByText('53. Hafta · Güncel'));
    fireEvent.press(await screen.findByText('52. Hafta'));
    await waitFor(() => expect(screen.getByText(/Mühürlü analiz/)).toBeTruthy());
    const urls = global.fetch.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('/api/radar/1526'))).toBe(true);
    // Liste kapandı; düğme artık seçili haftayı yazıyor ("· Güncel" düştü).
    expect(screen.getByTestId('hafta-ok').props.children).toBe('▼');
    expect(screen.queryByText('49. Hafta')).toBeNull();
    expect(screen.queryByText('53. Hafta · Güncel')).toBeNull();
  });

  test('TEK sezonda bile sezon AÇILIR görünür (dokunulabilir olduğu belli)', async () => {
    await kur();
    // Önce düz yazıydı ve "açılır olduğu anlaşılmıyor" geri bildirimi geldi.
    expect(screen.getByTestId('sezon-ok').props.children).toBe('▼');
    expect(screen.getByText('2025/2026 Sezonu')).toBeTruthy();
    // Açılınca o tek sezon listelenir; ok yön değiştirir.
    fireEvent.press(screen.getByText('2025/2026 Sezonu'));
    expect(screen.getByTestId('sezon-ok').props.children).toBe('▲');
  });

  test('oklar CİHAZDA GÖRÜNEN karakterlerle çizilir (⌄/⌃ değil)', async () => {
    // ⌄ (U+2304) ve ⌃ (U+2303) birçok yazı tipinde YOK — cihazda boş çıkıyordu.
    // ▼/▲ aynı ekranda Radar 5 satır açılımında zaten çalışıyor.
    await kur();
    for (const id of ['sezon-ok', 'hafta-ok']) {
      const ok = screen.getByTestId(id).props.children;
      assertGorunurOk(ok);
    }
  });
});

// SEKME KORUMASI — aynı hafta yeniden yüklendiğinde açık radar korunur.
// Gerçek şikâyet: "Radar 3'e geldiğimde filtre seçince Master'a geçiyor."
// Sebep, listeyi aşağı çekince tetiklenen yenilemeydi; gün çipleri listenin
// en üstünde olduğu için çipe uzanırken kolayca oluyordu.
describe('Sekme koruması (yenilemede Master\'a atmaz)', () => {
  const yenile = (UNSAFE_getByType) => {
    const { FlatList } = require('react-native');
    const liste = UNSAFE_getByType(FlatList);
    act(() => { liste.props.refreshControl.props.onRefresh(); });
  };

  test('AYNI hafta yeniden yüklenince açık radar KORUNUR', async () => {
    mockUclar(VARSAYILAN);
    const { UNSAFE_getByType } = render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Ev Takımı/).length).toBe(3));
    fireEvent.press(screen.getByText('Oynanma DNA'));
    expect(await screen.findByText(/Oynanma DNA · Günlük/)).toBeTruthy();

    // Yenilemeyi tetikle ve YANITIN GELMESİNİ BEKLE. Beklenmezse test,
    // sekme sıfırlanmadan önce bakar ve hatayı yakalamaz (bir kez düştü).
    const oncekiIstek = global.fetch.mock.calls.filter((c) => String(c[0]).includes('/api/radar/current')).length;
    yenile(UNSAFE_getByType);
    await waitFor(() => {
      const simdi = global.fetch.mock.calls.filter((c) => String(c[0]).includes('/api/radar/current')).length;
      expect(simdi).toBeGreaterThan(oncekiIstek);
    });
    await act(async () => { await Promise.resolve(); });
    // Radar 3 paneli hâlâ ekranda — Master'a atmadı.
    expect(screen.getByText(/Oynanma DNA · Günlük/)).toBeTruthy();
  });

  test('HAFTA DEĞİŞİNCE de açık radar KORUNUR (53 → 52, Radar 5 açık kalır)', async () => {
    mockUclar({
      ...VARSAYILAN,
      '/api/radar/weeks': {
        weeks: [
          { roundId: 1600, round: '53. Hafta', year: 2026, current: true },
          { roundId: 1599, round: '52. Hafta', year: 2026, sealed: true, locked: true },
        ],
        currentRoundId: 1600,
      },
      '/api/radar/1599': { ...GUNCEL, roundId: 1599, round: '52. Hafta', current: false },
      '/api/radar/position-dna': {
        hasData: true,
        dna: { positions: [{ position: 1, windows: { allTime: { sample: 30, pct: { '1': 50, X: 30, '2': 20 } } } }] },
      },
    });
    render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Ev Takımı/).length).toBe(3));
    fireEvent.press(screen.getByText('Bülten DNA'));
    expect(await screen.findByText(/Tüm Haftalar/)).toBeTruthy();

    // 53 → 52. haftaya geç.
    fireEvent.press(screen.getByText('53. Hafta · Güncel'));
    fireEvent.press(await screen.findByText('52. Hafta'));

    // Radar 5 AÇIK KALDI — Master listesine dönmedi.
    await waitFor(() => expect(screen.getByText(/Tüm Haftalar/)).toBeTruthy());
    expect(screen.getByText('52. Hafta')).toBeTruthy();
  });
});

// BAHİS SİTESİ ADI EKRANDA GEÇMEZ — asıl koruma (render seviyesinde).
// Uygulama bahis sitesi tanıtımı yapamaz (yasal + mağaza kısıtı). Kaynaklar
// RENK ADIYLA anılır ve renkli noktayla gösterilir. Bu kural bir kez ihlal
// edildi: adlar maç satırından kaldırılırken "lejant" diye başlığa geri kondu.
describe('Bahis sitesi adı ekranda geçmez', () => {
  const MARKALAR = /nesine|bilyoner|misli|oley|iddaa|i̇ddaa/i;
  const GUN = { date: '2026-08-01', weekday: 'Cuma', label: 'Cuma 01.08', isMatchDay: true, withData: 1 };
  const ONCEKI_GUN = { date: '2026-07-31', weekday: 'Perşembe', label: 'Perşembe 31.07', isMatchDay: false, withData: 1 };

  test('Radar 3 ekranı gerçek kaynak verisiyle çizilirken marka adı GÖRÜNMEZ', async () => {
    mockUclar({
      ...VARSAYILAN,
      '/api/radar/daily-played': {
        roundId: 1600, days: [ONCEKI_GUN, GUN], sources: ['k1', 'k2', 'k3'],
        matches: [{
          no: 1,
          cells: { '2026-08-01': { bySource: {
            k1: { percentages: { '1': 62, X: 21, '2': 17 } },
            k2: { percentages: { '1': 58, X: 24, '2': 18 } },
            k3: { percentages: { '1': 60, X: 22, '2': 18 } },
          } } },
        }],
      },
    });
    const { toJSON } = render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Ev Takımı/).length).toBe(3));
    fireEvent.press(screen.getByText('Oynanma DNA'));
    await screen.findAllByTestId('kaynak-nokta-k1');

    // Çizilen ağacın TÜM metinleri taranır — hiçbirinde marka adı olamaz.
    const metinler = metinleriTopla(toJSON());
    const ihlal = metinler.filter((t) => MARKALAR.test(t));
    expect(ihlal).toEqual([]);

    // Olumlu karşılık: kaynaklar RENK ADIYLA gerçekten görünüyor.
    // Renk ADLARI da YAZILMAZ — yalnız nokta.
    for (const k of ['k1', 'k2', 'k3']) expect(screen.getAllByTestId('kaynak-nokta-' + k).length).toBeGreaterThan(0);
  });

  test('kaynak noktası erişilebilirlik etiketi de RENK adıdır (marka değil)', async () => {
    mockUclar({
      ...VARSAYILAN,
      '/api/radar/daily-played': {
        roundId: 1600, days: [ONCEKI_GUN, GUN], sources: ['k1'],
        matches: [{ no: 1, cells: { '2026-08-01': { bySource: { k1: { percentages: { '1': 62, X: 21, '2': 17 } } } } } }],
      },
    });
    render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Ev Takımı/).length).toBe(3));
    fireEvent.press(screen.getByText('Oynanma DNA'));
    const nokta = (await screen.findAllByTestId('kaynak-nokta-k1'))[0];
    expect(nokta.props.accessibilityLabel).toBe('Sarı kaynak');
    expect(MARKALAR.test(nokta.props.accessibilityLabel)).toBe(false);
  });
});

// ESKİ SUNUCU KORUMASI — yayına alınmamış arka uç HAM KİMLİK gönderirse bile
// ekranda marka adı ÇIKMAMALI.
//
// GERÇEK OLAY: kaynak etiketleri koda (k1/k2) geçirildi ama etiket fonksiyonu
// "PROVIDER_NAMES[s] || s" idi — tanınmayan anahtarı OLDUĞU GİBİ basıyordu.
// Sunucu henüz güncellenmediği için ekranda "nesine · misli" göründü.
describe('Eski sunucu ham kimlik gönderse bile marka adı ekranda çıkmaz', () => {
  const MARKALAR = /nesine|bilyoner|misli|oley|iddaa/i;
  const GUN = { date: '2026-08-01', weekday: 'Cuma', label: 'Cuma 01.08', isMatchDay: true, withData: 1 };
  const ONCEKI_GUN = { date: '2026-07-31', weekday: 'Perşembe', label: 'Perşembe 31.07', isMatchDay: false, withData: 1 };

  test('HAM KİMLİKLİ yanıtta bile hiçbir metinde marka geçmez; renkler doğru çıkar', async () => {
    mockUclar({
      ...VARSAYILAN,
      // Eski sunucu yanıtı: kod değil HAM KİMLİK.
      '/api/radar/daily-played': {
        roundId: 1600, days: [ONCEKI_GUN, GUN], sources: ['nesine', 'misli'],
        matches: [{
          no: 1,
          cells: { '2026-08-01': { bySource: {
            nesine: { percentages: { '1': 68, X: 12, '2': 20 } },
            misli: { percentages: { '1': 94, X: 1, '2': 5 } },
          } } },
        }],
      },
    });
    const { toJSON } = render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Ev Takımı/).length).toBe(3));
    fireEvent.press(screen.getByText('Oynanma DNA'));
    await screen.findAllByTestId('kaynak-nokta-k1');

    // Çizilen ağacın TÜM metinleri: marka adı OLAMAZ.
    expect(metinleriTopla(toJSON()).filter((t) => MARKALAR.test(t))).toEqual([]);
    // Ham kimlik de renk adına çevrilir (gri "bilinmiyor"a düşmez).
    for (const k of ['k1', 'k2']) expect(screen.getAllByTestId('kaynak-nokta-' + k).length).toBeGreaterThan(0);
    // Nokta doğru rengi alır: sarı kaynak k1 rengidir.
    const nokta = screen.getAllByTestId('kaynak-nokta-k1')[0];
    expect(nokta.props.accessibilityLabel).toBe('Sarı kaynak');
  });

  test('TAMAMEN BİLİNMEYEN kaynak anahtarı da ham basılmaz', async () => {
    mockUclar({
      ...VARSAYILAN,
      '/api/radar/daily-played': {
        roundId: 1600, days: [ONCEKI_GUN, GUN], sources: ['gizli-site-x'],
        matches: [{ no: 1, cells: { '2026-08-01': { bySource: { 'gizli-site-x': { percentages: { '1': 50, X: 30, '2': 20 } } } } } }],
      },
    });
    render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Ev Takımı/).length).toBe(3));
    fireEvent.press(screen.getByText('Oynanma DNA'));
    await screen.findAllByTestId('kaynak-nokta-k0');
    // Anahtarın kendisi ASLA ekrana yazılmaz; nötr "Kaynak" görünür.
    expect(screen.queryByText(/gizli-site-x/)).toBeNull();
    expect(screen.getAllByTestId('kaynak-nokta-k0').length).toBeGreaterThan(0);
  });
});

// KAYNAK HİÇ ADLANDIRILMAZ — ne marka ne renk adı. Yalnız renkli nokta.
// Kullanıcı kararı: "sarı kaynak vs de yazma".
describe('Kaynak ekranda hiç adlandırılmaz (yalnız renk)', () => {
  const GUN = { date: '2026-08-01', weekday: 'Cuma', label: 'Cuma 01.08', isMatchDay: true, withData: 1 };
  const ONCEKI_GUN = { date: '2026-07-31', weekday: 'Perşembe', label: 'Perşembe 31.07', isMatchDay: false, withData: 1 };
  // Ne marka adı ne de renk adı ekranda yazabilir.
  const ADLAR = /nesine|bilyoner|misli|oley|iddaa|sarı kaynak|turuncu kaynak|yeşil kaynak|mor kaynak|mavi kaynak/i;

  test('üç kaynaklı gerçek veride hiçbir metin kaynağı ADLANDIRMAZ', async () => {
    mockUclar({
      ...VARSAYILAN,
      '/api/radar/daily-played': {
        roundId: 1600, days: [ONCEKI_GUN, GUN], sources: ['k1', 'k2', 'k3'],
        matches: [{
          no: 1,
          cells: { '2026-08-01': { bySource: {
            k1: { percentages: { '1': 68, X: 12, '2': 20 } },
            k2: { percentages: { '1': 94, X: 1, '2': 5 } },
            k3: { percentages: { '1': 70, X: 15, '2': 15 } },
          } } },
        }],
      },
    });
    const { toJSON } = render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Ev Takımı/).length).toBe(3));
    fireEvent.press(screen.getByText('Oynanma DNA'));
    await screen.findAllByTestId('kaynak-nokta-k1');

    expect(metinleriTopla(toJSON()).filter((t) => ADLAR.test(t))).toEqual([]);
    // Olumlu karşılık: üç kaynak da NOKTA olarak gerçekten çizilmiş.
    for (const k of ['k1', 'k2', 'k3']) {
      expect(screen.getAllByTestId(`kaynak-nokta-${k}`).length).toBeGreaterThan(0);
    }
    // Yüzdeler yine görünür — veri gizlenmiyor, yalnız ad yok.
    expect(screen.getAllByText(/1 %68/).length).toBeGreaterThan(0);
  });

  test('erişilebilirlik etiketi renk adını taşır (ekranda görünmez, okuyucu için)', async () => {
    mockUclar({
      ...VARSAYILAN,
      '/api/radar/daily-played': {
        roundId: 1600, days: [ONCEKI_GUN, GUN], sources: ['k1'],
        matches: [{ no: 1, cells: { '2026-08-01': { bySource: { k1: { percentages: { '1': 50, X: 30, '2': 20 } } } } } }],
      },
    });
    const { toJSON } = render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Ev Takımı/).length).toBe(3));
    fireEvent.press(screen.getByText('Oynanma DNA'));
    const nokta = (await screen.findAllByTestId('kaynak-nokta-k1'))[0];
    // Etiket VAR (nokta ekran okuyucuda adsız kalmamalı)…
    expect(nokta.props.accessibilityLabel).toBe('Sarı kaynak');
    // …ama GÖRÜNEN metinlerin arasında değil.
    expect(metinleriTopla(toJSON()).filter((t) => ADLAR.test(t))).toEqual([]);
  });
});
