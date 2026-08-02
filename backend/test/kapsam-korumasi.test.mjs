// KAPSAM GERİLEME KORUMASI TESTLERİ.
//
// NEDEN VAR: 2 Ağustos 2026'da kaynak HTTP 429 döndü, 57 sezonun hepsi düştü
// ve DOLU bir bülten (14/15 eşleşme) TAMAMEN BOŞ bir bültenle (0/15) ezildi.
// Akış hata vermedi, durum `ok: true` kaydedildi. Kullanıcı verisiz bir
// ekranla kaldı. Bu testler o senaryoyu kilitler — ve korumanın MEŞRU
// güncellemeleri bloke etmediğini de kanıtlar (aşırı koruma da bir hatadır:
// sistem hiç güncellenemez hale gelirdi).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { eslesenSayisi, kapsamGerilemesi } from '../src/kapsamKorumasi.js';

const eslesen = (n, toplam = 15) => ({
  matches: Array.from({ length: toplam }, (_, i) => ({
    no: i + 1,
    coverage: { ok: i < n },
    footySeasonId: i < n ? 17091 : null,
  })),
});

describe('eslesenSayisi', () => {
  test('coverage.ok true olanları sayıyor', () => {
    assert.equal(eslesenSayisi(eslesen(14)), 14);
    assert.equal(eslesenSayisi(eslesen(0)), 0);
  });

  test('coverage YOKSA kaynak sezon kimliğine bakıyor (eski kayıtlar)', () => {
    const eski = { matches: [{ footySeasonId: 17091 }, { footySeasonId: null }, {}] };
    assert.equal(eslesenSayisi(eski), 1);
  });

  test('bülten yoksa sıfır — patlamıyor', () => {
    assert.equal(eslesenSayisi(null), 0);
    assert.equal(eslesenSayisi({}), 0);
    assert.equal(eslesenSayisi({ matches: 'bozuk' }), 0);
  });
});

describe('kapsamGerilemesi', () => {
  test('ÇALIŞAN veri varken TAM çöküş → YAZMA', () => {
    // Asıl olay: 14 → 0.
    assert.equal(kapsamGerilemesi(14, 0), true);
    assert.equal(kapsamGerilemesi(1, 0), true);
  });

  test('İLK kurulumda koruma devreye GİRMİYOR', () => {
    // Girseydi sistem ilk bültenini hiç yazamaz, kalıcı olarak boş kalırdı.
    // Aşırı koruma da bir hatadır.
    assert.equal(kapsamGerilemesi(0, 0), false);
    assert.equal(kapsamGerilemesi(0, 15), false);
  });

  test('KISMİ düşüş engellenmiyor — meşru olabilir', () => {
    // Yeni sezon başında bazı ligler henüz yayımlanmamış olabilir; bülten
    // kapsam dışı lig içerebilir. Eşiği yükseltmek, doğru bir düşüşü "hata"
    // sayıp güncellemeyi kalıcı bloke etme riski taşır.
    assert.equal(kapsamGerilemesi(14, 9), false);
    assert.equal(kapsamGerilemesi(15, 1), false);
  });

  test('normal güncelleme engellenmiyor', () => {
    assert.equal(kapsamGerilemesi(14, 14), false);
    assert.equal(kapsamGerilemesi(9, 14), false);
  });
});
