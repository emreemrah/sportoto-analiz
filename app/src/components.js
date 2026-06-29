import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, labelColors, radius } from './theme';

// Sürpriz etiketi (BANKO / DİKKAT / SÜRPRİZE AÇIK / VERİ YOK)
export function SurpriseBadge({ label, labelColor, small }) {
  const c = labelColors[labelColor] || colors.gray;
  return (
    <View style={[styles.badge, { backgroundColor: c + '22', borderColor: c }, small && styles.badgeSmall]}>
      <Text style={[styles.badgeText, { color: c }, small && { fontSize: 10 }]}>{label}</Text>
    </View>
  );
}

// Son 5 maç form şeridi: G (yeşil) / B (sarı) / M (kırmızı)
const FORM_COLOR = { G: colors.green, B: colors.yellow, M: colors.red };
export function FormStrip({ form, size = 18 }) {
  if (!form || !form.length) return <Text style={styles.formEmpty}>–</Text>;
  return (
    <View style={styles.formRow}>
      {form.map((r, i) => {
        const c = FORM_COLOR[r] || colors.gray;
        return (
          <View key={i} style={[styles.formCell, { width: size, height: size, backgroundColor: c }]}>
            <Text style={[styles.formLetter, { fontSize: size * 0.58 }]}>{r}</Text>
          </View>
        );
      })}
    </View>
  );
}

// Mini grafik ikonu (detaylı analiz göstergesi) — küçük çubuklar
export function MiniBars({ color }) {
  const c = color || colors.primary;
  const heights = [8, 13, 13, 8];
  return (
    <View style={styles.mbRow}>
      {heights.map((h, i) => (
        <View key={i} style={[styles.mbBar, { height: h, backgroundColor: c }]} />
      ))}
    </View>
  );
}

// 1 / X / 2 tahmin grid'i — tahmindeki hücre(ler) yeşil dolu, altında yüzde.
const PICK_ACTIVE = {
  '1': ['1'], '0': ['X'], '2': ['2'],
  '10': ['1', 'X'], '02': ['X', '2'], '12': ['1', '2'],
  '102': ['1', 'X', '2'],
};
export function PickGrid({ probabilities, symbol, expanded }) {
  const active = PICK_ACTIVE[symbol] || [];
  const cells = [['1', probabilities?.['1']], ['X', probabilities?.['X']], ['2', probabilities?.['2']]];
  return (
    <View style={[styles.pgRow, expanded && styles.pgRowExp]}>
      {cells.map(([k, v]) => {
        const on = active.includes(k);
        return (
          <View key={k} style={[styles.pgWrap, expanded && styles.pgWrapExp]}>
            <View style={[styles.pgCell, on ? styles.pgOn : styles.pgOff]}>
              <Text style={[styles.pgK, on ? styles.pgKOn : styles.pgKOff]}>{k}</Text>
            </View>
            <Text style={styles.pgPct}>{v != null ? `%${v}` : '–'}</Text>
          </View>
        );
      })}
    </View>
  );
}

// Karşılıklı kıyas çubuğu: sol ev (yeşil), sağ deplasman (turuncu), orantılı.
const fmtStat = (v, suffix) => {
  const n = Number(v) || 0;
  if (suffix === '%') return Math.round(n) + '%';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};
export function StatBar({ label, home, away, suffix }) {
  const h = Number(home) || 0;
  const a = Number(away) || 0;
  const total = h + a || 1;
  const hPct = (h / total) * 100;
  const aPct = (a / total) * 100;
  const lead = h === a ? null : h > a ? 'h' : 'a';
  return (
    <View style={styles.sbRow}>
      <Text style={styles.sbLabel}>{label}</Text>
      <View style={styles.sbBars}>
        <Text style={[styles.sbVal, lead === 'h' && styles.sbValOn]}>{fmtStat(home, suffix)}</Text>
        <View style={styles.sbHalf}>
          <View style={[styles.sbFill, { width: `${hPct}%`, alignSelf: 'flex-end', backgroundColor: colors.green }]} />
        </View>
        <View style={styles.sbHalf}>
          <View style={[styles.sbFill, { width: `${aPct}%`, backgroundColor: colors.orange }]} />
        </View>
        <Text style={[styles.sbVal, { textAlign: 'right' }, lead === 'a' && styles.sbValOn]}>{fmtStat(away, suffix)}</Text>
      </View>
    </View>
  );
}

// G/B/M sayı rozetleri: 9G (yeşil) · 1B (sarı) · 0M (kırmızı)
export function RecordBadges({ wins = 0, draws = 0, losses = 0, played, align }) {
  const cell = (n, letter, c) => (
    <View style={[styles.recBadge, { backgroundColor: c + '22', borderColor: c }]}>
      <Text style={[styles.recText, { color: c }]}>{n}{letter}</Text>
    </View>
  );
  return (
    <View style={[styles.recRow, align === 'right' && { justifyContent: 'flex-end' }]}>
      {played != null && <Text style={styles.recPlayed}>⚽ {played}</Text>}
      {cell(wins, 'G', colors.green)}
      {cell(draws, 'B', colors.yellow)}
      {cell(losses, 'M', colors.red)}
    </View>
  );
}

// Kupon tahmini rozeti (1 / 0 / 2 / 10 / 02 / 12 / 102)
// Renk = risk: tek tahmin yeşil, çifte sarı, üçlü kırmızı.
export function PredictionBadge({ symbol, small }) {
  if (!symbol || symbol === '-') {
    return (
      <View style={[styles.predBadge, { borderColor: colors.gray, backgroundColor: colors.gray + '22' }, small && styles.predSmall]}>
        <Text style={[styles.predText, { color: colors.gray }, small && { fontSize: 12 }]}>–</Text>
      </View>
    );
  }
  const c = symbol === '102' ? colors.red : symbol.length === 2 ? colors.yellow : colors.primary;
  return (
    <View style={[styles.predBadge, { borderColor: c, backgroundColor: c + '22' }, small && styles.predSmall]}>
      <Text style={[styles.predText, { color: c }, small && { fontSize: 12 }]}>{symbol}</Text>
    </View>
  );
}

// 1 / X / 2 ihtimal barı
export function ProbBar({ probabilities }) {
  if (!probabilities) {
    return <Text style={styles.noOdds}>Oran yok</Text>;
  }
  const segs = [
    { k: '1', v: probabilities['1'], c: colors.primary },
    { k: 'X', v: probabilities['X'], c: colors.gray },
    { k: '2', v: probabilities['2'], c: colors.yellow },
  ];
  return (
    <View>
      <View style={styles.barRow}>
        {segs.map((s) => (
          <View key={s.k} style={{ flex: Math.max(s.v, 1), backgroundColor: s.c, height: 8 }} />
        ))}
      </View>
      <View style={styles.barLabels}>
        {segs.map((s) => (
          <Text key={s.k} style={[styles.barLabel, { color: s.c }]}>{s.k} %{s.v}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  badgeSmall: { paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: '800' },
  predBadge: { minWidth: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, borderWidth: 1.5 },
  predSmall: { minWidth: 30, paddingHorizontal: 6, paddingVertical: 2 },
  predText: { fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  formRow: { flexDirection: 'row', gap: 2 },
  formCell: { alignItems: 'center', justifyContent: 'center', borderRadius: 3 },
  formLetter: { color: '#fff', fontWeight: '900' },
  formEmpty: { color: colors.textMuted, fontSize: 12 },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  recPlayed: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginRight: 2 },
  recBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  recText: { fontSize: 12, fontWeight: '800' },
  sbRow: { marginVertical: 7 },
  sbLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  sbBars: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sbVal: { width: 40, color: colors.text, fontSize: 13, fontWeight: '700' },
  sbValOn: { color: colors.text, fontWeight: '900' },
  sbHalf: { flex: 1, height: 8, backgroundColor: colors.track, borderRadius: 4, overflow: 'hidden' },
  sbFill: { height: 8, borderRadius: 4 },
  pgRow: { flexDirection: 'row', gap: 4 },
  pgRowExp: { marginTop: 10, gap: 8 },
  pgWrap: { alignItems: 'center', width: 44 },
  pgWrapExp: { flex: 1, width: undefined },
  pgCell: { width: '100%', paddingVertical: 7, borderRadius: 6, borderWidth: 1.5, alignItems: 'center' },
  pgOn: { backgroundColor: colors.green, borderColor: colors.green },
  pgOff: { backgroundColor: 'transparent', borderColor: colors.green + '99' },
  pgK: { fontSize: 14, fontWeight: '900' },
  pgKOn: { color: colors.bg },
  pgKOff: { color: colors.green },
  pgPct: { color: colors.textMuted, fontSize: 10, fontWeight: '700', marginTop: 3 },
  mbRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 2, height: 16 },
  mbBar: { width: 3, borderRadius: 1 },
  noOdds: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic' },
  barRow: { flexDirection: 'row', borderRadius: 4, overflow: 'hidden', gap: 2 },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  barLabel: { fontSize: 11, fontWeight: '700' },
});
