// KUPON OLUŞTUR — üst SABİT özet (kolon/bedel/tutar/limit + sistem uygula),
// analiz bilgili maç satırları (bülten içi seçim), alt SABİT kaydet barı,
// limit aşımında yukarıdan kayan TOAST. Seçimler paylaşılan TASLAK'ta (maç
// detayından da işlenebilir). Bahis/ödeme YOK. Resmi limit sert, bütçe uyarı.
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { colors, spacing, radius, shadow } from '../theme';
import { matchDate } from '../utils';
import { getPref, setPref } from '../prefs';
import { analyzeUserMatch } from '../userMatchEngine';
import { columnCount, couponAmount, lockAtOf, isLockedNow, COUPON_COLUMN_PRICE, COUPON_MAX_COLUMNS, COUPON_MAX_AMOUNT, BUDGET_PRESETS, OUTCOMES } from '../couponConfig';
import { createCoupon, addVersion, getCoupon, finalVersion, getDraft, setDraftPick, setDraftAll, clearDraft } from '../couponStore';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

const fmtTL = (n) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} TL`;

// Sistemin seçimi = KULLANICI ANALİZİ Ana Seçim'i (1X / X2 / 1X2 ...).
// Geniş = tam öneri; Tekli = öneri içinden en olası tek sonuç.
function systemPickFor(m, mode) {
  const main = analyzeUserMatch(m)?.verdict?.main || '';
  const set = OUTCOMES.filter((o) => main.includes(o));
  if (!set.length) return [];
  if (mode === 'wide') return set;
  const p = m.analysis?.probabilities;
  if (p) {
    const ranked = set.map((o) => [o, Number(p[o] ?? 0)]).sort((a, b) => b[1] - a[1]);
    return [ranked[0][0]];
  }
  return [set[0]];
}

export default function CouponBuilderScreen({ navigation, route }) {
  const editId = route.params?.couponId || null;
  const focusNo = route.params?.focusNo ?? null;   // gelinen maç → oraya kaydır
  const scrollRef = useRef(null);
  const rowY = useRef({});
  const insets = useSafeAreaInsets();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState({});
  const [place, setPlace] = useState(getPref('couponPlace'));
  const [preview, setPreview] = useState(getPref('couponPreview'));
  const [sysMode, setSysMode] = useState(getPref('couponSysMode'));
  const [budget, setBudget] = useState(getPref('couponBudget'));
  const [budgetInput, setBudgetInput] = useState(budget ? String(budget) : '');
  const [showSettings, setShowSettings] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [toast, setToast] = useState(null);
  const [toastKind, setToastKind] = useState('warn'); // 'warn' | 'success'
  const toastY = useRef(new Animated.Value(-140)).current;
  const toastTimer = useRef(null);

  const load = useCallback(async () => {
    try { setError(null); setData(await api.bulletin()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const matches = data && !data.pending ? (data.matches || []) : [];
  const roundId = data?.roundId ?? null;
  const lockAt = useMemo(() => lockAtOf(matches), [matches]);
  const locked = isLockedNow(lockAt);

  // Düzenlemede o kuponun seçimleri gelir; yeni kuponda kullanıcının maç
  // detayında yaptığı seçimler (paylaşılan TASLAK) taşınır. Otomatik SİSTEM
  // doldurma yok — taslak yalnız kullanıcının kendi seçtiklerini içerir.
  useEffect(() => {
    if (roundId == null) return;
    if (editId) {
      const v = finalVersion(getCoupon(editId));
      const picks = v ? Object.fromEntries(v.selections.map((s) => [s.no, s.selectedOutcomes])) : {};
      setSel(picks); setDraftAll(roundId, picks);
    } else {
      setSel(getDraft(roundId).picks || {});   // maç detayındaki seçimleri taşı
    }
  }, [roundId, editId]);

  const showToast = (msg, kind = 'warn', duration = 3000) => {
    setToast(msg); setToastKind(kind);
    Animated.spring(toastY, { toValue: insets.top + 8, useNativeDriver: true, bounciness: 6 }).start();
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(hideToast, duration);
  };
  const hideToast = () => Animated.timing(toastY, { toValue: -140, duration: 250, useNativeDriver: true }).start(() => setToast(null));
  useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);

  const commit = (picks) => { setSel(picks); if (roundId != null && !editId) setDraftPickAll(picks); };
  const setDraftPickAll = (picks) => setDraftAll(roundId, picks);

  // Gelinen maç aşağıdaysa sayfayı oraya kaydır (satır Y'leri onLayout'tan).
  useEffect(() => {
    if (focusNo == null || !matches.length) return;
    const t = setTimeout(() => {
      const y = rowY.current[focusNo];
      if (y != null && scrollRef.current) scrollRef.current.scrollTo({ y: Math.max(0, y - 8), animated: true });
    }, 400);
    return () => clearTimeout(t);
  }, [focusNo, matches.length]);

  const toggle = (no, o) => {
    if (locked) return;
    const cur = new Set(sel[no] || []);
    cur.has(o) ? cur.delete(o) : cur.add(o);
    const arr = OUTCOMES.filter((x) => cur.has(x));
    const next = { ...sel }; if (arr.length) next[no] = arr; else delete next[no];
    commit(next);
  };
  const applySystemOne = (m) => { if (locked) return; const next = { ...sel, [m.no]: systemPickFor(m, sysMode) }; commit(next); };
  const applySystemAll = () => { if (locked) return; const next = {}; for (const m of matches) next[m.no] = systemPickFor(m, sysMode); commit(next); };
  const clearAll = () => { if (locked) return; commit({}); };

  const selections = useMemo(() => matches.map((m) => ({
    no: m.no, home: m.home.mediumName || m.home.name, away: m.away.mediumName || m.away.name,
    selectedOutcomes: sel[m.no] || [], systemPrediction: m.prediction?.symbol || null,
  })), [matches, sel]);
  const filledCount = selections.filter((s) => s.selectedOutcomes.length > 0).length;
  const allFilled = matches.length === 15 && filledCount === 15;
  const cols = allFilled ? columnCount(selections) : selections.reduce((n, s) => n * Math.max(1, s.selectedOutcomes.length), 1);
  const amount = couponAmount(cols);
  const overOfficial = cols > COUPON_MAX_COLUMNS || amount > COUPON_MAX_AMOUNT;
  const overBudget = budget != null && amount > budget;
  const canSave = allFilled && !overOfficial && !locked;

  // Limit aşımında toast (yeni seçimlerde tekrar).
  useEffect(() => { if (overOfficial) showToast(`Kolon sınırı aşıldı (${cols}/${COUPON_MAX_COLUMNS}). Bazı çift/üçlü seçimleri azalt.`); }, [overOfficial, cols]); // eslint-disable-line

  const doSave = () => {
    if (!canSave) return;
    const versionData = { selections, userBudgetLimit: budget, isBudgetExceeded: overBudget, isOfficialLimitExceeded: overOfficial, appliedSystemMode: sysMode };
    const res = editId ? addVersion(editId, versionData) : createCoupon({ season: data.year, weekNumber: data.round, roundId, lockedAt: lockAt }, versionData);
    setShowPreview(false);
    if (res.error === 'max') { showToast('Bu hafta için en fazla 10 kupon oluşturabilirsin.', 'warn'); return; }
    if (res.error) { showToast('Kupon kilitli veya bulunamadı — kaydedilemedi.', 'warn'); return; }
    clearDraft(roundId);
    const c = res.coupon;
    // Web'de RN Alert görünmediği için ekran-içi toast + kısa süre sonra Kuponlarım'a geç.
    const msg = editId
      ? `Kupon ${c.couponNo} güncellendi ✅ · Kolon ${cols} · ${fmtTL(amount)}`
      : c.isRankedCoupon
        ? `İlk kupon DERECELİ olarak kaydedildi ⭐ · Kolon ${cols} · ${fmtTL(amount)}`
        : `Kupon ${c.couponNo} kaydedildi ✅ · Kolon ${cols} · ${fmtTL(amount)}`;
    showToast(msg, 'success', 2600);
    setTimeout(() => { navigation.replace('Coupons', { roundId }); }, 1200);
  };
  const onSavePress = () => { if (preview) setShowPreview(true); else doSave(); };

  if (loading && !data) return <LoadingState message="Bülten yükleniyor…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data || data.pending || data.verification?.status !== 'confirmed') {
    return <View style={s.center}><Text style={s.lockEmoji}>🕐</Text><Text style={s.lockTitle}>Kupon oluşturulamaz</Text><Text style={s.lockBody}>Yalnız resmi olarak teyit edilmiş güncel bülten için kupon oluşturulabilir.</Text></View>;
  }

  return (
    <View style={s.container}>
      {/* ÜST SABİT */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.hTitle}>Kupon Oluştur</Text>
          <Text style={s.hSub}>{data.round} · {data.year} · kilit {lockAt ? new Date(lockAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—'}</Text>
        </View>
        <TouchableOpacity onPress={() => setShowSettings((v) => !v)} style={s.gear}><Text style={s.gearTxt}>⚙</Text></TouchableOpacity>
      </View>

      {showSettings && (
        <View style={s.settings}>
          <SetSeg label="Kolon/tutar yeri" opts={[['top', 'Üstte'], ['bottom', 'Altta'], ['both', 'İkisi']]} val={place} on={(v) => { setPlace(v); setPref('couponPlace', v); }} />
          <SetSeg label="Önizleme" opts={[['on', 'Açık'], ['off', 'Kapalı']]} val={preview ? 'on' : 'off'} on={(v) => { const b = v === 'on'; setPreview(b); setPref('couponPreview', b); }} />
          <SetSeg label="Sistem uygula" opts={[['single', 'Tekli'], ['wide', 'Geniş']]} val={sysMode} on={(v) => { setSysMode(v); setPref('couponSysMode', v); }} />
          <View style={s.budgetRow}>
            <Text style={s.setLabel}>Bütçe limiti (TL)</Text>
            <View style={s.budgetChips}>
              {BUDGET_PRESETS.map((b) => (<TouchableOpacity key={b} onPress={() => { setBudget(b); setBudgetInput(String(b)); setPref('couponBudget', b); }} style={[s.bChip, budget === b && s.bChipOn]}><Text style={[s.bChipTxt, budget === b && s.bChipTxtOn]}>{b >= 1000 ? `${b / 1000}b` : b}</Text></TouchableOpacity>))}
              <TextInput value={budgetInput} onChangeText={(t) => { setBudgetInput(t); const n = Number(t) || null; setBudget(n); setPref('couponBudget', n); }} keyboardType="numeric" placeholder="Manuel" style={s.bInput} placeholderTextColor={colors.textMuted} />
            </View>
          </View>
        </View>
      )}

      {(place === 'top' || place === 'both') && (
        <View style={s.topSum}>
          <View style={s.sumGrid}>
            <SumCell label="Kolon" v={`${cols}/${COUPON_MAX_COLUMNS}`} warn={overOfficial} />
            <SumCell label="Bedel" v={`${COUPON_COLUMN_PRICE} TL`} />
            <SumCell label="Tutar" v={fmtTL(amount)} warn={overOfficial || overBudget} />
            <SumCell label="Limit" v={fmtTL(COUPON_MAX_AMOUNT)} />
          </View>
          <View style={s.applyRow}>
            <TouchableOpacity style={[s.applyAll, { flex: 1 }]} onPress={applySystemAll} disabled={locked}>
              <Text style={s.applyAllTxt}>⚡ Sistem tahminlerini uygula ({sysMode === 'wide' ? 'Geniş' : 'Tekli'})</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.clearAll} onPress={clearAll} disabled={locked || filledCount === 0}>
              <Text style={s.clearAllTxt}>Tümünü Temizle</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {locked && <View style={s.lockedBar}><Text style={s.lockedTxt}>🔒 Bülten kilitlendi — bu kupon düzenlenemez.</Text></View>}

      {/* MAÇ LİSTESİ (analiz bilgili) */}
      <ScrollView ref={scrollRef} contentContainerStyle={[s.body, { paddingBottom: 90 + insets.bottom }]}>
        {matches.map((m) => {
          const cur = sel[m.no] || [];
          const a = m.analysis || {};
          return (
            <View key={m.no} style={[s.mRow, focusNo === m.no && s.mRowFocus]} onLayout={(e) => { rowY.current[m.no] = e.nativeEvent.layout.y; }}>
              <View style={s.mTop}>
                <Text style={s.mNo}>{m.no}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.mTeams} numberOfLines={1}>{m.home.mediumName || m.home.name} - {m.away.mediumName || m.away.name}</Text>
                  <Text style={s.mAnalysis} numberOfLines={1}>
                    {m.date ? `${matchDate(m.date).time} · ` : ''}Sistem <Text style={s.mSysStrong}>{m.prediction?.symbol || '—'}</Text>
                    {m.prediction?.label ? ` · ${m.prediction.label}` : ''}{a.surpriseScore != null ? ` · Sürpriz ${a.surpriseScore}` : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('MatchDetail', { no: m.no })} style={s.detailBtn}><Text style={s.detailTxt}>Analiz</Text></TouchableOpacity>
              </View>
              <View style={s.mPick}>
                <View style={s.otoggles}>
                  {OUTCOMES.map((o) => { const on = cur.includes(o); return (
                    <TouchableOpacity key={o} onPress={() => toggle(m.no, o)} activeOpacity={0.85} style={[s.oBtn, on && s.oBtnOn]} disabled={locked}>
                      {on ? <Text style={s.oCheck}>✓</Text> : null}
                      <Text style={[s.oTxt, on && s.oTxtOn]}>{o}</Text>
                    </TouchableOpacity>
                  ); })}
                </View>
                <TouchableOpacity onPress={() => applySystemOne(m)} style={s.fromSys} disabled={locked}><Text style={s.fromSysTxt}>Sistemden al</Text></TouchableOpacity>
              </View>
            </View>
          );
        })}
        {!overOfficial && overBudget && (
          <View style={s.warnSoft}><Text style={s.warnSoftTitle}>Bütçe limitin aşıldı</Text><Text style={s.warnSoftBody}>Bütçen: {fmtTL(budget)} · Kupon tutarı: {fmtTL(amount)} · yine de kaydedebilirsin.</Text></View>
        )}
      </ScrollView>

      {/* ALT SABİT KAYDET BARI */}
      {(place === 'bottom' || place === 'both') && (
        <View style={[s.bottomBar, { paddingBottom: 10 + insets.bottom }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.barMain}>{cols} kolon · {fmtTL(amount)}</Text>
            <Text style={s.barSub}>{filledCount}/15 maç{overOfficial ? ' · limit aşıldı' : overBudget ? ' · bütçe aşıldı' : ''}</Text>
          </View>
          {locked ? (
            <View style={s.lockedMini}><Text style={s.lockedMiniTxt}>Kilitli</Text></View>
          ) : (
            <TouchableOpacity style={[s.saveBtn, !canSave && s.saveBtnOff]} disabled={!canSave} onPress={onSavePress}><Text style={s.saveTxt}>Kuponu Kaydet</Text></TouchableOpacity>
          )}
        </View>
      )}

      {/* TOAST (yukarıdan kayan) */}
      {toast && (
        <Animated.View style={[s.toast, toastKind === 'success' && s.toastOk, { transform: [{ translateY: toastY }] }]}>
          <Text style={s.toastTxt}>{toast}</Text>
          <TouchableOpacity onPress={hideToast} hitSlop={10}><Text style={s.toastX}>✕</Text></TouchableOpacity>
        </Animated.View>
      )}

      {/* ÖNİZLEME */}
      {showPreview && (
        <View style={s.modalWrap}>
          <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setShowPreview(false)} />
          <View style={[s.modal, { paddingBottom: spacing.lg + insets.bottom }]}>
            <Text style={s.modalTitle}>{data.round} · Kupon Önizleme</Text>
            <PvRow k="Sezon" v={data.year} />
            <PvRow k="Seçilen maç" v={`${filledCount}/15`} />
            <PvRow k="Kolon" v={`${cols} / ${COUPON_MAX_COLUMNS}`} />
            <PvRow k="Kolon bedeli" v={`${COUPON_COLUMN_PRICE} TL`} />
            <PvRow k="Tutar" v={fmtTL(amount)} />
            <PvRow k="Resmi limit" v={fmtTL(COUPON_MAX_AMOUNT)} />
            {budget != null ? <PvRow k="Bütçen" v={fmtTL(budget)} warn={overBudget} /> : null}
            {overBudget ? <Text style={s.pvWarn}>Belirlediğin bütçe limiti aşıldı.</Text> : null}
            <View style={s.modalBtns}>
              <TouchableOpacity style={[s.mBtn, s.mBtnAlt]} onPress={() => setShowPreview(false)}><Text style={s.mBtnAltTxt}>Düzenlemeye Dön</Text></TouchableOpacity>
              <TouchableOpacity style={s.mBtn} onPress={doSave}><Text style={s.mBtnTxt}>{overBudget ? 'Yine de Kaydet' : 'Kuponu Kaydet'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function SumCell({ label, v, warn }) { return <View style={s.sumCell}><Text style={[s.sumV, warn && { color: colors.danger }]} numberOfLines={1}>{v}</Text><Text style={s.sumL}>{label}</Text></View>; }
function SetSeg({ label, opts, val, on }) { return (<View style={s.setRow}><Text style={s.setLabel}>{label}</Text><View style={s.seg}>{opts.map(([k, l]) => <TouchableOpacity key={k} onPress={() => on(k)} style={[s.segBtn, val === k && s.segBtnOn]}><Text style={[s.segTxt, val === k && s.segTxtOn]}>{l}</Text></TouchableOpacity>)}</View></View>); }
function PvRow({ k, v, warn }) { return <View style={s.pvRow}><Text style={s.pvK}>{k}</Text><Text style={[s.pvV, warn && { color: colors.danger }]}>{v}</Text></View>; }

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  lockEmoji: { fontSize: 42 }, lockTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 10 }, lockBody: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 19 },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  hTitle: { color: colors.text, fontSize: 18, fontWeight: '900' }, hSub: { color: colors.textMuted, fontSize: 11.5, fontWeight: '700', marginTop: 2 },
  gear: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border }, gearTxt: { fontSize: 16 },
  settings: { backgroundColor: colors.surfaceSoft, borderBottomWidth: 1, borderBottomColor: colors.border, padding: spacing.md, gap: 10 },
  setRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  setLabel: { color: colors.textSoft, fontSize: 12.5, fontWeight: '800' },
  seg: { flexDirection: 'row', backgroundColor: colors.cardAlt, borderRadius: radius.sm, padding: 2 },
  segBtn: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: radius.sm - 2 }, segBtnOn: { backgroundColor: colors.primary },
  segTxt: { color: colors.textMuted, fontSize: 11.5, fontWeight: '800' }, segTxtOn: { color: '#fff' },
  budgetRow: { gap: 6 }, budgetChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  bChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.sm, backgroundColor: colors.cardAlt }, bChipOn: { backgroundColor: colors.primary },
  bChipTxt: { color: colors.textSoft, fontSize: 11, fontWeight: '800' }, bChipTxtOn: { color: '#fff' },
  bInput: { minWidth: 64, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, color: colors.text, fontSize: 12, fontWeight: '700' },

  topSum: { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, padding: spacing.md, gap: 10 },
  sumGrid: { flexDirection: 'row', gap: 8 },
  sumCell: { flex: 1, alignItems: 'center' }, sumV: { color: colors.text, fontSize: 15, fontWeight: '900' }, sumL: { color: colors.textMuted, fontSize: 10, fontWeight: '700', marginTop: 2 },
  applyRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  applyAll: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' }, applyAllTxt: { color: '#fff', fontSize: 12.5, fontWeight: '800' },
  clearAll: { paddingHorizontal: 14, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.danger, backgroundColor: colors.dangerSoft }, clearAllTxt: { color: colors.danger, fontSize: 12, fontWeight: '900' },

  lockedBar: { backgroundColor: colors.warningSoft, borderBottomWidth: 1, borderBottomColor: colors.warning, padding: 10 }, lockedTxt: { color: '#7a4a00', fontSize: 12.5, fontWeight: '800', textAlign: 'center' },

  body: { padding: spacing.md },
  mRow: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm, ...shadow.soft },
  mRowFocus: { borderColor: colors.primary, borderWidth: 2 },
  mTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mNo: { color: colors.textMuted, fontSize: 12, fontWeight: '900', width: 18, textAlign: 'center' },
  mTeams: { color: colors.text, fontSize: 13, fontWeight: '800' },
  mAnalysis: { color: colors.textMuted, fontSize: 10.5, fontWeight: '700', marginTop: 2 }, mSysStrong: { color: colors.text, fontWeight: '900' },
  detailBtn: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border }, detailTxt: { color: colors.textSoft, fontSize: 10.5, fontWeight: '800' },
  mPick: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  otoggles: { flexDirection: 'row', gap: 6, flex: 1 },
  oBtn: { flex: 1, flexDirection: 'row', gap: 4, paddingVertical: 11, borderRadius: radius.sm, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  oBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary, ...shadow.soft }, oTxt: { color: colors.textSoft, fontSize: 15, fontWeight: '900' }, oTxtOn: { color: '#fff' },
  oCheck: { color: '#fff', fontSize: 12, fontWeight: '900' },
  fromSys: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: radius.sm, backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border }, fromSysTxt: { color: colors.textSoft, fontSize: 10.5, fontWeight: '800' },

  warnSoft: { backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: colors.warning, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  warnSoftTitle: { color: '#7a4a00', fontSize: 13, fontWeight: '900' }, warnSoftBody: { color: '#7a4a00', fontSize: 11.5, fontWeight: '600', marginTop: 3, lineHeight: 16 },

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: spacing.md, paddingTop: 10, ...shadow.card },
  barMain: { color: colors.text, fontSize: 15, fontWeight: '900' }, barSub: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 1 },
  saveBtn: { backgroundColor: colors.success, paddingHorizontal: 18, paddingVertical: 13, borderRadius: radius.md }, saveBtnOff: { backgroundColor: colors.muted, opacity: 0.5 }, saveTxt: { color: '#fff', fontSize: 13.5, fontWeight: '900' },
  lockedMini: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: radius.md, backgroundColor: colors.cardAlt }, lockedMiniTxt: { color: colors.textMuted, fontSize: 13, fontWeight: '800' },

  toast: { position: 'absolute', left: spacing.md, right: spacing.md, top: 0, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.danger, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, ...shadow.card },
  toastOk: { backgroundColor: colors.success },
  toastTxt: { flex: 1, color: '#fff', fontSize: 12, fontWeight: '800', lineHeight: 16 }, toastX: { color: '#fff', fontSize: 14, fontWeight: '900' },

  modalWrap: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  modal: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.lg, gap: 4 },
  modalTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginBottom: 8 },
  pvRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border },
  pvK: { color: colors.textMuted, fontSize: 12.5, fontWeight: '700' }, pvV: { color: colors.text, fontSize: 12.5, fontWeight: '900' }, pvWarn: { color: colors.danger, fontSize: 12, fontWeight: '800', marginTop: 8 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 14 },
  mBtn: { flex: 1, backgroundColor: colors.success, paddingVertical: 13, borderRadius: radius.md, alignItems: 'center' }, mBtnTxt: { color: '#fff', fontSize: 13.5, fontWeight: '900' },
  mBtnAlt: { backgroundColor: colors.cardAlt }, mBtnAltTxt: { color: colors.textSoft, fontSize: 13.5, fontWeight: '800' },
});
