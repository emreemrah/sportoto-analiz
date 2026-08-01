// PROVENANCE / KAYNAK SINIFLANDIRMASI + RESMÎ İLERİ-TEST UYGUNLUĞU (TEK MERKEZ)
// ---------------------------------------------------------------------------
// ANA KURAL: Bir kayıt resmî başarıya yalnız AÇIKÇA KANITLANABİLİYORSA girer.
// Kanıtlanamayan kayıt VARSAYILAN OLARAK HARİÇTİR (default-deny).
// "Muhtemelen resmî", "tarihi eski görünüyor", "backfilled alanı yok" gibi
// varsayımlarla resmî başarıya dahil ETME.
//
// Sistem, Radar ve Kriter karnelerinin ÜÇÜ DE buradaki aynı fonksiyonu kullanır.
// Zaman karşılaştırmaları UTC ms üzerinden yapılır (Europe/Istanbul yalnız UI).

export const PROVENANCE = {
  OFFICIAL_FORWARD: 'official_forward',        // maç öncesi mühürlenmiş, kanıtlı ileri-test
  LATE_UNVERIFIED: 'late_unverified',          // kilit anından geç alınmış — resmî sayılamaz
  RETROSPECTIVE_BACKTEST: 'retrospective_backtest', // zaman makinesi / geçmişe dönük test
  LEGACY_BACKFILL: 'legacy_backfill',          // geçmiş haftaya SONRADAN üretilmiş tahmin
  DEMO: 'demo',                                // mock/demo veri
  UNKNOWN: 'unknown',                          // kanıt alanları eksik — hariç
};

const ms = (v) => {
  if (v == null) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
};

// ---------------------------------------------------------------------------
// NORMALİZE KAYIT: her kaynaktan (arşiv snapshot / eski cache) aynı şekle gelir.
// ---------------------------------------------------------------------------

// Yeni kalıcı arşiv kaydından normalize satır üret (bulletin + snapshot).
export function recordFromArchive(bulletin, snap) {
  const p = snap?.payload || null;
  return {
    source: 'archive',
    sourceRecordId: snap?.id ?? (bulletin ? `bulletin-${bulletin.id}` : null),
    roundId: bulletin?.roundId ?? (p?.bulletin?.roundId ?? null),
    round: bulletin?.week ?? p?.bulletin?.week ?? null,
    year: bulletin?.season ?? p?.bulletin?.season ?? null,
    backfilled: snap?.backfilled === true || p?.backfilled === true,
    isDemo: snap?.isDemo === true || p?.isDemo === true || p?.demo === true,
    retrospective: snap?.retrospective === true || p?.retrospective === true,
    late: snap?.late === true,
    immutable: snap?.immutable === true,
    verificationHash: snap?.payloadHash ?? null,
    methodologyVersion: p?.engine?.analysisEngineVersion ?? p?.radarCenter?.methodologyVersion ?? null,
    engineVersion: p?.engine?.analysisEngineVersion ?? null,
    officialProfileVersion: p?.analysisCenter?.officialProfile?.version ?? null,
    createdAt: snap?.createdAt ?? null,
    calculatedAt: snap?.dataObservedAt ?? snap?.createdAt ?? null,
    dataObservedAt: snap?.dataObservedAt ?? null,
    lockedAt: snap?.lockedAt ?? null,
    freezeAt: p?.bulletin?.freezeAt ?? bulletin?.freezeAt ?? null,
    firstMatchStartAt: p?.bulletin?.firstMatchStartAt ?? bulletin?.firstMatchStartAt ?? null,
    hasSnapshot: !!snap,
  };
}

// Eski dosya-cache kaydından (backend/cache/snapshot-*.json) normalize satır.
export function recordFromLegacyCache(roundId, data) {
  return {
    source: 'legacy-cache',
    sourceRecordId: `snapshot-${roundId}`,
    roundId: Number(roundId),
    round: data?.round ?? null,
    year: data?.year ?? null,
    backfilled: data?.backfilled === true,
    isDemo: data?.isDemo === true || data?.demo === true,
    retrospective: data?.retrospective === true,
    late: false,
    immutable: false,                 // eski cache dosyası değiştirilebilir — kanıt DEĞİL
    verificationHash: null,
    methodologyVersion: null,
    engineVersion: null,
    officialProfileVersion: null,
    createdAt: data?.savedAt ?? null,
    calculatedAt: data?.savedAt ?? null,
    dataObservedAt: null,
    lockedAt: null,
    freezeAt: null,
    firstMatchStartAt: null,
    hasSnapshot: false,
    pickCount: Array.isArray(data?.picks) ? data.picks.filter((x) => x?.symbol && x.symbol !== '-').length : 0,
  };
}

// ---------------------------------------------------------------------------
// RESMÎ İLERİ-TEST UYGUNLUĞU — default-deny. Her eksik kanıt bir nedendir.
// options.requireOfficialProfile: Sistem Karnesi için resmî profil sürümü şartı.
// ---------------------------------------------------------------------------
export function officialForwardEligibility(rec, { requireOfficialProfile = false } = {}) {
  const reasons = [];
  if (!rec) return { eligible: false, reasons: ['no_record'] };

  // Açık dışlama işaretleri (asla resmî olamaz):
  if (rec.backfilled === true) reasons.push('backfilled');
  if (rec.isDemo === true) reasons.push('demo');
  if (rec.retrospective === true) reasons.push('retrospective_backtest');
  if (rec.late === true) reasons.push('late_lock');

  // Kanıt şartları (yokluk = hariç; "yoktur ama eskidir" kabul edilmez):
  if (rec.source !== 'archive') reasons.push('not_persistent_archive');
  if (!rec.hasSnapshot) reasons.push('no_sealed_snapshot');
  if (rec.immutable !== true) reasons.push('not_immutable');
  if (!rec.verificationHash) reasons.push('no_verification_hash');
  if (!rec.methodologyVersion) reasons.push('no_methodology_version');
  if (!rec.createdAt && !rec.calculatedAt) reasons.push('no_creation_time');
  if (!rec.freezeAt) reasons.push('no_freeze_time');
  if (!rec.firstMatchStartAt) reasons.push('no_first_match_time');
  if (requireOfficialProfile && !rec.officialProfileVersion) reasons.push('no_official_profile_version');

  // Zaman kanıtları (UTC): tahmin kilit anında/öncesinde ve İLK MAÇTAN ÖNCE.
  const lockMs = ms(rec.lockedAt);
  const freezeMs = ms(rec.freezeAt);
  const firstMs = ms(rec.firstMatchStartAt);
  const observedMs = ms(rec.dataObservedAt) ?? ms(rec.calculatedAt);
  if (lockMs == null) reasons.push('no_lock_time');
  if (lockMs != null && firstMs != null && lockMs > firstMs) reasons.push('locked_after_first_match');
  if (observedMs != null && firstMs != null && observedMs > firstMs) reasons.push('prediction_after_first_match');
  if (observedMs != null && lockMs != null && observedMs > lockMs) reasons.push('prediction_after_lock');
  if (freezeMs != null && firstMs != null && freezeMs > firstMs) reasons.push('freeze_after_first_match');

  return { eligible: reasons.length === 0, reasons };
}

// ---------------------------------------------------------------------------
// SINIFLANDIRMA — normalize kayıttan provenanceType + isOfficialForward üret.
// ---------------------------------------------------------------------------
export function classifyRecord(rec, { requireOfficialProfile = false } = {}) {
  if (!rec) return { ...baseClass(PROVENANCE.UNKNOWN), exclusionReason: 'no_record' };
  const { eligible, reasons } = officialForwardEligibility(rec, { requireOfficialProfile });
  if (eligible) return { provenanceType: PROVENANCE.OFFICIAL_FORWARD, isOfficialForward: true, exclusionReason: null, reasons: [] };

  // Öncelik sırası: açık işaret > geç kilit > bilinmez.
  let type = PROVENANCE.UNKNOWN;
  if (rec.isDemo === true) type = PROVENANCE.DEMO;
  else if (rec.backfilled === true) type = PROVENANCE.LEGACY_BACKFILL;
  else if (rec.retrospective === true) type = PROVENANCE.RETROSPECTIVE_BACKTEST;
  else if (rec.late === true) type = PROVENANCE.LATE_UNVERIFIED;
  return { provenanceType: type, isOfficialForward: false, exclusionReason: reasons[0] ?? 'unknown', reasons };
}

function baseClass(type) {
  return { provenanceType: type, isOfficialForward: false, reasons: [] };
}

// Arşiv bülten+snapshot çifti için hızlı kapı (Radar/Kriter karneleri kullanır):
// yalnız official_forward mühürlü kayıtlar karneye girer.
export function isSnapshotOfficialForward(bulletin, snap, opts = {}) {
  return classifyRecord(recordFromArchive(bulletin, snap), opts).isOfficialForward;
}

// Hariç tutma kırılımı (rapor/teknik ekran için).
export function exclusionBreakdown(classified) {
  const out = {};
  for (const c of classified) {
    if (c.isOfficialForward) continue;
    const k = c.provenanceType;
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}
