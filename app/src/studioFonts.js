// YAYIN STÜDYOSU — yazı tipi (Barlow Semi Condensed, uygulamaya GÖMÜLÜ).
//
// NEDEN AYRI BİR AİLE: Stüdyo, resmî bülten tablosu gibi SIKIŞIK okunmalı —
// tek ekranda 15 satır. Sistem fontları (Roboto/Inter/San Francisco) geniş
// yazar; aynı satıra takım adı + skor + sonuç sığmaz ve her ekran birbirinin
// aynısı görünür. Barlow Semi Condensed dar yazar, rakamları eşit genişliktedir
// (tablo sütunları kaymaz) ve Türkçe harflerin tamamını (ğ ş ı İ ç ö ü) içerir.
//
// NEDEN GÖMÜLÜ: Paket .ttf dosyalarını uygulamanın içinde taşır — internet
// olmadan da açılır, yayın sırasında font indirmeyi beklemez.
//
// KURAL: Font YÜKLENENE KADAR uygulama beklemez. Yüklenmediyse fontFamily
// verilmez, sistem fontuyla çizilir. Yani font, çalışmanın ÖNKOŞULU değildir;
// yüklenince ekranlar kendiliğinden yeniden çizilir.

import { useEffect, useSyncExternalStore } from 'react';
import { useFonts } from 'expo-font';
// DİKKAT — paket KÖKÜNDEN içe aktarma yapma:
// `@expo-google-fonts/barlow-semi-condensed` kökündeki index.js ailenin
// 18 kesiminin TAMAMINI modül düzeyinde require eder. Kökten tek bir kesim
// istesen bile paketleyici 18 .ttf dosyasını da uygulamaya gömer (~1,8 MB).
// Kesim başına alt yol kullanınca yalnız kullandığımız 4 dosya girer (~400 KB).
// Ölçüldü: `expo export --platform android` → 18/18 dosya vs 4/4 dosya.
import { BarlowSemiCondensed_400Regular } from '@expo-google-fonts/barlow-semi-condensed/400Regular';
import { BarlowSemiCondensed_500Medium } from '@expo-google-fonts/barlow-semi-condensed/500Medium';
import { BarlowSemiCondensed_600SemiBold } from '@expo-google-fonts/barlow-semi-condensed/600SemiBold';
import { BarlowSemiCondensed_700Bold } from '@expo-google-fonts/barlow-semi-condensed/700Bold';

/** expo-font'a verilecek harita. Anahtar = stilde yazacağımız fontFamily adı. */
export const STUDIO_FONT_MAP = {
  BarlowSemiCondensed_400Regular,
  BarlowSemiCondensed_500Medium,
  BarlowSemiCondensed_600SemiBold,
  BarlowSemiCondensed_700Bold,
};

const AILE = {
  400: 'BarlowSemiCondensed_400Regular',
  500: 'BarlowSemiCondensed_500Medium',
  600: 'BarlowSemiCondensed_600SemiBold',
  700: 'BarlowSemiCondensed_700Bold',
};

/* Modül düzeyi durum + abonelik: font App'te yüklenir ama stüdyo ekranları
   navigator'ın altındadır. Abonelikle, yüklendiği an SADECE dinleyen ekranlar
   yeniden çizilir. */
let hazir = false;
const dinleyiciler = new Set();
const abone = (fn) => { dinleyiciler.add(fn); return () => dinleyiciler.delete(fn); };
const oku = () => hazir;

function isaretle(v) {
  if (hazir === v) return;
  hazir = v;
  dinleyiciler.forEach((fn) => { try { fn(); } catch { /* dinleyici hatası akışı kesmesin */ } });
}

/** App kökünde BİR KEZ çağrılır. Dönüşü beklenmez — uygulama fontsuz da açılır. */
export function useStudioFontLoader() {
  const [loaded] = useFonts(STUDIO_FONT_MAP);
  useEffect(() => { isaretle(!!loaded); }, [loaded]);
  return loaded;
}

/** Stüdyo ekranları: font hazır olduğunda yeniden çizilmek için. */
export function useStudioFontReady() {
  return useSyncExternalStore(abone, oku, oku);
}

/**
 * Ağırlığa göre yazı tipi stili.
 * Font hazır değilse BOŞ nesne döner → sistem fontu, ağırlık stilde ne yazıyorsa o.
 * Hazırsa aile adı verilir ve fontWeight sıfırlanır: aile zaten o ağırlıktadır,
 * üstüne bir de kalınlaştırma istenirse tarayıcı sahte-kalın çizer, harfler bozulur.
 */
export function fontOf(weight = 400, ready = hazir) {
  if (!ready) return {};
  return { fontFamily: AILE[weight] || AILE[400], fontWeight: 'normal' };
}

/** Tablo rakamları: sütunlar kaymasın diye eşit genişlikli rakam. */
export const TABULAR = { fontVariant: ['tabular-nums'] };

export const _test = { AILE, isaretle, oku };
