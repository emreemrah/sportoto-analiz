// LİDERLİK TABLOSU RENDER TESTLERİ.
//
// NEDEN VAR: Sıralama, kullanıcıya "başarı" gösteren en doğrudan ekran.
// Buradaki risk, resmî sonuç gelmeden bir sıra üretmek — yani kimsenin
// hak etmediği bir başarıyı sahnelemek.
//
// Korunan kurallar:
//  * Sıra YALNIZ resmî sonuçla değerlendirilen tahminlerden oluşur ve bu
//    ekranda AÇIKÇA yazar; kazanç vaadi değildir.
//  * Veri yoksa sahte sıra gösterilmez.
//  * Hata gizlenmez.
//  * İsabet oranı her zaman n ile birlikte verilir (doğru/yapılan).
//
// Sürüm notu için bkz. ekranlar.test.jsx (RNTL 13.x kullanılır, 14.x DEĞİL).
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';

import LeaderboardScreen from '../src/screens/LeaderboardScreen';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useFocusEffect: (cb) => { const R = require('react'); R.useEffect(cb, [cb]); },
}));

const oturum = { token: 't', user: { id: 'u1', username: 'emrah' }, ready: true };
jest.mock('../src/auth', () => ({
  useAuth: () => oturum,
  logout: jest.fn(),
  refreshUser: jest.fn(async () => {}),
}));

const oyuncu = (rank, username, over = {}) => ({
  rank, username, points: 100 - rank * 10,
  accuracy: 60 - rank, correct: 9, made: 15, level: 3,
  ...over,
});

function mockUclar(govde) {
  global.fetch.mockImplementation(async () => (
    govde?.__hata
      ? { ok: false, status: 503, json: async () => ({ error: govde.__hata }), text: async () => govde.__hata }
      : { ok: true, status: 200, json: async () => govde, text: async () => JSON.stringify(govde) }
  ));
}

describe('Liderlik Tablosu', () => {
  test('vaat DİLİ YOK — "kesin sonuç veya kazanç vaadi değildir" yazıyor', async () => {
    mockUclar({ leaderboard: [], me: null });
    render(<LeaderboardScreen />);
    expect(await screen.findByText(/kesin sonuç veya kazanç vaadi değildir/)).toBeTruthy();
    // Ve sıranın neye dayandığı da söyleniyor.
    expect(screen.getByText(/yalnız resmî sonuçlarla değerlendirilen tahminlerden/)).toBeTruthy();
  });

  test('veri yokken SAHTE SIRA gösterilmiyor', async () => {
    mockUclar({ leaderboard: [], me: null });
    render(<LeaderboardScreen />);
    expect(await screen.findByText('Bu hafta henüz sıralama yok')).toBeTruthy();
    expect(screen.getByText(/sahte sıra gösterilmez/)).toBeTruthy();
    // Kral kartı da çizilmemeli.
    expect(screen.queryByText(/HAFTANIN İSABET KRALI/)).toBeNull();
  });

  test('veri VARSA sıra ve isabet kralı çiziliyor (pozitif eş)', async () => {
    mockUclar({
      leaderboard: [oyuncu(1, 'ali'), oyuncu(2, 'veli'), oyuncu(3, 'ayse'), oyuncu(4, 'fatma')],
      me: null,
    });
    render(<LeaderboardScreen />);
    expect(await screen.findByText(/HAFTANIN İSABET KRALI/)).toBeTruthy();
    expect(screen.getAllByText('ali').length).toBeGreaterThan(0);
  });

  test('isabet oranı TEK BAŞINA değil, doğru/yapılan ile birlikte', async () => {
    mockUclar({ leaderboard: [oyuncu(1, 'ali', { accuracy: 60, correct: 9, made: 15 })], me: null });
    render(<LeaderboardScreen />);
    // "59 puan · %60 isabet (9/15)" — yüzde tek başına asla yeterli değil.
    expect(await screen.findByText(/%60 isabet \(9\/15\)/)).toBeTruthy();
  });

  test('sunucu hatası GİZLENMİYOR', async () => {
    mockUclar({ __hata: 'Sıralama alınamadı.' });
    render(<LeaderboardScreen />);
    expect(await screen.findByText('Sıralama alınamadı')).toBeTruthy();
  });

  test('sunucunun kendi notu varsa jenerik cümlenin YERİNE geçiyor', async () => {
    mockUclar({ leaderboard: [], me: null, note: 'Bu haftanın sonuçları henüz açıklanmadı.' });
    render(<LeaderboardScreen />);
    expect(await screen.findByText('Bu haftanın sonuçları henüz açıklanmadı.')).toBeTruthy();
    expect(screen.queryByText(/sahte sıra gösterilmez/)).toBeNull();
  });
});
