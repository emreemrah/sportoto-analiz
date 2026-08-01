// TAKIM EŞLEŞTİRME TESTLERİ — 1525 bülteninin GERÇEK eşleşmeyen maçları.
// Kaynak adları UYDURMA DEĞİL: kullanıcının kendi cache'indeki (bulletin.json,
// maç 3 Randers-Silkeborg) mühürlü Danimarka Superliga puan tablosundan alındı:
// ['AGF','Brøndby','Horsens','København','Lyngby','Midtjylland','Nordsjælland',
//  'OB','Randers','Silkeborg','SønderjyskE','Viborg'] — yani kaynağın bu sezon
// kullandığı BİREBİR adlar. Kök neden: ø/æ NFD ile ayrışmadığından eski
// normalize bu harfleri SİLİYORDU ('brøndby'→'brndby') ve bülten adı
// ('Brondby') asla eşleşemiyordu.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeName, hasFootyCandidate, findFootyMatch } from '../src/matcher.js';

const T = (name) => ({ name });
const KICK = new Date('2026-07-24T20:00:00+03:00');
const bTime = KICK.getTime();
const unix = Math.floor(bTime / 1000);
const bm = (home, away) => ({ home: T(home), away: T(away), date: KICK.toISOString() });
const fx = (homeName, awayName, over = {}) => ({
  homeName, awayName, dateUnix: unix, footyMatchId: over.id ?? `${homeName}-${awayName}`,
  seasonId: over.seasonId ?? 100, homeId: over.homeId ?? 1, awayId: over.awayId ?? 2, ...over,
});

test('3. AGF Aarhus – Brondby: gerçek kaynak adlarıyla (AGF / Brøndby) eşleşir', () => {
  assert.equal(normalizeName('Brøndby'), 'brondby', 'ø → o katlanır (silinmez)');
  assert.equal(normalizeName('Brondby'), 'brondby');
  const r = findFootyMatch(bm('AGF Aarhus', 'Brondby'), [fx('AGF', 'Brøndby')]);
  assert.ok(r?.match, 'maç 1 artık eşleşir');
  assert.equal(r.swapped, false);
  assert.equal(r.trace.sourceAway, 'Brøndby');
  assert.equal(r.trace.matchedBy, 'normalized-name+date-window');
});

test('4. Horsens – FC Nordsjaelland: gerçek kaynak adıyla (Nordsjælland) eşleşir', () => {
  assert.equal(normalizeName('Nordsjælland'), 'nordsjaelland', 'æ → ae katlanır');
  assert.equal(normalizeName('FC Nordsjaelland'), 'nordsjaelland', 'FC eki düşer');
  const r = findFootyMatch(bm('Horsens', 'FC Nordsjaelland'), [fx('Horsens', 'Nordsjælland')]);
  assert.ok(r?.match, 'maç 2 artık eşleşir');
});

test('5. Lehçe karakterler güvenli katlanır (Pogoń/Wisła/Zagłębie/Legia)', () => {
  assert.equal(normalizeName('Pogoń Szczecin'), normalizeName('Pogon Szczecin'));
  assert.equal(normalizeName('Wisła Kraków'), normalizeName('Wisla Krakow'), 'ł → l katlanır');
  assert.equal(normalizeName('Zagłębie Lubin'), normalizeName('Zaglebie Lubin'), 'ę/ł aksanları');
  assert.equal(normalizeName('Legia Warszawa'), 'legiawarszawa');
});

test('6. KGHM sponsor öneki: kapsama kuralıyla çözülür (hardcode yok)', () => {
  const r = findFootyMatch(bm('KGHM Zaglebie Lubin', 'Piast Gliwice'), [fx('Zagłębie Lubin', 'Piast Gliwice')]);
  assert.ok(r?.match, 'sponsor önekli bülten adı kaynağın sade adını kapsar');
  const set = new Set([normalizeName('Zagłębie Lubin')]);
  assert.equal(hasFootyCandidate(T('KGHM Zaglebie Lubin'), set), true);
});

test('7. Benzer isim FARKLI fikstürdeyse bağlanmaz (iki taraf + tarih şartı)', () => {
  // Yalnız tek taraf benzerliği yetmez: ev tutuyor ama deplasman farklı → eşleşme YOK.
  const r = findFootyMatch(bm('AGF Aarhus', 'Brondby'), [fx('AGF', 'Viborg')]);
  assert.equal(r, null, 'tek taraf benzerliğiyle yanlış takım bağlanmaz');
  // Tarih penceresi dışı (10 gün önce) → aday bile değil.
  const r2 = findFootyMatch(bm('AGF Aarhus', 'Brondby'), [fx('AGF', 'Brøndby', { dateUnix: unix - 10 * 86400 })]);
  assert.equal(r2, null, 'tarih penceresi dışındaki fikstür reddedilir');
});

test('8. BELİRSİZ eşleşme reddedilir (iki farklı aday fikstür → ambiguous)', () => {
  const r = findFootyMatch(bm('AGF Aarhus', 'Brondby'), [
    fx('AGF', 'Brøndby', { id: 'fx1' }),
    fx('AGF Aarhus B', 'Brøndby II', { id: 'fx2' }),   // ikinci farklı aday
  ]);
  assert.equal(r.ambiguous, true, 'iki aday → default-deny');
  assert.equal(r.match, undefined, 'belirsizken veri BAĞLANMAZ');
  // Aynı fikstürün mükerrer kaydı belirsizlik DEĞİLDİR:
  const r2 = findFootyMatch(bm('AGF Aarhus', 'Brondby'), [
    fx('AGF', 'Brøndby', { id: 'ayni' }), fx('AGF', 'Brøndby', { id: 'ayni' }),
  ]);
  assert.ok(r2?.match, 'mükerrer kayıt tek eşleşme sayılır');
});

test('mevcut davranış korunur: alias (Helsinki→HJK) ve ASCII adlar bozulmadı', () => {
  const r = findFootyMatch(bm('Helsinki', 'TPS Turku'), [fx('HJK', 'TPS')]);
  assert.ok(r?.match, 'alias tablosu çalışmaya devam eder');
  const r2 = findFootyMatch(bm('Sandefjord', 'Bodo Glimt'), [fx('Sandefjord', 'Bodo/Glimt')]);
  assert.ok(r2?.match, 'halihazırda eşleşen Norveç maçı etkilenmez');
  assert.equal(normalizeName('Bodø/Glimt'), 'bodoglimt', 'ø katlaması Bodø yazımını da kapsar');
});

test('izlenebilirlik: trace alanları eksiksiz', () => {
  const r = findFootyMatch(bm('AGF Aarhus', 'Brondby'), [fx('AGF', 'Brøndby', { homeId: 77, awayId: 88, id: 555 })]);
  const t = r.trace;
  assert.equal(t.bulletinHome, 'AGF Aarhus');
  assert.equal(t.sourceHome, 'AGF');
  assert.equal(t.sourceHomeId, 77);
  assert.equal(t.sourceAwayId, 88);
  assert.equal(t.sourceMatchId, 555);
  assert.equal(t.matchConfidence, 'exact-both-sides');
  assert.ok(t.observedAt);
});

test('kaynakta olmayan lig: aday yok → eşleşme yok → uydurma veri üretilmez', () => {
  const footyNorm = new Set(['agf', 'brondby', 'horsens']); // yalnız Danimarka havuzu
  assert.equal(hasFootyCandidate(T('Pogon Szczecin'), footyNorm), false);
  assert.equal(hasFootyCandidate(T('Legia Warszawa'), footyNorm), false);
  const r = findFootyMatch(bm('Pogon Szczecin', 'Legia Warszawa'), [fx('AGF', 'Brøndby')]);
  assert.equal(r, null, 'maç eşleşmez; refresh kartı düşürmeden Yetersiz Veri bırakır');
});

// --- SEZON KEŞFİ (otomatik lig kapsamı) ---------------------------------------
test('sezon keşfi: seçili liglerin GÜNCEL sezonu seçilir; id\'siz kayıt atlanır', async () => {
  const { pickCurrentSeasonIds } = await import('../src/sources/footystats.js');
  const ids = pickCurrentSeasonIds([
    { name: 'Poland Ekstraklasa', season: [{ id: 9101, year: 20242025 }, { id: 9999, year: 20252026 }] },
    { name: 'Denmark Superliga', season: [{ id: 7001, year: 20252026 }] },
    { name: 'Bozuk Lig', season: [{ year: 20252026 }] },          // id yok → atlanır
    { name: 'Boş Lig', season: [] },
  ]);
  assert.deepEqual(ids.sort((a, b) => a - b), [7001, 9999], 'her ligden yalnız EN GÜNCEL sezon; eski sezon (9101) alınmaz');
});

// --- v3 ÖNLEM KATMANLARI: kısaltma alias'ları · logo kimliği · kelime kümesi ---

test('v3a. TPS Turku ↔ Turun Palloseura: logo kimliğinden doğrulanmış alias ile eşleşir', () => {
  const r = findFootyMatch(bm('Helsinki', 'TPS Turku'), [fx('Helsingin Jalkapalloklubi', 'Turun Palloseura')]);
  assert.ok(r?.match, 'kısaltma ↔ resmî ad çifti eşleşmeli');
  assert.equal(r.swapped, false);
  // Ad katmanı (alias) tuttuğu için etiket eski davranışla aynı kalır.
  assert.equal(r.trace.matchedBy, 'normalized-name+date-window');
});

test('v3b. KuPS/SJK/VPS/AGF/HamKam kısaltmaları resmî adlarla eşleşir (hepsi kaynak-doğrulamalı)', () => {
  for (const [shortN, official] of [
    ['KuPS', 'Kuopion Palloseura'], ['SJK', 'Seinäjoen Jalkapallokerho'],
    ['VPS', 'Vaasan Palloseura'], ['AGF Aarhus', 'Aarhus Gymnastikforening'],
    ['HamKam', 'Hamarkameratene'],
  ]) {
    const r = findFootyMatch(bm(shortN, 'Molde'), [fx(official, 'Molde FK')]);
    assert.ok(r?.match, `${shortN} ↔ ${official} eşleşmeli`);
  }
});

test('v3c. LOGO KİMLİĞİ katmanı: ad hiç tutmasa da fikstür logosundaki slug eşleşmeyi kurtarır', () => {
  const r = findFootyMatch(bm('Turun Palloseura', 'Molde'), [
    fx('TPS??', 'Molde FK', { homeImage: 'https://cdn.footystats.org/img/teams/finland-turun-palloseura.png' }),
  ]);
  assert.ok(r?.match, 'logo slug bülten adını içeriyor → eşleşir');
  assert.ok(r.trace.matchConfidence.startsWith('assisted:'), `yardımcı katman izlenebilir: ${r.trace.matchConfidence}`);
  assert.ok(r.trace.matchedBy.includes('logo'), r.trace.matchedBy);
});

test('v3d. KELİME KÜMESİ katmanı: kelime sırası/fazladan ek farkını çözer', () => {
  const r = findFootyMatch(bm('Glimt Bodo', 'Molde'), [fx('FK Bodø/Glimt Fotball', 'Molde FK')]);
  assert.ok(r?.match, 'kelime kümesi (bodo,glimt) ⊆ uzun ad → eşleşir');
  assert.ok(r.trace.matchedBy.includes('token'), r.trace.matchedBy);
});

test('v3e. JENERİK kelime tek başına eşleşme kanıtı OLAMAZ: İnter ↔ Inter Turku bağlanmaz', () => {
  // "İnter" (Milan) bülten adı; fikstürde yalnız Inter Turku var — deplasman da
  // farklı: iki taraf birden tutmadığından ve 'inter' jenerik olduğundan eşleşme YOK.
  const r = findFootyMatch(bm('İnter', 'Juventus'), [fx('Inter Turku', 'Mariehamn')]);
  assert.equal(r, null, 'jenerik kelimeyle yanlış kulübe bağlanılmaz');
});

test('v3f. Yardımcı katmanlar BELİRSİZLİK REDDİNİ değiştirmez: iki aday → eşleşme reddedilir', () => {
  const r = findFootyMatch(bm('Glimt Bodo', 'Molde'), [
    fx('FK Bodø/Glimt Fotball', 'Molde FK', { id: 'a' }),
    fx('Bodø Glimt II', 'Molde', { id: 'b' }),
  ]);
  assert.ok(r?.ambiguous, 'birden çok farklı fikstür tutuyorsa default-deny sürer');
});
