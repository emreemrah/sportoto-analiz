// MAÇ DETAYI RENDER TESTLERİ.
//
// NEDEN VAR: Uygulamanın en çok açılan ve en çok veriye dokunan ekranı; 1265
// satır ve render testi yoktu. Buradaki testler "her şey doğru mu"yu değil,
// EKSİK VERİDE NE OLDUĞUNU kovalar — asıl risk orada: veri yokken ekranın
// çökmesi ya da (daha kötüsü) sıfır/uydurma sayı göstermesi.
//
// Sürüm notu için bkz. ekranlar.test.jsx (RNTL 13.x kullanılır, 14.x DEĞİL).
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';

import MatchDetailScreen from '../src/screens/MatchDetailScreen';

const nav = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()) };
const route = { params: { no: 1 } };

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useFocusEffect: (cb) => { const R = require('react'); R.useEffect(cb, [cb]); },
}));

// Backend'in gerçek /api/match/:no yükünden türetilmiş asgari maç.
const MAC = (over = {}) => ({
  no: 1, sportotoMatchId: 'sm1',
  home: { name: 'Ev Takımı', mediumName: 'Ev Takımı' },
  away: { name: 'Dep Takımı', mediumName: 'Dep Takımı' },
  league: 'Test Ligi', date: '2026-08-02T17:00:00Z', status: 'scheduled',
  roundId: 1600, round: '1. Hafta', year: 2026, verificationStatus: 'confirmed',
  analysis: {
    probabilities: { '1': 50, X: 27, '2': 23 },
    favorite: { symbol: '1', percent: 50 },
    surpriseScore: 35, hasOdds: true, estimated: false,
  },
  prediction: { symbol: '1', meaning: 'Ev sahibi', label: 'NET', estimated: false, reason: 'test' },
  stats: null,
  ...over,
});

function mockUclar(harita) {
  global.fetch.mockImplementation(async (url) => {
    const u = String(url);
    const k = Object.keys(harita).find((x) => u.includes(x));
    if (!k) return { ok: false, status: 404, json: async () => ({ error: 'yok' }), text: async () => 'yok' };
    const g = harita[k];
    if (g?.__hata) return { ok: false, status: g.__kod || 503, json: async () => ({ error: g.__hata }), text: async () => g.__hata };
    return { ok: true, status: 200, json: async () => g, text: async () => JSON.stringify(g) };
  });
}

describe('Maç Detayı', () => {
  test('istatistik hiç yokken ÇÖKMÜYOR ve takımlar görünüyor', async () => {
    // stats: null — sahadan veri gelmemiş en kötü durum.
    mockUclar({ '/api/match/': MAC() });
    render(<MatchDetailScreen route={route} navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Ev Takımı/).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/Dep Takımı/).length).toBeGreaterThan(0);
  });

  test('sunucu hatası boş ekran değil, sebebi gösterir', async () => {
    mockUclar({ '/api/match/': { __hata: 'Veri henüz hazır değil.', __kod: 503 } });
    render(<MatchDetailScreen route={route} navigation={nav} />);
    expect(await screen.findByText(/Veri henüz hazır değil\./)).toBeTruthy();
  });

  test('"BANKO" anahtarı kullanıcıya OLDUĞU GİBİ gösterilmez', async () => {
    mockUclar({
      '/api/match/': MAC({
        prediction: { symbol: '1', meaning: 'Ev sahibi', label: 'BANKO', estimated: false, reason: 'test' },
      }),
    });
    render(<MatchDetailScreen route={route} navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Ev Takımı/).length).toBeGreaterThan(0));
    // Anahtar ekranda ham geçmemeli — kullanıcı dili labels.js'ten gelir.
    expect(screen.queryByText('BANKO')).toBeNull();
  });

  // NOT: Bu ekran olasılık YÜZDESİ göstermiyor (`ProbBars` tanımlı ama hiç
  // çağrılmıyor — ölü kod). Dolayısıyla burada "≈ tahmini" işareti aranmaz;
  // aranacak şey, veri hiç yokken ekranın SEBEBİNİ yazmasıdır.
  test('oran da tahmin de yokken sebep yazılır, sahte sayı üretilmez', async () => {
    mockUclar({
      '/api/match/': MAC({
        analysis: { probabilities: null, surpriseScore: 0, hasOdds: false, estimated: false },
        prediction: { symbol: '-', meaning: 'Veri yok', label: 'VERİ YOK', estimated: false, reason: 'Yeterli veri yok' },
      }),
    });
    // Not İSTATİSTİK sekmesinde; route ile doğrudan o sekme açılır.
    render(<MatchDetailScreen route={{ params: { no: 1, tab: 'İstatistik' } }} navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Ev Takımı/).length).toBeGreaterThan(0));
    expect(screen.getByText(/oran\/veri henüz açıklanmamış/)).toBeTruthy();
    // Veri yokken uydurma yüzde basılmaz.
    expect(screen.queryByText(/%\d/)).toBeNull();
  });
});
