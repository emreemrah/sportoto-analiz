// SİSTEM KARNESİ EKRAN MANTIĞI — saf yardımcılar (RN'siz test edilebilir).
// KURALLAR:
// * Ana başlık YALNIZ resmî ileri-test tekli ana tahmin (1/X/2) başarısıdır.
// * Kapsama başarısı AYRI bölümdür; ana başarıyla TOPLANMAZ.
// * Resmî veri yoksa dürüst boş durum gösterilir — eski %69 tarzı demo/backfill
//   değerleri ASLA resmî başarı olarak görünmez.
// * Demo veri yalnız açık demo modunda ve kalıcı DEMO etiketiyle gösterilebilir.

export const COVERAGE_NOTE =
  'Kapsama başarısı, sistemin tekli ana tahmin doğruluğu değildir. Birden fazla sonuç seçeneği içerdiği için başarı oranı doğal olarak daha yüksektir.';

export const OFFICIAL_EMPTY_TITLE = 'Henüz resmî ileri-test verisi yok.';
export const OFFICIAL_EMPTY_MESSAGE =
  'Sistem Karnesi, gerçek Spor Toto bültenlerinde ilk maçtan 5 dakika önce mühürlenen tahminler sonuçlandıkça otomatik oluşacaktır. Demo ve geçmişe dönük testler bu başarıya dahil edilmez.';

export const RETRO_LABEL = 'RESMÎ BAŞARIYA DAHİL DEĞİLDİR';
export const DEMO_LABEL = 'DEMO VERİ — GERÇEK BAŞARI DEĞİLDİR';
export const LEGACY_SEPARATION_NOTE =
  'Eski geliştirme kayıtları resmî başarıdan ayrılmıştır ve bu karneye dahil edilmez.';
export const RADAR_SCORECARD_EMPTY_TEXT =
  'Radar Karnesi ilk resmî mühürlü hafta sonuçlandığında oluşacaktır. Geçmişe dönük başarı üretilmez.';

// NORMAL KULLANICININ GÖRDÜĞÜ SEKMELER — Retrospektif sekmesi YOKTUR.
// Eski/backfill/retrospektif başarılar hiçbir kullanıcı ekranında gösterilmez.
export const USER_SECTIONS = [
  { key: 'official', label: 'Resmî Karne' },
  { key: 'weeks', label: 'Hafta Hafta' },
  { key: 'byResult', label: '1/X/2' },
  { key: 'coverage', label: 'Kapsama' },
  { key: 'radar', label: 'Radar' },
  { key: 'criteria', label: 'Kriter' },
  { key: 'tech', label: 'Teknik' },
];

// Resmî ana kart gösterilebilir mi? (default-deny: alan yoksa GÖSTERME)
export function hasOfficialData(sc) {
  return !!(sc && sc.hasData === true && sc.isDemo !== true && sc.hasOfficialForwardData === true);
}

// Ana kart değerleri — yalnız tekli ana tahmin ölçümünden. Kapsama alanları
// bilerek OKUNMAZ (yanlışlıkla karışmasın).
export function officialHeadline(sc) {
  if (!hasOfficialData(sc)) return null;
  return {
    title: 'Sistem Master Analizi — Tekli Ana Tahmin İsabeti',
    weeks: sc.weeksCounted ?? 0,
    total: sc.total ?? 0,
    correct: sc.correct ?? 0,
    wrong: sc.wrong ?? 0,
    accuracy: sc.accuracy ?? 0,
    accuracy1: sc.accuracy1 ?? sc.accuracy ?? 0,
    last5: sc.last5 ?? null,
    bestWeek: sc.bestWeek ?? null,
    methodologyVersions: sc.methodologyVersions ?? [],
  };
}

// Hafta satırı etiketi: partial hafta "13/15" TAM hafta gibi sunulmaz.
export function weekRecordLabel(week) {
  if (!week) return null;
  if (week.status === 'pending') return 'Sonuç bekleniyor';
  const base = `${week.correct}/${week.evaluated}`;
  return week.status === 'partial' ? `${base} · kısmi` : base;
}

// Demo dashboard gösterilebilir mi? Yalnız açık demo modunda (default: hayır).
export function demoAllowed({ demoMode = false, dev = false } = {}) {
  return demoMode === true || dev === true;
}

// Eski uç yanıtı resmî gibi mi görünüyor? (AnalysisSettings fallback koruması)
// Yeni alanlar yoksa (çok eski backend) default-deny: resmî sayma.
export function criteriaBadgeUsable(cs) {
  if (!cs || cs.hasData !== true) return false;
  if (cs.isDemo === true) return false;
  if (cs.provenanceType && cs.provenanceType !== 'official_forward') return false;
  if ('hasOfficialForwardData' in cs && cs.hasOfficialForwardData !== true) return false;
  if (!('hasOfficialForwardData' in cs) && !('provenanceType' in cs)) return false; // kanıt alanı yok → gösterme
  return true;
}

// Eski radar karnesi (legacy Banko/Sürpriz yüzdeleri) — YENİ BAŞLANGIÇ KARARI:
// hiçbir kullanıcı ekranında, hiçbir amaçla GÖSTERİLMEZ. Bu fonksiyon bilinçli
// olarak her durumda null döner (eski çağıran kod kalırsa bile rozet üretilemez).
export function legacyRadarBadge() {
  return null;
}
