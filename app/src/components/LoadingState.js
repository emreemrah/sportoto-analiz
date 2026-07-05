// src/components/LoadingState.js
// MEVCUT DOSYANIN YERİNE — AYNI API. Ekran içine gömülür (tam ekran değil).

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BallLoader from './BallLoader';
import { colors, spacing, font } from '../theme';

export default function LoadingState({ message = 'Yükleniyor…' }) {
  return (
    <View style={styles.wrap}>
      <BallLoader size={44} color={colors.primary} />
      <Text style={styles.message}>{message}</Text>
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
  message: {
    marginTop: spacing.lg,
    fontSize: font.md,
    color: colors.textSoft,
    textAlign: 'center',
  },
});
