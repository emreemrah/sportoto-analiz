import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme';

// Kupon Sonuç ekranı / "Sonuçlar" sekmesinde: kullanıcı seçimi vs sistem
// önerisi vs gerçek sonuç, doğru/yanlış rengiyle.
export default function ResultComparisonCard({ orderNo, homeTeam, awayTeam, userPick, systemPick, actualResult, isCorrect }) {
  const pending = actualResult == null;
  return (
    <View style={[styles.row, !pending && (isCorrect ? styles.rowOk : styles.rowBad)]}>
      <Text style={styles.no}>{orderNo}</Text>
      <Text style={styles.teams} numberOfLines={1}>{homeTeam} - {awayTeam}</Text>
      <View style={styles.cols}>
        <Col label="Sen" value={userPick} />
        <Col label="Sistem" value={systemPick} />
        <Col label="Sonuç" value={pending ? '–' : actualResult} highlight={!pending} />
      </View>
      <Text style={styles.status}>{pending ? '⏳' : isCorrect ? '✓' : '✗'}</Text>
    </View>
  );
}

function Col({ label, value, highlight }) {
  return (
    <View style={styles.col}>
      <Text style={styles.colLabel}>{label}</Text>
      <Text style={[styles.colValue, highlight && styles.colValueOn]}>{value ?? '–'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm, borderLeftWidth: 4, borderLeftColor: colors.border },
  rowOk: { borderLeftColor: colors.green },
  rowBad: { borderLeftColor: colors.red },
  no: { width: 18, textAlign: 'center', color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  teams: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '700' },
  cols: { flexDirection: 'row', gap: 10 },
  col: { alignItems: 'center', width: 38 },
  colLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '700' },
  colValue: { color: colors.textMuted, fontSize: 13, fontWeight: '800', marginTop: 1 },
  colValueOn: { color: colors.text, fontWeight: '900' },
  status: { width: 20, textAlign: 'center', fontSize: 15 },
});
