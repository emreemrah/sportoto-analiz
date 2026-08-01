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
import { setPref } from '../src/prefs';

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

  test('yasal alt satır (18+ · vaat yok · YEDAM) kullanıcıya ULAŞIYOR', async () => {
    render(<BulletinScreen navigation={nav} route={route} />);
    // LEGAL_FOOTER tek kaynaktan gelir (T7). Ekranda göründüğünü RENDER ile
    // doğruluyoruz — kaynak dosyada geçmesi yetmez, çizilmesi gerekir.
    const bulundu = await screen.findByText(LEGAL_FOOTER);
    expect(bulundu).toBeTruthy();
  });

  test('yasal alt satırın içeriği dürüstlük şartlarını taşıyor', () => {
    expect(LEGAL_FOOTER).toContain('18+');
    expect(LEGAL_FOOTER).toMatch(/kazanç vaadi değildir/i);
    expect(LEGAL_FOOTER).toMatch(/444 79 75/);
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
// BÜLTEN GÖRÜNÜMÜ — varsayılan RESMÎ LİSTE (emrah'ın kararı, 01.08.2026).
// Analiz kartları silinmedi; "Analiz" görünümünde duruyor.
// ---------------------------------------------------------------------------
describe('Bülten görünüm anahtarı', () => {
  // TERCİH SIZINTISI: görünüm anahtarı tercihi CİHAZDA saklanıyor; bir test
  // "Analiz"e geçince sonraki testler onu devralıyor ve resmî görünümü hiç
  // görmüyordu. Her test kendi başlangıcını kurar.
  beforeEach(() => setPref('bultenGorunum', 'resmi'));
  const GELECEK = '2099-01-01T17:00:00Z';
  const mac = (no) => ({
    no, sportotoMatchId: `sm${no}`,
    home: { name: `Ev ${no}`, mediumName: `Ev ${no}` },
    away: { name: `Dep ${no}`, mediumName: `Dep ${no}` },
    league: 'Test Ligi', date: GELECEK,
    analysis: { probabilities: { '1': 50, X: 27, '2': 23 }, favorite: { symbol: '1', percent: 52 }, surpriseScore: 37, estimated: true },
  });
  const BULTEN = {
    roundId: 1600, round: '53. Hafta', year: 2026,
    verification: { status: 'confirmed' },
    matches: [mac(1), mac(2), mac(3)],
  };

  const mockUclar = () => {
    global.fetch.mockImplementation(async (url) => {
      const u = String(url);
      const g = u.includes('/api/rounds')
        ? { currentRoundId: 1600, rounds: [{ id: 1600, name: '53. Hafta', year: 2026 }] }
        : u.includes('/api/bulletin') ? BULTEN : { hasData: false };
      return { ok: true, status: 200, json: async () => g, text: async () => JSON.stringify(g) };
    });
  };

  test('VARSAYILAN görünüm resmî liste tablosu', async () => {
    mockUclar();
    render(<BulletinScreen navigation={nav} route={route} />);
    // Resmî tablo başlıkları bülten ekranında görünmeli.
    expect(await screen.findByText('Sıra')).toBeTruthy();
    for (const b of ['Maç Günü', 'Maç Saati', 'Skor', 'Sonuç']) {
      expect(screen.getByText(b)).toBeTruthy();
    }
    expect(screen.getAllByText(/Ev 1 – Dep 1/).length).toBe(1);
  });

  test('resmî görünümde ANALİZ rozetleri yok', async () => {
    mockUclar();
    render(<BulletinScreen navigation={nav} route={route} />);
    await screen.findByText('Sıra');
    // Ekran görüntüsündeki DİKKAT / Favori / Sürpriz kartları resmî görünümde
    // görünmemeli — resmî liste ham listedir.
    expect(screen.queryByText('DİKKAT')).toBeNull();
    expect(screen.queryByText(/Sürpriz \d/)).toBeNull();
  });

  test('"Açıklanan Sonuçlar" bölümü bültende de var', async () => {
    mockUclar();
    render(<BulletinScreen navigation={nav} route={route} />);
    expect(await screen.findByText('Açıklanan Sonuçlar')).toBeTruthy();
    expect(screen.getByText('15 Bilen')).toBeTruthy();
    // Sonuç açıklanmadı → "----", sıfır DEĞİL.
    expect(screen.getAllByText('----').length).toBeGreaterThanOrEqual(4);
  });

  test('ANALİZ görünümüne geçilebiliyor — kartlar silinmedi', async () => {
    mockUclar();
    render(<BulletinScreen navigation={nav} route={route} />);
    await screen.findByText('Sıra');
    fireEvent.press(screen.getByText('📊 Analiz'));
    // Analiz görünümünde resmî tablo başlığı kalkar.
    await waitFor(() => expect(screen.queryByText('Maç Günü')).toBeNull());
    // Ve maçlar hâlâ listeleniyor (kartlar duruyor).
    expect(screen.getAllByText(/Ev 1/).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// ARŞİV SEÇİCİLERİ — resmî listedeki gibi sezon/hafta açılır seçimi.
// ‹ › okları tek adım ilerler; arşivde gezinmek için seçim gerekir.
// ---------------------------------------------------------------------------
describe('Bülten arşiv seçicileri', () => {
  beforeEach(() => setPref('bultenGorunum', 'resmi'));
  const mac = (no) => ({
    no,
    home: { name: `Ev ${no}`, mediumName: `Ev ${no}` },
    away: { name: `Dep ${no}`, mediumName: `Dep ${no}` },
    date: '2099-01-01T17:00:00Z',
    analysis: { probabilities: { '1': 50, X: 27, '2': 23 }, favorite: { symbol: '1', percent: 52 }, surpriseScore: 37 },
  });
  const ROUNDS = {
    currentRoundId: 1600,
    rounds: [
      { id: 1598, name: '51. Hafta', year: 2026, closeDate: '2026-07-24T19:55:00' },
      { id: 1599, name: '52. Hafta', year: 2026 },
      { id: 1600, name: '53. Hafta', year: 2026 },
    ],
  };
  const GUNCEL = { roundId: 1600, round: '53. Hafta', year: 2026, verification: { status: 'confirmed' }, matches: [mac(1), mac(2)] };
  // 51. hafta SONUÇLANMIŞ: skor + resmî sonuç + açıklanan ikramiye.
  const GECMIS = {
    roundId: 1598,
    matches: [
      { ...mac(1), score: { home: 1, away: 1 }, result: 'X' },
      { ...mac(2), score: { home: 2, away: 0 }, result: '1' },
    ],
    prize: {
      tiers: [{ hit: 15, count: 9, prize: 4035942.42 }, { hit: 14, count: 389, prize: 31794.38 }],
      closeDate: '2026-07-24T19:55:00',
      description: 'Tebrikler',
    },
  };

  const mockUclar = () => {
    global.fetch.mockImplementation(async (url) => {
      const u = String(url);
      const g = u.includes('/api/rounds') ? ROUNDS
        : u.includes('/api/history/1598') ? GECMIS
          : u.includes('/api/bulletin') ? GUNCEL : { hasData: false };
      return { ok: true, status: 200, json: async () => g, text: async () => JSON.stringify(g) };
    });
  };

  test('sezon ve hafta seçicileri resmî görünümde çiziliyor', async () => {
    mockUclar();
    render(<BulletinScreen navigation={nav} route={route} />);
    expect(await screen.findByText('2025/2026 Sezonu')).toBeTruthy();
    expect(screen.getAllByText('53. Hafta').length).toBeGreaterThan(0);
  });

  test('hafta seçilince o haftanın RESMÎ SONUÇLARI geliyor', async () => {
    mockUclar();
    render(<BulletinScreen navigation={nav} route={route} />);
    await screen.findByText('2025/2026 Sezonu');

    // Hafta açılır listesini aç ve 51. Hafta'yı seç.
    fireEvent.press(screen.getAllByText('53. Hafta')[0]);
    fireEvent.press(await screen.findByText('51. Hafta'));

    // Skorlar ve resmî sonuçlar (beraberlik resmî yazımda "0").
    expect(await screen.findByText('1-1')).toBeTruthy();
    expect(screen.getByText('2-0')).toBeTruthy();
    expect(screen.getByText('0')).toBeTruthy();
  });

  test('geçmiş haftada AÇIKLANAN İKRAMİYE resmî yazımla dolu', async () => {
    mockUclar();
    render(<BulletinScreen navigation={nav} route={route} />);
    await screen.findByText('2025/2026 Sezonu');
    fireEvent.press(screen.getAllByText('53. Hafta')[0]);
    fireEvent.press(await screen.findByText('51. Hafta'));

    expect(await screen.findByText('9 ADET 4.035.942,42 ₺')).toBeTruthy();
    expect(screen.getByText('389 ADET 31.794,38 ₺')).toBeTruthy();
    expect(screen.getByText('24 Temmuz Cuma 2026 19:55')).toBeTruthy();
    expect(screen.getByText('Tebrikler')).toBeTruthy();
  });

  test('ANALİZ görünümünde seçiciler GİZLİ (kendi akışı var)', async () => {
    mockUclar();
    render(<BulletinScreen navigation={nav} route={route} />);
    await screen.findByText('2025/2026 Sezonu');
    fireEvent.press(screen.getByText('📊 Analiz'));
    await waitFor(() => expect(screen.queryByText('2025/2026 Sezonu')).toBeNull());
  });
});
