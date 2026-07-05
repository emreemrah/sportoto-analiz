// src/components/TacticalPitchBackground.js
// Lacivert "taktik tahtası" animasyonlu arka plan.
// Bağımlılık: react-native-svg + RN Animated (yeni paket yok).
// Web uyumu: SVG prop animasyonları useNativeDriver:false.

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import Svg, { G, Rect, Line, Circle, Path } from 'react-native-svg';
import { colors } from '../theme';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const CHALK = 'rgba(255,255,255,0.32)';
const CHALK_SOFT = 'rgba(255,255,255,0.18)';

// Taktik işaretleri: X (beyaz) ve O (kırmızı)
const MARKS = [
  { type: 'x', x: 120, y: 190 },
  { type: 'o', x: 236, y: 170 },
  { type: 'x', x: 90,  y: 330 },
  { type: 'o', x: 180, y: 300 },
  { type: 'x', x: 258, y: 356 },
  { type: 'o', x: 132, y: 468 },
  { type: 'x', x: 226, y: 494 },
];

// Pas okları (success yeşili) — düz çizgiler; len, dash animasyonu için pay bırakılmış uzunluk
const ARROWS = [
  { d: 'M 120 190 L 172 292', len: 120, head: 'M 172 292 l -9 -8 l 12 -2 Z' },
  { d: 'M 180 300 L 250 350', len: 95,  head: 'M 250 350 l -12 -2 l 6 -10 Z' },
  { d: 'M 258 356 L 232 486', len: 140, head: 'M 232 486 l -3 -12 l 11 4 Z' },
  { d: 'M 132 468 L 96 340',  len: 140, head: 'M 96 340 l 9 9 l -12 2 Z' },
];

function XMark({ x, y, s = 9 }) {
  return (
    <G>
      <Line x1={x - s} y1={y - s} x2={x + s} y2={y + s} stroke="#FFFFFF" strokeWidth={3.5} strokeLinecap="round" />
      <Line x1={x - s} y1={y + s} x2={x + s} y2={y - s} stroke="#FFFFFF" strokeWidth={3.5} strokeLinecap="round" />
    </G>
  );
}

export default function TacticalPitchBackground({ marks = true, animated = true, opacity = 1 }) {
  const markAnims = useRef(MARKS.map(() => new Animated.Value(animated ? 0 : 1))).current;
  const arrowAnims = useRef(ARROWS.map(() => new Animated.Value(animated ? 0 : 1))).current;

  useEffect(() => {
    if (!animated || !marks) return;

    const seq = Animated.sequence([
      Animated.delay(300),
      // X/O işaretleri sırayla belirsin
      Animated.stagger(
        160,
        markAnims.map((v) =>
          Animated.timing(v, { toValue: 1, duration: 420, useNativeDriver: false })
        )
      ),
      // Pas okları çizilerek gelsin
      Animated.stagger(
        260,
        arrowAnims.map((v) =>
          Animated.timing(v, { toValue: 1, duration: 800, useNativeDriver: false })
        )
      ),
      Animated.delay(1600),
      // Hepsi birlikte silinsin, döngü başa dönsün
      Animated.parallel(
        [...markAnims, ...arrowAnims].map((v) =>
          Animated.timing(v, { toValue: 0, duration: 450, useNativeDriver: false })
        )
      ),
      Animated.delay(400),
    ]);

    const loop = Animated.loop(seq);
    loop.start();
    return () => loop.stop();
  }, [animated, marks, markAnims, arrowAnims]);

  return (
    <View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 360 640"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Zemin */}
        <Rect x="0" y="0" width="360" height="640" fill={colors.primaryDark} />

        {/* Saha çizgileri (tebeşir) */}
        <Rect x="24" y="34" width="312" height="572" fill="none" stroke={CHALK} strokeWidth="2.5" />
        <Line x1="24" y1="320" x2="336" y2="320" stroke={CHALK} strokeWidth="2.5" />
        <Circle cx="180" cy="320" r="48" fill="none" stroke={CHALK} strokeWidth="2.5" />
        <Circle cx="180" cy="320" r="3.5" fill={CHALK} />

        {/* Üst ceza sahası + kale */}
        <Rect x="92" y="34" width="176" height="88" fill="none" stroke={CHALK} strokeWidth="2.5" />
        <Rect x="136" y="34" width="88" height="34" fill="none" stroke={CHALK_SOFT} strokeWidth="2" />
        <Circle cx="180" cy="98" r="3" fill={CHALK} />

        {/* Alt ceza sahası + kale */}
        <Rect x="92" y="518" width="176" height="88" fill="none" stroke={CHALK} strokeWidth="2.5" />
        <Rect x="136" y="572" width="88" height="34" fill="none" stroke={CHALK_SOFT} strokeWidth="2" />
        <Circle cx="180" cy="542" r="3" fill={CHALK} />

        {marks && (
          <G>
            {/* Pas okları */}
            {ARROWS.map((a, i) => (
              <G key={`arrow-${i}`}>
                <AnimatedPath
                  d={a.d}
                  fill="none"
                  stroke={colors.success}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeDasharray={`${a.len}`}
                  strokeDashoffset={arrowAnims[i].interpolate({
                    inputRange: [0, 1],
                    outputRange: [a.len, 0],
                  })}
                />
                {/* Ok başı — çizim bitmeye yakın belirir */}
                <AnimatedPath
                  d={a.head}
                  fill={colors.success}
                  opacity={arrowAnims[i].interpolate({
                    inputRange: [0, 0.8, 1],
                    outputRange: [0, 0, 1],
                  })}
                />
              </G>
            ))}

            {/* X / O işaretleri */}
            {MARKS.map((m, i) => (
              <AnimatedG key={`mark-${i}`} opacity={markAnims[i]}>
                {m.type === 'x' ? (
                  <XMark x={m.x} y={m.y} />
                ) : (
                  <Circle
                    cx={m.x}
                    cy={m.y}
                    r={9}
                    fill="none"
                    stroke={colors.accent}
                    strokeWidth={3.5}
                  />
                )}
              </AnimatedG>
            ))}
          </G>
        )}
      </Svg>
    </View>
  );
}
