// HAFTA KAPANIŞI — sistem karnesi ile kullanıcı karnesinin yan yana özeti.
// Saf modül (RN bağımlılığı YOK, testli).
//
// DÜRÜSTLÜK KURALLARI (kesin)
//   • Yalnız RESMÎ Spor Toto sonucu sayılır: bir maçın hem `result` hem `score`
//     alanı varsa değerlendirilir. Canlı/geçici skor ASLA karneye yazılmaz.
//   • Karşılaştırma yalnız İKİSİNİN DE tahmin yaptığı maçlarda yapılır —
//     tahmin yapılmayan maç kimsenin aleyhine/lehine sayılmaz.
//   • Sonuç gelmemişse sayı üretilmez (null) — tahmini/örnek karne yoktur.
//   • Bu bir başarı vaadi değildir; geçmiş hafta ölçümüdür.

const OUTCOMES = new Set(['1', 'X', '2']);

// Resmî sonucu normalize et: '0' → 'X'. Tanınmayan değer → null.
export function normResult(r) {
  if (r == null) return null;
  const s = String(r).toUpperCase();
  if (s === '0') return 'X';
  return OUTCOMES.has(s) ? s : null;
}

// RESMÎ ÇÖZÜLMÜŞ maç: hem resmî sonuç hem skor gelmiş olmalı.
export function isOfficiallyResolved(m) {
  return !!(m && m.result && m.score && normResult(m.result));
}

// Sistem sembolünü ('1', '10', '102'...) sonuç kümesine aç. '0' = X.
export function expandSymbol(sym) {
  if (!sym || sym === '-') return [];
  return String(sym).split('').map((c) => (c === '0' ? 'X' : c)).filter((c) => OUTCOMES.has(c));
}

const rate = (c, t) => (t > 0 ? Math.round((c / t) * 100) : null);
const teamName = (t) => (typeof t === 'string' ? t : t?.mediumName || t?.name || '');

/**
 * @param matches    geçmiş hafta maçları (result + score + prediction alanlı)
 * @param selections kullanıcının FINAL kupon seçimleri [{no, selectedOutcomes}]
 */
export function buildWeekRecap({ matches = [], selections = [] } = {}) {
  const all = Array.isArray(matches) ? matches : [];
  const resolved = all.filter(isOfficiallyResolved);
  const userMap = new Map(
    (selections || [])
      .filter((s) => s && Array.isArray(s.selectedOutcomes) && s.selectedOutcomes.length)
      .map((s) => [Number(s.no), s.selectedOutcomes.map((o) => (o === '0' ? 'X' : o))]),
  );

  const rows = [];
  for (const m of resolved) {
    const actual = normResult(m.result);
    const sysSet = expandSymbol(m.prediction?.symbol);
    const userSet = userMap.get(Number(m.no)) || null;
    rows.push({
      no: m.no,
      home: teamName(m.home),
      away: teamName(m.away),
      score: m.score ? `${m.score.home}-${m.score.away}` : null,
      actual,
      system: sysSet.length ? { pick: sysSet.join('-'), hit: sysSet.includes(actual) } : null,
      user: userSet ? { pick: userSet.join('-'), hit: userSet.includes(actual) } : null,
    });
  }

  const sysRows = rows.filter((r) => r.system);
  const userRows = rows.filter((r) => r.user);
  const system = sysRows.length
    ? { made: sysRows.length, correct: sysRows.filter((r) => r.system.hit).length, accuracy: rate(sysRows.filter((r) => r.system.hit).length, sysRows.length) }
    : null;
  const user = userRows.length
    ? { made: userRows.length, correct: userRows.filter((r) => r.user.hit).length, accuracy: rate(userRows.filter((r) => r.user.hit).length, userRows.length) }
    : null;

  // ADİL KARŞILAŞTIRMA — yalnız ikisinin de tahmin yaptığı maçlar.
  const common = rows.filter((r) => r.system && r.user);
  let head2head = null;
  if (common.length) {
    const u = common.filter((r) => r.user.hit).length;
    const s = common.filter((r) => r.system.hit).length;
    head2head = { matches: common.length, user: u, system: s, winner: u > s ? 'user' : s > u ? 'system' : 'tie' };
  }

  // ÖNE ÇIKANLAR — yayında anlatılacak anlar.
  const highlights = [];
  for (const r of common) {
    if (r.user.hit && !r.system.hit) highlights.push({ kind: 'user-win', ...r });
    else if (!r.user.hit && r.system.hit) highlights.push({ kind: 'system-win', ...r });
    else if (!r.user.hit && !r.system.hit) highlights.push({ kind: 'both-missed', ...r });
  }
  // Kullanıcı yoksa sistemin ıskaları yine gösterilir (dürüst özeleştiri).
  if (!common.length) {
    for (const r of sysRows) if (!r.system.hit) highlights.push({ kind: 'system-missed', ...r });
  }
  const ORDER = { 'user-win': 0, 'both-missed': 1, 'system-win': 2, 'system-missed': 3 };
  highlights.sort((a, b) => (ORDER[a.kind] - ORDER[b.kind]) || (a.no - b.no));

  const total = all.length;
  const complete = total > 0 && resolved.length === total;
  return {
    official: { total, resolved: resolved.length, complete, pending: total - resolved.length },
    system, user, head2head, rows, highlights,
    hasData: resolved.length > 0,
  };
}

// Yayın için tek cümlelik dürüst başlık. Veri yoksa iddia üretilmez.
export function recapHeadline(recap) {
  if (!recap?.hasData) return 'Resmî sonuçlar açıklandıkça hafta kapanışı burada oluşur.';
  const { head2head, system, user, official } = recap;
  const scope = official.complete ? 'Hafta kapandı' : `${official.resolved}/${official.total} resmî sonuç geldi`;
  if (head2head) {
    if (head2head.winner === 'user') return `${scope} — bu hafta sen öndesin: ${head2head.user}/${head2head.matches} · sistem ${head2head.system}/${head2head.matches}.`;
    if (head2head.winner === 'system') return `${scope} — sistem önde: ${head2head.system}/${head2head.matches} · sen ${head2head.user}/${head2head.matches}.`;
    return `${scope} — berabere: ikiniz de ${head2head.user}/${head2head.matches}.`;
  }
  if (user) return `${scope} — kuponunda ${user.correct}/${user.made} isabet.`;
  if (system) return `${scope} — sistem ${system.correct}/${system.made} tutturdu; bu hafta kayıtlı kuponun yok.`;
  return `${scope} — değerlendirilecek tahmin yok.`;
}
