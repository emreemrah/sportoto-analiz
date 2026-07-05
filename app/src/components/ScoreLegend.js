// Skor renk açıklaması: yeşil = resmi sonuç · sarı = henüz resmi değil · kırmızı = canlı.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';

const ITEMS = [
  { c: colors.success, l: 'Resmi sonuç' },
  { c: colors.warning, l: 'Henüz resmi değil' },
  { c: colors.accent, l: 'Canlı' },
];

export default function ScoreLegend() {
  return (
    <View style={s.row}>
      {ITEMS.map((it) => (
        <View key={it.l} style={s.item}>
          <View style={[s.dot, { backgroundColor: it.c }]} />
          <Text style={s.txt}>{it.l}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  txt: { color: colors.textMuted, fontSize: 10.5, fontWeight: '700' },
});
