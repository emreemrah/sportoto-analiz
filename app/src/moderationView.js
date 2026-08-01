// ---------------------------------------------------------------------------
// İNCELEME EKRANININ SAF MANTIĞI (E9 — üçüncü şart)
// ---------------------------------------------------------------------------
// Ekranın kendisi (screens/ModerationScreen.js) JSX içerdiği için birim testte
// içeri alınamaz. Karar veren küçük parçalar bu yüzden burada, saf işlevler
// hâlinde durur ve app/test/moderation-panel.test.mjs bunları ÖLÇER.
//
// ═══ BU DOSYANIN DEĞİŞMEZ KURALI ═══
// Buradaki hiçbir işlev BİLDİREN kişiyi tanımlayan bir şey üretmez. Sunucu
// zaten bildiren kimliğini döndürmüyor; ekranın da böyle bir alanı okumaya
// çalışmaması gerekir ki uç bir gün fazladan alan döndürürse o alan sessizce
// arayüze düşmesin.
//
// ═══ DÜRÜSTLÜK ═══
// Özet satırları sunucudan gelen sayıları OLDUĞU GİBİ anlatır. "5 bildirim
// vardı, 4 gördüm" durumu gizlenmez: silinmiş yoruma ait bildirimler ayrıca
// yazılır, listenin kesildiği durum ayrıca yazılır. Eksik veri, tam veri gibi
// gösterilmez.

import { sebepEtiketi, BILDIRIM_SEBEPLERI } from './moderationReasons';

/** Sebeplerin bilinen sırası — özet metninde de aynı sıra kullanılır. */
const SEBEP_SIRASI = BILDIRIM_SEBEPLERI.map((s) => s.key);

/**
 * Liste başlığındaki dürüst özet satırları.
 *
 * @param {{items?: Array<object>, total?: number, orphanCount?: number}} sonuc
 * @returns {string[]} ekrana alt alta basılacak satırlar
 */
export function ozetSatirlari(sonuc) {
  const items = Array.isArray(sonuc?.items) ? sonuc.items : [];
  const total = Number(sonuc?.total) || 0;
  const oksuz = Number(sonuc?.orphanCount) || 0;

  if (!total && !oksuz && !items.length) return ['İncelenmeyi bekleyen bildirim yok.'];

  const satirlar = [`${total} yorum için bekleyen bildirim var.`];

  // Gösterilen sayı toplamdan azsa SEBEBİ söylenmez (bilmiyoruz: liste sınırı
  // da olabilir, silinmiş yorum da). Yalnız fark açıkça yazılır.
  if (items.length !== total) {
    satirlar.push(`Bu listede ${items.length} tanesi gösteriliyor.`);
  }
  if (oksuz > 0) {
    satirlar.push(`${oksuz} bildirim silinmiş bir yoruma ait; içeriği gösterilemiyor.`);
  }
  return satirlar;
}

/**
 * `{spam: 2, hakaret: 1}` → `'Spam / reklam ×2 · Hakaret'`
 *
 * Çok bildirilen sebep önce yazılır; eşitlikte sebep listesinin kendi sırası
 * korunur, böylece aynı veri her açılışta aynı sırayla görünür.
 */
export function sebepOzeti(reasons) {
  const girdiler = Object.entries(reasons || {})
    .filter(([, n]) => Number(n) > 0)
    .sort((a, b) => {
      const fark = Number(b[1]) - Number(a[1]);
      if (fark) return fark;
      const ia = SEBEP_SIRASI.indexOf(a[0]);
      const ib = SEBEP_SIRASI.indexOf(b[0]);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  if (!girdiler.length) return '';
  return girdiler
    .map(([key, n]) => (Number(n) > 1 ? `${sebepEtiketi(key)} ×${Number(n)}` : sebepEtiketi(key)))
    .join(' · ');
}

/**
 * Yorumun görünürlük durumu — rozet metni ve rengi.
 *
 * Gizlemenin ELLE mi OTOMATİK mi olduğu operatörün en çok ihtiyaç duyduğu
 * bilgidir: otomatik gizleme bildirim hareketleriyle KENDİLİĞİNDEN kalkabilir,
 * elle gizleme kalkmaz. İkisini tek bir "Gizli" rozetinde birleştirmek,
 * operatöre kalıcı sandığı bir kararın geçici olduğunu gizlerdi.
 *
 * @returns {{gizli: boolean, otomatik: boolean, etiket: string, renk: 'kirmizi'|'turuncu'|'yesil'}}
 */
export function gizlemeDurumu(item) {
  if (!item?.hidden) {
    return { gizli: false, otomatik: false, etiket: 'Görünür', renk: 'yesil' };
  }
  const otomatik = item.hiddenBy !== 'elle';
  return {
    gizli: true,
    otomatik,
    etiket: otomatik ? 'Gizli — otomatik (bildirim eşiği)' : 'Gizli — elle',
    renk: otomatik ? 'turuncu' : 'kirmizi',
  };
}

/**
 * Bir yorum için anlamlı düğmeler.
 *
 * "Gizle" her durumda anlamlıdır: gizli olmayan yorumu gizler, OTOMATİK gizli
 * yorumu ise operatör kararına çevirir (sebep 'elle' olur) — böylece bildirim
 * hareketleri o kararı artık geri alamaz. Bu yüzden gizli yorumda düğmenin adı
 * "Gizli Kalsın"dır: yaptığı şey gizlemek değil, gizlemeyi MÜHÜRLEMEKTİR.
 *
 * "Geri Al" yalnız gizli yorumda gösterilir; görünür yorumda hiçbir işi yoktur.
 */
export function eylemler(item) {
  const gizli = !!item?.hidden;
  const liste = [
    {
      key: 'hide',
      label: gizli ? 'Gizli Kalsın (onayla)' : 'Yorumu Gizle',
      aciklama: gizli
        ? 'Gizleme operatör kararı olarak mühürlenir; bekleyen bildirimler kapanır.'
        : 'Yorum herkesten gizlenir; bekleyen bildirimleri kapatır.',
      tehlike: !gizli,
    },
  ];
  if (gizli) {
    liste.push({
      key: 'unhide',
      label: 'Gizlemeyi Geri Al',
      aciklama: 'Yorum yeniden görünür olur; bildirimleri yerinde bulunmadı sayar.',
      tehlike: false,
    });
  }
  return liste;
}

/** ISO tarihi kısa yerel biçime çevirir; okunamıyorsa uydurmaz, '—' der. */
export function tarihKisa(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return d.toLocaleString('tr-TR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return d.toISOString().slice(0, 16).replace('T', ' ');
  }
}

/**
 * "3 kişi · 4 bekleyen bildirim" — sayıların ne olduğu AÇIKÇA yazılır.
 *
 * `reporterCount` farklı kişi sayısı, `reportCount` satır sayısıdır ve bunlar
 * eşit olmak zorunda değildir. Etikette "kişi" ve "bildirim" ayrımı korunur;
 * tek bir sayı göstermek, otomatik gizleme eşiğinin (3 FARKLI kişi) neye göre
 * çalıştığını operatöre yanlış anlatırdı.
 */
export function bildirimOzeti(item) {
  const kisi = Number(item?.reporterCount) || 0;
  const adet = Number(item?.reportCount) || 0;
  return `${kisi} kişi · ${adet} bekleyen bildirim`;
}
