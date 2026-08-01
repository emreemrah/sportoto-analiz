// HAFTA KAPANIŞI — resmî sonuçlar geldikçe SEN vs SİSTEM karnesi yan yana.
//
// DÜRÜSTLÜK
//   • Tüm sayılar YALNIZ resmî Spor Toto sonucundan gelir (mantık: weekRecap.js,
//     testli). Canlı/geçici skor buraya yazılmaz.
//   • Karşılaştırma yalnız ikisinin de tahmin yaptığı maçlarda yapılır.
//   • Kupon yoksa kullanıcı karnesi uydurulmaz; sistemin ıskaları yine gösterilir.
//   • Geçmiş ölçümdür — gelecek başarı vaadi değildir.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { colors, spacing, radius, shadow } from '../theme';
import { getRankedCoupon, finalVersion, syncFromServer } from '../coupon/store';
import { buildWeekRecap, recapHeadline } from '../weekRecap';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

const HL = {
  'user-win': { icon: '🔥', title: 'Sen bildin, sistem bilemedi', color: colors.success },
  'system-win': { icon: '🤖', title: 'Sistem bildi, sen bilemedin', color: colors.info },
  'both-missed': { icon: '💥', title: 'İkiniz de bilemediniz', color: colors.danger },
  'system-missed': { icon: '💥', title: 'Sistem ıskaladı', color: colors.danger },
};

export default function WeekRecapScreen({ route, navigation }) {
  const paramRound = route?.params?.roundId ?? null;
  const [rounds, setRounds] = useState(null);
  const [roundId, setRoundId] = useState(paramRound);
  const [hist, setHist] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  // Hafta listesi — varsayılan: güncelden bir ÖNCEKİ (kapanmış) hafta.
  const boot = useCallback(async () => {
    try {
      setError(null);
      const r = await api.rounds();
      setRounds(r);
      if (paramRound == null) {
        const all = r?.rounds || [];
        const curIdx = all.findIndex((x) => x.id === r?.currentRoundId);
        const nav = curIdx >= 0 ? all.slice(0, curIdx + 1) : all;
        setRoundId(nav.length >= 2 ? nav[nav.length - 2].id : (nav[nav.length - 1]?.id ?? null));
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [paramRound]);

  useFocusEffect(useCallback(() => {
    let alive = true;
    boot();
    setTick((t) => t + 1);
    syncFromServer().then((r) => { if (alive && r?.synced) setTick((t) => t + 1); });
    return () => { alive = false; };
  }, [boot]));

  useEffect(() => {
    if (roundId == null) return;
    let alive = true;
    setHist(null);
    api.history(roundId).then((h) => { if (alive) setHist(h); }).catch(() => { if (alive) setHist(null); });
    return () => { alive = false; };
  }, [roundId]);

  // ——— hafta gezme (yalnız kapanmış/güncel haftalar) ———
  const all = rounds?.rounds || [];
  const curIdx = all.findIndex((r) => r.id === rounds?.currentRoundId);
  const navRounds = curIdx >= 0 ? all.slice(0, curIdx + 1) : all;
  const selIdx = navRounds.findIndex((r) => r.id === roundId);
  const selMeta = navRounds[selIdx] || null;
  const canPrev = selIdx > 0;
  const canNext = selIdx >= 0 && selIdx < navRounds.length - 1;

  const recap = useMemo(() => {
    const ranked = roundId != null ? getRankedCoupon(roundId) : null;
    const v = ranked ? finalVersion(ranked) : null;
    return buildWeekRecap({ matches: hist?.matches || [], selections: v?.selections || [] });
  }, [hist, roundId, tick]);

  if (loading && !rounds) return <LoadingState message="Hafta kapanışı hazırlanıyor…" />;
  if (error) return <ErrorState message={error} onRetry={boot} />;

  const u = recap.user;
  const sys = recap.system;
  const h2h = recap.head2head;
  const winner = h2h?.winner || null;

  return (
    <ScrollView style={st.container} contentContainerStyle={st.pad}>
      {/* HAFTA GEZME */}
      <View style={st.weekNav}>
        <TouchableOpacity onPress={() => canPrev && setRoundId(navRounds[selIdx - 1].id)} disabled={!canPrev} style={[st.arw, !canPrev && st.arwOff]}><Text style={st.arwTxt}>‹</Text></TouchableOpacity>
        <View style={st.weekMid}>
          <Text style={st.weekName}>{selMeta?.name || '—'}</Text>
          <Text style={st.weekSeason}>{selMeta?.year || ''} Sezonu</Text>
        </View>
        <TouchableOpacity onPress={() => canNext && setRoundId(navRounds[selIdx + 1].id)} disabled={!canNext} style={[st.arw, !canNext && st.arwOff]}><Text style={st.arwTxt}>›</Text></TouchableOpacity>
      </View>

      {/* STÜDYO KARTI */}
      <View style={st.hero}>
        <Text style={st.heroKicker}>🏁 HAFTA KAPANIŞI</Text>
        <Text style={st.heroLine}>{recapHeadline(recap)}</Text>
        <View style={st.progWrap}>
          <View style={st.progBar}>
            <View style={[st.progFill, { width: `${recap.official.total ? (recap.official.resolved / recap.official.total) * 100 : 0}%` }]} />
          </View>
          <Text style={st.progTxt}>{recap.official.resolved}/{recap.official.total} resmî sonuç</Text>
        </View>
      </View>

      {!hist && roundId != null ? (
        <View style={st.load}><ActivityIndicator color={colors.primary} /><Text style={st.muted}>Hafta yükleniyor…</Text></View>
      ) : !recap.hasData ? (
        <View style={st.emptyCard}>
          <Text style={st.emptyIcon}>🕐</Text>
          <Text style={st.emptyTitle}>Bu hafta için resmî sonuç yok</Text>
          <Text style={st.emptyTxt}>Resmî Spor Toto sonuçları açıklandıkça karne burada oluşur. Geçici/canlı skorla karne yazılmaz.</Text>
        </View>
      ) : (
        <>
          {/* SEN vs SİSTEM */}
          <View style={st.vsRow}>
            <ScoreCol
              title="SEN"
              value={u ? `${u.correct}/${u.made}` : '—'}
              sub={u ? `%${u.accuracy} isabet` : 'kupon yok'}
              win={winner === 'user'}
              tone={colors.success}
            />
            <View style={st.vsMid}><Text style={st.vsTxt}>VS</Text></View>
            <ScoreCol
              title="SİSTEM"
              value={sys ? `${sys.correct}/${sys.made}` : '—'}
              sub={sys ? `%${sys.accuracy} isabet` : 'tahmin yok'}
              win={winner === 'system'}
              tone={colors.info}
            />
          </View>

          {h2h ? (
            <View style={st.h2hCard}>
              <Text style={st.h2hTxt}>
                Adil karşılaştırma: ikinizin de tahmin yaptığı <Text style={st.h2hStrong}>{h2h.matches}</Text> maçta
                {' '}sen <Text style={[st.h2hStrong, { color: colors.success }]}>{h2h.user}</Text>,
                {' '}sistem <Text style={[st.h2hStrong, { color: colors.info }]}>{h2h.system}</Text> isabet.
              </Text>
            </View>
          ) : null}

          {/* ÖNE ÇIKANLAR */}
          {recap.highlights.length ? (
            <>
              <Text style={st.secTitle}>Haftanın Anları</Text>
              {recap.highlights.map((h) => {
                const meta = HL[h.kind];
                return (
                  <View key={`${h.kind}-${h.no}`} style={[st.hlCard, { borderLeftColor: meta.color }]}>
                    <View style={st.hlHead}>
                      <Text style={st.hlIcon}>{meta.icon}</Text>
                      <Text style={[st.hlTitle, { color: meta.color }]}>{meta.title}</Text>
                      <Text style={st.hlNo}>#{h.no}</Text>
                    </View>
                    <Text style={st.hlMatch} numberOfLines={1}>{h.home} — {h.away}</Text>
                    <View style={st.hlMeta}>
                      <Text style={st.hlChip}>Sonuç <Text style={st.hlChipStrong}>{h.actual}</Text> ({h.score})</Text>
                      {h.user ? <Text style={st.hlChip}>Sen <Text style={st.hlChipStrong}>{h.user.pick}</Text></Text> : null}
                      {h.system ? <Text style={st.hlChip}>Sistem <Text style={st.hlChipStrong}>{h.system.pick}</Text></Text> : null}
                    </View>
                  </View>
                );
              })}
            </>
          ) : (
            <View style={st.emptyCard}>
              <Text style={st.emptyTitle}>Ayrışan maç yok</Text>
              <Text style={st.emptyTxt}>Bu hafta sen ve sistem aynı maçlarda aynı yönde kaldınız.</Text>
            </View>
          )}

          {/* TÜM MAÇLAR */}
          <Text style={st.secTitle}>Tüm Resmî Sonuçlar</Text>
          <View style={st.tableCard}>
            <View style={st.thead}>
              <Text style={[st.th, { width: 24 }]}>#</Text>
              <Text style={[st.th, { flex: 1 }]}>Maç</Text>
              <Text style={[st.th, { width: 40, textAlign: 'center' }]}>Sonuç</Text>
              <Text style={[st.th, { width: 52, textAlign: 'center' }]}>Sen</Text>
              <Text style={[st.th, { width: 52, textAlign: 'center' }]}>Sistem</Text>
            </View>
            {recap.rows.map((r) => (
              <View key={r.no} style={st.tr}>
                <Text style={[st.td, { width: 24, color: colors.textMuted }]}>{r.no}</Text>
                <Text style={[st.td, { flex: 1 }]} numberOfLines={1}>{r.home} — {r.away}</Text>
                <Text style={[st.td, { width: 40, textAlign: 'center', fontWeight: '900' }]}>{r.actual}</Text>
                <Text style={[st.td, { width: 52, textAlign: 'center' }, cellTone(r.user)]}>{r.user ? `${r.user.pick} ${r.user.hit ? '✅' : '❌'}` : '—'}</Text>
                <Text style={[st.td, { width: 52, textAlign: 'center' }, cellTone(r.system)]}>{r.system ? `${r.system.pick} ${r.system.hit ? '✅' : '❌'}` : '—'}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      <Text style={st.disclaimer}>
        Karne yalnız resmî Spor Toto sonuçlarıyla hesaplanır. Geçmiş ölçümdür,
        gelecek sonuç vaadi değildir. 18 yaş altı kullanamaz.
      </Text>

      <TouchableOpacity style={st.linkBtn} onPress={() => navigation.navigate('CouponsTab', { screen: 'CouponCenter' })}>
        <Text style={st.linkTxt}>Kuponlarıma Git ›</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function cellTone(cell) {
  if (!cell) return { color: colors.textMuted };
  return { color: cell.hit ? colors.success : colors.danger, fontWeight: '800' };
}

function ScoreCol({ title, value, sub, win, tone }) {
  return (
    <View style={[st.col, win && { borderColor: tone, borderWidth: 2, backgroundColor: tone + '10' }]}>
      <Text style={st.colTitle}>{title}</Text>
      <Text style={[st.colVal, win && { color: tone }]}>{value}</Text>
      <Text style={st.colSub}>{sub}</Text>
      {win ? <Text style={[st.colWin, { color: tone }]}>▲ önde</Text> : null}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: spacing.md, paddingBottom: 40 },

  weekNav: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  arw: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  arwOff: { opacity: 0.35 },
  arwTxt: { color: colors.text, fontSize: 20, fontWeight: '900' },
  weekMid: { flex: 1, alignItems: 'center' },
  weekName: { color: colors.text, fontSize: 16, fontWeight: '900' },
  weekSeason: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },

  hero: { backgroundColor: '#132244', borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, ...shadow.soft },
  heroKicker: { color: colors.warning, fontSize: 11, fontWeight: '900', letterSpacing: 1.6 },
  heroLine: { color: colors.white, fontSize: 15, fontWeight: '800', lineHeight: 22, marginTop: 6 },
  progWrap: { marginTop: 12 },
  progBar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  progFill: { height: 6, backgroundColor: colors.success },
  progTxt: { color: '#B9C6DC', fontSize: 10.5, fontWeight: '800', marginTop: 5 },

  vsRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8, marginBottom: spacing.md },
  col: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, alignItems: 'center' },
  colTitle: { color: colors.textMuted, fontSize: 10.5, fontWeight: '900', letterSpacing: 1.4 },
  colVal: { color: colors.text, fontSize: 28, fontWeight: '900', marginTop: 4 },
  colSub: { color: colors.textMuted, fontSize: 11.5, fontWeight: '700', marginTop: 2 },
  colWin: { fontSize: 10.5, fontWeight: '900', marginTop: 4 },
  vsMid: { justifyContent: 'center' },
  vsTxt: { color: colors.textMuted, fontSize: 12, fontWeight: '900' },

  h2hCard: { backgroundColor: colors.surfaceSoft, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  h2hTxt: { color: colors.textSoft, fontSize: 12.5, fontWeight: '700', lineHeight: 19 },
  h2hStrong: { fontWeight: '900', color: colors.text },

  secTitle: { color: colors.text, fontSize: 15, fontWeight: '900', marginTop: spacing.sm, marginBottom: spacing.sm },
  hlCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, padding: spacing.md, marginBottom: spacing.sm },
  hlHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  hlIcon: { fontSize: 14 },
  hlTitle: { flex: 1, fontSize: 12.5, fontWeight: '900' },
  hlNo: { color: colors.textMuted, fontSize: 11, fontWeight: '900' },
  hlMatch: { color: colors.text, fontSize: 14, fontWeight: '800', marginTop: 5 },
  hlMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  hlChip: { color: colors.textMuted, fontSize: 11.5, fontWeight: '700' },
  hlChipStrong: { color: colors.text, fontWeight: '900' },

  tableCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 4, marginBottom: spacing.md },
  thead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  th: { color: colors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  td: { color: colors.text, fontSize: 12, fontWeight: '700' },

  emptyCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md },
  emptyIcon: { fontSize: 30 },
  emptyTitle: { color: colors.text, fontSize: 14.5, fontWeight: '900', marginTop: 6, textAlign: 'center' },
  emptyTxt: { color: colors.textMuted, fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 5, lineHeight: 17 },

  load: { paddingVertical: 30, alignItems: 'center' },
  muted: { color: colors.textMuted, fontSize: 12, marginTop: 6 },
  disclaimer: { color: colors.textMuted, fontSize: 10.5, fontStyle: 'italic', lineHeight: 15, marginTop: spacing.sm },
  linkBtn: { marginTop: spacing.md, alignSelf: 'flex-start' },
  linkTxt: { color: colors.primary, fontSize: 13, fontWeight: '800' },
});
