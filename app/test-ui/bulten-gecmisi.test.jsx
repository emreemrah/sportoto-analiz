// BÜLTEN GEÇMİŞİ RENDER TESTLERİ.
//
// NEDEN VAR: Bu ekran arşivi gösterir; buradaki en büyük risk DEMO VERİYİ
// gerçek arşiv sanmaktır. Sunucuya ulaşılamadığında örnek bültenlere düşme
// yolu var ve o durumda ekranın kalıcı bir DEMO bandı basması şart.
//
// Korunan kurallar:
//  * Arşiv boşsa uydurma bülten üretilmez, dürüst boş durum gösterilir.
//  * Hata gizlenmez, sebebi yazılır ve tekrar deneme sunulur.
//  * Demo veriye düşülürse bu kullanıcıdan GİZLENMEZ.
//
// Sürüm notu için bkz. ekranlar.test.jsx (RNTL 13.x kullanılır, 14.x DEĞİL).
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';

import BulletinHistoryScreen from '../src/screens/BulletinHistoryScreen';

const nav = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()) };

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useFocusEffect: (cb) => { const R = require('react'); R.useEffect(cb, [cb]); },
}));

// Arşiv servisi testten sürülür (ağa çıkmaz).
const arsiv = { liste: [], hata: null };
jest.mock('../src/services/bulletinHistoryService', () => ({
  listBulletins: async () => {
    if (arsiv.hata) throw new Error(arsiv.hata);
    return arsiv.liste;
  },
  getBulletinById: async () => null,
}));

const bulten = (no, over = {}) => ({
  id: `arsiv-${no}`, bulletinNo: no, status: 'completed',
  date: '2026-07-25T17:00:00Z', lockedAt: '2026-07-25T16:55:00Z',
  matches: Array.from({ length: 15 }, (_, i) => ({ no: i + 1 })),
  _finishedCount: 15,
  resultSummary: null,
  ...over,
});

beforeEach(() => { arsiv.liste = []; arsiv.hata = null; });

describe('Bülten Geçmişi', () => {
  test('başlık ve mühür vaadi kullanıcıya ULAŞIYOR', async () => {
    arsiv.liste = [bulten(52)];
    render(<BulletinHistoryScreen navigation={nav} />);
    expect(await screen.findByText('Bülten Geçmişi')).toBeTruthy();
    // Bu cümle ürünün sözü: analiz maç ÖNCESİ mühürlenir.
    expect(screen.getByText(/maç öncesi MÜHÜRLÜ analizi ve resmî sonuçları/)).toBeTruthy();
  });

  test('arşiv boşsa uydurma bülten ÜRETİLMİYOR', async () => {
    arsiv.liste = [];
    render(<BulletinHistoryScreen navigation={nav} />);
    expect(await screen.findByText('Henüz bülten yok')).toBeTruthy();
    expect(screen.getByText('Geçmiş bülten bulunamadı.')).toBeTruthy();
    expect(screen.queryByText(/Bülten \d/)).toBeNull();
  });

  test('hata GİZLENMİYOR, sebebi yazılıyor', async () => {
    arsiv.hata = 'Arşiv sunucusuna ulaşılamadı.';
    render(<BulletinHistoryScreen navigation={nav} />);
    expect(await screen.findByText(/Arşiv sunucusuna ulaşılamadı\./)).toBeTruthy();
  });

  test('DEMO veriye düşülürse bu GİZLENMİYOR (kalıcı bant)', async () => {
    // Servis örnek veriye düştüğünde her öğe _demo taşır.
    arsiv.liste = [bulten(52, { _demo: true }), bulten(51, { _demo: true })];
    render(<BulletinHistoryScreen navigation={nav} />);
    expect(await screen.findByText(/ÖRNEKTİR, gerçek arşiv verisi değildir/)).toBeTruthy();
  });

  test('GERÇEK arşivde demo bandı GÖSTERİLMİYOR', async () => {
    // Pozitif/negatif eşi: aynı bant gerçek veride çıkmamalı.
    arsiv.liste = [bulten(52), bulten(51)];
    render(<BulletinHistoryScreen navigation={nav} />);
    await waitFor(() => expect(screen.getByText('Bülten Geçmişi')).toBeTruthy());
    expect(screen.queryByText(/ÖRNEKTİR/)).toBeNull();
  });

  test('tek bülten bile demo DEĞİLSE bant çıkmaz (karışık liste)', async () => {
    // Bant yalnız HEPSİ demo ise çıkar; karışık listede gerçek veri var
    // demektir ve "hepsi örnektir" demek yanlış olurdu.
    arsiv.liste = [bulten(52, { _demo: true }), bulten(51)];
    render(<BulletinHistoryScreen navigation={nav} />);
    await waitFor(() => expect(screen.getByText('Bülten Geçmişi')).toBeTruthy());
    expect(screen.queryByText(/ÖRNEKTİR/)).toBeNull();
  });
});
