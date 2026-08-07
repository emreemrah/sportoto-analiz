// KARNE EKRAN MANTIĞI TESTLERİ (spec 16: 22–26 + UI koruma kuralları)
// Kural: UI katmanı da default-deny — kanıt alanları olmayan yanıt resmî
// başarı gibi GÖSTERİLMEZ; demo yalnız açık demo modunda, kalıcı etiketle.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasOfficialData, officialHeadline, weekRecordLabel, demoAllowed,
  criteriaBadgeUsable, legacyRadarBadge, USER_SECTIONS,
  COVERAGE_NOTE, OFFICIAL_EMPTY_TITLE, OFFICIAL_EMPTY_MESSAGE, DEMO_LABEL,
  LEGACY_SEPARATION_NOTE, RADAR_SCORECARD_EMPTY_TEXT,
} from '../src/scorecardLogic.js';

test('22. mock/demo veri production karnesini besleyemez (demoAllowed default-deny)', () => {
  assert.equal(demoAllowed({ demoMode: false, dev: false }), false, 'üretimde demo KAPALI');
  assert.equal(demoAllowed({}), false, 'bayraksız çağrı da kapalı');
  assert.equal(demoAllowed({ demoMode: true }), true, 'yalnız AÇIK demo modunda');
  assert.equal(demoAllowed({ dev: true }), true, 'geliştirme senaryosu');
  assert.ok(DEMO_LABEL.includes('GERÇEK BAŞARI DEĞİLDİR'), 'kalıcı demo etiketi metni hazır');
});

test('23. backend kapalı/yanıt yokken mock başarı GÖSTERİLMEZ (boş durum)', () => {
  assert.equal(hasOfficialData(null), false);
  assert.equal(hasOfficialData(undefined), false);
  assert.equal(officialHeadline(null), null, 'ana kart üretilmez → ekran hata/boş durumu gösterir');
});

test('24. ESKİ %69 yanıt şekli (kanıt alansız) resmî görünmüyor — UI default-deny', () => {
  // Eski backend yanıtının birebir şekli: hasData:true + accuracy:69 ama
  // hasOfficialForwardData/provenance alanları YOK → resmî kart gösterilmez.
  const old = { hasData: true, total: 120, correct: 83, wrong: 37, accuracy: 69, weeksCounted: 9 };
  assert.equal(hasOfficialData(old), false, 'kanıt alanı yoksa %69 ASLA resmî görünmez');
  assert.equal(officialHeadline(old), null);
});

test('25. resmî veri yokken doğru dürüst boş durum metinleri', () => {
  const sc = { hasData: false, hasOfficialForwardData: false, isDemo: false };
  assert.equal(hasOfficialData(sc), false);
  assert.ok(OFFICIAL_EMPTY_TITLE.includes('Henüz resmî ileri-test verisi yok'));
  assert.ok(OFFICIAL_EMPTY_MESSAGE.includes('mühürlenen tahminler sonuçlandıkça'));
  assert.ok(OFFICIAL_EMPTY_MESSAGE.includes('dahil edilmez'));
});

test('19+22. YENİ BAŞLANGIÇ: Retrospektif sekmesi ve eski radar rozeti kullanıcıya YOK', () => {
  // Normal kullanıcı sekmelerinde Retrospektif yoktur:
  // (T9: 'calibration' sekmesi eklendi — olasılık kalitesi ölçümü, resmî veriye dayanır.)
  // 'criteria' sekmesi 2026-08-07'de kaldırıldı: kriter başarıları artık maç
  // detayı → Analiz sekmesinde, ham maç tablosuyla birlikte duruyor.
  assert.deepEqual(USER_SECTIONS.map((s) => s.key), ['ozet', 'official', 'weeks', 'byResult', 'coverage', 'radar', 'calibration']);
  assert.ok(!USER_SECTIONS.some((x) => x.key === 'criteria'), 'Kriter sekmesi karneden kaldırıldı — maç içine taşındı');
  assert.equal(USER_SECTIONS[0].key, 'ozet', 'Özet ilk sekme olmalı — sade dil önce (2026-08-06)');
  assert.ok(!USER_SECTIONS.some((x) => x.key === 'tech'), 'Teknik sekme kullanıcıya geri gelmiş — iç ayrıntılar gösterilmez (2026-08-06)');
  assert.ok(!USER_SECTIONS.some((s) => /retro/i.test(s.key) || /retrospektif/i.test(s.label)), 'Retrospektif sekmesi kaldırıldı');
  // Eski Banko/Sürpriz rozeti HİÇBİR veriyle üretilemez:
  assert.equal(legacyRadarBadge({ hasData: true, provenanceType: 'legacy_backfill', labels: { banko: { rate: 50 } } }), null);
  assert.equal(legacyRadarBadge(), null);
  // Radar ekranı boş karne metni geçmişe dönük üretim yapılmadığını söyler:
  assert.ok(RADAR_SCORECARD_EMPTY_TEXT.includes('ilk resmî mühürlü hafta'));
  assert.ok(RADAR_SCORECARD_EMPTY_TEXT.includes('Geçmişe dönük başarı üretilmez'));
  // Teknik bölümde legacy için yalnız kısa ayrım notu vardır:
  assert.equal(LEGACY_SEPARATION_NOTE, 'Eski geliştirme kayıtları resmî başarıdan ayrılmıştır ve bu karneye dahil edilmez.');
});

test('resmî ana kart yalnız doğrulanmış yanıttan üretilir (tekli ölçüm alanları)', () => {
  const sc = {
    hasData: true, hasOfficialForwardData: true, isDemo: false,
    weeksCounted: 2, total: 30, correct: 26, wrong: 4, accuracy: 87, accuracy1: 86.7,
    last5: { total: 30, correct: 26, accuracy: 87 },
    bestWeek: { roundId: 4400, round: '50. Hafta', record: '14/15', accuracy: 93 },
    methodologyVersions: ['analysis-1'],
    coverage: { rate: 95 }, // kapsama alanı ana karta SIZMAZ
  };
  const h = officialHeadline(sc);
  assert.equal(h.total, 30);
  assert.equal(h.correct, 26);
  assert.equal(h.accuracy, 87);
  assert.ok(!('coverage' in h), 'kapsama ana kartta yer almaz — ayrı bölümdür');
  assert.ok(COVERAGE_NOTE.includes('doğal olarak daha yüksektir'));
});

test('16-UI. partial hafta "13/15 tam hafta" gibi sunulmaz; pending haftada skor yok', () => {
  assert.equal(weekRecordLabel({ status: 'complete', correct: 13, evaluated: 15 }), '13/15');
  assert.equal(weekRecordLabel({ status: 'partial', correct: 9, evaluated: 11 }), '9/11 · kısmi');
  assert.equal(weekRecordLabel({ status: 'pending', correct: 0, evaluated: 0 }), 'Sonuç bekleniyor');
});

test('kriter rozetleri: yalnız official_forward yanıt kullanılabilir', () => {
  assert.equal(criteriaBadgeUsable({ hasData: true, provenanceType: 'official_forward', hasOfficialForwardData: true }), true);
  assert.equal(criteriaBadgeUsable({ hasData: true, provenanceType: 'legacy_backfill' }), false);
  assert.equal(criteriaBadgeUsable({ hasData: true, isDemo: true, provenanceType: 'official_forward', hasOfficialForwardData: true }), false);
  assert.equal(criteriaBadgeUsable({ hasData: true }), false, 'kanıt alanı olmayan ESKİ yanıt → rozet yok (default-deny)');
  assert.equal(criteriaBadgeUsable({ hasData: true, provenanceType: 'official_forward', hasOfficialForwardData: false }), false, 'resmî hafta yoksa rozet dolmaz');
});
