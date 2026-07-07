// SÜRPRİZ RADARI — karar destek ekranı (master sürüm).
// Sıralama: en sürprize açık EN ÜSTTE → en düşük riskli (banko) EN ALTTA.
// Özellikler: hafta çubukları (arşiv) · 🔒 donma + geri sayım · özet şeridi
// (tıkla-filtrele) · Radar Karnesi (radarın gerçek başarısı) · genişleyen kart ·
// karttan kupona işleme · geçmiş haftada resmi sonuç + tuttu/tutmadı.
// Veri yoksa alan gösterilmez (uydurma yok).
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { api } from '../api';
import { colors, spacing, radius, labelColors } from '../theme';
import { SurpriseBadge, FormStrip } from '../components';
import VenueMark from '../components/VenueMark';
import NoInternetScreen, { isNetworkError } from '../components/NoInternetScreen';
import ScreenBackdrop from '../components/ScreenBackdrop';
import AnalysisHeader from '../components/AnalysisHeader';
import { getDraft, setDraftPick } from '../couponStore';
import { OUTCOMES } from '../couponConfig';

const ord = (n) => (n != null ? `${n}.` : '—');
const wdl = (v) => (v ? `${v.wins || 0}G ${v.draws || 0}B ${v.losses || 0}M` : null);
const num1 = (v) => { const n = Number(v); return Number.isFinite(n) ? (Number.isInteger(n) ? String(n) : n.toFixed(1)) : null; };

export default function RadarScreen({ navigation }) {
  const [radar, setRadar] = useState(null);
  const [meta, setMeta] = useState(null);       // gösterilen haftanın bilgisi
  const [weeks, setWeeks] = useState([]);       // üst hafta çubukları
  const [curId, setCurId] = useState(null);     // güncel bültenin roundId'si
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState(null);
  const [radarView, setRadarView] = useState('r1'); // 'r1' karar destek · 'r2' xG görünümü
  const [filter, setFilter] = useState(null);   // labelColor filtresi (green/yellow/red)
  const [expandedNo, setExpandedNo] = useState(null); // genişletilmiş kart
  const [picks, setPicks] = useState({});       // kupon taslağı seçimleri (no → ['1','X'])
  const [rsc, setRsc] = useState(null);         // radar karnesi
  const [now, setNow] = useState(Date.now());   // donma geri sayımı için

  // Güncel hafta radarı (+ hafta listesi + taslak seçimleri)
  const load = useCallback(async () => {
    try {
      setError(null);
      const d = await api.radar();
      setWeeks(d.weeks || []);
      setCurId(d.roundId ?? null);
      setSelectedId(d.roundId ?? null);
      setRadar(d.radar);
      setMeta({
        round: d.round || null, year: d.year || null, current: true,
        frozenAt: d.radarFrozenAt || null, freezeAt: d.radarFreezeAt || null,
      });
      if (d.roundId != null) setPicks(getDraft(d.roundId).picks || {});
    } catch (e) { setError(e.message); }
  }, []);

  // Geçmiş hafta radarı (mühürlü arşiv — resmi sonuçlar işlenmiş gelir)
  const selectWeek = useCallback(async (rid) => {
    if (rid === curId) { load(); return; }      // güncel haftaya dönüş → taze veri
    try {
      setError(null);
      setSelectedId(rid);
      setRadar(null);                            // yükleniyor
      const d = await api.radarWeek(rid);
      setRadar(d.radar || []);
      setMeta({ round: d.round || null, year: d.year || null, frozenAt: d.radarFrozenAt || null, freezeAt: null, current: false });
    } catch (e) { setError(e.message); }
  }, [curId, load]);

  useEffect(() => { load(); }, [load]);

  // Radar karnesi (bir kez) + geri sayım saati (30 sn'de bir)
  useEffect(() => {
    api.radarScorecard().then((d) => { if (d?.hasData) setRsc(d); }).catch(() => {});
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Karttan kupona işle: 1/X/2 seçimini paylaşılan TASLAĞA yazar (Kupon Oluştur okur).
  const togglePick = (no, o) => {
    if (curId == null || meta?.current === false) return;
    const cur = new Set(picks[no] || []);
    cur.has(o) ? cur.delete(o) : cur.add(o);
    const arr = OUTCOMES.filter((x) => cur.has(x));
    const next = { ...picks }; if (arr.length) next[no] = arr; else delete next[no];
    setPicks(next);
    setDraftPick(curId, no, arr);
  };

  if (error) {
    if (isNetworkError(error)) {
      return <NoInternetScreen onRetry={load} onGoHome={() => navigation.navigate('HomeTab')} />;
    }
    return <View style={styles.center}><Text style={styles.muted}>{error}</Text></View>;
  }
  if (!radar) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  // Özet şeridi sayıları + filtre uygulanmış liste
  const counts = { red: 0, yellow: 0, green: 0 };
  for (const r of radar) if (counts[r.labelColor] != null) counts[r.labelColor] += 1;
  const shown = filter ? radar.filter((r) => r.labelColor === filter) : radar;

  // Donma geri sayımı (yalnız güncel hafta, henüz mühürlenmemişken)
  const freezeMs = meta?.current && !meta?.frozenAt && meta?.freezeAt ? new Date(meta.freezeAt).getTime() - now : null;
  const freezeMin = freezeMs != null && freezeMs > 0 ? Math.ceil(freezeMs / 60000) : null;

  const renderItem = ({ item, index }) => {
    const c = labelColors[item.labelColor] || colors.gray;
    const p = item.probabilities || null;
    const sig = item.signals || null;
    const factors = item.factors || [];
    const expanded = expandedNo === item.no;
    const myPicks = picks[item.no] || [];
    // Tek satırlık sinyal parçaları: sıra · iç/dış · xG (veri olan gösterilir)
    const bits = [];
    if (sig?.position) bits.push(`Sıra ${ord(sig.position.home)} – ${ord(sig.position.away)}`);
    if (sig?.venue && (sig.venue.home || sig.venue.away)) bits.push(`İç/Dış ${wdl(sig.venue.home) || '—'} · ${wdl(sig.venue.away) || '—'}`);
    if (sig?.xg) {
      const xh = num1(sig.xg.homeVenue ?? sig.xg.home), xa = num1(sig.xg.awayVenue ?? sig.xg.away);
      if (xh != null && xa != null) bits.push(`xG ${xh} – ${xa}`);
    }
    if (sig?.goals) {
      const gh = num1(sig.goals.home?.for), ga = num1(sig.goals.away?.for);
      if (gh != null && ga != null) bits.push(`Gol/maç ${gh} – ${ga}`);
    }
    return (
      <TouchableOpacity style={[styles.row, expanded && styles.rowExpanded]} activeOpacity={0.8} onPress={() => setExpandedNo(expanded ? null : item.no)}>
        {/* Üst satır: sıra + takımlar + puan/rozet */}
        <View style={styles.topRow}>
          <Text style={styles.rank}>{index + 1}</Text>
          <View style={{ flex: 1 }}>
            <View style={styles.teamsRow}>
              <VenueMark side="home" size={14} />
              <Text style={[styles.teams, styles.teamName]} numberOfLines={1}>{item.home}</Text>
              <Text style={styles.teamsVs}>–</Text>
              <VenueMark side="away" size={14} />
              <Text style={[styles.teams, styles.teamName]} numberOfLines={1}>{item.away}</Text>
            </View>
            <View style={styles.scoreBar}>
              <View style={{ width: `${item.surpriseScore}%`, height: 6, backgroundColor: c, borderRadius: 3 }} />
            </View>
          </View>
          <View style={styles.right}>
            <Text style={[styles.scoreNum, { color: c }]}>{item.surpriseScore}</Text>
            <SurpriseBadge label={item.label} labelColor={item.labelColor} small />
          </View>
        </View>

        {/* GEÇMİŞ HAFTA: resmi sonuç + tuttu/tutmadı (sadece resmi veri) */}
        {item.result && item.score ? (
          <View style={styles.resultRow}>
            <Text style={styles.resultTxt}>Sonuç: <Text style={styles.resultStrong}>{item.result}</Text> · {item.score.home}-{item.score.away}</Text>
            {item.favHit != null ? (
              <View style={[styles.hitPill, { backgroundColor: item.favHit ? colors.success : colors.danger }]}>
                <Text style={styles.hitPillTxt}>{item.favHit ? '✓ Favori tuttu' : '✗ Sürpriz oldu'}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {radarView === 'r1' ? (
          /* ——— RADAR 1 · KARAR DESTEK KARTI (tek kartta her şey) ——— */
          <>
            {(item.favorite || p) && (
              <View style={styles.favRow}>
                {item.favorite ? (
                  <View style={styles.favPill}>
                    <Text style={styles.favPillTxt}>Favori {item.favorite.symbol} · %{item.favorite.percent}{item.estimated ? ' ≈' : ''}</Text>
                  </View>
                ) : null}
                {p ? <Text style={styles.probs}>1 %{p['1']} · X %{p['X']} · 2 %{p['2']}</Text> : null}
              </View>
            )}

            {bits.length > 0 && <Text style={styles.signals} numberOfLines={expanded ? 2 : 1}>{bits.join('   ·   ')}</Text>}

            {sig?.form && (sig.form.home?.length || sig.form.away?.length) ? (
              <View style={styles.formRow}>
                <Text style={styles.formLbl}>Form</Text>
                <FormStrip form={sig.form.home} size={16} />
                <Text style={styles.formSep}>—</Text>
                <FormStrip form={sig.form.away} size={16} />
              </View>
            ) : null}

            {factors.length > 0 && (
              <View style={styles.factors}>
                {(expanded ? factors : factors.slice(0, 3)).map((f, i) => (
                  <Text key={i} style={styles.factorTxt} numberOfLines={1}>• {f.label} <Text style={styles.factorPts}>+{f.points}</Text></Text>
                ))}
              </View>
            )}

            {item.comment ? <Text style={styles.comment} numberOfLines={expanded ? 0 : 2}>{item.comment}</Text> : null}

            {/* Genişletilmiş detay: yenilen gol + analiz kısayolu */}
            {expanded && sig?.goals && (num1(sig.goals.home?.against) != null || num1(sig.goals.away?.against) != null) ? (
              <Text style={styles.signals}>Yediği gol/maç {num1(sig.goals.home?.against) ?? '—'} – {num1(sig.goals.away?.against) ?? '—'}</Text>
            ) : null}
          </>
        ) : (
          /* ——— RADAR 2 · YENİ SİSTEM (istatistik odaklı: xG · gol · sıra · iç/dış · form) ——— */
          <>
            {bits.length > 0 ? (
              <Text style={styles.signals} numberOfLines={2}>{bits.join('   ·   ')}</Text>
            ) : <Text style={styles.signals}>İstatistik verisi bulunamadı.</Text>}
            {sig?.form && (sig.form.home?.length || sig.form.away?.length) ? (
              <View style={styles.formRow}>
                <Text style={styles.formLbl}>Form</Text>
                <FormStrip form={sig.form.home} size={16} />
                <Text style={styles.formSep}>—</Text>
                <FormStrip form={sig.form.away} size={16} />
              </View>
            ) : null}
          </>
        )}

        {/* Alt aksiyon satırı: kupona işle (güncel hafta) + analiz kısayolu */}
        <View style={styles.actionRow}>
          {meta?.current !== false ? (
            <View style={styles.pickBtns}>
              {OUTCOMES.map((o) => {
                const on = myPicks.includes(o);
                return (
                  <TouchableOpacity key={o} onPress={() => togglePick(item.no, o)} style={[styles.pickBtn, on && styles.pickBtnOn]} activeOpacity={0.85}>
                    <Text style={[styles.pickTxt, on && styles.pickTxtOn]}>{on ? '✓ ' : ''}{o}</Text>
                  </TouchableOpacity>
                );
              })}
              {myPicks.length ? <Text style={styles.pickHint}>taslağa işlendi</Text> : <Text style={styles.pickHint}>kupona işle</Text>}
            </View>
          ) : <View style={{ flex: 1 }} />}
          <TouchableOpacity onPress={() => navigation.navigate('MatchDetail', { no: item.no })} style={styles.detailBtn} activeOpacity={0.85}>
            <Text style={styles.detailBtnTxt}>Analiz ›</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenBackdrop>
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <AnalysisHeader
        title={meta?.round ? `${meta.round} · Sürpriz Radarı` : 'Sürpriz Radarı'}
        subtitle="En sürprize açıktan en bankoya doğru sıralı"
      >
        {meta?.frozenAt ? (
          <View style={styles.frozenBadge}>
            <Text style={styles.frozenTxt}>
              🔒 Maç öncesi görüntü · {new Date(meta.frozenAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} itibarıyla donduruldu — maçlar oynansa da bu liste değişmez
            </Text>
          </View>
        ) : freezeMin != null ? (
          <View style={styles.frozenBadge}>
            <Text style={styles.frozenTxt}>⏳ Radar {freezeMin} dk sonra mühürlenecek — o andan sonra liste değişmez</Text>
          </View>
        ) : null}
        {rsc ? (
          <View style={styles.rscBadge}>
            <Text style={styles.rscTxt}>
              🎯 Radar Karnesi: Banko %{rsc.labels.banko.rate} ({rsc.labels.banko.hit}/{rsc.labels.banko.total}) · Sürpriz yakalama %{rsc.labels.surpriz.rate} ({rsc.labels.surpriz.hit}/{rsc.labels.surpriz.total}){rsc.note ? ' · az veri' : ''}
            </Text>
          </View>
        ) : null}
        <TouchableOpacity onPress={() => navigation.navigate('SystemScorecard')} style={styles.dashboardLink}>
          <Text style={[styles.dashboardLinkTxt, { color: '#9FC4B0' }]}>📊 Sistem Karnesi · Doğru/Yanlış ›</Text>
        </TouchableOpacity>
      </AnalysisHeader>

      {/* HAFTA ÇUBUKLARI — güncel + arşivlenmiş (mühürlü) geçmiş haftalar */}
      {weeks.length > 0 && (
        <View style={styles.weekBarWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekBar}>
            {weeks.map((w) => {
              const on = w.roundId === selectedId;
              const isCur = w.roundId === curId;
              return (
                <TouchableOpacity key={w.roundId} onPress={() => selectWeek(w.roundId)} style={[styles.weekChip, on && styles.weekChipOn]} activeOpacity={0.85}>
                  <Text style={[styles.weekChipTxt, on && styles.weekChipTxtOn]}>
                    {w.round || `#${w.roundId}`}{isCur ? ' · Güncel' : w.radarFrozenAt ? ' 🔒' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* RADAR SEKMELERİ — 1: Karar destek · 2: Yeni (xG) görünüm */}
      <View style={styles.radarTabs}>
        {[
          { k: 'r1', label: 'Radar 1', sub: 'Karar destek' },
          { k: 'r2', label: 'Radar 2', sub: 'Yeni · xG' },
        ].map((t) => {
          const on = radarView === t.k;
          return (
            <TouchableOpacity key={t.k} onPress={() => setRadarView(t.k)} style={[styles.radarTab, on && styles.radarTabOn]} activeOpacity={0.85}>
              <Text style={[styles.radarTabTxt, on && styles.radarTabTxtOn]}>{t.label}</Text>
              <Text style={[styles.radarTabSub, on && styles.radarTabSubOn]}>{t.sub}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ÖZET ŞERİDİ — etiket dağılımı · tıklayınca filtre */}
      <View style={styles.sumStrip}>
        {[
          { k: 'red', label: 'Sürprize açık', icon: '🔴' },
          { k: 'yellow', label: 'Dikkat', icon: '🟡' },
          { k: 'green', label: 'Banko', icon: '🟢' },
        ].map((t) => {
          const on = filter === t.k;
          return (
            <TouchableOpacity key={t.k} onPress={() => setFilter(on ? null : t.k)} style={[styles.sumChip, on && styles.sumChipOn]} activeOpacity={0.85}>
              <Text style={[styles.sumChipTxt, on && styles.sumChipTxtOn]}>{t.icon} {counts[t.k]} {t.label}</Text>
            </TouchableOpacity>
          );
        })}
        {filter ? (
          <TouchableOpacity onPress={() => setFilter(null)} style={styles.sumClear} activeOpacity={0.85}>
            <Text style={styles.sumClearTxt}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={shown}
        extraData={[radarView, filter, expandedNo, picks]}
        keyExtractor={(r) => String(r.no)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => (meta?.current === false ? selectWeek(selectedId) : load())} tintColor={colors.primary} />}
        ListEmptyComponent={<Text style={[styles.muted, { textAlign: 'center', marginTop: 40 }]}>{filter ? 'Bu etikette maç yok.' : meta?.current === false ? 'Bu haftanın radar arşivi boş.' : 'Henüz oranlı maç yok.\nKendi anahtarınla lig ekleyince dolacak.'}</Text>}
      />
    </View>
    </ScreenBackdrop>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24 },
  muted: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  dashboardLink: { marginTop: 8 },
  dashboardLinkTxt: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  frozenBadge: { marginTop: 8, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  frozenTxt: { color: '#E8D9A8', fontSize: 11, fontWeight: '700', lineHeight: 15 },
  rscBadge: { marginTop: 6, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  rscTxt: { color: '#B9E3C6', fontSize: 11, fontWeight: '800', lineHeight: 15 },

  weekBarWrap: { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  weekBar: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, paddingVertical: 8 },
  weekChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  weekChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  weekChipTxt: { color: colors.textSoft, fontSize: 12, fontWeight: '800' },
  weekChipTxtOn: { color: '#fff' },

  radarTabs: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  radarTab: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingVertical: 8, alignItems: 'center' },
  radarTabOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  radarTabTxt: { color: colors.text, fontSize: 13.5, fontWeight: '900' },
  radarTabTxtOn: { color: '#fff' },
  radarTabSub: { color: colors.textMuted, fontSize: 10.5, fontWeight: '700', marginTop: 1 },
  radarTabSubOn: { color: 'rgba(255,255,255,0.8)' },

  sumStrip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 6, flexWrap: 'wrap' },
  sumChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  sumChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  sumChipTxt: { color: colors.textSoft, fontSize: 11, fontWeight: '800' },
  sumChipTxtOn: { color: '#fff' },
  sumClear: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardAlt },
  sumClearTxt: { color: colors.textSoft, fontSize: 11, fontWeight: '900' },

  row: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  rowExpanded: { borderWidth: 1.5, borderColor: colors.primary },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rank: { color: colors.textMuted, fontSize: 16, fontWeight: '800', width: 22, textAlign: 'center' },
  teams: { color: colors.text, fontSize: 14, fontWeight: '700' },
  teamsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  teamName: { flexShrink: 1 },
  teamsVs: { color: colors.textMuted, fontSize: 13, fontWeight: '700', marginHorizontal: 1 },
  scoreBar: { marginTop: 6, height: 6, backgroundColor: colors.cardAlt, borderRadius: 3, overflow: 'hidden' },
  right: { alignItems: 'flex-end', gap: 4 },
  scoreNum: { fontSize: 18, fontWeight: '900' },

  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  resultTxt: { color: colors.textSoft, fontSize: 12, fontWeight: '700' },
  resultStrong: { color: colors.text, fontWeight: '900' },
  hitPill: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  hitPillTxt: { color: '#fff', fontSize: 10.5, fontWeight: '900' },

  favRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  favPill: { backgroundColor: colors.cardAlt, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  favPillTxt: { color: colors.text, fontSize: 11.5, fontWeight: '900' },
  probs: { color: colors.textSoft, fontSize: 11.5, fontWeight: '700' },

  signals: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 7 },
  formRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 },
  formLbl: { color: colors.textMuted, fontSize: 10.5, fontWeight: '800' },
  formSep: { color: colors.textMuted, fontSize: 10 },

  factors: { marginTop: 7, gap: 2 },
  factorTxt: { color: colors.textSoft, fontSize: 11.5, fontWeight: '600', lineHeight: 16 },
  factorPts: { color: colors.warning, fontWeight: '900' },
  comment: { color: colors.textMuted, fontSize: 11, fontStyle: 'italic', lineHeight: 15, marginTop: 7 },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  pickBtns: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  pickBtn: { minWidth: 36, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: colors.cardAlt, borderWidth: 1.5, borderColor: 'transparent', alignItems: 'center' },
  pickBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  pickTxt: { color: colors.textSoft, fontSize: 12.5, fontWeight: '900' },
  pickTxtOn: { color: '#fff' },
  pickHint: { color: colors.textMuted, fontSize: 10, fontWeight: '700', marginLeft: 2 },
  detailBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.sm, backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border },
  detailBtnTxt: { color: colors.textSoft, fontSize: 11.5, fontWeight: '800' },
});
