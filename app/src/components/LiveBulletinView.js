// PAYLAŞILAN CANLI YAPI — üst özet kutuları + filtreler + sıralama + sade kartlar
// + ayarlar. Hem "Canlı" hem "Bülten" ekranında AYNI yapı için kullanılır.
// Veri çekme/teyit kilidi/polling ÜST ekranda; bu bileşen sadece görünüm+etkileşim.
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, FlatList, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme';
import { getPref, setPref } from '../prefs';
import { deriveStatus, resultFromScore, pickHits, summaryCounts } from '../liveLogic';
import LiveMatchCard from './LiveMatchCard';
import ScoreLegend from './ScoreLegend';

function sortList(list, sort, boost) {
  const arr = [...list];
  const byNo = (a, b) => a.no - b.no;
  if (boost) {
    return arr.sort((a, b) => {
      const an = deriveStatus(a) === 'notStarted' ? 0 : 1;
      const bn = deriveStatus(b) === 'notStarted' ? 0 : 1;
      return an - bn || byNo(a, b);
    });
  }
  if (sort === 'liveTop') {
    const w = (m) => { const st = deriveStatus(m); return st === 'live' ? 0 : st === 'awaiting' || st === 'suspended' ? 1 : st === 'finished' ? 3 : 2; };
    return arr.sort((a, b) => w(a) - w(b) || byNo(a, b));
  }
  if (sort === 'doneBottom') {
    const w = (m) => (deriveStatus(m) === 'finished' ? 1 : 0);
    return arr.sort((a, b) => w(a) - w(b) || byNo(a, b));
  }
  return arr.sort(byNo);
}

const FILTERS = [
  { key: 'all', label: 'Tümü' },
  { key: 'live', label: 'Canlı' },
  { key: 'risk', label: 'Riskte' },
  { key: 'coupon', label: 'Kuponum' },
  { key: 'done', label: 'Biten' },
];
export default function LiveBulletinView({ matches = [], onCardPress, onRefresh, subtitle, userPicks = {}, hasCoupon = false }) {
  const USER_PICKS = userPicks;
  const HAS_COUPON = hasCoupon;
  const [filter, setFilter] = useState(getPref('rememberFilter') ? getPref('liveLastFilter') : 'all');
  const [riskSubs, setRiskSubs] = useState({ coupon: true, system: true });
  const [sort, setSort] = useState(getPref('liveSort'));
  const [anim, setAnim] = useState(getPref('liveAnim'));
  const [remember, setRemember] = useState(getPref('rememberFilter'));
  const [showSettings, setShowSettings] = useState(false);
  const [startedBoost, setStartedBoost] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };
  useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);

  const pickFilter = (key) => {
    if (key === 'coupon' && !HAS_COUPON) { showToast('Henüz kupon oluşturmadın.'); return; }
    setStartedBoost(false);
    if (key === 'risk') setRiskSubs({ coupon: true, system: true });
    if (remember) setPref('liveLastFilter', key);
    setFilter(key);
  };
  const onSummary = (key) => {
    if (key === 'live') pickFilter('live');
    else if (key === 'finished') pickFilter('done');
    else if (key === 'notStarted') { setStartedBoost(true); setFilter('all'); }
    else if (key === 'couponRisk') { setStartedBoost(false); setRiskSubs({ coupon: true, system: false }); setFilter('risk'); }
    else if (key === 'systemRisk') { setStartedBoost(false); setRiskSubs({ coupon: false, system: true }); setFilter('risk'); }
  };

  const counts = useMemo(() => summaryCounts(matches, USER_PICKS), [matches, USER_PICKS]);
  const filtered = useMemo(() => {
    let list = matches;
    if (filter === 'live') list = list.filter((m) => deriveStatus(m) === 'live');
    else if (filter === 'done') list = list.filter((m) => deriveStatus(m) === 'finished');
    else if (filter === 'coupon') list = HAS_COUPON ? list.filter((m) => USER_PICKS[m.no]) : [];
    else if (filter === 'risk') {
      list = list.filter((m) => {
        if (deriveStatus(m) !== 'live') return false;
        const actual = resultFromScore(m.score);
        const sysRisk = riskSubs.system && pickHits(m.prediction?.symbol, actual) === false;
        const up = USER_PICKS[m.no];
        const coupRisk = riskSubs.coupon && up && pickHits(up, actual) === false;
        return sysRisk || coupRisk;
      });
    }
    return sortList(list, sort, startedBoost && filter === 'all');
  }, [matches, filter, riskSubs, sort, startedBoost, USER_PICKS, HAS_COUPON]);

  const SUMMARY = [
    { key: 'live', label: 'Canlı', n: counts.live, color: colors.accent },
    { key: 'notStarted', label: 'Başlamadı', n: counts.notStarted, color: colors.muted },
    { key: 'finished', label: 'Biten', n: counts.finished, color: colors.success },
    { key: 'couponRisk', label: 'Kupon Riskte', n: counts.couponRisk, color: colors.warning },
    { key: 'systemRisk', label: 'Sistem Riskte', n: counts.systemRisk, color: colors.danger },
  ];

  const Head = (
    <View>
      <View style={s.barRow}>
        {subtitle ? <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text> : <View style={{ flex: 1 }} />}
        <TouchableOpacity onPress={() => setShowSettings((v) => !v)} style={s.gear} hitSlop={8}><Text style={s.gearTxt}>⚙</Text></TouchableOpacity>
      </View>

      {showSettings && (
        <View style={s.settings}>
          <View style={s.setRow}>
            <Text style={s.setLabel}>Filtre seçimini hatırla</Text>
            <TouchableOpacity onPress={() => { const v = !remember; setRemember(v); setPref('rememberFilter', v); }} style={[s.toggle, remember && s.toggleOn]}>
              <Text style={[s.toggleTxt, remember && s.toggleTxtOn]}>{remember ? 'Açık' : 'Kapalı'}</Text>
            </TouchableOpacity>
          </View>
          <View style={s.setRow}>
            <Text style={s.setLabel}>Animasyonlar</Text>
            <View style={{ flexDirection: 'row', gap: 5 }}>
              {[{ k: 'on', l: 'Açık' }, { k: 'important', l: 'Önemli' }, { k: 'off', l: 'Kapalı' }].map((o) => (
                <TouchableOpacity key={o.k} onPress={() => { setAnim(o.k); setPref('liveAnim', o.k); }} style={[s.animChip, anim === o.k && s.animChipOn]}>
                  <Text style={[s.animTxt, anim === o.k && s.animTxtOn]}>{o.l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      <ScoreLegend />

      {/* Üst özet kutuları — yatay kaydırmalı */}
      <View style={s.summaryWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.summaryRow}>
          {SUMMARY.map((b) => (
            <TouchableOpacity key={b.key} style={s.sumBox} activeOpacity={0.8} onPress={() => onSummary(b.key)}>
              <Text style={[s.sumN, { color: b.color }]}>{b.n}</Text>
              <Text style={s.sumLabel} numberOfLines={1}>{b.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Filtreler */}
      <View style={s.filterRow}>
        {FILTERS.map((f) => {
          const on = filter === f.key && !(startedBoost && f.key === 'all');
          return (
            <TouchableOpacity key={f.key} style={[s.chip, on && s.chipOn]} onPress={() => pickFilter(f.key)}>
              <Text style={[s.chipTxt, on && s.chipTxtOn]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {filter === 'risk' && (
        <View style={s.subRow}>
          {[{ k: 'coupon', l: 'Kupon Riskte' }, { k: 'system', l: 'Sistem Riskte' }].map((sf) => (
            <TouchableOpacity key={sf.k} style={[s.subChip, riskSubs[sf.k] && s.subChipOn]} onPress={() => setRiskSubs((r) => ({ ...r, [sf.k]: !r[sf.k] }))}>
              <Text style={[s.subTxt, riskSubs[sf.k] && s.subTxtOn]}>{riskSubs[sf.k] ? '✓ ' : ''}{sf.l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={filtered}
        keyExtractor={(m) => String(m.no)}
        renderItem={({ item }) => (
          <LiveMatchCard match={item} userPick={USER_PICKS[item.no] || null} anim={anim} onPress={() => onCardPress && onCardPress(item.no)} onRefresh={onRefresh} />
        )}
        ListHeaderComponent={Head}
        contentContainerStyle={s.listPad}
        ListEmptyComponent={<Text style={s.empty}>{filter === 'coupon' ? 'Bu bülten için kuponun yok.' : 'Bu filtrede maç yok.'}</Text>}
      />
      {toast && <View style={s.toast}><Text style={s.toastTxt}>{toast}</Text></View>}
    </View>
  );
}

const s = StyleSheet.create({
  barRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  subtitle: { flex: 1, color: colors.textMuted, fontSize: 11.5, fontWeight: '700' },
  gear: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border },
  gearTxt: { fontSize: 15 },
  settings: { marginHorizontal: spacing.md, marginTop: spacing.sm, backgroundColor: colors.surfaceSoft, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, gap: 8 },
  setRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  setLabel: { color: colors.textSoft, fontSize: 12.5, fontWeight: '700' },
  toggle: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.sm, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  toggleOn: { backgroundColor: colors.successSoft, borderColor: colors.success },
  toggleTxt: { color: colors.textMuted, fontSize: 11.5, fontWeight: '800' },
  toggleTxtOn: { color: colors.success },
  animChip: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.sm, backgroundColor: colors.cardAlt },
  animChipOn: { backgroundColor: colors.primary },
  animTxt: { color: colors.textSoft, fontSize: 11, fontWeight: '800' },
  animTxtOn: { color: colors.white },

  summaryWrap: { marginTop: spacing.sm },
  summaryRow: { paddingHorizontal: spacing.md, paddingVertical: 2, gap: 8 },
  sumBox: { minWidth: 88, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center' },
  sumN: { fontSize: 19, fontWeight: '900' },
  sumLabel: { color: colors.textSoft, fontSize: 10.5, fontWeight: '800', marginTop: 1 },

  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipTxt: { color: colors.textSoft, fontSize: 12.5, fontWeight: '800' },
  chipTxtOn: { color: colors.white },

  subRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  subChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  subChipOn: { borderColor: colors.warning, backgroundColor: colors.warningSoft },
  subTxt: { color: colors.textMuted, fontSize: 11.5, fontWeight: '800' },
  subTxtOn: { color: '#7a4a00' },

  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm, flexWrap: 'wrap' },
  sortLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  sortChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.sm, backgroundColor: colors.cardAlt },
  sortChipOn: { backgroundColor: colors.primary },
  sortTxt: { color: colors.textSoft, fontSize: 11, fontWeight: '800' },
  sortTxtOn: { color: colors.white },

  listPad: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  empty: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 30 },
  toast: { position: 'absolute', bottom: 24, alignSelf: 'center', backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill },
  toastTxt: { color: colors.white, fontSize: 12.5, fontWeight: '800' },
});
