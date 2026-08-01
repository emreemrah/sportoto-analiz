// BAŞARI / GÖREV / SEVİYE KATALOĞU — TEK DOĞRULUK KAYNAĞI.
//
// Veritabanındaki achievements/tasks tabloları bu katalogdan İDEMPOTENT upsert
// ile beslenir (server açılışında). Kod ile tablo ayrı düşemez.
//
// DÜRÜSTLÜK KURALLARI
//   • Hiçbir başarı "kesin kazanç" imâsı taşımaz; iddialı dil yasaktır.
//   • İsabet başarıları YALNIZ resmî Spor Toto sonucuyla değerlendirilen
//     tahminlerden gelir (gamification/service.js — settleRoundAccuracy).
//   • Doğrulanamayacak koşul (ör. "ardışık hafta serisi" — hafta kimliklerinin
//     ardışıklığı resmî olarak garanti değil) katalogda YER ALMAZ.

export const ACHIEVEMENTS = [
  // Mevcut rozet anahtarları KORUNUR (users.js rozetleriyle süreklilik).
  { key: 'first_comment', title: 'İlk Yorum',    description: 'Bir maça ilk yorumunu yazdın.',                    icon: '💬', points: 5,  sort: 1 },
  { key: 'commenter',     title: 'Yorumcu',      description: '10 yorum yazdın.',                                 icon: '🗣️', points: 10, sort: 2 },
  { key: 'predictor',     title: 'Tahminci',     description: 'İlk tahminini kilitledin.',                        icon: '🎯', points: 5,  sort: 3 },
  { key: 'analyst',       title: 'Analist',      description: '10 tahmin kilitledin.',                            icon: '📊', points: 15, sort: 4 },
  { key: 'tactician',     title: 'Taktikçi',     description: 'İlk kadro tahminini yaptın.',                      icon: '📋', points: 5,  sort: 5 },
  { key: 'loved',         title: 'Beğenilen',    description: 'Yorumların 10 beğeni aldı.',                       icon: '❤️', points: 15, sort: 6 },
  // Yeni başarılar — hepsi sunucuda, gerçek veriden doğrulanır.
  { key: 'sharp_eye',     title: 'Tam İsabet',   description: 'Resmî sonuçla doğrulanan bir tam skor tutturdun.', icon: '🎯', points: 25, sort: 7 },
  { key: 'on_target',     title: 'Hedefte',      description: 'Resmî sonuçla doğrulanan 5 isabetin oldu.',        icon: '🏹', points: 20, sort: 8 },
  { key: 'veteran',       title: 'Emektar',      description: '10 farklı haftaya katıldın.',                      icon: '🏆', points: 50, sort: 9 },
  { key: 'level_5',       title: 'Seviye 5',     description: 'Seviye 5’e ulaştın.',                              icon: '🏅', points: 0,  sort: 10 },
  { key: 'level_10',      title: 'Seviye 10',    description: 'Seviye 10’a ulaştın.',                             icon: '🎖️', points: 0,  sort: 11 },
];

export const TASKS = [
  { key: 't_profile',     title: 'Profilini tamamla',        description: 'Bir avatar veya favori takım seç.',              icon: '🖼️', target: 1, points: 10, sort: 1 },
  { key: 't_first_lock',  title: 'İlk tahminini kilitle',    description: 'Bir maça skor tahmini kaydet.',                  icon: '🔒', target: 1, points: 10, sort: 2 },
  { key: 't_five_locks',  title: '5 maça tahmin kilitle',    description: 'Toplam 5 maça skor tahmini kaydet.',             icon: '🎯', target: 5, points: 15, sort: 3 },
  { key: 't_first_coupon',title: 'İlk kuponunu kaydet',      description: 'Kupon Merkezi’nde bir kupon kaydet.',            icon: '🧾', target: 1, points: 10, sort: 4 },
  { key: 't_poll',        title: 'Bir ankete katıl',         description: 'Topluluk anketinde oy kullan.',                  icon: '🗳️', target: 1, points: 5,  sort: 5 },
  { key: 't_comment',     title: 'Bir maça yorum yaz',       description: 'Herhangi bir maçın altına yorum bırak.',         icon: '💬', target: 1, points: 5,  sort: 6 },
  { key: 't_rounds_3',    title: '3 farklı haftaya katıl',   description: '3 ayrı haftanın bülteninde tahmin yap.',         icon: '📅', target: 3, points: 20, sort: 7 },
];

// ---------------------------------------------------------------------------
// SEVİYE — tek formül, tek kaynak.
// Seviye n'e ulaşmak için gereken TOPLAM puan: 25 · n · (n-1)
//   Seviye 1: 0 · Seviye 2: 50 · Seviye 3: 150 · Seviye 4: 300 · Seviye 5: 500 …
// ---------------------------------------------------------------------------
export const MAX_LEVEL = 50;

export function thresholdForLevel(level) {
  const n = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return 25 * n * (n - 1);
}

/** Toplam puandan seviye + ilerleme bilgisi üretir (saf fonksiyon). */
export function levelFromPoints(totalPoints) {
  const p = Math.max(0, Math.floor(Number(totalPoints) || 0));
  let level = 1;
  while (level < MAX_LEVEL && p >= thresholdForLevel(level + 1)) level += 1;
  const currentBase = thresholdForLevel(level);
  const nextAt = level >= MAX_LEVEL ? null : thresholdForLevel(level + 1);
  const progressPct = nextAt == null
    ? 100
    : Math.min(100, Math.round(((p - currentBase) / (nextAt - currentBase)) * 100));
  return { level, points: p, currentBase, nextAt, progressPct };
}

// ---------------------------------------------------------------------------
// PUAN KURALLARI — katılım eylem anında, isabet YALNIZ resmî sonuçla.
// grade → puan ölçeği lider tablosuyla TUTARLIDIR (grade × 5):
//   tam skor 5×5=25 · doğru sonuç 2×5=10 · anket MS 2×5=10 · alt-üst/KG 1×5=5
// ---------------------------------------------------------------------------
export const POINT_RULES = {
  lock_score: 5,    // skor tahmini kilitleme (maç başına bir kez)
  poll_vote: 2,     // anket oyu (maç+anket başına bir kez)
  player_vote: 2,   // maçın oyuncusu oyu (maç başına bir kez)
  lineup: 3,        // kadro tahmini (maç+takım başına bir kez)
  coupon_saved: 5,  // kupon kaydı (kupon başına bir kez)
  round_part: 5,    // haftaya katılım (resmî sonuçla mühürlenen haftada tahmini olan)
  ACC_MULTIPLIER: 5,
};
