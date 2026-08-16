// MAÇ SAATİ SUNUCUNUN SAAT DİLİMİNDEN BAĞIMSIZDIR.
//
// GERÇEKTE YAŞANDI (16 Ağustos 2026, üretimde ölçüldü): resmî bülten maç
// saatini saat dilimi EKSİZ verir (`"2026-08-21T21:30:00"` = Türkiye duvar
// saati). Ham `new Date(...)` bunu SUNUCUNUN yerel saatinde yorumlar:
//
//   geliştirme (TSİ) → 18:30Z  ✅        üretim (Render, UTC) → 21:30Z  ❌
//
// Bu yüzden hata geliştirmede GÖRÜNMÜYORDU. Üretimde `/api/radar/current`
// kickoffAt'i 3 saat ileri veriyordu ve "maç başladı mı" kapısı, maç
// başladıktan sonra 3 saat daha "başlamadı" diyordu — yani OYNANAN maça
// analiz/tahmin üretilebiliyordu.
//
// Bu dosya, üretimin saat dilimini (UTC) AÇIKÇA kurarak koşar. Böylece
// geliştirme makinesinin saat dilimi hatayı bir daha gizleyemez.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const BULTEN_SAATI = '2026-08-21T21:30:00'; // 21:30 TSİ = 18:30 UTC
const DOGRU_AN = '2026-08-21T18:30:00.000Z';

/** Modülü, verilen saat diliminde AYRI bir Node süreci içinde koşturur. */
function saatDilimindeCalistir(tz, kod) {
  return execFileSync(process.execPath, ['--input-type=module', '-e', kod], {
    env: { ...process.env, TZ: tz },
    encoding: 'utf8',
  }).trim();
}

const MODUL = new URL('../src/time/turkiyeSaati.js', import.meta.url).href;

test('bültendeki duvar saati, sunucunun saat diliminden BAĞIMSIZ çözülür', () => {
  const kod = `
    const { macAniIso } = await import(${JSON.stringify(MODUL)});
    console.log(macAniIso(${JSON.stringify(BULTEN_SAATI)}));
  `;
  for (const tz of ['UTC', 'Europe/Istanbul', 'America/New_York', 'Asia/Tokyo']) {
    assert.equal(
      saatDilimindeCalistir(tz, kod),
      DOGRU_AN,
      `TZ=${tz} altında maç anı kaymış`,
    );
  }
});

test('ham new Date() bu işi YAPAMAZ — koruma gerçekten gerekli', () => {
  // Mutasyon kanıtı: yardımcı olmadan sonuç saat dilimine göre DEĞİŞİR.
  const kod = `console.log(new Date(${JSON.stringify(BULTEN_SAATI)}).toISOString());`;
  const utc = saatDilimindeCalistir('UTC', kod);
  const ist = saatDilimindeCalistir('Europe/Istanbul', kod);
  assert.notEqual(utc, ist, 'ham parse artık saat diliminden etkilenmiyorsa bu test anlamını yitirdi');
  assert.equal(ist, DOGRU_AN);
  assert.equal(utc, '2026-08-21T21:30:00.000Z'); // üretimde görülen YANLIŞ an
});

test('saat dilimi EKLİ değerlere dokunulmaz', async () => {
  const { macAniIso, macAniMs } = await import('../src/time/turkiyeSaati.js');
  assert.equal(macAniIso('2026-08-21T18:30:00.000Z'), DOGRU_AN);
  assert.equal(macAniIso('2026-08-21T21:30:00+03:00'), DOGRU_AN);
  assert.equal(macAniIso('2026-08-21T14:30:00-04:00'), DOGRU_AN);
  // Sayı (epoch ms) ve Date olduğu gibi geçer.
  const ms = Date.parse(DOGRU_AN);
  assert.equal(macAniMs(ms), ms);
  assert.equal(macAniMs(new Date(ms)), ms);
});

test('çözülemeyen değer UYDURULMAZ — null döner', async () => {
  const { macAniMs, macAniIso } = await import('../src/time/turkiyeSaati.js');
  for (const v of [null, undefined, '', '   ', 'bilinmiyor', {}, [], NaN]) {
    assert.equal(macAniMs(v), null, `${JSON.stringify(v)} için null bekleniyordu`);
    assert.equal(macAniIso(v), null);
  }
});

test('yalnız tarih verilirse Türkiye gün başlangıcı sayılır (UTC gün başı DEĞİL)', async () => {
  const { macAniIso } = await import('../src/time/turkiyeSaati.js');
  assert.equal(macAniIso('2026-08-21'), '2026-08-20T21:00:00.000Z');
});

test('BAŞLAMIŞ MAÇ KAPISI üretim saat diliminde de doğru karar verir', () => {
  // Maç 21:30 TSİ'de başlar. Saat 19:00 TSİ (16:00 UTC) iken BAŞLAMAMIŞ,
  // 22:00 TSİ (19:00 UTC) iken BAŞLAMIŞ sayılmalı. Hatalı sürümde üretim
  // ikincisine de "başlamadı" diyordu.
  const kod = `
    const { macAniMs } = await import(${JSON.stringify(MODUL)});
    const kickoff = macAniMs(${JSON.stringify(BULTEN_SAATI)});
    const basladi = (an) => (kickoff ?? Infinity) <= Date.parse(an);
    console.log(JSON.stringify([
      basladi('2026-08-21T16:00:00.000Z'),
      basladi('2026-08-21T19:00:00.000Z'),
    ]));
  `;
  for (const tz of ['UTC', 'Europe/Istanbul']) {
    assert.equal(saatDilimindeCalistir(tz, kod), '[false,true]', `TZ=${tz}`);
  }
});
