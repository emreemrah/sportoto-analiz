// src/components/BulletinHeroVisual.js
// "Bu Haftanın Bülteni" hero kartı görseli (v5 — master, uzun döngü ~11.3sn):
// Kalem sahayı çizer → X ve O işaretlerini yazar → X'ten O'ya ve O'dan kaleye
// PAS OKLARINI çizer → bekler → zigzag hareketle tahtayı SİLER → baştan başlar.
// Tek progress değeriyle tüm koreografi senkron. Kalem marka kırmızısı.
// 1) BulletinHeroVisual (default)  2) BulletinHeroBackdrop (named, kart zemini)
// Bağımlılık: react-native-svg + RN Animated (yeni paket yok). Mobil + web.

import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import Svg, { G, Rect, Line, Circle, Path, Polygon } from 'react-native-svg';
import { colors } from '../theme';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const CHALK = 'rgba(255,255,255,0.10)';
const CHALK_SOFT = 'rgba(255,255,255,0.06)';
const PITCH_LINE = 'rgba(255,255,255,0.9)';

// ---------------------------------------------------------------------------
// Kart zemini (değişmedi)
// ---------------------------------------------------------------------------
export function BulletinHeroBackdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 340 170" preserveAspectRatio="xMidYMid slice">
        <Circle cx="0" cy="85" r="70" fill="none" stroke={CHALK} strokeWidth="2" />
        <Circle cx="0" cy="85" r="3" fill={CHALK} />
        <Rect x="250" y="-40" width="130" height="90" fill="none" stroke={CHALK_SOFT} strokeWidth="2" />
        <Line x1="196" y1="128" x2="210" y2="142" stroke={CHALK} strokeWidth="2.5" strokeLinecap="round" />
        <Line x1="196" y1="142" x2="210" y2="128" stroke={CHALK} strokeWidth="2.5" strokeLinecap="round" />
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Koreografi (progress 0–1, 10500ms + 800ms bekleme):
//  saha (0–0.54) → noktalar → X (0.565–0.625) → O (0.635–0.69)
//  → pas oku 1: X→O (0.70–0.76) → pas oku 2: O→kale (0.77–0.83)
//  → bekleme (0.83–0.88) → SİLME: zigzag + solma (0.88–0.985) → boş
// ---------------------------------------------------------------------------
const RECT_LEN = 380, MID_LEN = 70, CIRC_LEN = 88, BOX_LEN = 84;
const X_LEN = 17, O_LEN = 51, AR1_LEN = 50, AR2_LEN = 32;

const P_IN = [0, 0.012, 0.0714, 0.106, 0.1654, 0.20, 0.205, 0.25, 0.255, 0.276, 0.2975, 0.319, 0.34, 0.345, 0.3699, 0.4151, 0.44, 0.445, 0.47, 0.515, 0.54, 0.565, 0.59, 0.60, 0.625, 0.635, 0.649, 0.663, 0.676, 0.69, 0.70, 0.73, 0.76, 0.77, 0.80, 0.83, 0.88, 0.895, 0.913, 0.931, 0.949, 0.967, 0.985, 1];
const P_X = [15, 15, 135, 135, 15, 15, 75, 75, 75, 89, 75, 61, 75, 15, 37, 37, 15, 135, 113, 113, 135, 39, 51, 39, 51, 100, 108, 100, 92, 100, 54, 72, 90, 104, 115, 126, 126, 20, 130, 20, 130, 20, 75, 75];
const P_Y = [20, 20, 20, 90, 90, 20, 20, 90, 41, 55, 69, 55, 41, 35, 35, 75, 75, 35, 35, 75, 75, 39, 51, 51, 39, 57, 65, 73, 65, 57, 47, 40, 56, 58, 46, 44, 44, 30, 40, 55, 70, 85, 55, 55];

export default function BulletinHeroVisual({ width = 132, height = 97, animated = true }) {
  const progress = useRef(new Animated.Value(animated ? 0 : 0.83)).current;

  useEffect(() => {
    if (!animated) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration: 10500, easing: Easing.linear, useNativeDriver: false }),
        Animated.delay(800),
        Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animated, progress]);

  const dash = (len, a, b) =>
    progress.interpolate({ inputRange: [0, a, b, 1], outputRange: [len, len, 0, 0] });
  const appear = (a, b) =>
    progress.interpolate({ inputRange: [0, a, b, 1], outputRange: [0, 0, 1, 1] });

  const px = progress.interpolate({ inputRange: P_IN, outputRange: P_X });
  const py = progress.interpolate({ inputRange: P_IN, outputRange: P_Y });
  const fillOpacity = progress.interpolate({ inputRange: [0, 0.012, 0.06, 1], outputRange: [0, 0.2, 1, 1] });
  // Silme: tahta 0.88–0.985 arasında solar (kalem zigzag "silerken")
  const boardOpacity = progress.interpolate({ inputRange: [0, 0.88, 0.985, 1], outputRange: [1, 1, 0, 0] });

  return (
    <View style={{ width, height }} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 150 110">
        {/* TAHTA — silme fazında topluca solar */}
        <AnimatedG opacity={boardOpacity}>
          <AnimatedRect x="10" y="15" width="130" height="80" rx="6" fill={colors.success} opacity={fillOpacity} />
          <AnimatedRect
            x="15" y="20" width="120" height="70" fill="none"
            stroke={PITCH_LINE} strokeWidth="2" strokeLinecap="round"
            strokeDasharray={`${RECT_LEN}`} strokeDashoffset={dash(RECT_LEN, 0.012, 0.20)}
          />
          <AnimatedLine
            x1="75" y1="20" x2="75" y2="90" stroke={PITCH_LINE} strokeWidth="2" strokeLinecap="round"
            strokeDasharray={`${MID_LEN}`} strokeDashoffset={dash(MID_LEN, 0.205, 0.25)}
          />
          <AnimatedCircle
            cx="75" cy="55" r="14" fill="none" stroke={PITCH_LINE} strokeWidth="2"
            strokeDasharray={`${CIRC_LEN}`} strokeDashoffset={dash(CIRC_LEN, 0.255, 0.34)}
          />
          <AnimatedPath
            d="M 15 35 L 37 35 L 37 75 L 15 75" fill="none"
            stroke={PITCH_LINE} strokeWidth="2" strokeLinecap="round"
            strokeDasharray={`${BOX_LEN}`} strokeDashoffset={dash(BOX_LEN, 0.345, 0.44)}
          />
          <AnimatedPath
            d="M 135 35 L 113 35 L 113 75 L 135 75" fill="none"
            stroke={PITCH_LINE} strokeWidth="2" strokeLinecap="round"
            strokeDasharray={`${BOX_LEN}`} strokeDashoffset={dash(BOX_LEN, 0.445, 0.54)}
          />
          <AnimatedG opacity={appear(0.54, 0.555)}>
            <Circle cx="75" cy="55" r="1.8" fill={PITCH_LINE} />
            <Circle cx="28" cy="55" r="1.5" fill={PITCH_LINE} />
            <Circle cx="122" cy="55" r="1.5" fill={PITCH_LINE} />
          </AnimatedG>

          {/* X — iki hamlede (beyaz) */}
          <AnimatedLine
            x1="39" y1="39" x2="51" y2="51" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round"
            strokeDasharray={`${X_LEN}`} strokeDashoffset={dash(X_LEN, 0.565, 0.59)}
          />
          <AnimatedLine
            x1="39" y1="51" x2="51" y2="39" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round"
            strokeDasharray={`${X_LEN}`} strokeDashoffset={dash(X_LEN, 0.60, 0.625)}
          />
          {/* O — kırmızı */}
          <AnimatedCircle
            cx="100" cy="65" r="8" fill="none" stroke={colors.accent} strokeWidth="3.5"
            strokeDasharray={`${O_LEN}`} strokeDashoffset={dash(O_LEN, 0.635, 0.69)}
          />

          {/* Pas oku 1: X → O (koyu lacivert, yeşil zeminde okunur) */}
          <AnimatedPath
            d="M 54 47 C 68 38, 82 44, 90 56" fill="none"
            stroke={colors.primary} strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray={`${AR1_LEN}`} strokeDashoffset={dash(AR1_LEN, 0.70, 0.76)}
          />
          <AnimatedPath d="M 90 56 l -9 -1 l 4 -8 Z" fill={colors.primary} opacity={appear(0.75, 0.765)} />

          {/* Pas oku 2: O → kale */}
          <AnimatedPath
            d="M 104 58 C 110 48, 118 44, 126 44" fill="none"
            stroke={colors.primary} strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray={`${AR2_LEN}`} strokeDashoffset={dash(AR2_LEN, 0.77, 0.83)}
          />
          <AnimatedPath d="M 126 44 l -8 3 l 1 -9 Z" fill={colors.primary} opacity={appear(0.82, 0.835)} />
        </AnimatedG>

        {/* KALEM — çizer, yazar, ok atar, sonra zigzagla siler (ucu 0,0) */}
        <AnimatedG x={px} y={py}>
          <Polygon points="0,0 7,-2.5 2.5,-7" fill={colors.muted || '#98A2B3'} />
          <Path d="M 4.8 -4.8 L 19 -19" stroke={colors.accent} strokeWidth="6" strokeLinecap="butt" />
          <Path d="M 19 -19 L 22 -22" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
          <Path d="M 0 0 L 2.2 -2.2" stroke={colors.primaryDark || '#071329'} strokeWidth="1.8" strokeLinecap="round" />
        </AnimatedG>
      </Svg>
    </View>
  );
}

/*
## Entegrasyon (hero kart) — API değişmedi
  <View style={styles.heroCard}>            // overflow:'hidden' olmalı
    <BulletinHeroBackdrop />
    <View style={styles.heroLeft}>...başlık, açıklama, istatistikler...</View>
    <BulletinHeroVisual width={132} height={97} />
  </View>

import BulletinHeroVisual, { BulletinHeroBackdrop } from '../components/BulletinHeroVisual';
*/
