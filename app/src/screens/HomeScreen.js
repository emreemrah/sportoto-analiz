import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';

import { api } from '../api';
import { BRAND_LINE_1, BRAND_LINE_2 } from '../brand';
import { colors, spacing, radius, shadows } from '../theme';
import { EmptyState, SkeletonCard, Logo } from '../ui';
import { ProfileAvatar } from '../components';
import { crestOf } from '../utils';
import BulletinHeroVisual, { BulletinHeroBackdrop } from '../components/BulletinHeroVisual';
import { loadNotifications } from '../services/notificationsService';


function shortTeam(name) {
  return String(name || '')
    .replace(/\s+FK$/i, '')
    .replace(/\s+SK$/i, '')
    .trim();
}

function matchTime(iso) {
  if (!iso) return 'Saat yok';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Saat yok';
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function Header({ data, navigation, unread = 0 }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.brand}>
          {BRAND_LINE_1} <Text style={styles.brandAccent}>{BRAND_LINE_2}</Text>
        </Text>
      </View>

      {/* Yayın Stüdyosu: 15 maçlık bülteni canlı yayında maç maç işleyen,
          koyu, sekmesiz mod. Eski sunum ekranına stüdyonun içindeki
          "Sunum" düğmesinden geçilir. */}
      <TouchableOpacity
        style={styles.topIconBtn}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('StudioBulletin')}
        accessibilityLabel="Yayın stüdyosu"
      >
        <Text style={styles.broadcastIcon}>📺</Text>
      </TouchableOpacity>

      {/* Zil GERÇEK çalışır: bildirim merkezini açar. Kırmızı sayı YALNIZ
          okunmamış GERÇEK bildirim varsa görünür — süs rozeti yoktur. */}
      <TouchableOpacity
        style={styles.topIconBtn}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('Notifications')}
        accessibilityLabel={unread > 0 ? `Bildirimler, ${unread} okunmamış` : 'Bildirimler'}
      >
        <Text style={styles.bellIcon}>🔔</Text>
        {unread > 0 ? (
          <View style={styles.notificationDot}>
            <Text style={styles.notificationDotTxt}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        ) : null}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.navigate('ProfileTab')}
        activeOpacity={0.85}
        style={styles.avatarBtn}
      >
        <ProfileAvatar size={34} />
      </TouchableOpacity>
    </View>
  );
}

function HeroCard({ data, loading, onPress, onSummary, onRecap }) {
  const matches = data?.matches || [];
  // Sayılar YALNIZ güncel bültenin GERÇEK analizinden. "Maç Analizi" = analizi
  // olan (kapsanan) maç sayısı; kapsam dışı maç varsa şişirmez, yanıltmaz.
  const analyzed = matches.filter((m) => m?.analysis && m.analysis.surpriseScore != null);
  const total = analyzed.length;
  const featured = analyzed.filter((m) => Number(m.analysis.surpriseScore) >= 45).length;
  const surprise = analyzed.filter((m) => Number(m.analysis.surpriseScore) >= 65).length;
  const leagues = new Set(matches.map((m) => m.league).filter(Boolean)).size;
  const v = (n) => (loading || !data ? '–' : n);

  return (
    <View style={styles.heroCard}>
      <BulletinHeroBackdrop />

      <View style={styles.heroWeekRow}>
        <View style={styles.heroWeekDot} />
        <Text style={styles.heroWeekText}>{data?.round || '—'}</Text>
      </View>

      <View style={styles.heroTopRow}>
        <View style={styles.heroTextBlock}>
          <Text style={styles.heroTitle}>Bu Haftanın Bülteni</Text>
          <Text style={styles.heroDesc}>
            Veriler hazır, analizler tamam. Haftaya dair öne çıkanlar burada.
          </Text>
        </View>
        <BulletinHeroVisual width={128} height={92} />
      </View>

      {/* Sayaçlar ve düğmeler AYRI satırlarda. Aynı satırda olduklarında telefon
          genişliğinde sütunlar eziliyor ve "Öne Çıkan Analiz" etiketi harf harf
          alt alta düşüyordu — yayında bozuk görünen gerçek bir kusurdu. */}
      <View style={styles.heroBottomRow}>
        <View style={styles.heroStats}>
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatValue}>{v(total)}</Text>
            <Text style={styles.heroStatLabel} numberOfLines={2}>Maç Analizi</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatValue}>{v(featured)}</Text>
            <Text style={styles.heroStatLabel} numberOfLines={2}>Öne Çıkan</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatValue}>{v(surprise)}</Text>
            <Text style={styles.heroStatLabel} numberOfLines={2}>Sürpriz Maç</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatValue}>{v(leagues)}</Text>
            <Text style={styles.heroStatLabel} numberOfLines={2}>Lig</Text>
          </View>
        </View>
      </View>

      <View style={styles.heroCtaRow}>
        <TouchableOpacity style={styles.heroButton} onPress={onPress} activeOpacity={0.88}>
          <Text style={styles.heroButtonText}>Bülteni Aç</Text>
          <Text style={styles.heroButtonArrow}>›</Text>
        </TouchableOpacity>

        {/* Yayın açılış segmenti: güçlü adaylar + sürprizler + zorluk tek kartta */}
        <TouchableOpacity style={styles.heroSummaryBtn} onPress={onSummary} activeOpacity={0.88}>
          <Text style={styles.heroSummaryTxt} numberOfLines={1}>📺 Haftanın Özeti</Text>
        </TouchableOpacity>
      </View>

      {/* Yayın kapanış segmenti: geçen haftanın RESMÎ sonuçlarıyla sen vs sistem
          karnesi. Sonuç gelmemişse ekran sayı üretmez, bunu açıkça söyler. */}
      <TouchableOpacity style={styles.heroRecapBtn} onPress={onRecap} activeOpacity={0.88}>
        <Text style={styles.heroRecapTxt}>🏁 Geçen Haftanın Kapanışı</Text>
        <Text style={styles.heroRecapArrow}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

function SectionHead({ title, right, onPress }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right ? (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
          <Text style={styles.sectionRight}>{right}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function AnalysisCard({ match, tag, color, navigation }) {
  return (
    <TouchableOpacity
      style={styles.analysisCard}
      activeOpacity={0.88}
      onPress={() => navigation.navigate('MatchDetail', { no: match.no })}
    >
      <View style={[styles.tagPill, { backgroundColor: color + '26' }]}>
        <Text style={[styles.tagText, { color }]}>{tag}</Text>
      </View>

      <View style={styles.analysisTeams}>
        <View style={styles.teamBlock}>
          <Logo uri={crestOf(match, 'home')} name={match.home?.name} size={42} />
        </View>

        <Text style={styles.vsText}>VS</Text>

        <View style={styles.teamBlock}>
          <Logo uri={crestOf(match, 'away')} name={match.away?.name} size={42} />
        </View>
      </View>

      <Text style={styles.analysisTitle} numberOfLines={1}>
        {shortTeam(match.home?.name)} - {shortTeam(match.away?.name)}
      </Text>

      <Text style={styles.analysisDesc} numberOfLines={2}>
        {match.analysis?.comment || match.aiComment || 'Form ve istatistik verileri birlikte değerlendiriliyor.'}
      </Text>

      <View style={styles.analysisLinkRow}>
        <View style={styles.smallTrend}>
          <View style={styles.smallTrendA} />
          <View style={styles.smallTrendB} />
        </View>
        <Text style={styles.analysisLink}>Analiz Detayı</Text>
        <Text style={styles.analysisChevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

function SurpriseCard({ match, navigation }) {
  // Seviye ve yüzde GERÇEK sürpriz puanından — sıraya göre etiket uydurulmaz.
  const score = Number(match.analysis?.surpriseScore || 0);
  const level = score >= 65 ? 'YÜKSEK' : score >= 45 ? 'ORTA' : 'DÜŞÜK';
  const color = score >= 65 ? colors.gold : score >= 45 ? colors.field : colors.gray;
  // İzleyici armadan takımı tanımaz — kısaltılmış ad her zaman görünür.
  const shortName = (t) => t?.mediumName || t?.shortName || (t?.name || '').slice(0, 10) || '—';

  return (
    <TouchableOpacity
      style={styles.surpriseCard}
      activeOpacity={0.86}
      onPress={() => navigation.navigate('MatchDetail', { no: match.no })}
    >
      <View style={styles.surpriseLogos}>
        <Logo uri={crestOf(match, 'home')} name={match.home?.name} size={30} />
        <Text style={styles.surpriseVs}>VS</Text>
        <Logo uri={crestOf(match, 'away')} name={match.away?.name} size={30} />
      </View>
      <View style={styles.surpriseNames}>
        <Text style={styles.surpriseName} numberOfLines={1}>{shortName(match.home)}</Text>
        <Text style={[styles.surpriseName, styles.surpriseNameR]} numberOfLines={1}>{shortName(match.away)}</Text>
      </View>

      <View style={styles.surpriseBottom}>
        <View style={[styles.surpriseLevel, { backgroundColor: color + '33' }]}>
          <Text style={[styles.surpriseLevelTxt, { color }]}>{level}</Text>
        </View>
        <Text style={styles.surprisePct}>{score > 0 ? `İhtimal: %${score}` : 'Veri bekleniyor'}</Text>
      </View>
    </TouchableOpacity>
  );
}

// Yaklaşan maç kartı — gerçek bülten verisi: gün + saat + takımlar + lig.
function KickoffCard({ match, navigation }) {
  const d = match.date ? new Date(match.date) : null;
  const ok = d && !Number.isNaN(d.getTime());
  const day = ok ? d.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
  return (
    <TouchableOpacity
      style={styles.kickCard}
      activeOpacity={0.86}
      onPress={() => navigation.navigate('MatchDetail', { no: match.no })}
    >
      <View style={styles.kickTimeRow}>
        <Text style={styles.kickDay} numberOfLines={1}>{day}</Text>
        <Text style={styles.kickTime}>{ok ? matchTime(match.date) : '—'}</Text>
      </View>
      <View style={styles.kickTeamRow}>
        <Logo uri={crestOf(match, 'home')} name={match.home?.name} size={22} />
        <Text style={styles.kickTeam} numberOfLines={1}>{shortTeam(match.home?.name)}</Text>
      </View>
      <View style={styles.kickTeamRow}>
        <Logo uri={crestOf(match, 'away')} name={match.away?.name} size={22} />
        <Text style={styles.kickTeam} numberOfLines={1}>{shortTeam(match.away?.name)}</Text>
      </View>
      <Text style={styles.kickLeague} numberOfLines={1}>{match.league || ''}</Text>
    </TouchableOpacity>
  );
}

function EmptyDashboard({ error }) {
  return (
    <View style={{ paddingHorizontal: spacing.md }}>
      <EmptyState
        icon="📊"
        title={error ? 'Bülten alınamadı' : 'Dashboard hazırlanıyor'}
        subtitle={error || 'Güncel bülten yayınlanınca analiz kartları burada görünecek.'}
      />
    </View>
  );
}

export default function HomeScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      setError(null);
      const result = await api.bulletin();
      setData(result);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Zil rozeti: gerçek okunmamış bildirim sayısı. Hata olursa rozet yok
  // (sayı uydurulmaz), ekran akışı da etkilenmez.
  useEffect(() => {
    let iptal = false;
    const say = () => {
      loadNotifications({ now: Date.now() })
        .then((r) => { if (!iptal) setUnread(r?.unread || 0); })
        .catch(() => { if (!iptal) setUnread(0); });
    };
    say();
    const durdur = navigation.addListener?.('focus', say);
    return () => { iptal = true; if (typeof durdur === 'function') durdur(); };
  }, [navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const matches = data?.matches || [];

  const topAnalysis = useMemo(() => {
    return [...matches]
      .filter((m) => m.status !== 'finished')
      .sort((a, b) => Number(b.analysis?.surpriseScore || 0) - Number(a.analysis?.surpriseScore || 0))
      .slice(0, 2);
  }, [matches]);

  const surpriseMatches = useMemo(() => {
    return [...matches]
      .filter((m) => m.status !== 'finished')
      .sort((a, b) => Number(b.analysis?.surpriseScore || 0) - Number(a.analysis?.surpriseScore || 0))
      .slice(0, 3);
  }, [matches]);

  const fallbackAnalysis = matches.slice(0, 2);
  const displayAnalysis = topAnalysis.length ? topAnalysis : fallbackAnalysis;
  const displaySurprise = surpriseMatches.length ? surpriseMatches : matches.slice(0, 3);

  // Yaklaşan maçlar — gerçek bülten tarihlerinden, en yakın önce.
  const upcoming = useMemo(() => {
    return [...matches]
      .filter((m) => m.status !== 'finished' && m.date && !Number.isNaN(new Date(m.date).getTime()))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 6);
  }, [matches]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: spacing.xl + 12 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
        />
      }
    >
      <Header data={data} navigation={navigation} unread={unread} />

      <HeroCard
        data={data}
        loading={!data && !error}
        onPress={() => navigation.navigate('BulletinTab')}
        onSummary={() => navigation.navigate('WeekSummary')}
        onRecap={() => navigation.navigate('WeekRecap')}
      />

      {/* Hızlı Erişim kullanıcı kararıyla KALDIRILDI ("hızlı erişim olmasın") —
          alt sekme çubuğu aynı sayfalara zaten götürüyor. */}
      <SectionHead
        title="Öne Çıkan Analizler"
        right="Tümünü Gör ›"
        onPress={() => navigation.navigate('AnalizTab')}
      />

      {!data && !error ? (
        <View style={styles.screenPad}>
          <SkeletonCard />
        </View>
      ) : error || matches.length === 0 ? (
        <EmptyDashboard error={error} />
      ) : (
        <View style={styles.analysisGrid}>
          {displayAnalysis.map((m) => {
            // Etiket GERÇEK sürpriz puanından — karta göre sabit etiket uydurulmaz.
            const sc = Number(m.analysis?.surpriseScore || 0);
            const t = sc >= 65 ? { tag: 'SÜRPRİZ ADAYI', color: colors.gold }
              : sc >= 45 ? { tag: 'AÇIK MAÇ', color: colors.accent }
                : { tag: 'DENGELİ', color: colors.field };
            return (
              <AnalysisCard
                key={m.no}
                match={m}
                tag={t.tag}
                color={t.color}
                navigation={navigation}
              />
            );
          })}
        </View>
      )}

      <SectionHead
        title="Sürpriz İhtimali Yüksek"
        right="Tümünü Gör ›"
        onPress={() => navigation.navigate('BulletinTab')}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.surpriseScroll}
      >
        {displaySurprise.length ? (
          displaySurprise.map((m) => (
            <SurpriseCard key={m.no} match={m} navigation={navigation} />
          ))
        ) : (
          <View style={styles.emptySmallCard}>
            <Text style={styles.emptySmallTxt}>Sürpriz analizi için veri bekleniyor.</Text>
          </View>
        )}
      </ScrollView>

      {/* Yaklaşan Maçlar — GERÇEK bülten verisinden (gün + saat + takımlar).
          Toplulukta Gündem kaldırıldı (kullanıcı isteği; içeriği sahte örnekti —
          sahte veri yok kuralıyla da uyumlu). */}
      {upcoming.length > 0 && (
        <>
          <SectionHead
            title="Yaklaşan Maçlar"
            right="Tümünü Gör ›"
            onPress={() => navigation.navigate('BulletinTab')}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.surpriseScroll}
          >
            {upcoming.map((m) => (
              <KickoffCard key={m.no} match={m} navigation={navigation} />
            ))}
          </ScrollView>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  screenPad: {
    paddingHorizontal: spacing.md,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl + 2,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },

  brand: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.7,
  },

  brandAccent: {
    color: colors.accent,
  },

  readyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 7,
  },

  readyDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.field,
  },

  readyText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },

  topIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bellIcon: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    transform: [{ rotate: '-18deg' }],
  },

  broadcastIcon: {
    fontSize: 20,
  },

  notificationDot: {
    position: 'absolute',
    right: 2,
    top: 2,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  notificationDotTxt: { color: '#fff', fontSize: 10, fontWeight: '900' },

  avatarBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
  },

  sectionRight: {
    color: colors.accent,
    fontSize: 13.5,
    fontWeight: '900',
  },

  analysisGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },

  analysisCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 205,
    ...shadows.soft,
  },

  tagPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  tagText: {
    fontSize: 10.5,
    fontWeight: '900',
  },

  analysisTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 8,
  },

  teamBlock: {
    width: 48,
    alignItems: 'center',
  },

  vsText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },

  analysisTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },

  analysisDesc: {
    color: colors.textMuted,
    fontSize: 12.2,
    lineHeight: 16,
    marginTop: 7,
  },

  analysisLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  smallTrend: {
    width: 22,
    height: 16,
    marginRight: 8,
    position: 'relative',
  },

  smallTrendA: {
    position: 'absolute',
    left: 1,
    bottom: 2,
    width: 13,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.field,
    transform: [{ rotate: '-35deg' }],
  },

  smallTrendB: {
    position: 'absolute',
    right: 0,
    top: 4,
    width: 13,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.field,
    transform: [{ rotate: '-35deg' }],
  },

  analysisLink: {
    color: colors.field,
    fontSize: 12.5,
    fontWeight: '900',
    flex: 1,
  },

  analysisChevron: {
    color: colors.field,
    fontSize: 20,
    fontWeight: '900',
  },

  surpriseScroll: {
    paddingHorizontal: spacing.md,
    gap: 10,
  },

  surpriseCard: {
    width: 156,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    ...shadows.soft,
  },

  surpriseLogos: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  surpriseVs: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
  },

  surpriseNames: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, marginTop: 4 },
  surpriseName: { flex: 1, color: colors.textSoft, fontSize: 10.5, fontWeight: '800' },
  surpriseNameR: { textAlign: 'right' },
  surpriseBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 9,
    gap: 6,
  },

  surpriseLevel: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  surpriseLevelTxt: {
    fontSize: 10,
    fontWeight: '900',
  },

  surprisePct: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },

  emptySmallCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  emptySmallTxt: {
    color: colors.textMuted,
    fontSize: 13,
  },

  /* ===== Yaklaşan maç kartları (gerçek bülten verisi) ===== */
  kickCard: {
    width: 170,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    ...shadows.soft,
  },

  kickTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },

  kickDay: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'capitalize',
    flexShrink: 1,
  },

  kickTime: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '900',
    marginLeft: 6,
  },

  kickTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 4,
  },

  kickTeam: {
    color: colors.text,
    fontSize: 12.5,
    fontWeight: '800',
    flex: 1,
  },

  kickLeague: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 8,
  },

  /* ===== Hero kart (component + gerçek istatistik) ===== */
  heroCard: {
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 22,
    backgroundColor: '#0f2038',
    borderWidth: 1,
    borderColor: '#1c3a5e',
    padding: 16,
    overflow: 'hidden',
  },
  heroWeekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroWeekDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    marginRight: 7,
  },
  heroWeekText: {
    color: '#cdd8e6',
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  heroBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  heroCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  heroTextBlock: {
    flex: 1,
    paddingRight: 10,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  heroDesc: {
    color: '#b8c6c8',
    fontSize: 11.5,
    lineHeight: 15,
    marginTop: 2,
  },
  heroStats: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroStatItem: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  heroStatIcon: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  heroStatValue: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },
  heroStatLabel: {
    color: '#c1cacc',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  heroDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#12615d',
    marginHorizontal: 7,
  },
  heroRight: {
    width: 122,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroIllustration: {
    width: 120,
    height: 74,
    backgroundColor: 'transparent',
  },
  heroButton: {
    flex: 1,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#ff7a00',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // Gösterişli dokunuş: turuncu parlama (gölge) — veri değil, saf görsel.
    shadowColor: '#ff7a00',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  heroSummaryBtn: {
    flex: 1,
    height: 44,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  heroSummaryTxt: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '900',
  },
  heroRecapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    marginTop: 10,
  },
  heroRecapTxt: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '900',
  },
  heroRecapArrow: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    marginLeft: 6,
  },
  heroButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  heroButtonArrow: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    marginLeft: 6,
    marginTop: -2,
  },
});
