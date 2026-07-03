// app/src/screens/LeaderboardScreen.js

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import theme from '../theme';
import {
  Screen,
  Card,
  Row,
  SectionTitle,
  Pill,
  ListItem,
  StatCard,
  ProgressBar,
  EmptyState,
} from '../ui';

const { colors, spacing, radius, font } = theme;

const toneColors = {
  primary: colors.primary,
  accent: colors.accent,
  success: colors.success,
  warning: colors.warning,
  info: colors.info,
};

// Gerçek sıralama verisi backend'e bağlanınca doldurulacak.
const leaders = [];

const achievements = [
  {
    icon: 'checkmark-circle',
    title: 'Güçlü Tercih İsabetçisi',
    subtitle: 'Güçlü tercih önerilerinde yüksek başarı oranı',
    badge: 'Yeni',
    tone: 'success',
  },
  {
    icon: 'flash',
    title: 'Sürpriz Bulucu',
    subtitle: 'Düşük ihtimalli maçlarda doğru işaret',
    badge: 'Risk',
    tone: 'warning',
  },
  {
    icon: 'stats-chart',
    title: 'Analiz Devamlılığı',
    subtitle: '7 gün üst üste yorum ve tahmin katkısı',
    badge: 'Seri',
    tone: 'info',
  },
];

function RankAvatar({ rank }) {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;

  return (
    <View style={[styles.rankAvatar, rank <= 3 && styles.rankAvatarTop]}>
      <Text style={styles.rankAvatarText}>{medal}</Text>
    </View>
  );
}

function LeaderRow({ item, isTop }) {
  return (
    <View style={[styles.leaderRow, isTop && styles.topLeaderRow]}>
      <Row center>
        <RankAvatar rank={item.rank} />

        <View style={{ flex: 1 }}>
          <Row center>
            <Text style={styles.leaderName}>{item.name}</Text>
            <Pill label={item.badge} tone={item.tone} style={styles.rankPill} />
          </Row>

          <Text style={styles.leaderTitle}>{item.title}</Text>

          <View style={styles.leaderProgress}>
            <Row between center style={{ marginBottom: spacing.xs }}>
              <Text style={styles.progressLabel}>Başarı oranı</Text>
              <Text style={styles.progressValue}>%{item.hitRate}</Text>
            </Row>
            <ProgressBar value={item.hitRate} tone={item.tone} />
          </View>
        </View>

        <View style={styles.scoreBox}>
          <Text style={styles.scoreValue}>{item.score}</Text>
          <Text style={styles.scoreLabel}>puan</Text>
          <Text style={styles.streakText}>🔥 {item.streak}</Text>
        </View>
      </Row>
    </View>
  );
}

export default function LeaderboardScreen() {
  const topThree = leaders.slice(0, 3);
  const others = leaders.slice(3);

  return (
    <Screen>
      <Card dark style={styles.hero}>
        <Row between center>
          <View style={{ flex: 1 }}>
            <Pill label="TOPLULUK" tone="dark" />
            <Text style={styles.heroTitle}>Tahmin ligi</Text>
            <Text style={styles.heroText}>
              Analiz yapan, sürpriz bulan ve bülteni doğru okuyan kullanıcılar burada yükselir.
            </Text>
          </View>

          <View style={styles.trophyBox}>
            <Ionicons name="trophy" size={34} color={colors.warning} />
          </View>
        </Row>
      </Card>

      <View style={styles.statsGrid}>
        <StatCard
          icon={<Ionicons name="people" size={20} color={colors.primary} />}
          label="Katılımcı"
          value="—"
          hint="Topluluk puanı"
          tone="primary"
        />
        <StatCard
          icon={<Ionicons name="checkmark-circle" size={20} color={colors.success} />}
          label="İsabet"
          value="—"
          hint="Haftalık ortalama"
          tone="success"
        />
      </View>

      <View style={styles.statsGrid}>
        <StatCard
          icon={<Ionicons name="flash" size={20} color={colors.warning} />}
          label="Sürpriz"
          value="—"
          hint="Yakalanan risk"
          tone="warning"
        />
        <StatCard
          icon={<Ionicons name="flame" size={20} color={colors.accent} />}
          label="Seri"
          value="—"
          hint="En uzun seri"
          tone="accent"
        />
      </View>

      <SectionTitle
        title="Sıralama"
        subtitle="Puan, başarı oranı ve seri durumuna göre topluluk sıralaması."
      />

      {leaders.length === 0 ? (
        <EmptyState
          icon="🏆"
          title="Sıralama verisi henüz hazır değil"
          message="Kullanıcılar analiz ve tahmin yaptıkça sıralama burada oluşacak."
        />
      ) : (
        <>
          <View style={styles.podium}>
            {topThree.map((leader, index) => (
              <View
                key={leader.name}
                style={[
                  styles.podiumCard,
                  index === 0 && styles.podiumCardFirst,
                ]}
              >
                <Text style={styles.podiumMedal}>
                  {leader.rank === 1 ? '🥇' : leader.rank === 2 ? '🥈' : '🥉'}
                </Text>
                <Text style={styles.podiumName}>{leader.name}</Text>
                <Text style={styles.podiumScore}>{leader.score}</Text>
                <Pill label={`%${leader.hitRate}`} tone={leader.tone} style={{ marginTop: spacing.sm }} />
              </View>
            ))}
          </View>

          <Card style={styles.leaderCard}>
            {leaders.map((leader, index) => (
              <LeaderRow
                key={leader.name}
                item={leader}
                isTop={index === 0}
              />
            ))}
          </Card>
        </>
      )}

      <SectionTitle
        title="Rozetler"
        subtitle="Kullanıcıyı uygulamaya geri getiren küçük kupa vitrini."
      />

      <Card>
        {achievements.map((item) => (
          <ListItem
            key={item.title}
            left={<Ionicons name={item.icon} size={22} color={toneColors[item.tone] || colors.primary} />}
            title={item.title}
            subtitle={item.subtitle}
            badge={item.badge}
            badgeTone={item.tone}
          />
        ))}
      </Card>

      <SectionTitle
        title="Takip Edilecekler"
        subtitle="Puan sistemi daha sonra gerçek kullanıcı verisine bağlanabilir."
      />

      <Card style={styles.noteCard}>
        <Text style={styles.noteTitle}>Önerilen puan mantığı</Text>
        <Text style={styles.noteText}>
          Doğru güçlü tercih +30, doğru alternatif işaret +18, sürpriz doğru tahmin +50,
          yorum katkısı +5 ve seri devamı +10 puan olarak hesaplanabilir.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginBottom: spacing.lg,
  },
  heroTitle: {
    color: colors.white,
    fontSize: font.xxl,
    fontWeight: font.heavy,
    marginTop: spacing.md,
  },
  heroText: {
    color: '#D7DEEA',
    fontSize: font.md,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  trophyBox: {
    width: 76,
    height: 76,
    borderRadius: radius.xl,
    backgroundColor: colors.darkCardSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
  },
  trophy: {
    fontSize: 38,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  podium: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  podiumCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  podiumCardFirst: {
    backgroundColor: colors.warningSoft,
    borderColor: '#FAD38A',
  },
  podiumMedal: {
    fontSize: 30,
  },
  podiumName: {
    color: colors.text,
    fontSize: font.sm,
    fontWeight: font.heavy,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  podiumScore: {
    color: colors.textSoft,
    fontSize: font.sm,
    fontWeight: font.bold,
    marginTop: 3,
  },
  leaderCard: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  leaderRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topLeaderRow: {
    backgroundColor: colors.surfaceSoft,
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
  },
  rankAvatar: {
    width: 42,
    height: 42,
    borderRadius: 42,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rankAvatarTop: {
    backgroundColor: colors.warningSoft,
  },
  rankAvatarText: {
    color: colors.primary,
    fontSize: font.md,
    fontWeight: font.heavy,
  },
  leaderName: {
    color: colors.text,
    fontSize: font.md,
    fontWeight: font.heavy,
  },
  rankPill: {
    marginLeft: spacing.sm,
  },
  leaderTitle: {
    color: colors.textSoft,
    fontSize: font.sm,
    marginTop: 2,
  },
  leaderProgress: {
    marginTop: spacing.sm,
  },
  progressLabel: {
    color: colors.muted,
    fontSize: font.xs,
    fontWeight: font.bold,
  },
  progressValue: {
    color: colors.text,
    fontSize: font.xs,
    fontWeight: font.heavy,
  },
  scoreBox: {
    alignItems: 'flex-end',
    marginLeft: spacing.md,
  },
  scoreValue: {
    color: colors.text,
    fontSize: font.md,
    fontWeight: font.heavy,
  },
  scoreLabel: {
    color: colors.muted,
    fontSize: font.xs,
  },
  streakText: {
    color: colors.accent,
    fontSize: font.xs,
    fontWeight: font.heavy,
    marginTop: spacing.xs,
  },
  achievementIcon: {
    fontSize: 24,
  },
  noteCard: {
    backgroundColor: colors.primarySoft,
    borderColor: '#D2DCEC',
  },
  noteTitle: {
    color: colors.primary,
    fontSize: font.lg,
    fontWeight: font.heavy,
  },
  noteText: {
    color: colors.textSoft,
    fontSize: font.md,
    lineHeight: 22,
    marginTop: spacing.sm,
  },
});
