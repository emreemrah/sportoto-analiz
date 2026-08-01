// ρ (İKRAMİYE PAYI) — NET/BRÜT AYRIMI KİLİDİ.
//
// NEDEN BU DOSYA VAR: Araştırma ρ_net = %93'ü yüksek güvenle buldu ve bunu
// doğrudan `PAYOUT_RATIO`ya yazmak çok cazipti. Yazılsaydı motor sessizce
// yanlış TL üretecekti:
//
//   Kanunun %93'ü KDV DÜŞÜLMÜŞ hasılat üzerinden.
//   Oyuncunun ödediği kolon bedeli (10 TL) ise BRÜT.
//   İkisi karıştırılırsa havuz ~%19 şişer.
//
// Bu testler o ayrımı kilitler. Biri "ρ bulundu ya, artık TL üretelim" deyip
// VAT_RATE'i atlarsa kırılır.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PAYOUT_RATIO, PAYOUT_RATIO_NET, VAT_RATE,
  PAYOUT_RATIO_NET_SINCE, COLUMN_PRICE_VERIFIED,
} from '../src/ev/config.js';
import { poolsOf } from '../src/ev/engine.js';

test('ρ_net bulundu ve kanundaki üst sınırla aynı', () => {
  assert.equal(PAYOUT_RATIO_NET, 0.93, '5602 s.K. md.4/2 üst sınırı (7491 s.K. sonrası)');
  assert.equal(PAYOUT_RATIO_NET_SINCE, '2023-12-28', 'yürürlük tarihi 7491 s.K. md.64');
});

test('MEKANİZMA AMPİRİK: 2023 gerçekleşmesi o yılın sınırına birebir eşit', () => {
  // Sayıştay 2023 denetim raporu rakamları. "Üst sınır dağıtılır" kuralının
  // sayısal kanıtı budur; bu eşitlik bozulursa ρ_net varsayımı da çöker.
  const brut = 333701762275.89;
  const kdv = 53426468956.03;
  const ikramiye = 232628493455.54;
  const net = brut - kdv;
  const oran = ikramiye / net;
  // O yılın yasal üst sınırı %83 idi — üç ondalık basamağa kadar tutuyor.
  assert.ok(Math.abs(oran - 0.83) < 0.0005,
    `2023 gerçekleşen oran %83 olmalı, hesaplanan: ${(oran * 100).toFixed(3)}%`);
});

test('KDV bilinmeden ρ ÜRETİLMEZ — motor TL yerine havuz payı der', () => {
  // Kalan tek bilinmeyen. Bulunduğunda burası düşer ve aşağıdaki ölçek
  // testi anlam kazanır.
  if (VAT_RATE == null) {
    assert.equal(PAYOUT_RATIO, null,
      'KDV bilinmiyorken ρ null olmalı — brüt bedele çevrilemez');
    const { scaled } = poolsOf({ columns: 1e6, payoutRatio: PAYOUT_RATIO });
    assert.equal(scaled, false, 'ρ yokken havuz ölçeklenmemeli');
  } else {
    // KDV bulunduysa ρ TÜRETİLİR, elle yazılmaz.
    const beklenen = PAYOUT_RATIO_NET / (1 + VAT_RATE);
    assert.ok(Math.abs(PAYOUT_RATIO - beklenen) < 1e-12,
      'ρ, ρ_net ve KDV\'den türetilmeli — elle yazılmamalı');
  }
});

test('REGRESYON: ρ_net brüt bedele DOĞRUDAN uygulanmıyor', () => {
  // En tehlikeli hata: PAYOUT_RATIO = 0.93 yazmak. O zaman 1.000.000 kolon ×
  // 10 TL için havuz 9,3 milyon çıkar; oysa KDV düşülünce ~7,8 milyon olmalı.
  if (PAYOUT_RATIO == null) return;              // henüz TL üretilmiyor
  assert.ok(PAYOUT_RATIO < PAYOUT_RATIO_NET,
    'ρ (brüt) her zaman ρ_net (KDV sonrası) değerinden KÜÇÜK olmalı');
  // Şişme payı: doğrudan yazılsaydı havuz ne kadar büyük çıkardı?
  const sisme = PAYOUT_RATIO_NET / PAYOUT_RATIO - 1;
  assert.ok(sisme > 0.05,
    `KDV etkisi anlamsız derecede küçük görünüyor (%${(sisme * 100).toFixed(1)}) — KDV oranı yanlış olabilir`);
});

test('KDV oranı 2023 gerçekleşmesiyle SAYISAL olarak tutuyor', () => {
  // Spor Toto'yu adıyla anan bir tebliğ bulunamadı; %20 bir ÇIKARIMDIR
  // (şans oyunları indirimli listelerde yok → genel oran). Bu testin işi o
  // çıkarımı bağımsız bir ölçümle sınamak.
  //
  // 2023'te oran 10 Temmuz'da %18'den %20'ye geçti. KDV bedele DAHİLSE
  // KDV/brüt oranı %15,254 ile %16,667 arasında olmalı ve gerçekleşen değer
  // bu aralığın içine düşmeli. Düşmezse ya oran ya "dahil" varsayımı yanlış.
  const brut = 333701762275.89;
  const kdv = 53426468956.03;
  const gerceklesen = kdv / brut;

  const dahil18 = 0.18 / 1.18;
  const dahil20 = 0.20 / 1.20;
  assert.ok(gerceklesen > dahil18 && gerceklesen < dahil20,
    `%16,010 beklenen aralıkta değil (${(dahil18 * 100).toFixed(3)}–${(dahil20 * 100).toFixed(3)})`);

  // Ve gerekli ikinci-yarı payı MAKUL olmalı. Takvim %47,7; futbolun yaz
  // arası verdiği düşünülünce %45-65 bandı beklenir. Bandın dışına çıkarsa
  // "dahil %20" varsayımı zorlanıyor demektir.
  const ikinciYariPayi = (gerceklesen - dahil18) / (dahil20 - dahil18);
  assert.ok(ikinciYariPayi > 0.45 && ikinciYariPayi < 0.65,
    `gerekli ikinci-yarı hasılat payı makul değil: %${(ikinciYariPayi * 100).toFixed(1)}`);
});

test('ρ = ρ_net / (1 + KDV) — 0,775', () => {
  assert.equal(VAT_RATE, 0.20);
  assert.ok(Math.abs(PAYOUT_RATIO - 0.775) < 1e-12,
    `ρ 0,775 olmalı, gelen: ${PAYOUT_RATIO}`);
});

test('kolon bedeli hâlâ DOĞRULANMAMIŞ olarak işaretli', () => {
  // Araştırma 10 TL'yi teyit etti ama yalnız haber kaynağından; resmî tarife
  // belgesi bulunamadı. "Teyit edildi" demek yanlış olurdu.
  assert.equal(COLUMN_PRICE_VERIFIED, false,
    'resmî tarife belgesi bulunmadan doğrulanmış sayılmamalı');
});
