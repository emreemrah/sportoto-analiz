// GEÇMİŞ HAFTA ARMASIZ KALMAZ — mühürlü arşivden tamamlanır.
//
// ÜRETİMDE ÖLÇÜLDÜ (16 Ağustos 2026, deploy sonrası):
//   /api/history/1528 → 15 maçın 15'i ARMASIZ (Galatasaray dahil)
//   aynı uç, yerelde  → 0 eksik
//
// Sebep: arma kayıt defteri dosya önbelleğinde (`cache.js`) tutuluyor,
// Render'ın diski ise kalıcı değil — her deploy defteri siliyor. Güncel hafta
// açılış yenilemesinde armalarını yeniden topluyor, geçmiş hafta toplamıyor.
// Mühürlü arşiv kaydı armaları taşıyor ve veritabanında durduğu için
// deploy'dan etkilenmiyor.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { arsivdenTamamla } from '../src/archive/gecmisTamamlama.js';

const arsiv = [
  {
    no: 1,
    league: 'Turkey Süper Lig',
    home: { name: 'Galatasaray', logo: 'https://cdn/turkey-galatasaray.png' },
    away: { name: 'Arca Çorum FK', logo: 'https://cdn/turkey-corum.png' },
  },
  {
    no: 2,
    league: 'Spain La Liga',
    home: { name: 'Espanyol', logo: 'https://cdn/spain-espanyol.png' },
    away: { name: 'Levante', logo: 'https://cdn/spain-levante.png' },
  },
];

const resmiMac = (no, ev, dep) => ({
  no,
  league: '2026/2027 Sezonu',
  home: { name: ev },
  away: { name: dep },
});

test('armasız geçmiş maçlar arşivden tamamlanır', () => {
  const maclar = [
    resmiMac(1, 'Galatasaray', 'Arca Çorum FK'),
    resmiMac(2, 'Espanyol', 'Levante'),
  ];
  const sonuc = arsivdenTamamla(maclar, arsiv);

  assert.equal(sonuc.arma, 4);
  assert.equal(sonuc.lig, 2);
  assert.equal(maclar[0].home.logo, 'https://cdn/turkey-galatasaray.png');
  assert.equal(maclar[0].away.logo, 'https://cdn/turkey-corum.png');
  assert.equal(maclar[0].league, 'Turkey Süper Lig');
  assert.equal(maclar[1].home.logo, 'https://cdn/spain-espanyol.png');
});

test('takım adı KORUNUR — tamamlama yalnız eksik alanı doldurur', () => {
  const maclar = [resmiMac(1, 'Galatasaray', 'Arca Çorum FK')];
  arsivdenTamamla(maclar, arsiv);
  assert.equal(maclar[0].home.name, 'Galatasaray');
  assert.equal(maclar[0].away.name, 'Arca Çorum FK');
});

test('canlı yanıtta zaten olan armanın ÜSTÜNE yazılmaz', () => {
  const maclar = [resmiMac(1, 'Galatasaray', 'Arca Çorum FK')];
  maclar[0].home.logo = 'https://canli/gs.png';
  const sonuc = arsivdenTamamla(maclar, arsiv);

  assert.equal(maclar[0].home.logo, 'https://canli/gs.png', 'canlı arma ezilmiş');
  assert.equal(maclar[0].away.logo, 'https://cdn/turkey-corum.png');
  assert.equal(sonuc.arma, 1, 'yalnız eksik olan sayılmalı');
});

test('SPONSOR ÖNEKİ eşleşmeyi bozmaz (üretimde ölçülen iki maç)', () => {
  // Deploy sonrası üretimde 15 maçın 13'ü tamamlandı, 2'si atlandı: resmî
  // geçmiş bülten ile arşiv aynı takımı farklı sponsor önekiyle yazıyor.
  // Armalar arşivde VARDI; engel ham `===` karşılaştırmasıydı.
  const arsivGercek = [
    {
      no: 3,
      league: 'Turkey Süper Lig',
      home: { name: 'Konyaspor', logo: 'https://cdn/turkey-konyaspor.png' },
      away: { name: 'Ç.Rizespor', logo: 'https://cdn/turkey-rizespor.png' },
    },
    {
      no: 6,
      league: 'Turkey Süper Lig',
      home: { name: 'Rams Başakşehir', logo: 'https://cdn/turkey-basaksehir.png' },
      away: { name: 'Kocaelispor', logo: 'https://cdn/turkey-kocaelispor.png' },
    },
  ];
  const maclar = [
    resmiMac(3, 'Tümosan Konyaspor', 'Çaykur Rizespor'),
    resmiMac(6, 'İstanbul Başakşehir', 'Kocaelispor'),
  ];
  const sonuc = arsivdenTamamla(maclar, arsivGercek);

  assert.equal(sonuc.arma, 4, 'sponsor öneki yüzünden armalar yine atlandı');
  assert.equal(maclar[0].home.logo, 'https://cdn/turkey-konyaspor.png');
  assert.equal(maclar[1].home.logo, 'https://cdn/turkey-basaksehir.png');
  // Gösterilen ad RESMÎ hâliyle kalır — arşivdeki sponsor öneki ekrana taşınmaz.
  assert.equal(maclar[0].home.name, 'Tümosan Konyaspor');
  assert.equal(maclar[1].home.name, 'İstanbul Başakşehir');
});

test('gevşetme yanlış eşleşmeye kapı açmaz — iki taraf da tutmalı', () => {
  // Ev sahibi tutuyor ama deplasman TAMAMEN farklı: kayıt kullanılmamalı.
  const arsivKarisik = [{
    no: 1,
    league: 'Turkey Süper Lig',
    home: { name: 'Galatasaray', logo: 'https://cdn/gs.png' },
    away: { name: 'Fenerbahçe', logo: 'https://cdn/fb.png' },
  }];
  const maclar = [resmiMac(1, 'Galatasaray', 'Arca Çorum FK')];
  const sonuc = arsivdenTamamla(maclar, arsivKarisik);

  assert.equal(sonuc.arma, 0, 'deplasman uyuşmazken arma taşınmış');
  assert.equal(maclar[0].home.logo, undefined);
  assert.equal(maclar[0].league, '2026/2027 Sezonu');
});

test('SIRA KAYMASI: ev sahibi tutmuyorsa hiçbir şey taşınmaz', () => {
  // Yanlış maça yanlış arma yazmak, armasız bırakmaktan KÖTÜDÜR.
  const maclar = [resmiMac(1, 'Fenerbahçe', 'Beşiktaş')];
  const sonuc = arsivdenTamamla(maclar, arsiv);

  assert.equal(sonuc.arma, 0);
  assert.equal(sonuc.lig, 0);
  assert.equal(maclar[0].home.logo, undefined);
  assert.equal(maclar[0].league, '2026/2027 Sezonu', 'lig adı da değişmemeli');
});

test('arşivde olmayan maç OLDUĞU GİBİ kalır — uydurma yok', () => {
  const maclar = [resmiMac(9, 'Bilinmeyen', 'Takım')];
  const sonuc = arsivdenTamamla(maclar, arsiv);
  assert.equal(sonuc.arma, 0);
  assert.equal(maclar[0].home.logo, undefined);
});

test('arşiv boş / okunamazsa liste bozulmaz', () => {
  const maclar = [resmiMac(1, 'Galatasaray', 'Arca Çorum FK')];
  for (const bos of [[], null, undefined, 'bozuk']) {
    const sonuc = arsivdenTamamla(maclar, bos);
    assert.equal(sonuc.arma, 0);
  }
  assert.equal(maclar[0].home.name, 'Galatasaray');
  assert.equal(maclar[0].home.logo, undefined);
});

test('arşivde arma yoksa alan UYDURULMAZ', () => {
  const armasizArsiv = [{ no: 1, league: 'Turkey Süper Lig', home: { name: 'Galatasaray' }, away: { name: 'Arca Çorum FK' } }];
  const maclar = [resmiMac(1, 'Galatasaray', 'Arca Çorum FK')];
  const sonuc = arsivdenTamamla(maclar, armasizArsiv);

  assert.equal(sonuc.arma, 0);
  assert.equal(maclar[0].home.logo, undefined);
  assert.equal(sonuc.lig, 1, 'lig adı yine de taşınmalı');
});

// ——— İKİNCİ AŞAMA: arşivi olmayan haftalar için defterden arma ———
//
// Ölçüldü (yerel): 48. Hafta (1520, arşivde YOK) armasız 15/15 iken bu adımla
// 2/15'e indi; 28 arma defterden çözüldü. Kalan ikisi eşleşmenin BİLEREK
// reddi: "Malmö" defterde iki farklı kulüple eşleşiyor (Malmö FF · IFK Malmö),
// "AIK Stockholm" hiçbiriyle güvenli eşleşmiyor (AIK Fotboll · Oskarshamns AIK).

const { defterdenArmaTamamla } = await import('../src/archive/gecmisTamamlama.js');

test('ARŞİVDEN gelen arma defterle EZİLMEZ, boş olan dolar', async () => {
  const { indexRegistry } = await import('../src/crestRegistry.js');
  // Defterde İKİ takım da var; yani ezme koruması olmasa arşiv değeri
  // defterinkiyle değişirdi (mutasyonla doğrulandı).
  const idx = indexRegistry({
    version: 1,
    entries: [
      { id: 1, names: ['Sirius'], image: 'https://cdn/defter-sirius.png', seasons: [1] },
      { id: 2, names: ['Degerfors'], image: 'https://cdn/defter-degerfors.png', seasons: [1] },
    ],
  });
  const maclar = [{
    no: 1,
    home: { name: 'Sirius', logo: 'https://arsivden/sirius.png' }, // DOLU
    away: { name: 'Degerfors' },                                    // BOŞ
  }];
  const sonuc = defterdenArmaTamamla(maclar, idx);

  assert.equal(maclar[0].home.logo, 'https://arsivden/sirius.png', 'arşiv değeri ezilmiş');
  assert.equal(maclar[0].home.logoSource, undefined, 'dolu tarafa dokunulmamalı');
  assert.equal(maclar[0].away.logo, 'https://cdn/defter-degerfors.png');
  assert.equal(sonuc.arma, 1, 'yalnız boş olan sayılmalı');
});

test('defter yoksa hiçbir şey yapılmaz', () => {
  const maclar = [{ no: 1, home: { name: 'A' }, away: { name: 'B' } }];
  assert.equal(defterdenArmaTamamla(maclar, null).arma, 0);
  assert.equal(maclar[0].home.logo, undefined);
});

test('defterden dolar; BELİRSİZ eşleşmede arma UYDURULMAZ', async () => {
  const { indexRegistry } = await import('../src/crestRegistry.js');
  // Defter KENDİ verimizle kurulur — testin yerel `backend/cache/` içeriğine
  // bağlı olması onu ortama göre değişken yapardı (temiz kopyada boş defter).
  // Kurgu, üretimde ölçülen durumun birebir aynısı: "Malmö" iki farklı kulüple
  // eşleşiyor (Malmö FF · IFK Malmö) ve reddedilmeli.
  const idx = indexRegistry({
    version: 1,
    entries: [
      { id: 1, names: ['Sirius'], image: 'https://cdn/sirius.png', seasons: [1] },
      { id: 2, names: ['Malmö FF'], image: 'https://cdn/malmoff.png', seasons: [1] },
      { id: 3, names: ['IFK Malmö'], image: 'https://cdn/ifkmalmo.png', seasons: [1] },
    ],
  });
  const maclar = [
    { no: 1, home: { name: 'Sirius' }, away: { name: 'Malmö' } },
  ];
  const sonuc = defterdenArmaTamamla(maclar, idx);

  // Sirius defterde tek adayla duruyor → dolar.
  assert.ok(maclar[0].home.logo, 'tek adaylı kulüp doldurulmalı');
  assert.equal(maclar[0].home.logoSource, 'registry');
  assert.ok(String(maclar[0].home.logoMatchedBy || '').startsWith('registry-'));
  // "Malmö" iki farklı kulüple eşleşiyor → UYDURULMAZ.
  assert.equal(maclar[0].away.logo, undefined, 'belirsiz eşleşmede arma basılmış');
  assert.ok(sonuc.bulunamayan.includes('Malmö'));
});

test('bozuk girdi akışı bozmaz', () => {
  assert.equal(defterdenArmaTamamla(null, {}).arma, 0);
  assert.equal(defterdenArmaTamamla([null, undefined, {}], {}).arma, 0);
});
