// RADAR 3 — GÜNLER ARASI DEĞER TAŞIMA YOK.
// ---------------------------------------------------------------------------
// GERÇEK ŞİKÂYET (03.08.2026, aynen): "pazar günü oranları pazarteside de var
// bu yanlış düzeltirmisin"
//
// ESKİ DAVRANIŞ: Oynanma yüzdesi hücresi, o güne ait gözlem olmasa bile mühür
// anına kadarki SON gözlemi gösteriyordu. Gerekçe: "değer değişmeyince yeni
// satır yazılmaz, satırın yokluğu 'değişmedi' demektir."
//
// O GEREKÇE GEÇERSİZ: `playedPercentages.js` GÜN BAŞINA EN AZ BİR KAYIT
// garantisi verir (tekrar filtresi yalnız AYNI GÜN içinde uygulanır). Yani bir
// güne ait satır yoksa anlamı tektir: O GÜN GÖZLEM ALINAMADI. Böyle bir günde
// dünün değerini göstermek, olmayan veriyi varmış gibi göstermektir.
//
// Radar 4 (oran) bu kuralı zaten uyguluyordu; test ikisini de kilitler.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDailyPlayed, buildDailyOdds, buildDayWindow } from '../src/radar/dailyOdds.js';

// Europe/Istanbul (+03) — gün anahtarları buna göre çıkar.
const IST = (gunSaat) => new Date(`2026-08-${gunSaat}+03:00`).getTime();

// Gün penceresi, maç haftasının ÖNCESİNDEKİ Pazar–Cuma aralığıdır.
// İlk maç 09.08 (Pazar) → pencere 02.08 Pazar .. 07.08 Cuma.
const KICK = IST('09T17:00:00');
const MAC = {
  no: 1, matchId: 'm1', home: { name: 'A' }, away: { name: 'B' },
  kickoffAt: new Date(KICK).toISOString(),
};

// Pazar (02.08) gözlemi VAR, Pazartesi (03.08) gözlemi YOK.
const pazarGozlemi = (source) => ({
  matchId: 'm1', source, observedAt: new Date(IST('02T21:00:00')).toISOString(),
  playedPct: { '1': 60, X: 25, '2': 15 },
});

const cagir = (fn, gozlemler, now) => fn({
  matches: [MAC], observations: gozlemler, firstKickoffMs: KICK, now,
});

test('pazar gözlemi PAZARTESİ hücresine taşınmaz', () => {
  const now = IST('03T18:00:00');                       // pazartesi öğleden sonra
  const r = cagir(buildDailyPlayed, [pazarGozlemi('nesine')], now);
  const m = r.matches[0];

  assert.ok(m.cells['2026-08-02'], 'pazar hücresi DOLU olmalı');
  assert.equal(m.cells['2026-08-03'], null, 'pazartesi hücresi BOŞ olmalı — taşıma yok');
});

test('boş pazartesi hücresi SEBEBİYLE gelir (sessiz boşluk değil)', () => {
  const now = IST('03T18:00:00');
  const m = cagir(buildDailyPlayed, [pazarGozlemi('nesine')], now).matches[0];
  const not = m.notes?.['2026-08-03'];
  assert.ok(not, 'pazartesi için sebep yazılmalı');
  assert.ok(not.code && not.text, `sebep kodu ve metni olmalı: ${JSON.stringify(not)}`);
});

test('o güne ait gözlem VARSA hücre dolu ve kendi değerini gösterir', () => {
  const now = IST('03T18:00:00');
  const pazartesi = {
    matchId: 'm1', source: 'nesine', observedAt: new Date(IST('03T09:00:00')).toISOString(),
    playedPct: { '1': 40, X: 30, '2': 30 },
  };
  const m = cagir(buildDailyPlayed, [pazarGozlemi('nesine'), pazartesi], now).matches[0];
  assert.deepEqual(m.cells['2026-08-02'].bySource.nesine.percentages, { '1': 60, X: 25, '2': 15 });
  assert.deepEqual(m.cells['2026-08-03'].bySource.nesine.percentages, { '1': 40, X: 30, '2': 30 },
    'pazartesi KENDİ değerini göstermeli, pazarınkini değil');
});

test('aynı gün birden çok gözlemde SONUNCUSU geçerlidir', () => {
  const now = IST('03T18:00:00');
  const sabah = { matchId: 'm1', source: 'nesine', observedAt: new Date(IST('03T08:00:00')).toISOString(), playedPct: { '1': 50, X: 30, '2': 20 } };
  const aksam = { matchId: 'm1', source: 'nesine', observedAt: new Date(IST('03T17:00:00')).toISOString(), playedPct: { '1': 44, X: 31, '2': 25 } };
  const m = cagir(buildDailyPlayed, [sabah, aksam], now).matches[0];
  assert.deepEqual(m.cells['2026-08-03'].bySource.nesine.percentages, { '1': 44, X: 31, '2': 25 });
});

test('kaynaklar birbirine karışmaz — biri o gün yazmadıysa yalnız o boş kalır', () => {
  const now = IST('03T18:00:00');
  const misliPazartesi = {
    matchId: 'm1', source: 'misli', observedAt: new Date(IST('03T10:00:00')).toISOString(),
    playedPct: { '1': 35, X: 33, '2': 32 },
  };
  // nesine yalnız pazar yazmış, misli pazartesi yazmış.
  const m = cagir(buildDailyPlayed, [pazarGozlemi('nesine'), misliPazartesi], now).matches[0];
  const pzt = m.cells['2026-08-03'].bySource;
  assert.ok(pzt.misli, 'misli pazartesi dolu');
  assert.equal(pzt.nesine, undefined, 'nesine pazartesi YOK — pazarından taşınmamalı');
});

test('Radar 4 (oran) de taşımıyor — iki radar aynı kuralda', () => {
  const now = IST('03T18:00:00');
  const pazarOran = {
    matchId: 'm1', source: 'refresh', observedAt: new Date(IST('02T21:00:00')).toISOString(),
    odds: { home: 1.75, draw: 3.6, away: 4.2 },
  };
  const m = cagir(buildDailyOdds, [pazarOran], now).matches[0];
  assert.ok(m.cells['2026-08-02'], 'pazar dolu');
  assert.equal(m.cells['2026-08-03'], null, 'pazartesi boş');
});

// ---------------------------------------------------------------------------
// CUMARTESİ PENCEREYE GİRİYOR MU (2026-08-07, kullanıcı bildirimi)
// ---------------------------------------------------------------------------
// "Nadir de olsa Cuma günü maç olmadığında kapanış Cumartesi'ye kayıyor."
// Pencere Cuma'da bitiyordu; o haftalarda kapanış günü ekranda HİÇ görünmüyor,
// veri arşivde durup görünmez oluyordu.
//
// Kural: çıpa Cuma'sının ertesi Cumartesi'si İLK MAÇ GÜNÜNÜ geçmiyorsa
// pencereye eklenir. Maçtan sonraki gün ASLA eklenmez.
test('gün penceresi: ilk maç Pazar ise Cumartesi de pencerede olur', () => {
  const g = buildDayWindow({ firstKickoffMs: new Date('2026-08-09T18:00:00+03:00').getTime() });
  assert.equal(g.length, 7);
  assert.equal(g[0], '2026-08-02', 'Pazar başlangıcı korunmalı');
  assert.equal(g[g.length - 1], '2026-08-08', 'kapanış Cumartesi görünmeli');
});

test('gün penceresi: ilk maç Cumartesi ise o gün pencerede', () => {
  const g = buildDayWindow({ firstKickoffMs: new Date('2026-08-08T16:00:00+03:00').getTime() });
  assert.equal(g[g.length - 1], '2026-08-08');
});

// GERİLEME KORUMASI: normal (Cuma başlangıçlı) haftalarda davranış DEĞİŞMEZ.
test('gün penceresi: ilk maç Cuma ise Cumartesi EKLENMEZ (maç sonrası gün yok)', () => {
  const g = buildDayWindow({ firstKickoffMs: new Date('2026-08-07T21:00:00+03:00').getTime() });
  assert.equal(g.length, 6);
  assert.equal(g[g.length - 1], '2026-08-07');
});

// ERKEN YAYIN (29 Ağu 2026): 4. Hafta Cumartesi yayınlandı, ilk maç bir sonraki
// Cumartesi. Pencere Pazar'dan başlayınca yayın günü (Cumartesi) dışarıda
// kalıyordu. Gözlem varsa o güne kadar geri açılır; yoksa pencere DEĞİŞMEZ.
test('gün penceresi: pencereden önceki gözlem günü pencereye eklenir (en çok 7)', () => {
  const ilkMac = new Date('2026-09-05T17:00:00+03:00').getTime();
  const normal = buildDayWindow({ firstKickoffMs: ilkMac });
  assert.equal(normal[0], '2026-08-30', 'Pazar başlangıcı');
  const erken = buildDayWindow({ firstKickoffMs: ilkMac, enErkenGun: '2026-08-29' });
  assert.equal(erken[0], '2026-08-29', 'yayın günü Cumartesi pencereye girer');
  assert.deepEqual(erken.slice(1), normal, 'kalan günler aynı');
  // Pencere içindeki gözlem hiçbir şeyi değiştirmez.
  assert.deepEqual(buildDayWindow({ firstKickoffMs: ilkMac, enErkenGun: '2026-09-01' }), normal);
  // Çok eski (yanlış tarihli) tek kayıt şeridi 7 günden fazla uzatamaz.
  assert.equal(buildDayWindow({ firstKickoffMs: ilkMac, enErkenGun: '2026-07-01' }).length, normal.length + 7);
});
