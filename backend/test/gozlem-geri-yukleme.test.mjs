// MAÇ ÖNCESİ MÜHRÜN KALICI ARŞİVDEN GERİ YÜKLENMESİ.
//
// KULLANICI BİLDİRİMİ (22 Ağustos 2026): "bültendeki bazı maçların sistem
// tahminleri yok, bunlar daha önce vardı". Sebep: donmuş analiz YALNIZ dosya
// önbelleğinde tutuluyordu; Render diski geçici olduğu için önbellek silinince
// maç öncesi mühürlenmiş tahminler yok oldu ve "başlamış maça tahmin üretme"
// kuralı — doğru davranarak — yenisini üretmedi.
//
// Çözüm, kaydı yeniden hesaplamak DEĞİL, kalıcı arşivden geri OKUMAKTIR:
// recordObservationsFromData maç öncesi tahmini zaten Supabase'e yazıyor ve
// bunu yalnız freezeAt'ten önce yapıyor.
//
// BU TESTLERİN ASIL İŞİ: geri yüklemenin yasağı DELMEDİĞİNİ bağlamak. Sınırdan
// sonraki bir gözlem seçilirse, sistem maç sonrası veriyi "mühürlü tahmin"
// diye gösterir — projenin en temel kuralının ihlali olur.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  macOncesiGozlemSec, gozlemdenAnaliz, gozlemleriGrupla,
  gozlemKullanilabilir, etiketRengi,
} from '../src/archive/gozlemGeriYukleme.js';

const gozlem = (observedAt, patch = {}) => ({
  matchId: 'mac-1',
  observedAt,
  odds: { home: 6, draw: 4.5, away: 1.46 },
  statsSummary: {
    label: 'BANKO', estimated: false, prediction: '2',
    probabilities: { '1': 16, X: 21, '2': 64 }, surpriseScore: 22,
    ...(patch.statsSummary ?? {}),
  },
  ...patch,
});

const ms = (s) => new Date(s).getTime();

test('sınırdan SONRAKİ gözlem ASLA seçilmez (yasağın kendisi)', () => {
  const oncesi = gozlem('2026-08-21T16:42:30Z');
  const sonrasi = gozlem('2026-08-21T19:00:00Z', {
    statsSummary: { prediction: '1' },   // maç sonrası "bilgi" — girmemeli
  });
  const secili = macOncesiGozlemSec([oncesi, sonrasi], {
    sinirMs: ms('2026-08-21T18:25:00Z'),
  });
  assert.equal(secili.observedAt, '2026-08-21T16:42:30Z');
});

test('sınırdan önceki EN SON gözlem seçilir (mühür anına en yakın)', () => {
  const erken = gozlem('2026-08-20T09:00:00Z');
  const gec = gozlem('2026-08-21T16:42:30Z');
  const secili = macOncesiGozlemSec([erken, gec], {
    sinirMs: ms('2026-08-21T18:25:00Z'),
  });
  assert.equal(secili.observedAt, '2026-08-21T16:42:30Z');
});

test('sınır YOKSA seçim yapılmaz — sınırsız okuma yasaktır', () => {
  // Sınır hesaplanamadıysa "hepsini al" demek, maç sonrası gözlemi mühür
  // sanmaktır. Bilinmezlikte doğru davranış: hiçbir şey döndürme.
  assert.equal(macOncesiGozlemSec([gozlem('2026-08-21T16:00:00Z')], {}), null);
  assert.equal(
    macOncesiGozlemSec([gozlem('2026-08-21T16:00:00Z')], { sinirMs: NaN }),
    null,
  );
});

test('boş/kullanılamaz gözlemler seçilmez', () => {
  assert.equal(macOncesiGozlemSec([], { sinirMs: ms('2026-08-21T18:25:00Z') }), null);
  const bos = { matchId: 'mac-1', observedAt: '2026-08-21T16:00:00Z', statsSummary: {} };
  assert.equal(gozlemKullanilabilir(bos), false);
  assert.equal(macOncesiGozlemSec([bos], { sinirMs: ms('2026-08-21T18:25:00Z') }), null);
});

test('geri yüklenen kayıt gerçek değerleri taşır', () => {
  const r = gozlemdenAnaliz(gozlem('2026-08-21T16:42:30Z'));
  assert.equal(r.prediction.symbol, '2');
  assert.equal(r.analysis.label, 'BANKO');
  assert.equal(r.analysis.surpriseScore, 22);
  assert.deepEqual(r.analysis.probabilities, { '1': 16, X: 21, '2': 64 });
  assert.deepEqual(r.preOdds, { home: 6, draw: 4.5, away: 1.46 });
});

test('KAYITTA OLMAYAN alan UYDURULMAZ', () => {
  // Olasılıklardan favori "türetmek" cazip ama yanlış: mühürde ne varsa o.
  const r = gozlemdenAnaliz(gozlem('2026-08-21T16:42:30Z'));
  assert.equal(r.analysis.favorite, null, 'favori uydurulmuş');
  assert.equal(r.analysis.comment, null, 'yorum uydurulmuş');
  assert.deepEqual(r.analysis.factors, [], 'gerekçe uydurulmuş');
});

test('geri yüklenen kayıt KENDİNİ BELLİ EDER', () => {
  // Sessiz geri yükleme, canlı hesapla karışırdı. Kayıt nereden ve NE ZAMAN
  // geldiğini taşımalı ki denetlenebilsin.
  const r = gozlemdenAnaliz(gozlem('2026-08-21T16:42:30Z'));
  assert.equal(r.analysisRestored.source, 'archive-observation');
  assert.equal(r.analysisRestored.observedAt, '2026-08-21T16:42:30Z');
  assert.match(r.analysisRestored.note, /maç başlamadan önce/i);
});

test('etiket rengi surprise.js ile aynı eşiklerden gelir', () => {
  assert.equal(etiketRengi('BANKO'), 'green');
  assert.equal(etiketRengi('DİKKAT'), 'yellow');
  assert.equal(etiketRengi('SÜRPRİZE AÇIK'), 'red');
  assert.equal(etiketRengi('VERİ YOK'), 'gray');
  assert.equal(etiketRengi(null), null);
});

test('gruplama maç kimliğine göre ayırır', () => {
  const h = gozlemleriGrupla([
    { matchId: 'a', observedAt: '2026-08-21T10:00:00Z' },
    { matchId: 'b', observedAt: '2026-08-21T10:00:00Z' },
    { matchId: 'a', observedAt: '2026-08-21T11:00:00Z' },
    { observedAt: '2026-08-21T11:00:00Z' },        // kimliksiz → düşer
  ]);
  assert.equal(h.size, 2);
  assert.equal(h.get('a').length, 2);
  assert.equal(h.get('b').length, 1);
});

// ---------------------------------------------------------------------------
// AKIŞ BAĞI — refresh.js'in bu modülü DOĞRU YERDE ve DOĞRU SINIRLA çağırdığını
// bağlar. Akış canlı Spor Toto + FootyStats + Supabase istediği için uçtan uca
// koşturulamaz; bağladığımız şey sözleşmenin yerinde durmasıdır.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const hamRefresh = readFileSync(join(KOK, 'src', 'refresh.js'), 'utf8');
const kodRefresh = hamRefresh
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('geri yükleme, "başlamış maç" kapısının İÇİNDE çağrılır', () => {
  const i = kodRefresh.indexOf('if (started) {', kodRefresh.indexOf('const prevSnap'));
  assert.ok(i > 0, 'başlamış maç kapısı bulunamadı');
  const blok = kodRefresh.slice(i, kodRefresh.indexOf('gecmisTahminUretilmedi++', i));
  assert.match(blok, /macOncesiGozlemSec/, 'geri yükleme çağrılmıyor');
  assert.match(blok, /gozlemdenAnaliz/, 'dönüşüm çağrılmıyor');
});

test('sınır İKİ KATLI: mühür anı VE maçın kendi başlama anı', () => {
  const i = kodRefresh.indexOf('if (started) {', kodRefresh.indexOf('const prevSnap'));
  const blok = kodRefresh.slice(i, kodRefresh.indexOf('gecmisTahminUretilmedi++', i));
  assert.match(blok, /muhurSiniriMs/, 'mühür anı sınırı yok');
  assert.match(blok, /macAniMs\(bm\.date\)/,
    'maç anı ham new Date ile okunuyor — sunucuda 3 saat ileri kayar ve sınır maçın içine düşer');
  assert.match(blok, /Math\.min\(/, 'iki sınırın küçüğü alınmıyor');
});

test('geri yükleme BAŞARISIZSA eski davranış korunur (uydurma yok)', () => {
  const i = kodRefresh.indexOf('if (started) {', kodRefresh.indexOf('const prevSnap'));
  const blok = kodRefresh.slice(i, kodRefresh.indexOf('let analysis, stats = null', i));
  assert.match(blok, /analysis: null/, 'boş dal kaldırılmış');
  assert.match(blok, /started_without_snapshot/, 'sebep kodu kaldırılmış');
});

test('gözlemler yalnız KİLİTLİ haftada okunur (gereksiz sorgu yok)', () => {
  const i = kodRefresh.indexOf('let gozlemHaritasi');
  assert.ok(i > 0, 'gözlem okuma bloğu yok');
  const blok = kodRefresh.slice(i, i + 900);
  assert.match(blok, /if \(isLocked\)/, 'kilit kapısı yok');
  assert.match(blok, /listObservations/, 'arşiv okunmuyor');
});

test('arşiv okunamazsa refresh ÇÖKMEZ', () => {
  const i = kodRefresh.indexOf('let gozlemHaritasi');
  const blok = kodRefresh.slice(i, i + 1400);
  assert.match(blok, /catch/, 'hata yakalanmıyor — arşiv düşerse bülten üretilemez');
});

// ---------------------------------------------------------------------------
// MÜHRÜN BOZULMAZLIĞI — geri yüklenen değer sonradan DEĞİŞTİRİLEMEZ.
// ---------------------------------------------------------------------------
import { applyRadarGuardsToBulletin } from '../src/analysis/radarGuards.js';

test('radar koruması geri yüklenen mühürlü tahmini DEĞİŞTİRMEZ', () => {
  // ÖLÇÜLEN ARIZA (22 Ağu 2026): önbellek boşken `sameBulletin` false olduğu
  // için koruma çalışıyor ve mühürdeki "2" ekranda "X2" oluyordu. Geri
  // yüklenen kayıt donmuş bir geçmiştir; genişletmek onu DEĞİŞTİRMEKTİR.
  //
  // Girdi, korumanın "motor çelişkisi" dalını GERÇEKTEN tetikler: master
  // favorisi X, öneri ise tek başına "2". Kontrol maçı (#2) bunu kanıtlar —
  // o genişlemezse test boş yere yeşil olurdu.
  const radarKaydi = (no) => ({
    no,
    master: {
      favorite: { symbol: 'X', percent: 45 },
      favoriteFailureRisk: 10,
      surpriseDnaScore: 10,
    },
  });
  const result = {
    radarCenter: { matches: [radarKaydi(1), radarKaydi(2)] },
    matches: [
      {
        no: 1,
        prediction: { symbol: '2' },
        analysisRestored: {
          source: 'archive-observation',
          observedAt: '2026-08-21T16:42:30Z',
        },
      },
      { no: 2, prediction: { symbol: '2' } },   // kontrol: koruma çalışmalı
    ],
  };

  const degisen = applyRadarGuardsToBulletin(result, { isLocked: false });

  assert.equal(result.matches[1].prediction.symbol, '02',
    'kontrol maçı genişlemedi — koruma hiç çalışmamış, test bir şey kanıtlamıyor');
  assert.equal(degisen, 1, 'yalnız kontrol maçı değişmeliydi');
  assert.equal(result.matches[0].prediction.symbol, '2',
    'mühürlü tahmin değiştirilmiş — geri yükleme anlamını yitirir');
});
