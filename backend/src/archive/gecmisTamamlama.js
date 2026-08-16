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
//  * Eşleşme güvencesi: sıra numarası VE ev sahibi adı tutmalı. Yanlış
//    haftanın kaydı ya da sıra kayması olursa hiçbir şey değişmez —
//    yanlış maça yanlış arma yazmak, armasız bırakmaktan kötüdür.
//  * Canlı yanıtta zaten olan değerin üstüne YAZILMAZ.

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
    // Sıra kayması koruması.
    if (kayit.home?.name && mm.home?.name && kayit.home.name !== mm.home.name) continue;

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
