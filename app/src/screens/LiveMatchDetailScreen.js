// CANLI MAÇ DETAY — sekmeler: İstatistik (varsayılan) · Olaylar · Kupon/Sistem ·
// Özet. Tüm canlı istatistik/olaylar GERÇEK API-Football verisidir; veri yoksa
// alan gizlenir / boş durum gösterilir (uydurma YOK). 15 sn'de bir yenilenir.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { colors, spacing, radius } from '../theme';
import { getPref, setPref } from '../prefs';
import { deriveStatus, resultFromScore, pickHits } from '../liveLogic';
import { pressureIndex, sortStats, goalProgression } from '../liveEvents';
import LiveTimeline from '../components/LiveTimeline';
import { getWeekCoupons, finalVersion } from '../coupon/store';

const REFRESH_MS = 15000;
const TABS = ['İstatistik', 'Olaylar', 'Kupon/Sistem', 'Özet'];

// API-Football istatistik türü → Türkçe. Bilinmeyen tür ham gösterilir.
const STAT_TR = {
  'Shots on Goal': 'İsabetli Şut', 'Shots off Goal': 'İsabetsiz Şut', 'Total Shots': 'Şut',
  'Blocked Shots': 'Bloklanan Şut', 'Shots insidebox': 'Ceza Sahası İçi Şut', 'Shots outsidebox': 'Ceza Sahası Dışı Şut',
  'Fouls': 'Faul', 'Corner Kicks': 'Korner', 'Offsides': 'Ofsayt', 'Ball Possession': 'Topla Oynama',
  'Yellow Cards': 'Sarı Kart', 'Red Cards': 'Kırmızı Kart', 'Goalkeeper Saves': 'Kaleci Kurtarışı',
  'Total passes': 'Pas', 'Passes accurate': 'İsabetli Pas', 'Passes %': 'Pas İsabeti', 'expected_goals': 'xG',
};
const statLabel = (t) => STAT_TR[t] || t;
const numOf = (v) => { const n = parseFloat(String(v ?? '').replace('%', '')); return isFinite(n) ? n : 0; };

const EVENT_ICON = (e) => {
  const t = (e.type || '').toLowerCase(), d = (e.detail || '').toLowerCase();
  if (t === 'goal') return '⚽';
  if (t === 'card') return d.includes('red') ? '🟥' : '🟨';
  if (t === 'subst') return '🔁';
  if (t === 'var') return '📺';
  return '•';
};
const EVENT_LABEL = (e) => {
  const t = (e.type || '').toLowerCase(), d = e.detail || '';
  if (t === 'goal') return d.toLowerCase().includes('penalty') ? 'Gol (Penaltı)' : 'Gol';
  if (t === 'card') return d.toLowerCase().includes('red') ? 'Kırmızı Kart' : 'Sarı Kart';
  if (t === 'subst') return 'Oyuncu Değişikliği';
  if (t === 'var') return `VAR${d ? ` · ${d}` : ''}`;
  return e.type || 'Olay';
};

export default function LiveMatchDetailScreen({ route, navigation }) {
  const { no } = route.params;
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('İstatistik');
  const [statView, setStatView] = useState(getPref('liveStatView'));

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await api.live(no);
      setD(res);
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  }, [no]);

  useFocusEffect(useCallback(() => {
    let alive = true;
    load();
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (alive) load();
    }, REFRESH_MS);
    return () => { alive = false; clearInterval(id); };
  }, [load]));

  const anim = getPref('liveAnim');

  // CANLI rozeti nabız + skor değişince kısa flash.
  const pulse = useRef(new Animated.Value(1)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const prevScore = useRef(null);
  const st = d ? deriveStatus(d) : 'notStarted';
  useEffect(() => {
    if (st === 'live' && anim !== 'off') {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    }
    pulse.setValue(1);
  }, [st, anim, pulse]);
  useEffect(() => {
    const cur = d?.score ? `${d.score.home}-${d.score.away}` : null;
    if (prevScore.current && cur && cur !== prevScore.current && anim !== 'off') {
      flash.setValue(1);
      Animated.timing(flash, { toValue: 0, duration: 1200, useNativeDriver: false }).start();
    }
    prevScore.current = cur;
  }, [d?.score, anim, flash]);

  if (loading && !d) return <Wrap onBack={() => navigation.goBack()}><Center><ActivityIndicator color={colors.primary} size="large" /></Center></Wrap>;
  if (error) return <Wrap onBack={() => navigation.goBack()}><Center><Text style={s.emoji}>⚠️</Text><Text style={s.errText}>Canlı veri alınamadı.</Text><Text style={s.muted}>{error}</Text>
    <TouchableOpacity style={s.retry} onPress={load}><Text style={s.retryTxt}>Tekrar Dene</Text></TouchableOpacity></Center></Wrap>;

  const statusText = { live: `CANLI${d.minute ? ` ${d.minute}'` : ''}`, finished: 'Maç Sonu', awaiting: 'Sonuç bekleniyor', suspended: 'Maç durdu', postponed: 'Ertelendi', cancelled: 'İptal', notStarted: 'Başlamadı' }[st];
  const actual = resultFromScore(d.score);
  const sysSym = d.prediction && d.prediction.symbol !== '-' ? d.prediction.symbol : null;
  const scored = st === 'live' || st === 'finished';
  const flashBg = flash.interpolate({ inputRange: [0, 1], outputRange: ['rgba(0,0,0,0)', colors.accentSoft] });

  // KULLANICININ GERÇEK KUPONLARI — bu haftanın kayıtlı kuponlarında bu maça
  // yapılmış seçim. Kupon yoksa liste boş kalır (uydurma kupon gösterilmez).
  const myPicks = (d.roundId != null ? getWeekCoupons(d.roundId) : [])
    .map((c) => {
      const v = finalVersion(c);
      const sel = v?.selections?.find((s) => Number(s.no) === Number(d.no));
      const outcomes = sel?.selectedOutcomes || [];
      if (!outcomes.length) return null;
      return {
        id: c.id,
        couponNo: c.couponNo,
        ranked: !!c.isRankedCoupon,
        outcomes,
        label: outcomes.join('-'),
        hit: actual ? outcomes.includes(actual) : null,
      };
    })
    .filter(Boolean);
  const rankedPick = myPicks.find((p) => p.ranked) || null;
  // "Kupon riskte": CANLI maçta dereceli kuponun seçimi şu an tutmuyor (geçici).
  const couponAtRisk = st === 'live' && rankedPick ? rankedPick.hit === false : null;
  const pressure = pressureIndex(d.stats);
  const statRows = sortStats(d.stats);
  const goals = goalProgression(d.events);

  return (
    <Wrap onBack={() => navigation.goBack()}>
      {/* skor başlığı */}
      <Animated.View style={[s.scoreHead, { backgroundColor: flashBg }]}>
        <Text style={s.team} numberOfLines={1}>{d.home}</Text>
        <View style={s.scoreMid}>
          <Text style={s.scoreBig}>{d.score ? `${d.score.home} - ${d.score.away}` : '–'}</Text>
          <Animated.View style={[s.statusPill, st === 'live' ? { opacity: pulse } : null]}>
            <Text style={[s.statusTxt, st === 'live' && { color: colors.accent }]}>{statusText}</Text>
          </Animated.View>
        </View>
        <Text style={[s.team, { textAlign: 'right' }]} numberOfLines={1}>{d.away}</Text>
      </Animated.View>

      {/* sekmeler */}
      <View style={s.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[s.tab, tab === t && s.tabOn]}>
            <Text style={[s.tabTxt, tab === t && s.tabTxtOn]} numberOfLines={1}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.body}>
        {/* OLAY ŞERİDİ — her sekmede görünür; yayında maçın akışı tek bakışta. */}
        <LiveTimeline events={d.events} minute={st === 'live' ? d.minute : null} homeName={d.home} awayName={d.away} />

        {tab === 'İstatistik' && (
          !d.stats?.length ? <Empty text="Canlı istatistik bilgisi henüz yok." /> : (
            <>
              {/* BASKI GÖSTERGESİ — yalnız gerçek istatistiklerden; tahmin değil. */}
              {pressure ? (
                <View style={s.prCard}>
                  <View style={s.prHead}>
                    <Text style={[s.prVal, { color: colors.info }]}>%{pressure.home}</Text>
                    <Text style={s.prTitle}>BASKI GÖSTERGESİ</Text>
                    <Text style={[s.prVal, { color: colors.accent, textAlign: 'right' }]}>%{pressure.away}</Text>
                  </View>
                  <View style={s.prBar}>
                    <View style={{ flex: pressure.home || 1, backgroundColor: colors.info, height: 10 }} />
                    <View style={{ flex: pressure.away || 1, backgroundColor: colors.accent, height: 10 }} />
                  </View>
                  <Text style={s.prNote}>
                    {pressure.basis.join(' · ')} verilerinin payı. Sonuç tahmini değildir.
                  </Text>
                </View>
              ) : null}

              <View style={s.viewToggle}>
                {['table', 'graph'].map((v) => (
                  <TouchableOpacity key={v} onPress={() => { setStatView(v); setPref('liveStatView', v); }} style={[s.vtChip, statView === v && s.vtChipOn]}>
                    <Text style={[s.vtTxt, statView === v && s.vtTxtOn]}>{v === 'table' ? 'Tablo' : 'Grafik'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {statRows.map((row, i) => (
                statView === 'table'
                  ? <StatTableRow key={i} label={statLabel(row.type)} home={row.home} away={row.away} />
                  : <StatGraphRow key={i} label={statLabel(row.type)} home={row.home} away={row.away} />
              ))}
            </>
          )
        )}

        {tab === 'Olaylar' && (
          !d.events?.length ? <Empty text="Canlı olay bilgisi henüz yok." /> : (
            <>
            {/* GOL AKIŞI — her golden sonraki koşan skor. */}
            {goals.length ? (
              <View style={s.golWrap}>
                {goals.map((g, i) => (
                  <View key={i} style={s.golChip}>
                    <Text style={s.golMin}>{g.minute}{g.extra ? `+${g.extra}` : ''}'</Text>
                    <Text style={s.golScore}>{g.home}-{g.away}</Text>
                    {g.penalty ? <Text style={s.golTag}>P</Text> : null}
                    {g.ownGoal ? <Text style={s.golTag}>KK</Text> : null}
                  </View>
                ))}
              </View>
            ) : null}
            {d.events.map((e, i) => (
              <View key={i} style={s.evRow}>
                <Text style={s.evMin}>{e.minute != null ? `${e.minute}${e.extra ? '+' + e.extra : ''}'` : ''}</Text>
                <Text style={s.evIcon}>{EVENT_ICON(e)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.evLabel}>{EVENT_LABEL(e)}{e.side ? ` · ${e.side === 'home' ? d.home : d.away}` : (e.team ? ` · ${e.team}` : '')}</Text>
                  {e.player ? <Text style={s.evPlayer}>{e.player}{e.assist ? ` (asist: ${e.assist})` : ''}</Text> : null}
                </View>
              </View>
            ))}
            </>
          )
        )}

        {tab === 'Kupon/Sistem' && (
          <View>
            {/* SENİN KUPONUN — bu haftanın GERÇEK kayıtlı kuponlarındaki seçim.
                Kupon yoksa dürüstçe "kupon yok" der; sahte seçim gösterilmez. */}
            <View style={s.ksCard}>
              <Text style={s.ksTitle}>Senin Kuponun</Text>
              {!myPicks.length ? (
                <>
                  <Text style={s.ksNo}>Kupon yok</Text>
                  <Text style={s.ksNote}>Bu bülten için bu maça yapılmış kayıtlı seçimin yok.</Text>
                  {d.roundId != null ? (
                    <TouchableOpacity style={s.ksBtn} onPress={() => navigation.navigate('CouponEditor', { roundId: d.roundId })}>
                      <Text style={s.ksBtnTxt}>Kupon Oluştur</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              ) : (
                myPicks.map((p) => (
                  <View key={p.id} style={s.mpRow}>
                    <Text style={s.mpName} numberOfLines={1}>
                      Kupon {p.couponNo}{p.ranked ? <Text style={s.mpRanked}>  ⭐ dereceli</Text> : null}
                    </Text>
                    <Text style={s.mpPick}>{p.label}</Text>
                    <Text style={[s.mpMark, { color: !scored || p.hit == null ? colors.textMuted : p.hit ? colors.success : colors.danger }]}>
                      {!scored || p.hit == null ? '⏳' : p.hit ? (st === 'finished' ? '✅ doğru' : '✅ anlık') : (st === 'finished' ? '❌ yanlış' : '❌ anlık')}
                    </Text>
                  </View>
                ))
              )}
              {myPicks.length && st !== 'finished' ? (
                <Text style={s.ksNote}>Anlık işaretler geçicidir — kesin sonuç yalnız resmî Spor Toto sonucuyla belirlenir.</Text>
              ) : null}
            </View>
            <View style={s.ksCard}>
              <Text style={s.ksTitle}>Sistem Tahmini</Text>
              <View style={s.ksRow}>
                <Text style={s.ksBig}>{sysSym || '—'}</Text>
                <Text style={[s.ksMark, markColor(scored, sysSym, actual)]}>
                  {!sysSym ? '' : !scored ? '⏳ bekliyor' : pickHits(sysSym, actual) ? (st === 'finished' ? '✅ doğru (kesin)' : '✅ anlık doğru') : (st === 'finished' ? '❌ yanlış (kesin)' : '❌ anlık yanlış')}
                </Text>
              </View>
              <Text style={s.ksNote}>Anlık skor: {d.score ? `${d.score.home} - ${d.score.away}` : '–'}</Text>
            </View>
            <View style={s.riskCard}>
              <Text style={s.ksTitle}>Risk</Text>
              <Text style={s.riskLine}>Kupon Riskte: {rankedPick ? (
                <Text style={[s.riskVal, { color: couponAtRisk ? colors.danger : colors.success }]}>{couponAtRisk ? 'EVET (anlık)' : 'hayır'}</Text>
              ) : <><Text style={s.riskVal}>—</Text> (kupon yok)</>}</Text>
              <Text style={s.riskLine}>Sistem Riskte: <Text style={[s.riskVal, { color: (st === 'live' && pickHits(sysSym, actual) === false) ? colors.danger : colors.success }]}>
                {st === 'live' && pickHits(sysSym, actual) === false ? 'EVET (anlık)' : 'hayır'}</Text></Text>
              {(st === 'suspended' || st === 'cancelled' || st === 'postponed') && <Text style={s.ksNote}>Resmi karar bekleniyor — kupon/sistem sonucu kesinleşmedi.</Text>}
            </View>
          </View>
        )}

        {tab === 'Özet' && (
          <View>
            <SummaryRow k="Durum" v={statusText} />
            <SummaryRow k="Skor" v={d.score ? `${d.score.home} - ${d.score.away}` : '–'} />
            {d.minute != null && st === 'live' ? <SummaryRow k="Dakika" v={`${d.minute}'`} /> : null}
            <SummaryRow k="Sistem tahmini" v={sysSym || '—'} />
            <SummaryRow k="Canlı veri" v={d.hasLiveData ? 'Gerçek zamanlı veri' : 'Şu an canlı ayrıntı yok'} />
            {st === 'awaiting' && <Text style={s.ksNote}>Resmi sonuç bekleniyor. Sonuç kesinleşmeden kupon/sistem sonucu hesaplanmaz.</Text>}
            {st === 'suspended' && <Text style={s.ksNote}>Maç yarıda kaldı / durduruldu. Resmi karar bekleniyor.</Text>}
          </View>
        )}
      </ScrollView>
    </Wrap>
  );
}

function markColor(scored, sym, actual) {
  if (!scored || !sym) return { color: colors.textMuted };
  return { color: pickHits(sym, actual) ? colors.success : colors.danger };
}

function StatTableRow({ label, home, away }) {
  return (
    <View style={s.stRow}>
      <Text style={s.stVal}>{home ?? '–'}</Text>
      <Text style={s.stLabel} numberOfLines={1}>{label}</Text>
      <Text style={[s.stVal, { textAlign: 'right' }]}>{away ?? '–'}</Text>
    </View>
  );
}
function StatGraphRow({ label, home, away }) {
  const h = numOf(home), a = numOf(away), tot = h + a || 1;
  return (
    <View style={s.grRow}>
      <View style={s.grHead}><Text style={s.stVal}>{home ?? '–'}</Text><Text style={s.stLabel}>{label}</Text><Text style={[s.stVal, { textAlign: 'right' }]}>{away ?? '–'}</Text></View>
      <View style={s.grBar}>
        <View style={{ flex: h / tot, backgroundColor: colors.info, height: 7 }} />
        <View style={{ flex: a / tot, backgroundColor: colors.accent, height: 7 }} />
      </View>
    </View>
  );
}
function SummaryRow({ k, v }) { return <View style={s.sumRow}><Text style={s.sumK}>{k}</Text><Text style={s.sumV}>{v}</Text></View>; }
function Empty({ text }) { return <View style={s.emptyBox}><Text style={s.emptyTxt}>{text}</Text></View>; }
function Center({ children }) { return <View style={s.center}>{children}</View>; }
function Wrap({ children, onBack }) {
  return (
    <View style={s.container}>
      <TouchableOpacity onPress={onBack} style={s.back}><Text style={s.backTxt}>‹ Canlı Bülten</Text></TouchableOpacity>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  back: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: 6 },
  backTxt: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  scoreHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: 8 },
  team: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '800' },
  scoreMid: { alignItems: 'center', minWidth: 96 },
  scoreBig: { color: colors.text, fontSize: 24, fontWeight: '900', letterSpacing: 1 },
  statusPill: { marginTop: 3, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.surfaceSoft },
  statusTxt: { color: colors.textSoft, fontSize: 10.5, fontWeight: '900' },

  tabs: { flexDirection: 'row', backgroundColor: colors.card, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  tab: { flex: 1, paddingVertical: 11, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: colors.accent },
  tabTxt: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  tabTxtOn: { color: colors.text },
  body: { padding: spacing.md, paddingBottom: spacing.xl },

  viewToggle: { flexDirection: 'row', gap: 6, marginBottom: spacing.md, alignSelf: 'flex-start' },
  vtChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: colors.cardAlt },
  vtChipOn: { backgroundColor: colors.primary },
  vtTxt: { color: colors.textSoft, fontSize: 12, fontWeight: '800' },
  vtTxtOn: { color: colors.white },

  stRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  stVal: { width: 58, color: colors.text, fontSize: 14, fontWeight: '800' },
  stLabel: { flex: 1, color: colors.textSoft, fontSize: 12.5, fontWeight: '600', textAlign: 'center' },
  grRow: { marginBottom: spacing.md },
  grHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  grBar: { flexDirection: 'row', height: 7, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.surfaceSoft },

  evRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  evMin: { width: 42, color: colors.textMuted, fontSize: 12, fontWeight: '900' },
  evIcon: { fontSize: 16 },
  evLabel: { color: colors.text, fontSize: 13, fontWeight: '700' },
  evPlayer: { color: colors.textMuted, fontSize: 11.5, fontWeight: '600', marginTop: 1 },

  prCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  prHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  prVal: { flex: 1, fontSize: 15, fontWeight: '900' },
  prTitle: { color: colors.textMuted, fontSize: 9.5, fontWeight: '900', letterSpacing: 1 },
  prBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: colors.surfaceSoft },
  prNote: { color: colors.textMuted, fontSize: 10, fontStyle: 'italic', marginTop: 6, lineHeight: 14 },

  golWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md },
  golChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.surfaceSoft, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  golMin: { color: colors.textMuted, fontSize: 10.5, fontWeight: '900' },
  golScore: { color: colors.text, fontSize: 12.5, fontWeight: '900' },
  golTag: { color: colors.accent, fontSize: 9, fontWeight: '900' },

  mpRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border },
  mpName: { flex: 1, color: colors.text, fontSize: 12.5, fontWeight: '800' },
  mpRanked: { color: colors.warning, fontSize: 10.5, fontWeight: '900' },
  mpPick: { color: colors.text, fontSize: 15, fontWeight: '900', letterSpacing: 1 },
  mpMark: { fontSize: 11.5, fontWeight: '800', width: 70, textAlign: 'right' },
  ksBtn: { marginTop: 10, alignSelf: 'flex-start', backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.sm },
  ksBtnTxt: { color: colors.white, fontSize: 12.5, fontWeight: '800' },

  ksCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  riskCard: { backgroundColor: colors.warningSoft, borderRadius: radius.md, borderWidth: 1, borderColor: colors.warning, padding: spacing.md, marginBottom: spacing.sm },
  ksTitle: { color: colors.textSoft, fontSize: 12, fontWeight: '900', marginBottom: 6 },
  ksNo: { color: colors.textMuted, fontSize: 15, fontWeight: '900' },
  ksRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ksBig: { color: colors.text, fontSize: 22, fontWeight: '900' },
  ksMark: { fontSize: 13, fontWeight: '800' },
  ksNote: { color: colors.textMuted, fontSize: 11.5, fontWeight: '600', marginTop: 6, lineHeight: 16 },
  riskLine: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 3 },
  riskVal: { fontWeight: '900' },

  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  sumK: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  sumV: { color: colors.text, fontSize: 13, fontWeight: '900' },

  emptyBox: { padding: 30, alignItems: 'center' },
  emptyTxt: { color: colors.textMuted, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  emoji: { fontSize: 40 }, errText: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 6 },
  muted: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  retry: { marginTop: 16, backgroundColor: colors.primary, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 10 },
  retryTxt: { color: colors.white, fontWeight: '800' },
});
