// app/src/screens/ForumScreen.js

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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
  ProgressBar,
  EmptyState,
} from '../ui';

const { colors, spacing, radius, font } = theme;

const roomColors = {
  primary: colors.primary,
  info: colors.info,
  warning: colors.warning,
  success: colors.success,
};

const tabs = [
  { key: 'all', label: 'Tümü' },
  { key: 'bulletin', label: 'Bülten' },
  { key: 'analysis', label: 'Analiz' },
  { key: 'surprise', label: 'Sürpriz' },
];

// Gerçek topluluk verisi backend'e bağlanınca doldurulacak.
const posts = [];

const quickRooms = [
  {
    title: 'Bülten Sohbeti',
    subtitle: 'Güncel maç listesi, eksik veri, saat kontrolü',
    icon: 'list',
    badge: 'Bülten',
    tone: 'primary',
  },
  {
    title: 'Analiz Odası',
    subtitle: 'Form, olasılık, risk puanı, maç yorumu',
    icon: 'stats-chart',
    badge: 'Analiz',
    tone: 'info',
  },
  {
    title: 'Sürpriz Radarı',
    subtitle: 'Beklenmeyen sonuç adayları ve tahmin listesi dengesi',
    icon: 'flash',
    badge: 'Risk',
    tone: 'warning',
  },
  {
    title: 'Tahmin Listesi Fikirleri',
    subtitle: 'Güçlü tercih ve alternatif işaret önerileri',
    icon: 'clipboard',
    badge: 'Topluluk',
    tone: 'success',
  },
];

export default function ForumScreen() {
  const [activeTab, setActiveTab] = useState('all');

  const filteredPosts = useMemo(() => {
    if (activeTab === 'all') return posts;
    return posts.filter((post) => post.type === activeTab);
  }, [activeTab]);

  return (
    <Screen>
      <Card dark style={styles.hero}>
        <Row between center>
          <View style={{ flex: 1 }}>
            <Pill label="STADYUM" tone="dark" />
            <Text style={styles.heroTitle}>Tribün burada konuşuyor</Text>
            <Text style={styles.heroText}>
              Bülten, analiz, sürpriz maçlar ve tahmin listesi fikirleri tek sahada.
            </Text>
          </View>

          <View style={styles.heroIconBox}>
            <Ionicons name="people" size={30} color={colors.white} />
          </View>
        </Row>

        <Row style={styles.heroStats}>
          <View style={styles.heroStat}>
            {/* Sayı LİSTEDEN türer, elle yazılmaz. Değer aynı (4) — burada
                bir hata yoktu; amaç oda eklenip çıkarıldığında sayacın
                sessizce yanlışa düşmesini imkânsız kılmak. */}
            <Text style={styles.heroStatValue}>{quickRooms.length}</Text>
            <Text style={styles.heroStatLabel}>Oda</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>—</Text>
            <Text style={styles.heroStatLabel}>Yorum</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>—</Text>
            <Text style={styles.heroStatLabel}>Beğeni</Text>
          </View>
        </Row>
      </Card>

      <SectionTitle
        title="Hızlı Odalar"
        subtitle="Kullanıcı uygulamayı açınca aradığı konuya tek dokunuşla girsin."
      />

      {/* ODA KARTLARI HENÜZ ÇALIŞMIYOR — topluluk arka ucu bağlı değil.
          Eskiden TouchableOpacity idiler: dokunulunca sönüp geri geliyor ama
          HİÇBİR ŞEY olmuyordu. Çalışmayan bir şeyi düğme gibi göstermek,
          kullanıcıya "sen yanlış yaptın" hissi verir. Artık düz kart olarak
          çiziliyorlar ve durumu açıkça yazıyor. */}
      <View style={styles.roomGrid}>
        {quickRooms.map((room) => (
          <View key={room.title} style={styles.roomCard} accessible accessibilityRole="text">
            <Row between center>
              <Ionicons
                name={room.icon}
                size={22}
                color={roomColors[room.tone] || colors.primary}
              />
              <Pill label={room.badge} tone={room.tone} />
            </Row>
            <Text style={styles.roomTitle}>{room.title}</Text>
            <Text style={styles.roomSubtitle}>{room.subtitle}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.roomNote}>
        Odalar henüz açılmadı — topluluk özellikleri hazır olduğunda burada
        aktifleşecek.
      </Text>

      <SectionTitle
        title="Stadyum Akışı"
        subtitle="Topluluk gündemi, analiz yorumları ve risk sinyalleri."
      />

      <View style={styles.tabs}>
        {tabs.map((tab) => {
          const selected = activeTab === tab.key;

          return (
            <TouchableOpacity
              key={tab.key}
              activeOpacity={0.82}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tab, selected && styles.tabActive]}
            >
              <Text style={[styles.tabText, selected && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {filteredPosts.length === 0 ? (
        <EmptyState
          icon="💬"
          title="Henüz topluluk yorumu bulunmuyor"
          message="Gerçek kullanıcı yorumları backend'e bağlanınca burada görünecek."
        />
      ) : (
      <Card style={styles.feedCard}>
        {filteredPosts.map((post, index) => (
          <View
            key={post.id}
            style={[
              styles.postItem,
              index === filteredPosts.length - 1 && styles.postItemLast,
            ]}
          >
            <Row between center>
              <Text style={styles.postAuthor}>{post.author}</Text>
              <Pill label={post.badge} tone={post.tone} />
            </Row>

            <Text style={styles.postTitle}>{post.title}</Text>
            <Text style={styles.postBody}>{post.body}</Text>

            <View style={styles.postPower}>
              <Row between center style={{ marginBottom: spacing.sm }}>
                <Text style={styles.postPowerLabel}>Etkileşim gücü</Text>
                <Text style={styles.postPowerValue}>%{post.power}</Text>
              </Row>
              <ProgressBar value={post.power} tone={post.tone} />
            </View>

            <Row style={styles.postFooter}>
              <Text style={styles.postFooterText}>💬 {post.comments} yorum</Text>
              <Text style={styles.postFooterText}>🔥 {post.likes} beğeni</Text>
            </Row>
          </View>
        ))}
      </Card>
      )}

      <SectionTitle
        title="Günün Sabit Başlıkları"
        subtitle="Forum boş kalmasın, kullanıcıya hazır gündem sunsun."
      />

      <Card>
        <ListItem
          left={<Ionicons name="bulb" size={22} color={colors.info} />}
          title="Bugünün en mantıklı güçlü tercihi hangisi?"
          subtitle="Güçlü tercih maçları için topluluk kontrolü."
          badge="Tartış"
          badgeTone="info"
        />
        <ListItem
          left={<Ionicons name="flash" size={22} color={colors.warning} />}
          title="Sürpriz yapabilecek takım var mı?"
          subtitle="Favori karşıtı maçlar, beraberlik ihtimali ve beklenmeyen sonuç riski."
          badge="Aktif"
          badgeTone="warning"
        />
        <ListItem
          left={<Ionicons name="time" size={22} color={colors.success} />}
          title="Geçmiş bültenden dersler"
          subtitle="15, 14, 13, 12 bilen dağılımı ve sonuç alışkanlıkları."
          badge="Geçmiş"
          badgeTone="success"
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    overflow: 'hidden',
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
  heroIconBox: {
    width: 76,
    height: 76,
    borderRadius: radius.xl,
    backgroundColor: colors.darkCardSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
  },
  heroIcon: {
    fontSize: 38,
  },
  heroStats: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  heroStat: {
    flex: 1,
    backgroundColor: colors.darkCardSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  heroStatValue: {
    color: colors.white,
    fontSize: font.xl,
    fontWeight: font.heavy,
  },
  heroStatLabel: {
    color: '#B8C1D1',
    fontSize: font.sm,
    marginTop: 2,
  },
  roomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  roomCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roomIcon: {
    fontSize: 24,
  },
  roomTitle: {
    color: colors.text,
    fontSize: font.md,
    fontWeight: font.heavy,
    marginTop: spacing.lg,
  },
  roomSubtitle: {
    color: colors.textSoft,
    fontSize: font.sm,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  roomNote: {
    color: colors.textMuted,
    fontSize: font.sm,
    lineHeight: 18,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    padding: spacing.xs,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    color: colors.primary,
    fontSize: font.sm,
    fontWeight: font.bold,
  },
  tabTextActive: {
    color: colors.white,
  },
  feedCard: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  postItem: {
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  postItemLast: {
    borderBottomWidth: 0,
  },
  postAuthor: {
    color: colors.textSoft,
    fontSize: font.sm,
    fontWeight: font.bold,
  },
  postTitle: {
    color: colors.text,
    fontSize: font.lg,
    fontWeight: font.heavy,
    marginTop: spacing.md,
  },
  postBody: {
    color: colors.textSoft,
    fontSize: font.md,
    lineHeight: 21,
    marginTop: spacing.xs,
  },
  postPower: {
    marginTop: spacing.md,
  },
  postPowerLabel: {
    color: colors.textSoft,
    fontSize: font.sm,
    fontWeight: font.bold,
  },
  postPowerValue: {
    color: colors.text,
    fontSize: font.sm,
    fontWeight: font.heavy,
  },
  postFooter: {
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  postFooterText: {
    color: colors.muted,
    fontSize: font.sm,
    fontWeight: font.bold,
  },
  listEmoji: {
    fontSize: 24,
  },
});
