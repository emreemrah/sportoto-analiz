import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Image, Modal } from 'react-native';
import { api } from '../api';
import { colors, spacing, radius } from '../theme';
import { ProbBar, SurpriseBadge, PredictionBadge, FormStrip, RecordBadges, StatBar } from '../components';
import { countryCode, matchDate } from '../utils';
import CommentsSection from '../CommentsSection';
import PollsSection from '../Polls';
import { MatchHeader, Tabs, Accordion, SectionCard, PollCard, EmptyState, RatingDots, SplitDonut, StatTile, InfoTile, PollTile, Logo } from '../ui';
import CouponPickBlock from '../components/CouponPickBlock';
import MatchInfoCard from '../components/MatchInfoCard';
import UserAnalysisView from '../components/UserAnalysisView';
import CompareBars, { signalsFromStats } from '../components/CompareBars';

const TABS = ['Özet', 'Analiz', 'İstatistik', 'Karşılaştırma', 'Yorumlar'];
const sonRow = { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' };
const sonName = { color: colors.text, fontSize: 13.5, fontWeight: '700', flex: 1, marginRight: 8 };
const topluLabel = { color: colors.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 0.5, marginTop: spacing.sm, marginBottom: spacing.sm };
const pollGrid = { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' };
const pollCell = { width: '48.5%' };
const ozetRow = { flexDirection: 'row', gap: 8, marginBottom: spacing.md };
const ozetMain = { flex: 1.4, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md };
const ozetSummaryCard = { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md };
const infoLabel = { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 };
const ozetText = { color: colors.text, fontSize: 12, marginTop: 4, lineHeight: 16 };
const pitchBox = { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#16432a', borderRadius: 6, paddingVertical: 10 };
const pitchQ = { color: '#bbf7d0', fontWeight: '900', fontSize: 13 };
const avatarCircle = { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' };
const scoreChip = { backgroundColor: colors.bgAlt, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center' };
const scoreChipL = { color: colors.textMuted, fontSize: 9, fontWeight: '700' };
const scoreChipV = { color: colors.text, fontSize: 13, fontWeight: '900' };
const bubble = { height: 10, borderRadius: 5, backgroundColor: colors.cardAlt, width: '85%' };
const smColTitle = { color: colors.text, fontSize: 12, fontWeight: '800', marginBottom: 6 };
const smRow = { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.border };
const smOpp = { flex: 1, color: colors.textMuted, fontSize: 11.5, fontWeight: '600' };
const smScore = { fontSize: 12, fontWeight: '800' };
const smLegend = { color: colors.textMuted, fontSize: 10, marginBottom: 8, lineHeight: 14 };
const smLegendTxt = { color: colors.textMuted, fontSize: 10, lineHeight: 14 };

// Son 5 form puanı (0-5): G=1, B=0.5, M=0 → ortalama × 5
function formRating(form) {
  if (!form || !form.length) return null;
  const pts = form.reduce((acc, r) => acc + (r === 'G' ? 1 : r === 'B' ? 0.5 : 0), 0);
  return Math.round((pts / form.length) * 5 * 10) / 10;
}

// Tek simge: iç saha (ev) / deplasman (uçak), sonuç rengi — hazır ikon görselleri.
const VENUE_ICONS = {
  home: {
    G: require('../../assets/venue/home-win.png'),
    M: require('../../assets/venue/home-loss.png'),
    B: require('../../assets/venue/home-draw.png'),
  },
  away: {
    G: require('../../assets/venue/away-win.png'),
    M: require('../../assets/venue/away-loss.png'),
    B: require('../../assets/venue/away-draw.png'),
  },
};
function VenueIcon({ result, isHome, size = 22 }) {
  const set = VENUE_ICONS[isHome ? 'home' : 'away'];
  const src = set[result] || set.B; // G=galibiyet · M=mağlubiyet · diğer=beraberlik
  return <Image source={src} style={{ width: size, height: size }} resizeMode="contain" />;
}
// Takım istatistik penceresi — logoya basınca açılır. Maçta zaten gelen
// stats.home/away verisiyle (yeni backend gerekmez). Sadece o takımın verisi.
function TSBox({ label, value, color }) {
  return (
    <View style={tm.box}>
      <Text style={[tm.boxVal, color && { color }]}>{value}</Text>
      <Text style={tm.boxLbl}>{label}</Text>
    </View>
  );
}
function TeamStatsModal({ visible, onClose, data }) {
  if (!data) return null;
  const { name, logo, league, stats } = data;
  const st = stats?.standing || {};
  const sn = stats?.season || {};
  const av = sn.avg || {};
  const hs = st.home || {}, as = st.away || {};
  const detail = [...(stats?.last5detail || [])].reverse();
  const ppg = st.ppg != null ? Number(st.ppg).toFixed(2) : '—';
  const gd = st.goalDiff > 0 ? `+${st.goalDiff}` : `${st.goalDiff ?? 0}`;
  const n1 = (v) => (v == null ? '—' : Number(v).toFixed(1));
  const n2 = (v) => (v == null ? '—' : Number(v).toFixed(2));
  const pc = (v) => (v == null ? '—' : `%${Math.round(v)}`);
  const hasAvg = av && (av.shots || av.corners || av.possession || av.cards);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={tm.overlay}>
        <TouchableOpacity style={tm.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={tm.sheet}>
          <View style={tm.head}>
            <Logo uri={logo} name={name} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={tm.name} numberOfLines={1}>{st.name || name}</Text>
              <Text style={tm.sub} numberOfLines={1}>{league || ''}{st.position ? ` · ${st.position}. sıra` : ''}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}><Text style={tm.close}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} showsVerticalScrollIndicator={false}>
            <Text style={tm.section}>SEZON</Text>
            <View style={tm.row}>
              <TSBox label="O" value={st.played ?? '—'} />
              <TSBox label="G" value={st.wins ?? '—'} color={colors.green} />
              <TSBox label="B" value={st.draws ?? '—'} color={colors.yellow} />
              <TSBox label="M" value={st.losses ?? '—'} color={colors.red} />
              <TSBox label="Puan" value={st.points ?? '—'} />
              <TSBox label="PPG" value={ppg} />
            </View>
            <Text style={tm.section}>GOLLER</Text>
            <View style={tm.row}>
              <TSBox label="Attığı" value={st.goalsFor ?? '—'} />
              <TSBox label="Yediği" value={st.goalsAgainst ?? '—'} />
              <TSBox label="Averaj" value={gd} />
              <TSBox label="Gol/maç" value={n1(sn.goalsPerGame)} />
              <TSBox label="Yediği/maç" value={n1(sn.concededPerGame)} />
            </View>

            <Text style={tm.section}>BEKLENTİ & EĞİLİM</Text>
            <View style={tm.row}>
              <TSBox label="xG (için)" value={n2(sn.xgFor)} color={colors.green} />
              <TSBox label="xG (karşı)" value={n2(sn.xgAgainst)} color={colors.red} />
              <TSBox label="2.5 Üst" value={pc(sn.over25Pct)} />
              <TSBox label="KG Var" value={pc(sn.bttsPct)} />
            </View>
            <View style={tm.row}>
              <TSBox label="Temiz kale" value={pc(sn.cleanSheetPct)} />
              <TSBox label="Gol atamadı" value={pc(sn.failedToScorePct)} />
            </View>

            {hasAvg ? (
              <>
                <Text style={tm.section}>MAÇ BAŞI ORTALAMA</Text>
                <View style={tm.row}>
                  <TSBox label="Topla oynama" value={av.possession ? `%${Math.round(av.possession)}` : '—'} />
                  <TSBox label="Şut" value={n1(av.shots)} />
                  <TSBox label="İsabetli" value={n1(av.shotsOnTarget)} />
                </View>
                <View style={tm.row}>
                  <TSBox label="Korner" value={n1(av.corners)} />
                  <TSBox label="Faul" value={n1(av.fouls)} />
                  <TSBox label="Kart" value={n1(av.cards)} />
                </View>
              </>
            ) : null}

            <Text style={tm.section}>İÇ SAHA / DEPLASMAN</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={tm.split}>
                <Text style={tm.splitTitle}>İç Saha</Text>
                <Text style={tm.splitLine}>{hs.wins ?? 0}G · {hs.draws ?? 0}B · {hs.losses ?? 0}M</Text>
                <Text style={tm.splitGoals}>AT {hs.goalsFor ?? 0} · YE {hs.goalsAgainst ?? 0}</Text>
              </View>
              <View style={tm.split}>
                <Text style={tm.splitTitle}>Deplasman</Text>
                <Text style={tm.splitLine}>{as.wins ?? 0}G · {as.draws ?? 0}B · {as.losses ?? 0}M</Text>
                <Text style={tm.splitGoals}>AT {as.goalsFor ?? 0} · YE {as.goalsAgainst ?? 0}</Text>
              </View>
            </View>
            {detail.length ? (
              <>
                <Text style={tm.section}>SON MAÇLAR</Text>
                {detail.map((d, i) => (
                  <View key={i} style={tm.mRow}>
                    <Logo uri={d.oppLogo} name={d.oppName} size={18} />
                    <Text style={tm.mOpp} numberOfLines={1}>{d.oppName || '—'}</Text>
                    <Text style={[tm.mScore, { color: d.result === 'G' ? colors.green : d.result === 'M' ? colors.red : colors.textMuted }]}>{d.score}</Text>
                    <VenueIcon result={d.result} isHome={d.isHome} size={20} />
                  </View>
                ))}
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const tm = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { maxHeight: '85%', backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: spacing.lg, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  name: { color: colors.text, fontSize: 16, fontWeight: '900' },
  sub: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginTop: 1 },
  close: { color: colors.textMuted, fontSize: 18, fontWeight: '900' },
  section: { color: colors.textMuted, fontSize: 10.5, fontWeight: '900', letterSpacing: 0.4, marginTop: 2 },
  row: { flexDirection: 'row', gap: 6 },
  box: { flex: 1, backgroundColor: colors.card, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingVertical: 10, alignItems: 'center' },
  boxVal: { color: colors.text, fontSize: 16, fontWeight: '900' },
  boxLbl: { color: colors.textMuted, fontSize: 10, fontWeight: '800', marginTop: 2 },
  split: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 3 },
  splitTitle: { color: colors.text, fontSize: 12.5, fontWeight: '900' },
  splitLine: { color: colors.textSoft, fontSize: 12.5, fontWeight: '800', marginTop: 2 },
  splitGoals: { color: colors.textMuted, fontSize: 11.5, fontWeight: '700' },
  mRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 7 },
  mOpp: { flex: 1, color: colors.text, fontSize: 12.5, fontWeight: '700' },
  mScore: { fontSize: 12.5, fontWeight: '900' },
});
// Son 5 şeridi (eski → yeni)
function VenueForm({ detail }) {
  const arr = [...(detail || [])].reverse();
  if (!arr.length) return <Text style={{ color: colors.textMuted }}>–</Text>;
  return (
    <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
      {arr.map((d, i) => <VenueIcon key={i} result={d.result} isHome={d.isHome} size={22} />)}
    </View>
  );
}

// ——— "Karşılaştırma" sekmesi bileşenleri ———

// Küçük takım arması (lig tablosuyla aynı) — TableLogo aşağıda tanımlı.
// Maç-başı ortalama kıyası: iki takım · Gol / Yediği Gol / Şut / Korner / Kart / Faul
const AVG_PICK = [
  ['Maç Başı Gol', 'Gol'],
  ['Yediği Gol', 'Yediği Gol'],
  ['Toplam Şut', 'Şut'],
  ['Korner', 'Korner'],
  ['Kart', 'Kart'],
  ['Faul', 'Faul'],
];
const fmtAvg = (v, sfx = '') => {
  const n = Number(v);
  if (!isFinite(n)) return `${v}${sfx}`;
  return `${Number.isInteger(n) ? n : n.toFixed(1)}${sfx}`;
};
function AvgComparison({ compare, homeName, awayName, homeLogo, awayLogo }) {
  const byLabel = new Map((compare || []).map((c) => [c.label, c]));
  const rows = AVG_PICK
    .map(([key, label]) => {
      const c = byLabel.get(key);
      return c ? { label, home: c.home, away: c.away, suffix: c.suffix || '' } : null;
    })
    .filter(Boolean);
  if (!rows.length) return null;
  return (
    <View style={styles.avgCard}>
      <View style={styles.avgHead}>
        <View style={styles.avgTeam}>
          <TableLogo logo={homeLogo} />
          <Text style={styles.avgTeamTxt} numberOfLines={1}>{homeName}</Text>
        </View>
        <View style={[styles.avgTeam, { justifyContent: 'flex-end' }]}>
          <Text style={[styles.avgTeamTxt, { textAlign: 'right' }]} numberOfLines={1}>{awayName}</Text>
          <TableLogo logo={awayLogo} />
        </View>
      </View>
      <Text style={styles.avgTitle}>Maç Başına Ortalamalar</Text>
      {rows.map((r, i) => (
        <View key={i} style={[styles.avgRow, i === 0 && { borderTopWidth: 0 }]}>
          <Text style={styles.avgVal}>{fmtAvg(r.home, r.suffix)}</Text>
          <Text style={styles.avgLabel} numberOfLines={1}>{r.label}</Text>
          <Text style={[styles.avgVal, styles.avgValR]}>{fmtAvg(r.away, r.suffix)}</Text>
        </View>
      ))}
    </View>
  );
}

// G/B/M sayacı (son 5 form dizisinden)
const countWDL = (form) => {
  const f = form || [];
  return {
    win: f.filter((x) => x === 'G').length,
    draw: f.filter((x) => x === 'B').length,
    loss: f.filter((x) => x === 'M').length,
  };
};

function WdlBox({ n, label, badge, badgeText }) {
  return (
    <View style={styles.wdlBox}>
      <View style={[styles.wdlBadge, { backgroundColor: badge }]}>
        <Text style={[styles.wdlBadgeTxt, { color: badgeText }]}>{n}</Text>
      </View>
      <Text style={styles.wdlBoxLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
}

function WdlBar({ win, draw, loss, winLabel, drawLabel, lossLabel }) {
  const seg = (v) => ({ flex: v, minWidth: v > 0 ? 4 : 0 });
  return (
    <View>
      <View style={styles.wdlBar}>
        <View style={[styles.wdlSeg, { backgroundColor: colors.accent }, seg(win)]} />
        <View style={[styles.wdlSeg, { backgroundColor: colors.border }, seg(draw)]} />
        <View style={[styles.wdlSeg, { backgroundColor: colors.primary }, seg(loss)]} />
      </View>
      <View style={styles.wdlBoxes}>
        <WdlBox n={win} label={winLabel} badge={colors.accent} badgeText={colors.white} />
        <WdlBox n={draw} label={drawLabel} badge={colors.cardAlt} badgeText={colors.textSoft} />
        <WdlBox n={loss} label={lossLabel} badge={colors.primary} badgeText={colors.white} />
      </View>
    </View>
  );
}

// Oklu + noktalı carousel: H2H + her takımın son 5 / iç-dış saha G-B-M dağılımı
function WdlCarousel({ slides }) {
  const [i, setI] = useState(0);
  if (!slides.length) return null;
  const n = slides.length;
  const idx = Math.min(i, n - 1);
  const cur = slides[idx];
  const go = (d) => setI((p) => (Math.min(p, n - 1) + d + n) % n);
  return (
    <View style={styles.wdlCard}>
      <View style={styles.wdlTop}>
        <TouchableOpacity onPress={() => go(-1)} style={styles.wdlArrow} activeOpacity={0.6} disabled={n < 2}>
          <Text style={styles.wdlArrowTxt}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.wdlTitle} numberOfLines={1}>{cur.title}</Text>
        <TouchableOpacity onPress={() => go(1)} style={styles.wdlArrow} activeOpacity={0.6} disabled={n < 2}>
          <Text style={styles.wdlArrowTxt}>›</Text>
        </TouchableOpacity>
      </View>
      <WdlBar {...cur} />
      {n > 1 && (
        <View style={styles.wdlDots}>
          {slides.map((_, k) => <View key={k} style={[styles.wdlDot, k === idx && styles.wdlDotOn]} />)}
        </View>
      )}
    </View>
  );
}

export default function MatchDetailScreen({ route, navigation }) {
  const { no } = route.params;
  const [m, setM] = useState(null);
  const [error, setError] = useState(null);
  const [openSquad, setOpenSquad] = useState(null); // 'home' | 'away' | null
  const [infoOpen, setInfoOpen] = useState(false);
  const [teamModal, setTeamModal] = useState(null); // 'home' | 'away' | null
  const [tab, setTab] = useState(route.params?.tab || 'Özet');

  useEffect(() => {
    api.match(no).then(setM).catch((e) => setError(e.message));
  }, [no]);

  if (error) return <View style={styles.center}><Text style={styles.muted}>{error}</Text></View>;
  if (!m) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  const a = m.analysis;
  const s = m.stats || {};
  const homeName = m.home.mediumName;
  const awayName = m.away.mediumName;
  const comment = m.aiComment || a.comment;
  const fromAI = !!m.aiComment;
  const sinyaller = buildSinyaller(m);
  const kuponYorumu = buildKuponYorumu(m.prediction);
  const riskNotu = buildRiskNotu(a.surpriseScore);
  const pmeta = PRED_META[m.prediction?.label] || { guven: '—', risk: '—', color: colors.gray };
  const pickDesc = buildPickDesc(m.prediction);
  const hRating = formRating(s.home?.last5venue || s.home?.last5);
  const aRating = formRating(s.away?.last5venue || s.away?.last5);
  const hPts = s.home?.standing?.points, aPts = s.away?.standing?.points;
  const gucHome = (hPts != null && aPts != null && (hPts + aPts) > 0) ? Math.round((hPts / (hPts + aPts)) * 100) : 50;
  const gucAway = 100 - gucHome;

  const md = matchDate(m.date);
  const headerCenter = (m.status === 'finished' && m.score) ? `${m.score.home} - ${m.score.away}` : md.time;
  const dayLabel = (() => {
    const dt = new Date(m.date), now = new Date();
    const sd = (x, y) => x.toDateString() === y.toDateString();
    const tom = new Date(now); tom.setDate(now.getDate() + 1);
    if (sd(dt, now)) return 'Bugün';
    if (sd(dt, tom)) return 'Yarın';
    return md.day;
  })();

  return (
    <View style={styles.container}>
      <MatchHeader
        home={homeName} away={awayName}
        homeLogo={s.home?.logo} awayLogo={s.away?.logo}
        league={m.league}
        dateLabel={dayLabel}
        time={headerCenter}
        stadium={m.stadium || m.stadiumName || ''}
        onBack={() => navigation.goBack()}
        onShare={() => {}}
        onHomePress={s.home?.standing ? () => setTeamModal('home') : undefined}
        onAwayPress={s.away?.standing ? () => setTeamModal('away') : undefined}
      />
      <Tabs tabs={TABS} active={tab} onChange={setTab} icons={{ 'Özet': '🕐', 'Analiz': '📈', 'İstatistik': '📊', 'Karşılaştırma': '⚖️', 'Yorumlar': '💬' }} />
      {tab !== 'Yorumlar' && (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.bg }}>
          <CouponPickBlock m={m} navigation={navigation} />
        </View>
      )}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>

      {tab === 'Özet' && (
        <>
          <MatchInfoCard m={m} />
          <View style={ozetSummaryCard}>
            <Text style={infoLabel}>MAÇ ÖZETİ</Text>
            <Text style={ozetText} numberOfLines={6}>{humanize(comment)}</Text>
          </View>

          <View style={{ marginBottom: spacing.sm }}>
            <SurpriseBadge label={a.label} labelColor={a.labelColor} />
          </View>

          {/* Risk etiketleri — hızlı okunur, her biri nedenli (backend'den, veri yoksa yok) */}
          {Array.isArray(m.tags) && m.tags.length > 0 && (
            <Accordion title="Risk Etiketleri" icon="🏷️" defaultOpen>
              {m.tags.map((tg, i) => (
                <View key={i} style={{ marginBottom: 8 }}>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: '900' }}>• {tg.t}</Text>
                  <Text style={{ color: colors.textSoft, fontSize: 11.5, lineHeight: 16, fontWeight: '600', marginLeft: 12 }}>{tg.why}</Text>
                </View>
              ))}
            </Accordion>
          )}

          {sinyaller.length > 0 && (
            <Accordion title="Öne Çıkan Notlar" icon="⭐">
              {sinyaller.map((sg, i) => <Text key={i} style={styles.aBullet}>•  {sg}</Text>)}
            </Accordion>
          )}
          {(s.home?.last5?.length || s.away?.last5?.length) ? (
            <Accordion title="Son Maçlar" icon="🗓️" defaultOpen>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                <Image source={require('../../assets/venue/home-win.png')} style={{ width: 15, height: 15 }} resizeMode="contain" />
                <Text style={smLegendTxt}> iç saha   ·  </Text>
                <Image source={require('../../assets/venue/away-win.png')} style={{ width: 15, height: 15 }} resizeMode="contain" />
                <Text style={smLegendTxt}> deplasman   ·   🟢 galibiyet · 🟡 beraberlik · 🔴 mağlubiyet</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 14 }}>
                {[{ n: homeName, f: s.home?.last5, d: s.home?.last5detail }, { n: awayName, f: s.away?.last5, d: s.away?.last5detail }].map((col, ci) => (
                  <View key={ci} style={{ flex: 1 }}>
                    <Text style={smColTitle} numberOfLines={1}>{col.n}</Text>
                    {(col.d && col.d.length) ? col.d.map((d, i) => (
                      <View key={i} style={smRow}>
                        <Logo uri={d.oppLogo} name={d.oppName} size={16} />
                        <Text style={smOpp} numberOfLines={1}>{d.oppName || '—'}</Text>
                        <Text style={[smScore, { color: d.result === 'G' ? colors.green : d.result === 'M' ? colors.red : colors.textMuted }]}>{d.score}</Text>
                        <VenueIcon result={d.result} isHome={d.isHome} size={20} />
                      </View>
                    )) : <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>Detay yok</Text>}
                  </View>
                ))}
              </View>
            </Accordion>
          ) : null}
        </>
      )}

      {tab === 'Analiz' && (<>
      {/* Analiz sekmesi TAMAMEN kullanıcının seçtiği kriterlere göre çalışır.
          Sabit backend tahmini (Kazanma İhtimalleri) buradan kaldırıldı. */}
      <UserAnalysisView m={m} navigation={navigation} />
      </>)}

      {tab === 'İstatistik' && (<>
      {/* Puan Durumu — Takım Kıyası ile aynı karşılaştırma grafiği yapısı */}
      {(s.home?.standing || s.away?.standing) && (() => {
        const hs = s.home?.standing || {};
        const as = s.away?.standing || {};
        const minGd = Math.min(hs.goalDiff ?? 0, as.goalDiff ?? 0, 0);
        const sign = (n) => (n >= 0 ? '+' : '') + n;
        return (
          <Accordion title="Puan Durumu" icon="🏆" defaultOpen>
            <View style={styles.card}>
              {/* Takım adları — bar yarımlarının üstüne hizalı */}
              <View style={styles.puanHead}>
                <View style={styles.puanSpacer} />
                <Text style={[styles.puanTeam, { color: colors.green }]} numberOfLines={1}>● {homeName}</Text>
                <Text style={[styles.puanTeam, styles.puanTeamR, { color: colors.orange }]} numberOfLines={1}>{awayName} ●</Text>
                <View style={styles.puanSpacer} />
              </View>

              {/* Karşılaştırmalı bar satırları */}
              <StatRow label="Sıra" home={ord(hs.position)} away={ord(as.position)} homeBar={as.position || 1} awayBar={hs.position || 1} />
              <StatRow label="Puan" home={hs.points ?? '–'} away={as.points ?? '–'} homeBar={hs.points} awayBar={as.points} />
              <StatRow label="Averaj" home={sign(hs.goalDiff ?? 0)} away={sign(as.goalDiff ?? 0)} homeBar={(hs.goalDiff ?? 0) - minGd + 1} awayBar={(as.goalDiff ?? 0) - minGd + 1} />

              {/* Rozet / bilgi satırları (bardan ayrı) */}
              <View style={styles.cardDivider} />
              <StatRow label="O-G-B-M"
                left={<RecordBadges wins={hs.wins} draws={hs.draws} losses={hs.losses} played={hs.played} />}
                right={<RecordBadges wins={as.wins} draws={as.draws} losses={as.losses} played={as.played} align="right" />} />
              <StatRow label="İç / Dış form" sub="(ev içeride · dep dışarıda)"
                left={<RecordBadges wins={hs.home?.wins} draws={hs.home?.draws} losses={hs.home?.losses} />}
                right={<RecordBadges wins={as.away?.wins} draws={as.away?.draws} losses={as.away?.losses} align="right" />} />
              <StatRow label="Son 5 maç" sub="(içerde · dışarıda)"
                left={<FormStrip form={s.home?.last5venue} size={20} />}
                right={<FormStrip form={s.away?.last5venue} size={20} />} />

              {s.h2h && s.h2h.played > 0 && (
                <>
                  <View style={styles.cardDivider} />
                  <Text style={styles.subLabel}>Karşılıklı Geçmiş · {s.h2h.played} maç</Text>
                  <View style={styles.miniRow}>
                    <H2hCell n={s.h2h.homeWins} label={`${homeName} galibiyeti`} icon="🟢" color={colors.primary} />
                    <H2hCell n={s.h2h.draws} label="Beraberlik" icon="🤝" color={colors.gray} />
                    <H2hCell n={s.h2h.awayWins} label={`${awayName} galibiyeti`} icon="🟠" color={colors.orange} />
                  </View>
                </>
              )}

              {s.potentials && (
                <>
                  <View style={styles.cardDivider} />
                  <Text style={styles.subLabel}>Maç Beklentileri</Text>
                  <View style={styles.miniRow}>
                    <Pot label="2.5 Üst" val={`%${s.potentials.over25}`} icon="🔥" />
                    <Pot label="KG Var" val={`%${s.potentials.btts}`} icon="⚽" />
                    <Pot label="Korner" val={s.potentials.corners?.toFixed(1)} icon="🚩" />
                  </View>
                </>
              )}
            </View>
          </Accordion>
        );
      })()}

      {/* Takım Karşılaştırması — kategorilere ayrılmış */}
      {s.compare && s.compare.length > 0 && (() => {
        const head = (
          <View style={styles.cmpStatHead}>
            <Text style={[styles.cmpStatTeam, { color: colors.green }]} numberOfLines={1}>● {homeName}</Text>
            <Text style={[styles.cmpStatTeam, { color: colors.orange, textAlign: 'right' }]} numberOfLines={1}>{awayName} ●</Text>
          </View>
        );
        // pick: verilen sıra korunur (etki sırası) — s.compare sırası değil.
        const pick = (labels) => labels.map((l) => s.compare.find((c) => c.label === l)).filter(Boolean);
        // Kategoriler maça etki gücüne göre sıralı: en belirleyici en üstte.
        const cats = [
          { title: 'Gol Verimliliği', icon: '⚽', open: true, rows: pick(['Maç Başı Gol', 'Yediği Gol']) },
          { title: 'Şut İstatistikleri', icon: '🥅', rows: pick(['İsabetli Şut', 'Toplam Şut']) },
          { title: 'Hücum Baskısı', icon: '🔥', rows: pick(['Korner', 'Ofsayt']) },
          { title: 'Oyun Kontrolü', icon: '🎯', rows: pick(['Topla Oynama']) },
          { title: 'Disiplin', icon: '🛡️', rows: pick(['Faul', 'Kart']) },
        ].filter((c) => c.rows.length > 0);
        return cats.map((cat) => (
          <Accordion key={cat.title} title={cat.title} icon={cat.icon} defaultOpen={cat.open}>
            {head}
            {cat.rows.map((c, i) => <StatBar key={i} label={c.label} home={c.home} away={c.away} suffix={c.suffix} lowerBetter={['Yediği Gol', 'Faul', 'Kart'].includes(c.label)} />)}
          </Accordion>
        ));
      })()}

      {/* Lig Tablosu (tam, Son 5 ile) */}
      {s.leagueTable && ((s.leagueTable.overall?.length || s.leagueTable.length) > 0) && (
        <Accordion title="Lig Tablosu" icon="📋">
          <LeagueTableFull table={s.leagueTable} homeId={s.home?.standing?.teamId} awayId={s.away?.standing?.teamId} homeLogo={s.home?.logo} awayLogo={s.away?.logo} league={m.league} />
        </Accordion>
      )}

      {/* Kadrolar (tam) */}
      {(s.home?.squad?.length || s.away?.squad?.length) ? (
        <Accordion title="Kadrolar" icon="👥">
          <SquadSection title={homeName} squad={s.home?.squad} open={openSquad === 'home'} onToggle={() => setOpenSquad(openSquad === 'home' ? null : 'home')} />
          <SquadSection title={awayName} squad={s.away?.squad} open={openSquad === 'away'} onToggle={() => setOpenSquad(openSquad === 'away' ? null : 'away')} />
        </Accordion>
      ) : null}

      {/* Eksikler (sakatlar/cezalılar) — veri varsa */}
      {(s.injuries?.home?.length || s.injuries?.away?.length) ? (
        <Accordion title="Eksikler" icon="🚑">
          <View style={styles.playersWrap}>
            <InjuryCol title={homeName} list={s.injuries?.home} />
            <InjuryCol title={awayName} list={s.injuries?.away} />
          </View>
        </Accordion>
      ) : null}

      {!a.hasOdds && !a.estimated && (
        <Text style={styles.muted}>
          Bu maçın ligi seçili ligler arasında değil ya da oran/veri henüz açıklanmamış.
        </Text>
      )}
      </>)}

      {tab === 'Karşılaştırma' && (() => {
        const wdl = [];
        if (s.h2h && s.h2h.played > 0) {
          wdl.push({
            title: `Aralarındaki Maçlar · ${s.h2h.played}`,
            win: s.h2h.homeWins || 0, draw: s.h2h.draws || 0, loss: s.h2h.awayWins || 0,
            winLabel: `${homeName} Galibiyeti`, drawLabel: 'Beraberlik', lossLabel: `${awayName} Galibiyeti`,
          });
        }
        const single = (name, form, suffix) => {
          if (!form || !form.length) return;
          const c = countWDL(form);
          wdl.push({ title: `${name} Son 5 ${suffix}`, ...c, winLabel: 'Galibiyet', drawLabel: 'Beraberlik', lossLabel: 'Mağlubiyet' });
        };
        single(homeName, s.home?.last5, 'Maçı');
        single(awayName, s.away?.last5, 'Maçı');
        single(homeName, s.home?.last5venue, 'İç Saha Maçı');
        single(awayName, s.away?.last5venue, 'Deplasman Maçı');
        const hasAvg = (s.compare || []).some((c) => AVG_PICK.some(([k]) => k === c.label));
        if (!hasAvg && !wdl.length) {
          return <EmptyState icon="⚖️" title="Karşılaştırma verisi yok" message="Bu maç için ortalama/geçmiş verisi henüz bulunmuyor." />;
        }
        return (
          <>
            {/* Takım Kıyası (Sıra · xG · Gol/maç · İç/Dış) — Karşılaştırma sekmesinde */}
            {(() => {
              const sig = signalsFromStats(s);
              return sig ? (
                <Accordion title="Takım Kıyası" icon="⚖️" defaultOpen>
                  <CompareBars sig={sig} />
                </Accordion>
              ) : null;
            })()}
            <AvgComparison compare={s.compare} homeName={homeName} awayName={awayName} homeLogo={s.home?.logo} awayLogo={s.away?.logo} />
            <WdlCarousel slides={wdl} />
          </>
        );
      })()}

      {tab === 'Yorumlar' && (
        <CommentsSection matchId={m.sportotoMatchId || String(m.no)} />
      )}

      </ScrollView>

      <TeamStatsModal
        visible={!!teamModal}
        onClose={() => setTeamModal(null)}
        data={teamModal ? {
          name: teamModal === 'home' ? homeName : awayName,
          logo: (teamModal === 'home' ? s.home : s.away)?.logo,
          league: m.league,
          stats: teamModal === 'home' ? s.home : s.away,
        } : null}
      />
    </View>
  );
}

// --- küçük yardımcı bileşenler ---
function CmpRow({ label, h, a, bold, sub }) {
  return (
    <View style={styles.cmpRow}>
      <Text style={[styles.cmpVal, { textAlign: 'left' }, bold && styles.cmpValBold]}>{h ?? '–'}</Text>
      <View style={styles.cmpMidWrap}>
        <Text style={styles.cmpLabel}>{label}</Text>
        {sub && <Text style={styles.cmpSub}>{sub}</Text>}
      </View>
      <Text style={[styles.cmpVal, { textAlign: 'right' }, bold && styles.cmpValBold]}>{a ?? '–'}</Text>
    </View>
  );
}

// Kazanma ihtimali — kalın dolu barlar, yüzde bar içinde ortalı (1=mavi, X=gri, 2=sarı)
function ProbBars({ probabilities }) {
  if (!probabilities) return <Text style={styles.muted}>Oran yok</Text>;
  const segs = [
    { k: '1', v: probabilities['1'], c: colors.primary },
    { k: 'X', v: probabilities['X'], c: colors.gray },
    { k: '2', v: probabilities['2'], c: colors.yellow },
  ];
  return (
    <View style={styles.pbWrap}>
      {segs.map((s) => (
        <View key={s.k} style={[styles.pbSeg, { flex: Math.max(s.v, 1), backgroundColor: s.c }]}>
          <Text style={styles.pbK}>{s.k}</Text>
          <Text style={styles.pbV}>%{s.v}</Text>
        </View>
      ))}
    </View>
  );
}

// Takım Kıyası tarzı karşılaştırma satırı: ortada metrik, solda yeşil/ev, sağda turuncu/deplasman.
// Sayısal satırlarda bar; rozet/form satırlarında left/right öğeleri.
function StatRow({ label, sub, home, away, homeBar, awayBar, suffix, left, right }) {
  const custom = left != null || right != null;
  // Rozet/bilgi satırı: 3 kolon (sol değer · ortada başlık · sağ değer), bar yok
  if (custom) {
    return (
      <View style={styles.srRow}>
        <View style={styles.badgeRow}>
          <View style={styles.badgeSide}>{left}</View>
          <View style={styles.badgeMid}>
            <Text style={styles.srLabel}>{label}</Text>
            {sub ? <Text style={styles.srSub}>{sub}</Text> : null}
          </View>
          <View style={[styles.badgeSide, styles.badgeRight]}>{right}</View>
        </View>
      </View>
    );
  }
  const hb = Math.max(0, homeBar != null ? homeBar : Number(home) || 0);
  const ab = Math.max(0, awayBar != null ? awayBar : Number(away) || 0);
  const total = hb + ab || 1;
  return (
    <View style={styles.srRow}>
      <Text style={styles.srLabel}>{label}</Text>
      {sub ? <Text style={styles.srSub}>{sub}</Text> : null}
      <View style={styles.srBars}>
        <Text style={styles.srVal}>{home}{suffix || ''}</Text>
        <View style={styles.srHalf}>
          <View style={[styles.srFill, { width: `${(hb / total) * 100}%`, alignSelf: 'flex-end', backgroundColor: colors.green }]} />
        </View>
        <View style={styles.srHalf}>
          <View style={[styles.srFill, { width: `${(ab / total) * 100}%`, backgroundColor: colors.orange }]} />
        </View>
        <Text style={[styles.srVal, { textAlign: 'right' }]}>{away}{suffix || ''}</Text>
      </View>
    </View>
  );
}

function BadgeRow({ label, sub, home, away, played }) {
  return (
    <View style={styles.cmpRow}>
      <View style={{ flex: 1, alignItems: 'flex-start' }}>
        <RecordBadges wins={home?.wins} draws={home?.draws} losses={home?.losses} played={played ? home?.played : undefined} />
      </View>
      <View style={styles.cmpMidWrap}>
        <Text style={styles.cmpLabel}>{label}</Text>
        {sub ? <Text style={styles.cmpSub}>{sub}</Text> : null}
      </View>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <RecordBadges wins={away?.wins} draws={away?.draws} losses={away?.losses} played={played ? away?.played : undefined} align="right" />
      </View>
    </View>
  );
}

function PlayerCol({ title, players }) {
  return (
    <View style={styles.playerCol}>
      <Text style={styles.playerColTitle} numberOfLines={1}>{title}</Text>
      {players && players.length ? players.map((p, i) => (
        <View key={i} style={styles.playerRow}>
          <Text style={styles.playerRole}>{p.icon} {p.role}</Text>
          <Text style={styles.playerName} numberOfLines={1}>{p.name}</Text>
          <Text style={styles.playerLine}>{p.line}</Text>
        </View>
      )) : <Text style={styles.muted}>Veri yok</Text>}
    </View>
  );
}

function InjuryCol({ title, list }) {
  return (
    <View style={styles.playerCol}>
      <Text style={styles.playerColTitle} numberOfLines={1}>{title}</Text>
      {list && list.length ? list.map((p, i) => (
        <View key={i} style={styles.playerRow}>
          <Text style={styles.playerName} numberOfLines={1}>🚑 {p.name}</Text>
          {p.reason ? <Text style={styles.playerLine}>{p.reason}</Text> : null}
        </View>
      )) : <Text style={styles.muted}>Bilinen eksik yok</Text>}
    </View>
  );
}

function H2hCell({ n, label, icon, color }) {
  return (
    <View style={[styles.miniCard, { borderColor: color + '66', backgroundColor: color + '14' }]}>
      <Text style={styles.miniIcon}>{icon}</Text>
      <Text style={[styles.miniNum, { color }]}>{n}</Text>
      <Text style={styles.miniLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
}

function Pot({ label, val, icon }) {
  return (
    <View style={styles.miniCard}>
      <Text style={styles.miniIcon}>{icon}</Text>
      <Text style={styles.potValBig}>{val}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

// Tam kadro — açılır/kapanır, yatay kaydırmalı tablo
const POS_LONG = { K: 'Kaleci', D: 'Defans', O: 'Orta Saha', F: 'Forvet' };
function SquadSection({ title, squad, open, onToggle }) {
  if (!squad || !squad.length) return null;
  return (
    <View style={styles.squadCard}>
      <TouchableOpacity style={styles.squadHead} activeOpacity={0.7} onPress={onToggle}>
        <Text style={styles.squadTitle} numberOfLines={1}>{title}  ·  {squad.length} oyuncu</Text>
        <Text style={styles.squadChevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View style={[styles.sqRow, styles.sqHead]}>
              <Text style={[styles.sqH, styles.sqName]}>Oyuncu</Text>
              <Text style={[styles.sqH, styles.sqPos]}>Poz</Text>
              <Text style={[styles.sqH, styles.sqCell]}>Yaş</Text>
              <Text style={[styles.sqH, styles.sqCell]}>Maç</Text>
              <Text style={[styles.sqH, styles.sqCell]}>⚽</Text>
              <Text style={[styles.sqH, styles.sqCell]}>As</Text>
              <Text style={[styles.sqH, styles.sqCell]}>🟨</Text>
              <Text style={[styles.sqH, styles.sqCell]}>🟥</Text>
            </View>
            {squad.map((p, i) => (
              <View key={i} style={[styles.sqRow, i % 2 === 1 && styles.sqAlt]}>
                <View style={styles.sqNameCell}>
                  {countryCode(p.nat) ? (
                    <Image source={{ uri: `https://flagcdn.com/32x24/${countryCode(p.nat)}.png` }} style={styles.sqFlag} resizeMode="contain" />
                  ) : null}
                  <Text style={styles.sqNameText} numberOfLines={1}>{p.name}</Text>
                </View>
                <Text style={[styles.sqD, styles.sqPos, styles.tMuted]} numberOfLines={1}>{POS_LONG[p.pos] || p.pos}</Text>
                <Text style={[styles.sqD, styles.sqCell, styles.tMuted]}>{p.age || '-'}</Text>
                <Text style={[styles.sqD, styles.sqCell]}>{p.apps}</Text>
                <Text style={[styles.sqD, styles.sqCell, styles.tBold]}>{p.goals || ''}</Text>
                <Text style={[styles.sqD, styles.sqCell]}>{p.assists || ''}</Text>
                <Text style={[styles.sqD, styles.sqCell]}>{p.yellow || ''}</Text>
                <Text style={[styles.sqD, styles.sqCell]}>{p.red || ''}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// Tam lig tablosu — Genel / İç Saha / Dış Saha sekmeli, yatay kaydırmalı
// Lig tablosu satır logosu — gerçek arma varsa onu, yoksa nötr küçük placeholder.
function TableLogo({ logo }) {
  const [err, setErr] = useState(false);
  if (logo && !err) {
    return <Image source={{ uri: logo }} style={styles.tlImg} resizeMode="contain" onError={() => setErr(true)} />;
  }
  return <View style={styles.tlPh} />;
}

const LT_TABS = [
  { key: 'overall', label: 'Tümü' },
  { key: 'home', label: 'İç Saha' },
  { key: 'away', label: 'Deplasman' },
];

// Pozisyon bölgeleri — Avrupa ligi düzenine göre görsel yaklaşım (yalnızca
// tasarım/renk amaçlı; gerçek kupa kotaları lige göre değişebilir).
function zoneOf(pos, n) {
  if (pos === 1) return 'ucl';
  if (pos <= 3) return 'conf';
  if (n >= 6 && pos === n - 2) return 'playoff';
  if (n >= 6 && pos >= n - 1) return 'releg';
  return null;
}
const ZONE_COLOR = { ucl: colors.info, conf: colors.success, playoff: colors.warning, releg: colors.danger };
const ZONE_LEGEND = [
  { key: 'ucl', label: 'Şampiyonlar Ligi Eleme' },
  { key: 'conf', label: 'Konferans Ligi Eleme' },
  { key: 'playoff', label: 'Küme Düşme Play-off' },
  { key: 'releg', label: 'Küme Düşme' },
];

// Tek kart · Tümü/İç Saha/Deplasman sekmeli tam lig tablosu.
function LeagueTableFull({ table, homeId, awayId, homeLogo, awayLogo, league }) {
  // Eski sürümle uyum: table dizi gelirse genel kabul et
  const variants = Array.isArray(table) ? { overall: table, home: [], away: [] } : (table || {});
  const tabs = LT_TABS.filter((t) => variants[t.key] && variants[t.key].length > 0);
  const [view, setView] = useState('overall');
  const active = variants[view] && variants[view].length ? view : 'overall';
  const rows = variants[active] || [];
  const N = rows.length;

  return (
    <View style={styles.ltCard}>
      {league ? <Text style={styles.ltTitle} numberOfLines={1}>{league}</Text> : null}

      {tabs.length > 1 && (
        <View style={styles.ltTabs}>
          {tabs.map((t) => {
            const on = t.key === active;
            return (
              <TouchableOpacity key={t.key} activeOpacity={0.8} onPress={() => setView(t.key)} style={[styles.ltTab, on && styles.ltTabOn]}>
                <Text style={[styles.ltTabTxt, on && styles.ltTabTxtOn]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={[styles.ltR, styles.ltHeadR]}>
        <Text style={[styles.ltHc, styles.cPos]}>#</Text>
        <Text style={[styles.ltHc, styles.cName]}>Takım</Text>
        <Text style={[styles.ltHc, styles.cN]}>O</Text>
        <Text style={[styles.ltHc, styles.cN]}>G</Text>
        <Text style={[styles.ltHc, styles.cN]}>B</Text>
        <Text style={[styles.ltHc, styles.cN]}>M</Text>
        <Text style={[styles.ltHc, styles.cAv]}>Av.</Text>
        <Text style={[styles.ltHc, styles.cP]}>P</Text>
      </View>

      {rows.map((r, idx) => {
        const isHome = r.teamId === homeId;
        const isAway = r.teamId === awayId;
        const mine = isHome || isAway;
        const z = zoneOf(r.position, N);
        return (
          <View key={r.teamId} style={[styles.ltR, idx % 2 === 1 && styles.ltAltR, isHome && styles.ltMineHome, isAway && styles.ltMineAway, { borderLeftColor: z ? ZONE_COLOR[z] : 'transparent' }]}>
            <Text style={[styles.ltDc, styles.cPos, styles.tMuted]}>{r.position}</Text>
            <View style={[styles.cName, styles.ltNameCell]}>
              <TableLogo logo={r.logo || (isHome ? homeLogo : isAway ? awayLogo : '')} />
              <Text style={[styles.ltNameTxt, mine && styles.tBold]} numberOfLines={1}>{r.name}</Text>
            </View>
            <Text style={[styles.ltDc, styles.cN, styles.tMuted]}>{r.played}</Text>
            <Text style={[styles.ltDc, styles.cN]}>{r.wins}</Text>
            <Text style={[styles.ltDc, styles.cN]}>{r.draws}</Text>
            <Text style={[styles.ltDc, styles.cN]}>{r.losses}</Text>
            <Text style={[styles.ltDc, styles.cAv, styles.tMuted]}>{r.goalDiff >= 0 ? '+' : ''}{r.goalDiff}</Text>
            <Text style={[styles.ltDc, styles.cP]}>{r.points}</Text>
          </View>
        );
      })}

      <View style={styles.ltLegend}>
        {ZONE_LEGEND.map((z) => (
          <View key={z.key} style={styles.ltLgItem}>
            <View style={[styles.ltLgBar, { backgroundColor: ZONE_COLOR[z.key] }]} />
            <Text style={styles.ltLgTxt}>{z.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// --- analiz metni: teknik terimleri anlaşılır Türkçeye çevir ---
const TERM_MAP = [
  [/beklenen gol \(xg\)/gi, 'gol beklentisi'],
  [/\bH2H\b/gi, 'karşılıklı maç geçmişi'],
  [/\bxG\b/gi, 'gol beklentisi'],
  [/\bedge\b/gi, 'avantaj'],
  [/model confidence/gi, 'model güveni'],
  [/raw probability/gi, 'kazanma ihtimali'],
];
function humanize(t) {
  let str = String(t || '');
  for (const [re, rep] of TERM_MAP) str = str.replace(re, rep);
  return str;
}
const capTr = (x) => (x ? x.charAt(0).toLocaleUpperCase('tr') + x.slice(1) : x);

// Tahmin gerekçesini madde madde "Güçlü Sinyaller" listesine çevirir.
function buildSinyaller(m) {
  return String(m.prediction?.reason || '')
    .split(/[;·]/)
    .map((x) => x.trim())
    .filter((x) => x && !/^oran yok/i.test(x))
    .map((x) => capTr(humanize(x)));
}

// Kupon yorumu — tahmin etiketiyle tutarlı, çelişkisiz cümle.
function buildKuponYorumu(p) {
  if (!p || p.symbol === '-') return '';
  const mean = p.meaning || '';
  if (p.label === 'BANKO') {
    return `${mean} seçeneği güçlü şekilde öne çıkıyor. Yine de geçmiş karşılaşmalardaki denge göz önünde bulundurularak kontrollü değerlendirilmeli.`;
  }
  if (p.label === 'NET' || p.label === 'TEMKİNLİ') {
    return `${mean} seçeneği öne çıkıyor; risk dengesi makul görünüyor.`;
  }
  return `Tek bir sonuç net değil; "${mean}" tercihiyle riski dağıtmak daha mantıklı.`;
}

// Risk notu — sürpriz puanından okunabilir seviye.
function buildRiskNotu(score) {
  if (score == null) return '';
  if (score < 25) return 'Risk seviyesi düşük — dengeli ve güçlü bir görünüm.';
  if (score <= 45) return 'Risk seviyesi orta — sonuç tartışmaya açık, kontrollü ilerleyin.';
  return 'Risk seviyesi yüksek — sürprize oldukça açık bir maç.';
}

// Sürpriz puanı → risk seviyesi (yazı + renk).
function riskOf(score) {
  if (score == null) return null;
  if (score <= 25) return { word: 'Düşük risk', color: colors.green };
  if (score <= 50) return { word: 'Orta risk', color: colors.yellow };
  if (score <= 75) return { word: 'Yüksek risk', color: colors.orange };
  return { word: 'Çok yüksek risk', color: colors.red };
}
const LABEL_EXPLAIN = {
  BANKO: 'Tahmin güçlü, risk düşük; güvenli görünen bir maç.',
  DİKKAT: 'Tahmin öne çıksa da bazı veriler risk oluşturuyor; kupon yaparken kontrollü değerlendirilmelidir.',
  'SÜRPRİZE AÇIK': 'Beklenmeyen sonuç ihtimali yüksek; sürprize oldukça açık bir maç.',
};
const SURPRISE_EXPLAIN = "Sürpriz Puanı, maçta beklenmeyen sonuç çıkma ihtimalini gösterir. 0'a yakın değer düşük sürpriz riski, 100'e yakın değer yüksek sürpriz riski anlamına gelir.";

// Kupon tipine göre güven/risk seviyesi ve vurgu rengi (görsel sunum).
const PRED_META = {
  BANKO: { guven: 'Yüksek', risk: 'Kontrollü', color: colors.green },
  NET: { guven: 'Yüksek', risk: 'Düşük', color: colors.primary },
  TEMKİNLİ: { guven: 'Orta', risk: 'Orta', color: colors.yellow },
  ÇİFTE: { guven: 'Orta', risk: 'Orta', color: colors.yellow },
  AÇIK: { guven: 'Düşük', risk: 'Yüksek', color: colors.red },
};
const SYM_WHO = {
  '1': 'Ev sahibi', '0': 'Beraberlik', '2': 'Deplasman',
  '10': 'Ev / Beraberlik', '02': 'Beraberlik / Dep.', '12': 'Ev / Deplasman', '102': 'Üç ihtimal',
};
function buildPickDesc(p) {
  if (!p || p.symbol === '-') return '';
  if (p.label === 'BANKO') return 'Mevcut tablo bu seçeneği güçlü gösteriyor. Risk tamamen sıfır değildir; kontrollü değerlendirilmelidir.';
  if (p.label === 'NET' || p.label === 'TEMKİNLİ') return 'Göstergeler bu yönü destekliyor; risk dengesi makul görünüyor.';
  return 'Sonuç net değil; bu seçenek riski daha dengeli dağıtıyor.';
}

// --- biçimleyiciler ---
const ord = (p) => (p ? `${p}.` : null);
const wdl = (s) => (s ? `${s.played} · ${s.wins}G ${s.draws}B ${s.losses}M` : null);
const gd = (s) => (s ? `${s.goalsFor}-${s.goalsAgainst} (${s.goalDiff >= 0 ? '+' : ''}${s.goalDiff})` : null);
const rec = (r) => (r ? `${r.wins}G ${r.draws}B ${r.losses}M` : null);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  league: { color: colors.textMuted, fontSize: 13 },
  teams: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 2 },
  score: { color: colors.primary, fontSize: 15, fontWeight: '700', marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
  scoreNum: { color: colors.textMuted, fontSize: 14, flexShrink: 1 },
  infoIcon: { fontSize: 15 },
  infoBox: { backgroundColor: colors.cardAlt, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.sm },
  infoLine: { color: colors.textMuted, fontSize: 12.5, lineHeight: 18 },
  infoKey: { color: colors.text, fontWeight: '800' },
  scoreBig: { color: colors.text, fontSize: 18, fontWeight: '800' },

  predCard: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.md,
    backgroundColor: colors.cardAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    borderLeftWidth: 4, padding: spacing.lg, marginTop: spacing.lg,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  pcTop: { flex: 1, minWidth: 240, flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  pcLeft: { width: 60, alignItems: 'center', justifyContent: 'center' },
  pcSymbol: { width: 56, height: 56, borderRadius: radius.md, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  pcSymbolTxt: { fontSize: 24, fontWeight: '900', letterSpacing: 0.5 },
  pcWho: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 5, textAlign: 'center' },
  pcMid: { flex: 1, justifyContent: 'center' },
  pcKicker: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  pcMain: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: 2 },
  pcDesc: { color: colors.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: 5 },
  pcBullet: { color: colors.text, fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  pcRight: { minWidth: 132, justifyContent: 'center', gap: 7, paddingLeft: spacing.sm },
  pcBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.sm, borderWidth: 1.5 },
  pcBadgeTxt: { fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  pcMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  pcMetaK: { color: colors.textMuted, fontSize: 12.5 },
  pcMetaV: { color: colors.text, fontSize: 12.5, fontWeight: '800' },

  commentCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.lg },
  commentLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  aiTag: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  comment: { color: colors.text, fontSize: 15, lineHeight: 22 },
  aSub: { color: colors.primary, fontSize: 13, fontWeight: '800', marginTop: spacing.md, marginBottom: 4 },
  aBullet: { color: colors.text, fontSize: 14, lineHeight: 21, marginBottom: 3 },

  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: spacing.xl, marginBottom: spacing.sm },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg },
  probCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg },
  pbWrap: { flexDirection: 'row', height: 46, borderRadius: 10, overflow: 'hidden', gap: 3 },
  pbSeg: { alignItems: 'center', justifyContent: 'center' },
  pbK: { color: colors.bg, fontSize: 12, fontWeight: '900' },
  pbV: { color: colors.bg, fontSize: 14, fontWeight: '800', marginTop: 1 },
  srRow: { marginVertical: 7 },
  srLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  srSub: { color: colors.textMuted, fontSize: 9, textAlign: 'center', marginBottom: 4 },
  srBars: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  srVal: { width: 46, color: colors.text, fontSize: 13, fontWeight: '700' },
  srHalf: { flex: 1, height: 8, backgroundColor: colors.track, borderRadius: 4, overflow: 'hidden' },
  srFill: { height: 8, borderRadius: 4 },
  srSide: { flex: 1, alignItems: 'flex-start' },
  // rozet satırı 3 kolon
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badgeSide: { flex: 1, alignItems: 'flex-start', justifyContent: 'center' },
  badgeRight: { alignItems: 'flex-end' },
  badgeMid: { alignItems: 'center', paddingHorizontal: 4 },
  estNote: { color: colors.textMuted, fontSize: 11, fontStyle: 'italic', marginTop: 8 },

  // puan durumu karşılaştırması
  cmpHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: spacing.sm, marginBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  cmpTeam: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '800' },
  cmpMid: { width: 96 },
  cmpRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  cmpVal: { flex: 1, color: colors.text, fontSize: 14 },
  cmpValBold: { fontWeight: '800', fontSize: 15 },
  cmpMidWrap: { width: 110, alignItems: 'center' },
  cmpLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  cmpSub: { color: colors.textMuted, fontSize: 9, textAlign: 'center', marginTop: 1 },

  // ortak tablo
  tableCard: { backgroundColor: colors.card, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  tRowHi: { backgroundColor: colors.primary + '24' },
  tMuted: { color: colors.textMuted },
  tBold: { fontWeight: '800', color: colors.text },
  legend: { color: colors.textMuted, fontSize: 11, marginTop: 6, paddingHorizontal: 2 },

  // kadro tablosu
  squadCard: { backgroundColor: colors.card, borderRadius: radius.md, marginBottom: spacing.sm, overflow: 'hidden' },
  squadHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
  squadTitle: { color: colors.primary, fontSize: 14, fontWeight: '800', flex: 1 },
  squadChevron: { color: colors.textMuted, fontSize: 12, marginLeft: 8 },
  sqRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  sqHead: { borderTopWidth: 0 },
  sqAlt: { backgroundColor: colors.cardAlt + '66' },
  sqH: { color: colors.textMuted, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  sqD: { color: colors.text, fontSize: 12.5, textAlign: 'center' },
  sqName: { width: 150, textAlign: 'left' },
  sqNameCell: { width: 150, flexDirection: 'row', alignItems: 'center', gap: 5 },
  sqNameText: { flex: 1, color: colors.text, fontSize: 12.5 },
  sqFlag: { width: 18, height: 13, borderRadius: 2, backgroundColor: colors.cardAlt },
  sqPos: { width: 66 },
  sqCell: { width: 36 },
  sqDk: { width: 46 },

  // lig tablosu (tam) — tek kart, Tümü/İç Saha/Deplasman sekmeli
  ltCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', paddingBottom: spacing.sm },
  ltTitle: { color: colors.text, fontSize: 13.5, fontWeight: '800', paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  ltTabs: { flexDirection: 'row', backgroundColor: colors.cardAlt, borderRadius: radius.sm, padding: 3, marginHorizontal: spacing.md, marginBottom: spacing.sm },
  ltTab: { flex: 1, paddingVertical: 6, borderRadius: radius.sm - 3, alignItems: 'center' },
  ltTabOn: { backgroundColor: colors.accent },
  ltTabTxt: { color: colors.textSoft, fontSize: 12.5, fontWeight: '700' },
  ltTabTxtOn: { color: colors.white, fontWeight: '800' },

  ltR: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingRight: spacing.sm, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  ltHeadR: { backgroundColor: colors.surfaceSoft, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 7 },
  ltAltR: { backgroundColor: colors.surfaceSoft },
  ltMineHome: { backgroundColor: colors.info + '18' },
  ltMineAway: { backgroundColor: colors.warning + '20' },
  ltHc: { color: colors.muted, fontSize: 11.5, fontWeight: '800', textAlign: 'center' },
  ltDc: { color: colors.text, fontSize: 13, textAlign: 'center' },
  ltNameCell: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  ltNameTxt: { flex: 1, textAlign: 'left', color: colors.text, fontSize: 13 },
  tlImg: { width: 18, height: 18, borderRadius: 3 },
  tlPh: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.border },
  cPos: { width: 32, paddingLeft: 6, textAlign: 'left' },
  cName: { flex: 1, minWidth: 90, textAlign: 'left' },
  cN: { width: 26 },
  cAv: { width: 34 },
  cP: { width: 30, fontWeight: '900', color: colors.text },
  ltLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  ltLgItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ltLgBar: { width: 4, height: 14, borderRadius: 2 },
  ltLgTxt: { color: colors.textSoft, fontSize: 10.5, fontWeight: '600' },

  // Karşılaştırma — maç başına ortalamalar
  avgCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  avgHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  avgTeam: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  avgTeamTxt: { flex: 1, color: colors.text, fontSize: 12.5, fontWeight: '800' },
  avgTitle: { color: colors.textSoft, fontSize: 12.5, fontWeight: '700', textAlign: 'center', marginTop: 6, marginBottom: 2 },
  avgRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  avgVal: { width: 56, color: colors.text, fontSize: 14.5, fontWeight: '800' },
  avgValR: { textAlign: 'right' },
  avgLabel: { flex: 1, color: colors.textSoft, fontSize: 12.5, fontWeight: '600', textAlign: 'center' },

  // Karşılaştırma — G/B/M carousel
  wdlCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  wdlTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  wdlArrow: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border },
  wdlArrowTxt: { color: colors.textSoft, fontSize: 19, fontWeight: '800', lineHeight: 21, marginTop: -2 },
  wdlTitle: { flex: 1, color: colors.text, fontSize: 13.5, fontWeight: '800', textAlign: 'center', paddingHorizontal: 6 },
  wdlBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.surfaceSoft, marginBottom: spacing.md },
  wdlSeg: { height: 8 },
  wdlBoxes: { flexDirection: 'row', gap: 8 },
  wdlBox: { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 7 },
  wdlBadge: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  wdlBadgeTxt: { fontSize: 12.5, fontWeight: '900' },
  wdlBoxLabel: { flex: 1, color: colors.textSoft, fontSize: 10.5, fontWeight: '700' },
  wdlDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.md },
  wdlDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
  wdlDotOn: { backgroundColor: colors.accent },

  // iç/dış saha sekmeleri (segment kontrol)
  segWrap: { flexDirection: 'row', backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: 3, marginBottom: spacing.sm },
  segTab: { flex: 1, paddingVertical: 7, borderRadius: radius.sm, alignItems: 'center' },
  segTabOn: { backgroundColor: colors.primary },
  segTxt: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  segTxtOn: { color: colors.bg, fontWeight: '800' },

  // oyuncular / eksikler
  playersWrap: { flexDirection: 'row', gap: spacing.md },
  playerCol: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md },
  playerColTitle: { color: colors.primary, fontSize: 13, fontWeight: '800', marginBottom: spacing.sm },
  playerRow: { paddingVertical: 5, borderTopWidth: 1, borderTopColor: colors.border },
  playerRole: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  playerName: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: 1 },
  playerLine: { color: colors.textMuted, fontSize: 11, marginTop: 1 },

  // kart içi alt bölümler (H2H + Maç Beklentileri, Puan Durumu kartının içinde)
  cardDivider: { height: 1, backgroundColor: colors.border, marginTop: spacing.lg, marginBottom: spacing.md },
  subLabel: { color: colors.text, fontSize: 14, fontWeight: '800', marginBottom: spacing.sm },

  // mini analiz kartları (H2H + Maç Beklentileri)
  miniRow: { flexDirection: 'row', gap: spacing.sm },
  miniCard: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.lg, paddingHorizontal: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardAlt },
  miniIcon: { fontSize: 19, marginBottom: 4 },
  miniNum: { fontSize: 28, fontWeight: '900' },
  potValBig: { color: colors.text, fontSize: 24, fontWeight: '900' },
  miniLabel: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 3, lineHeight: 15 },

  // h2h (eski)
  h2hRow: { flexDirection: 'row' },
  h2hCell: { flex: 1, alignItems: 'center' },
  h2hNum: { fontSize: 26, fontWeight: '900' },
  h2hLabel: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 2 },

  // sezon kıyas
  cmpStatHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  cmpStatTeam: { flex: 1, fontSize: 13, fontWeight: '800' },
  // Puan Durumu başlığı — takım adları bar yarımlarının üstüne hizalı
  puanHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  puanSpacer: { width: 46 },
  puanTeam: { flex: 1, fontSize: 13.5, fontWeight: '800' },
  puanTeamR: { textAlign: 'right' },

  // potansiyel
  potRow: { flexDirection: 'row' },
  potCell: { flex: 1, alignItems: 'center' },
  potVal: { color: colors.text, fontSize: 20, fontWeight: '900' },
  potLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },

  // faktörler
  factorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  factorLabel: { color: colors.text, fontSize: 14, flex: 1 },
  factorPts: { color: colors.red, fontSize: 14, fontWeight: '800' },
  muted: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm, lineHeight: 18 },
});
