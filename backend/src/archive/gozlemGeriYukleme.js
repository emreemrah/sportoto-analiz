// MAÇ ÖNCESİ MÜHRÜN KALICI KAYITTAN GERİ YÜKLENMESİ
// ---------------------------------------------------------------------------
// DOĞRULANMIŞ ARIZA (22 Ağustos 2026, kullanıcı bildirimi "tahminler
// kayboldu"): donmuş analiz YALNIZ dosya önbelleğinde (backend/cache) duruyordu.
// Render diski geçici olduğu için önbellek silinince, başlamış maçların maç
// öncesi mühürlenmiş tahminleri yok oldu. refresh.js — doğru davranarak —
// yenisini üretmeyi reddetti (geriye dönük tahmin yasağı), böylece maç
// analizsiz kaldı.
//
// ÇÖZÜM VE SINIRI: `recordObservationsFromData` zaten her yenilemede maç
// öncesi tahmini KALICI arşive (Supabase) yazıyor ve bunu YALNIZ freezeAt'ten
// önce yapıyor. Yani kayıp veri arşivde duruyor. Buradaki iş onu geri
// okumaktır — YENİDEN HESAPLAMAK DEĞİL.
//
// DÜRÜSTLÜK ÇİZGİSİ (bu modülün varlık sebebi):
//  * Sınır ZORUNLU: yalnız `sinirMs`ten ÖNCE gözlenmiş kayıt seçilir. Sınır,
//    çağıranda min(freezeAt, maçın kendi başlama anı) olarak verilir. Maç
//    başladıktan sonraki hiçbir gözlem seçilemez — seçilseydi bu, yasağın ta
//    kendisini delerdi.
//  * UYDURMA YOK: kayıtta olmayan alan (favorite, factors, comment) null
//    kalır. Olasılıklardan favori "türetmek" cazip ama yanlış olurdu: mühürde
//    ne varsa o gösterilir.
//  * KAYIT KENDİNİ BELLİ EDER: dönen nesne `analysisRestored` taşır (kaynak +
//    gerçek gözlem anı). Provenance kapısı (scorecards/provenance.js) BUNDAN
//    ETKİLENMEZ: geç mühürlü hafta karne dışı kalmaya devam eder. Bu modül
//    kullanıcının ekranındaki boşluğu doldurur, karne uygunluğunu DEĞİŞTİRMEZ.

// surprise.js ile AYNI eşikler. Renk, etiketin görsel karşılığıdır; ayrı bir
// karar değildir. Eşikler orada değişirse burası da değişmeli — bunu bağlayan
// test var (gozlem-geri-yukleme.test.mjs).
export function etiketRengi(label) {
  switch (label) {
    case 'BANKO': return 'green';
    case 'DİKKAT': return 'yellow';
    case 'SÜRPRİZE AÇIK': return 'red';
    case 'VERİ YOK': return 'gray';
    default: return null;
  }
}

const ms = (v) => {
  if (v == null) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
};

/** Gözlemde gerçekten geri yüklenecek bir şey var mı? */
export function gozlemKullanilabilir(gozlem) {
  const s = gozlem?.statsSummary;
  if (!s) return false;
  return s.prediction != null || s.probabilities != null || s.surpriseScore != null;
}

/**
 * Sınırdan ÖNCE gözlenmiş SON kullanılabilir kaydı seçer.
 * Sınır yoksa (hesaplanamadıysa) seçim YAPILMAZ: sınırsız seçim, maç sonrası
 * bir gözlemi mühür sanma riskidir ve bu modülün tek kırmızı çizgisidir.
 */
export function macOncesiGozlemSec(gozlemler, { sinirMs } = {}) {
  if (!Array.isArray(gozlemler) || !gozlemler.length) return null;
  if (!Number.isFinite(sinirMs)) return null;
  let secili = null;
  let seciliMs = -Infinity;
  for (const g of gozlemler) {
    const t = ms(g?.observedAt);
    if (t == null || t > sinirMs) continue;
    if (!gozlemKullanilabilir(g)) continue;
    if (t >= seciliMs) { secili = g; seciliMs = t; }
  }
  return secili;
}

/**
 * Gözlemi refresh.js'in beklediği şekle çevirir.
 * Kayıtta olmayan alan UYDURULMAZ — null döner.
 */
export function gozlemdenAnaliz(gozlem) {
  if (!gozlemKullanilabilir(gozlem)) return null;
  const s = gozlem.statsSummary;
  const label = s.label ?? null;
  return {
    analysis: {
      hasOdds: gozlem.odds != null,
      estimated: s.estimated ?? null,
      probabilities: s.probabilities ?? null,
      surpriseScore: s.surpriseScore ?? null,
      label,
      labelColor: etiketRengi(label),
      // Mühürde kayıtlı DEĞİL — türetmek uydurma olurdu.
      favorite: null,
      factors: [],
      comment: null,
    },
    prediction: s.prediction != null
      ? { symbol: s.prediction, label: null, reason: 'Maç öncesi mühürlü kayıttan geri yüklendi.' }
      : null,
    preOdds: gozlem.odds ?? null,
    analysisRestored: {
      source: 'archive-observation',
      observedAt: gozlem.observedAt ?? null,
      note: 'Bu analiz maç başlamadan önce kaydedilmişti; kalıcı arşivden geri yüklendi (yeniden hesaplanmadı).',
    },
  };
}

/**
 * Bültenin tüm gözlemlerini matchId → gözlem listesi olarak grupla.
 */
export function gozlemleriGrupla(gozlemler) {
  const harita = new Map();
  for (const g of gozlemler || []) {
    const k = String(g?.matchId ?? '');
    if (!k) continue;
    if (!harita.has(k)) harita.set(k, []);
    harita.get(k).push(g);
  }
  return harita;
}
