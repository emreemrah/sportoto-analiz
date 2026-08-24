// GEÇMİŞ HAFTA GÖRÜNTÜSÜNÜ MÜHÜRLÜ ARŞİVDEN TAMAMLAMA.
//
// Resmî Spor Toto geçmiş bülteni iki şeyi eksik döner:
//
//  1. LİG ADI genel bir metindir ("2026/2027 Sezonu"). Bu metinden ülke
//     çıkarılamadığı için uygulamada bayrak çizilemiyordu.
//  2. ARMA HİÇ YOKTUR. Armalar `crestRegistry` defterinden gelir, defter ise
//     DOSYA ÖNBELLEĞİNDE tutulur (`cache.js`). Render'ın diski kalıcı değil:
//     her deploy defteri siler. Güncel hafta açılış yenilemesinde armalarını
//     yeniden toplar, GEÇMİŞ hafta toplamaz.
//
//     Üretimde ölçüldü (16 Ağustos 2026, deploy sonrası): `/api/history/1528`
//     → 15 maçın 15'i armasız (Galatasaray dahil); aynı uç yerelde 0 eksik.
//
// Aynı haftanın MÜHÜRLÜ arşiv kaydı ikisini de taşır (kayıt, bülten
// yayındayken zenginleştirilmiş veriden alınmıştı) ve arşiv veritabanında
// durduğu için deploy'dan etkilenmez.
//
// KURALLAR:
//  * Arşive buradan HİÇBİR ŞEY YAZILMAZ — yalnız okunur.
//  * Uydurma yok: yalnız arşivde GERÇEKTEN duran değer taşınır.
//  * Eşleşme güvencesi: sıra numarası VE İKİ TAKIMIN ADI tutmalı. Yanlış
//    haftanın kaydı ya da sıra kayması olursa hiçbir şey değişmez —
//    yanlış maça yanlış arma yazmak, armasız bırakmaktan kötüdür.
//  * Canlı yanıtta zaten olan değerin üstüne YAZILMAZ.

import { normalizeName, nameTokens } from '../matcher.js';
import { lookupCrest } from '../crestRegistry.js';

// AD EŞLEŞMESİ SPONSOR ÖNEKİNE TAKILMAMALI (16 Ağustos 2026, üretimde ölçüldü).
//
// İlk sürüm ham `===` karşılaştırıyordu ve deploy sonrası 15 maçın 13'ünü
// tamamlarken 2'sini atlamıştı — çünkü resmî geçmiş bülten ile arşiv aynı
// takımı FARKLI sponsor önekiyle yazıyor:
//
//   maç 3: "Tümosan Konyaspor"    ↔ arşiv "Konyaspor"
//   maç 6: "İstanbul Başakşehir"  ↔ arşiv "Rams Başakşehir"
//
// Armalar arşivde VARDI; engel benim karşılaştırmamdı.
//
// GEVŞETİRKEN GÜVENLİK KAYBEDİLMEZ: eşleşme artık ayırt edici kelime
// örtüşmesine bakar (`nameTokens` — jenerik ekler ve kısa kelimeler zaten
// ayıklanmış) ve İKİ TAKIMIN DA tutması aranır. Sıra kaymasında iki takımın
// birden örtüşmesi gerekirdi; pratikte imkânsız. "Fenerbahçe ↔ Galatasaray"
// gibi gerçek uyuşmazlıklar hiçbir kelimede kesişmediği için REDDEDİLİR.
function adTutuyor(a, b) {
  if (!a || !b) return true; // taraf adı bilinmiyorsa engel çıkarma
  if (normalizeName(a) === normalizeName(b)) return true;
  const ja = nameTokens(a);
  const jb = nameTokens(b);
  for (const t of ja) if (jb.has ? jb.has(t) : jb.includes(t)) return true;
  return false;
}

/// `maclar` listesini `arsivMaclar` (mühürlü snapshot payload'ı) ile
/// tamamlar. Listeyi YERİNDE günceller ve kaç alanın tamamlandığını döner.
export function arsivdenTamamla(maclar, arsivMaclar) {
  const sonuc = { lig: 0, arma: 0 };
  if (!Array.isArray(maclar) || !Array.isArray(arsivMaclar)) return sonuc;

  const kayitlar = new Map(
    arsivMaclar.filter((m) => m && m.no != null).map((m) => [m.no, m]),
  );

  for (const mm of maclar) {
    if (!mm) continue;
    const kayit = kayitlar.get(mm.no);
    if (!kayit) continue;
    // SIRA KAYMASI KORUMASI — İKİ TARAF DA tutmalı.
    if (!adTutuyor(mm.home?.name, kayit.home?.name)) continue;
    if (!adTutuyor(mm.away?.name, kayit.away?.name)) continue;

    if (kayit.league && mm.league !== kayit.league) {
      mm.league = kayit.league;
      sonuc.lig++;
    }
    if (!mm.home?.logo && kayit.home?.logo) {
      mm.home = { ...mm.home, logo: kayit.home.logo };
      sonuc.arma++;
    }
    if (!mm.away?.logo && kayit.away?.logo) {
      mm.away = { ...mm.away, logo: kayit.away.logo };
      sonuc.arma++;
    }
  }
  return sonuc;
}

// ————————————————————————————————————————————————————————————————————————
// SİSTEM TAHMİNİ (PICK) GERİ YÜKLEME — SAF BİRLEŞTİRME (24 Ağustos 2026).
//
// GERÇEK OLAY (2. Hafta / 1529): geçmiş bültenin "Sistem tahmini" ve geçici
// skor kimliği (footyMatchId) YALNIZ yerel `cache/snapshot-<roundId>.json`
// dosyasından okunuyordu. O dosya kalıcı değil (Render diski her deploy'da
// silinir; yerelde de cache temizliği/bozuk refresh aynı sonucu doğurur).
// Mühürlü arşiv aynı bilgiyi KALICI taşır: systemPrediction (symbol/label),
// armalar ve externalIds.footyMatchId/footySwapped.
//
// KURALLAR (dosyanın geri kalanıyla aynı):
//  * Uydurma yok: yalnız arşivde GERÇEKTEN duran değer taşınır.
//  * Yereldeki DOLU değer EZİLMEZ: yalnız eksik/null alan arşivden dolar.
//    symbol '-' = "VERİ YOK" mührü → DOLU sayılır, üstüne yazılmaz;
//    symbol null = kayıp/hasarlı kayıt → mühürden dolar.
//  * footySwapped, kimliğin geldiği KAYNAĞI izler (yerel id → yerel swap,
//    arşiv id → arşiv swap) — id ile swap ayrışırsa skor ters basılır.

/// Yerel snapshot picks'i ile mühürlü arşiv maçlarını birleştirir.
/// Kullanılabilir pick listesi döner; arşiv de boşsa null (dosya yazılmasın).
export function arsivdenPickBirlestir(yerelPicks, arsivMaclar) {
  if (!Array.isArray(arsivMaclar) || !arsivMaclar.length) return null;

  const arsivByNo = new Map(
    arsivMaclar.filter((m) => m && m.no != null).map((m) => [m.no, m]),
  );
  const yerelByNo = new Map(
    (yerelPicks || []).filter((p) => p && p.no != null).map((p) => [p.no, p]),
  );
  const nolar = [...new Set([...arsivByNo.keys(), ...yerelByNo.keys()])]
    .sort((a, b) => a - b);

  const picks = nolar.map((no) => {
    const p = yerelByNo.get(no) || {};
    const a = arsivByNo.get(no);
    const sp = a?.systemPrediction;
    return {
      ...p,
      no,
      symbol: p.symbol != null ? p.symbol : (sp?.symbol ?? null),
      // Etiket tahminle birlikte gelir: yerel tahmin duruyorsa yerel etiket,
      // tahmin arşivden geldiyse arşiv etiketi (karışık çift oluşmaz).
      label: p.symbol != null ? (p.label ?? null) : (sp?.label ?? null),
      homeLogo: p.homeLogo || a?.home?.logo || '',
      awayLogo: p.awayLogo || a?.away?.logo || '',
      homeRec: p.homeRec ?? null,
      awayRec: p.awayRec ?? null,
      footyMatchId: p.footyMatchId ?? a?.externalIds?.footyMatchId ?? null,
      footySwapped: p.footyMatchId != null
        ? (p.footySwapped ?? false)
        : (a?.externalIds?.footyMatchId != null ? (a?.externalIds?.footySwapped ?? false) : false),
      criteria: p.criteria ?? a?.criteria?.signals ?? null,
    };
  });
  return picks.some((x) => x.symbol != null) ? picks : null;
}

// ————————————————————————————————————————————————————————————————————————
// İKİNCİ AŞAMA: ARŞİVİ OLMAYAN HAFTALAR İÇİN AD EŞLEŞTİRMESİ
//
// `arsivdenTamamla` yalnız MÜHÜRLÜ kaydı olan haftayı kurtarabilir. Arşivde
// 6 bülten var; ölçüldü (yerel):
//   49. Hafta (1521, arşivde VAR) → armasız 0/15
//   48. Hafta (1520, arşivde YOK) → armasız 15/15
// Aynı kulüpler (Mjallby, Malmö, Göteborg, AIK) 49'da armalı, 48'de armasız
// görünüyordu — yani arma BİLİNİYOR, yalnız o haftaya bağlanamıyordu.
//
// KANIT GÜCÜ FARKLIDIR, BU YÜZDEN AYRI ADIM: arşiv, O HAFTA İÇİN mühürlenmiş
// değerdir; defter ise kulüp adından çözülen armadır. Önce arşiv denenir,
// yalnız BOŞ kalan yerler deftere sorulur. `logoSource` ile hangisinden
// geldiği yanıtta kalır.
//
// UYDURMA YOK: `lookupCrest` katmanlı ve default-deny çalışır (tam ad →
// içerme → slug → jeton; gevşek katmanlarda işaret koruması, birden fazla
// aday çıkarsa REDDEDER). Bulunamayan taraf BOŞ bırakılır — ekranda kulüp
// baş harfleri çizilir, yanlış arma çizilmez.

/// Boş kalan arma yerlerini arma kayıt defterinden doldurur.
/// Dolu olanı ASLA ezmez (arşivden gelen değer korunur).
export function defterdenArmaTamamla(maclar, index) {
  const sonuc = { arma: 0, bulunamayan: [] };
  if (!Array.isArray(maclar) || !index) return sonuc;

  for (const mm of maclar) {
    for (const yon of ['home', 'away']) {
      const t = mm?.[yon];
      if (!t || t.logo) continue;              // dolu → dokunma
      let hit = null;
      try { hit = lookupCrest(t, index); } catch { hit = null; }
      if (!hit?.image) {
        if (t.name) sonuc.bulunamayan.push(t.name);
        continue;                              // bulunamadı → BOŞ kalır
      }
      mm[yon] = {
        ...t,
        logo: hit.image,
        logoSource: 'registry',
        logoMatchedBy: hit.matchedBy || null,
      };
      sonuc.arma++;
    }
  }
  return sonuc;
}
