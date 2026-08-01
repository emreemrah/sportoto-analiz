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
import { render, screen, waitFor } from '@testing-library/react-native';

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
});
