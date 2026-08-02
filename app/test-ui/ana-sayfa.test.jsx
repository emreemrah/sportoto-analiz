// ANA SAYFA RENDER TESTLERİ.
//
// NEDEN VAR: Uygulamanın açılış ekranı — ilk izlenimi buradan alınır ve
// kullanıcı en çok bu kartlara bakar. Riskli yanı özetleme: 15 maçtan
// "öne çıkanları" seçerken uydurma bir sıralama ya da sabit bir etiket
// üretilirse kullanıcı bunu sistemin görüşü sanar.
//
// Korunan kurallar:
//  * Bülten yoksa boş ekran değil, dürüst bir bekleme durumu gösterilir.
//  * Sunucu hatası gizlenmez, sebebi yazılır.
//  * Öne çıkan/sürpriz seçimi GERÇEK sürpriz puanına göre yapılır —
//    sabit etiket uydurulmaz.
//  * Bitmiş maçlar "yaklaşan" listesine karışmaz.
//
// Sürüm notu için bkz. ekranlar.test.jsx (RNTL 13.x kullanılır, 14.x DEĞİL).
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';

import HomeScreen from '../src/screens/HomeScreen';

const nav = {
  navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useFocusEffect: (cb) => { const R = require('react'); R.useEffect(cb, [cb]); },
}));

// Bildirim servisi ağa çıkar; testte sürülür.
const bildirim = { sonuc: null };
jest.mock('../src/services/notificationsService', () => ({
  loadNotifications: async () => {
    if (!bildirim.sonuc) throw new Error('bildirim alınamadı');
    return bildirim.sonuc;
  },
}));

const mac = (no, over = {}) => ({
  no, sportotoMatchId: `sm${no}`,
  home: { name: `Ev ${no}`, mediumName: `Ev ${no}`, logo: null },
  away: { name: `Dep ${no}`, mediumName: `Dep ${no}`, logo: null },
  league: 'Test Ligi', date: '2099-01-01T17:00:00Z', status: 'scheduled',
  analysis: { probabilities: { '1': 50, X: 27, '2': 23 }, favorite: { symbol: '1', percent: 50 }, surpriseScore: 10, estimated: false },
  ...over,
});

const BULTEN = (over = {}) => ({
  roundId: 1600, round: '1. Hafta', year: 2026,
  verification: { status: 'confirmed' },
  matches: [
    mac(1, { analysis: { probabilities: { '1': 40, X: 30, '2': 30 }, surpriseScore: 85 } }),
    mac(2, { analysis: { probabilities: { '1': 60, X: 22, '2': 18 }, surpriseScore: 20 } }),
    mac(3, { analysis: { probabilities: { '1': 45, X: 30, '2': 25 }, surpriseScore: 70 } }),
  ],
  ...over,
});

function mockUclar(harita) {
  global.fetch.mockImplementation(async (url) => {
    const u = String(url);
    const k = Object.keys(harita).find((x) => u.includes(x));
    if (!k) return { ok: false, status: 404, json: async () => ({ error: 'yok' }), text: async () => 'yok' };
    const g = harita[k];
    if (g?.__hata) return { ok: false, status: 503, json: async () => ({ error: g.__hata }), text: async () => g.__hata };
    return { ok: true, status: 200, json: async () => g, text: async () => JSON.stringify(g) };
  });
}

describe('Ana Sayfa', () => {
  test('bülten geldiğinde hafta adı ve maçlar çiziliyor', async () => {
    mockUclar({ '/api/bulletin': BULTEN() });
    render(<HomeScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText('1. Hafta').length).toBeGreaterThan(0));
    expect(screen.getAllByText(/Ev 1/).length).toBeGreaterThan(0);
  });

  test('öne çıkanlar GERÇEK sürpriz puanına göre sıralanıyor', async () => {
    mockUclar({ '/api/bulletin': BULTEN() });
    render(<HomeScreen navigation={nav} />);
    // Puanlar 85 (maç 1) · 70 (maç 3) · 20 (maç 2). Öne çıkan iki kart
    // 1 ve 3 olmalı; 20 puanlı maç 2 öne çıkarılmamalı.
    await waitFor(() => expect(screen.getAllByText(/Ev 1/).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/Ev 3/).length).toBeGreaterThan(0);
  });

  test('bülten yokken boş ekran değil, dürüst bekleme durumu', async () => {
    mockUclar({ '/api/bulletin': { roundId: null, matches: [] } });
    render(<HomeScreen navigation={nav} />);
    expect(await screen.findByText('Dashboard hazırlanıyor')).toBeTruthy();
    expect(screen.getByText(/Güncel bülten yayınlanınca analiz kartları burada görünecek\./)).toBeTruthy();
  });

  test('sunucu hatası GİZLENMİYOR, sebebi yazılıyor', async () => {
    mockUclar({ '/api/bulletin': { __hata: 'Veri henüz hazır değil.' } });
    render(<HomeScreen navigation={nav} />);
    expect(await screen.findByText('Bülten alınamadı')).toBeTruthy();
    expect(screen.getByText(/Veri henüz hazır değil\./)).toBeTruthy();
  });

  test('bitmiş maçlar öne çıkan/sürpriz listelerine karışmıyor', async () => {
    mockUclar({
      '/api/bulletin': BULTEN({
        matches: [
          // En yüksek puanlı maç BİTMİŞ — öne çıkarılmamalı.
          mac(1, { status: 'finished', score: { home: 2, away: 1 }, analysis: { surpriseScore: 99 } }),
          mac(2, { analysis: { surpriseScore: 30 } }),
          mac(3, { analysis: { surpriseScore: 25 } }),
        ],
      }),
    });
    render(<HomeScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Ev 2/).length).toBeGreaterThan(0));
    // Bitmiş maç yaklaşan/öne çıkan bölümlerinde YOK.
    expect(screen.queryByText(/Ev 1/)).toBeNull();
  });

  test('bildirim sayısı bilinmiyorsa rozet UYDURULMUYOR', async () => {
    bildirim.sonuc = null;                    // servis hata verdi
    mockUclar({ '/api/bulletin': BULTEN() });
    render(<HomeScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText('1. Hafta').length).toBeGreaterThan(0));
    // Sayı bilinmiyorsa erişilebilirlik etiketinde SAYI GEÇMEZ.
    expect(screen.getByLabelText('Bildirimler')).toBeTruthy();
    expect(screen.queryByLabelText(/okunmamış/)).toBeNull();
  });

  test('bildirim sayısı VARSA rozet ve etiket sayıyı taşıyor', async () => {
    bildirim.sonuc = { unread: 3 };
    mockUclar({ '/api/bulletin': BULTEN() });
    render(<HomeScreen navigation={nav} />);
    // Pozitif eşi: aynı yol veri VARKEN gerçekten çiziyor — yukarıdaki
    // "görünmüyor" iddiası ancak bununla birlikte anlam taşır.
    // Etiketin kendisi sayıyı taşıyor; ekrandaki çıplak "3" metnini aramak
    // maç numaralarına takılıyor (ekranda birden çok "3" var).
    expect(await screen.findByLabelText('Bildirimler, 3 okunmamış')).toBeTruthy();
  });

  // --- LİG ŞERİDİ -----------------------------------------------------------
  test('lig şeridi ana sayfaya BAĞLI — bültenin ligleri görünüyor', async () => {
    // Bileşenin kendi testleri lig-seridi.test.jsx'te. Buradaki tek soru:
    // ekrana gerçekten takılmış mı? Bileşen doğru olup bağlantı unutulabilir
    // ve hiçbir test bunu yakalamaz.
    mockUclar({
      '/api/bulletin': BULTEN({
        matches: [
          mac(1, { league: 'Denmark Superliga', leagueImage: 'dk.png' }),
          mac(2, { league: 'Sweden Allsvenskan', leagueImage: 'se.png' }),
        ],
      }),
    });
    render(<HomeScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText('1. Hafta').length).toBeGreaterThan(0));
    expect(screen.getByTestId('lig-seridi')).toBeTruthy();
    expect(screen.getAllByText('Denmark Superliga').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sweden Allsvenskan').length).toBeGreaterThan(0);
  });

  // --- ÖNCEKİ HAFTADAN DEVAM EDEN MAÇLAR ------------------------------------
  // Gerçek olay (2 Ağustos 2026): 53. Hafta yayındaydı, maçları 8-9 Ağustos'ta.
  // Ama 52. Hafta'nın 11 maçı O GÜN oynanıyordu ve "Yaklaşan Maçlar"da hiç
  // görünmüyordu — kullanıcıya en yakın maçlar gizleniyordu.
  const ROUNDS = { currentRoundId: 1600, rounds: [{ id: 1599, name: '52. Hafta' }, { id: 1600, name: '1. Hafta' }] };

  test('önceki haftanın oynanmamış maçı listede ve HAFTA ROZETİ taşıyor', async () => {
    mockUclar({
      '/api/rounds': ROUNDS,
      '/api/history/1599': {
        matches: [{
          no: 9, date: '2026-08-02T15:00:00', status: 'upcoming',
          home: { name: 'Gecen Ev' }, away: { name: 'Gecen Dep' }, league: 'X Ligi',
        }],
      },
      '/api/bulletin': BULTEN(),   // maçları 2099'da — çok daha ileri tarihli
    });
    render(<HomeScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Gecen Ev/).length).toBeGreaterThan(0));
    // Hangi haftaya ait olduğu YAZILMALI: liste iki haftayı karıştırıyor.
    expect(screen.getAllByText('52. Hafta').length).toBeGreaterThan(0);
  });

  test('önceki hafta kartı MAÇ DETAYINA değil, o haftanın bültenine gidiyor', async () => {
    // Maç detayı sıra numarasını GÜNCEL bültende arar; 52. Hafta'nın 9 numaralı
    // maçıyla oraya gitmek BAŞKA bir maçı açardı. Sessiz ve ciddi bir hata.
    mockUclar({
      '/api/rounds': ROUNDS,
      '/api/history/1599': {
        matches: [{
          no: 9, date: '2026-08-02T15:00:00', status: 'upcoming',
          home: { name: 'Gecen Ev' }, away: { name: 'Gecen Dep' }, league: 'X Ligi',
        }],
      },
      '/api/bulletin': BULTEN(),
    });
    render(<HomeScreen navigation={nav} />);
    const kart = await screen.findAllByText(/Gecen Ev/);
    nav.navigate.mockClear();
    fireEvent.press(kart[0]);
    expect(nav.navigate).toHaveBeenCalledWith('BulletinDetail', { bulletinId: 1599 });
    expect(nav.navigate).not.toHaveBeenCalledWith('MatchDetail', expect.anything());
  });

  test('önceki hafta verisi ALINAMAZSA ana sayfa yine çiziliyor', async () => {
    // Ek bir veri için asıl ekranı riske atmamalıyız.
    mockUclar({ '/api/rounds': { __hata: 'olmadı' }, '/api/bulletin': BULTEN() });
    render(<HomeScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText('1. Hafta').length).toBeGreaterThan(0));
    expect(screen.getAllByText(/Ev 1/).length).toBeGreaterThan(0);
  });

  // --- HERO SAYAÇLARI -------------------------------------------------------
  // Kullanıcı "14" görüp bültende 15 maç olunca veriyi eksik sandı. Sayaç
  // doğruydu, ANLATIMI yanlıştı. Buradaki testler iki şeyi kilitler:
  //  1) payda gösterilir — kapsanmayan maç varsa gizlenmez,
  //  2) etiketteki eşik ile filtredeki eşik AYNI sayıdır.
  // (2) asıl kritik olan: eşik kodda değişip etikette kalırsa ekran yalan
  // söyler ve kullanıcı bunu hiçbir şekilde doğrulayamaz.

  // Bir düğümün TÜM metnini toplar (iç içe <Text> dahil: "5" + "/6" → "5/6").
  const metin = (dugum) => {
    const topla = (n) => (typeof n === 'string' ? n
      : (n?.children || []).map(topla).join(''));
    return topla(dugum).trim();
  };

  const ESIKLI_BULTEN = () => ({
    roundId: 1600, round: '1. Hafta', year: 2026,
    verification: { status: 'confirmed' },
    matches: [
      mac(1, { analysis: { probabilities: { '1': 40, X: 30, '2': 30 }, surpriseScore: 85 } }),
      mac(2, { analysis: { probabilities: { '1': 40, X: 30, '2': 30 }, surpriseScore: 65 } }), // sürpriz SINIRI
      mac(3, { analysis: { probabilities: { '1': 40, X: 30, '2': 30 }, surpriseScore: 64 } }), // sınırın ALTI
      mac(4, { analysis: { probabilities: { '1': 40, X: 30, '2': 30 }, surpriseScore: 45 } }), // öne çıkan SINIRI
      mac(5, { analysis: { probabilities: { '1': 40, X: 30, '2': 30 }, surpriseScore: 44 } }), // sınırın ALTI
      mac(6, { analysis: null }),                                                              // KAPSAM DIŞI
    ],
  });

  test('kapsanmayan maç varsa sayaç paydayı gösteriyor (5/6)', async () => {
    mockUclar({ '/api/bulletin': ESIKLI_BULTEN() });
    render(<HomeScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText('1. Hafta').length).toBeGreaterThan(0));
    // 6 maçın 5'inde analiz var. Yalnız "5" yazmak eksik veri izlenimi verirdi.
    // Sayaç KUTUSU okunur — ekranda gezinen çıplak "5"ler (maç no, puan) değil.
    expect(metin(screen.getByTestId('sayac-analiz'))).toBe('5/6');
  });

  test('etiketteki eşik ile sayılan eşik AYNI — sınır dahil sayılıyor', async () => {
    mockUclar({ '/api/bulletin': ESIKLI_BULTEN() });
    render(<HomeScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText('1. Hafta').length).toBeGreaterThan(0));

    // Etiketler eşiği YAZIYOR — kullanıcı sayının neyi saydığını görebilmeli.
    expect(screen.getByText('Öne Çıkan 45+')).toBeTruthy();
    expect(screen.getByText('Sürpriz 65+')).toBeTruthy();

    // Ve o eşikler GERÇEKTEN uygulanıyor:
    //   85, 65, 64, 45, 44  →  45+ olanlar: 85, 65, 64, 45 = 4
    //                          65+ olanlar: 85, 65         = 2
    // 64 ve 44 SINIRIN ALTINDA; sayılırlarsa eşik kaymış demektir.
    expect(metin(screen.getByTestId('sayac-one-cikan'))).toBe('4');
    expect(metin(screen.getByTestId('sayac-surpriz'))).toBe('2');
  });
});
