// KALİBRASYON SEKMESİ RENDER TESTİ (T9 — arayüz yarısı).
//
// NEDEN VAR: Saf mantık testleri (test/kalibrasyon-logic.test.mjs) fonksiyonların
// doğru cümleyi ÜRETTİĞİNİ kanıtlar; bu dosya o cümlelerin kullanıcıya
// GERÇEKTEN ULAŞTIĞINI kanıtlar. İkisi ayrı şeydir: T3'te bulunan kupon hatası
// tam bu boşluktan geçmişti.
//
// Sürüm notu için bkz. ekranlar.test.jsx (RNTL 13.x kullanılır, 14.x DEĞİL).
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import SystemScorecardScreen from '../src/screens/SystemScorecardScreen';
import { EXPECTATION_NOTE } from '../src/calibrationLogic';

const nav = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()) };

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  // useFocusEffect sağlayıcısız çalışmaz; testte "ekran odakta" = effect bir kez.
  useFocusEffect: (cb) => { const React2 = require('react'); React2.useEffect(cb, [cb]); },
}));

// Backend'in GERÇEK dönüş şekli (buildCalibrationReport). Uydurulmuş alan yok.
const KALIBRASYON = {
  hasData: true,
  roundsCounted: 4,
  matchesCounted: 60,
  conventions: { brier: 'Toplam biçim, aralık [0, 2] — uniform 0.667' },
  uniform: { brier: 0.667, logLoss: 1.099, rps: 0.222 },
  model: { n: 60, brier: 0.62, logLoss: 1.02, rps: 0.21 },
  market: { n: 55, brier: 0.62, logLoss: 1.02, rps: 0.21 },
  baseline: { n: 60, brier: 0.65, logLoss: 1.07, rps: 0.22 },
  skill: { vsMarket: { logLoss: 0, brier: 0 }, vsBaseline: { logLoss: 0.047, brier: 0.046 } },
  marketDerived: { count: 55, share: 91.7, note: '…' },
  estimatedOnly: { n: 5, brier: 0.7, logLoss: 1.11, rps: 0.23 },
  curve: { bins: [], points: 180, insufficient: true, note: 'Kalibrasyon eğrisi için en az 200 gözlem gerekir (şu an 180).' },
};

// Sistem karnesi olmadan ekran hiç açılmaz (loading/error'da kalır).
const SISTEM = { hasData: false, isDemo: false, hasOfficialForwardData: false, predictionSource: 'test', resultSource: 'test' };

// Uca göre yanıt veren fetch — her uç ayrı çağrılıyor.
function mockUclar(kalibrasyon) {
  global.fetch.mockImplementation(async (url) => {
    const u = String(url);
    const govde = u.includes('/scorecards/calibration') ? kalibrasyon
      : u.includes('/scorecards/system') ? SISTEM
        : { hasData: false };
    return { ok: true, status: 200, json: async () => govde, text: async () => JSON.stringify(govde) };
  });
}

const kalibrasyonSekmesiniAc = async () => {
  render(<SystemScorecardScreen navigation={nav} />);
  const sekme = await screen.findByText('Kalibrasyon');
  fireEvent.press(sekme);
};

describe('Kalibrasyon sekmesi', () => {
  test('ANA RAKAM beceridir; "ayırt edilemiyor" kullanıcıya ULAŞIYOR', async () => {
    mockUclar(KALIBRASYON);
    await kalibrasyonSekmesiniAc();
    await waitFor(() => expect(screen.getByText('Piyasadan ayırt edilemiyor')).toBeTruthy());
    // Örneklem başlığın hemen altında, n ile birlikte.
    expect(screen.getByText(/60 maç · 4 hafta/)).toBeTruthy();
  });

  test('model=piyasa uyarısı GÖRÜNÜYOR (gizlenirse ekran yanıltıcı olur)', async () => {
    mockUclar(KALIBRASYON);
    await kalibrasyonSekmesiniAc();
    await waitFor(() => expect(screen.getByText(/Olasılıkların %91\.7'i orandan türüyor/)).toBeTruthy());
    expect(screen.getByText(/tanım gereği/i)).toBeTruthy();
  });

  test('beklenti cümlesi (~%12) ekranda basılıyor', async () => {
    mockUclar(KALIBRASYON);
    await kalibrasyonSekmesiniAc();
    await waitFor(() => expect(screen.getByText(EXPECTATION_NOTE)).toBeTruthy());
  });

  test('yetersiz veride eğri yerine dürüst cümle çiziliyor', async () => {
    mockUclar(KALIBRASYON);
    await kalibrasyonSekmesiniAc();
    await waitFor(() => expect(screen.getByText(/en az 200 gözlem gerekir/)).toBeTruthy());
  });

  test('skor satırları n ile birlikte çiziliyor', async () => {
    mockUclar(KALIBRASYON);
    await kalibrasyonSekmesiniAc();
    await waitFor(() => expect(screen.getByText(/log-loss 1\.02 · Brier 0\.62 · n=60/)).toBeTruthy());
  });

  test('veri yokken sahte yüzde ÜRETİLMEZ, boş durum gösterilir', async () => {
    mockUclar({ hasData: false, insufficientNote: 'Kalibrasyon için en az 30 resmî sonuçlu maç gerekir (şu an 0).' });
    await kalibrasyonSekmesiniAc();
    await waitFor(() => expect(screen.getByText(/en az 30 resmî sonuçlu maç gerekir/)).toBeTruthy());
    expect(screen.queryByText(/daha iyi/)).toBeNull();
  });
});
