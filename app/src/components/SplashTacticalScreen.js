// src/components/SplashTacticalScreen.js
// Açılış ekranı: lacivert taktik tahtası + marka kartı + ince ilerleme çubuğu.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import TacticalPitchBackground from './TacticalPitchBackground';
import { colors, spacing, radius, font } from '../theme';

const MESSAGES = [
  'Bülten ve maç verileri hazırlanıyor...',
  'Analiz tahtası kuruluyor...',
  'Resmi bülten kontrol ediliyor...',
];

export default function SplashTacticalScreen() {
  // Kart girişi: fade + yukarı kayma (transform/opacity → native driver)
  const cardIn = useRef(new Animated.Value(0)).current;
  // İlerleme çubuğu: width animasyonu → useNativeDriver:false
  const progress = useRef(new Animated.Value(0)).current;
  // Mesaj geçişi
  const msgOpacity = useRef(new Animated.Value(1)).current;
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    Animated.timing(cardIn, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [cardIn]);

  useEffect(() => {
    // Soldan sağa dolar, hafifçe geri çekilir, tamamlanır; loop başa sarar.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 0.72, duration: 1000, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.timing(progress, { toValue: 0.58, duration: 320, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(progress, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
        Animated.delay(200),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  useEffect(() => {
    const id = setInterval(() => {
      Animated.timing(msgOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setMsgIndex((i) => (i + 1) % MESSAGES.length);
        Animated.timing(msgOpacity, { toValue: 1, duration: 260, useNativeDriver: true }).start();
      });
    }, 1800);
    return () => clearInterval(id);
  }, [msgOpacity]);

  const cardStyle = {
    opacity: cardIn,
    transform: [
      {
        translateY: cardIn.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }),
      },
    ],
  };

  const barWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <TacticalPitchBackground />

      <View style={styles.center}>
        <Animated.View style={[styles.card, cardStyle]}>
          <View style={styles.brandRow}>
            <View style={styles.accentBar} />
            <Text style={styles.brandTop}>SPOR TOTO</Text>
          </View>
          <Text style={styles.brandMain}>ANALİZ</Text>

          {/* İnce ilerleme çubuğu */}
          <View style={styles.track}>
            <Animated.View style={[styles.fill, { width: barWidth }]} />
          </View>

          <Animated.Text style={[styles.status, { opacity: msgOpacity }]} numberOfLines={1}>
            {MESSAGES[msgIndex]}
          </Animated.Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.primaryDark,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  card: {
    // Yarı saydam koyu kart (darkCard + alpha)
    backgroundColor: `${colors.darkCard}CC`,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xxxl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  accentBar: {
    width: 4,
    height: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  brandTop: {
    fontSize: font.sm,
    fontWeight: font.semibold,
    letterSpacing: 6,
    color: colors.muted,
  },
  brandMain: {
    marginTop: spacing.xs,
    fontSize: font.xxl + 8,
    fontWeight: font.heavy,
    letterSpacing: 3,
    color: '#FFFFFF',
  },
  track: {
    marginTop: spacing.xl,
    width: 180,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  status: {
    marginTop: spacing.lg,
    fontSize: font.sm,
    color: colors.muted,
    textAlign: 'center',
  },
});
