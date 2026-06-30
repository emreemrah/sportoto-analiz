import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { api } from '../api';
import { colors, spacing, radius } from '../theme';
import { useAuth } from '../auth';
import { EmptyState, SkeletonCard } from '../ui';

export default function LeaderboardScreen({ navigation }) {
  const { user } = useAuth();
  const [rounds, setRounds] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.rounds().then(setRounds).catch(() => {}); }, []);

  const load = useCallback(async (roundId) => {
    setLoading(true);
    try { setData(await api.leaderboard(roundId)); } catch (e) { setData({ error: e.message }); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(selectedId); }, [selectedId, load]);

  const allRounds = rounds?.rounds || [];
  const curIdx = allRounds.findIndex((r) => r.id === (rounds?.currentRoundId));
  const navRounds = curIdx >= 0 ? allRounds.slice(0, curIdx + 1) : allRounds;
  const effId = selectedId ?? rounds?.currentRoundId;
  const selIdx = navRounds.findIndex((r) => r.id === effId);
  const selMeta = navRounds[selIdx];
  const canPrev = selIdx > 0;
  const canNext = selIdx >= 0 && selIdx < navRounds.length - 1;

  const board = data?.leaderboard || [];
  const me = data?.me;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xl }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => load(selectedId)} tintColor={colors.accent} />}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => canPrev && setSelectedId(navRounds[selIdx - 1].id)} disabled={!canPrev} style={[styles.nav, !canPrev && styles.navOff]}>
          <Text style={styles.navTxt}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title}>🏆 Tahmin Sıralaması</Text>
          <Text style={styles.sub}>{selMeta ? `${selMeta.year || ''} ${selMeta.name}` : 'Hafta'}</Text>
        </View>
        <TouchableOpacity onPress={() => canNext && setSelectedId(navRounds[selIdx + 1].id)} disabled={!canNext} style={[styles.nav, !canNext && styles.navOff]}>
          <Text style={styles.navTxt}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: spacing.md }}>
        {loading ? (
          <SkeletonCard />
        ) : data?.error ? (
          <EmptyState icon="⚠️" title="Sıralama alınamadı" subtitle={data.error} />
        ) : board.length === 0 ? (
          <EmptyState icon="⏳" title="Henüz puan yok" subtitle={data?.note || 'Sonuçlar açıklanınca puanlar burada görünür. Skor ve anket tahminleri puanlanır.'} />
        ) : (
          <>
            {me && (
              <View style={[styles.row, styles.meRow]}>
                <Text style={[styles.rank, styles.meTxt]}>{me.rank}</Text>
                <Text style={[styles.name, styles.meTxt]} numberOfLines={1}>{me.username} (sen)</Text>
                <Text style={styles.acc}>%{me.accuracy}</Text>
                <Text style={[styles.pts, styles.meTxt]}>{me.points} P</Text>
              </View>
            )}
            {board.map((b) => {
              const isMe = user && b.userId === user.id;
              return (
                <View key={b.userId} style={[styles.row, isMe && styles.meRow]}>
                  <Text style={[styles.rank, b.rank <= 3 && styles.top3]}>{b.rank <= 3 ? ['🥇', '🥈', '🥉'][b.rank - 1] : b.rank}</Text>
                  <Text style={styles.name} numberOfLines={1}>{b.username}</Text>
                  <Text style={styles.acc}>%{b.accuracy}</Text>
                  <Text style={styles.pts}>{b.points} P</Text>
                </View>
              );
            })}
            <Text style={styles.note}>Puanlama: tam skor +5 · doğru sonuç +2 · doğru anket +1/+2. (Oyuncu/kadro puanlanmaz.)</Text>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, paddingTop: spacing.xl, backgroundColor: colors.bgAlt, borderBottomWidth: 1, borderBottomColor: colors.border },
  nav: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  navOff: { opacity: 0.3 },
  navTxt: { color: colors.text, fontSize: 24, fontWeight: '900' },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: radius.sm, paddingVertical: 11, paddingHorizontal: 12, marginBottom: 6, marginTop: spacing.sm },
  meRow: { borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.accent + '14' },
  meTxt: { color: colors.accent },
  rank: { width: 28, color: colors.textMuted, fontSize: 14, fontWeight: '900', textAlign: 'center' },
  top3: { fontSize: 17 },
  name: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
  acc: { color: colors.textMuted, fontSize: 12, fontWeight: '700', width: 44, textAlign: 'right' },
  pts: { color: colors.text, fontSize: 14, fontWeight: '900', width: 50, textAlign: 'right' },
  note: { color: colors.textMuted, fontSize: 11, marginTop: spacing.md, lineHeight: 15 },
});
