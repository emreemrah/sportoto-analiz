// KAPSAM SEBEBİ — teşhis, eşleştiriciyle AYNI katmanları kullanmalı.
// ---------------------------------------------------------------------------
// GERÇEK ARIZA (31 Temmuz 2026): Radar 4 ekranında 52. haftanın 1. ve 4.
// maçları için "Union St.Gilloise için analiz verisi bulunamadı" ve
// "AZ Alkmaar için analiz verisi bulunamadı" yazıyordu.
//
// Oysa kaynakta bu takımlar VARDI ve gerçek eşleştirici (sideMatches) ikisini
// de KELİME KÜMESİ katmanıyla buluyordu:
//   bülten "Union St.Gilloise" ↔ kaynak "Royal Union Saint-Gilloise"
//   bülten "AZ Alkmaar"        ↔ kaynak "Alkmaar Zaanstreek"
// Kapsam teşhisi (classifyCoverage) ise yalnız AD katmanına bakıyordu, o yüzden
// "takım yok" diyordu. Gerçek sebep: bunlar kupa finali; lig sezonlarının
// fikstür listesinde maç kaydı yok.
//
// Bu test, teşhis katmanlarının eşleştiriciyle hizalı kaldığını doğrular:
// eşleştiricinin bulduğu bir takım için teşhis "takım yok" DEMEMELİ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sideMatches, hasFootyCandidate, hasFootyCandidateByTokens, normalizeName,
} from '../src/matcher.js';

// refresh.js'teki takimKaynakta ile AYNI bileşim.
const takimKaynakta = (team, rawNames) =>
  hasFootyCandidate(team, new Set(rawNames.map(normalizeName)))
  || hasFootyCandidateByTokens(team, rawNames);

// Kaynaktaki GERÇEK adlar (31.07.2026 teşhisiyle okundu, uydurma değil).
const CIFTLER = [
  { bulten: 'Union St.Gilloise', kaynak: 'Royal Union Saint-Gilloise' },
  { bulten: 'AZ Alkmaar', kaynak: 'Alkmaar Zaanstreek' },
  { bulten: 'Uniao Torreense', kaynak: 'SC União Torreense' },
];

test('eşleştiricinin bulduğu takımı teşhis de bulur (katmanlar hizalı)', () => {
  for (const { bulten, kaynak } of CIFTLER) {
    const team = { name: bulten };
    const katman = sideMatches(team, kaynak);
    assert.ok(katman, `${bulten} ↔ ${kaynak} eşleşmeli (eşleştirici)`);
    assert.equal(
      takimKaynakta(team, [kaynak]), true,
      `${bulten}: eşleştirici '${katman}' katmanıyla buluyor ama teşhis bulamıyor — "takım yok" YANLIŞ sebebi doğar`,
    );
  }
});

test('yalnız ad katmanı yetersizdi — arızanın kendisi kayıt altında', () => {
  // Bu iki çift SADECE ad katmanıyla bulunamaz; arızanın kaynağı buydu.
  for (const { bulten, kaynak } of CIFTLER.slice(0, 2)) {
    assert.equal(
      hasFootyCandidate({ name: bulten }, new Set([normalizeName(kaynak)])), false,
      `${bulten}: ad katmanı tek başına bulmamalı (regresyon kaydı)`,
    );
    assert.equal(hasFootyCandidateByTokens({ name: bulten }, [kaynak]), true,
      `${bulten}: kelime kümesi katmanı bulmalı`);
  }
});

test('alakasız takım hâlâ bulunamaz — gevşetme yanlış eşleşme üretmiyor', () => {
  const havuz = ['Royal Union Saint-Gilloise', 'Alkmaar Zaanstreek', 'SC União Torreense',
    'KAA Gent', 'PSV Eindhoven', 'Feyenoord Rotterdam'];
  for (const yabanci of ['Galatasaray', 'Bodo Glimt', 'Legia Varsova', 'Club Brugge']) {
    assert.equal(takimKaynakta({ name: yabanci }, havuz), false,
      `${yabanci} bu havuzda BULUNMAMALI (yanlış eşleşme riski)`);
  }
});

test('jenerik kelime tek başına eşleşme kanıtı değil', () => {
  // "Union" AMBIGUOUS_TOKENS içinde: tek başına Union Berlin'i
  // Union Saint-Gilloise'a bağlamamalı.
  assert.equal(
    takimKaynakta({ name: 'Union Berlin' }, ['Royal Union Saint-Gilloise']), false,
    'Union Berlin ↔ Union Saint-Gilloise BAĞLANMAMALI',
  );
});
