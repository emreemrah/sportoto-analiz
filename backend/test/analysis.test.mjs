// MASTER ANALİZ MOTORU TESTLERİ — katalog koruması, parite, motor kuralları,
// mühürleme, karne adaleti, öğrenme sınırı, backtest ayrımı.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, CATALOG_KEYS, CATALOG_MAP, evaluateFullCatalog, evaluateCriterion } from '../src/analysis/criterionCatalog.js';
import { computeMasterAnalysis, reliabilityFactor } from '../src/analysis/masterEngine.js';
import {
  computeAnalysisCenterForData, buildOfficialProfile, buildCriterionScorecard,
  scorecardIndexBefore, calculateWithProfile, runBacktest,
} from '../src/analysis/analysisService.js';
import { newProfile, updateProfileVersion, duplicateProfile, FileAnalysisStore } from '../src/analysis/analysisStore.js';
import { ImmutableError } from '../src/archive/errors.js';
import { freezeBulletinFromData } from '../src/archive/snapshotService.js';
import { ingestOfficialResults } from '../src/archive/resultsService.js';
import { tmpStore, makeBulletinData, makeOfficialMatches, FREEZE_AT_UTC, deep } from './helpers/fixtures.mjs';
// KATALOG ALTIN KOPYASI (2026-08-11): eskiden bu liste RN arayüzünden
// (`app/src/analysis/criteria.js`) içe aktarılır ve iki kopyanın paritesi
// ölçülürdü. RN uygulaması emekliye ayrıldı (ürün Flutter'a taşındı), o dosya
// depodan kaldırıldı. Katalog koruması KAYBOLMASIN diye anahtar/etiket listesi
// silinmeden ÖNCEKİ hâliyle buraya donduruldu. Katalog bilinçli değişirse bu
// liste güncellenir ve nedeni commit mesajına yazılır.
const KATALOG_ALTIN = [
  { key: 'position', label: 'Lig Sırası' },
  { key: 'formGeneral', label: 'Son Maç Formu' },
  { key: 'powerCompare', label: 'Takım Güç Kıyaslaması' },
  { key: 'points', label: 'Puan / Puan Farkı' },
  { key: 'ppg', label: 'PPG (Maç Başı Puan)' },
  { key: 'wins', label: 'Galibiyet Sayısı' },
  { key: 'losses', label: 'Mağlubiyet Sayısı' },
  { key: 'draws', label: 'Beraberlik Eğilimi' },
  { key: 'goalsFor', label: 'Attığı Gol (Toplam)' },
  { key: 'goalsAgainst', label: 'Yediği Gol (Toplam)' },
  { key: 'goalDiff', label: 'Averaj' },
  { key: 'goalsPerGame', label: 'Gol / Maç' },
  { key: 'concededPerGame', label: 'Yediği Gol / Maç' },
  { key: 'xgFor', label: 'xG (Hücum Beklentisi)' },
  { key: 'xgAgainst', label: 'xG Karşı (Savunma Beklentisi)' },
  { key: 'over25', label: '2.5 Üst Yüzdesi' },
  { key: 'btts', label: 'KG Var Yüzdesi' },
  { key: 'cleanSheet', label: 'Temiz Kale Yüzdesi' },
  { key: 'failedToScore', label: 'Gol Atamadı Yüzdesi' },
  { key: 'possession', label: 'Topla Oynama' },
  { key: 'shots', label: 'Şut' },
  { key: 'shotsOnTarget', label: 'İsabetli Şut' },
  { key: 'corners', label: 'Korner' },
  { key: 'fouls', label: 'Faul' },
  { key: 'cards', label: 'Kart' },
  { key: 'venuePerformance', label: 'İç Saha / Deplasman Performansı' },
  { key: 'venuePpg', label: 'İç / Dış Puan Ortalaması' },
  { key: 'venueGoalsFor', label: 'İç / Dış Gol Ortalaması' },
  { key: 'venueGoalsAgainst', label: 'İç / Dış Yediği Gol Ortalaması' },
  { key: 'xgForVenue', label: 'İç / Dış xG (Hücum)' },
  { key: 'xgAgainstVenue', label: 'İç / Dış xGA (Savunma)' },
  { key: 'homeAdvantage', label: 'Ev Sahibi Avantajı' },
  { key: 'awayResilience', label: 'Deplasmanda Direnç' },
  { key: 'commonOpponents', label: 'Ortak Rakip Kıyaslaması' },
  { key: 'missingPlayers', label: 'Eksik Oyuncu' },
  { key: 'topScorerMissing', label: 'Golcü Oyuncu Eksikliği' },
  { key: 'assistMissing', label: 'Asist Yapan Oyuncu Eksikliği' },
  { key: 'coachChange', label: 'Teknik Direktör Değişimi' },
  { key: 'newCoachEffect', label: 'Yeni Hoca Etkisi' },
  { key: 'formDrop', label: 'Form Düşüşü' },
];
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FREEZE_MS = new Date(FREEZE_AT_UTC).getTime();
const RESULTS = { 1: '1', 2: '2', 3: '2', 4: '1', 5: 'X', 6: '2', 7: 'X', 8: '1', 9: '2', 10: '1', 11: '1', 12: '2', 13: '1', 14: 'X', 15: '1' };

const profOf = (keys, impact = 'mid', mode = 'manual') => ({
  id: 'p1', name: 'Test', version: 1, mode,
  criteria: Object.fromEntries(CATALOG_KEYS.map((k) => [k, { on: keys.includes(k), impact }])),
});

test('KATALOG KORUMASI: 40 kriter anahtarı ve etiketi birebir korunuyor (altın kopya)', () => {
  const altinKeys = KATALOG_ALTIN.map((c) => c.key);
  assert.equal(altinKeys.length, 40, 'katalog 40 kriterdir');
  assert.deepEqual(CATALOG_KEYS, altinKeys, 'backend kataloğu anahtar sırası/kümesi değişmemeli');
  for (const c of KATALOG_ALTIN) assert.equal(CATALOG_MAP[c.key].label, c.label, `${c.key} etiketi değişmemeli`);
});

// PARİTE TESTİ KALDIRILDI (2026-08-11): backend ile RN arayüzünün kriter
// mantığını karşılaştırıyordu. RN uygulaması emekliye ayrıldığı için
// karşılaştırılacak ikinci kopya kalmadı; testi "hep geçer" hâle getirmek
// yerine kaldırmak dürüst olanı. Kriter mantığının kendi doğruluğu aşağıdaki
// STANDART SÖZLEŞME / ETKİ SEVİYELERİ / AİLE TAVANI testlerinde ölçülüyor.
test('STANDART SÖZLEŞME: her kriter değerlendirmesi zorunlu alanları taşıyor; veri yoksa analiz dışı', () => {
  const data = makeBulletinData({ roundId: 11001 });
  const evals = evaluateFullCatalog(data.matches[0], { observedAt: '2026-07-25T10:00:00Z' });
  assert.equal(evals.length, 40);
  for (const e of evals) {
    for (const k of ['key', 'version', 'signalFamily', 'outputDirection', 'available', 'normalizedStrength', 'note', 'source', 'observedAt', 'methodologyVersion']) {
      assert.ok(k in e, `${e.key}: ${k} alanı olmalı`);
    }
  }
  // Kaynak olmayan kriterler dürüstçe kapalı:
  for (const k of ['missingPlayers', 'topScorerMissing', 'assistMissing', 'coachChange', 'newCoachEffect']) {
    const e = evals.find((x) => x.key === k);
    assert.equal(e.available, false);
    assert.ok(e.unavailableReason.includes('veri bulunamadı'));
  }
  // Veri yok maçında (no=7) kıyas kriterleri analiz dışı:
  const evals7 = evaluateFullCatalog(data.matches[6]);
  assert.equal(evals7.find((x) => x.key === 'position').available, false);
});

test('KAPALI KRİTER SIFIR ETKİ + 1/3/40 kriter seçimi', () => {
  const data = makeBulletinData({ roundId: 11002 });
  const evals = evaluateFullCatalog(data.matches[0]);

  const one = computeMasterAnalysis({ catalogEvaluations: evals, profile: profOf(['position']) });
  assert.equal(one.selectedCriteriaCount, 1);
  assert.equal(one.contributions.length, 1);
  assert.equal(one.contributions[0].key, 'position');

  const three = computeMasterAnalysis({ catalogEvaluations: evals, profile: profOf(['position', 'formGeneral', 'xgFor']) });
  assert.equal(three.selectedCriteriaCount, 3);
  assert.deepEqual(new Set(three.contributions.map((c) => c.key)), new Set(['position', 'formGeneral', 'xgFor']));

  const all = computeMasterAnalysis({ catalogEvaluations: evals, profile: profOf(CATALOG_KEYS) });
  assert.equal(all.selectedCriteriaCount, 40);

  // Kapalı kriter (goalsFor) açıkken vs hiç yokken sonuç BİREBİR aynı:
  const withOff = computeMasterAnalysis({ catalogEvaluations: evals, profile: profOf(['position', 'formGeneral']) });
  const evalsMutated = deep(evals);
  evalsMutated.find((x) => x.key === 'goalsFor').normalizedStrength = 1; // kapalı kriterin verisi değişse bile
  const withOffMutated = computeMasterAnalysis({ catalogEvaluations: evalsMutated, profile: profOf(['position', 'formGeneral']) });
  assert.deepEqual(
    { s1: withOff.support1, sx: withOff.supportX, s2: withOff.support2, main: withOff.mainPrediction },
    { s1: withOffMutated.support1, sx: withOffMutated.supportX, s2: withOffMutated.support2, main: withOffMutated.mainPrediction },
    'kapalı kriter sonuca hiçbir şekilde etki edemez',
  );
});

test('ETKİ SEVİYELERİ 1/2/3/4 doğru uygulanıyor', () => {
  const data = makeBulletinData({ roundId: 11003 });
  const evals = evaluateFullCatalog(data.matches[0]);
  const low = computeMasterAnalysis({ catalogEvaluations: evals, profile: profOf(['position'], 'low') });
  const critical = computeMasterAnalysis({ catalogEvaluations: evals, profile: profOf(['position'], 'critical') });
  const lowPts = low.contributions[0].points, critPts = critical.contributions[0].points;
  assert.ok(Math.abs(critPts / lowPts - 4) < 0.01, `kritik/düşük oranı 4 olmalı (${critPts}/${lowPts})`);
});

test('AİLE TAVANI: aynı aileden kriterler bağımsız oy sayılmıyor; dengeleme açıklanıyor', () => {
  // points/ppg/wins aynı ailede (points_results) ve fikstürde hepsi ev yönlü.
  const data = makeBulletinData({ roundId: 11004 });
  const evals = evaluateFullCatalog(data.matches[0]);
  const single = computeMasterAnalysis({ catalogEvaluations: evals, profile: profOf(['points']) });
  const trio = computeMasterAnalysis({ catalogEvaluations: evals, profile: profOf(['points', 'wins', 'ppg']) });
  // Üçü tam sayılsaydı ~3× olurdu; azalan katkı ile ≤ 1.75× + pay farkları.
  assert.ok(trio.support1 < single.support1 * 2.2, `aile tavanı çalışmalı (${trio.support1} vs ${single.support1})`);
  assert.ok(trio.familyNotes.length >= 1, 'dengeleme notu üretilmeli');
  assert.ok(trio.familyNotes[0].note.includes('dengelendi'));
  assert.equal(trio.effectiveSignalFamilyCount, 1);
});

test('MANUEL MOD karneyle ağırlık değiştirmez; AKILLI MOD yalnız yeterli örnekte sınırlı ayarlar', () => {
  const data = makeBulletinData({ roundId: 11005 });
  const evals = evaluateFullCatalog(data.matches[0]);
  const fakeScorecard = {
    position: { signals: 200, accuracy: 90, shrunkAccuracy: 88, byDirection: { '1': { total: 150, hits: 135, rate: 90, shrunkRate: 88 }, X: { total: 20, hits: 5, rate: 25, shrunkRate: 27 }, '2': { total: 30, hits: 10, rate: 33, shrunkRate: 33 } } },
  };
  const manualPlain = computeMasterAnalysis({ catalogEvaluations: evals, profile: profOf(['position'], 'mid', 'manual') });
  const manualWithSc = computeMasterAnalysis({ catalogEvaluations: evals, profile: profOf(['position'], 'mid', 'manual'), scorecardByKey: fakeScorecard });
  assert.equal(manualPlain.support1, manualWithSc.support1, 'manuel modda karne ağırlığı DEĞİŞTİRMEZ');

  const smart = computeMasterAnalysis({ catalogEvaluations: evals, profile: profOf(['position'], 'mid', 'smart'), scorecardByKey: fakeScorecard });
  assert.ok(smart.support1 > manualPlain.support1, 'akıllı modda yüksek örnekli başarı sınırlı artış sağlar');
  assert.ok(smart.support1 <= manualPlain.support1 * 1.25 + 1e-9, 'artış üst sınırı ×1.25');
  assert.ok(smart.reliabilityNotes.length >= 1, 'akıllı mod ayarını açıklamalı');

  // Az örnekli %100 → faktör 1 (aşırı ağırlık YOK):
  const tiny = reliabilityFactor({ signals: 3, accuracy: 100, shrunkAccuracy: 60, byDirection: { '1': { total: 3, hits: 3, rate: 100, shrunkRate: 60 } } }, '1');
  assert.equal(tiny.factor, 1, 'n=3 %100 başarı ağırlığı DEĞİŞTİREMEZ');
});

test('PROFİL SÜRÜMLEME: düzenleme yeni sürüm oluşturur, eski sürüm ezilmez; kopyalama çalışır', () => {
  const p1 = newProfile({ name: 'Dengeli Analiz', criteria: { position: { on: true, impact: 'high' } } }, '2026-07-01T00:00:00Z');
  const p2 = updateProfileVersion(p1, { criteria: { position: { on: true, impact: 'critical' }, xgFor: { on: true, impact: 'mid' } } }, '2026-07-02T00:00:00Z');
  assert.equal(p2.currentVersion, 2);
  assert.equal(p2.versions.length, 2);
  assert.deepEqual(p2.versions[0].criteria, { position: { on: true, impact: 'high' } }, 'ESKİ sürüm aynen durmalı');
  assert.equal(p2.versions[0].createdAt, '2026-07-01T00:00:00Z');
  const copy = duplicateProfile(p2, 'Sürpriz Avcısı');
  assert.notEqual(copy.id, p2.id);
  assert.equal(copy.currentVersion, 1);
  assert.equal(copy.name, 'Sürpriz Avcısı');
});

test('MÜHÜR + GÖLGE DEĞERLENDİRME: catalogEvaluations snapshot’a mühürlenir; sonuç hash’i değiştirmez; geçmiş yeniden hesaplanmaz', async () => {
  const store = tmpStore();
  const data = makeBulletinData({ roundId: 11100 });
  data.analysisCenter = computeAnalysisCenterForData(data, { now: FREEZE_MS - 3600e3 });
  assert.equal(data.analysisCenter.matches.length, 15);
  assert.equal(data.analysisCenter.matches[0].catalogEvaluations.length, 40, '40 kriterin TAMAMI gölge değerlendirilir');

  await freezeBulletinFromData(data, { store, now: FREEZE_MS });
  const snap = await store.getSnapshot('11100');
  const m1 = snap.payload.matches.find((m) => m.no === 1);
  assert.equal(m1.analysisCenter.catalogEvaluations.length, 40, 'gölge değerlendirme mühürlenmeli');
  assert.ok(m1.analysisCenter.officialMasterAnalysis.mainPrediction, 'resmî Master Analiz mühürlenmeli');
  assert.equal(snap.payload.analysisCenter.officialProfile.version, 'official-profile-1.0.0');
  const hashBefore = snap.payloadHash;
  assert.ok(!/halfTime/i.test(JSON.stringify(snap.payload)), 'ilk yarı hiçbir yerde yok');

  // Sonuçlar gelir → hash aynı, diğer 14 analiz aynı.
  await ingestOfficialResults('11100', makeOfficialMatches(data, { 1: '1' }), { store });
  const after = await store.getSnapshot('11100');
  assert.equal(after.payloadHash, hashBefore);
  assert.deepEqual(
    deep(after.payload.matches.map((m) => m.analysisCenter?.officialMasterAnalysis?.mainPrediction)),
    deep(snap.payload.matches.map((m) => m.analysisCenter?.officialMasterAnalysis?.mainPrediction)),
  );

  // Geçmiş hafta: güncel veri değişse bile analiz MÜHÜRLÜ değerlendirmelerden.
  const mutated = deep(data);
  mutated.matches.forEach((m) => { if (m.stats) m.stats.home.standing.points = 0; });
  const sealedCalc = await calculateWithProfile({ sealedSnapshot: after, profile: buildOfficialProfile(), store });
  assert.equal(sealedCalc.freezeStatus, 'sealed');
  const liveOfficial = data.analysisCenter.matches.find((m) => m.no === 2).officialMasterAnalysis;
  const sealedM2 = sealedCalc.matches.find((m) => m.no === 2).master;
  assert.equal(sealedM2.mainPrediction, liveOfficial.mainPrediction, 'geçmiş maç güncel motor/veriyle yeniden hesaplanmaz');
});

test('KRİTER KARNESİ ADALETİ: 1 sinyali yalnız 1 gelirse doğru; bilgi kriteri ölçülmez; kapsam ayrı; öğrenme sınırı çalışır', async () => {
  const store = tmpStore();
  const data = makeBulletinData({ roundId: 11200 });
  data.analysisCenter = computeAnalysisCenterForData(data, { now: FREEZE_MS - 3600e3 });
  await freezeBulletinFromData(data, { store, now: FREEZE_MS });
  await ingestOfficialResults('11200', makeOfficialMatches(data, RESULTS), { store });

  const sc = await buildCriterionScorecard({ store });
  assert.equal(sc.hasData, true);
  const pos = sc.criteria.find((c) => c.key === 'position');
  assert.ok(pos.signals > 0);
  // Adalet: elle doğrula — mühürlü sinyaller × resmî sonuç.
  const snap = await store.getSnapshot('11200');
  let expHits = 0, expSignals = 0;
  for (const pm of snap.payload.matches) {
    const ev = pm.analysisCenter.catalogEvaluations.find((x) => x.key === 'position');
    if (!ev?.signal) continue;
    expSignals += 1;
    if (ev.signal === RESULTS[pm.no]) expHits += 1;
  }
  assert.equal(pos.signals, expSignals);
  assert.equal(pos.hits, expHits);
  assert.ok(pos.coverage != null && pos.accuracy !== pos.coverage, 'kapsama ve doğruluk ayrı alanlar');
  assert.ok(pos.sample.label, 'örneklem sınıfı gösterilir');
  assert.ok(pos.shrunkAccuracy != null, 'shrinkage uygulanır');

  const over25 = sc.criteria.find((c) => c.key === 'over25');
  assert.equal(over25.informational, true);
  assert.equal(over25.signals, 0, 'bilgi kriterinin tahmin doğruluğu HESAPLANMAZ');

  // ÖĞRENME SINIRI: aynı round için karne boş; sonraki round için dolu.
  const same = await scorecardIndexBefore(11200, { store });
  assert.ok(!same.position?.signals, 'kendi haftası kendi analizine sızamaz');
  const next = await scorecardIndexBefore(11201, { store });
  assert.ok(next.position?.signals > 0, 'sonraki hafta önceki karneyi görebilir');
});

test('KULLANICI ANALİZİ AYRIMI: kilitle donar; sistem analizi ayrı kalır; radar gizlice karışmaz', async () => {
  const fileStore = new FileAnalysisStore(mkdtempSync(join(tmpdir(), 'sportoto-analiz-')));
  const entry = {
    bulletinId: '11300', userId: 'u1', profileId: 'p1', profileVersion: 3, mode: 'manual',
    savedAt: '2026-07-25T10:00:00Z', locked: false, lockedAt: null,
    picks: { 1: '1' }, matches: [], methodologyVersion: 'master-analysis-1.0.0',
  };
  await fileStore.saveUserAnalysis(entry);
  await fileStore.lockUserAnalyses('11300', '2026-07-25T16:55:00Z');
  await assert.rejects(() => fileStore.saveUserAnalysis({ ...entry, picks: { 1: '2' } }), ImmutableError, 'kilitli analiz değiştirilemez');
  await assert.rejects(() => fileStore.deleteUserAnalysis('11300', 'u1'), ImmutableError, 'kilitli analiz silinemez');
  const saved = (await fileStore.listUserAnalyses('11300', 'u1'))[0];
  assert.equal(saved.profileVersion, 3, 'kayıt, kaydedildiği profil sürümünü taşır (sonraki profil düzenlemesi geçmişi değiştirmez)');

  // Radar kriter motoruna GİZLİCE karışmaz: radarMaster yalnız özet metnine kıyas cümlesi ekler.
  const data = makeBulletinData({ roundId: 11301 });
  const evals = evaluateFullCatalog(data.matches[0]);
  const a = computeMasterAnalysis({ catalogEvaluations: evals, profile: profOf(['position', 'formGeneral', 'xgFor']) });
  const b = computeMasterAnalysis({ catalogEvaluations: evals, profile: profOf(['position', 'formGeneral', 'xgFor']) });
  assert.deepEqual(
    { s1: a.support1, sx: a.supportX, s2: a.support2, main: a.mainPrediction, conf: a.confidence },
    { s1: b.support1, sx: b.supportX, s2: b.support2, main: b.mainPrediction, conf: b.confidence },
    'radar girdisi olsun olmasın destek puanları deterministik/bağımsız',
  );
});

test('BACKTEST: retrospektif etiketli, resmî karneye eklenmez', async () => {
  const store = tmpStore();
  const data = makeBulletinData({ roundId: 11400 });
  data.analysisCenter = computeAnalysisCenterForData(data, { now: FREEZE_MS - 3600e3 });
  await freezeBulletinFromData(data, { store, now: FREEZE_MS });
  await ingestOfficialResults('11400', makeOfficialMatches(data, RESULTS), { store });

  const before = await buildCriterionScorecard({ store });
  const run = await runBacktest({ criteriaKeys: ['position', 'xgFor'], store });
  assert.equal(run.retrospective, true);
  assert.ok(run.label.includes('RESMÎ OLMAYAN'));
  assert.ok(run.eligibleMatches > 0);
  assert.ok(run.sampleWarning, 'küçük örneklem uyarısı');
  const after = await buildCriterionScorecard({ store });
  assert.deepEqual(
    deep(after.criteria.map((c) => ({ k: c.key, h: c.hits, s: c.signals }))),
    deep(before.criteria.map((c) => ({ k: c.key, h: c.hits, s: c.signals }))),
    'backtest resmî kriter karnesini DEĞİŞTİRMEZ',
  );
});

test('DÜŞÜK VERİ KALİTESİ güçlü güven/banko vermez; boş profil dürüst mesaj döner', () => {
  const data = makeBulletinData({ roundId: 11500 });
  const evals = evaluateFullCatalog(data.matches[6]);   // veri yok maçı
  const onlyNoData = computeMasterAnalysis({ catalogEvaluations: evals, profile: profOf(['missingPlayers', 'coachChange', 'position']) });
  assert.equal(onlyNoData.confidence, 'Düşük');
  assert.equal(onlyNoData.bankoEligible, false);
  assert.ok(onlyNoData.unavailableCriteriaCount >= 2);

  const empty = computeMasterAnalysis({ catalogEvaluations: evals, profile: profOf([]) });
  assert.equal(empty.ok, false);
  assert.ok(empty.message.includes('kriter'));
});

// ---------------------------------------------------------------------------
// "MAÇ SAYISI NEDEN FARKLI" — panelin yazdığı denklem gerçekten tutuyor mu?
// ---------------------------------------------------------------------------
// Kullanıcı sordu (7 Ağustos): karnede bazı kriterler 12, bazıları 9, biri 2
// maç gösteriyordu. Panel artık sebebi yazıyor:
//     Bakılan − Veri yok − Yön yok = Maç
// Bu test o denklemi kilitler. Denklem bozulursa panel yanlış bir açıklama
// yazmış olur — sayıyı gizlemekten daha kötüsü, yanlış açıklamaktır.
test('KAPSAM DENKLEMİ: evaluated − noData − yönsüz = signals (panel açıklaması doğru)', async () => {
  const store = tmpStore();
  const data = makeBulletinData({ roundId: 11260 });
  data.analysisCenter = computeAnalysisCenterForData(data, { now: FREEZE_MS - 3600e3 });
  await freezeBulletinFromData(data, { store, now: FREEZE_MS });
  await ingestOfficialResults('11260', makeOfficialMatches(data, RESULTS), { store });

  const sc = await buildCriterionScorecard({ store });
  assert.ok(sc.criteria.length > 0);

  for (const c of sc.criteria) {
    assert.equal(typeof c.evaluated, 'number', `${c.key}: evaluated yok — panel kırılımı yazamaz`);
    assert.equal(typeof c.noData, 'number', `${c.key}: noData yok`);
    assert.equal(typeof c.signals, 'number', `${c.key}: signals yok`);
    // Yön yok = veri vardı ama kriter iki tarafı denk gördü.
    const yonsuz = c.evaluated - c.noData - c.signals;
    assert.ok(yonsuz >= 0, `${c.key}: "yön yok" negatif çıktı (${yonsuz}) — sayım hatalı`);
    assert.ok(c.signals <= c.evaluated, `${c.key}: sinyal, bakılan maçtan çok olamaz`);
    assert.ok(c.hits <= c.signals, `${c.key}: doğru sayısı sinyal sayısını aşamaz`);
  }

  // En az bir kriter TÜM maçlarda yön vermemeli — aksi hâlde bu test bir şey
  // ölçmüyor demektir (karne 12/12 sabitse fark hiç görünmez).
  const eksikOlan = sc.criteria.filter((c) => c.signals < c.evaluated);
  assert.ok(eksikOlan.length > 0, 'hiçbir kriterde eksik yok — senaryo bu farkı sınamıyor');
});
