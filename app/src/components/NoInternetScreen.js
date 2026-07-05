// src/components/NoInternetScreen.js
// Bağlantı hatası ekranı + isNetworkError yardımcı fonksiyonu.

import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import TacticalPitchBackground from './TacticalPitchBackground';
import { colors, spacing, radius, font, shadow } from '../theme';

// Gerçek ağ hatası mı? (4xx/5xx sunucu yanıtları bunun DIŞINDA kalır)
export function isNetworkError(e) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const msg = String((e && (e.message || e)) || '').toLowerCase();
  return (
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror')
  );
}

export default function NoInternetScreen({ onRetry, onGoHome }) {
  // Nabız gibi atan ikon (opacity → native driver)
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <TacticalPitchBackground opacity={0.3} marks={false} animated={false} />

      <View style={styles.center}>
        <View style={styles.card}>
          <Animated.View style={{ opacity: pulse }}>
            <Svg width={72} height={72} viewBox="0 0 64 64">
              {/* Wi-Fi yayları */}
              <Path d="M 24 38 A 11.3 11.3 0 0 1 40 38" fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
              <Path d="M 18 32 A 19.8 19.8 0 0 1 46 32" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="3.5" strokeLinecap="round" />
              <Path d="M 12 26 A 28.3 28.3 0 0 1 52 26" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="3.5" strokeLinecap="round" />
              <Circle cx="32" cy="46" r="3.5" fill="#FFFFFF" />
              {/* Kırmızı çapraz kesik */}
              <Line x1="15" y1="13" x2="49" y2="53" stroke={colors.accent} strokeWidth="4.5" strokeLinecap="round" />
            </Svg>
          </Animated.View>

          <Text style={styles.title}>İnternet bağlantısı yok</Text>
          <Text style={styles.desc}>
            Bülten, canlı skorlar ve analizler için internet bağlantısı gerekiyor.
            Bağlantınızı kontrol edip tekrar deneyin.
          </Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={onRetry} activeOpacity={0.85}>
            <Text style={styles.primaryText}>Tekrar Dene</Text>
          </TouchableOpacity>

          {onGoHome ? (
            <TouchableOpacity style={styles.secondaryBtn} onPress={onGoHome} activeOpacity={0.85}>
              <Text style={styles.secondaryText}>Ana Sayfaya Dön</Text>
            </TouchableOpacity>
          ) : null}
        </View>
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
    backgroundColor: colors.darkCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    ...shadow.card,
  },
  title: {
    marginTop: spacing.lg,
    fontSize: font.xl,
    fontWeight: font.bold,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  desc: {
    marginTop: spacing.sm,
    fontSize: font.md,
    lineHeight: font.md * 1.5,
    color: colors.muted,
    textAlign: 'center',
  },
  primaryBtn: {
    marginTop: spacing.xxl,
    alignSelf: 'stretch',
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontSize: font.lg,
    fontWeight: font.bold,
    color: '#FFFFFF',
  },
  secondaryBtn: {
    marginTop: spacing.md,
    alignSelf: 'stretch',
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontSize: font.lg,
    fontWeight: font.semibold,
    color: '#FFFFFF',
  },
});
