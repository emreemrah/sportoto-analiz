// SİSTEM ANALİZ KARNESİ — GERÇEK veri. Sistemin maç-öncesi 1/X/2 tahminleri,
// RESMİ Spor Toto sonuçlarıyla karşılaştırılır. Canlı/geçici skor SAYILMAZ.
// Görünüm: Sade / Detaylı / Teknik · Filtre: Tüm / Son 5 / Son 10 hafta.
import React, { useState, useCallback, useMemo } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { colors, spacing, radius, shadow } from '../theme';
import { getPref, setPref } from '../prefs';
import { matchDate } from '../utils';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { DashboardHero, DashboardMetric, DashboardSection, ViewModeToggle, FilterBar, MetricBar, DashboardEmpty } from '../components/DashboardUI';

const rate = (c, t) => (t ? Math.round((c / t) * 100) : 0);
const rateColor = (r) => (r >= 60 ? colors.success : r >= 45 ? colors.warning : colors.danger);

function aggregate(weeks) {
  let total = 0, correct = 0, wrong = 0, single = 0, singleCorrect = 0;
  const br = { '1': { t: 0, c: 0 }, X: { t: 0, c: 0 }, '2': { t: 0, c: 0 } };
  for (const w of weeks) {
    total += w.total; correct += w.correct; wrong += w.wrong; single += w.single || 0; singleCorrect += w.singleCorrect || 0;
    for (const k of ['1', 'X', '2']) { br[k].t += w.byResult?.[k]?.t || 0; br[k].c += w.byResult?.[k]?.c || 0; }
  }
  return {
    total, correct, wrong, accuracy: rate(correct, total),
    single, singleCorrect, singleAccuracy: rate(singleCorrect, single),
    byResult: { '1': { ...br['1'], rate: rate(br['1'].c, br['1'].t) }, X: { ...br.X, rate: rate(br.X.c, br.X.t) }, '2': { ...br['2'], rate: rate(br['2'].c, br['2'].t) } },
  };
}

const RANGES = [{ key: 'all', label: 'Tüm Haftalar' }, { key: 'last5', label: 'Son 5 Hafta' }, { key: 'last10', label: 'Son 10 Hafta' }];

export default function SystemScorecardScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(getPref('sysDashView'));
  const [range, setRange] = useState(getPref('sysDashRange'));

  const load = useCallback(async () => {
    try { setError(null); setData(await api.systemScorecard()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    if (!data?.weeks) return null;
    const n = range === 'last5' ? 5 : range === 'last10' ? 10 : data.weeks.length;
    const weeks = data.weeks.slice(0, n);
    const ids = new Set(weeks.map((w) => w.roundId));
    const agg = aggregate(weeks);
    const errors = (data.errors || []).filter((e) => ids.has(e.roundId));
    return { weeks, agg, errors };
  }, [data, range]);

  if (loading && !data) return <LoadingState message="Sistem karnesi hesaplanıyor…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data || !data.hasData) {
    return (
      <View style={styles.container}>
        <DashboardEmpty
          icon="📊"
          title="Karne için resmi sonuç bekleniyor"
          message="Henüz resmi olarak sonuçlanmış maç yok. Resmi Spor Toto sonuçları geldikçe sistemin doğru/yanlış analiz karnesi burada oluşacak."
          actionLabel="Bültenleri Gör"
          onAction={() => navigation.navigate('BulletinTab')}
        />
      </View>
    );
  }

  const detailed = view !== 'simple';
  const technical = view === 'technical';
  const a = filtered.agg;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.pad}>
      <DashboardHero
        kicker="Analiz Merkezi"
        title="Sistem Analiz Karnesi"
        subtitle={`${filtered.weeks.length} hafta · ${a.total} resmi sonuçlanan maç üzerinden`}
        metrics={[
          { value: a.correct, label: 'Doğru', tone: 'success' },
          { value: a.wrong, label: 'Yanlış', tone: 'danger' },
          { value: `%${a.accuracy}`, label: 'İsabet' },
        ]}
      />

      <View style={styles.controls}>
        <ViewModeToggle value={view} onChange={(v) => { setView(v); setPref('sysDashView', v); }} />
      </View>
      <FilterBar options={RANGES} value={range} onChange={(r) => { setRange(r); setPref('sysDashRange', r); }} />

      {/* Genel isabet */}
      <View style={styles.card}>
        <MetricBar label="Genel isabet" value={a.accuracy} suffix="%" />
        <Text style={styles.note}>
          Net (tek) tahmin isabeti: <Text style={styles.noteStrong}>%{a.singleAccuracy}</Text> ({a.singleCorrect}/{a.single}) · çift/üçlü tahminler daha güvenli sayılır.
        </Text>
      </View>

      {detailed && (
        <>
          <DashboardSection title="1 / X / 2 İsabeti" />
          <View style={styles.card}>
            <MetricBar label="1 · Ev sahibi" value={a.byResult['1'].rate} total={a.byResult['1'].t} color={colors.primary} />
            <MetricBar label="X · Beraberlik" value={a.byResult.X.rate} total={a.byResult.X.t} color={colors.gray} />
            <MetricBar label="2 · Deplasman" value={a.byResult['2'].rate} total={a.byResult['2'].t} color={colors.warning} />
          </View>

          <DashboardSection title="Hafta Hafta" />
          <View style={styles.card}>
            {filtered.weeks.map((w, i) => (
              <View key={w.roundId} style={[styles.weekRow, i === filtered.weeks.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={styles.weekName} numberOfLines={1}>{w.round}</Text>
                <Text style={styles.weekRec}>
                  <Text style={{ color: colors.success, fontWeight: '900' }}>{w.correct}✓</Text>
                  <Text style={styles.weekSep}> · </Text>
                  <Text style={{ color: colors.danger, fontWeight: '900' }}>{w.wrong}✗</Text>
                </Text>
                <View style={styles.weekBarTrack}><View style={[styles.weekBarFill, { width: `${w.accuracy}%`, backgroundColor: rateColor(w.accuracy) }]} /></View>
                <Text style={[styles.weekPct, { color: rateColor(w.accuracy) }]}>%{w.accuracy}</Text>
              </View>
            ))}
          </View>

          <DashboardSection title="Sistemin Hataları" count={filtered.errors.length} danger sub="Sistemin yanlış bildiği maçlar — hiçbir şey saklanmaz." />
          {filtered.errors.length === 0 ? (
            <View style={styles.card}><Text style={styles.noErr}>Bu aralıkta hatalı tahmin yok.</Text></View>
          ) : filtered.errors.map((e, i) => (
            <View key={i} style={styles.errRow}>
              <View style={styles.errMain}>
                <Text style={styles.errMatch} numberOfLines={1}>{e.home} - {e.away}</Text>
                <Text style={styles.errMeta}>{e.round} · #{e.no}</Text>
              </View>
              <View style={styles.errRight}>
                <Text style={styles.errLine}>Sistem <Text style={styles.errSys}>{e.system}</Text></Text>
                <Text style={styles.errLine}>Sonuç <Text style={styles.errRes}>{e.result}</Text> <Text style={styles.errScore}>{e.score}</Text></Text>
              </View>
            </View>
          ))}
        </>
      )}

      {technical && (
        <>
          <DashboardSection title="Teknik" />
          <View style={styles.card}>
            <TechRow k="Kaynak" v={data.source || 'Resmi Spor Toto'} />
            <TechRow k="Örneklem" v={`${a.total} resmi maç · ${filtered.weeks.length} hafta`} />
            <TechRow k="Hesaplama zamanı" v={data.generatedAt ? `${matchDate(data.generatedAt).day} ${matchDate(data.generatedAt).time}` : '—'} />
            <TechRow k="Aralık" v={RANGES.find((r) => r.key === range)?.label} />
            <TechRow k="Haftalar (roundId)" v={filtered.weeks.map((w) => w.roundId).join(', ') || '—'} last />
          </View>
          <Text style={styles.techNote}>Yalnız RESMİ Spor Toto sonucu gelen maçlar sayılır. Canlı/geçici skor karneye yazılmaz; resmi sonuç düzeltilirse karne yeniden hesaplanır.</Text>
        </>
      )}
    </ScrollView>
  );
}

function TechRow({ k, v, last }) {
  return (
    <View style={[styles.techRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.techK}>{k}</Text>
      <Text style={styles.techV} numberOfLines={2}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  controls: { marginTop: spacing.lg, marginBottom: spacing.sm, alignSelf: 'flex-start' },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.sm, ...shadow.soft },
  note: { color: colors.textMuted, fontSize: 11, fontWeight: '600', marginTop: 4, lineHeight: 15 },
  noteStrong: { color: colors.text, fontWeight: '900' },

  weekRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  weekName: { width: 72, color: colors.text, fontSize: 12.5, fontWeight: '800' },
  weekRec: { width: 66, fontSize: 12 },
  weekSep: { color: colors.border },
  weekBarTrack: { flex: 1, height: 7, borderRadius: 4, backgroundColor: colors.bgAlt, overflow: 'hidden' },
  weekBarFill: { height: 7, borderRadius: 4 },
  weekPct: { width: 42, textAlign: 'right', fontSize: 12.5, fontWeight: '900' },

  noErr: { color: colors.success, fontSize: 13, fontWeight: '700' },
  errRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3, borderLeftColor: colors.danger, padding: spacing.md, marginTop: spacing.sm, gap: 8, ...shadow.soft },
  errMain: { flex: 1, minWidth: 0 },
  errMatch: { color: colors.text, fontSize: 13.5, fontWeight: '800' },
  errMeta: { color: colors.textMuted, fontSize: 10.5, fontWeight: '700', marginTop: 2 },
  errRight: { alignItems: 'flex-end' },
  errLine: { color: colors.textSoft, fontSize: 12, fontWeight: '700' },
  errSys: { color: colors.danger, fontWeight: '900' },
  errRes: { color: colors.success, fontWeight: '900' },
  errScore: { color: colors.textMuted, fontWeight: '700' },

  techRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  techK: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  techV: { flex: 1, color: colors.text, fontSize: 12, fontWeight: '800', textAlign: 'right' },
  techNote: { color: colors.textMuted, fontSize: 10.5, fontWeight: '600', marginTop: 10, lineHeight: 15 },
});
