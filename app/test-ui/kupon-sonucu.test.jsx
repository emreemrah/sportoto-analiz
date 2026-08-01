// KUPON SONUCU RENDER TESTLERİ.
//
// NEDEN VAR: Kullanıcının "tuttu mu?" sorusunun cevabını veren ekran.
// Buradaki en büyük risk yanlış sayı değil, ERKEN KESİN KONUŞMAK: sonuçların
// hepsi gelmeden "şu kadar bildin" demek.
//
// Korunan kurallar:
//  * Sonuçlar tamamlanmadan kademe (12/13/14/15) İDDİA EDİLMEZ; kaç resmî
//    sonucun geldiği söylenir.
//  * Gelmemiş maç ⏳ ile bekler — tahmin edilmez.
//  * Radar kaydı yoksa "—" yazılır, uydurulmaz.
//  * Kupon yoksa dürüst boş durum gösterilir.
//
// Sürüm notu için bkz. ekranlar.test.jsx (RNTL 13.x kullanılır, 14.x DEĞİL).
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';

import CouponResultScreen from '../src/screens/CouponResultScreen';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useFocusEffect: (cb) => { const R = require('react'); R.useEffect(cb, [cb]); },
}));

const depo = { kupon: null };
jest.mock('../src/coupon/store', () => ({
  getCoupon: () => depo.kupon,
  getRankedCoupon: () => depo.kupon,
}));

// Kupon: 15 maçın tamamında tekli seçim, hepsi '1'.
const KUPON = {
  id: 'k1', name: 'Kupon 1', roundId: 1600,
  versions: [{
    versionNo: 1, columnCount: 1,
    selections: Array.from({ length: 15 }, (_, i) => ({ no: i + 1, selectedOutcomes: ['1'] })),
  }],
};

// Geçmiş hafta: kaç maçın resmî sonucu geldiğini parametreyle sürüyoruz.
const GECMIS = (cozulen) => ({
  roundId: 1600, round: '1. Hafta', year: 2026,
  matches: Array.from({ length: 15 }, (_, i) => ({
    no: i + 1,
    home: { name: 'Ev Takımı', mediumName: 'Ev' },
    away: { name: 'Dep Takımı', mediumName: 'Dep' },
    date: '2026-08-02T17:00:00Z',
    ...(i < cozulen ? { result: '1', score: { home: 2, away: 0 } } : {}),
  })),
});

function mockUclar(harita) {
  global.fetch.mockImplementation(async (url) => {
    const u = String(url);
    const k = Object.keys(harita).find((x) => u.includes(x));
    if (!k) return { ok: false, status: 404, json: async () => ({ error: 'yok' }), text: async () => 'yok' };
    return { ok: true, status: 200, json: async () => harita[k], text: async () => JSON.stringify(harita[k]) };
  });
}

const route = { params: { roundId: 1600, couponId: 'k1', roundName: '1. Hafta', season: 2026 } };

beforeEach(() => { depo.kupon = KUPON; });

describe('Kupon Sonucu', () => {
  test('kupon yoksa dürüst boş durum gösteriliyor', async () => {
    depo.kupon = null;
    mockUclar({ '/api/history/': GECMIS(0) });
    render(<CouponResultScreen route={route} />);
    expect(await screen.findByText('Kupon yok')).toBeTruthy();
  });

  test('SONUÇLAR EKSİKKEN kademe İDDİA EDİLMİYOR', async () => {
    mockUclar({ '/api/history/': GECMIS(10) });   // 15 maçın 10'u sonuçlandı
    render(<CouponResultScreen route={route} />);
    // "10 bildin" gibi erken bir iddia YOK; kaç sonucun geldiği söylenir.
    expect(await screen.findByText('10/15 resmî sonuç geldi — kalan maçlar ⏳')).toBeTruthy();
    expect(screen.queryByText(/bildin/)).toBeNull();
  });

  test('tüm sonuçlar gelince kademe söyleniyor', async () => {
    mockUclar({ '/api/history/': GECMIS(15) });   // hepsi '1', kupon hepsi '1'
    render(<CouponResultScreen route={route} />);
    expect(await screen.findByText(/🎯 15 bildin — 12\+ barajının üstünde/)).toBeTruthy();
  });

  test('baraj altında kalınca "bildin" denmez, doğru sayısı verilir', async () => {
    // 15 maç sonuçlandı ama yalnız 3'ü '1' bitti → kupon 3 tutturur.
    const h = GECMIS(15);
    h.matches = h.matches.map((m, i) => (i < 3 ? m : { ...m, result: '2' }));
    mockUclar({ '/api/history/': h });
    render(<CouponResultScreen route={route} />);
    expect(await screen.findByText('12 barajının altında (3 doğru)')).toBeTruthy();
    expect(screen.queryByText(/bildin/)).toBeNull();
  });

  test('radar kaydı yokken "—" yazılıyor, uydurulmuyor', async () => {
    mockUclar({ '/api/history/': GECMIS(15) });   // /api/bulletin 404 → radarMap boş
    render(<CouponResultScreen route={route} />);
    await waitFor(() => expect(screen.getAllByText('Radar —').length).toBe(15));
  });

  test('hafta bilgisi eksikse sebep gösteriliyor', async () => {
    mockUclar({});
    render(<CouponResultScreen route={{ params: { couponId: 'k1' } }} />);
    expect(await screen.findByText(/Hafta bilgisi eksik\./)).toBeTruthy();
  });
});
