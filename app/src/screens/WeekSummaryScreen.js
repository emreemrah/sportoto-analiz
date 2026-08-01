// HAFTANIN ÖZETİ — yayın açılış segmenti: güçlü adaylar + sürpriz adayları +
// zorluk, tek gösterişli koyu ekranda. Yayıncı yayına bu ekranla girer.
//
//   • Tüm veriler bültendeki GERÇEK analizden gelir (weekSummary.js — saf, testli).
//   • Güçlü aday yoksa dürüstçe "yok" denir; liste zorla doldurulmaz.
//   • İddialı dil yok; etiketler displayLabel sözlüğünden geçer.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { api } from '../api';
import { colors, spacing, radius } from '../theme';
import { BRAND_LINE_1, BRAND_LINE_2, NO_GUARANTEE_NOTICE } from '../brand';
import { buildWeekSummary, matchLine } from '../weekSummary';
import { displayLabel } from '../labels';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

const NAVY = '#0f2038';
const NAVY_SOFT = '#132844';
const LINE = '#1c3a5e';
const INK_SOFT = '#9DB0CD';
const AMBER = '#ffb35c';

export default function WeekSummaryScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try { setError(null); setData(await api.bulletin()); }
    catch (e) { setError(e.message || 'Bülten alınamadı.'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <LoadingState message="Haftanın özeti hazırlanıyor…" />;

  const sum = buildWeekSummary(data.matches || []);
  const diff = data.difficulty || null;
  const weekTxt = [data.season ? `${data.season} Sezonu` : null, data.weekNumber ? `${data.weekNumber}. Hafta` : null]
    .filter(Boolean).join(' · ');
  const diffColor = diff ? (diff.score < 30 ? '#5dd39e' : diff.score < 50 ? AMBER : '#ff7a6e') : INK_SOFT;

  const goMatch = (no) => navigation.navigate('MatchDetail', { no });

  return (
    <ScrollView style={st.container} contentContainerStyle={st.body}>
      <View style={st.card}>
        {/* Marka + hafta */}
        <Text style={st.brand}>
          {BRAND_LINE_1} <Text style={{ color: AMBER }}>{BRAND_LINE_2}</Text>
        </Text>
        <Text style={st.kicker}>HAFTANIN ÖZETİ</Text>
        {weekTxt ? <Text style={st.week}>{weekTxt}</Text> : null}

        {/* Zorluk */}
        {diff ? (
          <View style={st.diffBox}>
            <View style={st.diffHead}>
              <Text style={st.diffLabel}>Bülten zorluğu</Text>
              <Text style={[st.diffVal, { color: diffColor }]}>{diff.level} · {diff.score}/100</Text>
            </View>
            <View style={st.diffTrack}>
              <View style={[st.diffFill, { width: `${Math.min(100, diff.score)}%`, backgroundColor: diffColor }]} />
            </View>
            {diff.text ? <Text style={st.diffTxt}>{diff.text}</Text> : null}
          </View>
        ) : null}

        {/* Sayı şeridi */}
        <View style={st.statRow}>
          <View style={st.statBox}><Text style={st.statN}>{sum.total}</Text><Text style={st.statL}>Maç</Text></View>
          <View style={st.statBox}><Text style={[st.statN, { color: '#5dd39e' }]}>{sum.strong.length}</Text><Text style={st.statL}>Güçlü Aday</Text></View>
          <View style={st.statBox}><Text style={[st.statN, { color: '#ff7a6e' }]}>{sum.surprises.length}</Text><Text style={st.statL}>Sürpriz Adayı</Text></View>
          <View style={st.statBox}><Text style={[st.statN, { color: AMBER }]}>{sum.balanced}</Text><Text style={st.statL}>Denk Güç</Text></View>
        </View>

        {/* Güçlü adaylar */}
        <Text style={st.secTitle}>🟢 GÜÇLÜ ADAYLAR</Text>
        {sum.strong.length ? sum.strong.map((m) => (
          <TouchableOpacity key={m.no} style={st.mRow} onPress={() => goMatch(m.no)} activeOpacity={0.85}>
            <Text style={st.mNo}>{m.no}</Text>
            <View style={{ flex: 1 }}>
              <Text style={st.mTeams} numberOfLines={1}>{matchLine(m)}</Text>
              <Text style={st.mSub}>{displayLabel(m.analysis.label)} · Sürpriz {m.analysis.surpriseScore ?? '—'}</Text>
            </View>
            <View style={[st.pill, { backgroundColor: '#5dd39e22', borderColor: '#5dd39e' }]}>
              <Text style={[st.pillTxt, { color: '#5dd39e' }]}>{String(m.analysis.favorite.symbol).replace('0', 'X')} · %{m.analysis.favorite.percent}</Text>
            </View>
          </TouchableOpacity>
        )) : (
          <Text style={st.emptyTxt}>Bu hafta güçlü aday çıkmadı — zorla aday üretilmez; temkinli hafta.</Text>
        )}

        {/* Sürpriz adayları */}
        <Text style={st.secTitle}>🔴 SÜRPRİZ ADAYLARI</Text>
        {sum.surprises.length ? sum.surprises.map((m) => (
          <TouchableOpacity key={m.no} style={st.mRow} onPress={() => goMatch(m.no)} activeOpacity={0.85}>
            <Text style={st.mNo}>{m.no}</Text>
            <View style={{ flex: 1 }}>
              <Text style={st.mTeams} numberOfLines={1}>{matchLine(m)}</Text>
              <Text style={st.mSub}>
                {displayLabel(m.analysis.label)}
                {m.analysis.favorite ? ` · Favori ${String(m.analysis.favorite.symbol).replace('0', 'X')} yalnız %${m.analysis.favorite.percent}` : ''}
              </Text>
            </View>
            <View style={[st.pill, { backgroundColor: '#ff7a6e22', borderColor: '#ff7a6e' }]}>
              <Text style={[st.pillTxt, { color: '#ff7a6e' }]}>Sürpriz {m.analysis.surpriseScore}</Text>
            </View>
          </TouchableOpacity>
        )) : (
          <Text style={st.emptyTxt}>Sürprize açık maç işareti yok.</Text>
        )}

        {sum.startedCount > 0 ? (
          <Text style={st.startedNote}>ℹ️ {sum.startedCount} maç başladığı için aday listelerinde gösterilmiyor.</Text>
        ) : null}

        <View style={st.footDivider} />
        <Text style={st.disc}>18+ · {NO_GUARANTEE_NOTICE}</Text>
      </View>

      <TouchableOpacity style={st.cta} onPress={() => navigation.navigate('MatchDetail', { no: (sum.strong[0] || sum.surprises[0] || { no: 1 }).no })}>
        <Text style={st.ctaTxt}>İlk Maçın Analizine Git ›</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.md, alignItems: 'center', paddingBottom: spacing.xl },
  card: { width: '100%', maxWidth: 560, backgroundColor: NAVY, borderRadius: 22, borderWidth: 1, borderColor: LINE, padding: spacing.lg },
  brand: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  kicker: { color: AMBER, fontSize: 12, fontWeight: '900', letterSpacing: 2.5, marginTop: 2 },
  week: { color: INK_SOFT, fontSize: 12.5, fontWeight: '800', marginTop: 4 },
  diffBox: { backgroundColor: NAVY_SOFT, borderRadius: radius.md, borderWidth: 1, borderColor: LINE, padding: spacing.md, marginTop: spacing.md },
  diffHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  diffLabel: { color: INK_SOFT, fontSize: 12, fontWeight: '800' },
  diffVal: { fontSize: 13.5, fontWeight: '900' },
  diffTrack: { height: 7, backgroundColor: LINE, borderRadius: 4, overflow: 'hidden', marginTop: 8 },
  diffFill: { height: 7, borderRadius: 4 },
  diffTxt: { color: INK_SOFT, fontSize: 11.5, marginTop: 7, lineHeight: 16 },
  statRow: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  statBox: { flex: 1, backgroundColor: NAVY_SOFT, borderRadius: radius.md, borderWidth: 1, borderColor: LINE, alignItems: 'center', paddingVertical: 10 },
  statN: { color: '#fff', fontSize: 20, fontWeight: '900' },
  statL: { color: INK_SOFT, fontSize: 10, fontWeight: '800', marginTop: 2 },
  secTitle: { color: '#fff', fontSize: 13.5, fontWeight: '900', letterSpacing: 1.2, marginTop: spacing.lg, marginBottom: 8 },
  mRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: NAVY_SOFT, borderRadius: radius.md, borderWidth: 1, borderColor: LINE, padding: spacing.md, marginBottom: 8 },
  mNo: { color: INK_SOFT, fontSize: 13, fontWeight: '900', width: 22, textAlign: 'center' },
  mTeams: { color: '#fff', fontSize: 14.5, fontWeight: '800' },
  mSub: { color: INK_SOFT, fontSize: 11.5, fontWeight: '700', marginTop: 3 },
  pill: { borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 10, paddingVertical: 6 },
  pillTxt: { fontSize: 12.5, fontWeight: '900' },
  emptyTxt: { color: INK_SOFT, fontSize: 12.5, fontStyle: 'italic', lineHeight: 18 },
  startedNote: { color: INK_SOFT, fontSize: 11.5, marginTop: spacing.md, fontStyle: 'italic' },
  footDivider: { height: 1, backgroundColor: LINE, marginVertical: spacing.md },
  disc: { color: '#8fa3bd', fontSize: 10.5, fontStyle: 'italic', lineHeight: 15 },
  cta: { marginTop: spacing.md, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 13, paddingHorizontal: 36 },
  ctaTxt: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
