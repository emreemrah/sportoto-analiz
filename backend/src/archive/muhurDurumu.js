// ---------------------------------------------------------------------------
// MÜHÜR DURUMU / ALARM — saf modül (2026-08-07)
// ---------------------------------------------------------------------------
// NEDEN VAR: 51. hafta arşivde DURUYOR, maçları oynandı, resmî sonuçları var —
// ama mührü ilk maç başladıktan sonra atıldığı için başarı karnesine ASLA
// giremez. Bu, sessizce oldu: kimse bir uyarı görmedi, hafta kaybedildikten
// haftalar sonra fark edildi. Bugün elimizde karneye sayılan tek hafta var.
//
// Bir haftanın mührü kaçırıldığında GERİ DÖNÜŞ YOKTUR: tahminin maçtan önce
// üretildiği artık kanıtlanamaz, sonradan mühürlemek de kanıt sayılmaz (ki
// sayılsaydı karne anlamını yitirirdi). Yani buradaki tek savunma ÖNCEDEN
// UYARMAKTIR. Bu dosya o uyarıyı üretir.
//
// SAF: veri okumaz, saat okumaz — `now` dışarıdan verilir. Böylece test
// edilebilir ve "yarın çalışır mı" sorusu tahmine bırakılmaz.

import { classifyRecord, recordFromArchive } from '../scorecards/provenance.js';

/** Mühür ilk maça bu kadar saat kala hâlâ yoksa durum kritiktir. */
export const KRITIK_SAAT = 6;

/** Bu kadar saat kala uyarı seviyesine geçilir. */
export const UYARI_SAAT = 24;

const ms = (v) => {
  if (v == null) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
};

const saat = (fark) => Math.round((fark / 3600000) * 10) / 10;

/**
 * Bir haftanın mühür durumunu sınıflandırır.
 *
 * @param {object} bulletin  arşiv bülten satırı
 * @param {object|null} snap mühürlü snapshot (yoksa null)
 * @param {number} now       şimdi (ms) — dışarıdan verilir
 * @returns {{durum, seviye, mesaj, kalanSaat, muhurTuru, neden}}
 */
export function muhurSinifla(bulletin, snap, now = Date.now()) {
  const ilkMac = ms(bulletin?.firstMatchStartAt) ?? ms(snap?.payload?.bulletin?.firstMatchStartAt);
  const kalan = ilkMac == null ? null : saat(ilkMac - now);

  // 1) MÜHÜR YOK.
  if (!snap) {
    if (ilkMac == null) {
      return {
        durum: 'bilinmiyor', seviye: 'uyari', kalanSaat: null, muhurTuru: null, neden: 'no_first_match_time',
        mesaj: 'Mühür yok ve ilk maç saati de bilinmiyor. Bu hafta karneye giremez; '
          + 'bülten verisi eksik çekilmiş olabilir.',
      };
    }
    if (ilkMac <= now) {
      return {
        durum: 'kayip', seviye: 'kritik', kalanSaat: kalan, muhurTuru: null, neden: 'no_sealed_snapshot',
        mesaj: 'İlk maç başladı ve bu haftanın mührü hiç atılmadı. Hafta başarı '
          + 'karnesine ARTIK GİREMEZ — sonradan mühürlemek kanıt sayılmaz.',
      };
    }
    const seviye = kalan <= KRITIK_SAAT ? 'kritik' : (kalan <= UYARI_SAAT ? 'uyari' : 'bilgi');
    return {
      durum: 'bekliyor', seviye, kalanSaat: kalan, muhurTuru: null, neden: null,
      mesaj: `Mühür henüz atılmadı. İlk maça ${kalan} saat var. `
        + 'İlk maç başlamadan mühürlenmezse bu hafta karneye giremez.',
    };
  }

  // 2) MÜHÜR VAR — resmî ileri-test kapısından geçiyor mu?
  const cls = classifyRecord(recordFromArchive(bulletin, snap), { requireOfficialProfile: false });
  if (cls.isOfficialForward) {
    return {
      durum: 'saglam', seviye: 'ok', kalanSaat: kalan, muhurTuru: cls.provenanceType, neden: null,
      mesaj: 'Mühür maç öncesi atılmış ve kanıtları tam. Bu hafta başarı karnesine sayılır.',
    };
  }
  if (cls.provenanceType === 'late_unverified') {
    return {
      durum: 'gec', seviye: 'uyari', kalanSaat: kalan, muhurTuru: cls.provenanceType, neden: cls.exclusionReason,
      mesaj: 'Mühür GEÇ atılmış. Hafta başarı karnesine giremez; yalnız keşif '
        + 'havuzunda (örüntü araması) kullanılır ve orada "keşif" etiketiyle görünür.',
    };
  }
  return {
    durum: 'eksik', seviye: 'uyari', kalanSaat: kalan, muhurTuru: cls.provenanceType, neden: cls.exclusionReason,
    mesaj: `Mühür var ama resmî sayılmıyor (${cls.exclusionReason || 'sebep bilinmiyor'}). `
      + 'Bu hafta karneye girmez.',
  };
}

/**
 * Tüm haftaların özeti + panelde gösterilecek tek cümlelik alarm.
 * Alarm, EN KÖTÜ durumu öne çıkarır; iyi haber kötü haberi gizlemez.
 */
export function muhurOzeti(satirlar) {
  const sayim = { saglam: 0, gec: 0, kayip: 0, bekliyor: 0, eksik: 0, bilinmiyor: 0 };
  for (const s of satirlar || []) sayim[s.durum] = (sayim[s.durum] || 0) + 1;

  const kritikler = (satirlar || []).filter((s) => s.seviye === 'kritik');
  const uyarilar = (satirlar || []).filter((s) => s.seviye === 'uyari');

  let alarm = null;
  if (kritikler.length) {
    alarm = {
      seviye: 'kritik',
      metin: kritikler.length === 1
        ? `${kritikler[0].hafta}: ${kritikler[0].mesaj}`
        : `${kritikler.length} haftada kritik mühür sorunu var.`,
    };
  } else if (uyarilar.length) {
    alarm = { seviye: 'uyari', metin: `${uyarilar.length} hafta karneye giremiyor (mühür geç veya eksik).` };
  }

  return { sayim, alarm, kritikSayisi: kritikler.length, uyariSayisi: uyarilar.length };
}
