// RADAR EKRANI DURUM MAKİNESİ — saf yardımcılar (RN'siz test edilebilir).
// Ekranın 5 durumu:
//   'loading'         → yükleniyor (iskelet + spinner)
//   'error'           → API hatası ("Radar verisi alınamadı" + Tekrar Dene)
//   'currentPending'  → GÜNCEL hafta, bülten/radar henüz yok (dürüst bekleme —
//                       ASLA "arşiv yok" değil)
//   'data'            → veri var (kısmi bile olsa maç kartları gösterilir)
//   'pastUnarchived'  → GERÇEKTEN arşivlenmemiş GEÇMİŞ hafta
// KURAL: Güncel hafta backend'in current:true alanıyla tanınır — roundId
// sıralamasıyla "en büyük id günceldir" varsayımı YAPILMAZ.

const num = (v) => {
  if (v == null || v === '') return null; // Number(null)=0 tuzağı — id 0 sanılmasın
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// /api/radar/weeks yanıtını normalize eder: roundId sayıya çevrilir; eski
// backend yanıtlarında (current alanı yoksa) currentRoundId karşılaştırması
// ile geriye uyumlu doldurulur.
export function normalizeWeeks(wk) {
  const currentRoundId = num(wk?.currentRoundId);
  const weeks = (wk?.weeks || [])
    .map((w) => {
      const rid = num(w?.roundId);
      if (rid == null) return null;
      const current = w.current === true || (w.current === undefined && currentRoundId != null && rid === currentRoundId);
      return {
        ...w,
        roundId: rid,
        current,
        locked: w.locked === true || !!w.sealed,
        archived: w.archived === true || (w.archived === undefined && !current && !!w.sealed),
      };
    })
    .filter(Boolean);
  return { currentRoundId, weeks };
}

// Güncel hafta id'si: hafta listesindeki current işareti > currentRoundId >
// /current yanıtındaki roundId. (Hepsi sayı olarak döner.)
export function resolveCurrentId(d, wk) {
  const marked = (wk?.weeks || []).find((w) => w.current === true);
  return num(marked?.roundId) ?? num(wk?.currentRoundId) ?? (d?.current === false ? null : num(d?.roundId));
}

export function isCurrentWeek(w, curId) {
  if (w?.current === true) return true;
  const rid = num(w?.roundId);
  return rid != null && curId != null && rid === num(curId);
}

// Backend'in "arşiv yok / kayıt yok" metni mi? (Güncel haftada bu metin
// KULLANICIYA ASLA gösterilmez — currentPending durumuna çevrilir.)
export function isMissingArchiveError(message) {
  const m = String(message || '').toLowerCase();
  return m.includes('arşivi yok') || m.includes('arşiv yok') || m.includes('kaydı yok') || m.includes('kayıt yok');
}

// Ekran durumu türetimi. Girdi: { loading, error, view, legacyRadar, meta }.
export function deriveScreenState({ loading, error, view, legacyRadar, meta }) {
  if (loading) return 'loading';
  if (error) {
    // Güncel haftada "arşiv yok" hatası bir VERİ hatası değil, yanlış
    // sınıflandırmadır → dürüst bekleme durumu gösterilir.
    if (meta?.current !== false && isMissingArchiveError(error)) return 'currentPending';
    if (meta?.current === false && isMissingArchiveError(error)) return 'pastUnarchived';
    return 'error';
  }
  if (view?.hasData && Array.isArray(view.matches) && view.matches.length) return 'data';
  if (Array.isArray(legacyRadar) && legacyRadar.length) return 'data';
  if (meta?.current === false) return 'pastUnarchived';
  return 'currentPending';
}

// Duruma göre kullanıcı metni (uydurma yok, iddialı dil yok).
export function screenStateMessage(state, meta) {
  switch (state) {
    case 'error':
      return 'Radar verisi alınamadı.';
    case 'currentPending':
      return meta?.note || 'Güncel resmî bülten bekleniyor — radar, bülten açıklanınca hesaplanır.';
    case 'pastUnarchived':
      return 'Bu hafta arşivlenmemiş — mühürlü radar kaydı bulunmuyor.';
    default:
      return null;
  }
}
