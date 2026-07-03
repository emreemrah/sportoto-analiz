import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import Svg, { Path, Circle, Ellipse, Rect, G } from 'react-native-svg';

// Açılış ekranı için 4 karakterlik el çizimi sahne: sol tarafta tezahürat
// yapan kadın taraftar, sağ tarafta topu sektirip vuran erkek, altta grafiğe
// bakan analist ikilisi. Gerçek SVG path'leri (react-native-svg) kullanılır,
// düz View/rect değil — kol/bacaklar stroke+round-cap "kapsül" tekniğiyle,
// saç/etek/yaka gibi detaylar bezier path ile çizilir.

const AnimatedG = Animated.createAnimatedComponent(G);

const SKIN = '#E8B88A';
const SKIN2 = '#F0C9A0';
const HAIR_DARK = '#3A2415';
const HAIR_BROWN = '#4A2A12';
const NAVY = '#0B1B3A';
const NAVY2 = '#12233F';
const RED = '#E21B2D';

// --- Kadın taraftar (sol) — tezahürat pozu ---
export function FanWoman({ width = 84, height = 210 }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 60 190">
      <Ellipse cx="30" cy="180" rx="22" ry="5" fill="#000000" opacity="0.18" />
      {/* kollar - yukarı kalkık tezahürat */}
      <Path d="M18 66 Q0 46 -6 20" stroke={SKIN} strokeWidth="9" strokeLinecap="round" fill="none" />
      <Path d="M42 66 Q60 46 66 20" stroke={SKIN} strokeWidth="9" strokeLinecap="round" fill="none" />
      {/* bacaklar */}
      <Path d="M22 128 Q28 156 28 178" stroke={SKIN} strokeWidth="10" strokeLinecap="round" fill="none" />
      <Path d="M38 128 Q32 156 28 178" stroke={SKIN} strokeWidth="10" strokeLinecap="round" fill="none" />
      <Ellipse cx="26" cy="182" rx="8" ry="4.5" fill={RED} />
      <Ellipse cx="34" cy="182" rx="8" ry="4.5" fill={RED} />
      {/* elbise/forma - trapez gövde, kırmızı etek payı */}
      <Path d="M14 70 Q30 52 46 70 L50 128 Q30 142 10 128 Z" fill="#ffffff" />
      <Path d="M10 128 Q30 142 50 128 L48 138 Q30 150 12 138 Z" fill={RED} />
      {/* baş */}
      <Circle cx="30" cy="38" r="22" fill={SKIN} />
      {/* saç - kahküllü + at kuyruğu */}
      <Path d="M8 34 Q10 6 30 6 Q50 6 52 34 Q40 20 30 20 Q20 20 8 34 Z" fill={HAIR_DARK} />
      <Path d="M8 34 Q2 56 12 72 Q4 52 8 34 Z" fill={HAIR_DARK} />
    </Svg>
  );
}

// --- Analist erkek (alt sol) — grafiğe işaret ediyor ---
export function AnalystMan({ width = 60, height = 150, pointAnim }) {
  const rotate = pointAnim
    ? pointAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-10deg'] })
    : '0deg';
  return (
    <Svg width={width} height={height} viewBox="0 0 48 130">
      <Ellipse cx="24" cy="122" rx="20" ry="4.5" fill="#000000" opacity="0.16" />
      <Path d="M14 78 Q24 100 24 120" stroke={SKIN} strokeWidth="8" strokeLinecap="round" fill="none" />
      <Path d="M34 78 Q28 100 24 120" stroke={SKIN} strokeWidth="8" strokeLinecap="round" fill="none" />
      <Ellipse cx="15" cy="123" rx="6.5" ry="3.5" fill={NAVY2} />
      <Ellipse cx="33" cy="123" rx="6.5" ry="3.5" fill={NAVY2} />
      <Path d="M8 46 Q24 30 40 46 L38 82 Q24 92 10 82 Z" fill="#ffffff" />
      <Path d="M10 82 Q24 92 38 82 L37 88 Q24 96 11 88 Z" fill={NAVY2} />
      <AnimatedG
        style={{
          transform: [
            { translateX: 32 }, { translateY: 50 },
            { rotate },
            { translateX: -32 }, { translateY: -50 },
          ],
        }}
      >
        <Path d="M32 50 Q46 54 50 66" stroke={SKIN} strokeWidth="7" strokeLinecap="round" fill="none" />
      </AnimatedG>
      <Path d="M14 50 Q4 58 2 68" stroke={SKIN} strokeWidth="7" strokeLinecap="round" fill="none" />
      <Circle cx="24" cy="22" r="16" fill={SKIN} />
      <Path d="M8 20 Q8 4 24 4 Q40 4 40 20 Q32 10 24 10 Q16 10 8 20 Z" fill={HAIR_DARK} />
    </Svg>
  );
}

// --- Analist kadın (alt sağ) — grafiğe bakıyor ---
export function AnalystWoman({ width = 60, height = 150 }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 48 130">
      <Ellipse cx="24" cy="122" rx="20" ry="4.5" fill="#000000" opacity="0.16" />
      <Path d="M14 78 Q24 100 24 120" stroke={SKIN2} strokeWidth="8" strokeLinecap="round" fill="none" />
      <Path d="M34 78 Q28 100 24 120" stroke={SKIN2} strokeWidth="8" strokeLinecap="round" fill="none" />
      <Ellipse cx="15" cy="123" rx="6.5" ry="3.5" fill="#7a1216" />
      <Ellipse cx="33" cy="123" rx="6.5" ry="3.5" fill="#7a1216" />
      <Path d="M8 46 Q24 32 40 46 L37 84 Q24 94 11 84 Z" fill={RED} />
      <Path d="M11 84 Q24 94 37 84 L36 90 Q24 98 12 90 Z" fill="#ffffff" />
      <Path d="M34 50 Q46 56 48 68" stroke={SKIN2} strokeWidth="7" strokeLinecap="round" fill="none" />
      <Path d="M12 50 Q0 56 -4 68" stroke={SKIN2} strokeWidth="7" strokeLinecap="round" fill="none" />
      <Circle cx="24" cy="22" r="16" fill={SKIN2} />
      <Path d="M8 22 Q8 4 24 4 Q40 4 40 22 Q38 10 24 12 Q10 10 8 22 Z" fill={HAIR_BROWN} />
      <Path d="M6 24 Q2 40 8 52 Q4 38 8 24 Z" fill={HAIR_BROWN} />
    </Svg>
  );
}

// --- Analiz kartı: iki analistin arasında büyüyen çubuk grafik ---
export function AnalysisCard({ width = 96, height = 70, anims }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 86 62">
      <Rect x="0" y="0" width="86" height="62" rx="12" fill={NAVY2} stroke="#ffffff" strokeOpacity="0.15" />
      <AnimatedG>
        <Rect x="14" y="34" width="10" height="16" rx="3" fill={RED} />
        <Rect x="30" y="24" width="10" height="26" rx="3" fill="#ffffff" />
        <Rect x="46" y="14" width="10" height="36" rx="3" fill={RED} />
      </AnimatedG>
      <Path d="M64 20 L74 12 L82 24" stroke="#5DCAA5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

// --- Erkek (sağ) — top sektirip vuruyor, top sıçrama animasyonu ---
export function KickingMan({ width = 88, height = 190 }) {
  const legRotate = useRef(new Animated.Value(0)).current;
  const ballX = useRef(new Animated.Value(0)).current;
  const ballY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bounce = () =>
      Animated.sequence([
        Animated.timing(ballY, { toValue: -18, duration: 260, useNativeDriver: true }),
        Animated.timing(ballY, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]);

    const seq = Animated.sequence([
      // sektirme x2
      bounce(),
      bounce(),
      Animated.delay(120),
      // vuruş: bacak geri-ileri, top uçar
      Animated.parallel([
        Animated.sequence([
          Animated.timing(legRotate, { toValue: -1, duration: 260, useNativeDriver: true }),
          Animated.timing(legRotate, { toValue: 1, duration: 180, useNativeDriver: true }),
          Animated.timing(legRotate, { toValue: 0, duration: 220, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(300),
          Animated.parallel([
            Animated.timing(ballX, { toValue: -130, duration: 520, useNativeDriver: true }),
            Animated.timing(ballY, { toValue: -34, duration: 520, useNativeDriver: true }),
          ]),
        ]),
      ]),
      Animated.delay(500),
      // sıfırla
      Animated.parallel([
        Animated.timing(ballX, { toValue: 0, duration: 1, useNativeDriver: true }),
        Animated.timing(ballY, { toValue: 0, duration: 1, useNativeDriver: true }),
      ]),
      Animated.delay(300),
    ]);

    const loop = Animated.loop(seq);
    loop.start();
    return () => loop.stop();
  }, [legRotate, ballX, ballY]);

  const legSpin = legRotate.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-35deg', '0deg', '42deg'] });

  return (
    <Svg width={width} height={height} viewBox="0 0 68 172">
      <Ellipse cx="30" cy="164" rx="26" ry="5" fill="#000000" opacity="0.2" />
      {/* sabit bacak */}
      <Path d="M18 92 Q30 132 30 162" stroke={SKIN} strokeWidth="10" strokeLinecap="round" fill="none" />
      <Ellipse cx="30" cy="165" rx="8" ry="4.5" fill={NAVY} />
      {/* vuran bacak (animasyonlu) - kalça ekleminden (42,92) döner */}
      <AnimatedG
        style={{
          transform: [
            { translateX: 42 }, { translateY: 92 },
            { rotate: legSpin },
            { translateX: -42 }, { translateY: -92 },
          ],
        }}
      >
        <Path d="M42 92 Q36 116 20 128" stroke={SKIN} strokeWidth="10" strokeLinecap="round" fill="none" />
        <Ellipse cx="18" cy="130" rx="8" ry="4.5" fill={NAVY} />
      </AnimatedG>
      {/* forma */}
      <Rect x="6" y="52" width="48" height="46" rx="16" fill={NAVY} stroke="#ffffff" strokeOpacity="0.28" strokeWidth="1.5" />
      <Rect x="6" y="62" width="48" height="7" fill={RED} />
      {/* kollar */}
      <Path d="M10 58 Q-8 70 -14 90" stroke={SKIN} strokeWidth="9" strokeLinecap="round" fill="none" />
      <Path d="M50 58 Q64 66 60 80" stroke={SKIN} strokeWidth="9" strokeLinecap="round" fill="none" />
      {/* baş */}
      <Circle cx="30" cy="26" r="20" fill={SKIN} />
      <Path d="M8 24 Q8 2 30 2 Q52 2 52 24 Q40 10 30 10 Q20 10 8 24 Z" fill="#1a2942" />
      {/* top */}
      <AnimatedG
        style={{
          transform: [{ translateX: ballX }, { translateY: ballY }],
        }}
      >
        <Circle cx="16" cy="140" r="12" fill="#ffffff" stroke={NAVY} strokeWidth="1.5" />
        <Path
          d="M16 132 L21 136 L19 142 L13 142 L11 136 Z"
          fill={NAVY}
        />
      </AnimatedG>
    </Svg>
  );
}
