// KUPON EDİTÖRÜ RENDER TESTLERİ.
//
// NEDEN VAR: Kullanıcının parasının karşılığı olan ekran. Buradaki bir
// sessiz hata doğrudan yanlış kupona dönüşür.
//
// Korunan kurallar:
//  * Maliyet YALNIZ gerçek fiyat verisiyle gösterilir; veri yoksa TL
//    yazılmaz ve bunun sebebi söylenir.
//  * BAŞLAMIŞ maçın seçimi donar; seçim yapılmadan başlamışsa kuponda BOŞ
//    kalır ve bu açıkça yazılır ("isabet sayılmaz").
//  * Tüm maçlar başladıysa hafta kilitlidir — düzenleme yolu kapanır.
//  * Backend etiketi ("BANKO") ekrana HAM basılmaz.
//
// Sürüm notu için bkz. ekranlar.test.jsx (RNTL 13.x kullanılır, 14.x DEĞİL).
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';

import CouponEditorScreen from '../src/screens/CouponEditorScreen';

const nav = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()) };

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useFocusEffect: (cb) => { const R = require('react'); R.useEffect(cb, [cb]); },
}));

// Kupon deposu cihaz yereli — testte sürülür.
jest.mock('../src/coupon/store', () => ({
  getCoupon: () => null,
  finalVersion: () => null,
  createCoupon: jest.fn(), addVersion: jest.fn(), renameCoupon: jest.fn(),
  getDraft: () => ({ picks: {} }),
  clearDraft: jest.fn(),
}));

// GELECEK ve GEÇMİŞ tarih: kilit durumunu belirleyen tek şey maç saatidir.
const GELECEK = '2099-01-01T17:00:00Z';
const GECMIS = '2020-01-01T17:00:00Z';

const mac = (no, date) => ({
  no, sportotoMatchId: `sm${no}`,
  home: { name: 'Ev Takımı', mediumName: 'Ev', logo: null },
  away: { name: 'Dep Takımı', mediumName: 'Dep', logo: null },
  league: 'Test Ligi', date,
  analysis: { probabilities: { '1': 50, X: 27, '2': 23 }, favorite: { symbol: '1', percent: 50 }, estimated: false },
});

const BULTEN = (date = GELECEK, over = {}) => ({
  roundId: 1600, round: '1. Hafta', year: 2026,
  verification: { status: 'confirmed' },
  matches: Array.from({ length: 15 }, (_, i) => mac(i + 1, date)),
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

const route = { params: { roundId: 1600 } };

describe('Kupon Editörü', () => {
  test('bülten çiziliyor ve 15 maç listeleniyor', async () => {
    mockUclar({ '/api/bulletin': BULTEN() });
    render(<CouponEditorScreen route={route} navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText('Ev').length).toBe(15));
  });

  test('fiyat verisi yokken TL UYDURULMUYOR ve sebebi yazılıyor', async () => {
    mockUclar({ '/api/bulletin': BULTEN() });   // fiyat ucu 404
    render(<CouponEditorScreen route={route} navigation={nav} />);
    expect(await screen.findByText(/uydurma fiyat kullanılmaz/)).toBeTruthy();
    // Hiçbir yerde TL rakamı basılmamalı.
    expect(screen.queryByText(/\d+ TL/)).toBeNull();
  });

  test('tüm maçlar başladıysa hafta KİLİTLİ olduğu söyleniyor', async () => {
    mockUclar({ '/api/bulletin': BULTEN(GECMIS) });
    render(<CouponEditorScreen route={route} navigation={nav} />);
    expect(await screen.findByText(/Tüm maçlar başladı — bu hafta kupon artık değiştirilemez\./)).toBeTruthy();
  });

  test('seçimsiz başlamış maç "isabet sayılmaz" diye işaretleniyor', async () => {
    mockUclar({ '/api/bulletin': BULTEN(GECMIS) });
    render(<CouponEditorScreen route={route} navigation={nav} />);
    // Taslakta seçim yok → başlamış maçlar BOŞ kalır ve bu gizlenmez.
    const isaret = await screen.findAllByText(/başladı — boş \(isabet sayılmaz\)/);
    expect(isaret.length).toBe(15);
  });

  test('backend etiketi ("BANKO") ekrana HAM basılmıyor', async () => {
    mockUclar({
      '/api/bulletin': BULTEN(GELECEK, {
        matches: Array.from({ length: 15 }, (_, i) => ({
          ...mac(i + 1, GELECEK),
          analysis: { probabilities: { '1': 70, X: 18, '2': 12 }, favorite: { symbol: '1', percent: 70 }, label: 'BANKO', estimated: false },
        })),
      }),
    });
    render(<CouponEditorScreen route={route} navigation={nav} />);
    await waitFor(() => expect(screen.getAllByText('Ev').length).toBe(15));
    expect(screen.queryByText('BANKO')).toBeNull();
  });

  test('sunucu bülten vermezse boş ekran değil, sebep gösteriliyor', async () => {
    global.fetch.mockImplementation(async () => ({
      ok: false, status: 503, json: async () => ({ error: 'Veri henüz hazır değil.' }), text: async () => 'Veri henüz hazır değil.',
    }));
    render(<CouponEditorScreen route={route} navigation={nav} />);
    expect(await screen.findByText(/Veri henüz hazır değil\./)).toBeTruthy();
  });
});
