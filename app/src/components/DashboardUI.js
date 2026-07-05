// Dashboard tasarım kiti — futbol analiz paneli hissi. Koyu "hero" panel + açık
// metrik kartları + bölümler + görünüm modu + filtre çubuğu + boş durum + barlar.
// Tüm renkler temadan; hem Kullanıcı Paneli hem Sistem Karnesi bunu kullanır.
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius, shadow } from '../theme';

const toneColor = { primary: colors.primary, success: colors.success, warning: colors.warning, danger: colors.danger, info: colors.info, neutral: colors.textSoft };

// ——— Koyu hero panel: başlık + alt metin + öne çıkan metrikler ———
export function DashboardHero({ title, subtitle, kicker, metrics = [], right }) {
  return (
    <View style={s.hero}>
      <View style={s.heroTopRow}>
        <View style={{ flex: 1 }}>
          {kicker ? <Text style={s.heroKicker}>{kicker}</Text> : null}
          <Text style={s.heroTitle}>{title}</Text>
          {subtitle ? <Text style={s.heroSub}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {metrics.length > 0 && (
        <View style={s.heroMetrics}>
          {metrics.map((m, i) => (
            <View key={i} style={[s.heroMetric, i > 0 && s.heroMetricBorder]}>
              <Text style={[s.heroVal, m.tone && { color: toneColor[m.tone] || m.tone }]}>{m.value}</Text>
              <Text style={s.heroLabel} numberOfLines={1}>{m.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ——— Açık metrik kartı: değer + etiket + küçük açıklama ———
export function DashboardMetric({ value, label, hint, tone = 'primary', icon, style }) {
  const c = toneColor[tone] || tone;
  return (
    <View style={[s.metric, style]}>
      <View style={s.metricTop}>
        {icon ? <View style={[s.metricIcon, { backgroundColor: c + '18' }]}><Text style={[s.metricIconTxt, { color: c }]}>{icon}</Text></View> : null}
        <Text style={[s.metricVal, { color: c }]} numberOfLines={1}>{value}</Text>
      </View>
      <Text style={s.metricLabel} numberOfLines={1}>{label}</Text>
      {hint ? <Text style={s.metricHint} numberOfLines={2}>{hint}</Text> : null}
    </View>
  );
}

// ——— Bölüm başlığı ———
export function DashboardSection({ title, count, sub, right, danger }) {
  return (
    <View style={s.section}>
      <View style={s.sectionRow}>
        <Text style={s.sectionTitle}>{title}{count != null ? <Text style={[s.sectionCount, danger && { color: colors.danger }]}>  {count}</Text> : null}</Text>
        {right}
      </View>
      {sub ? <Text style={s.sectionSub}>{sub}</Text> : null}
    </View>
  );
}

// ——— Görünüm modu: Sade / Detaylı / Teknik ———
const VIEW_MODES = [{ k: 'simple', l: 'Sade' }, { k: 'detailed', l: 'Detaylı' }, { k: 'technical', l: 'Teknik' }];
export function ViewModeToggle({ value, onChange }) {
  return (
    <View style={s.segWrap}>
      {VIEW_MODES.map((m) => {
        const on = value === m.k;
        return (
          <TouchableOpacity key={m.k} onPress={() => onChange(m.k)} style={[s.seg, on && s.segOn]} activeOpacity={0.8}>
            <Text style={[s.segTxt, on && s.segTxtOn]}>{m.l}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ——— Yatay filtre çubuğu ———
export function FilterBar({ options = [], value, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
      {options.map((o) => {
        const on = value === o.key;
        return (
          <TouchableOpacity key={o.key} onPress={() => onChange(o.key)} style={[s.chip, on && s.chipOn]} activeOpacity={0.8}>
            <Text style={[s.chipTxt, on && s.chipTxtOn]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ——— Etiketli oran barı ———
export function MetricBar({ label, value, total, color, suffix = '%' }) {
  const c = color || (value >= 60 ? colors.success : value >= 45 ? colors.warning : colors.danger);
  return (
    <View style={s.bar}>
      <View style={s.barTop}>
        <Text style={s.barLabel} numberOfLines={1}>{label}{total != null ? <Text style={s.barTotal}>  ({total})</Text> : null}</Text>
        <Text style={[s.barPct, { color: c }]}>{value}{suffix}</Text>
      </View>
      <View style={s.barTrack}><View style={[s.barFill, { width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: c }]} /></View>
    </View>
  );
}

// ——— Profesyonel boş durum ———
export function DashboardEmpty({ icon = '📊', title, message, actionLabel, onAction }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyIcon}>{icon}</Text>
      <Text style={s.emptyTitle}>{title}</Text>
      {message ? <Text style={s.emptyMsg}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} style={s.emptyBtn} activeOpacity={0.85}><Text style={s.emptyBtnTxt}>{actionLabel}</Text></TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: spacing.lg, ...shadow.card },
  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  heroKicker: { color: '#8FA6C9', fontSize: 10.5, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  heroTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '900', marginTop: 3 },
  heroSub: { color: '#B7C4DA', fontSize: 12, fontWeight: '600', marginTop: 4, lineHeight: 16 },
  heroMetrics: { flexDirection: 'row', marginTop: spacing.lg, backgroundColor: colors.darkCardSoft, borderRadius: radius.md, paddingVertical: 12 },
  heroMetric: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
  heroMetricBorder: { borderLeftWidth: 1, borderLeftColor: '#2A3A57' },
  heroVal: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  heroLabel: { color: '#9DB0CD', fontSize: 10, fontWeight: '700', marginTop: 3, textAlign: 'center' },

  metric: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 13, ...shadow.soft },
  metricTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metricIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  metricIconTxt: { fontSize: 13, fontWeight: '900' },
  metricVal: { fontSize: 22, fontWeight: '900', flexShrink: 1 },
  metricLabel: { color: colors.textSoft, fontSize: 12, fontWeight: '800', marginTop: 8 },
  metricHint: { color: colors.textMuted, fontSize: 10.5, fontWeight: '600', marginTop: 3, lineHeight: 14 },

  section: { marginTop: spacing.xl, marginBottom: spacing.sm },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  sectionCount: { color: colors.textMuted, fontSize: 15, fontWeight: '900' },
  sectionSub: { color: colors.textMuted, fontSize: 11.5, fontWeight: '600', marginTop: 3 },

  segWrap: { flexDirection: 'row', backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: 3, gap: 2 },
  seg: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.sm },
  segOn: { backgroundColor: colors.card, ...shadow.soft },
  segTxt: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  segTxtOn: { color: colors.primary },

  filterRow: { gap: 7, paddingVertical: 2 },
  chip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { color: colors.textSoft, fontSize: 12, fontWeight: '800' },
  chipTxtOn: { color: '#FFFFFF' },

  bar: { marginBottom: 11 },
  barTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  barLabel: { flex: 1, color: colors.textSoft, fontSize: 12, fontWeight: '700' },
  barTotal: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  barPct: { fontSize: 13, fontWeight: '900', marginLeft: 8 },
  barTrack: { height: 8, borderRadius: 5, backgroundColor: colors.bgAlt, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 5 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, minHeight: 320 },
  emptyIcon: { fontSize: 46 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 12, textAlign: 'center' },
  emptyMsg: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginTop: 8, textAlign: 'center', lineHeight: 19, maxWidth: 320 },
  emptyBtn: { marginTop: 18, backgroundColor: colors.primary, paddingHorizontal: 22, paddingVertical: 12, borderRadius: radius.md },
  emptyBtnTxt: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '800' },
});
