// YAYIN MODU TESTLERİ — canlı yayında ekrana yansıyacak slaytların denetimi.
//
// Bu ekran on binlerce kişiye AÇIK görüntülenir. Bu yüzden testlerin asıl işi
// güzel görünmesini değil, ŞUNLARI kanıtlamaktır:
//   • aday uydurulmuyor (veri yoksa slayt yok),
//   • başlamış maç aday diye gösterilmiyor,
//   • iddialı dil ve ham etiket sızmıyor,
//   • kişisel veri (ad, e-posta, belirteç, kupon, puan) slayta giremiyor.
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildBroadcastSlides, clampIndex, SCALES, DEFAULT_SCALE_INDEX } from '../src/broadcast.js';
import { topProbability, buildWeekSummary, BALANCED_MAX_PERCENT } from '../src/weekSummary.js';
import { NO_GUARANTEE_NOTICE, OFFICIAL_RESULT_NOTICE } from '../src/brand.js';

const NOW = Date.parse('2026-07-25T12:00:00.000Z');
const ILERI = new Date(NOW + 3 * 3600000).toISOString();   // henüz başlamadı
const GERI = new Date(NOW - 3 * 3600000).toISOString();    // başlamış

/** Test maçı üretici — yalnız testte kullanılır, uygulamaya girmez. */
const m = (no, { label = 'DİKKAT', fav = null, surprise = null, probs = null, date = ILERI } = {}) => ({
  no,
  date,
  home: { name: `Ev ${no}` },
  away: { name: `Dep ${no}` },
  analysis: { label, favorite: fav, surpriseScore: surprise, probabilities: probs },
});

const guclu = (no, percent, symbol = '1') =>
  m(no, { label: 'BANKO', fav: { symbol, percent }, surprise: 10, probs: { 1: percent, 0: 20, 2: 100 - percent - 20 } });

const surprizli = (no, score, percent = 38) =>
  m(no, { label: 'SÜRPRİZE AÇIK', fav: { symbol: '1', percent }, surprise: score, probs: { 1: percent, 0: 33, 2: 100 - percent - 33 } });

const denk = (no) => m(no, { probs: { 1: 40, 0: 32, 2: 28 } });

/** Slaytlardaki TÜM metni tek dizgeye indirger (sızıntı taraması için). */
const tumMetin = (slides) => JSON.stringify(slides);

const bul = (slides, key) => slides.find((s) => s.key === key);

// ——————————————————— DÜRÜSTLÜK ———————————————————

test('analizli maç yoksa hiç slayt üretilmez (boş dizi dürüst sonuçtur)', () => {
  assert.deepEqual(buildBroadcastSlides(null, { now: NOW }), []);
  assert.deepEqual(buildBroadcastSlides({}, { now: NOW }), []);
  assert.deepEqual(buildBroadcastSlides({ matches: [] }, { now: NOW }), []);
  // Maç var ama analiz yok → yine slayt yok; boş kutu doldurulmaz.
  assert.deepEqual(
    buildBroadcastSlides({ matches: [{ no: 1, home: { name: 'A' }, away: { name: 'B' } }] }, { now: NOW }),
    [],
  );
});

test('güçlü aday yoksa slayt durur ama liste UYDURULMAZ', () => {
  const slides = buildBroadcastSlides({ matches: [denk(1), denk(2)] }, { now: NOW });
  const s = bul(slides, 'strong');
  assert.ok(s, 'güçlü aday slaytı yayında yine anlatılır');
  assert.deepEqual(s.rows, [], 'satır uydurulmamalı');
  assert.match(s.title, /güçlü aday çıkmadı/i);
  assert.ok(s.emptyText && s.emptyText.length > 10, 'dürüst boş açıklama olmalı');
});

test('başlamış maç yayın slaytında aday gösterilmez', () => {
  const slides = buildBroadcastSlides({
    matches: [guclu(1, 72, '1'), { ...guclu(2, 88, '2'), date: GERI }],
  }, { now: NOW });

  const s = bul(slides, 'strong');
  assert.deepEqual(s.rows.map((r) => r.no), [1], 'yalnız başlamamış maç aday');
  assert.match(s.note, /1 maç başladığı için/);
  // Başlamış maç toplam sayıya girer (gerçektir) ama aday sayılmaz.
  assert.equal(bul(slides, 'intro').stats[0].n, 2);
  assert.equal(bul(slides, 'intro').stats[1].n, 1);
});

test('denk güç slaytı yalnız gerçekten denk maç varsa eklenir', () => {
  const yok = buildBroadcastSlides({ matches: [guclu(1, 72)] }, { now: NOW });
  assert.equal(bul(yok, 'balanced'), undefined, 'sıfır satırlık slayt yayında ölü zamandır');

  const var_ = buildBroadcastSlides({ matches: [denk(1), denk(2), guclu(3, 72)] }, { now: NOW });
  const b = bul(var_, 'balanced');
  assert.ok(b);
  assert.equal(b.rows.length, 2);
  assert.match(b.title, /^2 maçta/);
});

test('açılıştaki sayılar tek kaynaktan gelir — slaytta yeniden sayılmaz', () => {
  const matches = [guclu(1, 72), surprizli(2, 61), denk(3), denk(4), { ...guclu(5, 80), date: GERI }];
  const bulletin = { matches };
  const sum = buildWeekSummary(matches, { now: NOW });
  const stats = bul(buildBroadcastSlides(bulletin, { now: NOW }), 'intro').stats;

  assert.equal(stats[0].n, sum.total);
  assert.equal(stats[1].n, sum.strong.length);
  assert.equal(stats[2].n, sum.surprises.length);
  assert.equal(stats[3].n, sum.balanced);
  // Aynı sayı iki farklı yerde farklı çıkmamalı.
  assert.equal(sum.balanced, sum.balancedMatches.length);
});

test('denk güç eşiği tek yerde tanımlı ve topProbability ile tutarlı', () => {
  assert.equal(topProbability(denk(1)), 40);
  assert.equal(topProbability(m(2, { probs: { 1: 55, 0: 25, 2: 20 } })), 55);
  assert.equal(topProbability(m(3, {})), null, 'ihtimal yoksa sayı uydurulmaz');
  assert.equal(topProbability(m(4, { probs: { 1: 90 } })), null, 'tek değerle denk kararı verilmez');
  assert.equal(topProbability(null), null);
  assert.ok(BALANCED_MAX_PERCENT > 33 && BALANCED_MAX_PERCENT <= 50);
});

// ——————————————————— DİL ———————————————————

test('hiçbir slaytta iddialı dil yok', () => {
  const slides = buildBroadcastSlides({
    weekNumber: 32, season: '2025-2026', difficulty: { level: 'Zor', score: 68, text: 'Bu hafta oldukça çekişmeli.' },
    matches: [guclu(1, 88), guclu(2, 74), surprizli(3, 71), denk(4)],
  }, { now: NOW });

  const metin = tumMetin(slides);
  for (const kotu of [/kesin(?!\s*sonuç veya kazanç vaadi değildir)/i, /garanti/i, /\bbanko\b/i, /yanılmaz/i, /net favori/i, /kesin kazanç/i]) {
    assert.ok(!kotu.test(metin.replace(NO_GUARANTEE_NOTICE, '').replace(OFFICIAL_RESULT_NOTICE, '')),
      `iddialı dil bulundu: ${kotu}`);
  }
});

test('ham veri etiketi ekrana sızmaz — sözlükten geçer', () => {
  const slides = buildBroadcastSlides({ matches: [guclu(1, 72), surprizli(2, 60)] }, { now: NOW });
  const metin = tumMetin(slides);
  assert.ok(!/BANKO/.test(metin), 'ham "BANKO" anahtarı gösterilmemeli');
  assert.ok(/GÜÇLÜ ADAY/.test(metin), 'sözlükteki karşılık gösterilmeli');
});

test('sürpriz satırında yüzde favori gibi değil ZAYIFLIK olarak sunulur', () => {
  const slides = buildBroadcastSlides({ matches: [surprizli(1, 66, 37)] }, { now: NOW });
  const r = bul(slides, 'surprise').rows[0];
  assert.match(r.sub, /yalnız %37/);
  assert.equal(r.badge, 'Sürpriz 66');
  assert.equal(r.tone, 'bad');
});

test('beraberlik sembolü ekranda X yazılır (veri anahtarı 0)', () => {
  const slides = buildBroadcastSlides({ matches: [guclu(1, 61, '0')] }, { now: NOW });
  assert.equal(bul(slides, 'strong').rows[0].pick, 'X');
});

test('kapanış metinleri marka dosyasından gelir, elle yazılmaz', () => {
  const slides = buildBroadcastSlides({ matches: [guclu(1, 72)] }, { now: NOW });
  const o = bul(slides, 'outro');
  assert.ok(o.lines.includes(OFFICIAL_RESULT_NOTICE));
  assert.ok(o.lines.includes(NO_GUARANTEE_NOTICE));
  assert.ok(o.lines.some((l) => /18 yaş/.test(l)));
});

// ——————————————————— HAFTA BAŞLIĞI ———————————————————

test('hafta başlığı gerçek alanlardan okunur, yoksa uydurulmaz', () => {
  const ms = [guclu(1, 72)];
  const t = (bulletin) => bul(buildBroadcastSlides({ ...bulletin, matches: ms }, { now: NOW }), 'intro').title;

  assert.equal(t({ weekNumber: 32 }), '32. Hafta');
  assert.equal(t({ round: '32. Hafta' }), '32. Hafta', 'gerçek API biçimi: round METİN');
  assert.equal(t({ round: { id: 11, name: '32. Hafta' } }), '32. Hafta', 'nesne biçimi de desteklenir');
  assert.equal(t({}), 'Güncel Bülten', 'hafta bilinmiyorsa sayı uydurulmaz');
  assert.ok(!/\d+\. Hafta/.test(t({})));
});

test('alt başlıkta sezon yalnız gerçekten varsa yazılır', () => {
  const ms = [guclu(1, 72), guclu(2, 70)];
  const a = bul(buildBroadcastSlides({ season: '2025-2026', matches: ms }, { now: NOW }), 'intro');
  assert.match(a.subtitle, /2025-2026 Sezonu · 2 maç/);
  const b = bul(buildBroadcastSlides({ matches: ms }, { now: NOW }), 'intro');
  assert.equal(b.subtitle, '2 maç');
});

// ——————————————————— GİZLİLİK ———————————————————

test('KİŞİSEL VERİ slayta giremez — yayında on binlerce kişi görüyor', () => {
  // Bültene kaza ile kullanıcı verisi iliştirilse bile slayta taşınmamalı.
  const kirli = {
    weekNumber: 32,
    matches: [guclu(1, 72)],
    user: { username: 'emrah41', email: 'emrahanlar.41@hotmail.com', phone: '05001112233' },
    token: 'eyJhbGciOiJIUzI1NiJ9.gizli-belirtec',
    coupons: [{ id: 'k1', couponNo: 7 }],
    points: 1450,
  };
  const metin = tumMetin(buildBroadcastSlides(kirli, { now: NOW }));
  for (const sizinti of ['emrah41', 'hotmail.com', '05001112233', 'eyJhbGciOiJIUzI1NiJ9', 'gizli-belirtec', '1450']) {
    assert.ok(!metin.includes(sizinti), `kişisel veri sızdı: ${sizinti}`);
  }
  assert.ok(!/token|kupon no|e-posta/i.test(metin));
});

// ——————————————————— GEZİNME ———————————————————

test('slayt sırası sabittir: açılış önce, kapanış en sonda', () => {
  const slides = buildBroadcastSlides({ matches: [guclu(1, 72), surprizli(2, 60), denk(3)] }, { now: NOW });
  assert.equal(slides[0].kind, 'intro');
  assert.equal(slides[slides.length - 1].kind, 'outro');
  assert.deepEqual(slides.map((s) => s.key), ['intro', 'strong', 'surprise', 'balanced', 'outro']);
  // Her slaytın benzersiz anahtarı olmalı (React listesi ve sayaç için).
  assert.equal(new Set(slides.map((s) => s.key)).size, slides.length);
});

test('clampIndex yayında boş ekrana düşmez', () => {
  assert.equal(clampIndex(-5, 4), 0);
  assert.equal(clampIndex(9, 4), 3);
  assert.equal(clampIndex(2, 4), 2);
  assert.equal(clampIndex(1.9, 4), 1);
  assert.equal(clampIndex(NaN, 4), 0);
  assert.equal(clampIndex(undefined, 4), 0);
  assert.equal(clampIndex(3, 0), 0, 'slayt yokken de çökmemeli');
});

test('punto ölçekleri artan sırada ve varsayılan en küçük değil', () => {
  assert.ok(SCALES.length >= 2);
  for (let i = 1; i < SCALES.length; i += 1) assert.ok(SCALES[i] > SCALES[i - 1], 'ölçekler artmalı');
  assert.ok(SCALES[DEFAULT_SCALE_INDEX] > SCALES[0], 'yayın varsayılanı büyük olmalı');
  assert.ok(DEFAULT_SCALE_INDEX >= 0 && DEFAULT_SCALE_INDEX < SCALES.length);
});
