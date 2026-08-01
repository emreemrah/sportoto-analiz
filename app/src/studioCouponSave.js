// YAYIN STÜDYOSU — KUPON KAYDETME KURALLARI (saf mantık, JSX yok).
//
// NEDEN AYRI DOSYA: Burası testten DOĞRUDAN import edilebiliyor; ekran
// dosyaları JSX içerdiği için `node --test` onları import edemiyor. Kural
// burada durunca ekranın kendisi değil, kuralın ta kendisi sınanabiliyor.
// (Kural bir zamanlar iki ekranda birden çalışıyordu — StudioBulletinScreen
// ve kaldırılan StudioCouponScreen. Bugün tek ekran kullanıyor; dosyanın
// ayrı durmasının sebebi sınanabilirlik.)
//
// KURAL: SEBEPSİZ KAPALI DÜĞME, SESSİZ DÜĞMEDEN BETERDİR.
// Kayıt kapalıysa sebebi HER ZAMAN ekranda yazılı olmalı. Bu dosya sebebin
// başlığını ve metnini üretir; ekran onu görünür şekilde basar.
//
// Bu dosya coupon/store'u İÇE AKTARMAZ (store test koşucusunda parse
// edilemiyor). createCoupon/rememberCoupon çağrıları ekranda kalır.
import { COUPON_MAX_COLUMNS, lockAtOf, lockMapOf } from './couponConfig';
import { toSelections } from './broadcastStudio';

// Başlamış (kilitli) ama seçimi olan maçların bülten numaraları.
// Bunlar kupona yazılamaz — kupon ilk maç başlamadan kaydedilmelidir.
export function engelliNolarOf(rows) {
  return (rows || []).filter((r) => r && r.locked && r.hasPick).map((r) => r.no);
}

// Kaydı engelleyen İLK sebep. Sıra bilinçli: önce hafta kilidi (en kapsayıcı),
// sonra başlamış maç, en son eksik seçim. Engel yoksa null döner.
//
// KOLON SAYISI ARTIK BURADA ENGEL DEĞİLDİR (bilinçli değişiklik, yayıncı isteği).
// Kalan üç engelin hepsi VERİ GERÇEĞİDİR: hafta başlamışsa kaydedilecek bir şey
// kalmamıştır, başlamış maçın seçimi yazılamaz, eksik seçimde kupon eksik olur.
// Kolon sayısı ise yalnız bir OYUN kuralıdır — bkz. columnsNoteOf.
export function saveBlockerOf({ hazir, engelliNolar } = {}) {
  const h = hazir || {};
  const nos = engelliNolar || [];
  if (h.allLocked) {
    return {
      code: 'week-locked',
      title: 'Hafta kilitli',
      text: 'Tüm maçlar başladı — bu hafta için kupon kaydedilemez. Ekran yalnız görüntüleme için açık.',
    };
  }
  if (nos.length) {
    return {
      code: 'started-match',
      title: 'Başlamış maç var',
      text: `${nos.join(', ')}. maç başladı. Başlamış maçın seçimi kupona yazılamaz; kupon, ilk maç başlamadan kaydedilmelidir. Seçimlerin ve notların ekranda duruyor.`,
    };
  }
  if (!h.complete) {
    return {
      code: 'missing',
      title: 'Eksik seçim',
      text: `${h.missing} maçta seçim yok (${(h.missingNos || []).join(', ')}). Kupon ${h.total} maç tamamlanınca kaydedilir.`,
    };
  }
  return null;
}

// KOLON SINIRI YAYIN STÜDYOSUNDA KAYDI ENGELLEMEZ — YALNIZ BİLGİDİR.
//
// NEDEN DEĞİŞTİ: Stüdyoda kaydedilen şey oynanacak bir kupon değil, yayıncının
// o hafta ekranda yaptığı SEÇİMLERİN KAYDIDIR. Yayıncı 15 maçın hepsini kapalı
// (1X2) işaretleyip "bu hafta her şey açık" diye anlatabilmeli; bu 3^15 = 14
// milyondan fazla kolon eder, oynanamaz ama ANLATILABİLİR. Sayıyı gizlemek de
// yanlış olurdu; o yüzden yazılıyor ama düğmeyi kapatmıyor.
//
// SINIR NEREDE HÂLÂ GEÇERLİ: gerçek kupon akışında (CouponEditorScreen ve
// coupon/smart.js). Orada 2.500 resmî oyun kuralı olarak DURUYOR. Buradan
// kaldırıldı diye orada da kaldırıldı sanılmasın.
//
// Sınırın altındaysa metin YOKTUR — gereksiz uyarı gürültü yapar.
export function columnsNoteOf(kolon) {
  const n = Number(kolon);
  if (!Number.isFinite(n) || n <= COUPON_MAX_COLUMNS) return '';
  return `Kolon sayısı ${n} — resmî oyun sınırı ${COUPON_MAX_COLUMNS}. Bu kayıt yayın içindir; oynanacak kuponda sınır geçerlidir.`;
}

// Kupon kaydına gidecek veri. Mühür bilgisi (lockedAt/lockMap) resmî bülten
// saatlerinden üretilir — uydurulmaz.
export function couponPayloadOf({ data, roundId, rows } = {}) {
  const matches = (data && data.matches) || [];
  return {
    meta: {
      season: (data && data.season) || null,
      weekNumber: (data && data.weekNumber) || null,
      roundId,
      lockedAt: lockAtOf(matches),
      lockMap: lockMapOf(matches),
    },
    govde: { selections: toSelections(rows || []) },
  };
}

// Kayıt sonrası store cevabını kullanıcı diline çevirir. Hata yoksa null.
export function saveErrorOf(res) {
  if (res && res.error === 'max') {
    return { code: 'max', title: 'Sınır', text: 'Bu hafta için kupon hakkın doldu.' };
  }
  if (res && (res.error === 'locked' || res.error === 'locked-match')) {
    const liste = res.matches && res.matches.length ? ` (${res.matches.join(', ')}. maç)` : '';
    return {
      code: 'locked',
      title: 'Kilitli',
      text: `Başlamış maçın seçimi kaydedilemez${liste}. Seçimlerin ekranda duruyor.`,
    };
  }
  if (!res || res.error || !res.coupon) {
    return {
      code: 'fail',
      title: 'Hata',
      text: 'Kupon kaydedilemedi — yayındaki seçimlerin duruyor, tekrar dene.',
    };
  }
  return null;
}
