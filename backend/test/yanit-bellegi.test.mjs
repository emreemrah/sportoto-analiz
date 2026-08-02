// YANIT BELLEĞİ TESTLERİ.
//
// NEDEN VAR: bu bellek kullanıcıya GÖSTERİLEN veriyi geciktiriyor. Yanlış
// kurulursa belirtisi "eski veri ekranda kalıyor" olur ve sebebi hiç
// anlaşılmaz — hata da vermez. İki uç da tehlikeli: hiç yenilenmeyen bellek
// (donmuş ekran) ve hiç tutmayan bellek (ölçek kazancı yok, sessizce).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { yanitBellegi } from '../src/yanitBellegi.js';

/** Sabit, elle ilerletilebilir saat — gerçek zamana bağlı test yazılmaz. */
function saatKur(baslangic = 1000) {
  let t = baslangic;
  return { simdi: () => t, ilerlet: (ms) => { t += ms; } };
}

describe('yanitBellegi', () => {
  test('ilk çağrıda üretiyor, TTL içinde ÜRETMİYOR', () => {
    const s = saatKur();
    const b = yanitBellegi(5000, s.simdi);
    let sayac = 0;
    const uret = () => { sayac += 1; return `deger-${sayac}`; };

    assert.equal(b.al(uret), 'deger-1');
    assert.equal(b.al(uret), 'deger-1');
    s.ilerlet(4999);
    assert.equal(b.al(uret), 'deger-1');
    assert.equal(sayac, 1, 'TTL içinde yeniden üretilmemeliydi');
  });

  test('TTL dolunca YENİDEN üretiyor — veri sonsuza kadar donmuyor', () => {
    const s = saatKur();
    const b = yanitBellegi(5000, s.simdi);
    let sayac = 0;
    const uret = () => { sayac += 1; return sayac; };

    b.al(uret);
    s.ilerlet(5001);
    assert.equal(b.al(uret), 2);
  });

  test('ANAHTAR değişince TTL beklenmeden geçersiz', () => {
    // Bülten yenilendiğinde (updatedAt değişir) eski yanıtı 5 saniye daha
    // servis etmek yanlış olurdu.
    const s = saatKur();
    const b = yanitBellegi(60000, s.simdi);
    let sayac = 0;
    const uret = () => { sayac += 1; return sayac; };

    assert.equal(b.al(uret, 'v1'), 1);
    assert.equal(b.al(uret, 'v1'), 1);
    assert.equal(b.al(uret, 'v2'), 2, 'anahtar değişti, yeniden üretilmeliydi');
  });

  test('temizle() belleği anında düşürüyor', () => {
    const s = saatKur();
    const b = yanitBellegi(60000, s.simdi);
    let sayac = 0;
    const uret = () => { sayac += 1; return sayac; };
    b.al(uret);
    assert.equal(b.doluMu(), true);
    b.temizle();
    assert.equal(b.doluMu(), false);
    assert.equal(b.al(uret), 2);
  });

  test('null/undefined değer belleğe TAKILMIYOR — her seferinde denenir', () => {
    // Arşiv durumu hata verince null döner. Null'ı "geçerli sonuç" sayıp
    // TTL boyunca tutmak, geçici bir hatayı kalıcı veri kaybına çevirirdi.
    const s = saatKur();
    const b = yanitBellegi(60000, s.simdi);
    let sayac = 0;
    const uret = () => { sayac += 1; return sayac === 1 ? null : 'tamam'; };
    assert.equal(b.al(uret), null);
    assert.equal(b.al(uret), 'tamam', 'null bellekte tutulmamalıydı');
  });
});
