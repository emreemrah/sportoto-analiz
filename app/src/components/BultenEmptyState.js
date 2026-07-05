// src/components/BultenEmptyState.js
// "Haftanın Bülteni" boş durumu: bir kalem, taktik tahtasını ÇİZEREK oluşturur
// (dış saha → orta çizgi → orta yuvarlak → sol/sağ ceza sahası → noktalar),
// kısa bekler, silinir ve baştan çizer. GIF referansının tema uyarlaması.
// Bağımlılık: react-native-svg + RN Animated (yeni paket yok). Mobil + web.
//
// Kullanım:
//   <BultenEmptyState
//     title="Bu haftanın bülteni henüz yayınlanmadı"
//     message="Resmi bülten açıklandığında burada görünecek."
//     onRefresh={load}          // opsiyonel; yoksa buton gizlenir
//   />

import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, StyleSheet } from 'react-native';
import Svg, { G, Rect, Line, Circle, Path, Polygon } from 'react-native-svg';
import { colors, spacing, radius, font } from '../theme';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const INK = 'rgba(11,27,58,0.18)';   // tebeşir/karakalem çizgisi
const INK_SOFT = 'rgba(11,27,58,0.12)';

// Çizim penceresi (progress 0–1) ve yol uzunlukları
const RECT_LEN = 380;   // dış saha çevresi
const MID_LEN = 70;     // orta çizgi
const CIRC_LEN = 88;    // orta yuvarlak çevresi
const BOX_LEN = 84;     // ceza sahası (3 kenar)

// Kalem ucunun izlediği rota (progress → x/y)
const P_IN = [0, 0.02, 0.1242, 0.185, 0.2892, 0.35, 0.355, 0.44, 0.445, 0.48, 0.52, 0.56, 0.60, 0.605, 0.6497, 0.7403, 0.79, 0.795, 0.8397, 0.9303, 0.98, 1];
const P_X = [15, 15, 135, 135, 15, 15, 75, 75, 75, 89, 75, 61, 75, 15, 37, 37, 15, 135, 113, 113, 135, 135];
const P_Y = [20, 20, 20, 90, 90, 20, 20, 90, 41, 55, 69, 55, 41, 35, 35, 75, 75, 35, 35, 75, 75, 75];

export default function BultenEmptyState({
  title = 'Bu haftanın bülteni henüz yayınlanmadı',
  message = 'Resmi bülten açıklandığında maçlar ve analizler burada görünecek.',
  onRefresh,
}) {
  const progress = useRef(new Animated.Value(0)).current; // çizim (non-native: SVG props)
  const fade = useRef(new Animated.Value(1)).current;     // döngü arası silinme (native)

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration: 4400, easing: Easing.linear, useNativeDriver: false }),
        Animated.delay(1400),
        Animated.timing(fade, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: false }),
        Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [progress, fade]);

  const dash = (len, a, b) =>
    progress.interpolate({ inputRange: [0, a, b, 1], outputRange: [len, len, 0, 0] });

  const px = progress.interpolate({ inputRange: P_IN, outputRange: P_X });
  const py = progress.interpolate({ inputRange: P_IN, outputRange: P_Y });
  const dotsOpacity = progress.interpolate({ inputRange: [0, 0.98, 1], outputRange: [0, 0, 1] });

  return (
    <View style={styles.wrap}>
      <Animated.View style={{ opacity: fade }}>
        <Svg width={240} height={176} viewBox="0 0 150 110">
          {/* Tahta zemini */}
          <Rect x="10" y="15" width="130" height="80" rx="4" fill={colors.surface || '#FFFFFF'} stroke={INK_SOFT} strokeWidth="1.5" />

          {/* Dış saha */}
          <AnimatedRect
            x="15" y="20" width="120" height="70" fill="none"
            stroke={INK} strokeWidth="2" strokeLinecap="round"
            strokeDasharray={`${RECT_LEN}`} strokeDashoffset={dash(RECT_LEN, 0.02, 0.35)}
          />
          {/* Orta çizgi */}
          <AnimatedLine
            x1="75" y1="20" x2="75" y2="90"
            stroke={INK} strokeWidth="2" strokeLinecap="round"
            strokeDasharray={`${MID_LEN}`} strokeDashoffset={dash(MID_LEN, 0.355, 0.44)}
          />
          {/* Orta yuvarlak */}
          <AnimatedCircle
            cx="75" cy="55" r="14" fill="none"
            stroke={INK} strokeWidth="2"
            strokeDasharray={`${CIRC_LEN}`} strokeDashoffset={dash(CIRC_LEN, 0.445, 0.60)}
          />
          {/* Sol ceza sahası */}
          <AnimatedPath
            d="M 15 35 L 37 35 L 37 75 L 15 75" fill="none"
            stroke={INK} strokeWidth="2" strokeLinecap="round"
            strokeDasharray={`${BOX_LEN}`} strokeDashoffset={dash(BOX_LEN, 0.605, 0.79)}
          />
          {/* Sağ ceza sahası */}
          <AnimatedPath
            d="M 135 35 L 113 35 L 113 75 L 135 75" fill="none"
            stroke={INK} strokeWidth="2" strokeLinecap="round"
            strokeDasharray={`${BOX_LEN}`} strokeDashoffset={dash(BOX_LEN, 0.795, 0.98)}
          />
          {/* Noktalar — en sonda belirir */}
          <AnimatedG opacity={dotsOpacity}>
            <Circle cx="75" cy="55" r="1.8" fill={INK} />
            <Circle cx="28" cy="55" r="1.5" fill={INK} />
            <Circle cx="122" cy="55" r="1.5" fill={INK} />
          </AnimatedG>

          {/* Kalem — çizgiyi takip eder (ucu 0,0) */}
          <AnimatedG x={px} y={py}>
            <Polygon points="0,0 7,-2.5 2.5,-7" fill={colors.muted || '#98A2B3'} />
            <Path d="M 4.8 -4.8 L 19 -19" stroke={colors.accent} strokeWidth="6" strokeLinecap="butt" />
            <Path d="M 19 -19 L 22 -22" stroke={colors.primaryDark || '#071329'} strokeWidth="6" strokeLinecap="round" />
            <Path d="M 0 0 L 2.2 -2.2" stroke={colors.primaryDark || '#071329'} strokeWidth="1.8" strokeLinecap="round" />
          </AnimatedG>
        </Svg>
      </Animated.View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>

      {onRefresh ? (
        <TouchableOpacity style={styles.btn} onPress={onRefresh} activeOpacity={0.85}>
          <Text style={styles.btnText}>Yenile</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  title: {
    marginTop: spacing.lg,
    fontSize: font.lg,
    fontWeight: font.bold,
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    marginTop: spacing.sm,
    fontSize: font.md,
    lineHeight: font.md * 1.5,
    color: colors.textSoft,
    textAlign: 'center',
    maxWidth: 280,
  },
  btn: {
    marginTop: spacing.xl,
    height: 44,
    paddingHorizontal: spacing.xxxl,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: font.md,
    fontWeight: font.bold,
    color: '#FFFFFF',
  },
});

/*
## Entegrasyon (Bülten ekranı)
Bülten listesi boşsa (resmi bülten henüz yok):

  if (!loading && (!matches || matches.length === 0)) {
    return <BultenEmptyState onRefresh={load} />;
  }

Sahte veri gösterme — sadece boş durum. onRefresh verilmezse buton gizlenir.
*/
