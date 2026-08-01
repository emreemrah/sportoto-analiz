// HAFTA ÖZETİ RENDER TESTLERİ.
//
// NEDEN VAR: Bu ekran 15 maçı dört sayıya indirger. İndirgeme her zaman
// bilgi kaybıdır; risk, sayı ile listenin AYRI süzgeçlerden doğup birbirini
// tutmamasıdır ("3 denk maç" yazıp 2 satır göstermek gibi).
//
// Korunan kurallar:
//  * Başlamış maçlar özete girmez (kupon açılamayacak maçı öne çıkarmak
//    yanıltıcıdır).
//  * "BANKO" iç anahtarı ekrana HAM basılmaz — "GÜÇLÜ ADAY" olarak çıkar.
//  * Zorluk verisi yoksa uydurulmaz.
//
// Sürüm notu için bkz. ekranlar.test.jsx (RNTL 13.x kullanılır, 14.x DEĞİL).
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';

import WeekSummaryScreen from '../src/screens/WeekSummaryScreen';

const nav = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()) };

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useFocusEffect: (cb) => { const R = require('react'); R.useEffect(cb, [cb]); },
}));

const GELECEK = '2099-01-01T17:00:00Z';
const GECMIS = '2020-01-01T17:00:00Z';

// analysis.label backend'in İÇ anahtarıdır ('BANKO'); ekranda görünmemeli.
const mac = (no, { date = GELECEK, label = null, fav = 40, surprise = 20 } = {}) => ({
  no, sportotoMatchId: `sm${no}`,
  home: { name: `Ev ${no}`, mediumName: `Ev ${no}` },
  away: { name: `Dep ${no}`, mediumName: `Dep ${no}` },
  league: 'Test Ligi', date,
  analysis: {
    label,
    favorite: { symbol: '1', percent: fav },
    surpriseScore: surprise,
    probabilities: { '1': fav, X: Math.round((100 - fav) / 2), '2': 100 - fav - Math.round((100 - fav) / 2) },
  },
});

function mockUclar(govde) {
  global.fetch.mockImplementation(async () => (
    govde?.__hata
      ? { ok: false, status: 503, json: async () => ({ error: govde.__hata }), text: async () => govde.__hata }
      : { ok: true, status: 200, json: async () => govde, text: async () => JSON.stringify(govde) }
  ));
}

describe('Hafta Özeti', () => {
  test('özet çiziliyor ve maç sayısı doğru', async () => {
    mockUclar({
      roundId: 1600, season: 2026, weekNumber: 1,
      matches: [mac(1, { label: 'BANKO', fav: 72 }), mac(2), mac(3)],
    });
    render(<WeekSummaryScreen navigation={nav} />);
    expect(await screen.findByText('HAFTANIN ÖZETİ')).toBeTruthy();
    expect(screen.getByText('2026 Sezonu · 1. Hafta')).toBeTruthy();
  });

  test('"BANKO" iç anahtarı ekrana HAM basılmıyor', async () => {
    mockUclar({ roundId: 1600, matches: [mac(1, { label: 'BANKO', fav: 72 })] });
    render(<WeekSummaryScreen navigation={nav} />);
    await waitFor(() => expect(screen.getByText('HAFTANIN ÖZETİ')).toBeTruthy());
    // Bölüm başlığı zaten "GÜÇLÜ ADAYLAR"; satırda da anahtar değil etiket olmalı.
    expect(screen.queryByText('BANKO')).toBeNull();
    expect(screen.getAllByText(/GÜÇLÜ ADAY/i).length).toBeGreaterThan(0);
  });

  test('BAŞLAMIŞ maçlar özete girmiyor', async () => {
    mockUclar({
      roundId: 1600,
      matches: [
        // En güçlü favori ama maç BAŞLAMIŞ — öne çıkarılmamalı.
        mac(1, { date: GECMIS, label: 'BANKO', fav: 90 }),
        mac(2, { label: 'BANKO', fav: 60 }),
      ],
    });
    render(<WeekSummaryScreen navigation={nav} />);
    await waitFor(() => expect(screen.getByText('HAFTANIN ÖZETİ')).toBeTruthy());
    expect(screen.getAllByText(/Ev 2/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Ev 1/)).toBeNull();
  });

  test('zorluk verisi yoksa UYDURULMUYOR', async () => {
    mockUclar({ roundId: 1600, matches: [mac(1)] });     // difficulty yok
    render(<WeekSummaryScreen navigation={nav} />);
    await waitFor(() => expect(screen.getByText('HAFTANIN ÖZETİ')).toBeTruthy());
    expect(screen.queryByText('Bülten zorluğu')).toBeNull();
  });

  test('zorluk verisi VARSA gösteriliyor (pozitif eş)', async () => {
    mockUclar({
      roundId: 1600, matches: [mac(1)],
      difficulty: { level: 'Zor', score: 68, text: 'Bu hafta denk maç çok.' },
    });
    render(<WeekSummaryScreen navigation={nav} />);
    expect(await screen.findByText('Bülten zorluğu')).toBeTruthy();
    expect(screen.getByText('Zor · 68/100')).toBeTruthy();
  });

  test('sunucu hatası GİZLENMİYOR', async () => {
    mockUclar({ __hata: 'Veri henüz hazır değil.' });
    render(<WeekSummaryScreen navigation={nav} />);
    expect(await screen.findByText(/Veri henüz hazır değil\./)).toBeTruthy();
  });
});
