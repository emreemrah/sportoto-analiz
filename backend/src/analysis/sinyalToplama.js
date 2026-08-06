// ---------------------------------------------------------------------------
// SİNYAL KAYIT TOPLAYICI — mühürlü arşivden "maç bazlı satır" üretir
// ---------------------------------------------------------------------------
// Bu dosya VERİ TOPLAR; kırılımı `sinyalKirilim.js` hesaplar. Ayrım bilinçli:
// hesap saf ve testli kalsın, veritabanına dokunan kısım ayrı dursun.
//
// ÜRETİLEN SATIR (kırılım motorunun beklediği biçim):
//   { roundId, hafta, no, sonuc, skor, home, away, sinyal, oynanma }
//
// KAYNAKLAR VE NEDEN
//  • Mühürlü snapshot  → `no`, kriter sinyalleri (catalogEvaluations),
//                        radar sinyalleri (radarCenter.radars)
//  • Resmî sonuçlar    → `officialResult`, `orderNo`, `fullTimeScore`
//  • Oynanma DNA       → haftanın SON günündeki 1/X/2 yüzdeleri
//
// RESMÎ İLERİ-TEST KAPISI AYNEN GEÇERLİ: maç öncesi mühürlendiği
// DOĞRULANMAYAN hafta buraya girmez. Kriter karnesiyle aynı kapı kullanılır
// (analysisService.js ile aynı `classifyRecord` çağrısı) — iki ekran farklı
// örneklem gösterirse hangisine güvenileceği belirsizleşir.
//
// EKSİK VERİ SESSİZCE 0 OLMAZ: oynanma yüzdesi yoksa `oynanma: null` döner.
// Kırılım motoru null'ı ortalamaya katmaz (bkz. sinyalKirilim.js → `sayi`).
import { getArchiveStore } from '../archive/store.js';
import { classifyRecord, recordFromArchive } from '../scorecards/provenance.js';
import { collectPlayedDnaRecords } from '../radar/playedDnaArchive.js';
import { sonGunOynanmaIndeksi } from '../radar/siraOynanma.js';
import { CATALOG_MAP } from './criterionCatalog.js';

/** Radar numarası → snapshot içindeki radar anahtarı eşlemesi. */
export const RADARLAR = Object.freeze([
  { no: 1, key: 'performance', ad: 'Radar 1 · Rakip Gücü' },
  { no: 2, key: 'expectation', ad: 'Radar 2 · xG' },
  { no: 3, key: 'publicBetting', ad: 'Radar 3 · Oynanma DNA' },
  { no: 4, key: 'market', ad: 'Radar 4 · Oran Takibi' },
  { no: 5, key: 'bulletinMemory', ad: 'Radar 5 · Bülten DNA' },
]);

/**
 * Bir radarın maç bazlı YÖNÜNÜ çıkarır.
 *
 * Radarlar tek bir "1/X/2" demez; ağırlıklı sinyaller üretir. Yön, aktif
 * sinyallerin AĞIRLIKLI çoğunluğudur. Hiç aktif sinyal yoksa (ya da denge
 * varsa) `null` döner — "yön göstermedi" demektir ve başarı toplamına girmez.
 *
 * NEDEN AĞIRLIK: bir radarda üç zayıf sinyal bir güçlü sinyali ezerse, radarın
 * gerçekte söylediği şey kaybolur. Ağırlıklar snapshot'ta zaten yazılı.
 */
export function radarYonu(radar) {
  const sinyaller = radar?.activeSignals;
  if (!Array.isArray(sinyaller) || !sinyaller.length) return null;
  const puan = { 1: 0, X: 0, 2: 0 };
  let toplam = 0;
  for (const s of sinyaller) {
    const yon = s?.side === 'home' ? '1' : s?.side === 'away' ? '2' : s?.side === 'draw' ? 'X' : null;
    if (!yon) continue;
    const w = Number.isFinite(Number(s.weight)) ? Math.abs(Number(s.weight)) : 1;
    puan[yon] += w;
    toplam += w;
  }
  if (!toplam) return null;
  const sirali = Object.entries(puan).sort((a, b) => b[1] - a[1]);
  // BERABERLİK DURUMU: en yüksek iki yön eşitse yön YOK sayılır. Rastgele
  // birini seçmek, olmayan bir kararlılığı varmış gibi göstermek olurdu.
  if (sirali[0][1] === sirali[1][1]) return null;
  return sirali[0][0];
}

/**
 * Mühürlü arşivden seçilen sinyal için maç bazlı kayıtları toplar.
 *
 * @param {object} opt
 *   tur: 'kriter' | 'radar' | 'master'
 *   key: kriter anahtarı ('xgAgainst' gibi) veya radar anahtarı
 * @returns {{kayitlar: Array, kapsam: object}}
 */
export async function sinyalKayitlariniTopla({ tur = 'kriter', key = null, store = getArchiveStore() } = {}) {
  const bulletins = (await store.listBulletins()).sort((x, y) => y.roundId - x.roundId);

  const kayitlar = [];
  const kapsam = {
    haftaToplam: bulletins.length,
    haftaDahil: 0,
    haftaDislanan: 0,
    dislamaTuru: {},
    macToplam: 0,
    oynanmaOlan: 0,
    sinyalOlan: 0,
    katmanYok: 0,          // eski snapshot: analysisCenter/radarCenter yok
    oynanmaKaydi: 0,       // DNA arşivinden kaç ham kayıt okundu
    oynanmaHatasi: null,   // okunamadıysa SEBEBİ (sessizce yutulmasın)
  };

  // Oynanma yüzdeleri: TEK SEFERDE okunur, hafta hafta sorgu atılmaz.
  // Kaynak sabit 'nesine' — projedeki tek etkin oynanma sağlayıcısı.
  //
  // HATA DÜZELTMESİ (2026-08-06): `collectPlayedDnaRecords()` STORE bekliyor
  // ve varsayılanı yok. Argümansız çağrılınca `store.listBulletins()` patlıyor,
  // hata aşağıdaki catch'te yutuluyor ve HER maç "oynanma verisi yok"
  // görünüyordu. Sessiz catch, hatayı gizleyerek yanlış ekrana yol açtı;
  // artık sebep `kapsam.oynanmaHatasi` ile DIŞARI bildiriliyor.
  let oynanmaIndeks = new Map();
  try {
    const dnaKayit = await collectPlayedDnaRecords(store);
    oynanmaIndeks = sonGunOynanmaIndeksi(dnaKayit, 'nesine') || new Map();
    kapsam.oynanmaKaydi = dnaKayit.length;
  } catch (e) {
    oynanmaIndeks = new Map();
    kapsam.oynanmaHatasi = String(e?.message || e).slice(0, 200);
  }

  for (const b of bulletins) {
    const snap = await store.getSnapshot(b.id).catch(() => null);
    if (!snap?.payload?.matches?.length) continue;

    // AYNI KAPI: kriter karnesiyle birebir aynı provenance kuralı.
    const cls = classifyRecord(recordFromArchive(b, snap), { requireOfficialProfile: false });
    if (!cls.isOfficialForward) {
      kapsam.haftaDislanan += 1;
      kapsam.dislamaTuru[cls.provenanceType] = (kapsam.dislamaTuru[cls.provenanceType] || 0) + 1;
      continue;
    }

    const sonuclar = await store.listOfficialResults(b.id).catch(() => []);
    if (!sonuclar.length) continue;
    // orderNo ve skor DÜŞÜRÜLMÜYOR: sıra kırılımı için ikisi de gerekli.
    const sonucBy = new Map(sonuclar.map((r) => [String(r.matchId), r]));

    kapsam.haftaDahil += 1;

    for (const pm of snap.payload.matches) {
      const res = sonucBy.get(String(pm.matchId));
      if (!res?.officialResult) continue;              // resmî sonuç yoksa sayılmaz
      kapsam.macToplam += 1;

      const no = Number(pm.no ?? res.orderNo);
      let sinyal = null;

      if (tur === 'kriter') {
        const ev = (pm.analysisCenter?.catalogEvaluations || []).find((x) => x.key === key);
        if (!pm.analysisCenter) kapsam.katmanYok += 1;
        sinyal = ev && ev.available && ev.signal ? ev.signal : null;
      } else if (tur === 'radar') {
        const r = pm.radarCenter?.radars?.[key] || pm.radar?.[key] || null;
        if (!pm.radarCenter) kapsam.katmanYok += 1;
        sinyal = radarYonu(r);
      } else if (tur === 'master') {
        sinyal = pm.analysisCenter?.officialMasterAnalysis?.mainPrediction
          || pm.radarCenter?.master?.mainPrediction || null;
        // Çoklu tahmin ("1X") tek yönlü sayılmaz — kırılım tek sonuca bakar.
        if (sinyal && String(sinyal).length !== 1) sinyal = null;
      }
      if (sinyal) kapsam.sinyalOlan += 1;

      const oyn = oynanmaIndeks.get(`${b.roundId}|${no}`) || null;
      if (oyn?.pct) kapsam.oynanmaOlan += 1;

      kayitlar.push({
        roundId: Number(b.roundId),
        hafta: b.week || snap.payload?.bulletin?.week || `#${b.roundId}`,
        no,
        sonuc: res.officialResult,
        skor: res.fullTimeScore ? `${res.fullTimeScore.home}-${res.fullTimeScore.away}` : null,
        home: pm.home?.name || null,
        away: pm.away?.name || null,
        sinyal,
        oynanma: oyn?.pct || null,
        // ORAN: maç öncesi mühürlenmiş oran. Detay satırında gösterilir —
        // "1 maçta 1 doğru" yazıp hangi maç olduğunu söylememek işi yarım
        // bırakmaktı (kullanıcı bildirimi, 2026-08-06).
        oran: pm.market?.odds || null,
        lig: pm.league || null,
        tarih: pm.kickoffAt || null,
      });
    }
  }

  return { kayitlar, kapsam };
}

/**
 * Seçilebilir sinyallerin listesi (panelin açılır menüsü için).
 * Kriter adları katalogdan gelir; uydurma etiket üretilmez.
 */
export async function sinyalKatalogu({ store = getArchiveStore() } = {}) {
  const kriterler = [];
  try {
    const bulletins = (await store.listBulletins()).sort((x, y) => y.roundId - x.roundId);
    for (const b of bulletins.slice(0, 5)) {
      const snap = await store.getSnapshot(b.id).catch(() => null);
      const ilk = snap?.payload?.matches?.find((m) => m.analysisCenter?.catalogEvaluations?.length);
      if (!ilk) continue;
      for (const ev of ilk.analysisCenter.catalogEvaluations) {
        if (!kriterler.some((k) => k.key === ev.key)) {
          // Etiket KATALOGDAN gelir; snapshot yalnız anahtarı taşır. Anahtarı
          // ekrana yazmak ("xgAgainst") kullanıcı için anlamsız olurdu.
          const kat = CATALOG_MAP[ev.key];
          kriterler.push({
            key: ev.key,
            ad: kat?.label || ev.key,
            aile: ev.signalFamily || kat?.family || null,
            bilgi: !!kat?.informational,
          });
        }
      }
      if (kriterler.length) break;
    }
  } catch { /* katalog okunamadı — boş liste döner, uydurma isim yazılmaz */ }

  return {
    kriterler,
    radarlar: RADARLAR.map((r) => ({ key: r.key, ad: r.ad, no: r.no })),
    master: { key: 'master', ad: 'Master Analiz (ana tahmin)' },
  };
}
