// RADAR EKRANI VERİ TÜRETME — saf yardımcılar (RN'siz test edilebilir).
//
// NEDEN AYRI DOSYA: RadarScreen 1500 satırdı ve bu hesaplar render gövdesinin
// içine gömülüydü — yani filtre/sıralama/sayaç mantığı yalnız ekranı çizerek
// test edilebiliyordu. Buradaki fonksiyonlar JSX bilmez, doğrudan sınanır;
// ekran yalnız çizim işini yapar. Davranış AYNIDIR (altın kopya testi bunu
// kanıtlar), yalnız yeri değişmiştir.
//
// radarScreenLogic.js ekranın DURUM MAKİNESİ (yükleniyor/hata/boş) içindir;
// bu dosya ise GÖSTERİLECEK VERİNİN türetilmesidir. İkisi karıştırılmamalı.

export const DNA_PERIODS = [
  { k: 'allTime', label: 'Tüm Haftalar' },
  { k: 'last5', label: 'Son 5 Hafta' },
  { k: 'last10', label: 'Son 10 Hafta' },
  { k: 'last15', label: 'Son 15 Hafta' },
];

// Dönem → satır açılımında gösterilecek maç sayısı. Anahtarlar DNA_PERIODS ile
// aynıdır; allTime için sınır YOKTUR (undefined → tüm liste). Liste dönemle
// sınırlanmazsa "Son 5 Hafta" seçiliyken 51 maç görünür ve ekrandaki yüzdeyle
// uyuşmaz — kullanıcı sayıyı doğrulayamaz.
export const DONEM_MAC_SAYISI = { last5: 5, last10: 10, last15: 15 };
export const DNA_PERIOD_LABELS = Object.fromEntries(DNA_PERIODS.map((p) => [p.k, p.label]));

/** 2026 → "2025/2026 Sezonu"; "2025/2026" → "2025/2026 Sezonu"; boşsa ''. */
export const sezonAdiUzun = (y) => {
  const s = String(y ?? '').trim();
  if (!s) return '';
  if (s.includes('/')) return `${s} Sezonu`;
  return Number.isFinite(Number(s)) ? `${Number(s) - 1}/${Number(s)} Sezonu` : s;
};

/**
 * HAFTA SEÇİCİ VERİSİ — resmî Spor Toto listesindeki gezinti:
 *   [2025/2026 Sezonu ▼]  [53. Hafta ▼]
 *
 * NEDEN: hafta çipleri yan yana diziliyordu. Yeni sezon 1. haftayla başlayınca
 * hem numara küçülüyor hem de haftalar birikiyor (sezonda 52) — şerit okunmaz
 * hâle geliyor.
 *
 * Hafta listesi seçili sezonun BÜTÜN haftalarını içerir, GÜNCEL hafta da dahil
 * ve en üstte (resmî listede de öyle). Sıralama yeniden eskiye: 53, 52, 51…
 *
 * "Güncel" ölçütü radarScreenLogic.isCurrentWeek ile AYNIDIR (backend
 * current:true alanı esas) — iki ayrı güncel tanımı olmaz.
 */
export function haftaSeciciVerisi(weeks, { curId = null, selectedId = null, navSezon = null } = {}) {
  const guncelMi = (w) => w?.current === true
    || (w?.roundId != null && curId != null && Number(w.roundId) === Number(curId));

  const hepsi = (weeks || [])
    .filter((w) => w?.roundId != null)
    .map((w) => ({
      roundId: Number(w.roundId),
      ad: w.round || `#${w.roundId}`,
      kilitli: !!(w.locked || w.sealed),
      guncel: guncelMi(w),
      yil: w.year ?? null,
    }))
    .sort((a, b) => b.roundId - a.roundId);

  const sezonlar = [...new Set(hepsi.map((w) => w.yil).filter((y) => y != null).map(String))]
    .sort((a, b) => b.localeCompare(a))
    .map((y) => ({ y, ad: sezonAdiUzun(y) }));

  // Bakılan hafta: seçili → yoksa güncel → yoksa en yeni.
  const bakilan = hepsi.find((w) => selectedId != null && w.roundId === Number(selectedId))
    || hepsi.find((w) => w.guncel) || hepsi[0] || null;

  // Seçili sezon: kullanıcının seçimi → bakılan haftanın sezonu → en yeni.
  const seciliSezon = (navSezon != null && sezonlar.some((s) => s.y === String(navSezon)))
    ? String(navSezon)
    : (bakilan?.yil != null ? String(bakilan.yil) : (sezonlar[0]?.y ?? null));

  // Sezon süzgeci yalnız BİRDEN ÇOK sezon varken; tek sezonda süzülmez ki
  // yılı bilinmeyen hafta listeden düşmesin.
  const liste = sezonlar.length > 1 && seciliSezon != null
    ? hepsi.filter((w) => String(w.yil) === seciliSezon)
    : hepsi;

  return {
    sezonlar,                                  // [{y, ad}] — 1 taneyse düz yazı
    seciliSezon,
    sezonAdi: sezonAdiUzun(seciliSezon),
    liste,                                     // hafta açılır listesinin içeriği
    haftaAdi: bakilan?.ad ?? null,             // düğmede yazan hafta
    haftaGuncelMi: !!bakilan?.guncel,
  };
}

export const MASTER_FILTERS = [
  { k: 'all', label: 'Tümü' },
  { k: 'strong', label: '🟢 Güçlü Aday' },
  { k: 'medium', label: '🟡 Karışık Sinyal' },
  { k: 'surprise', label: '🔴 Sürpriz Sinyali' },
  { k: 'insufficient', label: '⚪ Analiz Hazır Değil' },
  { k: 'drawRisk', label: 'X Beraberlik Riski' },
  { k: 'awaySurprise', label: '2 Dep. Sürprizi' },
];

// Yüzdeleri sade TAM SAYIya yuvarla ve toplamı 100'e sabitle (en büyük kalan
// yöntemi) — "1 %44 · X %37 · 2 %19" gibi temiz görünüm. Toplamı 100 tutmak
// şart: 99 ya da 101 gören kullanıcı sayıya güvenmez.
export function roundPct100(pct) {
  if (!pct) return null;
  const raw = { '1': Number(pct['1']) || 0, X: Number(pct.X) || 0, '2': Number(pct['2']) || 0 };
  const floors = { '1': Math.floor(raw['1']), X: Math.floor(raw.X), '2': Math.floor(raw['2']) };
  let rem = 100 - (floors['1'] + floors.X + floors['2']);
  const order = ['1', 'X', '2'].sort((a, b) => (raw[b] - floors[b]) - (raw[a] - floors[a]));
  for (let i = 0; i < order.length && rem > 0; i++) { floors[order[i]] += 1; rem -= 1; }
  return floors;
}

export const ord = (n) => (n != null ? `${n}.` : '—');
export const wdl = (v) => (v ? `${v.wins || 0}G ${v.draws || 0}B ${v.losses || 0}M` : null);
// DİKKAT — null/'' burada AYRI ele alınır. Number(null) === 0 olduğu için eski
// hâli eksik veriyi "0" diye yazıyordu: backend xG/gol alanlarını bilerek null
// döndürürken (bkz. sources/footystats.js → numN) ekran "xG 0 – 1.4" gösteriyor,
// yani BİLİNMEYEN değeri SIFIR gibi sunuyordu. Bilinmeyen sayı yazılmaz.
export const num1 = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? (Number.isInteger(n) ? String(n) : n.toFixed(1)) : null;
};
export const fmtClock = (iso) => (
  iso ? new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : ''
);

// Radar 5 yüzdeleri BİR ONDALIK basamakla gösterilir. Tam sayıya yuvarlamak
// yeni bir sonucun getirdiği değişimi gizleyebiliyordu (%19.4 → %19.7 ikisi de
// 19 görünüyordu).
export const birOndalik = (p) => (p ? {
  '1': Number(p['1']).toFixed(1), X: Number(p.X).toFixed(1), '2': Number(p['2']).toFixed(1),
} : null);

/** Sınıf sayaçları — filtre çiplerindeki (3) rakamları. */
export function classCountsOf(matches) {
  const c = { strong: 0, medium: 0, surprise: 0, insufficient: 0 };
  for (const mm of matches || []) {
    const k = mm.master?.classification;
    if (k === 'strong_candidate') c.strong += 1;
    else if (k === 'surprise_candidate') c.surprise += 1;
    else if (k === 'insufficient_data') c.insufficient += 1;
    else c.medium += 1;
  }
  return c;
}

/** Master listesi filtresi. Bilinmeyen filtre TÜMÜ demektir (liste boşalmaz). */
export function filterMaster(matches, filter) {
  return (matches || []).filter((mm) => {
    const c = mm.master?.classification;
    switch (filter) {
      case 'strong': return c === 'strong_candidate';
      case 'medium': return c === 'medium_risk';
      case 'surprise': return c === 'surprise_candidate';
      case 'insufficient': return c === 'insufficient_data';
      case 'drawRisk': return (mm.master?.scores?.draw ?? 0) >= 30;
      case 'awaySurprise':
        return mm.master?.favorite?.symbol === '1'
          && (mm.master?.favoriteFailureRisk ?? 0) >= 55
          && mm.master?.exactDirection === '2';
      default: return true;
    }
  });
}

/**
 * Sıralama. VARSAYILAN Spor Toto sırasıdır (no 1→15) — kullanıcı bülteni o
 * sırayla görür, listeyi riske göre karıştırmak kupon doldurmayı zorlaştırır.
 * 'risk' modunda riski OLMAYAN maç -1 sayılır ve sona düşer; eşitlikte yine
 * no sırası (kararlı sıralama).
 */
export function sortMaster(matches, sortMode) {
  return [...(matches || [])].sort((a, b) => (
    sortMode === 'order'
      ? a.no - b.no
      : (b.master?.favoriteFailureRisk ?? -1) - (a.master?.favoriteFailureRisk ?? -1) || a.no - b.no
  ));
}

/**
 * Mühürlenmeye kalan dakika. Yalnız GÜNCEL ve henüz mühürlenmemiş haftada
 * anlamlıdır; geçmiş bir zaman için null döner (negatif dakika gösterilmez).
 */
export function freezeMinutes(meta, now) {
  if (!meta?.current || meta?.sealed || meta?.frozenAt || !meta?.freezeAt) return null;
  const ms = new Date(meta.freezeAt).getTime() - now;
  return Number.isFinite(ms) && ms > 0 ? Math.ceil(ms / 60000) : null;
}

/** Legacy (eski sürpriz radarı) sayaç + filtre. */
export function legacyCountsOf(radar) {
  const c = { red: 0, yellow: 0, green: 0 };
  for (const r of radar || []) if (c[r.labelColor] != null) c[r.labelColor] += 1;
  return c;
}
export function legacyFiltered(radar, legacyFilter) {
  return legacyFilter ? (radar || []).filter((r) => r.labelColor === legacyFilter) : (radar || []);
}

// DÖNEM BAŞARISI / EĞİLİM HESAPLARI KALDIRILDI (kullanıcı kararı, 3 Ağustos
// 2026: "kafa karıştırıyor"). Buradaki üç fonksiyon —`radar5PeriodSuccess`,
// `radar5PeriodTrend`, `rowTrend`— yalnız o göstergeyi besliyordu:
//   * çiplerde "Tüm Haftalar · %66.7" ve ▲▼— oku,
//   * maç satırında "Dönem başarısı: X %100.0 ▲".
// İkincisi, hemen üstündeki "Geçmiş N. sıra · 1/X/2" satırının EN YÜKSEĞİNİ
// tekrar ediyordu; aynı sayıyı "başarı" adıyla ikinci kez göstermek okuyanı
// yanıltıyordu. Gösterge kalkınca hesaplar da ölü koda döndü ve silindi.
// Dönem çipleri FİLTRE olarak duruyor (DNA_PERIODS).
