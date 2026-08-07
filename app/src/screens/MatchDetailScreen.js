import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { api } from '../api';
import { colors, spacing, radius } from '../theme';
import { SurpriseBadge, RecordBadges } from '../components';
import { countryCode, matchDate } from '../utils';
import CommentsSection from '../CommentsSection';
import { MatchHeader, Tabs, Accordion, SectionCard, Logo } from '../ui';
import CouponPickBlock from '../components/CouponPickBlock';
import MatchInfoCard from '../components/MatchInfoCard';
import KriterBasariListesi from '../components/KriterBasariListesi';
import MacRadarPaneli from '../components/MacRadarPaneli';
import { statsFromLog, derivedStats } from '../analysis/criteria';
import MasterAnalysisView from '../components/MasterAnalysisView';
import TeamCompareRadar from '../components/TeamCompareRadar';
import TakimFiksturModal from '../components/TakimFiksturModal';
import { crestUrlOf } from '../crestUrl';
import { API_BASE } from '../config';

// Karşılaştırma ayrı sekme DEĞİL: içeriği İstatistik sekmesinin altında (kullanıcı kararı).
// RADAR SEKMESİ (kullanıcı isteği, 2026-08-07): Radar 3/4/5 maçın içinde,
// YALNIZ bu maçın kendi sırasıyla. Radar ekranı 15 maçı birden listeler;
// maçın içindeyken tek satır lazım.
const TABS = ['Özet', 'Analiz', 'İstatistik', 'Radar', 'Yorumlar'];
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
// NOT: takım kartındaki sezon istatistiği modalı (TeamStatsModal) kaldırıldı —
// takım kartı artık fikstür açıyor (bkz. TakimFiksturModal). Sezon
// istatistikleri "İstatistik" sekmesinde duruyor.
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
        <TouchableOpacity onPress={() => go(-1)} style={styles.wdlArrow} activeOpacity={0.6} disabled={n < 2} accessibilityRole="button" accessibilityLabel="Önceki istatistik">
          <Text style={styles.wdlArrowTxt}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.wdlTitle} numberOfLines={1}>{cur.title}</Text>
        <TouchableOpacity onPress={() => go(1)} style={styles.wdlArrow} activeOpacity={0.6} disabled={n < 2} accessibilityRole="button" accessibilityLabel="Sonraki istatistik">
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
  // İstatistik sekmesi filtresi (Genel Filtreler'in yeni evi — görünüm katmanı).
  // İstatistik karne filtresi — yalnız Dönem + Saha (Rakip gücü filtresi
  // kullanıcı kararıyla panelden tamamen kaldırıldı; altın kural sınıflaması
  // analiz/radar tarafında yaşamaya devam eder).
  const [statF, setStatF] = useState({ period: 'season', venueScope: 'overall' });

  useEffect(() => {
    api.match(no).then(setM).catch((e) => setError(e.message));
  }, [no]);

  if (error) return <View style={styles.center}><Text style={styles.muted}>{error}</Text></View>;
  if (!m) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  const a = m.analysis;
  const s = m.stats || {};
  const homeName = m.home.mediumName;
  const awayName = m.away.mediumName;
  // Fikstür, kaynak takım kimliği olmadan çekilemez. Kimlik yoksa takım
  // adının altındaki bağlantı HİÇ çizilmez — tıklanıp boş açılan bir kart
  // olmaz (kapsam dışı maçlarda bu kimlikler gelmiyor).
  const fiksturVar = {
    home: !!(m.footyHomeId && m.footySeasonId),
    away: !!(m.footyAwayId && m.footySeasonId),
  };
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
        onHomePress={fiksturVar.home ? () => setTeamModal('home') : undefined}
        onAwayPress={fiksturVar.away ? () => setTeamModal('away') : undefined}
      />
      <Tabs tabs={TABS} active={tab} onChange={setTab} icons={{ 'Özet': '🕐', 'Analiz': '📈', 'İstatistik': '📊', Radar: '🎯', 'Yorumlar': '💬' }} />
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
      {/* MASTER ANALİZ — kriter hesabının tek doğruluk kaynağı BACKEND'dir.
          Kullanıcının seçtiği kriterler sunucuda hesaplanır; mühürlü haftada
          mühürlü değerlendirme gösterilir. Radar kıyası ayrı sistem olarak sunulur. */}
      <MasterAnalysisView m={m} navigation={navigation} />
      {/* KRİTER BAŞARILARI (kullanıcı kararı, 2026-08-07). Burada eskiden
          kullanıcının kriter seçtiği panel vardı; o sistem tamamen kaldırıldı.
          Yerine kriterlerin GEÇMİŞ karnesi geldi: satıra dokununca o kriterin
          yön verdiği bütün maçlar oranı ve oynanma yüzdesiyle listelenir.
          Ekran hüküm vermez — "bu kriter iyidir" demez; kullanıcı ham maçlara
          bakarak kendi kararını verir. */}
      <KriterBasariListesi navigation={navigation} />
      </>)}

      {tab === 'Radar' && <MacRadarPaneli m={m} />}

      {/* 🎛️ FİLTRELİ KARNE — İstatistik sekmesinin merkezi. Görsel dil: kullanıcının
          referans ekran görüntüsü ("hepsi bu şekilde olsun") — logolu başlık,
          ortalanmış bölüm başlığı, solda/sağda kalın değer, ortada soluk etiket,
          ince ayraçlı satırlar; bar yok. Filtre yalnız Dönem + Saha (Rakip gücü
          filtresi kullanıcı kararıyla kaldırıldı). Her kesit maç logundan GERÇEK
          maçlarla hesaplanır; log yoksa dürüst geri düşüş: resmi sezon karnesi. */}
      {/* 🕸️ GÜÇ KARŞILAŞTIRMASI — iki takımın gerçek istatistiklerinden radar;
          yeterli ortak veri yoksa bileşen kendini gizler (uydurma eksen yok). */}
      {tab === 'İstatistik' ? (
        <TeamCompareRadar home={s.home} away={s.away} homeName={homeName} awayName={awayName} />
      ) : null}

      {tab === 'İstatistik' && (() => {
        const F_DIMS = [
          { k: 'period', label: 'Dönem', opts: [['season', 'Sezon'], ['last5', 'Son 5'], ['last10', 'Son 10'], ['last15', 'Son 15']] },
          { k: 'venueScope', label: 'Saha', opts: [['overall', 'Genel'], ['home', 'İçeride'], ['away', 'Dışarıda'], ['split', 'İç/Dış']] },
        ];
        const hv = statsFromLog(s.home, statF, 'home');
        const av = statsFromLog(s.away, statF, 'away');
        const noLog = hv == null || av == null;
        const tooFew = !noLog && ((hv.n || 0) < 2 || (av.n || 0) < 2);
        const num = (x) => (x == null ? '—' : x);
        // Maç logu yoksa (eski cache): resmi sezon karnesine dürüstçe geri düş,
        // filtre çiplerini hiç gösterme (tıklanıp da değişmeyen filtre = kafa karışıklığı).
        if (noLog) {
          const hstd = s.home?.standing, astd = s.away?.standing;
          const pp = (t) => (t && t.played > 0 && t.points != null ? Math.round((t.points / t.played) * 100) / 100 : null);
          return (
            <SectionCard>
              <CmpHead s={s} homeName={homeName} awayName={awayName} />
              <CmpTitle>Karne</CmpTitle>
              {(hstd || astd) ? (
                <>
                  <CmpRow label="Maç" home={num(hstd?.played)} away={num(astd?.played)} />
                  <CmpRow label="G-B-M"
                    left={hstd ? <RecordBadges wins={hstd.wins} draws={hstd.draws} losses={hstd.losses} /> : <Text style={styles.clVal}>—</Text>}
                    right={astd ? <RecordBadges wins={astd.wins} draws={astd.draws} losses={astd.losses} align="right" /> : <Text style={[styles.clVal, styles.clValR]}>—</Text>} />
                  <CmpRow label="Puan / Maç" home={num(pp(hstd))} away={num(pp(astd))} last />
                </>
              ) : (
                <Text style={styles.muted}>Bu maç için karne verisi bulunamadı.</Text>
              )}
              <Text style={styles.fltHint}>Filtreler bu maçta henüz kullanılamıyor — maç logu bir sonraki bülten tazelemesinde oluşur. Yukarıdaki değerler resmi sezon karnesidir; uydurma hesap yapılmaz.</Text>
            </SectionCard>
          );
        }
        return (
          <SectionCard>
            <CmpHead s={s} homeName={homeName} awayName={awayName} />
            <CmpTitle>Karne</CmpTitle>
            {F_DIMS.map((dim) => (
              <View key={dim.k} style={styles.fltRow}>
                <Text style={styles.fltDim}>{dim.label}</Text>
                {dim.opts.map(([k, l]) => {
                  const on = statF[dim.k] === k;
                  return (
                    <TouchableOpacity key={k} onPress={() => setStatF((f) => ({ ...f, [dim.k]: k }))} style={[styles.fltBtn, on && styles.fltBtnOn]} activeOpacity={0.85}>
                      <Text style={[styles.fltTxt, on && styles.fltTxtOn]}>{l}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
            {tooFew ? (() => {
              // SEZON BAŞI GERİ DÜŞÜŞÜ: seçili kesitte yeterli maç yoksa ve
              // "Sezon" seçiliyken Son 15 (geçen sezon dahil) yeterliyse, ölü
              // alan yerine o kesit AÇIK ETİKETLE gösterilir. Uydurma hesap yok:
              // veriler yine gerçek maç logundan gelir, kaynağı yazılıdır.
              const fbF = { ...statF, period: 'last15' };
              const fh = statF.period === 'season' ? statsFromLog(s.home, fbF, 'home') : null;
              const fa = statF.period === 'season' ? statsFromLog(s.away, fbF, 'away') : null;
              const fbOk = fh && fa && (fh.n || 0) >= 2 && (fa.n || 0) >= 2;
              if (!fbOk) {
                return <Text style={styles.muted}>Bu kesit için yeterli maç yok ({homeName} {hv.n || 0} · {awayName} {av.n || 0} maç) — karne gösterilmez, uydurma hesap yapılmaz.</Text>;
              }
              return (
                <>
                  <Text style={styles.fltHint}>Sezon henüz başladı ({homeName} {hv.n || 0} · {awayName} {av.n || 0} maç) — aşağıda <Text style={{ fontWeight: '900' }}>Son 15 maç (geçen sezon dahil)</Text> gösteriliyor.</Text>
                  <CmpRow label="Maç" home={fh.n} away={fa.n} />
                  <CmpRow label="G-B-M"
                    left={<RecordBadges wins={fh.w} draws={fh.d} losses={fh.l} />}
                    right={<RecordBadges wins={fa.w} draws={fa.d} losses={fa.l} align="right" />} />
                  <CmpRow label="Puan / Maç" home={fh.ppg} away={fa.ppg} />
                  <CmpRow label="Gol" home={fh.gfPg} away={fa.gfPg} />
                  <CmpRow label="Yediği Gol" home={fh.gaPg} away={fa.gaPg} />
                  <CmpRow label="Temiz Kale" home={`%${fh.csPct}`} away={`%${fa.csPct}`} />
                  <CmpRow label="Gol Atamadı" home={`%${fh.ftsPct}`} away={`%${fa.ftsPct}`} />
                  <CmpRow label="KG Var" home={`%${fh.bttsPct}`} away={`%${fa.bttsPct}`} />
                  <CmpRow label="2.5 Üst" home={`%${fh.overPct}`} away={`%${fa.overPct}`} last />
                </>
              );
            })() : (
              <>
                <CmpRow label="Maç" home={hv.n} away={av.n} />
                <CmpRow label="G-B-M"
                  left={<RecordBadges wins={hv.w} draws={hv.d} losses={hv.l} />}
                  right={<RecordBadges wins={av.w} draws={av.d} losses={av.l} align="right" />} />
                <CmpRow label="Puan / Maç" home={hv.ppg} away={av.ppg} />
                <CmpRow label="Gol" home={hv.gfPg} away={av.gfPg} />
                <CmpRow label="Yediği Gol" home={hv.gaPg} away={av.gaPg} />
                <CmpRow label="Temiz Kale" home={`%${hv.csPct}`} away={`%${av.csPct}`} />
                <CmpRow label="Gol Atamadı" home={`%${hv.ftsPct}`} away={`%${av.ftsPct}`} />
                <CmpRow label="KG Var" home={`%${hv.bttsPct}`} away={`%${av.bttsPct}`} />
                <CmpRow label="2.5 Üst" home={`%${hv.overPct}`} away={`%${av.overPct}`} last />
              </>
            )}
            {statF.venueScope === 'split' ? (
              <Text style={styles.fltHint}>İç/Dış: {homeName} içerideki, {awayName} dışarıdaki maçları.</Text>
            ) : null}
          </SectionCard>
        );
      })()}

      {tab === 'İstatistik' && (<>
      {/* Maç Başına Ortalamalar — referans ekran görüntüsündeki kart:
          logolu başlık + ortalanmış başlık + temiz satırlar (sezon geneli).
          Kaynağın verdiği TÜM sezon istatistikleri burada ya da Karne'de —
          eksik bırakılmaz, mükerrer de olmaz (her istatistik tek yerde). */}
      {((s.compare && s.compare.length > 0) || s.home?.season || s.away?.season) && (() => {
        // xG ailesi kaynaktan sezon ortalamasıdır; 0/boş = veri yok → satır düşer
        // (uydurma "0 xG" gösterilmez). İç/Dış satırı maç bağlamında okunur:
        // ev takımının İÇERİDEKİ, dep takımının DIŞARIDAKİ değeri.
        const hSe = s.home?.season, aSe = s.away?.season;
        const pos = (x) => (x != null && x > 0 ? x : null);
        const xgRows = [
          { label: 'xG (Beklenen Gol)', home: pos(hSe?.xgFor), away: pos(aSe?.xgFor) },
          { label: 'xG Karşı', home: pos(hSe?.xgAgainst), away: pos(aSe?.xgAgainst) },
          { label: 'xG (içerde · dışarda)', home: pos(hSe?.xgForHome), away: pos(aSe?.xgForAway) },
          { label: 'xG Karşı (içerde · dışarda)', home: pos(hSe?.xgAgainstHome), away: pos(aSe?.xgAgainstAway) },
        ].filter((r) => r.home != null || r.away != null);
        // [kaynak etiketi, ekrandaki kısa ad]. Gol satırları BURADA YOK —
        // Karne'de zaten var (mükerrer sıfır kuralı: her istatistik tek yerde).
        const ORDER = [
          ['Toplam Şut', 'Şut'], ['İsabetli Şut', 'İsabetli Şut'],
          ['Korner', 'Korner'], ['Ofsayt', 'Ofsayt'], ['Topla Oynama', 'Topla Oynama'],
          ['Kart', 'Kart'], ['Faul', 'Faul'],
        ];
        const cmpRows = ORDER.map(([src, lbl]) => {
          const c = (s.compare || []).find((x) => x.label === src);
          return c ? { ...c, label: lbl } : null;
        }).filter(Boolean);
        // En belirleyici en üstte: xG ailesi önce, stil istatistikleri sonra.
        const rows = [...xgRows, ...cmpRows];
        if (rows.length === 0) return null;
        const fv = (v, suffix) => (v == null ? '—' : `${v}${suffix || ''}`);
        return (
          <SectionCard>
            <CmpHead s={s} homeName={homeName} awayName={awayName} />
            <CmpTitle>Maç Başına Ortalamalar</CmpTitle>
            {rows.map((c, i) => (
              <CmpRow key={c.label} label={c.label} home={fv(c.home, c.suffix)} away={fv(c.away, c.suffix)} last={i === rows.length - 1} />
            ))}
            <Text style={styles.fltHint}>Sezon geneli ortalamalar — kaynak maç bazında kırılım vermediği için Karne filtrelerinden etkilenmez. xG İç/Dış: {homeName} içerideki, {awayName} dışarıdaki değeri.</Text>
          </SectionCard>
        );
      })()}

      {/* ÜRETİLMİŞ GÖSTERGELER — ham veriden şeffaf formülle türetilen YENİ
          bilgi (mükerrer değil): bitiricilik, savunma verimi, şut kalitesi,
          form ivmesi, ağırlıklı son 5 (altın kural), ev/dep farkı, seriler.
          Verisi olmayan satır dürüstçe düşer; hesap: criteria.derivedStats. */}
      {(() => {
        const dh = derivedStats(s.home), da = derivedStats(s.away);
        const sgn = (x) => (x == null ? null : `${x > 0 ? '+' : ''}${x}`);
        const pct = (x) => (x == null ? null : `%${x}`);
        const R = [
          ['Form İvmesi', sgn(dh.momentum), sgn(da.momentum)],
          ['Ağırlıklı Son 5', dh.weightedLast5, da.weightedLast5],
          ['Bitiricilik (Gol÷xG)', dh.finishing, da.finishing],
          ['Savunma (Yediği÷xGA)', dh.defEff, da.defEff],
          ['Şut İsabeti', pct(dh.shotAcc), pct(da.shotAcc)],
          ['Şut Başına Gol', dh.goalsPerShot, da.goalsPerShot],
          ['Ev/Dep Farkı', sgn(dh.venueGap), sgn(da.venueGap)],
          ['Yenilmezlik Serisi', dh.unbeatenRun, da.unbeatenRun],
          ['Galibiyet Serisi', dh.winRun, da.winRun],
          ['Gol Atma Serisi', dh.scoringRun, da.scoringRun],
          ['Temiz Kale Serisi', dh.csRun, da.csRun],
          ['KG Serisi', dh.bttsRun, da.bttsRun],
        ].filter(([, h, a]) => h != null || a != null);
        if (R.length === 0) return null;
        return (
          <SectionCard>
            <CmpHead s={s} homeName={homeName} awayName={awayName} />
            <CmpTitle>Üretilmiş Göstergeler</CmpTitle>
            {R.map(([lbl, h, a], i) => (
              <CmpRow key={lbl} label={lbl} home={h == null ? '—' : h} away={a == null ? '—' : a} last={i === R.length - 1} />
            ))}
            <Text style={styles.fltHint}>Ham veriden şeffaf formülle türetilir: Bitiricilik = Gol ÷ xG (1 üstü beklenenden verimli) · Savunma = Yediği ÷ xGA (1 altı beklenenden sağlam) · İvme = son 5 puan/maç − sezon puan/maç · Ağırlıklı Son 5 = puan × rakip katsayısı (altın kural: güçlü 1.5 · denk 1 · zayıf 0.5) · Ev/Dep = içerideki − dışarıdaki puan/maç · Seriler maç anına kadar kesintisiz sayımdır. Verisi olmayan satır gösterilmez.</Text>
          </SectionCard>
        );
      })()}

      {/* Karşılıklı Geçmiş — eski ikonlu mini kart görünümü, kendi kartında.
          Maç Beklentileri KALDIRILDI (mükerrerdi: 2.5 Üst ve KG Var Karne'de,
          Korner Ortalamalar'da zaten var — her istatistik tek yerde). */}
      {s.h2h && s.h2h.played > 0 ? (
        <SectionCard>
          <Text style={styles.subLabel}>Karşılıklı Geçmiş · {s.h2h.played} maç</Text>
          <View style={styles.miniRow}>
            <H2hCell n={s.h2h.homeWins} label={`${homeName} galibiyeti`} icon="🟢" color={colors.primary} />
            <H2hCell n={s.h2h.draws} label="Beraberlik" icon="🤝" color={colors.gray} />
            <H2hCell n={s.h2h.awayWins} label={`${awayName} galibiyeti`} icon="🟠" color={colors.orange} />
          </View>
        </SectionCard>
      ) : null}

      {/* Puan Durumu kartı kullanıcı kararıyla KALDIRILDI ("bunu kaldır"):
          Sıra/Puan/Averaj zaten Lig Tablosu'nda, Son 5 karne filtresinde. */}

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

      
      {tab === 'Yorumlar' && (
        <CommentsSection matchId={m.sportotoMatchId || String(m.no)} />
      )}

      </ScrollView>

      {/* Takım kartı artık İSTATİSTİK değil FİKSTÜR açar (kullanıcı kararı):
          takımın oynadığı ve oynayacağı maçlar. Sezon istatistikleri
          "İstatistik" sekmesinde zaten duruyor. */}
      <TakimFiksturModal
        visible={!!teamModal}
        onClose={() => setTeamModal(null)}
        takim={teamModal ? {
          teamId: teamModal === 'home' ? m.footyHomeId : m.footyAwayId,
          seasonId: m.footySeasonId,
          name: teamModal === 'home' ? homeName : awayName,
          logo: (teamModal === 'home' ? s.home : s.away)?.logo,
          league: m.league,
        } : null}
      />
    </View>
  );
}

// --- küçük yardımcı bileşenler ---
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
// --- Referans tasarım dili (kullanıcı ekran görüntüsü): temiz kıyas kartı ---
// Logolu takım başlığı: solda ev (logo + ad), sağda deplasman (ad + logo).
function CmpHead({ s, homeName, awayName }) {
  return (
    <View style={styles.chRow}>
      <View style={styles.chSide}>
        <Logo uri={s.home?.logo} name={homeName} size={22} />
        <Text style={styles.chName} numberOfLines={1}>{homeName}</Text>
      </View>
      <View style={[styles.chSide, styles.chSideR]}>
        <Text style={styles.chName} numberOfLines={1}>{awayName}</Text>
        <Logo uri={s.away?.logo} name={awayName} size={22} />
      </View>
    </View>
  );
}
// Ortalanmış bölüm başlığı.
function CmpTitle({ children, style }) {
  return <Text style={[styles.cmpTitle, style]}>{children}</Text>;
}
// Temiz kıyas satırı: solda/sağda kalın değer (veya özel içerik), ortada soluk
// etiket, altta ince ayraç (son satırda yok). Bar yok — referans tasarım.
function CmpRow({ label, home, away, left, right, last }) {
  return (
    <View style={[styles.clRow, last && styles.clRowLast]}>
      <View style={styles.clSide}>
        {left != null ? left : <Text style={styles.clVal}>{home}</Text>}
      </View>
      <Text style={styles.clLab} numberOfLines={1}>{label}</Text>
      <View style={[styles.clSide, styles.clSideR]}>
        {right != null ? right : <Text style={[styles.clVal, styles.clValR]}>{away}</Text>}
      </View>
    </View>
  );
}
// H2H mini kartı — eski görünüm (kullanıcı tercihi): ikon + büyük sayı + etiket.
function H2hCell({ n, label, icon, color }) {
  return (
    <View style={[styles.miniCard, { borderColor: color + '66', backgroundColor: color + '14' }]}>
      <Text style={styles.miniIcon}>{icon}</Text>
      <Text style={[styles.miniNum, { color }]}>{n}</Text>
      <Text style={styles.miniLabel} numberOfLines={2}>{label}</Text>
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
// Adres vekilden geçer (gerekçe: BulletinScreen'deki TeamLogo notu — gizlilik).
// Lig tablosu tek ekranda 18-20 arma çizer; en yoğun sızıntı noktası burasıdır.
function TableLogo({ logo }) {
  const [err, setErr] = useState(false);
  const adres = crestUrlOf(logo, API_BASE);
  if (adres && !err) {
    return <Image source={{ uri: adres }} style={styles.tlImg} resizeMode="contain" onError={() => setErr(true)} />;
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
  fltRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  // Etiket sabit 78px'ti; dört çip + etiket 360px'e sığmayıp son çip alta
  // düşüyordu ("taşma"). Daraltıldı ve çipler sıkıldı — satır tek satır kalır.
  fltDim: { color: colors.textMuted, fontSize: 11, fontWeight: '800', width: 60 },
  fltBtn: { paddingHorizontal: 7, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  fltBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  fltTxt: { color: colors.textSoft, fontSize: 11, fontWeight: '800' },
  fltTxtOn: { color: '#fff' },
  fltHint: { color: colors.textMuted, fontSize: 10.5, lineHeight: 14, marginTop: 6, fontStyle: 'italic' },
  // Referans tasarım dili — temiz kıyas kartları (İstatistik sekmesi).
  chRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chSide: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  chSideR: { justifyContent: 'flex-end' },
  chName: { color: colors.text, fontSize: 13.5, fontWeight: '800', flexShrink: 1 },
  cmpTitle: { textAlign: 'center', color: colors.text, fontSize: 13.5, fontWeight: '800', marginTop: spacing.md, marginBottom: 2 },
  clRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  clRowLast: { borderBottomWidth: 0 },
  clSide: { flex: 1, alignItems: 'flex-start', justifyContent: 'center' },
  clSideR: { alignItems: 'flex-end' },
  clVal: { color: colors.text, fontSize: 14.5, fontWeight: '800', fontVariant: ['tabular-nums'] },
  clValR: { textAlign: 'right' },
  // minWidth 130 iki yandaki değerleri eziyordu; artık kalan alanı paylaşır.
  clLab: { flex: 1, minWidth: 0, flexShrink: 1, textAlign: 'center', color: colors.textSoft, fontSize: 12 },
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
  estNote: { color: colors.textMuted, fontSize: 11, fontStyle: 'italic', marginTop: 8 },


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

  // kart içi alt bölüm başlığı (Karşılıklı Geçmiş)
  subLabel: { color: colors.text, fontSize: 14, fontWeight: '800', marginBottom: spacing.sm },

  // mini analiz kartları (H2H + Maç Beklentileri)
  miniRow: { flexDirection: 'row', gap: spacing.sm },
  miniCard: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.lg, paddingHorizontal: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardAlt },
  miniIcon: { fontSize: 19, marginBottom: 4 },
  miniNum: { fontSize: 28, fontWeight: '900' },
  miniLabel: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 3, lineHeight: 15 },

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
