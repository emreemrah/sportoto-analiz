// UYARI KUYRUĞU — saf mantık (JSX YOK, react-native YOK).
//
// NEDEN AYRI DOSYA: pencerenin ÇİZİMİ Uyari.js'te, KARARI burada. Bu dosya
// react-native'e dokunmadığı için node:test altında gerçekten çalıştırılabilir;
// "düğmeye basınca ne oluyor" sorusu kaynak metni okunarak değil, DAVRANIŞ
// koşturularak sınanır.
//
// TEMEL KURAL: hiçbir uyarı sessizce yutulmaz. Pencereyi çizen host bağlıysa
// kuyruğa girer; bağlı değilse tarayıcının kendi penceresine düşülür; o da
// yoksa konsola yazılır ve tek düğmeli isteğin işlevi yine çalıştırılır.

let siradaki = 1;
let kuyruk = [];
const aboneler = new Set();

const yayinla = () => { for (const f of aboneler) f(kuyruk.slice()); };

/** Düğme listesini normalize eder: en az bir düğme HER ZAMAN olur. */
export function dugmeleriDuzelt(dugmeler) {
  const d = (Array.isArray(dugmeler) ? dugmeler : []).filter(Boolean);
  if (!d.length) return [{ text: 'Tamam', style: 'default' }];
  return d.map((b) => ({ text: b.text || 'Tamam', onPress: b.onPress, style: b.style || 'default' }));
}

/** Pencereyi çizen host buraya abone olur. Geri dönen işlev aboneliği bitirir. */
export function aboneOl(fn) {
  aboneler.add(fn);
  fn(kuyruk.slice());
  return () => { aboneler.delete(fn); };
}

export const hostVarMi = () => aboneler.size > 0;
export const kuyrukAl = () => kuyruk.slice();

/** Gösterilen pencereyi kapatır (düğmenin işlevi ÇAĞRILMAZ — onu host yapar). */
export function kapat(id) {
  kuyruk = kuyruk.filter((x) => x.id !== id);
  yayinla();
}

/** Yalnız testler için: kuyruk ve abonelikler sıfırlanır. */
export function _sifirlaTestIcin() {
  kuyruk = []; aboneler.clear(); siradaki = 1;
}

/**
 * Host bağlı değilken tarayıcının kendi penceresine düşer.
 * `pencere` dışarıdan verilebilir (test edilebilirlik); verilmezse globalThis.
 */
export function yedekYol(baslik, mesaj, dugmeler, pencere) {
  const d = dugmeleriDuzelt(dugmeler);
  const metin = [baslik, mesaj].filter(Boolean).join('\n\n');
  const iptal = d.find((b) => b.style === 'cancel');
  const onay = d.find((b) => b.style !== 'cancel') || d[0];
  const w = pencere !== undefined ? pencere : (typeof globalThis !== 'undefined' ? globalThis : null);

  if (!w || typeof w.confirm !== 'function' || typeof w.alert !== 'function') {
    // Son çare: sessiz kalmak yerine iz bırak. Onay İSTEYEN (çok düğmeli)
    // istekte hiçbir şey ÇALIŞTIRILMAZ — kullanıcının onayı alınmamıştır.
    console.warn('[uyari] pencere açılamadı:', metin);
    if (d.length < 2) onay?.onPress?.();
    return 'yazildi';
  }
  if (d.length < 2) { w.alert(metin); onay?.onPress?.(); return 'alert'; }
  const soru = `${metin}\n\n${onay.text} için Tamam, vazgeçmek için İptal.`;
  if (w.confirm(soru)) { onay?.onPress?.(); return 'onay'; }
  iptal?.onPress?.();
  return 'iptal';
}

/**
 * Web tarafının giriş noktası. Host varsa kuyruğa yazar ('kuyruk' döner),
 * yoksa yedek yola düşer (dönüş: yedek yolun sonucu).
 */
export function webUyari(baslik, mesaj, dugmeler, secenekler, pencere) {
  const d = dugmeleriDuzelt(dugmeler);
  if (!hostVarMi()) return yedekYol(baslik, mesaj, d, pencere);
  kuyruk = kuyruk.concat({
    id: siradaki++,
    baslik: baslik ?? null,
    mesaj: mesaj ?? null,
    dugmeler: d,
    kapatilabilir: secenekler?.cancelable !== false,
  });
  yayinla();
  return 'kuyruk';
}
