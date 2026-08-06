// KULLANICI BAŞARI PANELİ — Spor Toto bülteniyle EŞ ZAMANLI: üstte ← hafta →
// gezme. Her hafta o haftanın resmi sonuç durumu + SİSTEMİN o haftaki GERÇEK
// başarısı + kullanıcının kupon durumu (gerçek kupon yoksa "kupon yok").
// Başarı YALNIZ resmi Spor Toto sonucuyla kesinleşir — canlı/geçici yazılmaz.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { colors, spacing, radius, shadow } from '../theme';
import { matchDate } from '../utils';
import { getPref, setPref } from '../prefs';
import { pickHits, resultFromScore } from '../liveLogic';
import { getWeekCoupons, getRankedCoupon, finalVersion, syncFromServer } from '../coupon/store';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import ScoreLegend from '../components/ScoreLegend';
import { DashboardSection, ViewModeToggle, MetricBar } from '../components/DashboardUI';

const officialResolved = (m) => !!(m && m.result && m.score);
const sysSymOf = (m) => (m.prediction && m.prediction.symbol && m.prediction.symbol !== '-' ? m.prediction.symbol : null);

// Skor renk kuralı (ANA KURAL): yeşil = resmi sonuç · sarı = henüz resmi değil ·
// kırmızı = canlı. Resmi yoksa FootyStats geçici skoru gösterilir ama başarıya
// SAYILMAZ — yalnız renk/bilgi amaçlı.
const scoreView = (m) => {
  if (m && m.result && m.score) return { color: colors.success, score: `${m.score.home}-${m.score.away}`, result: m.result, kind: 'official' };
  const pv = m && m.provisional;
  if (pv && pv.score) {
    return { color: pv.live ? colors.accent : colors.warning, score: `${pv.score.home}-${pv.score.away}`, result: resultFromScore(pv.score), kind: pv.live ? 'live' : 'prov' };
  }
  return null;
};

export default function UserDashboardScreen({ navigation }) {
  const [rounds, setRounds] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [hist, setHist] = useState(null);
  const [histLoading, setHistLoading] = useState(false);
  const [scorecard, setScorecard] = useState(null);
  const [view, setView] = useState(getPref('userDashView'));
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0); // kupon store/sunucu senkronu değişince yeniden hesapla

  // Hafta listesi + genel karne (bir kez)
  const boot = useCallback(async () => {
    try {
      setError(null);
      const [r, sc] = await Promise.all([api.rounds(), api.systemScorecard().catch(() => null)]);
      setRounds(r);
      setScorecard(sc);
      // Varsayılan: en son SONUÇLANMIŞ hafta (güncelden bir önceki) — hemen başarı görünür.
      const all = r?.rounds || [];
      const curIdx = all.findIndex((x) => x.id === r?.currentRoundId);
      const nav = curIdx >= 0 ? all.slice(0, curIdx + 1) : all;
      const def = nav.length >= 2 ? nav[nav.length - 2].id : (r?.currentRoundId ?? nav[nav.length - 1]?.id ?? null);
      setSelectedId(def);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => {
    let alive = true;
    boot();
    setTick((t) => t + 1);
    syncFromServer().then((r) => { if (alive && r?.synced) setTick((t) => t + 1); }); // sunucudan kalıcı kuponlar
    return () => { alive = false; };
  }, [boot]));

  // Seçili haftanın verisi
  useEffect(() => {
    if (selectedId == null) return;
    let alive = true;
    setHistLoading(true);
    api.history(selectedId)
      .then((h) => { if (alive) setHist({ ...h, roundId: selectedId }); })
      .catch(() => { if (alive) setHist(null); })
      .finally(() => { if (alive) setHistLoading(false); });
    return () => { alive = false; };
  }, [selectedId]);

  // ——— hafta gezme ———
  const all = rounds?.rounds || [];
  const currentRoundId = rounds?.currentRoundId ?? null;
  const curIdx = all.findIndex((r) => r.id === currentRoundId);
  const navRounds = curIdx >= 0 ? all.slice(0, curIdx + 1) : all;
  const selIdx = navRounds.findIndex((r) => r.id === selectedId);
  const selMeta = navRounds[selIdx] || null;
  const canPrev = selIdx > 0;
  const canNext = selIdx >= 0 && selIdx < navRounds.length - 1;
  const goPrev = () => { if (canPrev) setSelectedId(navRounds[selIdx - 1].id); };
  const goNext = () => { if (canNext) setSelectedId(navRounds[selIdx + 1].id); };

  // ——— seçili hafta hesap (resmi sonuç + sistem + KULLANICI dereceli kupon) ———
  const week = useMemo(() => {
    const wm = hist?.matches || [];
    const total = wm.length;
    const resolved = wm.filter(officialResolved);
    const sysR = resolved.filter((m) => sysSymOf(m));
    const sysCorrect = sysR.filter((m) => pickHits(sysSymOf(m), m.result)).length;
    const hasPrize = !!hist?.prize;
    const fullyResolved = total > 0 && resolved.length === total;
    const resultMap = new Map(resolved.map((m) => [m.no, m.result]));
    // Kullanıcının GERÇEK kuponları (localStorage) — resmi sonuçlara göre.
    const couponResult = (coupon) => {
      const v = finalVersion(coupon); if (!v) return null;
      let hit = 0, res = 0;
      for (const sc of v.selections) { const r = resultMap.get(sc.no); if (r) { res += 1; if (sc.selectedOutcomes.includes(r)) hit += 1; } }
      return { id: coupon.id, couponNo: coupon.couponNo, ranked: coupon.isRankedCoupon, hit, resolved: res, columns: v.columnCount, amount: v.totalAmount };
    };
    const coupons = selectedId != null ? getWeekCoupons(selectedId) : [];
    const ranked = getRankedCoupon(selectedId);
    const rankedRes = ranked ? couponResult(ranked) : null;
    const others = coupons.filter((c) => !c.isRankedCoupon).map(couponResult);
    // Dereceli kupondaki maç bazlı seçim (no → seçilen sonuçlar). Dereceli değişince otomatik güncellenir.
    const rankedPicks = new Map();
    if (ranked) { const rv = finalVersion(ranked); if (rv) for (const sc of rv.selections) if (sc.selectedOutcomes?.length) rankedPicks.set(sc.no, sc.selectedOutcomes); }
    let status;
    if (resolved.length === 0) status = 'Sonuçlar bekleniyor';
    else if (!fullyResolved) status = `Resmi sonuçlar bekleniyor · ${resolved.length}/${total} geldi`;
    else if (!hasPrize) status = 'Maç sonuçları tamamlandı · İkramiye bekleniyor';
    else status = 'Sonuçlar açıklandı';
    return { total, resolvedCount: resolved.length, fullyResolved, hasPrize, sysTotal: sysR.length, sysCorrect, status, hasCoupon: coupons.length > 0, rankedRes, others, rankedPicks, hasRanked: !!ranked, rankedNo: ranked?.couponNo ?? null };
  }, [hist, selectedId, tick]);

  if (loading && !rounds) return <LoadingState message="Başarı panelin hazırlanıyor…" />;
  if (error) return <ErrorState message={error} onRetry={boot} />;

  const detailed = view !== 'simple';
  const technical = view === 'technical';
  const overall = scorecard?.hasData ? scorecard : null;
  const bestWeek = overall?.weeks?.length ? [...overall.weeks].sort((a, b) => b.accuracy - a.accuracy)[0] : null;
  const worstWeek = overall?.weeks?.length ? [...overall.weeks].sort((a, b) => a.accuracy - b.accuracy)[0] : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.pad}>
      <Text style={styles.pageTitle}>Başarı Panelim</Text>

      {/* HAFTA GEZME */}
      <View style={styles.weekNav}>
        <TouchableOpacity onPress={goPrev} disabled={!canPrev} accessibilityRole="button" accessibilityLabel="Önceki hafta" style={[styles.arw, !canPrev && styles.arwOff]}><Text style={styles.arwTxt}>‹</Text></TouchableOpacity>
        <View style={styles.weekMid}>
          <Text style={styles.weekName}>{selMeta?.name || '—'}</Text>
          <Text style={styles.weekSeason}>{selMeta?.year || rounds?.rounds?.[0]?.year || ''} Sezonu</Text>
        </View>
        <TouchableOpacity onPress={goNext} disabled={!canNext} accessibilityRole="button" accessibilityLabel="Sonraki hafta" style={[styles.arw, !canNext && styles.arwOff]}><Text style={styles.arwTxt}>›</Text></TouchableOpacity>
      </View>

      <View style={styles.controls}>
        <ViewModeToggle value={view} onChange={(v) => { setView(v); setPref('userDashView', v); }} />
      </View>

      {histLoading && !hist ? (
        <View style={styles.loadWk}><ActivityIndicator color={colors.primary} /><Text style={styles.muted}>Hafta yükleniyor…</Text></View>
      ) : (
        <>
          {/* KUPON DURUMU */}
          {week.hasCoupon ? (
            <View style={styles.rankedCard}>
              <Text style={styles.rankedKicker}>⭐ ANA DERECE · Dereceli Kupon</Text>
              {week.rankedRes ? (
                <Text style={styles.rankedBig}>
                  {week.rankedRes.resolved > 0
                    ? <><Text style={{ color: colors.success }}>{week.rankedRes.hit}</Text>/{week.rankedRes.resolved} doğru</>
                    : 'sonuçlar bekleniyor'}
                  {week.rankedRes.resolved > 0 && week.rankedRes.resolved < 15 ? <Text style={styles.rankedSub}>  · {week.rankedRes.resolved}/15 resmi</Text> : null}
                </Text>
              ) : <Text style={styles.rankedBig}>—</Text>}
              {week.others.length > 0 && (
                <View style={styles.othersWrap}>
                  <Text style={styles.othersHead}>Diğer Kuponlar · {week.others.length}</Text>
                  {week.others.map((o) => (
                    <TouchableOpacity
                      key={o.couponNo}
                      style={styles.otherRow}
                      // 'Coupons' diye bir ekran YOK — bu satır hiçbir yere
                      // gitmiyordu. Kuponlarım sekmesindeki gerçek sonuç ekranı.
                      onPress={() => navigation.navigate('CouponsTab', { screen: 'CouponResult', params: { roundId: selectedId, couponId: o.id } })}
                    >
                      <Text style={styles.otherName}>Kupon {o.couponNo}<Text style={styles.otherTag}>  · Derecesiz</Text></Text>
                      <Text style={styles.otherMeta}>
                        {o.resolved > 0
                          ? <><Text style={{ color: colors.success, fontWeight: '900' }}>{o.hit}</Text>/{o.resolved} doğru</>
                          : `${o.columns} kolon · ${o.amount}₺`}
                        {'  ›'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <TouchableOpacity style={styles.couponBtn} onPress={() => navigation.navigate('CouponsTab', { screen: 'CouponCenter' })}><Text style={styles.couponBtnTxt}>Kuponlarım</Text></TouchableOpacity>
            </View>
          ) : (
            <View style={styles.couponCard}>
              <Text style={styles.couponTitle}>Bu hafta kupon oluşturmadın</Text>
              <Text style={styles.couponBody}>Bu haftanın resmi sonuçları görüntülenebilir, ancak senin başarı hesabın için kayıtlı kupon yok.</Text>
              <TouchableOpacity style={styles.couponBtn} onPress={() => navigation.navigate('BulletinTab')}><Text style={styles.couponBtnTxt}>Bülten Detayını Gör</Text></TouchableOpacity>
            </View>
          )}

          {/* HAFTA KAPANIŞI — seçili haftanın sen vs sistem karnesi. */}
          <TouchableOpacity
            style={styles.recapLink}
            onPress={() => navigation.navigate('HomeTab', { screen: 'WeekRecap', params: { roundId: selectedId } })}
          >
            <Text style={styles.recapLinkTxt}>🏁 Bu Haftanın Kapanışı · Sen vs Sistem ›</Text>
          </TouchableOpacity>

          {/* RESMİ SONUÇ + SİSTEM (o hafta, gerçek) */}
          <View style={styles.wkCard}>
            <View style={styles.wkRow}><Text style={styles.wkK}>Resmi sonuç durumu</Text><Text style={[styles.wkV, week.fullyResolved && week.hasPrize && { color: colors.success }]}>{week.status}</Text></View>
            <View style={styles.wkRow}>
              <Text style={styles.wkK}>Sistem bu hafta</Text>
              <Text style={styles.wkV}>
                {week.sysTotal > 0
                  ? <><Text style={{ color: colors.success, fontWeight: '900' }}>{week.sysCorrect}</Text>/{week.sysTotal} doğru</>
                  : (week.resolvedCount === 0 ? 'sonuç bekleniyor' : '—')}
              </Text>
            </View>
            <View style={[styles.wkRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.wkK}>Senin doğru sayın (dereceli)</Text>
              {week.hasCoupon && week.rankedRes && week.rankedRes.resolved > 0
                ? <Text style={styles.wkV}><Text style={{ color: colors.success, fontWeight: '900' }}>{week.rankedRes.hit}</Text>/{week.rankedRes.resolved}</Text>
                : <Text style={styles.wkVMuted}>{week.hasCoupon ? 'sonuç bekleniyor' : 'kupon yok'}</Text>}
            </View>
          </View>

          {/* DETAYLI: maç bazlı (sistem tahmini vs resmi sonuç — gerçek) */}
          {detailed && (
            <>
              <DashboardSection
                title="Maç Bazlı"
                sub={week.hasRanked
                  ? `Sistem tahmini · resmi sonuç · dereceli kuponun (Kupon ${week.rankedNo}).`
                  : 'Sistemin tahmini ile resmi sonuç. (Dereceli kuponun yok.)'}
              />
              <ScoreLegend />
              {(hist?.matches || []).map((m) => {
                const res = officialResolved(m);            // ✅/❌ YALNIZ resmi sonuçtan
                const sv = scoreView(m);                    // renkli skor (resmi/geçici/canlı)
                const sym = sysSymOf(m);
                const sysHit = res && sym ? pickHits(sym, m.result) : null;
                const myPick = week.rankedPicks.get(m.no) || null;
                const myHit = res && myPick ? myPick.includes(m.result) : null;
                const d = matchDate(m.date);
                return (
                  <View key={m.no} style={styles.mRow}>
                    <Text style={styles.mNo}>{m.no}</Text>
                    <View style={styles.mMid}>
                      <Text style={styles.mTeams} numberOfLines={1}>{m.home.name} - {m.away.name}</Text>
                      {(d.day || d.time) ? <Text style={styles.mDate}>{d.day}{d.day && d.time ? ' · ' : ''}{d.time}</Text> : null}
                    </View>
                    <View style={styles.mRight}>
                      {sv ? (
                        <Text style={styles.mResTxt}>
                          <Text style={{ color: sv.color, fontWeight: '900' }}>{sv.score}</Text>
                          {sv.result ? <> · <Text style={{ color: sv.color, fontWeight: '900' }}>{sv.result}</Text></> : null}
                        </Text>
                      ) : <Text style={styles.mWait}>bekliyor</Text>}
                      <Text style={styles.mSys}>
                        Sistem: <Text style={{ fontWeight: '900', color: colors.text }}>{sym || '—'}</Text> {sysHit == null ? '⏳' : sysHit ? '✅' : '❌'}
                        {'  ·  '}Sen: <Text style={{ fontWeight: '900', color: myPick ? colors.primary : colors.textMuted }}>{myPick ? myPick.join('/') : '—'}</Text> {myPick == null ? '' : myHit == null ? '⏳' : myHit ? '✅' : '❌'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </>
          )}

          {technical && (
            <>
              <DashboardSection title="Teknik" />
              <View style={styles.wkCard}>
                <TechRow k="Sezon" v={selMeta?.year || '—'} />
                <TechRow k="Hafta" v={selMeta?.name || '—'} />
                <TechRow k="roundId / bulletinId" v={String(selectedId ?? '—')} />
                <TechRow k="Resmi sonuç" v={`${week.resolvedCount}/${week.total} geldi`} />
                <TechRow k="Kupon" v="kayıtlı kupon yok (mock kupon gerçek sayılmaz)" last />
              </View>
            </>
          )}
        </>
      )}

      {/* GENEL BAŞARI ÖZETİ */}
      <DashboardSection title="Genel Özet" sub="Tüm haftalar — resmi sonuçlara göre" />
      {overall ? (
        <View style={styles.wkCard}>
          <MetricBar label="Sistem genel isabeti" value={overall.accuracy} />
          <View style={styles.sumGrid}>
            <SumCell label="Toplam maç" v={overall.total} />
            <SumCell label="Doğru" v={overall.correct} c={colors.success} />
            <SumCell label="Yanlış" v={overall.wrong} c={colors.danger} />
          </View>
          {bestWeek && worstWeek && (
            <View style={styles.sumGrid}>
              <SumCell label="En başarılı hafta" v={`${bestWeek.round} · %${bestWeek.accuracy}`} small />
              <SumCell label="En zayıf hafta" v={`${worstWeek.round} · %${worstWeek.accuracy}`} small />
            </View>
          )}
          <Text style={styles.userNote}>Senin genel karnen: <Text style={{ fontWeight: '900' }}>kupon yok</Text> — gerçek kupon oluşturma sistemi bültene bağlandığında, senin hafta-hafta ve genel karnen de burada sistemle aynı düzende, sadece resmi sonuçlarla oluşacak.</Text>
        </View>
      ) : (
        <View style={styles.wkCard}><Text style={styles.muted}>Henüz resmi sonuçlanan maç yok — genel özet, resmi sonuçlar geldikçe oluşacak.</Text></View>
      )}
    </ScrollView>
  );
}

function TechRow({ k, v, last }) {
  return <View style={[styles.techRow, last && { borderBottomWidth: 0 }]}><Text style={styles.techK}>{k}</Text><Text style={styles.techV} numberOfLines={2}>{v}</Text></View>;
}
function SumCell({ label, v, c, small }) {
  return <View style={styles.sumCell}><Text style={[styles.sumVal, c && { color: c }, small && { fontSize: 12.5 }]} numberOfLines={1}>{v}</Text><Text style={styles.sumLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  pageTitle: { color: colors.text, fontSize: 22, fontWeight: '900', marginBottom: spacing.md },

  weekNav: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.sm, ...shadow.card },
  arw: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.darkCardSoft },
  arwOff: { opacity: 0.3 },
  arwTxt: { color: '#fff', fontSize: 24, fontWeight: '900', lineHeight: 26 },
  weekMid: { flex: 1, alignItems: 'center' },
  weekName: { color: '#fff', fontSize: 17, fontWeight: '900' },
  weekSeason: { color: '#9DB0CD', fontSize: 11, fontWeight: '700', marginTop: 2 },

  controls: { marginTop: spacing.md, marginBottom: spacing.sm, alignSelf: 'flex-start' },
  loadWk: { padding: 24, alignItems: 'center', gap: 8 },
  muted: { color: colors.textMuted, fontSize: 12.5, fontWeight: '600' },

  rankedCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.warning, padding: spacing.md, marginTop: spacing.sm, ...shadow.soft },
  rankedKicker: { color: '#7a4a00', fontSize: 10.5, fontWeight: '900', letterSpacing: 0.5 },
  rankedBig: { color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 4 },
  rankedSub: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  recapLink: { backgroundColor: '#132244', borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', marginBottom: spacing.md },
  recapLinkTxt: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
  othersWrap: { marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  othersHead: { color: colors.textMuted, fontSize: 11, fontWeight: '900', marginBottom: 6, letterSpacing: 0.3 },
  otherRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.cardAlt, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 5 },
  otherName: { color: colors.text, fontSize: 12.5, fontWeight: '800' },
  otherTag: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  otherMeta: { color: colors.textSoft, fontSize: 12, fontWeight: '800' },
  couponCard: { backgroundColor: colors.infoSoft, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.info, padding: spacing.md, marginTop: spacing.sm },
  couponTitle: { color: colors.info, fontSize: 14.5, fontWeight: '900' },
  couponBody: { color: colors.textSoft, fontSize: 12, fontWeight: '600', marginTop: 5, lineHeight: 17 },
  couponBtn: { alignSelf: 'flex-start', marginTop: 10, backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.md },
  couponBtnTxt: { color: '#fff', fontSize: 12.5, fontWeight: '800' },

  wkCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.sm, ...shadow.soft },
  wkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  // Etiket kısalabilir, değer tek satır: uzun durum metinleri ('Maç sonuçları
  // tamamlandı · İkramiye bekleniyor') satırı üç satıra çıkarıyordu.
  wkK: { color: colors.textMuted, fontSize: 12.5, fontWeight: '700', flexShrink: 1 },
  wkV: { flex: 1, textAlign: 'right', color: colors.text, fontSize: 12.5, fontWeight: '800', marginLeft: 8 },
  wkVMuted: { color: colors.textMuted, fontSize: 12.5, fontWeight: '700', fontStyle: 'italic' },

  mRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 11, marginTop: spacing.sm },
  mNo: { color: colors.textMuted, fontSize: 12, fontWeight: '900', width: 18, textAlign: 'center' },
  mMid: { flex: 1 },
  mTeams: { color: colors.text, fontSize: 12.5, fontWeight: '700' },
  mDate: { color: colors.textMuted, fontSize: 10.5, fontWeight: '700', marginTop: 2 },
  // Sağ sütun sınırsızdı ve orta sütunu (takım adları) eziyordu.
  mRight: { alignItems: 'flex-end', maxWidth: '52%' },
  mResTxt: { color: colors.textSoft, fontSize: 12, fontWeight: '700' },
  mWait: { color: colors.warning, fontSize: 11, fontWeight: '800' },
  mSys: { color: colors.textMuted, fontSize: 10.5, fontWeight: '700', marginTop: 2 },

  techRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  techK: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  techV: { flex: 1, color: colors.text, fontSize: 12, fontWeight: '800', textAlign: 'right' },

  sumGrid: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  sumCell: { flex: 1, backgroundColor: colors.surfaceSoft, borderRadius: radius.md, padding: 10, alignItems: 'center' },
  sumVal: { color: colors.text, fontSize: 16, fontWeight: '900' },
  sumLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700', marginTop: 3, textAlign: 'center' },
  userNote: { color: colors.textMuted, fontSize: 11, fontWeight: '600', marginTop: 12, lineHeight: 16 },
});
