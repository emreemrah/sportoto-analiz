// RESMÎ LİSTE EKRANI RENDER TESTLERİ.
//
// Bu ekran resmî sitedeki düzeni yansıtır ve HİÇBİR analiz/tahmin içermez.
// İki risk var:
//  1. Resmî listede olmayan bir sayının bizde görünmesi (özellikle
//     açıklanmamış ikramiyenin 0 diye yazılması).
//  2. Ekranın resmî bir kaynak sanılması — bağımsızlık beyanı görünmeli.
//
// Sürüm notu için bkz. ekranlar.test.jsx (RNTL 13.x kullanılır, 14.x DEĞİL).
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';

import ResmiListeScreen from '../src/screens/ResmiListeScreen';
import { INDEPENDENCE_NOTICE } from '../src/brand';

const nav = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()) };

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useFocusEffect: (cb) => { const R = require('react'); R.useEffect(cb, [cb]); },
}));

const HAFTALAR = {
  currentRoundId: 1600,
  rounds: [
    { id: 1600, name: '53. Hafta', year: 2026, closeDate: '2026-08-08T14:55:00' },
    { id: 1599, name: '52. Hafta', year: 2026, closeDate: '2026-08-01T14:55:00' },
  ],
};

const mac = (no, over = {}) => ({
  no,
  home: { name: `Ev ${no}`, mediumName: `Ev ${no}` },
  away: { name: `Dep ${no}`, mediumName: `Dep ${no}` },
  date: '2026-08-09T17:00:00',
  score: null, result: null,
  ...over,
});

const HAFTA = (over = {}) => ({
  roundId: 1600, source: 'Spor Toto',
  matches: [mac(1), mac(2), mac(3)],
  prize: null,
  ...over,
});

function mockUclar(harita) {
  global.fetch.mockImplementation(async (url) => {
    const u = String(url);
    const k = Object.keys(harita).find((x) => u.includes(x));
    if (!k) return { ok: false, status: 404, json: async () => ({ error: 'yok' }), text: async () => 'yok' };
    return { ok: true, status: 200, json: async () => harita[k], text: async () => JSON.stringify(harita[k]) };
  });
}

const VARSAYILAN = { '/api/rounds': HAFTALAR, '/api/history/': HAFTA() };

describe('Resmî Liste', () => {
  test('tablo başlıkları resmî listedeki sırada', async () => {
    mockUclar(VARSAYILAN);
    render(<ResmiListeScreen navigation={nav} />);
    await waitFor(() => expect(screen.getByText('Sıra')).toBeTruthy());
    for (const b of ['Maç', 'Maç Günü', 'Maç Saati', 'Skor', 'Sonuç']) {
      expect(screen.getByText(b)).toBeTruthy();
    }
    expect(screen.getByText('Liste 1 Haftalıktır')).toBeTruthy();
  });

  test('maç satırları resmî biçimde çiziliyor', async () => {
    mockUclar(VARSAYILAN);
    render(<ResmiListeScreen navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText(/Ev 1 – Dep 1/).length).toBe(1));
    expect(screen.getAllByText('09.08.2026-Pazar').length).toBe(3);
    expect(screen.getAllByText('17:00').length).toBe(3);
    // Skor/sonuç gelmemiş: tire, sıfır DEĞİL.
    expect(screen.getAllByText('–').length).toBe(6);   // 3 skor + 3 sonuç
    expect(screen.queryByText('0-0')).toBeNull();
  });

  test('sonuçlar geldiyse skor ve RESMÎ sonuç yazımı (X değil 0)', async () => {
    mockUclar({
      ...VARSAYILAN,
      '/api/history/': HAFTA({
        matches: [
          mac(1, { score: { home: 2, away: 1 }, result: '1' }),
          mac(2, { score: { home: 1, away: 1 }, result: 'X' }),
        ],
      }),
    });
    render(<ResmiListeScreen navigation={nav} />);
    await waitFor(() => expect(screen.getByText('2-1')).toBeTruthy());
    expect(screen.getByText('1-1')).toBeTruthy();
    // Beraberlik resmî yazımda "0".
    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.queryByText('X')).toBeNull();
  });

  test('ikramiye AÇIKLANMAMIŞSA "----" — sıfır uydurulmuyor', async () => {
    mockUclar(VARSAYILAN);        // prize: null
    render(<ResmiListeScreen navigation={nav} />);
    await waitFor(() => expect(screen.getByText('Açıklanan Sonuçlar')).toBeTruthy());
    for (const e of ['15 Bilen', '14 Bilen', '13 Bilen', '12 Bilen', 'Kapanış', 'Açıklamalar']) {
      expect(screen.getByText(e)).toBeTruthy();
    }
    // Dört kademe + açıklamalar = 5 adet "----" (kapanış hafta kaydından gelir).
    expect(screen.getAllByText('----').length).toBeGreaterThanOrEqual(5);
    expect(screen.queryByText('0 kişi')).toBeNull();
  });

  test('ikramiye açıklandıysa kazanan ve tutar birlikte (pozitif eş)', async () => {
    mockUclar({
      ...VARSAYILAN,
      '/api/history/': HAFTA({
        prize: {
          tiers: [{ hit: 15, count: 0, prize: 0 }, { hit: 14, count: 3, prize: 1234567.5 }],
          closeDate: '2026-08-08T14:55:00',
          description: 'Devreden ikramiye vardır.',
        },
      }),
    });
    render(<ResmiListeScreen navigation={nav} />);
    // 15 bilen YOK: "0 kişi" bir BİLGİDİR (devreden var demektir), boşluk değil.
    expect(await screen.findByText('0 kişi')).toBeTruthy();
    expect(screen.getByText('3 kişi · 1.234.567,50 TL')).toBeTruthy();
    expect(screen.getByText('08 Ağustos Cumartesi 2026 14:55')).toBeTruthy();
    expect(screen.getByText('Devreden ikramiye vardır.')).toBeTruthy();
  });

  test('hafta seçici açılıyor ve başka haftaya geçiliyor', async () => {
    mockUclar(VARSAYILAN);
    render(<ResmiListeScreen navigation={nav} />);
    await waitFor(() => expect(screen.getByText('53. Hafta')).toBeTruthy());
    fireEvent.press(screen.getByText('53. Hafta'));
    // Liste açılınca iki hafta da görünür.
    expect(await screen.findByText('52. Hafta')).toBeTruthy();
    fireEvent.press(screen.getByText('52. Hafta'));
    await waitFor(() => {
      const cagrilar = global.fetch.mock.calls.map(([u]) => String(u));
      expect(cagrilar.some((u) => u.includes('/api/history/1599'))).toBe(true);
    });
  });

  test('BAĞIMSIZLIK beyanı görünüyor — resmî kaynak sanılmasın', async () => {
    mockUclar(VARSAYILAN);
    render(<ResmiListeScreen navigation={nav} />);
    expect(await screen.findByText(INDEPENDENCE_NOTICE)).toBeTruthy();
    expect(screen.getByText(/Kaynak: Spor Toto/)).toBeTruthy();
  });

  test('bu ekranda ANALİZ/TAHMİN yok — yalnız resmî veri', async () => {
    mockUclar(VARSAYILAN);
    render(<ResmiListeScreen navigation={nav} />);
    await waitFor(() => expect(screen.getByText('Sıra')).toBeTruthy());
    // Analiz katmanının kelimeleri bu ekranda geçmemeli.
    for (const kelime of [/Güçlü Aday/i, /Sürpriz/i, /Favori/i, /Radar/i, /banko/i]) {
      expect(screen.queryByText(kelime)).toBeNull();
    }
  });
});
