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

  test('Radar 3 satırı: yüzde kaynağıyla birlikte, kaynak yoksa uydurulmuyor', async () => {
    mockUclar({
      ...VARSAYILAN,
      '/api/radar/daily-played': {
        roundId: 1600, days: [ONCEKI_GUN, GUN], sources: ['nesine', 'misli'],
        matches: [
          {
            no: 1,
            cells: {
              '2026-07-31': { bySource: { nesine: { percentages: { '1': 58, X: 24, '2': 18 } } } },
              '2026-08-01': { bySource: { nesine: { percentages: { '1': 62, X: 21, '2': 17 } }, misli: { percentages: { '1': 60, X: 22, '2': 18 } } } },
            },
          },
        ],
      },
    });
    render(<RadarScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Ev Takımı/).length).toBe(3));
    fireEvent.press(screen.getByText('Oynanma DNA'));

    // Aktif kaynaklar açıkça yazılır (hangi siteden geldiği gizlenmez).
    expect(await screen.findByText(/Aktif kaynak: Nesine · Misli/)).toBeTruthy();
    // Kaynak adı satırda da görünür — iki site karıştırılmaz.
    expect(screen.getAllByText('Nesine').length).toBeGreaterThan(0);
    // Yüzde GERÇEKTEN çiziliyor (yalnız kaynak etiketi değil).
    expect(screen.getAllByText(/1 %62/).length).toBeGreaterThan(0);
  });

  test('Oynanma DNA paneli: kaynak satırına dokununca açılıyor', async () => {
    mockUclar({
      ...VARSAYILAN,
      '/api/radar/daily-played': {
        roundId: 1600, days: [ONCEKI_GUN, GUN], sources: ['nesine'],
        matches: [{
          no: 1,
          cells: { '2026-08-01': { bySource: { nesine: { percentages: { '1': 62, X: 21, '2': 17 } } } } },
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
    const kaynak = await screen.findAllByText('Nesine');
    fireEvent.press(kaynak[0]);

    // Yakınlık seçimi KULLANICIYA aittir — otomatik genişleme yok.
    expect(await screen.findByText('Birebir aynı')).toBeTruthy();
    expect(screen.getByText('Tüm Maçlar')).toBeTruthy();
    // Örneklem "kaç kayıtta" olarak şeffaf. Güven seviyesi/olasılık iddiası
    // PANELDE yoktur (ekranın başlığındaki "Tahmin güveni…" cümlesiyle
    // karışmasın diye kontrol panelle SINIRLANDIRILIR).
    expect(screen.getByText('18 kayıtta 8 kez 1, 5 kez X, 5 kez 2')).toBeTruthy();
    const panel = within(screen.getByTestId('oynanma-dna-1-nesine'));
    expect(panel.queryByText(/güven|olasılık|ihtimal/i)).toBeNull();
    // Kapsam en sonda ve soluk.
    expect(screen.getByText(/arşivde 240 sonuçlanmış maç/)).toBeTruthy();
    // Hareket verisi yoksa uydurulmuyor.
    expect(screen.getByText('Bu harekete yakın geçmiş sonuç yok')).toBeTruthy();
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
    expect(await screen.findByText('Club Brugge – Union SG')).toBeTruthy();
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
    fireEvent.press(screen.getByText(/Son 5 Hafta · %/));
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
