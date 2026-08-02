// YAKLAŞAN MAÇ BİRLEŞTİRME TESTLERİ.
//
// NEDEN VAR: Spor Toto haftaları üst üste biner. 2 Ağustos 2026'da 53. Hafta
// yayındaydı (maçları 8-9 Ağustos) ama 52. Hafta'nın 11 maçı O GÜN oynanıyordu.
// Yalnız güncel bülteni gösteren liste, kullanıcıya EN YAKIN maçları hiç
// göstermiyordu. Buradaki testler o hatayı ve onu düzeltirken ortaya çıkan üç
// yeni riski kilitler: sonucu hiç gelmeyecek maçın listeye sızması, hangi
// maçın hangi haftaya ait olduğunun kaybolması, ve iki haftanın sıra
// numaralarının çakışması.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { yaklasanMaclar, oncekiRoundId } from '../src/yaklasanMaclar.js';

const mac = (no, date, status = 'upcoming') => ({ no, date, status, home: { name: `E${no}` } });

const GUNCEL = {
  roundId: 1527, round: '53. Hafta',
  matches: [mac(1, '2026-08-09T14:00:00'), mac(2, '2026-08-08T16:00:00')],
};
const ONCEKI = {
  roundId: 1526, round: '52. Hafta',
  matches: [mac(1, '2026-08-02T15:00:00'), mac(3, '2026-08-03T18:00:00')],
};

describe('oncekiRoundId', () => {
  test('güncel haftanın BİR öncesini döner', () => {
    const r = { currentRoundId: 1527, rounds: [{ id: 1525 }, { id: 1526 }, { id: 1527 }] };
    assert.equal(oncekiRoundId(r), 1526);
  });

  test('güncel hafta İLK sıradaysa önceki yoktur — uydurulmaz', () => {
    assert.equal(oncekiRoundId({ currentRoundId: 1525, rounds: [{ id: 1525 }, { id: 1526 }] }), null);
  });

  test('güncel hafta listede yoksa null — rastgele bir hafta seçilmez', () => {
    assert.equal(oncekiRoundId({ currentRoundId: 9999, rounds: [{ id: 1 }, { id: 2 }] }), null);
  });

  test('veri yoksa patlamaz', () => {
    assert.equal(oncekiRoundId(null), null);
    assert.equal(oncekiRoundId({}), null);
  });
});

// "Şu an" SABİTLENİR. Gerçek saate bağlı bir test, günün ilerlemesiyle
// kendiliğinden kırmızıya döner ve nedeni aylar sonra anlaşılmaz.
const SIMDI = Date.parse('2026-08-01T12:00:00Z');
const opt = (o = {}) => ({ simdi: SIMDI, ...o });

describe('yaklasanMaclar', () => {
  test('önceki haftanın maçları listeye giriyor ve TARİHE göre sıralanıyor', () => {
    const r = yaklasanMaclar(GUNCEL, ONCEKI, opt());
    // 2 Ağu ve 3 Ağu (52. Hafta) 8-9 Ağustos'takilerden (53. Hafta) ÖNCE gelmeli.
    assert.deepEqual(
      r.map((m) => m.date.slice(0, 10)),
      ['2026-08-02', '2026-08-03', '2026-08-08', '2026-08-09'],
    );
  });

  test('her maç HANGİ haftaya ait olduğunu taşıyor', () => {
    const r = yaklasanMaclar(GUNCEL, ONCEKI, opt());
    assert.equal(r[0].haftaAdi, '52. Hafta');
    assert.equal(r[0].roundId, 1526);
    assert.equal(r[0].oncekiHafta, true);
    // Güncel haftanınkiler rozet TAŞIMAZ — her karta hafta yazmak gürültü olurdu.
    assert.equal(r[3].haftaAdi, '53. Hafta');
    assert.equal(r[3].oncekiHafta, false);
  });

  test('iki haftanın AYNI sıra numaralı maçları ayrı ayrı duruyor', () => {
    // Her iki bültende de 1 numaralı maç var. roundId ile ayrışmazlarsa
    // biri diğerinin üstüne yazılır ve kullanıcı bir maçı hiç görmez.
    const r = yaklasanMaclar(GUNCEL, ONCEKI, opt());
    const birNumaralilar = r.filter((m) => m.no === 1);
    assert.equal(birNumaralilar.length, 2);
    assert.deepEqual(birNumaralilar.map((m) => m.roundId).sort(), [1526, 1527]);
  });

  test('BİTMİŞ maç listeye girmiyor', () => {
    const g = { roundId: 1527, round: '53. Hafta', matches: [mac(1, '2026-08-09T14:00:00', 'finished')] };
    assert.deepEqual(yaklasanMaclar(g, null, opt()), []);
  });

  test('sonucu HİÇ gelmeyecek maç (void_no_result) listeye girmiyor', () => {
    // Ertelenmiş/iptal maç "yaklaşan" değildir; elenmezse haftalarca listede
    // kalır ve kullanıcı oynanacak sanır.
    const g = { roundId: 1527, round: '53. Hafta', matches: [mac(1, '2026-08-09T14:00:00', 'void_no_result')] };
    assert.deepEqual(yaklasanMaclar(g, null, opt()), []);
  });

  test('tarihi geçersiz maç listeye girmiyor', () => {
    const g = { roundId: 1527, round: '53. Hafta', matches: [mac(1, 'abc'), mac(2, null)] };
    assert.deepEqual(yaklasanMaclar(g, null, opt()), []);
  });

  test('önceki hafta YOKSA yalnız güncel hafta — akış bozulmuyor', () => {
    const r = yaklasanMaclar(GUNCEL, null, opt());
    assert.equal(r.length, 2);
    assert.ok(r.every((m) => m.oncekiHafta === false));
  });

  test('üst sınır uygulanıyor ama EN YAKIN maçlar korunuyor', () => {
    const cok = {
      roundId: 1527, round: '53. Hafta',
      matches: Array.from({ length: 15 }, (_, i) => mac(i + 1, `2026-08-${String(i + 10).padStart(2, '0')}T12:00:00`)),
    };
    const r = yaklasanMaclar(cok, ONCEKI, opt({ enCok: 3, enAzGuncel: 0 }));
    assert.equal(r.length, 3);
    // Kesme SIRALAMADAN SONRA olmalı: en yakın üç maç kalmalı, rastgele üçü değil.
    assert.deepEqual(r.map((m) => m.date.slice(0, 10)), ['2026-08-02', '2026-08-03', '2026-08-10']);
  });

  test('GÜNCEL haftaya her zaman yer ayrılıyor — ekrandan silinemez', () => {
    // Gerçek durum: 52. Hafta'nın 11 oynanmamış maçı, 53. Hafta'nın maçlarından
    // daha yakındı. Yalnız tarihe göre kesmek güncel bülteni ANA SAYFADAN
    // TAMAMEN siliyordu — ana sayfanın bu haftadan hiç maç göstermemesi olmaz.
    const oncekiCok = {
      roundId: 1526, round: '52. Hafta',
      matches: Array.from({ length: 11 }, (_, i) => mac(i + 1, `2026-08-02T${String(10 + i).padStart(2, '0')}:00:00Z`)),
    };
    const r = yaklasanMaclar(GUNCEL, oncekiCok, opt({ enCok: 10, enAzGuncel: 3 }));
    assert.equal(r.length, 10);
    const guncelSayisi = r.filter((m) => !m.oncekiHafta).length;
    assert.equal(guncelSayisi, 2);       // GUNCEL'de yalnız 2 maç var, ikisi de girmeli
    assert.equal(r.filter((m) => m.oncekiHafta).length, 8);
  });

  test('BAŞLAMA saati geçmiş maç listeden düşüyor (sonucu bekleniyor, yaklaşan değil)', () => {
    // 1 Ağustos'ta oynanmış ama sonucu girilmemiş maç, 2 Ağustos'ta hâlâ
    // "upcoming" görünüyordu. "Yaklaşan Maçlar"ın başına dünkü bir maçı
    // koymak kullanıcıyı yanıltır.
    const g = {
      roundId: 1527, round: '53. Hafta',
      matches: [
        mac(1, '2026-07-31T17:00:00Z'),   // bir gün önce — DÜŞMELİ
        mac(2, '2026-08-01T11:30:00Z'),   // 30 dk önce başlamış — OYNANIYOR, kalmalı
        mac(3, '2026-08-02T15:00:00Z'),   // yarın — kalmalı
      ],
    };
    const r = yaklasanMaclar(g, null, opt());
    assert.deepEqual(r.map((m) => m.no), [2, 3]);
  });
});
