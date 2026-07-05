import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme';
import { useCoupon } from '../hooks/useCoupon';
import { MOCK_USER_ID } from '../data/mockCoupons';
import ResultComparisonCard from '../components/ResultComparisonCard';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import DemoDataBanner from '../components/DemoDataBanner';
import { EmptyState } from '../ui';

// D) Kupon Sonuç Ekranı — kaç doğru/yanlış, yatan maçlar, doğru maçlar,
// kullanıcı seçimi, gerçek sonuç, sistem önerisi.
export default function CouponResultScreen({ route }) {
  const { bulletinId } = route.params || {};
  const { bulletin, coupon, loading, error, reload } = useCoupon(bulletinId, MOCK_USER_ID);

  if (loading && !bulletin) return <LoadingState message="Kupon sonucu yükleniyor…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!coupon) {
    return <EmptyState icon="🎟️" title="Kupon yok" message="Bu bülten için henüz kaydedilmiş bir kuponun yok." />;
  }

  const yatanlar = coupon.selections.filter((s) => s.isCorrect === false);
  const bekleyen = coupon.selections.filter((s) => s.isCorrect === null);

  return (
    <View style={styles.container}>
      <DemoDataBanner note="Kupon/sonuç verileri ÖRNEKTİR — gerçek Spor Toto sonucu değildir." />
      <View style={styles.header}>
        <Text style={styles.title}>Kupon Sonucu · {bulletin.bulletinNo}</Text>
        {coupon.resultSummary ? (
          <Text style={styles.big}>{coupon.resultSummary.total} maçtan {coupon.resultSummary.correct} doğru</Text>
        ) : (
          <Text style={styles.muted}>Henüz sonuç yok</Text>
        )}
        {bekleyen.length > 0 && <Text style={styles.muted}>{bekleyen.length} maç sonuç bekliyor</Text>}
      </View>

      <FlatList
        data={coupon.selections}
        keyExtractor={(s) => s.matchId}
        renderItem={({ item }) => {
          const match = bulletin.matches.find((m) => m.id === item.matchId);
          return (
            <ResultComparisonCard
              orderNo={match?.orderNo}
              homeTeam={match?.homeTeam.name}
              awayTeam={match?.awayTeam.name}
              userPick={item.userPick}
              systemPick={item.systemPickAtSaveTime}
              actualResult={item.actualResult}
              isCorrect={item.isCorrect}
            />
          );
        }}
        contentContainerStyle={styles.listPad}
        ListHeaderComponent={
          yatanlar.length > 0 ? (
            <View style={styles.missBox}>
              <Text style={styles.sectionTitle}>Yatan Maçlar ({yatanlar.length})</Text>
              {yatanlar.map((s) => {
                const match = bulletin.matches.find((m) => m.id === s.matchId);
                return (
                  <Text key={s.matchId} style={styles.missLine}>
                    {match?.orderNo}. maç: Sen {s.userPick} seçtin, sonuç {s.actualResult} geldi.
                  </Text>
                );
              })}
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.lg, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  big: { color: colors.primary, fontSize: 16, fontWeight: '900', marginTop: 4 },
  muted: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
  listPad: { padding: spacing.md, paddingBottom: spacing.xl },
  missBox: { backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  sectionTitle: { color: colors.red, fontSize: 13.5, fontWeight: '800', marginBottom: 6 },
  missLine: { color: colors.text, fontSize: 12.5, marginTop: 3, lineHeight: 17 },
});
