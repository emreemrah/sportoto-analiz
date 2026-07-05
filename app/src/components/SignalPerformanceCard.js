// app/src/components/SignalPerformanceCard.js
// Tek bir istatistik sinyalinin başarı kartı: ad · başarı oranı ·
// sinyal yüksekken/düşükken sistemin başarısı.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme';

const toneColor = (r) => (r >= 65 ? colors.green : r >= 50 ? colors.yellow : colors.red);

function MiniBar({ label, value, total }) {
  return (
    <View style={s.mini}>
      <Text style={s.miniLabel}>{label} ({total})</Text>
      <View style={s.miniTrack}>
        <View style={[s.miniFill, { width: `${value}%`, backgroundColor: toneColor(value) }]} />
      </View>
      <Text style={s.miniVal}>%{value}</Text>
    </View>
  );
}

export default function SignalPerformanceCard({ signal }) {
  if (!signal) return null;
  const c = toneColor(signal.rate);
  return (
    <View style={s.card}>
      <View style={s.top}>
        <Text style={s.title} numberOfLines={1}>{signal.title}</Text>
        <Text style={[s.rate, { color: c }]}>%{signal.rate}</Text>
      </View>
      <Text style={s.meta}>{signal.total} maçta kullanıldı · {signal.correct} doğru · {signal.misleading} yanıltıcı</Text>
      {signal.whenHigh.total > 0 && <MiniBar label="Sinyal yüksekken" value={signal.whenHigh.rate} total={signal.whenHigh.total} />}
      {signal.whenLow.total > 0 && <MiniBar label="Sinyal düşükken" value={signal.whenLow.rate} total={signal.whenLow.total} />}
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
  meta: { color: colors.textMuted, fontSize: 11.5, fontWeight: '700', marginTop: 5 },
  mini: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  miniLabel: { color: colors.textMuted, fontSize: 10.5, fontWeight: '700', width: 118 },
  miniTrack: { flex: 1, height: 6, backgroundColor: colors.bgAlt, borderRadius: 3, overflow: 'hidden' },
  miniFill: { height: 6, borderRadius: 3 },
  miniVal: { color: colors.text, fontSize: 11, fontWeight: '900', width: 34, textAlign: 'right' },
});
