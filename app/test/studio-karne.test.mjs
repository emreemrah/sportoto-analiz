// YAYIN STÜDYOSU · KARNE HESABI — dürüstlük kuralları burada kilitlenir.
//
// Karne yayında ekrana çıkan tek "başarı" sayısıdır. Bu yüzden asıl risk
// hatalı toplama değil, sayının OLDUĞUNDAN İYİ görünmesidir. Aşağıdaki testler
// tam olarak bunu engeller:
//   • Canlı/geçici skor asla "tuttu" saydırmaz — yalnız resmî sonuç sayılır.
//   • Seçim yokken tutmadı yazılmaz; sonuç yokken de tutmadı yazılmaz.
//   • Yüzdenin paydası her zaman birlikte döner (9/15 ile 9/11 karışmasın).
//   • Kapalı (1-0-2) işaretler sayıyı şişirir; kırılım ve uyarı zorunludur.
//   • İkramiye tutarı hesaplanmaz, yalnız biçimlendirilir; gelmemişse sıfır yok.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  fmtTL, fmtCount, isOfficial, officialResultOf, officialScoreOf, provisionalOf,
  pickHitsOfficial, buildKarneRows, karneSummaryOf, prizeRowsOf, hasPrize,
  cumulativeOf, KARNE_DURUM,
} from '../src/studioKarne.js';

/* ————————————————————————— yardımcı ————————————————————————— */

const mac = (no, ek = {}) => ({
  no,
  date: `2026-05-0${((no - 1) % 9) + 1}T18:00:00.000Z`,
  home: { mediumName: `Ev${no}`, logo: `https://ornek/${no}h.png` },
  away: { mediumName: `Dep${no}`, logo: null },
  league: 'Süper Lig',
  ...ek,
});
const resmi = (no, result, h, a) => mac(no, { result, score: { home: h, away: a } });

/* ═══════════════════════════════ BİÇİM ═══════════════════════════════ */

test('para ve kişi sayısı Türkçe biçimde yazılır, veri yoksa tire', () => {
  assert.equal(fmtTL(14679456.58), '₺14.679.456,58');
  assert.equal(fmtTL(599161.49), '₺599.161,49');
  assert.equal(fmtTL(0), '₺0,00');
  assert.equal(fmtTL(null), '–');
  assert.equal(fmtTL(undefined), '–');
  assert.equal(fmtTL('abc'), '–');
  assert.equal(fmtCount(2563), '2.563');
  assert.equal(fmtCount(14), '14');
  assert.equal(fmtCount(null), '–');
});

/* ═══════════════════════ RESMÎ SONUÇ AYRIMI ═══════════════════════ */

test('resmî sonuç ancak 1/X/2 VE skor birlikte gelince kesindir', () => {
  assert.equal(isOfficial(resmi(1, '1', 2, 0)), true);
  // Yalnız skor: canlı yansıma olabilir — resmî SAYILMAZ.
  assert.equal(isOfficial(mac(1, { score: { home: 2, away: 0 } })), false);
  // Yalnız sonuç harfi: skor yoksa doğrulanamaz.
  assert.equal(isOfficial(mac(1, { result: '1' })), false);
  assert.equal(isOfficial(mac(1)), false);
  assert.equal(isOfficial(null), false);
});

test('resmî olmayan maçtan sonuç TÜRETİLMEZ', () => {
  const canli = mac(1, { score: { home: 3, away: 0 }, provisional: { score: { home: 3, away: 0 }, live: true } });
  assert.equal(officialResultOf(canli), null, '3-0 skordan "1" üretilmiş — canlı skor resmî sayılamaz');
  assert.equal(officialScoreOf(canli), null);
  assert.equal(officialScoreOf(resmi(1, '2', 0, 1)), '0 - 1');
});

test('geçici skor yalnız bilgi olarak döner (canlı / bitmiş ayrımıyla)', () => {
  assert.deepEqual(
    provisionalOf(mac(1, { provisional: { score: { home: 1, away: 1 }, live: true, finished: false } })),
    { text: '1 - 1', live: true, finished: false },
  );
  assert.equal(provisionalOf(mac(1)), null);
  assert.equal(provisionalOf(mac(1, { provisional: { live: true } })), null, 'skorsuz geçici kayıt metin üretmemeli');
});

test('işaret tutma denetimi: seçim veya resmî sonuç yoksa SAYILMAZ (null)', () => {
  assert.equal(pickHitsOfficial(['1'], '1'), true);
  assert.equal(pickHitsOfficial(['1'], '2'), false);
  assert.equal(pickHitsOfficial(['1', 'X'], 'X'), true);
  assert.equal(pickHitsOfficial(['1', 'X'], '2'), false);
  assert.equal(pickHitsOfficial([], '1'), null, 'seçim yokken yanlış sayılmış');
  assert.equal(pickHitsOfficial(['1'], null), null, 'resmî sonuç yokken hüküm verilmiş');
  assert.equal(pickHitsOfficial(null, null), null);
});

/* ═══════════════════════ MAÇ MAÇ KARNE ═══════════════════════ */

test('satırlar dört durumu doğru ayırır', () => {
  const rows = buildKarneRows({
    matches: [
      resmi(1, '1', 2, 0),                                   // seçim 1 → tuttu
      resmi(2, '2', 0, 3),                                   // seçim 1 → tutmadı
      mac(3, { provisional: { score: { home: 1, away: 0 }, live: true } }), // seçim var, resmî yok
      resmi(4, 'X', 1, 1),                                   // seçim yok
    ],
    picks: { 1: ['1'], 2: ['1'], 3: ['1'], 4: [] },
  });

  assert.equal(rows[0].durum, KARNE_DURUM.tuttu);
  assert.equal(rows[0].scoreText, '2 - 0');
  assert.equal(rows[0].officialText, '1');

  assert.equal(rows[1].durum, KARNE_DURUM.tutmadi);

  assert.equal(rows[2].durum, KARNE_DURUM.bekliyor, 'canlı skor resmî sayılmış');
  assert.equal(rows[2].scoreText, null, 'resmî olmayan skor resmî alana yazılmış');
  assert.deepEqual(rows[2].provisional, { text: '1 - 0', live: true, finished: false });

  assert.equal(rows[3].durum, KARNE_DURUM.secimYok);
  assert.equal(rows[3].pickText, null);
  assert.equal(rows[3].hit, null, 'seçim yokken tutmadı sayılmış');
});

test('kısa durum etiketi tabloya sığar ama uzun metin kaybolmaz', () => {
  const rows = buildKarneRows({
    matches: [resmi(1, '1', 1, 0), resmi(2, '2', 0, 1), mac(3), resmi(4, 'X', 1, 1)],
    picks: { 1: ['1'], 2: ['1'], 3: ['1'] },
  });
  const bekleniyor = rows.find((r) => r.durum === KARNE_DURUM.bekliyor);
  // Uzun metin hücrede kırpılıyordu; kısası yazılır, tamı ekran okuyucuya gider.
  assert.equal(bekleniyor.durumKisa, 'Bekleniyor');
  assert.equal(bekleniyor.durumText, 'Resmî sonuç bekleniyor');
  for (const r of rows) {
    assert.ok(r.durumKisa && r.durumKisa.length <= 11, `durum etiketi hücreye sığmıyor: ${r.durumKisa}`);
    assert.ok(r.durumText, 'tam durum metni düşmüş');
    // Kısaltma ANLAM değiştirmemeli: kısası tam metnin ilk kelimesiyle aynı kökten.
    assert.ok(
      r.durumText.toLocaleLowerCase('tr').includes(r.durumKisa.split(' ')[0].toLocaleLowerCase('tr')),
      `kısa etiket tam metinle uyuşmuyor: ${r.durumKisa} / ${r.durumText}`,
    );
  }
});

test('beraberlik stüdyo yazımıyla "0" görünür, armalar taşınır', () => {
  const rows = buildKarneRows({ matches: [resmi(1, 'X', 1, 1)], picks: { 1: ['X'] } });
  assert.equal(rows[0].officialText, '0', 'resmî beraberlik X olarak yazılmış');
  assert.equal(rows[0].pickText, '0');
  assert.equal(rows[0].homeLogo, 'https://ornek/1h.png');
  assert.equal(rows[0].awayLogo, null, 'olmayan arma uydurulmuş');
});

test('maç listesi yoksa satır üretilmez (uydurma maç yok)', () => {
  assert.deepEqual(buildKarneRows({}), []);
  assert.deepEqual(buildKarneRows({ matches: null, picks: { 1: ['1'] } }), []);
});

/* ═══════════════════════ HAFTA ÖZETİ ═══════════════════════ */

const ornekHafta = () => buildKarneRows({
  matches: [
    resmi(1, '1', 2, 0), resmi(2, '1', 1, 0), resmi(3, 'X', 1, 1),
    resmi(4, '2', 0, 2), resmi(5, '1', 3, 1),
    mac(6), mac(7),
  ],
  picks: { 1: ['1'], 2: ['2'], 3: ['1', 'X'], 4: ['1', 'X', '2'], 5: ['1'], 6: ['1'] },
});

test('hafta özeti: payda her zaman görünür, bekleyen maç tutmadı sayılmaz', () => {
  const o = karneSummaryOf(ornekHafta());
  assert.equal(o.total, 7);
  assert.equal(o.tuttu, 4, '1, 3, 4 ve 5 numaralı maçlar tutmalı');
  assert.equal(o.tutmadi, 1);
  assert.equal(o.bekliyor, 1, '6 numaralı maçın resmî sonucu yok');
  assert.equal(o.secimYok, 1, '7 numaralı maçta seçim yok');
  assert.equal(o.sayilan, 5);
  assert.equal(o.resmiGelen, 5);
  assert.equal(o.tamamlandi, false);
  // Payda BÜLTEN boyudur: 7'de 4. "5'te 4" yazmak sayıyı olduğundan iyi gösterir.
  assert.equal(o.skorText, "7'te 4");
  assert.equal(o.yuzde, 80);
  assert.match(o.not, /5 maç üzerinden/);
  assert.match(o.not, /resmî sonucu bekleniyor/);
  assert.match(o.not, /seçim yok/);
});

test('hafta özeti genişlik kırılımı verir ve kapalı işareti açıkça uyarır', () => {
  const o = karneSummaryOf(ornekHafta());
  assert.deepEqual(o.kindKirilim.tek, { sayilan: 3, tuttu: 2 });
  assert.deepEqual(o.kindKirilim.cift, { sayilan: 1, tuttu: 1 });
  assert.deepEqual(o.kindKirilim.kapali, { sayilan: 1, tuttu: 1 });
  // Kapalı maç sonuç ne olursa olsun tutar; bu cümle olmadan sayı yanıltır.
  assert.match(o.kapaliNot, /üçü de işaretliydi/);
});

test('kapalı işaret yoksa uyarı da yazılmaz', () => {
  const o = karneSummaryOf(buildKarneRows({ matches: [resmi(1, '1', 1, 0)], picks: { 1: ['1'] } }));
  assert.equal(o.kapaliNot, null);
  assert.deepEqual(o.kindKirilim.kapali, { sayilan: 0, tuttu: 0 });
});

test('sayılacak maç yoksa yüzde UYDURULMAZ ve sebebi yazılır', () => {
  const o = karneSummaryOf(buildKarneRows({ matches: [mac(1), mac(2)], picks: { 1: ['1'] } }));
  assert.equal(o.yuzde, null, 'sayılan maç yokken yüzde üretilmiş');
  assert.equal(o.sayilan, 0);
  assert.equal(o.skorText, "2'te 0");
  assert.match(o.not, /Karne hesaplanamadı/);
});

test('boş hafta özeti çökmez', () => {
  const o = karneSummaryOf([]);
  assert.equal(o.total, 0);
  assert.equal(o.skorText, '—');
  assert.equal(o.yuzde, null);
  assert.equal(o.tamamlandi, false);
});

test('bütün maçların resmî sonucu gelince hafta tamamlanmış sayılır', () => {
  const o = karneSummaryOf(buildKarneRows({
    matches: [resmi(1, '1', 1, 0), resmi(2, '2', 0, 1)],
    picks: { 1: ['1'] },
  }));
  assert.equal(o.tamamlandi, true);
  assert.equal(o.resmiGelen, 2);
  assert.equal(o.sayilan, 1, 'seçim yapılmamış maç yüzdeye girmemeli');
});

/* ═══════════════════════ İKRAMİYE ═══════════════════════ */

test('ikramiye satırları resmî tabloyu aynen yansıtır, kimse çıkmadıysa DEVRETTİ', () => {
  const p = prizeRowsOf({
    tiers: [
      { hit: 15, count: 0, prize: 14679456.58 },
      { hit: 14, count: 14, prize: 599161.49 },
      { hit: 13, count: 231, prize: 36312.81 },
      { hit: 12, count: 2563, prize: 4091.03 },
    ],
  });
  assert.equal(p.length, 4);
  assert.equal(p[0].hitText, '15 Bilen');
  assert.equal(p[0].countText, 'Çıkmadı');
  assert.equal(p[0].prizeText, 'DEVRETTİ');
  assert.equal(p[0].devretti, true);
  assert.equal(p[1].countText, '14');
  assert.equal(p[1].prizeText, '₺599.161,49');
  assert.equal(p[3].countText, '2.563');
  assert.equal(p[3].prizeText, '₺4.091,03');
});

test('ikramiye gelmemişse satır üretilmez (sıfır TL yazılmaz)', () => {
  assert.deepEqual(prizeRowsOf(null), []);
  assert.deepEqual(prizeRowsOf({}), []);
  assert.deepEqual(prizeRowsOf({ tiers: [] }), []);
  assert.equal(hasPrize(null), false);
  assert.equal(hasPrize({ tiers: [{ hit: 15, count: 0, prize: 1 }] }), true);
});

test('eksik ikramiye alanı tire olur, sayı uydurulmaz', () => {
  const [p] = prizeRowsOf({ tiers: [{ hit: 13, count: null, prize: null }] });
  assert.equal(p.countText, '–');
  assert.equal(p.prizeText, '–');
  assert.equal(p.devretti, false, 'veri yokluğu "devretti" ile karıştırılmış');
});

/* ═══════════════════════ BİRİKİMLİ KARNE ═══════════════════════ */

const hafta = (roundId, rows) => ({ roundId, summary: karneSummaryOf(rows) });

test('birikimli karne haftaları toplar; ortalama toplam üzerinden alınır', () => {
  const h1 = hafta(1450, buildKarneRows({
    matches: [resmi(1, '1', 1, 0), resmi(2, '1', 2, 0), resmi(3, '2', 0, 1)],
    picks: { 1: ['1'], 2: ['1'], 3: ['1'] },
  })); // 2 tuttu / 3 sayılan
  const h2 = hafta(1451, buildKarneRows({
    matches: [resmi(1, 'X', 1, 1)],
    picks: { 1: ['1'] },
  })); // 0 tuttu / 1 sayılan

  const c = cumulativeOf([h1, h2]);
  assert.equal(c.hafta, 2);
  assert.equal(c.tamHafta, 2);
  assert.equal(c.tuttu, 2);
  assert.equal(c.sayilan, 4);
  // 2/4 = %50. Hafta ortalamalarının ortalaması (%66/%0 → %33) DEĞİL.
  assert.equal(c.yuzde, 50);
  assert.equal(c.ortalama, 1);
  assert.deepEqual(c.enIyi, { roundId: 1450, skorText: "3'te 2" });
  assert.match(c.not, /2 hafta · 4 maç üzerinden/);
});

test('sayılan maçı olmayan hafta "en iyi hafta" olamaz', () => {
  const bos = hafta(1460, buildKarneRows({ matches: [mac(1)], picks: { 1: ['1'] } }));
  const dolu = hafta(1461, buildKarneRows({ matches: [resmi(1, '1', 1, 0)], picks: { 1: ['1'] } }));
  const c = cumulativeOf([bos, dolu]);
  assert.equal(c.enIyi.roundId, 1461);
  assert.equal(c.bekliyor, 1);
});

test('birikimli karne kapalı işaret uyarısını kaybetmez', () => {
  const h = hafta(1470, buildKarneRows({
    matches: [resmi(1, '1', 1, 0), resmi(2, '2', 0, 1)],
    picks: { 1: ['1', 'X', '2'], 2: ['2'] },
  }));
  const c = cumulativeOf([h]);
  assert.equal(c.kapaliSayilan, 1);
  assert.match(c.kapaliNot, /üçü de işaretliydi/);
});

test('hiç hafta yoksa birikimli karne uydurmaz', () => {
  const c = cumulativeOf([]);
  assert.equal(c.hafta, 0);
  assert.equal(c.yuzde, null);
  assert.equal(c.ortalama, null);
  assert.equal(c.enIyi, null);
  assert.match(c.not, /Henüz karne oluşacak veri yok/);
  assert.equal(cumulativeOf(null).hafta, 0);
  assert.equal(cumulativeOf([{ roundId: 1 }]).hafta, 0, 'özeti olmayan hafta sayılmış');
});
