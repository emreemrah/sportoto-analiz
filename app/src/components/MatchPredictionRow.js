import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme';
import { PredictionBadge } from '../components';
import { matchDate } from '../utils';

// "Maçlar" / "Kilitli Analiz" sekmelerinde kullanılan satır: sistem önerisi,
// güven skoru, sürpriz riski, kısa analiz yorumu ve eksik oyuncular.
export default function MatchPredictionRow({ match, analysis }) {
  const d = matchDate(match.startTime);
  return (
    <View style={styles.row}>
      <View style={styles.top}>
        <Text style={styles.no}>{match.orderNo}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.teams} numberOfLines={1}>{match.homeTeam.name} - {match.awayTeam.name}</Text>
          <Text style={styles.meta} numberOfLines={1}>{match.league} · {d.day} {d.time}</Text>
        </View>
        <PredictionBadge symbol={analysis?.prediction} small />
      </View>
      {analysis && (
        <>
          <View style={styles.scoreRow}>
            {/* Veri yoksa sahte yüzde basılmaz — "—" gösterilir. */}
            <Metric label="Güven" value={analysis.confidenceScore != null ? `%${analysis.confidenceScore}` : '—'} color={colors.green} />
            <Metric label="Sürpriz" value={analysis.surpriseRisk != null ? `%${analysis.surpriseRisk}` : '—'} color={colors.orange} />
            {analysis.dataConfidence ? <Metric label="Veri" value={analysis.dataConfidence} color={colors.textMuted} /> : null}
          </View>
          {!!analysis.analysisComment && <Text style={styles.comment} numberOfLines={3}>{analysis.analysisComment}</Text>}
          {!!analysis.missingPlayers?.length && (
            <Text style={styles.missing}>⚠ {analysis.missingPlayers.map((p) => p.name).join(', ')}</Text>
          )}
        </>
      )}
    </View>
  );
}

function Metric({ label, value, color }) {
  return (
    <View style={styles.metricBox}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  no: { width: 20, textAlign: 'center', color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  teams: { color: colors.text, fontSize: 14, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  scoreRow: { flexDirection: 'row', gap: spacing.lg, marginTop: 10 },
  metricBox: {},
  metricLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  metricValue: { fontSize: 13, fontWeight: '900', marginTop: 1 },
  comment: { color: colors.textMuted, fontSize: 11.5, marginTop: 8, lineHeight: 16 },
  missing: { color: colors.orange, fontSize: 11, marginTop: 6, fontWeight: '700' },
});
