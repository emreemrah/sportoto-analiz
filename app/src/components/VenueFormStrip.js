// ---------------------------------------------------------------------------
// SAHA İKONLU FORM ŞERİDİ — ev / uçak, sonuç rengiyle (2026-08-08)
// ---------------------------------------------------------------------------
// NEDEN VAR: ikonlar zaten projede vardı (assets/venue) ve maç detayının
// "Son Maçlar" bölümünde kullanılıyordu. Bülten kartında ise aynı bilgi
// harfli renkli kareler (G/B/M) olarak duruyordu; kullanıcı "burada da bizim
// ikonları kullan" dedi.
//
// AYRI DOSYA OLMASININ SEBEBİ: ikon eşlemesi iki ekranda ayrı ayrı yazılsaydı
// biri değişip diğeri unutulurdu ve aynı maç iki ekranda farklı görünürdü.
// Tek kaynak burada.
//
// VERİ: `last5detail` → [{ result: 'G'|'B'|'M', isHome: bool }, ...]
// Detay yoksa şerit ÇİZİLMEZ (null döner); çağıran harfli şeride düşer.
// İç saha/deplasman bilgisi olmadan ev/uçak ikonu seçmek UYDURMAK olurdu.

import React from 'react';
import { View, Image } from 'react-native';

const IKON = {
  home: {
    G: require('../../assets/venue/home-win.png'),
    M: require('../../assets/venue/home-loss.png'),
    B: require('../../assets/venue/home-draw.png'),
  },
  away: {
    G: require('../../assets/venue/away-win.png'),
    M: require('../../assets/venue/away-loss.png'),
    B: require('../../assets/venue/away-draw.png'),
  },
};

/** Tek maç ikonu: ev/uçak + sonuç rengi. Bilinmeyen sonuç → beraberlik ikonu. */
export function VenueIcon({ result, isHome, size = 22 }) {
  const set = IKON[isHome ? 'home' : 'away'];
  const src = set[result] || set.B;
  return <Image source={src} style={{ width: size, height: size }} resizeMode="contain" />;
}

/**
 * Form şeridi.
 * @param detail  last5detail dizisi (en YENİ maç başta gelir)
 * @param eskiOnce true → eski maçtan yeniye doğru dizilir (maç detayı böyle)
 * @param sag     true → sağa yaslanır (bülten kartında deplasman tarafı)
 */
export default function VenueFormStrip({
  detail, size = 16, eskiOnce = false, sag = false, limit = null,
}) {
  const ham = Array.isArray(detail) ? detail : [];
  if (!ham.length) return null;                      // veri yoksa uydurulmaz
  const kesit = limit ? ham.slice(0, limit) : ham;
  const dizi = eskiOnce ? [...kesit].reverse() : kesit;
  return (
    <View style={{
      flexDirection: 'row',
      gap: 3,
      flexWrap: 'nowrap',
      justifyContent: sag ? 'flex-end' : 'flex-start',
    }}
    >
      {dizi.map((d, i) => (
        <VenueIcon key={`${d.result}-${i}`} result={d.result} isHome={d.isHome} size={size} />
      ))}
    </View>
  );
}
