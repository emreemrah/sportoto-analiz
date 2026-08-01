// KUPON DEĞERLENDİRME — tek doğruluk kaynağı.
// KURAL (kesin): Kupon, kilit anındaki FINAL versiyonun seçimleriyle
// değerlendirilir (couponStore kilitten sonra yeni versiyona izin vermez).
// Sonradan değişen analiz/tahmin değerlendirmeyi ETKİLEMEZ.
// Yalnız RESMİ 90 dakika sonucu (1/X/2) esas alınır; sonuç yoksa ⏳ beklenir,
// uydurma değerlendirme yapılmaz.
// NOT: Bu modül BİLEREK bağımsızdır (couponStore/api import etmez) — testte ve
// her ortamda saf çalışır. finalVersion mantığı couponStore.finalVersion ile
// birebir aynıdır (değişirse ikisi birlikte güncellenir).

// Marka metni tek kaynaktan gelir; brand.js saf sabit modülüdür (RN bağımlılığı
// yoktur), bu yüzden bu dosyanın bağımsızlığını bozmaz.
import { APP_NAME_UPPER } from './brand';

// Kilit anındaki FINAL versiyon (couponStore.finalVersion paritesi).
export function finalVersionOf(coupon) {
  if (!coupon?.versions?.length) return null;
  return coupon.versions.find((v) => v.id === coupon.finalVersionId) || coupon.versions[coupon.versions.length - 1];
}
const toOfficialSym = (o) => (o === 'X' ? '0' : o); // couponConfig.toOfficial paritesi

// Resmi sonucu normalize et: '0' → 'X'; tanınmayan değer → null (uydurma yok).
export function normResult(r) {
  if (r == null) return null;
  const s = String(r).toUpperCase();
  if (s === '0') return 'X';
  return ['1', 'X', '2'].includes(s) ? s : null;
}

// resultMap: Map(no → resmi sonuç) veya düz obje. Seçim satırlarını puanlar.
export function evalSelections(selections, resultMap) {
  const getR = (no) => normResult(resultMap instanceof Map ? resultMap.get(no) : resultMap?.[no]);
  const rows = (selections || []).map((sc) => {
    const actual = getR(sc.no);
    const outcomes = sc.selectedOutcomes || [];
    const hit = actual == null ? null : outcomes.includes(actual);
    return { no: sc.no, outcomes, actual, hit };
  });
  const total = rows.length;
  const resolved = rows.filter((r) => r.hit != null).length;
  const correct = rows.filter((r) => r.hit === true).length;
  const wrong = rows.filter((r) => r.hit === false).length;
  const allResolved = total > 0 && resolved === total;
  // 15/14/13/12 bilgisi: YALNIZ tüm resmi sonuçlar gelince kesinleşir.
  const tier = allResolved && correct >= 12 ? correct : null;
  return {
    rows, total, resolved, correct, wrong,
    pending: total - resolved, allResolved, tier,
    misses: rows.filter((r) => r.hit === false),   // "Nereden yattım?"
  };
}

// Kuponu (FINAL versiyonuyla) değerlendir. Versiyon yoksa null.
export function evalCoupon(coupon, resultMap) {
  const v = finalVersionOf(coupon);
  if (!v) return null;
  return {
    versionNo: v.versionNo,
    columnCount: v.columnCount,
    ...evalSelections(v.selections, resultMap),
  };
}

// Kuponun seçimlerini {maçNo: resmi sembol} haritasına çevir (ör. ['1','X'] → '10').
// Canlı Bülten "Sen" satırını besler. Kupon yoksa boş obje.
export function picksMapOf(coupon) {
  const v = coupon ? finalVersionOf(coupon) : null;
  if (!v) return {};
  const out = {};
  for (const sc of v.selections || []) {
    if (sc.selectedOutcomes?.length) out[sc.no] = sc.selectedOutcomes.map(toOfficialSym).join('');
  }
  return out;
}

// Paylaşım metni (native metin paylaşımı / kopyalama yedeği). HASSAS VERİ YOK:
// yalnız sezon/hafta + seçimler + kolon (+GERÇEK fiyat verisiyle hesaplanmış
// tutar istenirse) + dürüstlük notu. Fiyat uydurulmaz: cost null ise yazılmaz.
export function buildShareText({ coupon, roundName, season, teamsByNo, cost }) {
  const v = finalVersionOf(coupon);
  if (!v) return '';
  const lines = v.selections.map((sc) => {
    const t = teamsByNo?.[sc.no];
    const name = t ? `${t.home} - ${t.away}` : `Maç ${sc.no}`;
    return `${sc.no}. ${name} → ${(sc.selectedOutcomes || []).join('-')}`;
  });
  const head = `⚽ ${APP_NAME_UPPER}${season ? ` · ${season}` : ''}${roundName ? ` · ${roundName}` : ''}`;
  const costLine = `Kolon: ${v.columnCount}${cost != null ? ` · Tutar: ${cost} TL` : ''}`;
  const played = coupon.playedMarkedAt
    ? '\nTahmin kilitlendi — kullanıcı beyanı, bağımsız olarak doğrulanmamıştır.'
    : '';
  return `${head}\n\n${lines.join('\n')}\n\n${costLine}${played}\nKesin sonuç veya kazanç vaadi değildir.`;
}
