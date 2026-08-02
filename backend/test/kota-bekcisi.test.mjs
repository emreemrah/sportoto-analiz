// KOTA BEKÇİSİ TESTLERİ.
//
// NEDEN VAR: kota tükendiğinde TÜM sezonlar 429 alıyor ve bülten çöküyor
// (2 Ağustos 2026'da yaşandı). Bekçi, kota azalınca isteğe bağlı çağrıları
// keserek zorunlu yenilemeye yer bırakır. İki uç da tehlikeli:
//   * hiç kesmeyen bekçi → kota biter, bülten çöker,
//   * fazla kesen bekçi → canlı skor hiç güncellenmez (sessiz işlev kaybı).
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  kotayiIsle, kotaDurumu, istegeBagliYapilabilir, sifirla, REZERV,
} from '../src/sources/kotaBekcisi.js';

const yanit = (kalan, limit = 1800) => ({
  metadata: { request_remaining: String(kalan), request_limit: String(limit) },
});

describe('kotaBekcisi', () => {
  beforeEach(() => sifirla());

  test('kalan hak API yanıtından okunuyor — tahmin edilmiyor', () => {
    // Kendi saydığımız sayı, aynı anahtarı başka bir süreç de kullanıyorsa
    // yanılırdı. API'nin bildirdiği değer tek doğruluk kaynağıdır.
    kotayiIsle(yanit(1641));
    assert.equal(kotaDurumu().kalan, 1641);
    assert.equal(kotaDurumu().limit, 1800);
  });

  test('kota BOLKEN isteğe bağlı çağrılara izin veriliyor', () => {
    kotayiIsle(yanit(1641));
    assert.equal(istegeBagliYapilabilir(), true);
  });

  test('kota REZERVİN altına inince isteğe bağlı çağrılar KESİLİYOR', () => {
    kotayiIsle(yanit(REZERV));
    assert.equal(istegeBagliYapilabilir(), false);
    kotayiIsle(yanit(10));
    assert.equal(istegeBagliYapilabilir(), false);
  });

  test('rezerv sınırının hemen ÜSTÜ hâlâ serbest', () => {
    kotayiIsle(yanit(REZERV + 1));
    assert.equal(istegeBagliYapilabilir(), true);
  });

  test('rezerv bir tam yenilemeden BÜYÜK — yoksa koruma anlamsız', () => {
    // Bir tam yenileme ~130 istek (57 sezon x2 + katalog + ek aramalar).
    // Rezerv bundan küçük olsaydı, koruma devreye girdiğinde zaten yenileme
    // yapacak hak kalmamış olurdu.
    assert.ok(REZERV > 130, `rezerv çok küçük: ${REZERV}`);
  });

  test('kota BİLİNMİYORKEN izin veriliyor — bilinmezlik işlevi kapatmaz', () => {
    // İlk istek yapılmadan kalan hak bilinmez. Bu yüzden özelliği kapatmak,
    // olmayan bir sorun için gerçek bir işlevi kaybetmek olurdu.
    assert.equal(kotaDurumu().kalan, null);
    assert.equal(istegeBagliYapilabilir(), true);
  });

  test('metadata YOKSA eski değer korunuyor, sıfırlanmıyor', () => {
    // Bazı uçlar metadata döndürmeyebilir; bunu "kota bitti" saymak
    // gereksiz yere kesinti yaratırdı.
    kotayiIsle(yanit(1000));
    kotayiIsle({ data: [] });
    assert.equal(kotaDurumu().kalan, 1000);
  });

  test('bozuk metadata değeri yok sayılıyor', () => {
    kotayiIsle(yanit(1000));
    kotayiIsle({ metadata: { request_remaining: 'abc' } });
    assert.equal(kotaDurumu().kalan, 1000);
  });
});
