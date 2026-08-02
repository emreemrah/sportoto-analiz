// LİG ŞERİDİ TESTLERİ (ana sayfa, kayan lig satırı).
//
// NEDEN VAR: şerit bültendeki ligleri gösterir. Riskli yanı, ekranda GÖRÜNEN
// bir lig listesinin gerçek bültenden sapabilmesi — yinelenen lig, kaybolan
// logo ya da bülten yokken duran boş bir çubuk. Bunların hiçbiri hata vermez,
// sessizce yanlış görünür. Testler tam bunları kilitler.
//
// Sürüm notu için bkz. ekranlar.test.jsx (RNTL 13.x kullanılır, 14.x DEĞİL).
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import LigSeridi, { ligListesi } from '../src/components/LigSeridi';

const mac = (no, league, leagueImage = null) => ({
  no, league, leagueImage,
  home: { name: `Ev ${no}` }, away: { name: `Dep ${no}` },
});

describe('ligListesi (saf çıkarım)', () => {
  test('aynı lig iki maçta geçse de BİR kez listelenir', () => {
    const r = ligListesi([
      mac(1, 'Denmark Superliga', 'dk.png'),
      mac(2, 'Denmark Superliga', 'dk.png'),
      mac(3, 'Sweden Allsvenskan', 'se.png'),
    ]);
    expect(r.map((l) => l.name)).toEqual(['Denmark Superliga', 'Sweden Allsvenskan']);
  });

  test('bültendeki ilk görülme SIRASI korunur', () => {
    const r = ligListesi([mac(1, 'B lig'), mac(2, 'A lig'), mac(3, 'B lig')]);
    expect(r.map((l) => l.name)).toEqual(['B lig', 'A lig']);
  });

  test('lig önce LOGOSUZ maçta geçse bile sonraki logolu maçtan logo alınır', () => {
    // Gerçek durum: aynı ligin bir maçı kapsam dışı kalıp logosuz gelebilir.
    // İlk kaydı esas alan naif bir çıkarım, elde olan logoyu KAYBEDERDİ.
    const r = ligListesi([
      mac(1, 'Norway Eliteserien', null),
      mac(2, 'Norway Eliteserien', 'no.png'),
    ]);
    expect(r).toEqual([{ name: 'Norway Eliteserien', image: 'no.png' }]);
  });

  test('logosu olmayan lig UYDURMA url ile doldurulmaz', () => {
    // "Kulüp Maçları" bizim kendi etiketimiz; kaynakta karşılığı yok.
    const r = ligListesi([mac(1, 'Kulüp Maçları', null)]);
    expect(r).toEqual([{ name: 'Kulüp Maçları', image: null }]);
  });

  test('ligi olmayan maç listeyi kirletmez', () => {
    expect(ligListesi([mac(1, null), mac(2, ''), mac(3, 'A lig')]))
      .toEqual([{ name: 'A lig', image: null }]);
  });

  test('maç yoksa boş liste — patlamaz', () => {
    expect(ligListesi(null)).toEqual([]);
    expect(ligListesi([])).toEqual([]);
  });
});

describe('LigSeridi (çizim)', () => {
  test('bültendeki her lig bir kez YAZILIYOR', () => {
    render(<LigSeridi matches={[
      mac(1, 'Denmark Superliga', 'dk.png'),
      mac(2, 'Denmark Superliga', 'dk.png'),
      mac(3, 'Kulüp Maçları', null),
    ]} />);
    expect(screen.getByTestId('lig-seridi')).toBeTruthy();

    // Aynı lig iki maçta geçiyor ama şeritte TEK rozet var.
    expect(screen.getAllByText('Denmark Superliga').length).toBe(1);
    expect(screen.getAllByText('Kulüp Maçları').length).toBe(1);

    // Dikişsiz döngü için ikinci bir GÖRSEL kopya çizilir; o kopya
    // erişilebilirlik ağacında YOKTUR — yoksa ekran okuyucu her ligi iki kez
    // okurdu. Gizli düğümler dahil edilince kopya ortaya çıkıyor:
    const hepsi = screen.getAllByText('Denmark Superliga', { includeHiddenElements: true });
    expect(hepsi.length).toBe(2);
  });

  test('bülten YOKKEN boş çubuk bırakmıyor — hiç çizilmiyor', () => {
    render(<LigSeridi matches={[]} />);
    expect(screen.queryByTestId('lig-seridi')).toBeNull();
  });

  test('ekran okuyucu ligleri TEK seferde okuyor', () => {
    // Şerit sürekli hareket ettiği için tek tek odaklanılabilir olması
    // kullanışsız olurdu; kapsayıcı hepsini tek etikette taşır.
    render(<LigSeridi matches={[mac(1, 'A lig', 'a.png'), mac(2, 'B lig', 'b.png')]} />);
    expect(screen.getByLabelText('Bu haftanın ligleri: A lig, B lig')).toBeTruthy();
  });
});
