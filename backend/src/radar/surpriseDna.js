// SÜRPRİZ DNA'SI — geçmiş sürpriz maçlarla ortak "genetik" sinyaller.
// Her özellik yalnız GERÇEK veri varken değerlendirilir; kaynak yoksa özellik
// 'unavailable' olarak raporlanır ve skora katılmaz (uydurma yok).
import { RADAR_IDS } from './config.js';
import { clamp } from './util.js';

// DNA özellik kataloğu: { key, label, maxPoints }
export const DNA_FEATURES = [
  { key: 'publicOverload', label: 'Aşırı halk yığılması', maxPoints: 15 },
  { key: 'fallingFavoriteXg', label: 'Favorinin xG desteği zayıf/düşüyor', maxPoints: 15 },
  { key: 'weakUnderlyingPerformance', label: 'Sonuçlara göre zayıf gerçek performans (sahte parlaklık)', maxPoints: 15 },
  { key: 'strongAwayForm', label: 'Güçlü deplasman formu', maxPoints: 15 },
  { key: 'oddsPublicInversion', label: 'Oran–oynanma yüzdesi tersliği', maxPoints: 15 },
  { key: 'squadIssue', label: 'Kadro sorunu', maxPoints: 10 },              // kaynak yok → unavailable
  { key: 'fixtureFatigue', label: 'Fikstür yorgunluğu', maxPoints: 10 },    // kaynak yok → unavailable
  { key: 'memoryAssist', label: 'Bülten hafızası yardımcı sinyali', maxPoints: 5 },
  { key: 'radarConsensus', label: 'Radarlar arası sürpriz uzlaşması', maxPoints: 15 },
];

export const DNA_VERSION = 'surprise-dna-1.1.0'; // 1.1.0: memoryAssist karar dışı (sıra sinyali nedensel değil)

// radars: { performance, expectation, publicBetting, market, bulletinMemory } çıktıları
export function computeSurpriseDna(radars, { surpriseAgreeThreshold = 65 } = {}) {
  const perf = radars[RADAR_IDS.PERFORMANCE];
  const exp = radars[RADAR_IDS.EXPECTATION];
  const pub = radars[RADAR_IDS.PUBLIC];
  const mkt = radars[RADAR_IDS.MARKET];
  const mem = radars[RADAR_IDS.MEMORY];

  const features = [];
  let earned = 0, possible = 0;
  const push = (key, state, points, note) => {
    const def = DNA_FEATURES.find((f) => f.key === key);
    features.push({ key, label: def.label, state, points: state === 'present' ? points : 0, maxPoints: def.maxPoints, note: note || null });
    if (state !== 'unavailable') {
      possible += def.maxPoints;
      if (state === 'present') earned += points;
    }
  };

  // 1) Aşırı halk yığılması
  if (pub?.hasData) {
    const over = pub.details?.overloaded;
    push('publicOverload', over ? 'present' : 'absent', over ? 15 : 0,
      over ? `Halkın %${Math.max(pub.details.consensus['1'], pub.details.consensus.X, pub.details.consensus['2'])}'i tek tarafta` : null);
  } else push('publicOverload', 'unavailable', 0, 'Oynanma yüzdesi kaynağı yok.');

  // 2) Favorinin xG desteği zayıf
  if (exp?.hasData) {
    const fake = !!exp.details?.fakeFavorite;
    push('fallingFavoriteXg', fake ? 'present' : 'absent', fake ? 15 : 0,
      fake ? 'Beklenti (xG) favoriyi desteklemiyor.' : null);
  } else push('fallingFavoriteXg', 'unavailable', 0, 'xG verisi yok.');

  // 3) Sonuçlara göre zayıf gerçek performans (gol-xG aşırı pozitif sapma)
  if (exp?.hasData) {
    const gm = exp.details?.goalMinusXg;
    const overH = gm?.home != null && gm.home >= 0.35;
    const overA = gm?.away != null && gm.away >= 0.35;
    const present = overH || overA;
    push('weakUnderlyingPerformance', present ? 'present' : 'absent', present ? 12 : 0,
      present ? `Gol üretimi xG'nin belirgin üzerinde (${overH ? 'ev' : 'deplasman'}) — sürdürülebilirlik riski.` : null);
  } else push('weakUnderlyingPerformance', 'unavailable', 0, 'xG verisi yok.');

  // 4) Güçlü deplasman formu (ev favorisine karşı klasik sürpriz geni)
  if (perf?.hasData) {
    const awayStrong = (perf.details?.awayWinRate != null && perf.details.awayWinRate >= 45)
      || perf.activeSignals?.some((s) => s.key === 'awayVenue');
    push('strongAwayForm', awayStrong ? 'present' : 'absent', awayStrong ? 12 : 0,
      awayStrong ? 'Deplasman dış sahada güçlü.' : null);
  } else push('strongAwayForm', 'unavailable', 0, 'Performans verisi yok.');

  // 5) Oran–oynanma tersliği
  if (mkt?.hasData && pub?.hasData) {
    const inv = !!mkt.details?.inversion;
    push('oddsPublicInversion', inv ? 'present' : 'absent', inv ? 15 : 0,
      inv ? 'Halk favoriye yığılırken piyasa olasılığı düştü.' : null);
  } else push('oddsPublicInversion', 'unavailable', 0, 'Halk verisi ve/veya oran serisi yok.');

  // 6-7) Kadro / fikstür — gerçek kaynak yok.
  push('squadIssue', 'unavailable', 0, 'Eksik/cezalı oyuncu kaynağı bağlı değil.');
  push('fixtureFatigue', 'unavailable', 0, 'Fikstür yoğunluğu verisi yok.');

  // 8) Bülten hafızası — KARARA KATILMAZ (Ağustos 2026 dürüstlük düzeltmesi).
  // Kupon sırasının maç sonucuyla nedensel bağı yoktur; sıra bazlı sinyal
  // DNA puanına giremez. Özellik anahtarı API sözleşmesi için korunur,
  // durumu kalıcı olarak 'unavailable'dır (payda dışı).
  void mem; // bilinçli: yalnız görüntü katmanında kullanılır
  push('memoryAssist', 'unavailable', 0, 'Sıra bazlı sinyal karara katılmaz (nedensel bağ yok); Radar 5 yalnız bilgi panelidir.');

  // 9) Radarlar arası sürpriz uzlaşması — Radar 5 hariç (sıra sinyali oy değildir).
  const withRisk = Object.entries(radars)
    .filter(([id, r]) => id !== RADAR_IDS.MEMORY && r?.hasData && r.favoriteFailureRisk != null)
    .map(([, r]) => r);
  const agreeing = withRisk.filter((r) => r.favoriteFailureRisk >= surpriseAgreeThreshold);
  if (withRisk.length >= 2) {
    const present = agreeing.length >= 2;
    push('radarConsensus', present ? 'present' : 'absent', present ? Math.min(15, agreeing.length * 6) : 0,
      present ? `${agreeing.length} radar risk sinyalini yüksek görüyor.` : null);
  } else push('radarConsensus', 'unavailable', 0, 'Kıyas için yeterli aktif radar yok.');

  // Skor: kazanılan / DEĞERLENDİRİLEBİLEN puanlar (unavailable payda dışı).
  const score = possible > 0 ? clamp(Math.round((earned / possible) * 100), 0, 100) : 0;
  return {
    version: DNA_VERSION,
    surpriseDnaScore: score,
    evaluatedPoints: possible,
    matchedFeatures: features.filter((f) => f.state === 'present').map((f) => f.key),
    features,
    surpriseAgreeingRadars: agreeing.map((r) => r.id),
  };
}
