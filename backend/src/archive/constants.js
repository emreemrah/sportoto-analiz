// ARŞİV SABİTLERİ — snapshot şeması ve motor sürümleri tek yerden yönetilir.
// Şema değişirse SCHEMA_VERSION artırılır; eski snapshot'lar ASLA yeniden yazılmaz
// (payload kendi schemaVersion'ını taşır, okuyucular sürüme göre davranır).

export const SCHEMA_VERSION = '1.0.0';

// Analiz motoru sürümü: surprise.js + prediction.js + criteriaEval.js bütünü.
// Bu dosyalarda karar mantığı değişirse burayı artır (snapshot'lara işlenir).
export const ANALYSIS_ENGINE_VERSION = 'backend-analysis-1.0.0';

// ESKİ kriter motorunun katalog sürümü (criteriaEval.js EVALS anahtar seti).
// ⚠️ AD KARIŞIKLIĞI DÜZELTİLDİ (2026-08-06 denetimi): bu sabit, snapshot'a yazılan
// `criteria.signals` alanının kataloğunu tanımlar — 40 kriterli MASTER katalogla
// (analysisConfig.js → CRITERIA_CATALOG_VERSION = 'criteria-catalog-2.0.0') AYNI
// ŞEY DEĞİLDİR. İki ayrı katalog, iki ayrı sürüm; ikisi de doğru. Değerler
// değiştirilmedi: mühürlü snapshot'lar bu etiketleri taşıyor, geriye dönük
// anlamları bozulamaz. Yalnız ad ayrıştırıldı ki bir daha karıştırılmasın.
export const LEGACY_CRITERIA_CATALOG_VERSION = 'criteria-1.0.0';
// Geriye uyumluluk: eski ad hâlâ dışa açık (başka modüller kırılmasın).
export const CRITERIA_CATALOG_VERSION = LEGACY_CRITERIA_CATALOG_VERSION;

// Radar kimliği/sürümü (surprise.js etiket motoru + refresh.js radar dizisi).
export const RADAR_ID = 'surprise-radar';
export const RADAR_VERSION = 'radar-1.0.0';

// Kilit kuralı: bültendeki İLK maçın resmî başlama saatinden 5 dakika önce.
export const FREEZE_BEFORE_MS = 5 * 60 * 1000;

// freeze anı bu kadar gecikmeyle yakalandıysa snapshot "late" işaretlenir
// (geriye dönük veri uydurulmaz; verinin gerçekte ne zaman alındığı yazılır).
export const LATE_THRESHOLD_MS = 2 * 60 * 1000;

// Sıra istatistikleri için asgari örneklem uyarı eşiği.
export const POSITION_STATS_MIN_SAMPLE = 30;
