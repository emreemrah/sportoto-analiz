import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../api';
import { colors, spacing, radius, shadows } from '../theme';
import { EmptyState, SkeletonCard, Logo } from '../ui';
import { ProfileAvatar } from '../components';
import BulletinHeroVisual, { BulletinHeroBackdrop } from '../components/BulletinHeroVisual';


const QUICK = [
  {
    key: 'bulletin',
    icon: require('../../assets/icons/current-bulletin.png'),
    label: 'Güncel\nBülten',
    tab: 'BulletinTab',
  },
  {
    key: 'history',
    icon: require('../../assets/icons/history-results.png'),
    label: 'Geçmiş\nSonuçlar',
    tab: 'BulletinTab',
  },
  {
    key: 'analysis',
    icon: require('../../assets/icons/analysis-center.png'),
    label: 'Analiz\nMerkezi',
    tab: 'AnalizTab',
  },
  {
    key: 'community',
    icon: require('../../assets/icons/community.png'),
    label: 'Topluluk',
    tab: 'ForumTab',
  },
  {
    key: 'profile',
    icon: require('../../assets/icons/profile.png'),
    label: 'Profil',
    tab: 'ProfileTab',
  },
];

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

function Header({ data, navigation }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.brand}>
          Spor Toto <Text style={styles.brandAccent}>Analiz</Text>
        </Text>
      </View>

      <TouchableOpacity style={styles.topIconBtn} activeOpacity={0.85}>
        <Text style={styles.bellIcon}>⌕</Text>
        <View style={styles.notificationDot} />
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

function HeroCard({ data, loading, onPress }) {
  const matches = data?.matches || [];
  // Sayılar YALNIZ güncel bültenin GERÇEK analizinden. "Maç Analizi" = analizi
  // olan (kapsanan) maç sayısı; kapsam dışı maç varsa şişirmez, yanıltmaz.
  const analyzed = matches.filter((m) => m?.analysis && m.analysis.surpriseScore != null);
  const total = analyzed.length;
  const featured = analyzed.filter((m) => Number(m.analysis.surpriseScore) >= 45).length;
  const surprise = analyzed.filter((m) => Number(m.analysis.surpriseScore) >= 65).length;
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

      <View style={styles.heroBottomRow}>
        <View style={styles.heroStats}>
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatValue}>{v(total)}</Text>
            <Text style={styles.heroStatLabel}>Maç Analizi</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatValue}>{v(featured)}</Text>
            <Text style={styles.heroStatLabel}>Öne Çıkan Analiz</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatValue}>{v(surprise)}</Text>
            <Text style={styles.heroStatLabel}>Sürpriz Maç</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.heroButton} onPress={onPress} activeOpacity={0.88}>
          <Text style={styles.heroButtonText}>Bülteni Aç</Text>
          <Text style={styles.heroButtonArrow}>›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function QuickCard({ item, navigation }) {
  return (
    <TouchableOpacity
      style={styles.quickCard}
      activeOpacity={0.86}
      onPress={() => navigation.navigate(item.tab)}
    >
      <View style={styles.quickIconWrap}>
        <Image
          source={item.icon}
          style={styles.quickIconImage}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.quickLabel}>{item.label}</Text>
    </TouchableOpacity>
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
          <Logo uri={match.stats?.home?.logo} name={match.home?.name} size={42} />
        </View>

        <Text style={styles.vsText}>VS</Text>

        <View style={styles.teamBlock}>
          <Logo uri={match.stats?.away?.logo} name={match.away?.name} size={42} />
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

function SurpriseCard({ match, level, navigation }) {
  const score = Number(match.analysis?.surpriseScore || 0);
  const color = level === 'YÜKSEK' ? colors.gold : colors.field;

  return (
    <TouchableOpacity
      style={styles.surpriseCard}
      activeOpacity={0.86}
      onPress={() => navigation.navigate('MatchDetail', { no: match.no })}
    >
      <View style={styles.surpriseLogos}>
        <Logo uri={match.stats?.home?.logo} name={match.home?.name} size={30} />
        <Text style={styles.surpriseVs}>VS</Text>
        <Logo uri={match.stats?.away?.logo} name={match.away?.name} size={30} />
      </View>

      <View style={styles.surpriseBottom}>
        <View style={[styles.surpriseLevel, { backgroundColor: color + '33' }]}>
          <Text style={[styles.surpriseLevelTxt, { color }]}>{level}</Text>
        </View>
        <Text style={styles.surprisePct}>İhtimal: %{score || 31}</Text>
      </View>
    </TouchableOpacity>
  );
}

function CommunityCard({ name, initials, text, likes, comments }) {
  return (
    <View style={styles.communityCard}>
      <View style={styles.communityHead}>
        <View style={styles.communityAvatar}>
          <Text style={styles.communityAvatarTxt}>{initials}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.communityNameRow}>
            <Text style={styles.communityName}>{name}</Text>
            <View style={styles.checkBadge}>
              <Text style={styles.checkTxt}>✓</Text>
            </View>
          </View>
          <Text style={styles.communityTime}>2 saat önce</Text>
        </View>

        <Text style={styles.moreDots}>•••</Text>
      </View>

      <Text style={styles.communityText} numberOfLines={3}>{text}</Text>

      <View style={styles.communityMeta}>
        <Text style={styles.communityMetaTxt}>♡ {likes}</Text>
        <Text style={styles.communityMetaTxt}>☵ {comments}</Text>
      </View>
    </View>
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
      <Header data={data} navigation={navigation} />

      <HeroCard
        data={data}
        loading={!data && !error}
        onPress={() => navigation.navigate('BulletinTab')}
      />

      <SectionHead title="Hızlı Erişim" />

      <View style={styles.quickGrid}>
        {QUICK.map((item) => (
          <QuickCard key={item.key} item={item} navigation={navigation} />
        ))}
      </View>

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
          {displayAnalysis.map((m, index) => (
            <AnalysisCard
              key={m.no}
              match={m}
              tag={index === 0 ? 'FORMDA' : 'DENGELİ'}
              color={index === 0 ? colors.field : colors.gold}
              navigation={navigation}
            />
          ))}
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
          displaySurprise.map((m, index) => (
            <SurpriseCard
              key={m.no}
              match={m}
              level={index < 2 ? 'YÜKSEK' : 'ORTA'}
              navigation={navigation}
            />
          ))
        ) : (
          <View style={styles.emptySmallCard}>
            <Text style={styles.emptySmallTxt}>Sürpriz analizi için veri bekleniyor.</Text>
          </View>
        )}
      </ScrollView>

      <SectionHead
        title="Toplulukta Gündem"
        right="Tümünü Gör ›"
        onPress={() => navigation.navigate('Forum')}
      />

      <View style={styles.communityGrid}>
        <CommunityCard
          initials="AO"
          name="Analiz Adam"
          likes="124"
          comments="28"
          text="Sirius - Mjällby karşılaşmasında kanat hücumları öne çıkabilir. Özellikle Sirius'un sağ kanadı etkili."
        />
        <CommunityCard
          initials="TG"
          name="Veri Takımı"
          likes="98"
          comments="19"
          text="Degerfors - Malmö maçında topa sahip olma yüzdesi %50 bandında gerçekleşebilir. Temkinli bir oyun bekliyoruz."
        />
      </View>
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

  notificationDot: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },

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

  quickGrid: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: 10,
  },

  quickCard: {
    flex: 1,
    minHeight: 118,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    ...shadows.soft,
  },

  quickIconWrap: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
    overflow: 'visible',
    marginBottom: 8,
  },

  quickIconImage: {
    width: 42,
    height: 42,
    backgroundColor: 'transparent',
  },

  quickLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 15,
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

  communityGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },

  communityCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 170,
    ...shadows.soft,
  },

  communityHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  communityAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#9a783c',
    alignItems: 'center',
    justifyContent: 'center',
  },

  communityAvatarTxt: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },

  communityNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  communityName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },

  checkBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.field,
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkTxt: {
    color: colors.bg,
    fontSize: 9,
    fontWeight: '900',
  },

  communityTime: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },

  moreDots: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '900',
  },

  communityText: {
    color: colors.text,
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 14,
  },

  communityMeta: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 'auto',
    paddingTop: 12,
  },

  communityMetaTxt: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
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
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#ff7a00',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
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
