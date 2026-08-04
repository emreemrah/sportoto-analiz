// ANA SAYFA SAHA ARKA PLANI — belirgin yeşil çim saha (kullanıcı isteği,
// 2026-08-04: soluk taktik tahtası "bu değil" bulundu; gerçek saha görünümü
// istendi). Dikey futbol sahası: biçme şeritleri + beyaz çizgiler (orta yuvarlak,
// ceza sahaları, köşe yayları, penaltı noktaları).
//
// OKUNURLUK: kartlar (colors.card / beyaz) zeminin üstünde kendi arka
// planlarıyla durduğu için içerik etkilenmez; çizgiler kartların ARKASINDA.
// Bağımlılık: react-native-svg (zaten kurulu — yeni paket yok). Mobil + web.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Line, Circle, Path } from 'react-native-svg';

// Çim tonları — canlı ama yumuşak; beyaz kartlarla çatışmaz.
const CIM_ACIK = '#4C9E5C';
const CIM_KOYU = '#419051';
const CIZGI = 'rgba(255,255,255,0.55)';
const CIZGI_KALIN = 2;

// viewBox: dikey saha 400x800 — ekrana en boy korunmadan yayılır (preserveAspectRatio none),
// böylece her ekran boyutunda saha tam oturur.
export default function SahaBackdrop({ children, style }) {
  const serit = 100; // biçme şeridi yüksekliği (viewBox biriminde)
  return (
    <View style={[styles.kok, style]}>
      <Svg
        style={StyleSheet.absoluteFill}
        viewBox="0 0 400 800"
        preserveAspectRatio="none"
        pointerEvents="none"
      >
        <Defs>
          <LinearGradient id="cim" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={CIM_ACIK} />
            <Stop offset="1" stopColor={CIM_KOYU} />
          </LinearGradient>
        </Defs>

        {/* Zemin + biçme şeritleri */}
        <Rect x="0" y="0" width="400" height="800" fill="url(#cim)" />
        {[0, 2, 4, 6].map((i) => (
          <Rect key={i} x="0" y={i * serit} width="400" height={serit} fill="rgba(255,255,255,0.05)" />
        ))}

        {/* Saha sınırı */}
        <Rect x="14" y="14" width="372" height="772" fill="none" stroke={CIZGI} strokeWidth={CIZGI_KALIN} />

        {/* Orta çizgi + orta yuvarlak */}
        <Line x1="14" y1="400" x2="386" y2="400" stroke={CIZGI} strokeWidth={CIZGI_KALIN} />
        <Circle cx="200" cy="400" r="56" fill="none" stroke={CIZGI} strokeWidth={CIZGI_KALIN} />
        <Circle cx="200" cy="400" r="3.5" fill={CIZGI} />

        {/* Üst ceza sahası + kale sahası + penaltı */}
        <Rect x="92" y="14" width="216" height="96" fill="none" stroke={CIZGI} strokeWidth={CIZGI_KALIN} />
        <Rect x="146" y="14" width="108" height="38" fill="none" stroke={CIZGI} strokeWidth={CIZGI_KALIN} />
        <Circle cx="200" cy="82" r="3.5" fill={CIZGI} />
        <Path d="M 152 110 A 56 56 0 0 0 248 110" fill="none" stroke={CIZGI} strokeWidth={CIZGI_KALIN} />

        {/* Alt ceza sahası + kale sahası + penaltı */}
        <Rect x="92" y="690" width="216" height="96" fill="none" stroke={CIZGI} strokeWidth={CIZGI_KALIN} />
        <Rect x="146" y="748" width="108" height="38" fill="none" stroke={CIZGI} strokeWidth={CIZGI_KALIN} />
        <Circle cx="200" cy="718" r="3.5" fill={CIZGI} />
        <Path d="M 152 690 A 56 56 0 0 1 248 690" fill="none" stroke={CIZGI} strokeWidth={CIZGI_KALIN} />

        {/* Köşe yayları */}
        <Path d="M 14 30 A 16 16 0 0 0 30 14" fill="none" stroke={CIZGI} strokeWidth={CIZGI_KALIN} />
        <Path d="M 370 14 A 16 16 0 0 0 386 30" fill="none" stroke={CIZGI} strokeWidth={CIZGI_KALIN} />
        <Path d="M 14 770 A 16 16 0 0 1 30 786" fill="none" stroke={CIZGI} strokeWidth={CIZGI_KALIN} />
        <Path d="M 370 786 A 16 16 0 0 1 386 770" fill="none" stroke={CIZGI} strokeWidth={CIZGI_KALIN} />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  kok: { flex: 1 },
});
