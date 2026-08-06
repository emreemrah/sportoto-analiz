// KRİTER AKTARIMI — kullanıcının kendi kriter setiyle hesaplanan Master
// Analiz sonucunu kupon seçimine çevirir. Saf modül (RN yok, testli).
// ---------------------------------------------------------------------------
// YAŞANAN HATA (2026-08-06, kullanıcı bildirimi: "seçtiğim kritere göre yanlış
// seçimler"): "Geniş" seçeneği motorun `closedPrediction` alanını kullanıyordu.
// O alan kapsayıcı bir güvenlik ağıdır ve kullanıcının kriter setinde
// BERABERLİK SİNYALİ ÜRETEN kriter yoksa her maçta "12" olur. Sonuç: 15 maçın
// 14'ünde "1-2" — sistem sanki her maça aynı şeyi diyormuş gibi görünüyordu.
//
// DOĞRUSU: geniş = "tekli + GEREKİYORSA ikinci". Gerek ölçüsü, iki tarafın
// destek farkıdır: fark küçükse (çekişmeli) ikinci işaret eklenir; ana tercih
// açık ara öndeyse (ör. 89-11) genişletmek bilgi değil gürültüdür.
//
// AYRICA DÜRÜSTLÜK: kriter seti hiç X üretemiyorsa bu kullanıcıya SÖYLENİR.
// "X hiç çıkmıyor" bir motor arızası değil, seçilen kriterlerin doğal sonucudur
// — ama kullanıcı bunu bilmeden kuponunu kurarsa yanıltılmış olur.

// İKİNCİ DÜZELTME (aynı gün, kullanıcı: "geniş seçtiğimde burası gelmesi
// gerekmiyor mu"): Maç Detayı → Analiz ekranındaki "Alternatif" ile kupondaki
// "geniş" AYNI olmalıydı; değildi. Sebep iki ayrı motor:
//   • Ekran → app/src/analysis/engine.js (kullanıcının kriter seti) — akıllı
//     HEDGE kuralı var: ezici favoride gerçekçi risk BERABERLİKTİR, karşı
//     galibiyet ancak gerçek rakipse alternatif olur (ör. "1X").
//   • Kupon → backend masterEngine'in kapsayıcı alanı — en üst iki işareti
//     eşler, X üretmeyen kriter setinde her maçta "12" çıkar.
// Artık kupon da EKRANIN motorunu çağırıyor: tek doğruluk kaynağı, iki ekran
// aynı şeyi söyler. `macSecimi` (destek farkına dayalı) yalnız backend çıktısı
// kullanıldığında devrede kalır — bkz. kriterAktarimi(..., { motor }).
import { userSelectedAnalysisEngine } from './analysis/engine';

/** Ana tercih ile ikinci arasındaki destek farkı bu değerin altındaysa çekişmeli sayılır. */
export const CEKISME_FARKI = 25;

/** '1X2' / '12' gibi bileşik sembolü kanonik diziye açar. Saf. */
export function sembolAc(sym) {
  const set = new Set(String(sym || '').split('').map((c) => (c === '0' ? 'X' : c)));
  return ['1', 'X', '2'].filter((o) => set.has(o));
}

/**
 * EKRANLA AYNI kaynak: kullanıcının kriter setiyle yerel motoru çalıştırır ve
 * kupon seçimlerini üretir. tekli → verdict.main, geniş → verdict.alt.
 * @returns { secimler, uyarilar, istatistik }
 */
export function ekranMotoruylaAktar(matches, profile, { genis = false, kilitliNolar = new Set() } = {}) {
  const secimler = {};
  let veriYok = 0;
  let genisletilen = 0;
  let xVar = false;

  for (const m of matches || []) {
    if (kilitliNolar.has(Number(m?.no))) continue;
    let v = null;
    try { v = userSelectedAnalysisEngine(m, profile)?.verdict || null; } catch { v = null; }
    const sym = genis ? (v?.alt || v?.main) : v?.main;
    const secim = sembolAc(sym);
    if (!secim.length) { veriYok += 1; continue; }
    if (secim.includes('X')) xVar = true;
    if (secim.length > 1) genisletilen += 1;
    secimler[m.no] = secim;
  }

  const uyarilar = [];
  if (veriYok) uyarilar.push(`${veriYok} maçta kriter verisi yok — o maçlar boş bırakıldı (uydurma seçim yapılmaz).`);
  if (genis && !xVar && Object.keys(secimler).length) {
    uyarilar.push('Seçtiğin kriterler hiçbir maçta beraberliği öne çıkarmadı. Beraberlik ihtimalini daha çok görmek istersen "Beraberlik Eğilimi", "KG Var" gibi kriterleri de aç.');
  }
  return { secimler, uyarilar, istatistik: { veriYok, genisletilen, toplam: Object.keys(secimler).length } };
}

const KANONIK = (s) => (s === '0' ? 'X' : s);
const SIRA = ['1', 'X', '2'];

/** Bir maçın master çıktısından kupon seçimi üretir. Saf. */
export function macSecimi(master, { genis = false } = {}) {
  if (!master || !master.mainPrediction) return null;      // veri yok → seçim yok
  const ana = KANONIK(master.mainPrediction);
  if (!genis) return [ana];

  const alt = KANONIK(master.alternativePrediction);
  if (!alt || alt === ana) return [ana];

  // Destekler normalize yüzdedir (toplam 100). Yoksa çekişmeli varsayılır:
  // bilgi yokken daraltmak, olmayan bir kesinlik iddia etmektir.
  const destek = {
    1: Number(master.normalizedSupport1),
    X: Number(master.normalizedSupportX),
    2: Number(master.normalizedSupport2),
  };
  const dAna = Number.isFinite(destek[ana]) ? destek[ana] : null;
  const dAlt = Number.isFinite(destek[alt]) ? destek[alt] : null;
  const cekismeli = dAna == null || dAlt == null || (dAna - dAlt) < CEKISME_FARKI;

  return cekismeli ? SIRA.filter((o) => o === ana || o === alt) : [ana];
}

/**
 * Bültenin tamamı için seçim önerisi.
 * @returns { secimler: { [no]: ['1','X'] }, uyarilar: string[], istatistik }
 */
export function kriterAktarimi(matches, { genis = false, kilitliNolar = new Set() } = {}) {
  const secimler = {};
  const uyarilar = [];
  let veriYok = 0;
  let genisletilen = 0;
  let xUretenVar = false;

  for (const m of matches || []) {
    const master = m?.master || null;
    if (master && Number(master.normalizedSupportX) > 0) xUretenVar = true;
    if (kilitliNolar.has(Number(m?.no))) continue;         // başlamış maça dokunulmaz
    const secim = macSecimi(master, { genis });
    if (!secim) { veriYok += 1; continue; }
    if (secim.length > 1) genisletilen += 1;
    secimler[m.no] = secim;
  }

  // DÜRÜSTLÜK UYARILARI — sayı uydurmadan, yalnız gerçek durumu söyler.
  if (!xUretenVar && (matches || []).length) {
    uyarilar.push('Seçtiğin kriterlerin hiçbiri beraberlik (X) sinyali üretmiyor; bu yüzden X hiçbir maçta önerilmez. Beraberlik görmek istersen "Beraberlik Eğilimi", "KG Var" gibi kriterleri de aç.');
  }
  if (genis && !genisletilen && Object.keys(secimler).length) {
    uyarilar.push('Geniş seçildi ama hiçbir maçta ikinci işarete gerek görülmedi — kriterlerin her maçta tek yönü açık ara önde buluyor.');
  }
  if (veriYok) uyarilar.push(`${veriYok} maçta kriter verisi yok — o maçlar boş bırakıldı (uydurma seçim yapılmaz).`);

  return { secimler, uyarilar, istatistik: { veriYok, genisletilen, toplam: Object.keys(secimler).length } };
}
