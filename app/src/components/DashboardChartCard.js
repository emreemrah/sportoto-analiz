import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme';
import { PercentBar } from '../ui';

// Grafik kütüphanesi kullanmadan (mevcut PercentBar/ProgressBar ile) basit
// çubuklu dashboard kartı. rows: [{ label, value, color }]
export default function DashboardChartCard({ title, rows, emptyText }) {
  return (
    <View style={styles.card}>
      {!!title && <Text style={styles.title}>{title}</Text>}
      {rows && rows.length ? (
        rows.map((r) => <PercentBar key={r.label} label={r.label} value={r.value} color={r.color} />)
      ) : (
        <Text style={styles.empty}>{emptyText || 'Henüz veri yok.'}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  title: { color: colors.text, fontSize: 14, fontWeight: '800', marginBottom: 8 },
  empty: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic', paddingVertical: 8 },
});
