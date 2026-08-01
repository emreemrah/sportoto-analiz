// app/src/demoGate.js
// DEMO/ÖRNEK VERİ KAPISI — tek kaynak.
//
// Neden ayrı (ve RN'siz) bir dosya: config.js 'react-native' (Platform) import
// eder; onu içeri alan her servis node testlerinde yüklenemez hale gelir. Aynı
// sorun API adresi için de yaşanmış ve apiBase.js saf modül olarak ayrılmıştı —
// bu dosya o desenin aynısıdır. Böylece arşiv/snapshot servisleri demo kapısını
// mock veri yığınını ve RN'yi içeri çekmeden sorabilir.
//
// KURAL: Demo/örnek veri YALNIZ burası izin verdiğinde üretilebilir. Yayın
// derlemesinde kapı DAİMA kapalıdır; kapalıyken uydurma bülten, kupon, maliyet,
// başarı oranı ve sonuç ÜRETİLMEZ — veri yoksa dürüstçe "bulunamadı"/hata
// gösterilir. Demo görünürken ekranda kalıcı "DEMO VERİ — GERÇEK BAŞARI
// DEĞİLDİR" etiketi zorunludur; demo ve resmî veri asla aynı toplamda
// birleştirilmez.

// __DEV__ ÇAĞRI ANINDA okunur (import anında değil): testler kipi geçici olarak
// değiştirip finally ile geri alabilsin diye.
const isDev = () => (typeof __DEV__ !== 'undefined' ? __DEV__ === true : false);

// Yayın derlemesinde bayrak açık bırakılsa bile zorla kapalıdır (isDev &&).
export const DEMO_MODE = isDev() && process.env.EXPO_PUBLIC_DEMO_MODE === 'true';

export function demoDataAllowed() {
  return DEMO_MODE === true || isDev() === true;
}
