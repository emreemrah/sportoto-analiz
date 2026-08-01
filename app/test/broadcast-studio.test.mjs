// YAYIN STÜDYOSU TESTLERİ — canlı yayında ekrana düşecek her sayının denetimi.
//
// Bu ekran on binlerce kişiye AÇIK görüntülenir; yayıncı maçları tek tek anlatır
// ve sonunda kupon kaydeder. Bu yüzden testlerin işi "çalışıyor mu" değil,
// ŞUNLARI KANITLAMAKTIR:
//   • Olmayan veriden sayı türetilmiyor (eksik bileşen hesaba GİRMİYOR, "eksik"
//     listesine yazılıyor; hiçbiri yoksa hasData=false).
//   • Toplam risk, hesaplanamayan satırları ortalamaya KATMIYOR ve kaç satırın
//     neden dışarıda kaldığını açıkça söylüyor.
//   • "En riskli maçlar" listesi doldurulmuyor — gerçekten riskli yoksa boş.
//   • Kolon sayısı ve seçim biçimi kupon deposundaki kuralın AYNISI (ikinci bir
//     kural yazılmadı).
//   • Maç bazlı kilit tek kaynaktan (couponConfig) geliyor.
//   • Ekrana iddialı dil ve ham etiket ("BANKO") sızmıyor.
//   • Kişisel veri (e-posta, belirteç, kullanıcı adı) satırlara giremiyor.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  STUDIO_SECTIONS, sectionByKey,
  normalizeOutcomes, toggleOutcome, breadthOf, kindOf, KIND_LABEL, symbolText,
  matchTitle, dateParts,
  uncertaintyOf, levelOf, LEVEL_LOW_MAX, LEVEL_MID_MAX,
  COVERAGE_FACTOR, COVERAGE_TEXT, rowRisk,
  buildStudioRows,
  distributionOf, columnsOf, totalRiskOf, riskiestOf, readinessOf, nextUnpicked,
  toSelections, riskCommentary, engineReadingOf,
  radarViewOf, listViewOf, statsViewOf, sectionStates, officialSymbol,
} from '../src/broadcastStudio.js';
import { columnCount, LOCK_BEFORE_MS, toOfficial } from '../src/couponConfig.js';
// Beklenen belirsizlik sayılarını testte yeniden yazmamak için motorun kendisi
// çağrılır (öneri genişliği belirsizliğin bileşenlerinden biridir).
import { analyzeUserMatch as analiz } from '../src/userMatchEngine.js';

const buDizin = dirname(fileURLToPath(import.meta.url));

const SAAT = 60 * 60 * 1000;
const NOW = Date.parse('2026-07-25T12:00:00.000Z');
const ILERI = new Date(NOW + 6 * SAAT).toISOString();   // henüz başlamadı
const GERI = new Date(NOW - 2 * SAAT).toISOString();    // başlamış → kilitli

/* ————————————————— TEST VERİSİ (yalnız testte; uygulamaya girmez) —————————————————
   Aşağıdaki üç istatistik kalıbı, analiz motorunun (userMatchEngine) ÜÇ FARKLI
   genişlikte öneri üretmesi için seçildi: tek (1), çifte (1X), kapalı (1X2).
   Öneri genişliği belirsizliğin bileşenlerinden biri olduğu için sayıların
   birebir tutması gerekiyor.                                                    */

// net = +2 (puan) +2 (ev formu) +2 (çok zayıf deplasman) = 6 → öneri "1"
const STATS_TEK = {
  home: { last5: ['G', 'G', 'G', 'B', 'G'], standing: { points: 40, position: 2, home: { wins: 6, draws: 2, losses: 1 } } },
  away: { last5: ['M', 'M', 'B', 'M', 'M'], standing: { points: 10, position: 17, away: { wins: 1, draws: 1, losses: 6 } } },
};
// net = +2 (puan) +0 (ev formu nötr) −1 (orta deplasman) = 1 → öneri "1X"
const STATS_CIFT = {
  home: { last5: ['G', 'G', 'B', 'M', 'M'], standing: { points: 30, position: 5, home: { wins: 2, draws: 1, losses: 2 } } },
  away: { last5: ['G', 'B', 'B', 'M', 'M'], standing: { points: 15, position: 14, away: { wins: 1, draws: 3, losses: 4 } } },
};
// net = +2 (puan) +0 (ev formu nötr) −2 (güçlü deplasman) = 0 + beraberlik riski → öneri "1X2"
const STATS_KAPALI = {
  home: { last5: ['G', 'G', 'B', 'M', 'M'], standing: { points: 30, position: 5, home: { wins: 2, draws: 1, losses: 2 } } },
  away: { last5: ['G', 'G', 'G', 'B', 'M'], standing: { points: 15, position: 12, away: { wins: 4, draws: 2, losses: 2 } } },
};

const mac = (no, { date = ILERI, stats = null, label = null, surprise = null, favPercent = null, probs = null } = {}) => {
  const m = { no, date, home: { mediumName: `Ev ${no}` }, away: { mediumName: `Dep ${no}` }, league: 'Test Ligi' };
  if (stats) m.stats = stats;
  if (label != null || surprise != null || favPercent != null || probs) {
    m.analysis = {
      label,
      surpriseScore: surprise,
      favorite: favPercent == null ? null : { symbol: '1', percent: favPercent },
      probabilities: probs,
    };
  }
  return m;
};

const radar = (ffr, dna, classification = null) => ({
  master: { favoriteFailureRisk: ffr, surpriseDnaScore: dna, classificationLabel: classification },
});

/* ═══════════════════════════════════════════════════════════════════════════
   1) YATAY BÖLÜM ŞERİDİ — kullanıcının istediği yedi bölüm, istediği sırada
   ═══════════════════════════════════════════════════════════════════════════ */

test('şerit tam yedi bölümdür ve sıra kanonik: liste → 5 radar → istatistik', () => {
  assert.deepEqual(
    STUDIO_SECTIONS.map((s) => s.key),
    ['liste', 'performance', 'expectation', 'publicBetting', 'market', 'bulletinMemory', 'istatistik'],
  );
});

test('radarların TAMAMI detaylı istatistikten ÖNCE gelir (ekran sırası kuralı)', () => {
  const keys = STUDIO_SECTIONS.map((s) => s.key);
  const istatistik = keys.indexOf('istatistik');
  const radarlar = STUDIO_SECTIONS.filter((s) => s.radarId).map((s) => keys.indexOf(s.key));
  assert.equal(radarlar.length, 5, 'beş radarın hepsi şeritte olmalı');
  for (const i of radarlar) assert.ok(i < istatistik, 'radar, istatistikten sonraya düşmüş');
  assert.equal(keys.indexOf('liste'), 0, 'bülten sırası (liste) en başta olmalı');
});

test('şeritteki radar kimlikleri backend RADAR_IDS ile BİREBİR aynı (uydurma kimlik yok)', () => {
  // Kimlik kayarsa ekran boş radar gösterir; bu yüzden kaynak dosyadan okunur.
  const cfg = readFileSync(join(buDizin, '..', '..', 'backend', 'src', 'radar', 'config.js'), 'utf8');
  const blok = cfg.slice(cfg.indexOf('export const RADAR_IDS'), cfg.indexOf('export const RADAR_META'));
  const backendIds = [...blok.matchAll(/:\s*'([A-Za-z]+)'/g)].map((x) => x[1]);
  assert.deepEqual(
    STUDIO_SECTIONS.filter((s) => s.radarId).map((s) => s.radarId),
    backendIds,
    'şerit radar kimlikleri backend/src/radar/config.js ile uyuşmuyor',
  );
});

test('şerit başlıkları kullanıcının saydığı bölümleri karşılar', () => {
  // NOT: "İ" harfinin küçük hâli ICU sürümüne göre değişebildiği için başlık
  // eşleşmesi büyük/küçük harften bağımsız yapılır.
  const kisa = STUDIO_SECTIONS.map((s) => s.short).join(' | ');
  for (const beklenen of ['sportoto liste', 'rakip gücü', 'xg', 'oynanma', 'oran', 'bülten sırası dna', 'statistik']) {
    assert.ok(new RegExp(beklenen, 'i').test(kisa), `şeritte eksik bölüm: ${beklenen} (${kisa})`);
  }
});

test('sectionByKey: bilinen anahtar bölümü döndürür, bilinmeyen null (uydurmaz)', () => {
  assert.equal(sectionByKey('market').radarId, 'market');
  assert.equal(sectionByKey('liste').radarId, null);
  assert.equal(sectionByKey('yok-boyle-bir-sey'), null);
  assert.equal(sectionByKey(undefined), null);
});

/* ═══════════════════════════════════════════════════════════════════════════
   2) 1-0-2 SEÇİM KUTULARI
   ═══════════════════════════════════════════════════════════════════════════ */

test('normalizeOutcomes: seçim her zaman 1 → X → 2 sırasına oturur, çöp ayıklanır', () => {
  assert.deepEqual(normalizeOutcomes(['2', '1']), ['1', '2']);
  assert.deepEqual(normalizeOutcomes(['X', '2', '1']), ['1', 'X', '2']);
  assert.deepEqual(normalizeOutcomes(['1', '1']), ['1'], 'tekrar eden işaret iki kez sayılmaz');
  assert.deepEqual(normalizeOutcomes(['3', 'Z', null]), []);
  assert.deepEqual(normalizeOutcomes(null), []);
});

test('toggleOutcome: dokunuşta ekler, tekrar dokunuşta çıkarır; sıra bozulmaz', () => {
  assert.deepEqual(toggleOutcome([], '2'), ['2']);
  assert.deepEqual(toggleOutcome(['2'], '1'), ['1', '2'], 'sonradan eklenen 1 başa geçer');
  assert.deepEqual(toggleOutcome(['1', '2'], 'X'), ['1', 'X', '2']);
  assert.deepEqual(toggleOutcome(['1', 'X', '2'], 'X'), ['1', '2']);
  assert.deepEqual(toggleOutcome(['1'], '1'), []);
});

test('kindOf / breadthOf: tek-çift-kapalı sınıflaması; seçim yoksa null', () => {
  assert.equal(kindOf([]), null);
  assert.equal(kindOf(['1']), 'tek');
  assert.equal(kindOf(['1', 'X']), 'cift');
  assert.equal(kindOf(['1', 'X', '2']), 'kapali');
  assert.equal(breadthOf(['X', '2']), 2);
  assert.deepEqual(Object.keys(KIND_LABEL).sort(), ['cift', 'kapali', 'tek']);
});

test('symbolText: veri anahtarındaki 0 ekranda X olarak görünür', () => {
  assert.equal(symbolText('0'), 'X');
  assert.equal(symbolText('1'), '1');
  assert.equal(symbolText('2'), '2');
  assert.equal(symbolText(null), '');
});

/* ═══════════════════════════════════════════════════════════════════════════
   3) SATIR BAŞLIĞI VE ZAMANI — uydurulmaz
   ═══════════════════════════════════════════════════════════════════════════ */

test('matchTitle: takım adı yoksa uydurulmaz, "bulunamadı" denir', () => {
  assert.equal(matchTitle({ home: { mediumName: 'A' }, away: { name: 'B' } }), 'A - B');
  assert.equal(matchTitle({ home: { name: 'A' } }), 'A - —');
  assert.equal(matchTitle({}), 'Maç adı bulunamadı');
  assert.equal(matchTitle(null), 'Maç adı bulunamadı');
});

test('dateParts: tarih okunamıyorsa alanlar null olur (sahte tarih üretilmez)', () => {
  assert.deepEqual(dateParts({}), { dateText: null, timeText: null, dayText: null, ms: null });
  assert.deepEqual(dateParts({ date: 'çöp' }), { dateText: null, timeText: null, dayText: null, ms: null });
  const p = dateParts({ date: ILERI });
  assert.equal(p.ms, Date.parse(ILERI));
  assert.match(p.dateText, /^\d{2}\.\d{2}\.\d{4}$/);
  assert.match(p.timeText, /^\d{2}:\d{2}$/);
  assert.ok(['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'].includes(p.dayText));
});

/* ═══════════════════════════════════════════════════════════════════════════
   4) BELİRSİZLİK — DÜRÜSTLÜĞÜN ÇEKİRDEĞİ
   ═══════════════════════════════════════════════════════════════════════════ */

test('hiçbir bileşen yoksa belirsizlik HESAPLANMAZ (hasData:false, sayı null)', () => {
  const u = uncertaintyOf(mac(1), null, null);
  assert.equal(u.hasData, false);
  assert.equal(u.score, null);
  assert.equal(u.level, null);
  assert.deepEqual(u.used, []);
  assert.equal(u.missing.length, 5, 'eksik bileşenlerin hepsi listelenmeli');
  for (const eksik of u.missing) assert.ok(eksik.label && eksik.reason, 'eksik kaynak gerekçesiz yazılmış');
});

test('belirsizlik YALNIZ var olan bileşenlerin ortalamasıdır (eksikler hesaba girmez)', () => {
  // Yalnız sürpriz puanı var: 50 → ortalama 50. Diğer dördü "eksik".
  const u = uncertaintyOf(mac(1, { surprise: 50 }), null, null);
  assert.equal(u.hasData, true);
  assert.equal(u.score, 50);
  assert.equal(u.used.length, 1);
  assert.equal(u.missing.length, 4);
  assert.deepEqual(u.used.map((x) => x.key), ['surpriz']);
});

test('beş bileşen de varken ortalama birebir tutar (düşük belirsizlik örneği)', () => {
  const m = mac(1, { stats: STATS_TEK, surprise: 12, favPercent: 78 });
  const u = uncertaintyOf(m, radar(18, 20), analiz(m));
  // öneri "1" → 10 · sürpriz 12 · favori düşüklüğü 22 · radar 18 · dna 20 = 82/5
  assert.deepEqual(u.used.map((x) => x.value), [10, 12, 22, 18, 20]);
  assert.equal(u.score, 16);
  assert.equal(u.level, 'Düşük');
  assert.deepEqual(u.missing, []);
});

test('kapalı sistem önerisi belirsizliği yükseltir (yüksek belirsizlik örneği)', () => {
  const m = mac(2, { stats: STATS_KAPALI, surprise: 70, favPercent: 38 });
  const u = uncertaintyOf(m, radar(72, 66), analiz(m));
  // öneri "1X2" → 80 · 70 · (100−38)=62 · 72 · 66 = 350/5
  assert.deepEqual(u.used.map((x) => x.value), [80, 70, 62, 72, 66]);
  assert.equal(u.score, 70);
  assert.equal(u.level, 'Yüksek');
});

test('bileşenler 0-100 aralığına sıkıştırılır (bozuk veri sayıyı taşırmaz)', () => {
  const u = uncertaintyOf(mac(1, { surprise: 999, favPercent: -50 }), radar(500, -20), null);
  for (const x of u.used) assert.ok(x.value >= 0 && x.value <= 100, `aralık dışı: ${x.key}=${x.value}`);
});

test('levelOf eşikleri tek yerdedir ve sınırlar nettir', () => {
  assert.equal(levelOf(null), null);
  assert.equal(levelOf(LEVEL_LOW_MAX - 1), 'Düşük');
  assert.equal(levelOf(LEVEL_LOW_MAX), 'Orta', 'alt sınır dahil değil');
  assert.equal(levelOf(LEVEL_MID_MAX - 1), 'Orta');
  assert.equal(levelOf(LEVEL_MID_MAX), 'Yüksek');
});

/* ═══════════════════════════════════════════════════════════════════════════
   5) SATIR RİSKİ — seçimin kapatmadığı belirsizlik
   ═══════════════════════════════════════════════════════════════════════════ */

test('kapsama katsayıları: tek 1 · çift 0.55 · kapalı 0.2 ve her birinin açıklaması var', () => {
  assert.deepEqual(COVERAGE_FACTOR, { tek: 1, cift: 0.55, kapali: 0.2 });
  for (const k of ['tek', 'cift', 'kapali']) {
    assert.ok(COVERAGE_TEXT[k] && COVERAGE_TEXT[k].length > 10, `${k} için ekranda açıklama yok`);
  }
});

test('aynı belirsizlik, seçim genişledikçe DAHA DÜŞÜK satır riski verir', () => {
  const u = { hasData: true, score: 70, level: 'Yüksek', used: [], missing: [] };
  const tek = rowRisk(u, ['1']);
  const cift = rowRisk(u, ['1', 'X']);
  const kapali = rowRisk(u, ['1', 'X', '2']);
  assert.deepEqual([tek.score, cift.score, kapali.score], [70, 39, 14]);
  assert.deepEqual([tek.level, cift.level, kapali.level], ['Yüksek', 'Orta', 'Düşük']);
  assert.equal(tek.kind, 'tek');
  assert.equal(kapali.note, COVERAGE_TEXT.kapali);
});

test('seçim yoksa veya veri yoksa satır riski HESAPLANMAZ ve nedeni yazılır', () => {
  const u = { hasData: true, score: 70, level: 'Yüksek', used: [], missing: [] };
  const secimsiz = rowRisk(u, []);
  assert.equal(secimsiz.hasData, false);
  assert.equal(secimsiz.score, null);
  assert.match(secimsiz.note, /Seçim yapılmadı/);

  const verisiz = rowRisk({ hasData: false }, ['1']);
  assert.equal(verisiz.hasData, false);
  assert.equal(verisiz.score, null);
  assert.match(verisiz.note, /bulunamadı/);
});

/* ═══════════════════════════════════════════════════════════════════════════
   6) SATIRLAR — ana bülten ekranının kaynağı
   ═══════════════════════════════════════════════════════════════════════════ */

test('buildStudioRows: her satır sıra no, tarih, saat, maç adı ve seçimi taşır', () => {
  const rows = buildStudioRows({
    matches: [mac(1, { stats: STATS_TEK, surprise: 12, favPercent: 78 }), mac(2)],
    picks: { 1: ['2', '1'] },
    radarByNo: { 1: radar(18, 20, 'Dengeli') },
    notes: { 1: 'Yayıncı notu: ev sahibi iç sahada güçlü.' },
    now: NOW,
  });
  assert.equal(rows.length, 2);
  const r = rows[0];
  assert.equal(r.no, 1);
  assert.equal(r.order, 1);
  assert.equal(r.title, 'Ev 1 - Dep 1');
  assert.match(r.dateText, /^\d{2}\.\d{2}\.\d{4}$/);
  assert.match(r.timeText, /^\d{2}:\d{2}$/);
  assert.deepEqual(r.outcomes, ['1', '2'], 'seçim kanonik sıraya oturmalı');
  assert.equal(r.kind, 'cift');
  assert.equal(r.hasPick, true);
  assert.equal(r.hasRadar, true);
  assert.equal(r.classification, 'Dengeli');
  assert.equal(r.reading.hasData, true, 'motor okuması gözlem üretmeli');
  assert.equal(r.systemMain, undefined, 'yayıncı satırında 1-0-2 önerisi TAŞINMAZ');
  assert.equal(r.note, 'Yayıncı notu: ev sahibi iç sahada güçlü.');
  assert.equal(rows[1].hasPick, false, 'seçilmemiş satır boş kalmalı — varsayılan işaret atanmaz');
  assert.equal(rows[1].hasRadar, false);
  assert.equal(rows[1].uncertainty.hasData, false);
});

test('buildStudioRows: boş/eksik girdide çökmez, boş dizi döner', () => {
  assert.deepEqual(buildStudioRows(), []);
  assert.deepEqual(buildStudioRows({}), []);
  assert.deepEqual(buildStudioRows({ matches: null }), []);
});

test('maç kilidi tek kaynaktan gelir: başlamış maç kilitli, başlamamış serbest', () => {
  const rows = buildStudioRows({ matches: [mac(1, { date: GERI }), mac(2, { date: ILERI })], now: NOW });
  assert.equal(rows[0].locked, true, 'başlamış maç kilitli olmalı');
  assert.equal(rows[1].locked, false, 'başlamamış maç kilitlenmez');
  // Kilit anı couponConfig kuralıdır: başlangıçtan LOCK_BEFORE_MS önce.
  const tamKilitAninda = buildStudioRows({
    matches: [mac(3, { date: new Date(NOW + LOCK_BEFORE_MS).toISOString() })], now: NOW,
  });
  assert.equal(tamKilitAninda[0].locked, true);
});

test('ham etiket ekrana düşmez: BANKO → GÜÇLÜ ADAY', () => {
  const rows = buildStudioRows({ matches: [mac(1, { label: 'BANKO', surprise: 10 })], now: NOW });
  assert.equal(rows[0].label, 'GÜÇLÜ ADAY');
  assert.ok(!JSON.stringify(rows).includes('BANKO'), 'ham "BANKO" etiketi satıra sızmış');
});

/* ═══════════════════════════════════════════════════════════════════════════
   7) FİNAL KUPON EKRANI
   ═══════════════════════════════════════════════════════════════════════════ */

const finalRows = (now = NOW) => buildStudioRows({
  matches: [
    mac(1, { stats: STATS_TEK, surprise: 12, favPercent: 78 }),      // belirsizlik 16
    mac(2, { stats: STATS_KAPALI, surprise: 70, favPercent: 38 }),   // belirsizlik 70
    mac(3, { stats: STATS_CIFT, surprise: 55, favPercent: 45 }),     // belirsizlik ~
    mac(4),                                                          // hiç veri yok
    mac(5, { surprise: 60 }),                                        // seçim yapılmayacak
  ],
  picks: { 1: ['1'], 2: ['1', 'X'], 3: ['1', 'X', '2'], 4: ['2'] },
  radarByNo: { 1: radar(18, 20), 2: radar(72, 66), 3: radar(50, 48) },
  now,
});

test('tek-çift-kapalı dağılımı ve boş satır sayısı doğru sayılır', () => {
  const d = distributionOf(finalRows());
  assert.deepEqual(d, { tek: 2, cift: 1, kapali: 1, bos: 1, total: 5 });
  assert.equal(d.tek + d.cift + d.kapali + d.bos, d.total, 'dağılım toplamı satır sayısını tutmalı');
});

test('kolon sayısı kupon deposundaki AYNI fonksiyondan gelir (ikinci kural yazılmadı)', () => {
  const rows = finalRows();
  // 1(tek) × 2(çift) × 3(kapalı) × 1(tek) × 1(boş sayılmaz) = 6
  assert.equal(columnsOf(rows), 6);
  assert.equal(columnsOf(rows), columnCount(toSelections(rows)), 'kolon kuralı ikiye ayrılmış');
  assert.equal(columnsOf([]), 1);
});

test('toplam risk YALNIZ hesaplanabilen satırların ortalamasıdır ve dışarıda kalanları söyler', () => {
  const t = totalRiskOf(finalRows());
  // Riski hesaplananlar: 1 (tek, 16), 2 (çift, 39), 3 (kapalı) → 4. maçın verisi yok.
  assert.equal(t.hasData, true);
  assert.equal(t.scoredCount, 3);
  assert.equal(t.noPick, 1, '5. maçta seçim yok');
  assert.equal(t.noData, 1, '4. maçta seçim var ama analiz verisi yok');
  assert.match(t.note, /3 maç üzerinden hesaplandı/);
  assert.match(t.note, /1 maçta seçim yok/);
  assert.match(t.note, /1 maçta analiz verisi yok/);
  assert.match(t.note, /ortalamaya girmedi/);
  assert.equal(t.level, levelOf(t.score));
});

test('hiç risk hesaplanamıyorsa toplam risk UYDURULMAZ (hasData:false)', () => {
  const rows = buildStudioRows({ matches: [mac(1), mac(2)], picks: { 1: ['1'] }, now: NOW });
  const t = totalRiskOf(rows);
  assert.equal(t.hasData, false);
  assert.equal(t.score, null);
  assert.equal(t.scoredCount, 0);
  assert.match(t.note, /Risk hesaplanabilecek maç yok/);
  assert.deepEqual(totalRiskOf([]).hasData, false);
});

test('en riskli maçlar: gerçekten riskli yoksa liste BOŞ döner (doldurulmaz)', () => {
  const sakin = buildStudioRows({
    matches: [mac(1, { stats: STATS_TEK, surprise: 5, favPercent: 85 })],
    picks: { 1: ['1'] },
    radarByNo: { 1: radar(8, 10) },
    now: NOW,
  });
  assert.equal(sakin[0].risk.level, 'Düşük');
  assert.deepEqual(riskiestOf(sakin), [], 'düşük riskli maç "en riskli" diye gösterilemez');
  assert.deepEqual(riskiestOf([]), []);
});

test('en riskli maçlar puana göre sıralanır, sınır aşılmaz, eşitlikte maç sırası korunur', () => {
  const rows = finalRows();
  const en = riskiestOf(rows);
  assert.ok(en.length >= 1);
  for (const r of en) assert.notEqual(r.risk.level, 'Düşük');
  for (let i = 1; i < en.length; i++) {
    assert.ok(en[i - 1].risk.score >= en[i].risk.score, 'sıralama azalan olmalı');
  }
  assert.ok(riskiestOf(rows, 1).length <= 1);
  assert.deepEqual(riskiestOf(rows, 0), []);
});

test('readinessOf: 15 maç tamamlanmadan kupon "tamam" sayılmaz', () => {
  const matches = Array.from({ length: 15 }, (_, i) => mac(i + 1));
  const picks = {};
  for (let i = 1; i <= 14; i++) picks[i] = ['1'];
  const eksik = readinessOf(buildStudioRows({ matches, picks, now: NOW }));
  assert.equal(eksik.total, 15);
  assert.equal(eksik.picked, 14);
  assert.equal(eksik.missing, 1);
  assert.deepEqual(eksik.missingNos, [15]);
  assert.equal(eksik.complete, false, '14/15 seçimle kayıt düğmesi açılmamalı');

  picks[15] = ['X', '2'];
  const tam = readinessOf(buildStudioRows({ matches, picks, now: NOW }));
  assert.equal(tam.complete, true);
  assert.deepEqual(tam.missingNos, []);
  assert.equal(tam.anyLocked, false);
  assert.equal(readinessOf([]).complete, false, 'boş bültende "tamam" denmez');
});

test('readinessOf: kilitlenen maçlar listelenir; hepsi kilitliyse hafta salt okunur', () => {
  const matches = [mac(1, { date: GERI }), mac(2, { date: GERI })];
  const r = readinessOf(buildStudioRows({ matches, now: NOW }));
  assert.deepEqual(r.lockedNos, [1, 2]);
  assert.equal(r.allLocked, true, 'hafta kilitlendi → düzenleme kapanmalı, görüntüleme kalmalı');
  assert.equal(r.anyLocked, true);
});

test('nextUnpicked: yayıncı sıradaki seçilmemiş maça geçebilir, sona gelince başa döner', () => {
  const rows = buildStudioRows({
    matches: [mac(1), mac(2), mac(3)], picks: { 1: ['1'], 3: ['2'] }, now: NOW,
  });
  assert.equal(nextUnpicked(rows).no, 2);
  assert.equal(nextUnpicked(rows, 1).no, 2);
  assert.equal(nextUnpicked(rows, 3).no, 2, 'sondan sonra baştaki eksiğe döner');
  const hepsi = buildStudioRows({ matches: [mac(1)], picks: { 1: ['1'] }, now: NOW });
  assert.equal(nextUnpicked(hepsi), null, 'eksik yoksa null');
});

test('toSelections: kupon deposunun beklediği biçim BİREBİR ({no, selectedOutcomes})', () => {
  const sel = toSelections(finalRows());
  assert.equal(sel.length, 5);
  for (const s of sel) {
    assert.deepEqual(Object.keys(s).sort(), ['no', 'selectedOutcomes'], 'kupona fazladan alan sızıyor');
    assert.equal(typeof s.no, 'number');
    assert.ok(Array.isArray(s.selectedOutcomes));
  }
  assert.deepEqual(sel[0], { no: 1, selectedOutcomes: ['1'] });
  assert.deepEqual(sel[4], { no: 5, selectedOutcomes: [] }, 'seçilmemiş maç da kupona BOŞ olarak girer');
  assert.deepEqual(toSelections([]), []);
});

/* ═══════════════════════════════════════════════════════════════════════════
   8) EKRANDAKİ CÜMLELER
   ═══════════════════════════════════════════════════════════════════════════ */

test('risk yorumu: veri yoksa sayı uydurmadığını açıkça söyler', () => {
  const rows = buildStudioRows({ matches: [mac(1)], picks: { 1: ['1'] }, now: NOW });
  const yorum = riskCommentary(rows[0]);
  assert.match(yorum, /ölçülemedi/);
  assert.match(yorum, /uydurulmaz/);
  assert.match(yorum, /risk ortalamasına katılmaz/);
  assert.equal(riskCommentary(null), '');
});

test('risk yorumu: kaç kaynaktan hesaplandığını ve hangilerinin eksik olduğunu yazar', () => {
  const rows = buildStudioRows({
    matches: [mac(1, { surprise: 50, favPercent: 40 })], picks: { 1: ['1', 'X'] }, now: NOW,
  });
  const yorum = riskCommentary(rows[0]);
  assert.match(yorum, /2 veri kaynağının ortalaması/);
  assert.match(yorum, /Hesaba girmeyen 3 kaynak var/);
  assert.ok(yorum.includes(COVERAGE_TEXT.cift), 'seçimin ne kadarını kapattığı yazılmalı');
  assert.match(yorum, /satır riski \d+\/100/);
});

test('risk yorumu: seçim yapılmadıysa satır riski hesaplanmadığını söyler', () => {
  const rows = buildStudioRows({ matches: [mac(1, { surprise: 50 })], now: NOW });
  assert.match(riskCommentary(rows[0]), /Seçim yapılmadığı için satır riski henüz hesaplanmadı/);
});

/* Yayıncı modunda motor TAHMİN VERMEZ (kullanıcı kararı).
   Aşağıdaki iki test bunun kaçak yollarını kapatır:
   - satırda öneri alanı hiç taşınmamalı (gizlemek yetmez, veri olmamalı),
   - okuma cümleleri 1-0-2'yi ima eden kalıpları içermemeli. */

// Motorun "lean" cümleleri — yayıncı modunda hiçbiri görünmemeli.
const TAHMIN_IZI = /ihtimali (?:destekleniyor|güçleniyor|zayıf)|tek 1 riskli|X doğuyor|en fazla X değerlendirilir|2 tamamen silinmez|belirgin güçleniyor|2 kolay verilmez|2 ciddi zayıf/i;

test('yayıncı satırı 1-0-2 önerisi TAŞIMAZ (alan yok, gizlenmiş değil)', () => {
  const rows = buildStudioRows({
    matches: [mac(1, { stats: STATS_CIFT }), mac(2, { stats: STATS_TEK }), mac(3, { stats: STATS_CIFT })],
    picks: { 1: ['1', 'X'], 2: ['1'], 3: ['2'] },
    now: NOW,
  });
  for (const r of rows) {
    for (const alan of ['systemMain', 'systemAlt', 'systemRisk', 'systemReason']) {
      assert.ok(!(alan in r), `öneri alanı hâlâ satırda: ${alan}`);
    }
  }
  // agreementOf kaldırıldı: karşılaştıracak öneri yok, üstelik "seçimin öneriyle
  // aynı" cümlesi öneriyi dolaylı olarak ele veriyordu. Geri gelmesin diye pinlenir.
  const kaynak = readFileSync(join(buDizin, '..', 'src', 'broadcastStudio.js'), 'utf8');
  assert.ok(!/export\s+function\s+agreementOf/.test(kaynak), 'agreementOf geri gelmiş');
});

test('engineReadingOf: yalnız gözlem verir, 1-0-2 imasını dışarıda bırakır', () => {
  const rows = buildStudioRows({
    matches: [mac(1, { stats: STATS_CIFT }), mac(2, { stats: STATS_TEK })],
    now: NOW,
  });
  const okuma = rows[0].reading;
  assert.equal(okuma.hasData, true);
  assert.ok(okuma.lines.length > 0, 'gözlem cümlesi üretilmeli');
  for (const r of rows) {
    for (const c of r.reading.lines) {
      assert.ok(!TAHMIN_IZI.test(c), `okumada tahmin cümlesi sızmış: ${c}`);
      assert.ok(!/\b(?:Öneri|Alternatif)\b/i.test(c), `okumada öneri etiketi sızmış: ${c}`);
    }
  }
  // Veri yoksa boş kutu değil, gerekçe.
  const bos = engineReadingOf(null);
  assert.equal(bos.hasData, false);
  assert.equal(bos.lines.length, 0);
  assert.match(bos.reason, /bulunamadı/);
});

/* ═══════════════════════════════════════════════════════════════════════════
   9) YAYIN GÜVENLİĞİ — dil ve kişisel veri
   ═══════════════════════════════════════════════════════════════════════════ */

const IDDIALI = /(kesin|garanti|banko|yanılmaz|net favori|kaçmaz|kazandırır|kesin kazan)/i;

test('üretilen HİÇBİR metinde iddialı dil yok', () => {
  const rows = finalRows();
  const metinler = [
    JSON.stringify(rows),
    JSON.stringify(distributionOf(rows)),
    JSON.stringify(totalRiskOf(rows)),
    JSON.stringify(riskiestOf(rows)),
    JSON.stringify(readinessOf(rows)),
    JSON.stringify(STUDIO_SECTIONS),
    ...rows.map(riskCommentary),
    ...rows.flatMap((r) => r.reading?.lines || []),
    ...Object.values(COVERAGE_TEXT),
    ...Object.values(KIND_LABEL),
  ].join(' \n ');
  const kotu = metinler.split(/\n/).filter((s) => IDDIALI.test(s));
  assert.deepEqual(kotu, [], `iddialı dil sızmış:\n${kotu.join('\n')}`);
});

test('kişisel veri satırlara GİREMEZ (yayın ekranı herkese açıktır)', () => {
  const gizli = ['gizli@ornek.com', 'BELIRTEC-XYZ', 'kullanici-adi-emrah', '+905550000000'];
  const kirli = {
    ...mac(1, { stats: STATS_TEK, surprise: 12, favPercent: 78 }),
    userEmail: gizli[0],
    token: gizli[1],
    userName: gizli[2],
    phone: gizli[3],
    otherUserCoupon: { selections: [{ no: 1, selectedOutcomes: ['2'] }] },
  };
  const rows = buildStudioRows({ matches: [kirli], picks: { 1: ['1'] }, radarByNo: { 1: radar(18, 20) }, now: NOW });
  const cikti = [JSON.stringify(rows), riskCommentary(rows[0]), ...(rows[0].reading?.lines || [])].join(' ');
  for (const s of gizli) assert.ok(!cikti.includes(s), `kişisel veri satıra sızmış: ${s}`);
  assert.ok(!cikti.includes('otherUserCoupon'), 'başka kullanıcının kuponu satıra sızmış');
});

test('modül sonuç ÜRETMEZ: hiçbir çıktı maç sonucu/skoru iddia etmez', () => {
  const kaynak = readFileSync(join(buDizin, '..', 'src', 'broadcastStudio.js'), 'utf8');
  for (const yasak of ['halfTime', 'firstHalf', 'ilkYari', 'ilk yarı']) {
    assert.ok(!kaynak.includes(yasak), `ilk yarı verisi hesaba karışmış: ${yasak}`);
  }
  const rows = finalRows();
  for (const r of rows) {
    assert.ok(!('score' in r) || r.score === undefined, 'satırda maç skoru alanı olmamalı');
    assert.ok(!('result' in r), 'satırda sonuç alanı olmamalı — sonuç yalnız resmî kaynaktan gelir');
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   9) ŞERİT BÖLÜMLERİNİN İÇERİĞİ — radarViewOf / listViewOf / statsViewOf
      Bu dört işlev EKRANIN yerine hesap yapar; ekranlar yalnız çizer.
      Burada kanıtlanan şey: eksik veri "boş" olarak değil, GEREKÇESİYLE döner.
   ═══════════════════════════════════════════════════════════════════════════ */

// Tek bir radar nesnesi — backend radar servisinin ürettiği şekil.
const rd = (over = {}) => ({
  name: 'Radar 1 · Rakip Gücü',
  hasData: true, status: 'ok',
  homeScore: 62, drawScore: 21, awayScore: 17,
  direction: 'home', dataQuality: 80, favoriteFailureRisk: 33,
  positives: ['Ev sahibi iç sahada güçlü'], negatives: ['Deplasman formda'],
  details: null, missingSignals: [], note: null,
  ...over,
});

const radarMac = (radars) => ({ no: 1, radars });

test('radarViewOf: radar kaydı YOKSA sayı üretmez, gerekçe döner', () => {
  const v = radarViewOf(null, 'performance');
  assert.equal(v.hasData, false);
  assert.equal(v.scores, null, 'kayıt yokken 1/X/2 sayısı üretilmiş');
  assert.equal(v.dataQuality, null);
  assert.equal(v.failureRisk, null);
  assert.deepEqual(v.lines, []);
  assert.ok(v.reason && v.reason.length > 0, 'gerekçe yazılmamış');
});

test('radarViewOf: hasData=false ise skorlar GİZLENİR (yarım veri sayı gibi görünmez)', () => {
  const v = radarViewOf(radarMac({ performance: rd({ hasData: false, status: 'insufficient' }) }), 'performance');
  assert.equal(v.hasData, false);
  assert.equal(v.scores, null, 'veri yetersizken skor gösterilmiş');
  assert.match(v.reason, /yetersiz/i);
});

test('radarViewOf: kaynak beklerken "veri yok" değil "kaynak bekleniyor" der', () => {
  const v = radarViewOf(radarMac({ market: rd({ hasData: false, status: 'no_source' }) }), 'market');
  assert.equal(v.hasData, false);
  assert.match(v.reason, /kayna/i);   // "kaynağı" — Türkçe yumuşama, "kaynak" aranmaz
  assert.notEqual(v.reason, radarViewOf(radarMac({ market: rd({ hasData: false, status: 'insufficient' }) }), 'market').reason,
    'kaynak beklemekle veri yetersizliği aynı cümleyle geçiştirilmiş');
});

test('radarViewOf: veri varsa skorlar KANONİK anahtarlarla döner (1 / X / 2)', () => {
  const v = radarViewOf(radarMac({ performance: rd() }), 'performance');
  assert.equal(v.hasData, true);
  // Anahtarlar KANONİKTİR (beraberlik X). Sıra JS'in nesne anahtarı sırasına
  // bırakılmaz — sayı benzeri anahtarlar ('1','2') öne geçer. Bu yüzden ekran
  // OUTCOMES üzerinden döner; burada yalnız anahtar kümesi doğrulanır.
  assert.deepEqual([...Object.keys(v.scores)].sort(), ['1', '2', 'X']);
  assert.equal(v.scores['1'], 62);
  assert.equal(v.scores.X, 21);
  assert.equal(v.scores['2'], 17);
  assert.equal(v.dataQuality, 80);
  assert.equal(v.failureRisk, 33);
});

test('radarViewOf: "unsupported" eksik sinyaller yayında TEKRAR TEKRAR yazılmaz', () => {
  const v = radarViewOf(radarMac({
    expectation: rd({
      missingSignals: [
        { label: 'Sakat/cezalı listesi', availability: 'unsupported' },
        { label: 'Son 5 maç xG', availability: 'missing' },
        { label: null, availability: 'missing' },
      ],
    }),
  }), 'expectation');
  assert.deepEqual(v.missing, ['Son 5 maç xG'], 'yapısal olarak sağlanmayan sinyal eksik diye listelenmiş');
});

test('radarViewOf: Rakip Gücü çekirdek satırları varsa ONLARI kullanır', () => {
  const v = radarViewOf(radarMac({
    performance: rd({ details: { coreLines: ['Puan farkı 25', 'İç saha serisi 6'] } }),
  }), 'performance');
  assert.deepEqual(v.lines, ['Puan farkı 25', 'İç saha serisi 6']);
});

test('radarViewOf: Oynanma DNA kutusu YALNIZ Radar 3 için doldurulur', () => {
  const dna = { userSentence: 'Halk ev sahibini oynuyor', similarDna: { hasData: false, sentence: null, note: null }, note: null };
  const uc = radarViewOf(radarMac({ publicBetting: rd({ details: { playedDna: dna } }) }), 'publicBetting');
  const bir = radarViewOf(radarMac({ performance: rd({ details: { playedDna: dna } }) }), 'performance');
  assert.deepEqual(uc.publicDna, dna);
  assert.equal(bir.publicDna, null, 'oynanma DNA kutusu başka radara sızmış');
});

test('listViewOf: sıra numarası ve saat BÜLTENDEN gelir, uydurulmaz', () => {
  const rows = buildStudioRows({ matches: [mac(7, { stats: STATS_TEK })], picks: {}, now: NOW });
  const v = listViewOf(rows[0], null);
  assert.equal(v.no, 7);
  assert.equal(v.title, rows[0].title);
  assert.equal(v.dateText, rows[0].dateText);
  assert.equal(v.timeText, rows[0].timeText);
  assert.equal(v.locked, false);
});

test('listViewOf: bülten sırası geçmişi yoksa boş bırakmaz, NEDENİNİ yazar', () => {
  const rows = buildStudioRows({ matches: [mac(1, { stats: STATS_TEK })], picks: {}, now: NOW });
  const yok = listViewOf(rows[0], radarMac({ bulletinMemory: rd({ hasData: false, status: 'insufficient' }) }));
  assert.equal(yok.positionNote, null);
  assert.ok(yok.positionReason && yok.positionReason.length > 0);

  const var_ = listViewOf(rows[0], radarMac({ bulletinMemory: rd({ positives: ['Bu sırada sürpriz sık'] }) }));
  assert.equal(var_.positionNote, 'Bu sırada sürpriz sık');
  assert.equal(var_.positionReason, null, 'veri varken gerekçe metni kalmış');
});

test('statsViewOf: istatistik yoksa hasData=false ve gerekçe döner', () => {
  const v = statsViewOf({ no: 1 });
  assert.equal(v.hasData, false);
  assert.equal(v.standing, null);
  assert.equal(v.xg, null);
  assert.equal(v.form, null);
  assert.equal(v.h2h, null);
  assert.deepEqual(v.compare, []);
  assert.ok(v.reason && v.reason.length > 0);
});

test('statsViewOf: karşılaştırma satırları backend\'in HAZIR dizisinden gelir (ikinci hesap yok)', () => {
  const compare = [
    { label: 'Maç başı gol', home: 1.8, away: 1.1, suffix: '' },
    { label: 'Kartsız veri', home: null, away: null, suffix: '' },   // iki taraf da boş → düşer
  ];
  const v = statsViewOf({ stats: { ...STATS_TEK, compare } });
  assert.equal(v.compare.length, 1, 'iki tarafı da boş satır ekrana çıkmış');
  assert.equal(v.compare[0].label, 'Maç başı gol');
  assert.equal(v.compare[0].home, 1.8, 'hazır sayı değiştirilmiş — yinelenen istatistik yasağı');
});

test('statsViewOf: xG bir ondalığa yuvarlanır, olmayan xG üretilmez', () => {
  const yok = statsViewOf({ stats: STATS_TEK });
  assert.equal(yok.xg, null, 'xG yokken kutu açılmış');

  const v = statsViewOf({
    stats: {
      home: { season: { xgFor: 1.6666, xgAgainst: 0.9412 } },
      away: { season: { xgFor: 1.2345 } },
    },
  });
  assert.equal(v.xg.homeFor, 1.7);
  assert.equal(v.xg.homeAgainst, 0.9);
  assert.equal(v.xg.awayFor, 1.2);
  assert.equal(v.xg.awayAgainst, null, 'olmayan xG sıfır/uydurma sayıya dönmüş');
});

test('statsViewOf: oynanmamış H2H sayı gibi gösterilmez', () => {
  assert.equal(statsViewOf({ stats: { h2h: { played: 0 } } }).h2h, null);
  const v = statsViewOf({ stats: { h2h: { played: 4, homeWins: 2, awayWins: 1, draws: 1 } } });
  assert.equal(v.h2h.played, 4);
  assert.equal(v.hasData, true);
});

test('statsViewOf: ilk yarı verisi hiçbir alana GİRMEZ', () => {
  const v = statsViewOf({
    stats: { ...STATS_TEK, halfTime: { home: 1, away: 0 }, compare: [{ label: 'İY gol', home: 0.7, away: 0.4 }] },
  });
  const metin = JSON.stringify(v);
  assert.ok(!metin.includes('halfTime'), 'ilk yarı alanı çıktının içine girmiş');
});

test('sectionStates: yayıncı SEKMEYE DOKUNMADAN hangisinin boş olduğunu görür', () => {
  const rows = buildStudioRows({ matches: [mac(1, { stats: STATS_TEK })], picks: {}, now: NOW });
  const durum = sectionStates(
    rows[0],
    { stats: STATS_TEK },
    radarMac({ performance: rd(), market: rd({ hasData: false, status: 'no_source' }) }),
  );
  const harita = Object.fromEntries(durum.map((s) => [s.key, s.hasData]));
  assert.equal(durum.length, STUDIO_SECTIONS.length, 'şeritteki bölüm sayısı değişmiş');
  assert.equal(harita.liste, true, 'bülten sırası her zaman gösterilebilir');
  assert.equal(harita.performance, true);
  assert.equal(harita.market, false, 'kaynağı olmayan radar dolu görünmüş');
  assert.equal(harita.expectation, false, 'kaydı olmayan radar dolu görünmüş');
  assert.equal(harita.istatistik, true);
});

test('sectionStates: hiç veri yokken tek bir bölüm bile "dolu" demez (liste hariç)', () => {
  const durum = sectionStates(null, null, null);
  for (const s of durum) {
    if (s.key === 'liste') continue;
    assert.equal(s.hasData, false, `${s.key} veri yokken dolu görünmüş`);
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   10) RESMÎ KOLON YAZIMI — ekranda 1-0-2, depoda 1-X-2
   ═══════════════════════════════════════════════════════════════════════════ */

test('officialSymbol: beraberlik ekranda 0 yazar, 1 ve 2 değişmez', () => {
  assert.equal(officialSymbol('1'), '1');
  assert.equal(officialSymbol('X'), '0');
  assert.equal(officialSymbol('2'), '2');
});

test('officialSymbol kupon modülünün eşlemesidir — İKİNCİ bir tanım yok', () => {
  assert.equal(officialSymbol, toOfficial, 'stüdyo kendi eşlemesini yazmış; ikisi ayrışabilir');
  const kaynak = readFileSync(join(buDizin, '..', 'src', 'broadcastStudio.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(
    !/['"]0['"]\s*:/.test(kaynak) && !/===\s*['"]X['"]\s*\?\s*['"]0['"]/.test(kaynak),
    'X→0 eşlemesi broadcastStudio içinde yeniden yazılmış',
  );
});

test('depoya giden değer HER ZAMAN X\'tir (ekrandaki 0 kupona sızmaz)', () => {
  const rows = buildStudioRows({
    matches: [mac(1, { stats: STATS_TEK }), mac(2, { stats: STATS_CIFT })],
    picks: { 1: ['X'], 2: ['1', 'X'] },
    now: NOW,
  });
  const sel = toSelections(rows);
  const duz = JSON.stringify(sel);
  assert.ok(duz.includes('"X"'), 'kanonik X değeri kaybolmuş');
  assert.ok(!/"0"/.test(duz), 'ekran yazımı (0) kupon verisine sızmış');
});
