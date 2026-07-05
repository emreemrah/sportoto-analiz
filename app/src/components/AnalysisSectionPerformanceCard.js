// app/src/components/AnalysisSectionPerformanceCard.js
// Tek bir analiz bölümünün başarı kartı: ad · başarı oranı · doğru/yanlış ·
// en çok hata etiketi · etki puanı.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme';

const toneColor = (r) => (r >= 65 ? colors.green : r >= 50 ? colors.yellow : colors.red);

export default function AnalysisSectionPerformanceCard({ section }) {
  if (!section) return null;
  const c = toneColor(section.rate);
  return (
    <View style={s.card}>
      <View style={s.top}>
        <Text style={s.title} numberOfLines={1}>{section.title}</Text>
        <Text style={[s.rate, { color: c }]}>%{section.rate}</Text>
      </View>

      <View style={s.track}>
        <View style={[s.fill, { width: `${section.rate}%`, backgroundColor: c }]} />
      </View>

      <View style={s.metaRow}>
        <Text style={s.meta}>{section.total} maç · <Text style={{ color: colors.green }}>{section.correct} doğru</Text> · <Text style={{ color: colors.red }}>{section.misleading} yanıltıcı</Text></Text>
        <Text style={s.impact}>Etki {section.avgImpact}</Text>
      </View>

      {section.topError ? (
        <Text style={s.err}>En çok: {section.topError.label} ({section.topError.count})</Text>
      ) : (
        <Text style={s.ok}>Belirgin hata yok</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '900' },
  rate: { fontSize: 17, fontWeight: '900', marginLeft: 8 },
  track: { height: 7, backgroundColor: colors.bgAlt, borderRadius: 4, overflow: 'hidden', marginTop: 8 },
  fill: { height: 7, borderRadius: 4 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 7 },
  meta: { color: colors.textMuted, fontSize: 11.5, fontWeight: '700' },
  impact: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  err: { color: colors.red, fontSize: 11, fontWeight: '700', marginTop: 5 },
  ok: { color: colors.green, fontSize: 11, fontWeight: '700', marginTop: 5 },
});
