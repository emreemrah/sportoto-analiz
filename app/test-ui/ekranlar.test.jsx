// ARAYÜZ (RENDER) TESTLERİ — T15.
//
// NEDEN VAR: Arayüz katmanının render testi SIFIRDI (27.700 satır). T3'te
// bulunan kupon senkron hatası tam bu boşluktan geçmişti: fonksiyon mobilde ve
// üretim web'inde her zaman "girişsiz" dönüyordu, hiçbir test bunu görmedi.
// Bu dosya ekranların GERÇEKTEN çizildiğini ve dürüstlük metinlerinin
// kullanıcıya ULAŞTIĞINI doğrular — kaynak taraması değil, gerçek render.
//
// SÜRÜM NOTU (kurulumda öğrenildi): @testing-library/react-native **13.x**
// kullanılıyor, 14.x DEĞİL. v14 `react-test-renderer` yerine yeni `test-renderer`
// paketine geçti ve bu yığında (Expo SDK 56 / RN 0.85 / jest-expo 56) render
// SESSİZCE boş nesne döndürüyor — hata fırlatmıyor, yalnız hiçbir şey
// çizmiyor. Yükseltmeden önce burada bir render testinin gerçekten kırıldığını
// doğrulayın; "testler geçiyor" yeterli kanıt değildir.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import BulletinScreen from '../src/screens/BulletinScreen';
import { LEGAL_FOOTER, APP_NAME } from '../src/brand';
import { displayLabel, humanizeVerdictText } from '../src/labels';

// Navigasyon taklidi: ekranlar navigation/route bekler.
const nav = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()) };
const route = { params: {} };

// @react-navigation/native'in useIsFocused kancası test ortamında sağlayıcısız
// çalışmaz; ekran mantığı için "odakta" yeterlidir.
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));

describe('Bülten ekranı', () => {
  test('sunucu veri döndürmezken çöküyor DEĞİL, dürüst bir durum gösteriyor', async () => {
    // setup.js varsayılan fetch'i 503 döner — ekran boş/hata durumunu çizmeli.
    const { toJSON } = render(<BulletinScreen navigation={nav} route={route} />);
    expect(toJSON()).toBeTruthy();
  });

  test('yasal alt satır (18+ · vaat yok) kullanıcıya ULAŞIYOR', async () => {
    render(<BulletinScreen navigation={nav} route={route} />);
    // LEGAL_FOOTER tek kaynaktan gelir (T7). Ekranda göründüğünü RENDER ile
    // doğruluyoruz — kaynak dosyada geçmesi yetmez, çizilmesi gerekir.
    const bulundu = await screen.findByText(LEGAL_FOOTER);
    expect(bulundu).toBeTruthy();
  });

  test('yasal alt satırın içeriği dürüstlük şartlarını taşıyor', () => {
    // 18+ ve "kazanç vaadi değildir" DURUYOR — bunlar ürünün dürüstlük
    // taahhüdü ve kaldırılmadı.
    expect(LEGAL_FOOTER).toContain('18+');
    expect(LEGAL_FOOTER).toMatch(/kazanç vaadi değildir/i);
  });

  test('destek hattı uygulama içinde HİÇBİR yerde geçmiyor', () => {
    // Kullanıcı kararı (2 Ağustos 2026): "her yerden kaldır". Test, satırın
    // sessizce geri gelmesini engeller — sabit boş kaldığı sürece alt satırda
    // ne numara ne de "Destek:" ibaresi oluşur.
    expect(LEGAL_FOOTER).not.toMatch(/444\s?79\s?75/);
    expect(LEGAL_FOOTER).not.toMatch(/YEDAM/i);
    expect(LEGAL_FOOTER).not.toMatch(/Destek:/);
  });
});

describe('Kullanıcıya görünen dil', () => {
  test('"BANKO" anahtarı kullanıcıya ASLA olduğu gibi gösterilmez', () => {
    expect(displayLabel('BANKO')).toBe('GÜÇLÜ ADAY');
    expect(displayLabel('BANKO')).not.toMatch(/banko/i);
  });

  test('serbest metindeki "banko" kökü güvenlik ağıyla temizlenir', () => {
    const temiz = humanizeVerdictText('Bu maç güçlü banko adayı; banko sayılabilir.');
    expect(temiz).not.toMatch(/\bbanko\b/i);
    expect(temiz).toMatch(/güçlü aday/i);
  });

  test('marka adı tek kaynaktan gelir ve boş değildir', () => {
    expect(APP_NAME).toBeTruthy();
    expect(APP_NAME.length).toBeGreaterThan(3);
  });
});

// ---------------------------------------------------------------------------
// GEÇMİŞ HAFTA — resmî listeye uydurulan İKİ yer (emrah'ın paylaştığı görüntüler):
//   1. İkramiye satırları: "9 ADET 4.035.942,42 ₺" + Kapanış + Açıklamalar
//   2. Sezon açılır seçimi (‹ › okları tek adım ilerliyor, arşiv için yetmiyor)
// Ekranın geri kalanı (analiz kartları, maç listesi) DEĞİŞMEDİ.
// ---------------------------------------------------------------------------
describe('Canlı maç — skor GÖSTERİLMEZ', () => {
  // KULLANICI KARARI (2 Ağustos 2026): "skoru gösterme, sadece maçın başladığı
  // ve canlı oynandığı belli olsun; Yenile düğmesini kaldır."
  //
  // Projenin kendi kuralıyla da aynı yönde: "yalnız resmî 90 dakika sonucu
  // kesindir; canlı ve geçici veriler kesin sayılmaz". Anlık skor saniyede
  // değişir ve resmî sonuçla karışma riski taşır.
  // Güncel bülten LiveBulletinView/LiveMatchCard ile çizilir; canlı durumu
  // deriveStatus, maçın KENDİ `live`/`minute`/`score` alanlarından türetir
  // (liveLogic.js). `provisional` ise geçmiş hafta görünümünün alanıdır —
  // ikisi de aynı kurala tabi olmalı, bu yüzden ikisi de dolduruluyor.
  const canliMac = {
    no: 6,
    home: { name: 'Brommapojkarna', mediumName: 'Brommapojkarna' },
    away: { name: 'Malmö', mediumName: 'Malmö' },
    date: '2020-01-01T15:00:00Z',        // geçmiş: maç başlamış sayılsın
    live: true, minute: 34, score: { home: 0, away: 0 },
    provisional: { score: { home: 0, away: 0 }, live: true, minute: 34 },
    analysis: { probabilities: { '1': 40, X: 30, '2': 30 }, favorite: { symbol: '1', percent: 40 }, surpriseScore: 45 },
  };

  const cizdir = () => {
    global.fetch.mockImplementation(async (url) => {
      const u = String(url);
      const g = u.includes('/api/bulletin')
        ? { roundId: 1600, round: '53. Hafta', matches: [canliMac] }
        : { rounds: [], currentRoundId: 1600 };
      return { ok: true, status: 200, json: async () => g, text: async () => JSON.stringify(g) };
    });
    return render(<BulletinScreen navigation={nav} route={route} />);
  };

  test('canlı maçta SKOR ve skordan türetilen 1/X/2 harfi YAZILMIYOR', async () => {
    cizdir();
    await waitFor(() => expect(screen.getAllByText(/Brommapojkarna/).length).toBeGreaterThan(0));
    // "0 - 0" hiçbir yerde geçmemeli.
    expect(screen.queryByText('0 - 0')).toBeNull();
    expect(screen.queryByText(/^\d+\s-\s\d+$/)).toBeNull();
  });

  test('canlı maçta OYNANDIĞI belli oluyor', async () => {
    // Skor gizlenirken durum da gizlenirse kullanıcı maçın başlayıp
    // başlamadığını anlayamaz — bu, skoru göstermekten daha kötü olurdu.
    cizdir();
    // Rozet metni dakikayı da taşır ("CANLI 34'"); aranan şey durumun
    // GÖRÜNÜR olması, birebir dize değil.
    expect(await screen.findByText(/CANLI/)).toBeTruthy();
  });

  test('"Yenile" düğmesi ÇİZİLMİYOR', async () => {
    cizdir();
    await waitFor(() => expect(screen.getAllByText(/Brommapojkarna/).length).toBeGreaterThan(0));
    expect(screen.queryByText(/Yenile/)).toBeNull();
  });
});

describe('Geçmiş hafta — resmî yazım ve sezon seçimi', () => {
  // İkramiye görünümünün VARSAYILANI 'table' (prefs.js). Resmî yazım LİSTE
  // görünümünde; testler kullanıcının yapacağını yapar ve "Liste"ye dokunur.
  // (Tercihi doğrudan yazmak kırılgan: modül önbelleği testler arasında
  // sıfırlanabiliyor.)
  const mac = (no, over = {}) => ({
    no,
    home: { name: `Ev ${no}`, mediumName: `Ev ${no}` },
    away: { name: `Dep ${no}`, mediumName: `Dep ${no}` },
    date: '2026-07-24T19:00:00Z',
    score: { home: 2, away: 1 }, result: '1',
    analysis: { probabilities: { '1': 50, X: 27, '2': 23 }, favorite: { symbol: '1', percent: 52 }, surpriseScore: 30 },
    ...over,
  });
  const ROUNDS = {
    currentRoundId: 1600,
    rounds: [
      { id: 1400, name: '30. Hafta', year: 2024 },
      { id: 1500, name: '40. Hafta', year: 2025 },
      { id: 1598, name: '51. Hafta', year: 2026, closeDate: '2026-07-24T19:55:00' },
      { id: 1600, name: '53. Hafta', year: 2026 },
    ],
  };
  const GECMIS = {
    roundId: 1598,
    matches: Array.from({ length: 15 }, (_, i) => mac(i + 1)),
    prize: {
      tiers: [
        { hit: 15, count: 9, prize: 4035942.42 },
        { hit: 14, count: 389, prize: 31794.38 },
        { hit: 13, count: 6759, prize: 1829.85 },
        { hit: 12, count: 53534, prize: 288.78 },
      ],
      closeDate: '2026-07-24T19:55:00',
      description: 'Tebrikler',
    },
  };
  const mockUclar = () => {
    global.fetch.mockImplementation(async (url) => {
      const u = String(url);
      const g = u.includes('/api/rounds') ? ROUNDS
        : u.includes('/api/history/1598') ? GECMIS
          : u.includes('/api/bulletin') ? { roundId: 1600, round: '53. Hafta', year: 2026, matches: [] }
            : { hasData: false };
      return { ok: true, status: 200, json: async () => g, text: async () => JSON.stringify(g) };
    });
  };

  const gecmiseGit = async () => {
    render(<BulletinScreen navigation={nav} route={route} />);
    // ÖNCE hafta listesinin gelmesini bekle: ok her zaman çizili olduğu için
    // hemen basılırsa navRounds boş olur ve dokunuş hiçbir şey yapmaz.
    await screen.findByText(/Sezonu/);
    fireEvent.press(screen.getByText('‹'));
    // İkramiye bölümü gelince LİSTE görünümüne geç (varsayılan Tablo).
    fireEvent.press(await screen.findByText('Liste'));
  };

  test('sezon açılır seçimi var ve resmî yazımda', async () => {
    mockUclar();
    render(<BulletinScreen navigation={nav} route={route} />);
    // Başlıktaki sezon artık "2025/2026 Sezonu ▾" — düz "2026" değil.
    expect(await screen.findByText(/2025\/2026 Sezonu/)).toBeTruthy();
  });

  test('sezon listesi açılıyor ve GEÇMİŞ sezonlar görünüyor', async () => {
    mockUclar();
    render(<BulletinScreen navigation={nav} route={route} />);
    fireEvent.press(await screen.findByText(/2025\/2026 Sezonu/));
    expect(await screen.findByText('2024/2025 Sezonu')).toBeTruthy();
    expect(screen.getByText('2023/2024 Sezonu')).toBeTruthy();
  });

  test('geçmiş haftada ikramiye RESMÎ yazımda ve Kapanış satırı var', async () => {
    mockUclar();
    await gecmiseGit();
    // "9 ADET" + "4.035.942,42 ₺" (eskiden "9 kişi" + "₺4.035.942,42" idi)
    expect(await screen.findByText('9 ADET')).toBeTruthy();
    expect(screen.getByText('4.035.942,42 ₺')).toBeTruthy();
    expect(screen.getByText('53.534 ADET')).toBeTruthy();
    // Resmî listede olup bizde EKSİK olan satırlar:
    expect(screen.getByText('Kapanış')).toBeTruthy();
    expect(screen.getByText('24 Temmuz Cuma 2026 19:55')).toBeTruthy();
    expect(screen.getByText('Açıklamalar')).toBeTruthy();
    expect(screen.getByText('Tebrikler')).toBeTruthy();
  });

  test('kapanış verisi YOKSA satır çizilmez (uydurulmaz)', async () => {
    global.fetch.mockImplementation(async (url) => {
      const u = String(url);
      const g = u.includes('/api/rounds') ? { currentRoundId: 1600, rounds: [{ id: 1598, name: '51. Hafta', year: 2026 }, { id: 1600, name: '53. Hafta', year: 2026 }] }
        : u.includes('/api/history/1598') ? { ...GECMIS, prize: { ...GECMIS.prize, closeDate: null, description: null } }
          : u.includes('/api/bulletin') ? { roundId: 1600, round: '53. Hafta', year: 2026, matches: [] }
            : { hasData: false };
      return { ok: true, status: 200, json: async () => g, text: async () => JSON.stringify(g) };
    });
    await gecmiseGit();
    await screen.findByText('9 ADET');
    // 1970 ya da boş satır DEĞİL: satır hiç yok.
    expect(screen.queryByText('Kapanış')).toBeNull();
    expect(screen.queryByText('Açıklamalar')).toBeNull();
    expect(screen.queryByText(/1970/)).toBeNull();
  });
});
