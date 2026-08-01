// KUPON MERKEZİ RENDER TESTLERİ.
//
// NEDEN VAR: T3'te bulunan kupon senkron hatası (girişli kullanıcı mobilde
// hep "girişsiz" sayılıyordu) tam olarak bu ekranın test edilmemiş
// olmasından geçmişti. Buradaki testler ekranın çizildiğini ve kupon
// kurallarının kullanıcıya DOĞRU anlatıldığını doğrular.
//
// Korunan kurallar:
//  * Geçmiş/kilitli haftaya kupon açılamaz — "geriye dönük başarı üretilmez".
//  * Kilitli kupon silinemez (karne geriye dönük değişmesin).
//  * "Tahminimi kilitle" bir KULLANICI BEYANIDIR, doğrulanmış değildir.
//  * Doğru sayısı yalnız resmî 90 dk sonucuyla hesaplanır.
//
// Sürüm notu için bkz. ekranlar.test.jsx (RNTL 13.x kullanılır, 14.x DEĞİL).
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';

import CouponCenterScreen from '../src/screens/CouponCenterScreen';

const nav = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()) };

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useFocusEffect: (cb) => { const R = require('react'); R.useEffect(cb, [cb]); },
}));

// Kupon deposu cihaz yereli — testte doğrudan beslenir. Gerçek modülün
// yüzeyi korunur ki ekran çağırdığı bir şeyi bulamayıp çökmesin.
const kuponlar = { liste: [] };
jest.mock('../src/coupon/store', () => ({
  getWeekCoupons: () => kuponlar.liste,
  finalVersion: (c) => c.versions?.[c.versions.length - 1] || null,
  setRanked: jest.fn(), deleteCoupon: jest.fn(), copyCoupon: jest.fn(),
  syncFromServer: jest.fn(async () => {}),
  getSyncState: () => ({ loggedIn: false, error: null }),
  retrySync: jest.fn(async () => {}),
  subscribeCoupons: () => () => {},
  markPlayed: jest.fn(),
}));

const HAFTALAR = {
  currentRoundId: 1600,
  rounds: [
    { id: 1599, name: '52. Hafta', year: 2026, closeDate: '2026-07-25T14:00:00Z' },
    { id: 1600, name: '1. Hafta', year: 2026, closeDate: '2026-08-08T14:00:00Z' },
  ],
};

// Bülten: maçlar HENÜZ BAŞLAMADI (kilit açık) — kupon oluşturulabilir.
const BULTEN = {
  roundId: 1600, round: '1. Hafta', year: 2026,
  matches: Array.from({ length: 15 }, (_, i) => ({
    no: i + 1, home: { name: 'Ev' }, away: { name: 'Dep' },
    date: '2099-01-01T17:00:00Z',
  })),
};

function mockUclar(harita) {
  global.fetch.mockImplementation(async (url) => {
    const u = String(url);
    const k = Object.keys(harita).find((x) => u.includes(x));
    if (!k) return { ok: false, status: 404, json: async () => ({ error: 'yok' }), text: async () => 'yok' };
    return { ok: true, status: 200, json: async () => harita[k], text: async () => JSON.stringify(harita[k]) };
  });
}

const VARSAYILAN = { '/api/rounds': HAFTALAR, '/api/bulletin': BULTEN };

beforeEach(() => { kuponlar.liste = []; });

describe('Kupon Merkezi', () => {
  test('ekran çiziliyor ve seçili hafta başlıkta görünüyor', async () => {
    mockUclar(VARSAYILAN);
    render(<CouponCenterScreen navigation={nav} />);
    await waitFor(() => expect(screen.getByText('🎟️ Kupon Merkezi')).toBeTruthy());
    expect(await screen.findByText('1. Hafta')).toBeTruthy();
    expect(screen.getByText('2026 Sezonu')).toBeTruthy();
  });

  test('kupon yokken BOŞ DURUM gösteriliyor, sahte kupon üretilmiyor', async () => {
    mockUclar(VARSAYILAN);
    render(<CouponCenterScreen navigation={nav} />);
    expect(await screen.findByText('Bu hafta kuponun yok')).toBeTruthy();
    // Maçlar başlamadı → kupon açma yolu AÇIK.
    expect(screen.getByText('+ Kupon Oluştur')).toBeTruthy();
  });

  test('maçlar başlamışken kupon açma yolu KAPALI ve sebebi yazıyor', async () => {
    mockUclar({
      ...VARSAYILAN,
      '/api/bulletin': {
        ...BULTEN,
        // Tüm maçlar geçmişte → hafta kilitli.
        matches: BULTEN.matches.map((m) => ({ ...m, date: '2020-01-01T17:00:00Z' })),
      },
    });
    render(<CouponCenterScreen navigation={nav} />);
    expect(await screen.findByText('Bu hafta kuponun yok')).toBeTruthy();
    expect(screen.getByText(/Tüm maçlar başladı — bu haftaya artık kupon açılamaz\./)).toBeTruthy();
    expect(screen.queryByText('+ Kupon Oluştur')).toBeNull();
  });

  test('alt not: doğru sayısı YALNIZ resmî sonuçla hesaplanır', async () => {
    mockUclar(VARSAYILAN);
    render(<CouponCenterScreen navigation={nav} />);
    await waitFor(() => expect(screen.getByText('🎟️ Kupon Merkezi')).toBeTruthy());
    // Bu cümle ürünün sözü: geriye dönük başarı üretilmez.
    expect(screen.getByText(/geriye dönük başarı üretilmez/)).toBeTruthy();
    expect(screen.getByText(/resmî 90 dakika sonucuyla/)).toBeTruthy();
  });

  test('kupon varsa ölçüler çiziliyor; fiyat verisi yokken TL UYDURULMAZ', async () => {
    kuponlar.liste = [{
      id: 'k1', name: 'Kupon 1', roundId: 1600,
      createdAt: '2026-08-01T10:00:00Z', updatedAt: '2026-08-01T11:00:00Z',
      versions: [{
        versionNo: 1, columnCount: 8,
        selections: [{ no: 1, selectedOutcomes: ['1'] }, { no: 2, selectedOutcomes: [] }],
      }],
    }];
    mockUclar(VARSAYILAN);   // fiyat ucu 404 → pricing yok
    render(<CouponCenterScreen navigation={nav} />);
    await waitFor(() => expect(screen.getByText('Kupon 1')).toBeTruthy());
    expect(screen.getByText('8')).toBeTruthy();                 // KOLON
    // Fiyat verisi yoksa sayı uydurulmaz: "—" ve sebebi yazar.
    expect(screen.getByText('fiyat verisi yok')).toBeTruthy();
    // Sonuç yokken DOĞRU kutusu HİÇ çizilmez (0/0 gibi yanıltıcı sayı yok).
    expect(screen.queryByText('DOĞRU')).toBeNull();
  });

  test('"tahminimi kilitle" beyanı doğrulanmış gibi sunulmuyor', async () => {
    kuponlar.liste = [{
      id: 'k1', name: 'Kupon 1', roundId: 1600,
      createdAt: '2026-08-01T10:00:00Z', updatedAt: '2026-08-01T11:00:00Z',
      playedMarkedAt: '2026-08-01T12:00:00Z',
      versions: [{ versionNo: 1, columnCount: 1, selections: [] }],
    }];
    mockUclar(VARSAYILAN);
    render(<CouponCenterScreen navigation={nav} />);
    expect(await screen.findByText(/kullanıcı beyanı, bağımsız olarak doğrulanmamıştır/)).toBeTruthy();
  });
});
