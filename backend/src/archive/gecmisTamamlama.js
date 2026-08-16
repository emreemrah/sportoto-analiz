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
