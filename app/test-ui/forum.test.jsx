// FORUM (STADYUM) RENDER TESTLERİ.
//
// NEDEN VAR: Bu ekran HENÜZ BOŞ — topluluk arka ucu bağlı değil. Boş bir
// ekranın en büyük riski, dolu görünmeye çalışmasıdır: uydurma sayaçlar,
// çalışmayan düğmeler, "örnek" gönderiler.
//
// Test yazarken BİR gerçek kusur bulundu: oda kartları TouchableOpacity idi,
// dokunulunca sönüp geri geliyor ama hiçbir şey olmuyordu. Çalışmayan bir
// şeyi düğme gibi göstermek kullanıcıya "sen yanlış yaptın" hissi verir.
// Düz karta çevrildi ve durum açıkça yazıldı.
//
// ⚠ İKİNCİ BİR KUSUR DAHA BULDUĞUMU SANDIM, YANILDIM: başlıktaki "4 Oda"
// sayısının yanlış olduğunu düşündüm, çünkü kaynağı sayarken kullandığım
// regex subtitle satırlarını da saydı ve 8 gördü. Gerçekte 4 oda var, sayı
// DOĞRUYDU. Sayaç yine de listeden türetildi (elle yazılı kalmasın diye)
// ama bu bir hata düzeltmesi DEĞİL.
// Ders: bir sayının yanlış olduğunu iddia etmeden önce ölçümün kendisini
// doğrula — yanlış ölçüm, olmayan bir hataya "düzeltme" yazdırır.
//
// Sürüm notu için bkz. ekranlar.test.jsx (RNTL 13.x kullanılır, 14.x DEĞİL).
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import ForumScreen from '../src/screens/ForumScreen';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useFocusEffect: (cb) => { const R = require('react'); R.useEffect(cb, [cb]); },
}));

const ODA_BASLIKLARI = [
  'Bülten Sohbeti', 'Analiz Odası', 'Sürpriz Radarı', 'Tahmin Listesi Fikirleri',
];

describe('Forum (Stadyum)', () => {
  test('ekran çiziliyor', () => {
    render(<ForumScreen />);
    expect(screen.getByText('Tribün burada konuşuyor')).toBeTruthy();
  });

  test('oda sayacı LİSTEDEN türüyor (elle yazılı değil)', () => {
    render(<ForumScreen />);
    // Sayaç ile gerçekten çizilen kart sayısı AYNI olmalı. Sabit yazılırsa
    // ileride oda eklenince sessizce yanlışa düşer.
    for (const b of ODA_BASLIKLARI) expect(screen.getByText(b)).toBeTruthy();
    expect(screen.getByText(String(ODA_BASLIKLARI.length))).toBeTruthy();
    expect(screen.getByText('Oda')).toBeTruthy();
  });

  test('topluluk verisi yokken UYDURMA gönderi gösterilmiyor', () => {
    render(<ForumScreen />);
    expect(screen.getByText('Henüz topluluk yorumu bulunmuyor')).toBeTruthy();
    expect(screen.getByText(/backend'e bağlanınca burada görünecek/)).toBeTruthy();
  });

  test('yorum/beğeni sayaçları SIFIR değil "—" gösteriyor', () => {
    render(<ForumScreen />);
    // Bilinmeyen sayı 0 diye yazılırsa "hiç yorum yok" gibi okunur; oysa
    // doğru ifade "henüz ölçmüyoruz".
    expect(screen.getByText('Yorum')).toBeTruthy();
    expect(screen.getByText('Beğeni')).toBeTruthy();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('0')).toBeNull();
  });

  test('çalışmayan odalar DÜĞME gibi sunulmuyor ve durumu yazıyor', () => {
    render(<ForumScreen />);
    expect(screen.getByText(/Odalar henüz açılmadı/)).toBeTruthy();
    // Oda başlıkları basılabilir bir kabın içinde olmamalı.
    const dugmeler = screen.queryAllByRole('button');
    const dugmeMetni = JSON.stringify(dugmeler.map((d) => d.props?.children ?? ''));
    for (const b of ODA_BASLIKLARI) {
      expect(dugmeMetni).not.toContain(b);
    }
  });
});
