// KUPONLARIM — bülten gibi hafta hafta gezilir. Seçili haftanın kuponları
// (dereceli/derecesiz, kolon/tutar, final versiyon, durum). Yeni kupon yalnız
// güncel + kilitlenmemiş bültende. Başarı YALNIZ resmi sonuçla kesinleşir.
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { colors, spacing, radius, shadow } from '../theme';
import { isLockedNow, MAX_COUPONS_PER_WEEK } from '../couponConfig';
import { getWeekCoupons, finalVersion, setRanked, deleteCoupon, syncFromServer } from '../couponStore';
import LoadingState from '../components/LoadingState';

const fmtTL = (n) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} TL`;
const officialResolved = (m) => !!(m && m.result && m.score);

export default function CouponsScreen({ navigation }) {
  const [rounds, setRounds] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [hist, setHist] = useState(null);
  const [histLoading, setHistLoading] = useState(false);
  const [tick, setTick] = useState(0); // store değişince yeniden oku
  const [loading, setLoading] = useState(true);

  const boot = useCallback(async () => {
    try {
      const r = await api.rounds();
      setRounds(r);
      setSelectedId((prev) => prev ?? r?.currentRoundId ?? null);
    } catch {}
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => {
    let alive = true;
    boot();
    setTick((t) => t + 1);
    syncFromServer().then((r) => { if (alive && r?.synced) setTick((t) => t + 1); }); // sunucudan kalıcı kuponlar
    return () => { alive = false; };
  }, [boot]));

  useEffect(() => {
    if (selectedId == null) return;
    let alive = true;
    setHistLoading(true);
    api.history(selectedId).then((h) => { if (alive) setHist({ ...h, roundId: selectedId }); }).catch(() => { if (alive) setHist(null); }).finally(() => { if (alive) setHistLoading(false); });
    return () => { alive = false; };
  }, [selectedId]);

  const all = rounds?.rounds || [];
  const currentRoundId = rounds?.currentRoundId ?? null;
  const curIdx = all.findIndex((r) => r.id === currentRoundId);
  const navRounds = curIdx >= 0 ? all.slice(0, curIdx + 1) : all;
  const selIdx = navRounds.findIndex((r) => r.id === selectedId);
  const selMeta = navRounds[selIdx] || null;
  const canPrev = selIdx > 0, canNext = selIdx >= 0 && selIdx < navRounds.length - 1;

  const coupons = selectedId != null ? getWeekCoupons(selectedId) : []; // tick ile tazelenir
  const resultMap = new Map((hist?.matches || []).filter(officialResolved).map((m) => [m.no, m.result]));
  const lockAt = coupons[0]?.lockedAt ?? null;
  const locked = isLockedNow(lockAt);
  const isCurrent = selectedId === currentRoundId;
  const confirmedBulletin = isCurrent && hist; // güncel + veri var

  const correctOf = (coupon) => {
    const v = finalVersion(coupon); if (!v) return null;
    let hit = 0, resolved = 0;
    for (const sc of v.selections) { const r = resultMap.get(sc.no); if (r) { resolved += 1; if (sc.selectedOutcomes.includes(r)) hit += 1; } }
    return { hit, resolved, total: v.selections.length };
  };
  const statusText = (coupon) => {
    if (!locked && isCurrent) return 'Açık · düzenlenebilir';
    if (resultMap.size === 0) return 'Bülten kilitlendi · sonuçlar bekleniyor';
    if (resultMap.size < 15) return `Resmi sonuçlar bekleniyor · ${resultMap.size}/15`;
    return 'Sonuçlar tamamlandı';
  };

  const makeRanked = (c) => {
    const res = setRanked(selectedId, c.id);
    if (res.error === 'locked') { Alert.alert('Değiştirilemez', 'Bülten kilitlendiği için dereceli kupon değiştirilemez.'); return; }
    setTick((t) => t + 1);
  };
  const removeCoupon = (c) => Alert.alert('Kupon sil', `Kupon ${c.couponNo} silinsin mi?`, [{ text: 'Vazgeç' }, { text: 'Sil', style: 'destructive', onPress: () => { deleteCoupon(c.id); setTick((t) => t + 1); } }]);

  if (loading && !rounds) return <LoadingState message="Kuponların yükleniyor…" />;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.pageTitle}>Kuponlarım</Text>
        <View style={s.weekNav}>
          <TouchableOpacity onPress={() => canPrev && setSelectedId(navRounds[selIdx - 1].id)} disabled={!canPrev} style={[s.arw, !canPrev && s.arwOff]}><Text style={s.arwTxt}>‹</Text></TouchableOpacity>
          <View style={s.weekMid}><Text style={s.weekName}>{selMeta?.name || '—'}</Text><Text style={s.weekSeason}>{selMeta?.year || ''} Sezonu</Text></View>
          <TouchableOpacity onPress={() => canNext && setSelectedId(navRounds[selIdx + 1].id)} disabled={!canNext} style={[s.arw, !canNext && s.arwOff]}><Text style={s.arwTxt}>›</Text></TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.body}>
        {histLoading && !hist ? <View style={s.load}><ActivityIndicator color={colors.primary} /></View> : null}

        {coupons.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>🎟️</Text>
            <Text style={s.emptyTitle}>Bu hafta kupon oluşturmadın</Text>
            {isCurrent && !locked ? (
              <TouchableOpacity style={s.primaryBtn} onPress={() => navigation.navigate('CouponBuilder', { roundId: selectedId })}><Text style={s.primaryTxt}>Kupon Oluştur</Text></TouchableOpacity>
            ) : (
              <Text style={s.emptyBody}>{locked ? 'Bu hafta kilitlendi.' : 'Bu geçmiş haftaya kupon oluşturamazsın.'} Bültenini görebilirsin.</Text>
            )}
          </View>
        ) : (
          <>
            {coupons.map((c) => {
              const v = finalVersion(c);
              const cor = correctOf(c);
              return (
                <View key={c.id} style={[s.card, c.isRankedCoupon && s.cardRanked]}>
                  <View style={s.cTop}>
                    <Text style={s.cNo}>Kupon {c.couponNo}</Text>
                    <View style={[s.badge, c.isRankedCoupon ? s.badgeRanked : s.badgePlain]}><Text style={[s.badgeTxt, c.isRankedCoupon && { color: '#fff' }]}>{c.isRankedCoupon ? '⭐ Dereceli' : 'Derecesiz'}</Text></View>
                  </View>
                  <Text style={s.cLine}>Kolon: <Text style={s.cStrong}>{v?.columnCount}</Text> · Tutar: <Text style={s.cStrong}>{fmtTL(v?.totalAmount || 0)}</Text> · Final: V{v?.versionNo}</Text>
                  {cor && cor.resolved > 0 ? (
                    <Text style={s.cResult}>Doğru: <Text style={{ color: colors.success, fontWeight: '900' }}>{cor.hit}</Text>/{cor.resolved} geldi{cor.resolved < 15 ? ` · ${cor.resolved}/15 resmi` : ''}</Text>
                  ) : null}
                  <Text style={s.cStatus}>{statusText(c)}</Text>
                  <View style={s.cBtns}>
                    {isCurrent && !locked ? <TouchableOpacity style={s.smBtn} onPress={() => navigation.navigate('CouponBuilder', { roundId: selectedId, couponId: c.id })}><Text style={s.smTxt}>Düzenle</Text></TouchableOpacity> : null}
                    {isCurrent && !locked && !c.isRankedCoupon ? <TouchableOpacity style={[s.smBtn, s.smBtnAccent]} onPress={() => makeRanked(c)}><Text style={[s.smTxt, { color: '#fff' }]}>Dereceli Yap</Text></TouchableOpacity> : null}
                    {isCurrent && !locked ? <TouchableOpacity style={s.smBtn} onPress={() => removeCoupon(c)}><Text style={s.smTxt}>Sil</Text></TouchableOpacity> : null}
                  </View>
                </View>
              );
            })}

            {isCurrent && !locked ? (
              coupons.length >= MAX_COUPONS_PER_WEEK ? (
                <View style={s.maxBar}><Text style={s.maxTxt}>Bu hafta için maksimum {MAX_COUPONS_PER_WEEK} kupona ulaştın.</Text></View>
              ) : (
                <TouchableOpacity style={s.newBtn} onPress={() => navigation.navigate('CouponBuilder', { roundId: selectedId })}><Text style={s.newTxt}>+ Yeni Kupon Oluştur ({coupons.length}/{MAX_COUPONS_PER_WEEK})</Text></TouchableOpacity>
              )
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.md, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  pageTitle: { color: colors.text, fontSize: 20, fontWeight: '900', marginBottom: spacing.sm },
  weekNav: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.lg, padding: 6 },
  arw: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.darkCardSoft }, arwOff: { opacity: 0.3 },
  arwTxt: { color: '#fff', fontSize: 22, fontWeight: '900', lineHeight: 24 },
  weekMid: { flex: 1, alignItems: 'center' }, weekName: { color: '#fff', fontSize: 16, fontWeight: '900' }, weekSeason: { color: '#9DB0CD', fontSize: 11, fontWeight: '700' },
  body: { padding: spacing.md, paddingBottom: spacing.xxxl }, load: { padding: 30, alignItems: 'center' },

  empty: { alignItems: 'center', padding: 30, marginTop: 20 },
  emptyIcon: { fontSize: 44 }, emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 12 }, emptyBody: { color: colors.textMuted, fontSize: 12.5, textAlign: 'center', marginTop: 8, lineHeight: 18 },
  primaryBtn: { marginTop: 16, backgroundColor: colors.primary, paddingHorizontal: 22, paddingVertical: 12, borderRadius: radius.md }, primaryTxt: { color: '#fff', fontSize: 13.5, fontWeight: '800' },

  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm, ...shadow.soft },
  cardRanked: { borderColor: colors.warning, borderWidth: 1.5 },
  cTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cNo: { color: colors.text, fontSize: 15, fontWeight: '900' },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.sm },
  badgeRanked: { backgroundColor: colors.warning }, badgePlain: { backgroundColor: colors.cardAlt },
  badgeTxt: { fontSize: 10.5, fontWeight: '900', color: colors.textSoft },
  cLine: { color: colors.textSoft, fontSize: 12, fontWeight: '700', marginTop: 6 }, cStrong: { color: colors.text, fontWeight: '900' },
  cResult: { color: colors.text, fontSize: 12.5, fontWeight: '800', marginTop: 4 },
  cStatus: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 4 },
  cBtns: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  smBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.sm, backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border },
  smBtnAccent: { backgroundColor: colors.warning, borderColor: colors.warning },
  smTxt: { color: colors.textSoft, fontSize: 11.5, fontWeight: '800' },

  newBtn: { backgroundColor: colors.success, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  newTxt: { color: '#fff', fontSize: 13.5, fontWeight: '900' },
  maxBar: { backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: colors.warning, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  maxTxt: { color: '#7a4a00', fontSize: 12.5, fontWeight: '800', textAlign: 'center' },
});
