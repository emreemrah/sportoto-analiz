// TAHMİN SIRALAMASI — GERÇEK lider tablosu.
//
// DÜRÜSTLÜK KURALLARI
//   • Sıralama yalnız RESMÎ sonuçlarla değerlendirilen tahminlerden gelir
//     (backend /api/predictions/leaderboard — resmî sonuç yoksa tablo boştur
//     ve bu açıkça söylenir; sahte/örnek sıra ASLA gösterilmez).
//   • Seviye rozetleri sunucudaki kalıcı puan defterinden gelir (istemci
//     hesaplayamaz/şişiremez).
//   • E-posta veya hassas veri görünmez — yalnız kullanıcı adı.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import theme from '../theme';
import { Screen, Card, Row, SectionTitle, Pill, StatCard, EmptyState } from '../ui';
import { api } from '../api';
import { useAuth } from '../auth';

const { colors, spacing, radius, font } = theme;

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setError(null); setData(await api.leaderboard()); }
    catch (e) { setError(e.message || 'Sıralama alınamadı.'); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const board = data?.leaderboard || [];
  const me = data?.me || null;
  const king = board[0] || null;
  const avgAcc = board.length
    ? Math.round(board.reduce((a, b) => a + (b.accuracy || 0), 0) / board.length)
    : null;
  const topThree = board.slice(0, 3);
  const others = board.slice(3);

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>
      <Card dark style={styles.hero}>
        <Row between center>
          <View style={{ flex: 1 }}>
            <Pill label="TOPLULUK" tone="dark" />
            <Text style={styles.heroTitle}>Tahmin Sıralaması</Text>
            <Text style={styles.heroText}>
              Sıralama yalnız resmî sonuçlarla değerlendirilen tahminlerden oluşur — kesin sonuç veya kazanç vaadi değildir.
            </Text>
          </View>
          <View style={styles.trophyBox}>
            <Ionicons name="trophy" size={34} color={colors.warning} />
          </View>
        </Row>
      </Card>

      {/* 👑 HAFTANIN İSABET KRALI — yalnız resmî sonuç açıklanmış haftada oluşur */}
      {king ? (
        <Card style={styles.kingCard}>
          <Text style={styles.kingKicker}>👑 HAFTANIN İSABET KRALI</Text>
          <Row between center style={{ marginTop: 6 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kingName} numberOfLines={1}>{king.username}</Text>
              <Text style={styles.kingSub}>
                {king.points} puan · %{king.accuracy} isabet ({king.correct}/{king.made})
              </Text>
            </View>
            {king.level ? <View style={styles.lvBadgeBig}><Text style={styles.lvBadgeBigTxt}>Sv {king.level}</Text></View> : null}
          </Row>
        </Card>
      ) : null}

      <View style={styles.statsGrid}>
        <StatCard
          icon={<Ionicons name="people" size={20} color={colors.primary} />}
          label="Katılımcı"
          value={board.length ? String(board.length) : '—'}
          hint="Bu haftanın tablosu"
          tone="primary"
        />
        <StatCard
          icon={<Ionicons name="checkmark-circle" size={20} color={colors.success} />}
          label="Ort. İsabet"
          value={avgAcc != null ? `%${avgAcc}` : '—'}
          hint="Resmî sonuçlarla"
          tone="success"
        />
      </View>

      <SectionTitle
        title="Sıralama"
        subtitle="Tam skor ve doğru sonuç puanları — yalnız resmî sonuçlar sayılır."
      />

      {error ? (
        <EmptyState icon="⚠️" title="Sıralama alınamadı" message={error} />
      ) : !data ? (
        <View style={styles.load}><ActivityIndicator color={colors.primary} /></View>
      ) : board.length === 0 ? (
        <EmptyState
          icon="🏆"
          title="Bu hafta henüz sıralama yok"
          message={data.note || 'Resmî sonuçlar açıklandıkça sıralama burada oluşur — sahte sıra gösterilmez.'}
        />
      ) : (
        <>
          <View style={styles.podium}>
            {topThree.map((b) => (
              <View key={b.userId} style={[styles.podiumCard, b.rank === 1 && styles.podiumCardFirst]}>
                <Text style={styles.podiumMedal}>{b.rank === 1 ? '🥇' : b.rank === 2 ? '🥈' : '🥉'}</Text>
                <Text style={styles.podiumName} numberOfLines={1}>{b.username}</Text>
                <Text style={styles.podiumScore}>{b.points}</Text>
                <View style={styles.podiumMeta}>
                  <Pill label={`%${b.accuracy}`} tone={b.rank === 1 ? 'success' : 'primary'} />
                  {b.level ? <View style={styles.lvBadge}><Text style={styles.lvBadgeTxt}>Sv {b.level}</Text></View> : null}
                </View>
              </View>
            ))}
          </View>

          {others.length ? (
            <Card style={styles.leaderCard}>
              {others.map((b) => (
                <View key={b.userId} style={styles.row}>
                  <Text style={styles.rowRank}>{b.rank}</Text>
                  <Text style={styles.rowName} numberOfLines={1}>{b.username}</Text>
                  {b.level ? <View style={styles.lvBadge}><Text style={styles.lvBadgeTxt}>Sv {b.level}</Text></View> : null}
                  <Text style={styles.rowAcc}>%{b.accuracy}</Text>
                  <Text style={styles.rowPts}>{b.points}p</Text>
                </View>
              ))}
            </Card>
          ) : null}

          {me ? (
            <Card style={styles.meCard}>
              <Text style={styles.meTxt}>
                Senin sıran: <Text style={styles.meStrong}>#{me.rank}</Text> · {me.points} puan · %{me.accuracy} isabet
              </Text>
            </Card>
          ) : user ? (
            <Card style={styles.meCard}>
              <Text style={styles.meTxt}>Bu hafta değerlendirilen tahminin yok — tahmin kilitle, resmî sonuçla sıralamaya gir.</Text>
            </Card>
          ) : null}
        </>
      )}

      <Card style={styles.noteCard}>
        <Text style={styles.noteTitle}>Puanlar nasıl hesaplanır?</Text>
        <Text style={styles.noteText}>
          Tam skor 5 · doğru sonuç 2 · anket isabetleri 1-2 puan. Değerlendirme
          yalnız resmî Spor Toto sonuçlarıyla yapılır; canlı/geçici skor sayılmaz.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginBottom: spacing.lg },
  heroTitle: { color: colors.white, fontSize: font.xxl, fontWeight: font.heavy, marginTop: spacing.md },
  heroText: { color: '#D7DEEA', fontSize: font.md, lineHeight: 21, marginTop: spacing.sm },
  trophyBox: {
    width: 76, height: 76, borderRadius: radius.xl, backgroundColor: colors.darkCardSoft,
    alignItems: 'center', justifyContent: 'center', marginLeft: spacing.md,
  },
  kingCard: { marginBottom: spacing.lg, borderWidth: 1.5, borderColor: colors.warning },
  kingKicker: { color: colors.warning, fontSize: 11.5, fontWeight: '900', letterSpacing: 1.5 },
  kingName: { color: colors.text, fontSize: 18, fontWeight: '900' },
  kingSub: { color: colors.textMuted, fontSize: 12.5, fontWeight: '700', marginTop: 3 },
  lvBadgeBig: { backgroundColor: colors.warning + '22', borderWidth: 1.5, borderColor: colors.warning, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 },
  lvBadgeBigTxt: { color: colors.warning, fontSize: 14, fontWeight: '900' },
  statsGrid: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  load: { paddingVertical: spacing.xl, alignItems: 'center' },
  podium: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  podiumCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.border, alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: 6,
  },
  podiumCardFirst: { borderColor: colors.warning, borderWidth: 1.5 },
  podiumMedal: { fontSize: 26 },
  podiumName: { color: colors.text, fontSize: 13, fontWeight: '900', marginTop: 4, maxWidth: '95%' },
  podiumScore: { color: colors.primary, fontSize: 18, fontWeight: '900', marginTop: 2 },
  podiumMeta: { alignItems: 'center', gap: 5, marginTop: spacing.sm },
  leaderCard: { marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowRank: { color: colors.textMuted, fontSize: 12.5, fontWeight: '900', width: 26, textAlign: 'center' },
  rowName: { flex: 1, color: colors.text, fontSize: 13.5, fontWeight: '800' },
  lvBadge: { backgroundColor: colors.primary + '18', borderWidth: 1, borderColor: colors.primary, borderRadius: 9, paddingHorizontal: 7, paddingVertical: 2 },
  lvBadgeTxt: { color: colors.primary, fontSize: 10.5, fontWeight: '900' },
  rowAcc: { color: colors.textMuted, fontSize: 12, fontWeight: '800', width: 44, textAlign: 'right' },
  rowPts: { color: colors.text, fontSize: 13, fontWeight: '900', width: 44, textAlign: 'right' },
  meCard: { marginBottom: spacing.md, borderWidth: 1, borderColor: colors.primary },
  meTxt: { color: colors.textSoft, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  meStrong: { color: colors.primary, fontWeight: '900' },
  noteCard: { marginBottom: spacing.xl },
  noteTitle: { color: colors.text, fontSize: font.md, fontWeight: font.heavy, marginBottom: spacing.sm },
  noteText: { color: colors.textMuted, fontSize: font.sm, lineHeight: 20 },
});
