// src/components/ScreenBackdrop.js
// Ana ekranların arkasına çok soluk "taktik tahtası" dokusu koyan sarmalayıcı.
// Bağımlılık: react-native-svg + RN Animated (yeni paket yok). Mobil + web.

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import Svg, {
  Defs,
  RadialGradient,
  Stop,
  Rect,
  Line,
  Circle,
  G,
} from 'react-native-svg';
import { colors } from '../theme';

const BG = colors.bg || colors.background || '#F3F5F9';
const LINE = 'rgba(11,27,58,0.09)';        // ana çizgi (soluk lacivert)
const LINE_SOFT = 'rgba(11,27,58,0.06)';   // daha soluk
const X_COLOR = 'rgba(11,27,58,0.22)';     // X işareti
const O_COLOR = 'rgba(226,27,45,0.22)';    // O işareti (accent ailesi)

function XMark({ x, y, s = 10 }) {
  return (
    <G>
      <Line x1={x - s} y1={y - s} x2={x + s} y2={y + s} stroke={X_COLOR} strokeWidth={3} strokeLinecap="round" />
      <Line x1={x - s} y1={y + s} x2={x + s} y2={y - s} stroke={X_COLOR} strokeWidth={3} strokeLinecap="round" />
    </G>
  );
}

export default function ScreenBackdrop({ children, style, animated = true }) {
  // Sadece opacity → useNativeDriver:true (web'de de sorunsuz, düşük maliyet)
  const breathe = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!animated) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 0.5, duration: 3000, useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 1, duration: 3000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animated, breathe]);

  return (
    <View style={[{ flex: 1, backgroundColor: BG }, style]}>
      {/* Statik saha çizgileri + üst parıltı */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 360 720"
          preserveAspectRatio="xMidYMid slice"
        >
          <Defs>
            <RadialGradient id="topGlow" cx="50%" cy="10%" r="65%">
              <Stop offset="0%" stopColor={colors.primary || '#0B1B3A'} stopOpacity="0.10" />
              <Stop offset="100%" stopColor={colors.primary || '#0B1B3A'} stopOpacity="0" />
            </RadialGradient>
          </Defs>

          <Rect x="0" y="0" width="360" height="720" fill="url(#topGlow)" />

          {/* Saha dış çizgisi */}
          <Rect x="24" y="40" width="312" height="640" fill="none" stroke={LINE} strokeWidth="2" />
          {/* Orta çizgi + orta yuvarlak + nokta */}
          <Line x1="24" y1="360" x2="336" y2="360" stroke={LINE} strokeWidth="2" />
          <Circle cx="180" cy="360" r="52" fill="none" stroke={LINE} strokeWidth="2" />
          <Circle cx="180" cy="360" r="3" fill={LINE} />
          {/* Üst ceza sahası + kale kutusu */}
          <Rect x="92" y="40" width="176" height="92" fill="none" stroke={LINE} strokeWidth="2" />
          <Rect x="136" y="40" width="88" height="36" fill="none" stroke={LINE_SOFT} strokeWidth="2" />
          {/* Alt ceza sahası + kale kutusu */}
          <Rect x="92" y="588" width="176" height="92" fill="none" stroke={LINE} strokeWidth="2" />
          <Rect x="136" y="644" width="88" height="36" fill="none" stroke={LINE_SOFT} strokeWidth="2" />
        </Svg>
      </View>

      {/* X/O işaretleri — hafif "nefes alan" katman */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: animated ? breathe : 1 }]}
        pointerEvents="none"
      >
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 360 720"
          preserveAspectRatio="xMidYMid slice"
        >
          <XMark x={100} y={250} />
          <Circle cx={250} cy={220} r={10} fill="none" stroke={O_COLOR} strokeWidth={3} />
          <XMark x={240} y={500} />
          <Circle cx={110} cy={540} r={10} fill="none" stroke={O_COLOR} strokeWidth={3} />
        </Svg>
      </Animated.View>

      {children}
    </View>
  );
}

/*
## Entegrasyon
Ana Sayfa / Bülten / Analiz / Profil ekran köklerini sarmala:
  <ScreenBackdrop>
    <ScrollView style={[styles.container, { backgroundColor: 'transparent' }]} ...>
      ...mevcut içerik...
    </ScrollView>
  </ScreenBackdrop>
FlatList/View kökleri için de aynı: kökün backgroundColor'ını 'transparent' yap
ki desen boşluklardan görünsün. Desen pointerEvents="none" — dokunuşu engellemez.
*/
