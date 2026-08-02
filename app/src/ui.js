// app/src/ui.js
// Birleştirilmiş: yeni tasarım sistemi (Screen/Card/Row/SectionTitle/Pill/StatCard/ListItem/ProgressBar)
// + mevcut bileşenler korunuyor (MatchHeader, Tabs, Accordion, MatchCard, PollTile, ...).

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Platform,
  Image,
} from 'react-native';

import theme from './theme';
import { RecordBadges } from './components';
import { matchDate, crestOf } from './utils';
import { APP_NAME, APP_NAME_UPPER } from './brand';
import { crestUrlOf } from './crestUrl';
import { API_BASE } from './config';

const { colors, spacing, radius, font } = theme;
// shadow/shadows uyumsuzluğuna karşı güvenli fallback
const safeShadow = theme.shadow || theme.shadows || { card: {}, soft: {} };
const shadow = safeShadow;
const shadows = safeShadow;

/* ==================== YENİ TASARIM SİSTEMİ ==================== */

export function Screen({ children, scroll = true, style, contentStyle, refreshControl }) {
  const Wrapper = scroll ? ScrollView : View;

  return (
    <SafeAreaView style={[styles.safe, style]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <Wrapper
        style={styles.wrapper}
        contentContainerStyle={scroll ? [styles.content, contentStyle] : contentStyle}
        showsVerticalScrollIndicator={false}
        {...(scroll && refreshControl ? { refreshControl } : {})}
      >
        {children}
      </Wrapper>
    </SafeAreaView>
  );
}

export function Card({ children, style, dark = false }) {
  return (
    <View style={[styles.card, dark && styles.darkCard, style]}>
      {children}
    </View>
  );
}

export function Row({ children, style, between = false, center = false }) {
  return (
    <View
      style={[
        styles.row,
        between && styles.rowBetween,
        center && styles.rowCenter,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ title, subtitle, actionLabel, onPress }) {
  return (
    <Row between center style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitleTxt}>{title}</Text>
        {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>

      {!!actionLabel && (
        <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.sectionAction}>
          <Text style={styles.sectionActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </Row>
  );
}

export function Pill({ label, tone = 'default', style, textStyle }) {
  const toneStyle = pillTone[tone] || pillTone.default;

  return (
    <View style={[styles.pill, toneStyle.box, style]}>
      <Text style={[styles.pillText, toneStyle.text, textStyle]}>{label}</Text>
    </View>
  );
}

export function StatCard({ label, value, hint, tone = 'primary', icon }) {
  const toneStyle = statTone[tone] || statTone.primary;

  return (
    <View style={[styles.statCard, toneStyle.box]}>
      <Row between center>
        {icon && typeof icon !== 'string' ? icon : <Text style={styles.statIcon}>{icon || '●'}</Text>}
        <View style={[styles.statDot, toneStyle.dot]} />
      </Row>

      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
      {!!hint && <Text style={styles.statHint} numberOfLines={1}>{hint}</Text>}
    </View>
  );
}

// Boş durum — hem message hem subtitle destekli (geriye dönük uyum)
export function EmptyState({ icon = '📭', title, message, subtitle }) {
  return (
    <Card style={styles.empty}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {(message || subtitle) ? <Text style={styles.emptyMessage}>{message || subtitle}</Text> : null}
    </Card>
  );
}

export function ListItem({
  title,
  subtitle,
  meta,
  badge,
  badgeTone = 'default',
  left,
  onPress,
}) {
  const Component = onPress ? TouchableOpacity : View;

  return (
    <Component activeOpacity={0.82} onPress={onPress} style={styles.listItem}>
      <Row center style={{ flex: 1 }}>
        {!!left && <View style={styles.listLeft}>{left}</View>}

        <View style={{ flex: 1 }}>
          <Text style={styles.listTitle}>{title}</Text>
          {!!subtitle && <Text style={styles.listSubtitle}>{subtitle}</Text>}
          {!!meta && <Text style={styles.listMeta}>{meta}</Text>}
        </View>

        {!!badge && <Pill label={badge} tone={badgeTone} />}
      </Row>
    </Component>
  );
}

export function ProgressBar({ value = 0, tone = 'primary' }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  const barColor = progressTone[tone] || colors.primary;

  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${safeValue}%`, backgroundColor: barColor }]} />
    </View>
  );
}

// Marka logosu — ÖZGÜN metin-logo: "SM" monogramı + isim + slogan.
// Hiçbir kurumun amblemi, logosu veya rengi taklit edilmez.
export function BrandLogo({ subtitle = true, size = 42 }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', ...shadow.soft }}>
        <Text style={{ color: colors.white, fontSize: size * 0.36, fontWeight: '900', letterSpacing: 0.5 }}>SM</Text>
      </View>
      <View style={{ marginLeft: 10 }}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900' }}>{APP_NAME}</Text>
        {subtitle ? (
          <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 1 }}>
            Bülten • Analiz • Tahmin
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const pillTone = {
  default: { box: { backgroundColor: colors.primarySoft }, text: { color: colors.primary } },
  primary: { box: { backgroundColor: colors.primarySoft }, text: { color: colors.primary } },
  accent: { box: { backgroundColor: colors.accentSoft }, text: { color: colors.accent } },
  success: { box: { backgroundColor: colors.successSoft }, text: { color: colors.success } },
  warning: { box: { backgroundColor: colors.warningSoft }, text: { color: colors.warning } },
  danger: { box: { backgroundColor: colors.dangerSoft }, text: { color: colors.danger } },
  info: { box: { backgroundColor: colors.infoSoft }, text: { color: colors.info } },
  dark: { box: { backgroundColor: colors.darkCardSoft }, text: { color: colors.white } },
};

const statTone = {
  primary: { box: { backgroundColor: colors.surface }, dot: { backgroundColor: colors.primary } },
  accent: { box: { backgroundColor: colors.surface }, dot: { backgroundColor: colors.accent } },
  success: { box: { backgroundColor: colors.surface }, dot: { backgroundColor: colors.success } },
  warning: { box: { backgroundColor: colors.surface }, dot: { backgroundColor: colors.warning } },
  danger: { box: { backgroundColor: colors.surface }, dot: { backgroundColor: colors.danger } },
};

const progressTone = {
  primary: colors.primary,
  accent: colors.accent,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  info: colors.info,
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  wrapper: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: Platform.OS === 'ios' ? 36 : 28 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  darkCard: { backgroundColor: colors.darkCard, borderColor: colors.darkCardSoft },
  row: { flexDirection: 'row' },
  rowBetween: { justifyContent: 'space-between' },
  rowCenter: { alignItems: 'center' },
  sectionHeader: { marginTop: spacing.xl, marginBottom: spacing.md },
  sectionTitleTxt: { color: colors.text, fontSize: font.lg, fontWeight: font.heavy },
  sectionSubtitle: { color: colors.textSoft, fontSize: font.sm, marginTop: 2 },
  sectionAction: { backgroundColor: colors.primarySoft, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  sectionActionText: { color: colors.primary, fontSize: font.sm, fontWeight: font.bold },
  pill: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill },
  pillText: { fontSize: font.xs, fontWeight: font.bold },
  statCard: { flex: 1, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadow.soft },
  statIcon: { fontSize: 18 },
  statDot: { width: 9, height: 9, borderRadius: 9 },
  statValue: { color: colors.text, fontSize: font.xxl, fontWeight: font.heavy, marginTop: spacing.md },
  statLabel: { color: colors.text, fontSize: font.sm, fontWeight: font.bold, marginTop: 2 },
  statHint: { color: colors.textSoft, fontSize: font.xs, marginTop: spacing.xs },
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl },
  emptyIcon: { fontSize: 34 },
  emptyTitle: { color: colors.text, fontSize: font.lg, fontWeight: font.heavy, marginTop: spacing.md },
  emptyMessage: { color: colors.textSoft, fontSize: font.sm, textAlign: 'center', marginTop: spacing.xs },
  listItem: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  listLeft: { marginRight: spacing.md },
  listTitle: { color: colors.text, fontSize: font.md, fontWeight: font.bold },
  listSubtitle: { color: colors.textSoft, fontSize: font.sm, marginTop: 3 },
  listMeta: { color: colors.muted, fontSize: font.xs, marginTop: 4 },
  progressTrack: { height: 8, backgroundColor: colors.primarySoft, borderRadius: radius.pill, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.pill },
});

/* ==================== MEVCUT BİLEŞENLER (korunuyor) ==================== */

// Kulüp arması / nötr top.
//
// ADRES VEKİLDEN GEÇER (/api/crest). Gerekçe GİZLİLİK: doğrudan dış adrese
// giden her görsel isteği kullanıcının IP'sini ve hangi ekranı açtığını
// üçüncü tarafa bildirir. Bu bileşen Ana Sayfa, Maç Detayı ve canlı kartlarda
// kullanılıyor — düzeltme tek yerde yapılınca hepsi kapsanıyor.
//
// crestUrlOf BOZMAMA kuralıyla yazılmıştır: taban adres bilinmiyorsa ya da
// adres zaten yerelse dokunmaz; bugün çizilen bir arma kaybolmaz. Vekilin
// izinli konak listesi tek yerde (backend/src/crestProxy.js, varsayılan-ret).
export function Logo({ uri, name, size = 40 }) {
  const [err, setErr] = useState(false);
  const adres = crestUrlOf(uri, API_BASE);
  if (adres && !err) {
    return <Image source={{ uri: adres }} style={{ width: size, height: size, borderRadius: size * 0.22, backgroundColor: colors.cardAlt }} resizeMode="contain" onError={() => setErr(true)} accessibilityLabel={name} />;
  }
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: size * 0.5 }}>⚽</Text></View>;
}

// Premium kart (bölüm)
export function SectionCard({ title, right, children, style }) {
  return (
    <View style={[s.section, style]}>
      {(title || right) && (
        <View style={s.sectionHead}>
          {title ? <Text style={s.sectionTitle}>{title}</Text> : <View />}
          {right || null}
        </View>
      )}
      {children}
    </View>
  );
}

// Yatay ana sekmeler
export function Tabs({ tabs, active, onChange, icons }) {
  return (
    <View style={s.tabsWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabsRow}>
        {tabs.map((t) => {
          const on = active === t;
          return (
            <TouchableOpacity key={t} onPress={() => onChange(t)} style={s.tabBtn} activeOpacity={0.7}>
              {icons && icons[t] ? <Text style={[s.tabIcon, on && { opacity: 1 }]}>{icons[t]}</Text> : null}
              <Text style={[s.tabTxt, on && s.tabTxtOn]}>{t}</Text>
              <View style={[s.tabUnder, on && s.tabUnderOn]} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// Açılır-kapanır bölüm
export function Accordion({ title, icon, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={s.acc}>
      <TouchableOpacity style={s.accHead} onPress={() => setOpen((o) => !o)} activeOpacity={0.7}>
        <Text style={s.accTitle}>{icon ? `${icon}  ` : ''}{title}</Text>
        <Text style={[s.accChevron, open && { color: colors.accent }]}>{open ? '▴' : '▾'}</Text>
      </TouchableOpacity>
      {open && <View style={s.accBody}>{children}</View>}
    </View>
  );
}

// İskelet yükleme
export function Skeleton({ height = 14, width = '100%', style }) {
  return <View style={[{ height, width, borderRadius: 6, backgroundColor: colors.cardAlt }, style]} />;
}
export function SkeletonCard() {
  return (
    <View style={[s.section, { gap: 10 }]}>
      <Skeleton height={16} width="55%" />
      <Skeleton height={12} width="80%" />
      <Skeleton height={12} width="70%" />
      <Skeleton height={36} width="100%" style={{ marginTop: 6 }} />
    </View>
  );
}

// Daire gösterge (yüzde)
export function DonutRing({ value, label, color, size = 76 }) {
  const c = color || colors.accent;
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 5, borderColor: c, backgroundColor: c + '1f', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.text, fontWeight: '900', fontSize: size * 0.3 }}>{value}</Text>
        <Text style={{ color: colors.textMuted, fontSize: size * 0.14, fontWeight: '800', marginTop: -2 }}>%</Text>
      </View>
      {label ? <Text style={s.ringLabel}>{label}</Text> : null}
    </View>
  );
}

// Yatay yüzde barı
export function PercentBar({ label, value, color }) {
  const c = color || colors.accent;
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <View style={{ marginVertical: 6 }}>
      <View style={s.pbHead}>
        <Text style={s.pbLabel}>{label}</Text>
        <Text style={s.pbVal}>%{value}</Text>
      </View>
      <View style={s.pbTrack}><View style={{ width: `${v}%`, height: 8, backgroundColor: c, borderRadius: 4 }} /></View>
    </View>
  );
}

// Bülten maç kartı
export function MatchCard({ match, onPress }) {
  const d = matchDate(match.date);
  const hs = match.stats?.home?.standing;
  const as = match.stats?.away?.standing;
  const sc = match.score;
  const live = !!match.live;
  // Bitmiş maç = başlamış + canlı değil + skor var. MS sonucu (1/X/2):
  // resmi 'result' varsa onu, yoksa skordan hesapla. Skor ASLA MS ile karışmaz.
  const isFinished = !!match.started && !live && !!sc;
  const res = match.result
    || (sc && sc.home != null && sc.away != null
      ? (sc.home > sc.away ? '1' : sc.home < sc.away ? '2' : 'X')
      : null);
  const resColor = res === '1' ? colors.primary : res === '2' ? colors.yellow : colors.gray;
  return (
    <TouchableOpacity style={s.mc} onPress={onPress} activeOpacity={onPress ? 0.85 : 1}>
      <View style={s.mcTop}>
        <Text style={s.mcNo}>#{match.no}</Text>
        {match.league ? <Text style={s.mcLeague} numberOfLines={1}>{match.league}</Text> : <View style={{ flex: 1 }} />}
        {live ? (
          <View style={s.mcLive}><View style={s.mcLiveDot} /><Text style={s.mcLiveTxt}>CANLI{match.minute ? ` ${match.minute}'` : ''}</Text></View>
        ) : isFinished && res ? (
          <View style={[s.mcMs, { backgroundColor: resColor }]}><Text style={s.mcMsTxt}>MS {res}</Text></View>
        ) : (
          <Text style={s.mcDate}>{d.day} · {d.time}</Text>
        )}
      </View>
      <View style={s.mcMain}>
        <View style={s.mcHome}>
          <Logo uri={crestOf(match, 'home')} name={match.home.name} size={30} />
          <Text style={s.mcTeam} numberOfLines={1}>{match.home.name}</Text>
        </View>
        {sc
          ? <Text style={[s.mcScore, live && s.mcScoreLive]}>{sc.home} - {sc.away}</Text>
          : <Text style={s.mcVs}>VS</Text>}
        <View style={s.mcAway}>
          <Text style={[s.mcTeam, { textAlign: 'right' }]} numberOfLines={1}>{match.away.name}</Text>
          <Logo uri={crestOf(match, 'away')} name={match.away.name} size={30} />
        </View>
      </View>
      {(hs || as) && (
        <View style={s.mcForm}>
          <View style={s.mcFormSide}>{hs ? <RecordBadges wins={hs.wins} draws={hs.draws} losses={hs.losses} played={hs.played} /> : <View />}</View>
          <View style={[s.mcFormSide, { alignItems: 'flex-end' }]}>{as ? <RecordBadges wins={as.wins} draws={as.draws} losses={as.losses} played={as.played} align="right" /> : <View />}</View>
        </View>
      )}
    </TouchableOpacity>
  );
}

// Maç detay üst başlığı
export function MatchHeader({ home, away, homeLogo, awayLogo, league, dateLabel, time, stadium, onBack, onShare, onHomePress, onAwayPress }) {
  return (
    <View style={s.mh}>
      <View style={s.mhBar}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Text style={s.mhIcon}>‹</Text></TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={s.brandName}>⚽ {APP_NAME_UPPER}</Text>
          <Text style={s.brandSub}>BAĞIMSIZ ANALİZ UYGULAMASI</Text>
        </View>
        <TouchableOpacity onPress={onShare} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Text style={s.mhIconSm}>☆</Text></TouchableOpacity>
      </View>
      <View style={s.mhMain}>
        <TouchableOpacity style={s.mhTeam} onPress={onHomePress} disabled={!onHomePress} activeOpacity={0.7}>
          <Logo uri={homeLogo} name={home} size={50} />
          <Text style={s.mhTeamName} numberOfLines={2}>{home}</Text>
          {onHomePress ? <Text style={s.mhStatHint}>maçlar ›</Text> : null}
        </TouchableOpacity>
        <View style={s.mhCenter}>
          {league ? <Text style={s.mhLeague} numberOfLines={1}>{league}</Text> : null}
          <View style={s.mhTimeRow}>
            <Text style={s.mhDash}>-</Text>
            <View style={{ alignItems: 'center' }}>
              {dateLabel ? <Text style={s.mhDate}>{dateLabel}</Text> : null}
              <Text style={s.mhScore}>{time}</Text>
            </View>
            <Text style={s.mhDash}>-</Text>
          </View>
          {stadium ? <Text style={s.mhStadium} numberOfLines={1}>{stadium}</Text> : null}
        </View>
        <TouchableOpacity style={s.mhTeam} onPress={onAwayPress} disabled={!onAwayPress} activeOpacity={0.7}>
          <Logo uri={awayLogo} name={away} size={50} />
          <Text style={s.mhTeamName} numberOfLines={2}>{away}</Text>
          {onAwayPress ? <Text style={s.mhStatHint}>maçlar ›</Text> : null}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Ana sayfa hızlı erişim kartı
export function QuickAccessCard({ icon, label, sub, color, onPress }) {
  const c = color || colors.accent;
  return (
    <TouchableOpacity style={[s.qa, { borderColor: c + '44' }]} onPress={onPress} activeOpacity={0.85}>
      <View style={[s.qaIcon, { backgroundColor: c + '22' }]}><Text style={{ fontSize: 20 }}>{icon}</Text></View>
      <Text style={s.qaLabel}>{label}</Text>
      {sub ? <Text style={s.qaSub} numberOfLines={1}>{sub}</Text> : null}
    </TouchableOpacity>
  );
}

// Topluluk / anket kartı
export function PollCard({ icon, title, desc, button, color, onPress }) {
  const c = color || colors.accent;
  return (
    <View style={[s.poll, { borderLeftColor: c }]}>
      <Text style={s.pollIcon}>{icon}</Text>
      <Text style={s.pollTitle}>{title}</Text>
      <Text style={s.pollDesc}>{desc}</Text>
      <TouchableOpacity style={[s.pollBtn, { backgroundColor: c }]} onPress={onPress} activeOpacity={0.85}>
        <Text style={s.pollBtnTxt}>{button}</Text>
      </TouchableOpacity>
    </View>
  );
}

// Form puanı — 5 nokta + sayı
export function RatingDots({ rating, color }) {
  const c = color || colors.field;
  const filled = Math.round(Math.max(0, Math.min(5, rating || 0)));
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {[0, 1, 2, 3, 4].map((i) => <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i < filled ? c : colors.track }} />)}
      </View>
      <Text style={{ color: colors.text, fontWeight: '900', fontSize: 15, marginTop: 6 }}>{(rating ?? 0).toFixed(1)}</Text>
    </View>
  );
}

// İki tonlu güç halkası
export function SplitDonut({ home, away, size = 54 }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 7, borderTopColor: colors.field, borderRightColor: colors.field, borderBottomColor: colors.accent, borderLeftColor: colors.accent, transform: [{ rotate: '45deg' }] }} />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
        <Text style={{ color: colors.field, fontWeight: '800', fontSize: 11 }}>%{home}</Text>
        <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 11 }}>%{away}</Text>
      </View>
    </View>
  );
}

// Küçük başlıklı istatistik kutusu
export function StatTile({ title, sub, children }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bgAlt, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' }}>
      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', textAlign: 'center' }} numberOfLines={1}>{title}</Text>
      {sub ? <Text style={{ color: colors.textMuted, fontSize: 10, marginBottom: 2 }} numberOfLines={1}>{sub}</Text> : null}
      <View style={{ marginTop: 6 }}>{children}</View>
    </View>
  );
}

// Küçük bilgi kartı
export function InfoTile({ label, value, sub, icon }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, ...shadows.soft }}>
      <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 }} numberOfLines={1}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800', marginTop: 4 }} numberOfLines={1}>{icon ? icon + ' ' : ''}{value}</Text>
      {sub ? <Text style={{ color: colors.textMuted, fontSize: 10.5, marginTop: 2 }} numberOfLines={1}>{sub}</Text> : null}
    </View>
  );
}

// Zengin topluluk kartı — önizleme + buton
export function PollTile({ icon, title, desc, button, color, preview, onPress }) {
  const c = color || colors.accent;
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, borderTopWidth: 3, borderTopColor: c, marginBottom: spacing.sm, ...shadows.soft }}>
      <Text style={{ color: colors.text, fontSize: 14.5, fontWeight: '800' }}>{icon} {title}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 11.5, marginTop: 3, marginBottom: 8, lineHeight: 15 }}>{desc}</Text>
      {preview ? <View style={{ marginBottom: 10 }}>{preview}</View> : null}
      <TouchableOpacity style={{ backgroundColor: c, paddingVertical: 8, borderRadius: radius.sm, alignItems: 'center' }} onPress={onPress} activeOpacity={0.85}>
        <Text style={{ color: colors.bg, fontSize: 12.5, fontWeight: '800' }}>{button}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  section: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadows.soft },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },

  tabsWrap: { backgroundColor: colors.bgAlt, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabsRow: { paddingHorizontal: spacing.md, gap: 2 },
  tabBtn: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 0, alignItems: 'center' },
  tabIcon: { fontSize: 17, opacity: 0.55, marginBottom: 2 },
  tabTxt: { color: colors.textMuted, fontSize: 13, fontWeight: '700', paddingBottom: 8 },
  tabTxtOn: { color: colors.text, fontWeight: '900' },
  tabUnder: { height: 3, width: '100%', borderRadius: 2, backgroundColor: 'transparent' },
  tabUnderOn: { backgroundColor: colors.accent },

  acc: { backgroundColor: colors.card, borderRadius: radius.md, marginBottom: spacing.sm, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  accHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
  accTitle: { color: colors.text, fontSize: 14.5, fontWeight: '800', flex: 1 },
  accChevron: { color: colors.textMuted, fontSize: 16, fontWeight: '900', paddingLeft: 8 },
  accBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },

  ringLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 6, textAlign: 'center' },
  pbHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  pbLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  pbVal: { color: colors.text, fontSize: 12, fontWeight: '800' },
  pbTrack: { height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden' },

  mc: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, ...shadows.soft },
  mcTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  mcNo: { color: colors.accent, fontSize: 12, fontWeight: '900' },
  mcLeague: { color: colors.textMuted, fontSize: 11, fontWeight: '700', flex: 1 },
  mcDate: { color: colors.textMuted, fontSize: 11.5, fontWeight: '700' },
  mcMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mcHome: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  mcAway: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  mcTeam: { flex: 1, color: colors.text, fontSize: 14.5, fontWeight: '700' },
  mcVs: { color: colors.textMuted, fontSize: 12, fontWeight: '900', letterSpacing: 1, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: colors.bgAlt, borderRadius: 6 },
  mcScore: { color: colors.text, fontSize: 16, fontWeight: '900', letterSpacing: 1, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.bgAlt, borderRadius: 6, minWidth: 46, textAlign: 'center' },
  mcScoreLive: { color: '#ffffff', backgroundColor: colors.accent },
  mcLive: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.accent, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  mcLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ffffff' },
  mcLiveTxt: { color: '#ffffff', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  mcMs: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  mcMsTxt: { color: '#ffffff', fontSize: 10.5, fontWeight: '900', letterSpacing: 0.5 },
  mcForm: { flexDirection: 'row', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  mcFormSide: { flex: 1 },

  mh: { backgroundColor: colors.bgAlt, paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  mhBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  mhIcon: { color: colors.text, fontSize: 30, fontWeight: '900', lineHeight: 30 },
  mhIconSm: { color: colors.gold, fontSize: 22, fontWeight: '900' },
  brandName: { color: colors.text, fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  brandSub: { color: colors.accent, fontSize: 8.5, fontWeight: '800', letterSpacing: 1.5, marginTop: 1 },
  mhMain: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  mhTeam: { flex: 1, alignItems: 'center', gap: 8 },
  mhTeamName: { color: colors.text, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  mhStatHint: { color: colors.accent, fontSize: 10, fontWeight: '800', marginTop: -2 },
  mhCenter: { width: 116, alignItems: 'center', justifyContent: 'center', paddingTop: 6 },
  mhLeague: { color: colors.textMuted, fontSize: 10.5, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  mhTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mhDash: { color: colors.textMuted, fontSize: 16, fontWeight: '800' },
  mhDate: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  mhScore: { color: colors.text, fontSize: 21, fontWeight: '900', letterSpacing: 1 },
  mhStadium: { color: colors.textMuted, fontSize: 10.5, fontWeight: '600', textAlign: 'center', marginTop: 4 },

  qa: { width: '31%', backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, marginBottom: spacing.sm, ...shadows.soft },
  qaIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  qaLabel: { color: colors.text, fontSize: 13, fontWeight: '800' },
  qaSub: { color: colors.textMuted, fontSize: 10.5, fontWeight: '600', marginTop: 2 },

  poll: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.sm, borderLeftWidth: 4, ...shadows.soft },
  pollIcon: { fontSize: 26, marginBottom: 6 },
  pollTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  pollDesc: { color: colors.textMuted, fontSize: 13, marginTop: 4, marginBottom: 12, lineHeight: 18 },
  pollBtn: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.sm },
  pollBtnTxt: { color: colors.bg, fontSize: 13.5, fontWeight: '800' },
});
