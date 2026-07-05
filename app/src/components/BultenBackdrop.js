// src/components/BultenBackdrop.js
// Bülten ekranı için "master" animasyonlu arka plan (AÇIK tema).
// Çok soluk, yaşayan bir taktik tahtası: saha çizgileri + yavaşça çizilip silinen
// pas okları + köşede süzülerek dönen dev top filigranı + nefes alan X/O işaretleri.
// İçerik OKUNUR kalır (tüm alfa değerleri 0.03–0.07 bandında).
//
// Kullanım (ScreenBackdrop ile aynı desen):
//   <BultenBackdrop>
//     <ScrollView style={[styles.container, { backgroundColor: 'transparent' }]} ...>
//       ...mevcut bülten içeriği...
//     </ScrollView>
//   </BultenBackdrop>
//
// Bağımlılık: react-native-svg + RN Animated (yeni paket yok). Mobil + web.

import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import Svg, {
  Defs, RadialGradient, Stop,
  G, Rect, Line, Circle, Path, Polygon,
} from 'react-native-svg';
import { colors } from '../theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

const BG = colors.bg || colors.background || '#F3F5F9';
const LINE = 'rgba(11,27,58,0.05)';
const LINE_SOFT = 'rgba(11,27,58,0.035)';
const X_COLOR = 'rgba(11,27,58,0.07)';
const O_COLOR = 'rgba(226,27,45,0.07)';
const ARROW = 'rgba(22,163,74,0.10)';   // pas oku (success ailesi, çok soluk)
const BALL = 'rgba(11,27,58,0.045)';    // top filigranı

// Pas okları: uzun, sakin rotalar
const ARROWS = [
  { d: 'M 60 200 C 120 260, 200 280, 280 250', len: 240, head: 'M 280 250 l -16 -1 l 7 -13 Z' },
  { d: 'M 300 480 C 240 420, 160 410, 80 460', len: 250, head: 'M 80 460 l 16 -3 l -5 14 Z' },
];

export default function BultenBackdrop({ children, style, animated = true }) {
  const breathe = useRef(new Animated.Value(1)).current;                 // X/O nefes (native)
  const spin = useRef(new Animated.Value(0)).current;                    // top filigranı dönüş (native)
  const arrows = useRef(ARROWS.map(() => new Animated.Value(animated ? 0 : 1))).current; // oklar (non-native)

  useEffect(() => {
    if (!animated) return;

    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 0.45, duration: 3000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    // Dev top filigranı: 60 sn'de tam tur — fark edilmeyecek kadar yavaş
    const spinLoop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 60000, easing: Easing.linear, useNativeDriver: true })
    );
    // Oklar: sırayla yavaşça çizilir, bekler, birlikte silinir
    const arrowLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(800),
        Animated.stagger(
          1200,
          arrows.map((v) => Animated.timing(v, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: false }))
        ),
        Animated.delay(2600),
        Animated.parallel(
          arrows.map((v) => Animated.timing(v, { toValue: 0, duration: 900, useNativeDriver: false }))
        ),
        Animated.delay(1200),
      ])
    );

    breatheLoop.start(); spinLoop.start(); arrowLoop.start();
    return () => { breatheLoop.stop(); spinLoop.stop(); arrowLoop.stop(); };
  }, [animated, breathe, spin, arrows]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={[{ flex: 1, backgroundColor: BG }, style]}>
      {/* Statik katman: parıltı + saha çizgileri */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 360 720" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <RadialGradient id="bultenGlow" cx="50%" cy="8%" r="60%">
              <Stop offset="0%" stopColor={colors.primary || '#0B1B3A'} stopOpacity="0.06" />
              <Stop offset="100%" stopColor={colors.primary || '#0B1B3A'} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="360" height="720" fill="url(#bultenGlow)" />

          {/* Saha */}
          <Rect x="24" y="40" width="312" height="640" fill="none" stroke={LINE} strokeWidth="2" />
          <Line x1="24" y1="360" x2="336" y2="360" stroke={LINE} strokeWidth="2" />
          <Circle cx="180" cy="360" r="52" fill="none" stroke={LINE} strokeWidth="2" />
          <Circle cx="180" cy="360" r="3" fill={LINE} />
          <Rect x="92" y="40" width="176" height="92" fill="none" stroke={LINE} strokeWidth="2" />
          <Rect x="136" y="40" width="88" height="36" fill="none" stroke={LINE_SOFT} strokeWidth="2" />
          <Rect x="92" y="588" width="176" height="92" fill="none" stroke={LINE} strokeWidth="2" />
          <Rect x="136" y="644" width="88" height="36" fill="none" stroke={LINE_SOFT} strokeWidth="2" />
          {/* Köşe yayları */}
          <Path d="M 24 56 A 16 16 0 0 0 40 40" fill="none" stroke={LINE_SOFT} strokeWidth="2" />
          <Path d="M 320 40 A 16 16 0 0 0 336 56" fill="none" stroke={LINE_SOFT} strokeWidth="2" />
          <Path d="M 336 664 A 16 16 0 0 0 320 680" fill="none" stroke={LINE_SOFT} strokeWidth="2" />
          <Path d="M 40 680 A 16 16 0 0 0 24 664" fill="none" stroke={LINE_SOFT} strokeWidth="2" />

          {/* Pas okları — yavaşça çizilir/silinir */}
          {ARROWS.map((a, i) => (
            <G key={`ba-${i}`}>
              <AnimatedPath
                d={a.d} fill="none" stroke={ARROW} strokeWidth={3} strokeLinecap="round"
                strokeDasharray={`${a.len}`}
                strokeDashoffset={arrows[i].interpolate({ inputRange: [0, 1], outputRange: [a.len, 0] })}
              />
              <AnimatedPath
                d={a.head} fill={ARROW}
                opacity={arrows[i].interpolate({ inputRange: [0, 0.88, 1], outputRange: [0, 0, 1] })}
              />
            </G>
          ))}
        </Svg>
      </View>

      {/* X/O işaretleri — nefes alan katman (sadece opacity → native) */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: animated ? breathe : 1 }]} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 360 720" preserveAspectRatio="xMidYMid slice">
          <G>
            <Line x1="90" y1="240" x2="110" y2="260" stroke={X_COLOR} strokeWidth="3" strokeLinecap="round" />
            <Line x1="90" y1="260" x2="110" y2="240" stroke={X_COLOR} strokeWidth="3" strokeLinecap="round" />
          </G>
          <Circle cx="250" cy="210" r="10" fill="none" stroke={O_COLOR} strokeWidth="3" />
          <G>
            <Line x1="236" y1="496" x2="256" y2="516" stroke={X_COLOR} strokeWidth="3" strokeLinecap="round" />
            <Line x1="236" y1="516" x2="256" y2="496" stroke={X_COLOR} strokeWidth="3" strokeLinecap="round" />
          </G>
          <Circle cx="104" cy="548" r="10" fill="none" stroke={O_COLOR} strokeWidth="3" />
        </Svg>
      </Animated.View>

      {/* Dev top filigranı — sağ alt köşede çok yavaş döner (transform → native) */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: -70,
          bottom: -70,
          width: 220,
          height: 220,
          transform: [{ rotate }],
        }}
      >
        <Svg width="100%" height="100%" viewBox="0 0 48 48">
          <Circle cx="24" cy="24" r="21" fill="none" stroke={BALL} strokeWidth="1.6" />
          <Polygon points="24,16 31.6,21.5 28.7,30.5 19.3,30.5 16.4,21.5" fill="none" stroke={BALL} strokeWidth="1.6" />
          <Line x1="24" y1="16" x2="24" y2="4" stroke={BALL} strokeWidth="1.4" />
          <Line x1="31.6" y1="21.5" x2="43" y2="17.8" stroke={BALL} strokeWidth="1.4" />
          <Line x1="28.7" y1="30.5" x2="35.8" y2="40.2" stroke={BALL} strokeWidth="1.4" />
          <Line x1="19.3" y1="30.5" x2="12.2" y2="40.2" stroke={BALL} strokeWidth="1.4" />
          <Line x1="16.4" y1="21.5" x2="5" y2="17.8" stroke={BALL} strokeWidth="1.4" />
        </Svg>
      </Animated.View>

      {children}
    </View>
  );
}

/*
## Entegrasyon (Bülten ekranı)
  import BultenBackdrop from '../components/BultenBackdrop';

  <BultenBackdrop>
    <ScrollView style={[styles.container, { backgroundColor: 'transparent' }]} ...>
      ...mevcut bülten içeriği (başlık, kupon butonları, filtreler, maç kartları)...
    </ScrollView>
  </BultenBackdrop>

FlatList kökü için de aynı: kökün backgroundColor'ı 'transparent' olmalı.
Desen pointerEvents="none" — kaydırma ve dokunuşları engellemez.
*/
