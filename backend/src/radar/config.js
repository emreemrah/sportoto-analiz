// RADAR MERKEZİ — sürümlü/configurable ayarlar (tek kaynak).
// Bu değerler İLK SÜRÜM başlangıç değerleridir; değiştirilirse
// METHODOLOGY_VERSION artırılmalıdır (eski bültenler eski sürümle mühürlü kalır).

// 1.2.0: Radar 5 (Bülten DNA) karar tabanından çıkarıldı — kupon sırasının
// sonuçla nedensel bağı yoktur; kart yalnız bilgi panelidir (Ağustos 2026).
// 1.3.0: DÜŞEN-FAVORİ oynanma hareketi skora bağlandı (Ağustos 2026). Eskiden
// yalnız YÜKSELEN hareket sinyal olabiliyordu; kalabalığın favoriden kaçışı
// (ör. 1 %61→%44) sadece panel metniydi ve sayısal etkisi SIFIRDI. Artık:
// (a) en büyük YÜKSELİŞ kendi tarafına sinyal verir (büyük bir düşüş artık
// yükselişi maskelemez), (b) favorideki büyük düşüş failureRisk'e katkı yapar.
// 1.4.0 (2026-08-10, Master gözden geçirmesi): (a) SINIF ÜRETİLMEDİYSE TAHMİN
// DE ÜRETİLMEZ — insufficient_data'da mainPrediction/alternatif/exactDirection/
// confidence null döner (favorite+scores bilgi olarak kalır); karne bu maçları
// artık genel isabete saymaz. Sezon başında tek kaynak (halk yüzdesi) "Favori
// %88 · Güven %95" üretebiliyordu. (b) GÜVENE KAYNAK ÇEŞİTLİLİĞİ TAVANI —
// 2 aktif radarla güven %70'i aşamaz; 3+ radar eski tavanda (95).
export const METHODOLOGY_VERSION = 'radar-center-1.4.0';

export const RADAR_IDS = {
  PERFORMANCE: 'performance',
  EXPECTATION: 'expectation',
  PUBLIC: 'publicBetting',
  MARKET: 'market',
  MEMORY: 'bulletinMemory',
};

// Kullanıcı dili sadeleştirmesi: Radar 1 "Rakip Gücü", Radar 3 "Oynanma DNA"
// (kullanıcıların oynama YÜZDESİ), Radar 4 "Oran Takibi" (bahis sitesi GERÇEK
// 1/X/2 ORANLARININ günlük hareketi — yüzde değil), Radar 5 "Bülten DNA". Eski
// bültenler eski adla mühürlü kalır (snapshot).
export const RADAR_META = {
  [RADAR_IDS.PERFORMANCE]: { name: 'Radar 1 · Rakip Gücü', version: 'performance-1.1.0' },
  [RADAR_IDS.EXPECTATION]: { name: 'Radar 2 · xG / Beklenti-Gerçeklik', version: 'expectation-2.0.0' },
  [RADAR_IDS.PUBLIC]: { name: 'Radar 3 · Oynanma DNA', version: 'public-1.1.0' },
  [RADAR_IDS.MARKET]: { name: 'Radar 4 · Oran Takibi', sub: 'Günlük 1/X/2 Oranları', version: 'market-1.1.0' },
  [RADAR_IDS.MEMORY]: { name: 'Radar 5 · Bülten DNA', version: 'memory-1.1.0' },
};

// Başlangıç ağırlıkları (%). Verisi olmayan radarın ağırlığı SIFIRLANIR ve
// kalan aktif radarlar 100'e yeniden normalize edilir (nötr 50 hilesi YOK).
export const BASE_WEIGHTS = {
  [RADAR_IDS.PERFORMANCE]: 30,
  [RADAR_IDS.EXPECTATION]: 25,
  [RADAR_IDS.PUBLIC]: 20,
  [RADAR_IDS.MARKET]: 15,
  [RADAR_IDS.MEMORY]: 10,
};

// Radar 5 tek başına/aşırı etkili olamaz: normalize sonrası ağırlığı bu tavanla
// sınırlanır (artan pay diğer aktif radarlara dağıtılır).
export const MEMORY_WEIGHT_CAP = 15;

// favoriteFailureRisk sınıf bantları (0-100)
export const CLASS_BANDS = {
  strongMax: 34,     // 0–34  → Banko/Güçlü Aday değerlendirme bandı
  mediumMax: 64,     // 35–64 → Orta Risk
  // 65–100 → Sürpriz Adayı bandı
};

// Sınıf üretimi için asgari şartlar
export const GATES = {
  minActiveRadars: 2,          // altında: insufficient_data
  minMasterDataQuality: 50,    // altında: insufficient_data
  strong: {
    minActiveRadars: 3,
    minDataQuality: 70,
    minFavoriteProb: 60,       // favorinin tahmini kazanma olasılığı (%)
    minPredictionGap: 12,      // ana tercih ile ikinci arasında puan farkı (belirginlik)
    maxConflict: 45,           // radar çatışma puanı bu değerin ÜZERİNDEyse banko verilmez
  },
  surprise: {
    minRadarsAgreeing: 2,      // sürpriz yönünde sinyal veren bağımsız radar sayısı
    minDataQuality: 60,
    minFailureRisk: 65,
    radarFailureRiskSignal: 65, // bir radarın "sürpriz yönünde" sayılması için eşiği
  },
};

// Halk oynanma yüzdesi bantları (Radar 3) — sürümlü.
export const PUBLIC_BANDS = {
  version: 'public-bands-1.0.0',
  bands: [
    { min: 50, max: 59, label: '%50–59' },
    { min: 60, max: 69, label: '%60–69' },
    { min: 70, max: 79, label: '%70–79' },
    { min: 80, max: 89, label: '%80–89' },
    { min: 90, max: 100, label: '%90+' },
  ],
  overloadThreshold: 70,       // "aşırı yığılma" sinyali eşiği (%)
};

// Örneklem güven merdiveni (Radar 3 bant geçmişi + Radar 5 hafıza)
export const SAMPLE_LADDER = [
  { min: 0, max: 9, label: 'Yetersiz', usable: false },
  { min: 10, max: 29, label: 'Düşük güven', usable: true },
  { min: 30, max: 99, label: 'Orta güven', usable: true },
  { min: 100, max: Infinity, label: 'Güçlü örneklem', usable: true },
];

export function sampleConfidence(n) {
  const row = SAMPLE_LADDER.find((r) => n >= r.min && n <= r.max) || SAMPLE_LADDER[0];
  return { n, label: row.label, usable: row.usable };
}

// Radar 3 oynanma HAREKETİ kuralları (açılış→mühür yüzde kayması).
// Eşikler kaynak-ortalaması puan cinsindendir.
export const PUBLIC_MOVE_RULES = {
  movePts: 6,          // yükselen tarafın sinyal olması için asgari kayma
  dropPts: 10,         // favorideki düşüşün RİSKE sayılması için asgari kayma
  // Favori-düşüş risk katkısı Radar 4'ün oran-drift katkısıyla (+12) aynı
  // büyüklükte tutulur: iki radar aynı olguyu (paranın favoriden kaçışı)
  // farklı kaynaktan ölçer; biri diğerinden yapısal olarak baskın olmamalı.
  dropFailureBump: 12,
};

// Radar 4 piyasa hareketi kuralları
export const MARKET_RULES = {
  minObservationsForMovement: 2,   // TEK gözlemle "hareket" ÜRETİLMEZ
  driftSignalPts: 3,               // normalize olasılıkta ≥3 puan değişim → sürüklenme sinyali
  sharpMovePts: 4,                 // geç/sert hareket eşiği
  sharpWindowHours: 6,             // kilit öncesi "geç" pencere
};

// Sinyal aileleri: aynı bilgiyi ölçen sinyaller bağımsız oy gibi TEKRAR sayılmaz.
export const SIGNAL_FAMILIES = {
  FORM: 'form',
  GOALS_XG: 'goals_xg',
  VENUE: 'venue',
  TABLE: 'table',
  MARKET: 'market',
  PUBLIC: 'public',
  SQUAD: 'squad',
  FIXTURE: 'fixture',
  MEMORY: 'memory',
};

// Aile içi azalan katkı: en güçlü sinyal tam, ikinci %50, üçüncü %25, sonrası %10.
export const FAMILY_DECAY = [1, 0.5, 0.25, 0.1];

export const FAMILY_LABELS = {
  form: 'Form', goals_xg: 'Gol / xG', venue: 'İç Saha / Deplasman', table: 'Puan Tablosu',
  market: 'Oran', public: 'Halk Eğilimi', squad: 'Kadro', fixture: 'Fikstür', memory: 'Bülten Hafızası',
};

export const CLASSIFICATIONS = {
  STRONG: 'strong_candidate',
  MEDIUM: 'medium_risk',
  SURPRISE: 'surprise_candidate',
  INSUFFICIENT: 'insufficient_data',
};

// Kullanıcı dili: "Orta Risk"→"Karışık Sinyal", "Sürpriz Adayı"→"Sürpriz
// Sinyali", "Yetersiz Veri"→"Analiz Hazır Değil". Anahtarlar (API sözleşmesi)
// DEĞİŞMEZ. "Temkinli" → "Karışık Sinyal" (Ağustos 2026): kullanıcı isteğiyle
// güvenli/riskli çağrışımlı dil tamamen kaldırıldı; sınıfın gerçek anlamı da
// budur — radarlar aynı yönde birleşmedi.
export const CLASSIFICATION_LABELS = {
  strong_candidate: 'Güçlü Aday',   // "banko" kesinlik iddiası TAŞIMAZ — aday dili
  medium_risk: 'Karışık Sinyal',
  surprise_candidate: 'Sürpriz Sinyali',
  insufficient_data: 'Analiz Hazır Değil',
};

// İnsan-okunur metodoloji özeti (API /api/radar/methodology bunu döner)
export const METHODOLOGY_NOTES = [
  'Yalnız resmî 90 dakika 1/X/2 sonucu kullanılır; ilk yarı skoru hiçbir hesapta yer almaz.',
  '"Banko" kesin kazanır anlamında kullanılmaz; en iyi ihtimalle "Güçlü Aday"dır ve garanti değildir.',
  'Verisi olmayan radar karara nötr puanla dahil edilmez; ağırlığı sıfırlanır ve kalan radarlar yeniden normalize edilir.',
  'Radar 1 (Rakip Gücü) rakip seviyesini MAÇ TARİHİNDEKİ tabloya göre sınıflar; bugünkü tablo geçmişe uygulanmaz. Ev sahibi yalnız iç saha, deplasman yalnız deplasman maçlarıyla değerlendirilir.',
  'Radar 3 (Oynanma DNA) gerçek oynanma yüzdesi sağlayıcılarından beslenir; kaynak yoksa uydurma yüzde gösterilmez. Oynanma yüzdesi oran DEĞİLDİR. İlk maçtan 5 dk öncesi son geçerli veridir; sonrası yalnız araştırma amaçlı saklanır ve tahmine giremez.',
  'Radar 4 (Oran Takibi) gerçek 1/X/2 maç oranlarının gün gün hareketini gösterir (yüzde değil). Her günün oranı 23:55 Europe/Istanbul (maç günü ilk maçtan 5 dk önce) itibarıyla o gün gerçekten alınmış SON gözlemle mühürlenir ve sonradan değişmez; o güne ait gözlem yoksa geriye dönük oran ÜRETİLMEZ ("Bu gün için oran kaydı yok"). Radar 3 oynanma yüzdesi, Radar 4 gerçek orandır — karıştırılmaz.',
  'Radar 5 (Bülten DNA) yalnız doğrulanmış resmî geçmiş arşiv + mühürlü ileri-test haftalarından beslenir; bir haftanın sonucu en erken SONRAKİ bültenden itibaren kullanılabilir. Kupon sırasının maç sonucuyla nedensel bağı olmadığı için bu radar MASTER KARARA VE SINIFLANDIRMAYA KATILMAZ — yalnız istatistiksel bilgi panelidir (radar-center-1.2.0).',
  'Sakatlık/ceza listesi gibi yapısal olarak sağlanmayan alanlar "desteklenmiyor" sayılır; veri yeterliliği puanını DÜŞÜRMEZ ve her kartta tekrar tekrar gösterilmez.',
  'Radar çıktıları bülten kilidiyle snapshot içine mühürlenir; kilit sonrası yeniden hesaplanmaz.',
];
