// app/src/components/ErrorBreakdownCard.js
// Hata haritası: en sık hata etiketleri (dağılım) + örnek hatalar.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme';

export default function ErrorBreakdownCard({ breakdown = [], samples = [] }) {
  const max = breakdown.reduce((m, x) => Math.max(m, x.count), 0) || 1;
  return (
    <View style={s.card}>
      <Text style={s.title}>Hata Haritası</Text>

      {breakdown.length === 0 ? (
        <Text style={s.empty}>Henüz hata etiketi yok.</Text>
      ) : (
        breakdown.slice(0, 8).map((e) => (
          <View key={e.tag} style={s.row}>
            <Text style={s.label} numberOfLines={1}>{e.label}</Text>
            <View style={s.track}>
              <View style={[s.fill, { width: `${Math.round((e.count / max) * 100)}%` }]} />
            </View>
            <Text style={s.count}>{e.count}</Text>
          </View>
        ))
      )}

      {samples.length > 0 && (
        <>
          <Text style={s.subTitle}>Örnek Hatalar</Text>
          {samples.map((x, i) => (
            <View key={i} style={s.sample}>
              <Text style={s.sampleTop}>{x.section} · {x.league}</Text>
              <Text style={s.sampleBody}>
                Sistem: <Text style={{ color: colors.text, fontWeight: '900' }}>{x.systemSaid}</Text>
                {'  →  '}Sonuç: <Text style={{ color: colors.red, fontWeight: '900' }}>{x.actual}</Text>
              </Text>
              <Text style={s.sampleTag}>{x.errorLabel}</Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm,
  },
  title: { color: colors.text, fontSize: 15, fontWeight: '900', marginBottom: 8 },
  empty: { color: colors.textMuted, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 7, gap: 8 },
  label: { color: colors.textMuted, fontSize: 11.5, fontWeight: '700', width: 130 },
  track: { flex: 1, height: 7, backgroundColor: colors.bgAlt, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 7, borderRadius: 4, backgroundColor: colors.red },
  count: { color: colors.text, fontSize: 11.5, fontWeight: '900', width: 22, textAlign: 'right' },
  subTitle: { color: colors.text, fontSize: 13, fontWeight: '900', marginTop: 12, marginBottom: 6 },
  sample: { backgroundColor: colors.bgAlt, borderRadius: radius.md, padding: 10, marginBottom: 6 },
  sampleTop: { color: colors.textMuted, fontSize: 10.5, fontWeight: '800' },
  sampleBody: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginTop: 3 },
  sampleTag: { color: colors.red, fontSize: 10.5, fontWeight: '800', marginTop: 3 },
});
