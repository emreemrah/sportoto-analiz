// SAĞLAYICI TEMPOSU TESTLERİ.
//
// NEDEN VAR: gözlem döngüsü 15 dakikada bir çalışıyor ve tüm kaynakları aynı
// tempoda deniyordu. Yeşil kaynak bu tempoyu kaldırmıyor — ÖLÇÜM (2 Ağustos
// 2026): temiz başlangıçta ilk istek HTTP 200 ve gerçek veri, aynı dakikada
// 10 istek 10/10 HTTP 400, 3 dakika bekleme bile açmıyor. Yani DENEMELERİN
// KENDİSİ engeli tazeliyordu ve kaynak hiç açılmıyordu.
//
// İki uç da hatalı:
//   * tempo yoksa → kaynak sürekli engelli kalır (yaşanan durum),
//   * tempo fazla uzarsa → kaynak açıkken bile veri gelmez (sessiz kayıp).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  denenebilir, durumuGuncelle, TEMPO, EN_UZUN_BEKLEME_MS,
} from '../src/providers/saglayiciTempo.js';

const T0 = 1_000_000_000_000;

describe('denenebilir', () => {
  test('temposu YAZILMAYAN kaynak her turda denenir', () => {
    // Sarı/turuncu kaynak 15 dk temposunu sorunsuz kaldırıyor; onları
    // yavaşlatmak veri kaybı olurdu.
    assert.equal(denenebilir('nesine', {}, T0), true);
    assert.equal(denenebilir('nesine', { nesine: { sonDeneme: T0 } }, T0 + 1000), true);
  });

  test('hiç denenmemiş kaynak DENENİR', () => {
    assert.equal(denenebilir('bilyoner', {}, T0), true);
  });

  test('bekleme dolmadan TEKRAR denenmez', () => {
    const d = { bilyoner: { sonDeneme: T0, ardisikHata: 0 } };
    assert.equal(denenebilir('bilyoner', d, T0 + 15 * 60e3), false, '15 dk sonra denenmemeliydi');
    assert.equal(denenebilir('bilyoner', d, T0 + 59 * 60e3), false);
  });

  test('bekleme dolunca denenir', () => {
    const d = { bilyoner: { sonDeneme: T0, ardisikHata: 0 } };
    assert.equal(denenebilir('bilyoner', d, T0 + TEMPO.bilyoner), true);
  });

  test('İLK hata beklemeyi UZATMIYOR — geçici engel yarım gün sessizlik yapmasın', () => {
    // İlk sürümde üs doğrudan hata sayısıydı ve tek bir başarısızlık
    // beklemeyi 1 saatten 2 saate çıkarıyordu. Hız sınırına takılan bir
    // kaynakta bu, geçici bir engeli saatlerce uzatıyordu.
    const bir = { bilyoner: { sonDeneme: T0, ardisikHata: 1 } };
    assert.equal(denenebilir('bilyoner', bir, T0 + TEMPO.bilyoner), true);
  });

  test('ISRARLI hatada bekleme uzuyor (geri çekilme)', () => {
    const uc = { bilyoner: { sonDeneme: T0, ardisikHata: 3 } };   // 1sa × 2² = 4sa
    assert.equal(denenebilir('bilyoner', uc, T0 + 2 * 3600e3), false);
    assert.equal(denenebilir('bilyoner', uc, T0 + 4 * 3600e3), true);
  });

  test('bekleme SINIRSIZ uzamıyor — kaynak açılırsa geri dönülür', () => {
    // Üst sınır olmasaydı 20 hatadan sonra bekleme yıllara çıkar ve kaynak
    // açıldığında sistem bunu hiç fark etmezdi.
    const cok = { bilyoner: { sonDeneme: T0, ardisikHata: 20 } };
    assert.equal(denenebilir('bilyoner', cok, T0 + EN_UZUN_BEKLEME_MS), true);
  });
});

describe('durumuGuncelle', () => {
  test('başarıda hata sayacı SIFIRLANIR', () => {
    const d = durumuGuncelle('bilyoner', { bilyoner: { ardisikHata: 5 } }, true, T0);
    assert.equal(d.bilyoner.ardisikHata, 0);
    assert.equal(d.bilyoner.sonDeneme, T0);
    assert.equal(d.bilyoner.sonBasari, T0);
  });

  test('hatada sayaç ARTAR ve son başarı korunur', () => {
    const onceki = { bilyoner: { ardisikHata: 1, sonBasari: T0 - 5000 } };
    const d = durumuGuncelle('bilyoner', onceki, false, T0);
    assert.equal(d.bilyoner.ardisikHata, 2);
    assert.equal(d.bilyoner.sonBasari, T0 - 5000, 'son başarı zamanı kaybolmamalı');
  });

  test('başka kaynakların durumu bozulmuyor', () => {
    const d = durumuGuncelle('bilyoner', { nesine: { sonDeneme: 5 } }, true, T0);
    assert.equal(d.nesine.sonDeneme, 5);
  });

  test('boş durumla çağrılabilir', () => {
    assert.equal(durumuGuncelle('bilyoner', null, false, T0).bilyoner.ardisikHata, 1);
  });
});

describe('kalıcı durum kirliliği', () => {
  // GERÇEK OLAY (2 Ağustos 2026): tempo durumu üretim cache'inde tutulduğu için
  // testlerin uydurma sağlayıcıları (testprov, bozuk, saglam, p1) oraya yazıldı.
  // Daha kötüsü: bir testin sabit tarihi (22 Temmuz), bilyoner'in GERÇEK
  // "son başarı" değeriymiş gibi kaydedildi ve durumu yanlış gösterdi.
  test('temposu OLMAYAN sağlayıcı kalıcı duruma YAZILMIYOR', () => {
    const d = durumuGuncelle('testprov', {}, true, T0);
    assert.deepEqual(d, {}, 'test sağlayıcısı üretim durumuna sızmamalı');
  });

  test('temposu olmayan kaynak mevcut durumu BOZMUYOR', () => {
    const onceki = { bilyoner: { sonDeneme: T0, ardisikHata: 0, sonBasari: T0 } };
    const d = durumuGuncelle('nesine', onceki, false, T0 + 5000);
    assert.deepEqual(d, onceki, 'başka kaynakların kaydı olduğu gibi kalmalı');
  });

  test('temposu OLAN sağlayıcı normal şekilde kaydediliyor', () => {
    // Negatifin pozitif eşi: koruma, gerçek kaydı da engellememeli.
    assert.equal(durumuGuncelle('bilyoner', {}, true, T0).bilyoner.sonDeneme, T0);
  });
});
