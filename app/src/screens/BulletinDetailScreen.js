import React, { useState } from 'react';
import { View, Text, FlatList, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme';
import { Tabs, EmptyState } from '../ui';
import { useBulletinDetail } from '../hooks/useBulletinHistory';
import { isCouponEditable } from '../services/couponService';
import MatchPredictionRow from '../components/MatchPredictionRow';
import ResultComparisonCard from '../components/ResultComparisonCard';
import DashboardChartCard from '../components/DashboardChartCard';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import DemoDataBanner from '../components/DemoDataBanner';
import { BULLETIN_STATUS_LABEL } from '../types/bulletin';
import { COUPON_STATUS_LABEL } from '../types/coupon';
import { ERROR_TAG_LABEL } from '../types/analysis';
import { matchDate } from '../utils';

const TAB_NAMES = ['Maçlar', 'Kilitli Analiz', 'Kuponum', 'Sonuçlar', 'Sistem Karnesi'];

// B) Bülten Detay Ekranı — sekmeli: Maçlar / Kilitli Analiz / Kuponum /
// Sonuçlar / Sistem Karnesi. Hem aktif hem geçmiş bültenler için kullanılır.
export default function BulletinDetailScreen({ route, navigation }) {
  const { bulletinId } = route.params || {};
  const { bulletin, snapshot, coupon, loading, error, reload } = useBulletinDetail(bulletinId);
  const [tab, setTab] = useState(TAB_NAMES[0]);

  if (loading && !bulletin) return <LoadingState message="Bülten detayı yükleniyor…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!bulletin) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bülten {bulletin.bulletinNo}</Text>
        <Text style={styles.muted}>
          {BULLETIN_STATUS_LABEL[bulletin.status]}
          {bulletin.lockedAt ? ` · Kilit: ${matchDate(bulletin.lockedAt).day} ${matchDate(bulletin.lockedAt).time}` : ''}
        </Text>
      </View>

      <DemoDataBanner note="Bu bülten detayı ÖRNEK veridir — gerçek Spor Toto bülteni/sonucu değildir." />

      <Tabs tabs={TAB_NAMES} active={tab} onChange={setTab} />

      <View style={{ flex: 1 }}>
        {tab === 'Maçlar' && <MatchesTab bulletin={bulletin} />}
        {tab === 'Kilitli Analiz' && <LockedAnalysisTab bulletin={bulletin} snapshot={snapshot} />}
        {tab === 'Kuponum' && <KuponTab bulletin={bulletin} coupon={coupon} navigation={navigation} />}
        {tab === 'Sonuçlar' && <ResultsTab bulletin={bulletin} snapshot={snapshot} />}
        {tab === 'Sistem Karnesi' && <SystemKarnesiTab snapshot={snapshot} />}
      </View>
    </View>
  );
}

function MatchesTab({ bulletin }) {
  return (
    <FlatList
      data={bulletin.matches}
      keyExtractor={(m) => m.id}
      renderItem={({ item }) => <MatchPredictionRow match={item} analysis={null} />}
      contentContainerStyle={styles.listPad}
    />
  );
}

function LockedAnalysisTab({ bulletin, snapshot }) {
  if (!snapshot) {
    return <EmptyState icon="🔒" title="Analiz snapshot yok" message="Bu bülten için henüz bir analiz kaydı oluşmadı." />;
  }
  return (
    <FlatList
      data={bulletin.matches}
      keyExtractor={(m) => m.id}
      renderItem={({ item }) => (
        <MatchPredictionRow match={item} analysis={snapshot.matchesAnalysis.find((a) => a.matchId === item.id)} />
      )}
      contentContainerStyle={styles.listPad}
      ListHeaderComponent={
        <Text style={styles.lockNote}>
          {snapshot.isLocked
            ? `🔒 Analiz maçlar başlamadan önce donduruldu. Bu, o andaki hali.`
            : '🔓 Analiz henüz düzenlenebilir (ilk maç başlamadı).'}
        </Text>
      }
    />
  );
}

function KuponTab({ bulletin, coupon, navigation }) {
  const editable = isCouponEditable(bulletin);

  if (!coupon) {
    return (
      <View style={styles.listPad}>
        <EmptyState
          icon="🎟️"
          title="Henüz kupon oluşturmadın"
          message={editable ? 'Bu bülten için 15 maçlık kuponunu oluşturabilirsin.' : 'Bu bülten için kupon oluşturulmadı.'}
        />
        {editable && (
          <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('CouponCreate', { bulletinId: bulletin.id })}>
            <Text style={styles.ctaTxt}>Kupon Oluştur</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <FlatList
      data={coupon.selections}
      keyExtractor={(s) => s.matchId}
      renderItem={({ item, index }) => {
        const match = bulletin.matches.find((m) => m.id === item.matchId);
        return (
          <ResultComparisonCard
            orderNo={match?.orderNo ?? index + 1}
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
        <View style={styles.couponHead}>
          <Text style={styles.couponHeadTxt}>
            Versiyon {coupon.version} · {COUPON_STATUS_LABEL[coupon.status]}
            {coupon.resultSummary ? ` · ${coupon.resultSummary.correct}/${coupon.resultSummary.total} doğru` : ' · sonuç bekleniyor'}
          </Text>
          <View style={styles.couponBtnRow}>
            {editable && (
              <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate('CouponCreate', { bulletinId: bulletin.id })}>
                <Text style={styles.editBtnTxt}>Düzenle (yeni versiyon)</Text>
              </TouchableOpacity>
            )}
            {coupon.resultSummary && (
              <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate('CouponResult', { bulletinId: bulletin.id })}>
                <Text style={styles.editBtnTxt}>Kupon Sonuç Ekranı</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      }
    />
  );
}

function ResultsTab({ bulletin, snapshot }) {
  if (!snapshot) return <EmptyState icon="📭" title="Sonuç yok" message="Bu hafta için analiz/sonuç kaydı yok." />;
  const rows = snapshot.matchesAnalysis.filter((m) => m.resultInfo && m.resultInfo.actualResult);
  if (!rows.length) {
    return <EmptyState icon="⏳" title="Sonuçlar henüz açıklanmadı" message="Maçlar oynandıkça burada görünecek." />;
  }
  return (
    <FlatList
      data={rows}
      keyExtractor={(m) => m.matchId}
      renderItem={({ item }) => {
        const match = bulletin.matches.find((m2) => m2.id === item.matchId);
        return (
          <ResultComparisonCard
            orderNo={match?.orderNo}
            homeTeam={match?.homeTeam.name}
            awayTeam={match?.awayTeam.name}
            userPick={null}
            systemPick={item.prediction}
            actualResult={item.resultInfo.actualResult}
            isCorrect={item.resultInfo.systemCorrect}
          />
        );
      }}
      contentContainerStyle={styles.listPad}
    />
  );
}

function SystemKarnesiTab({ snapshot }) {
  if (!snapshot) return <EmptyState icon="📊" title="Veri yok" message="Bu bülten için sistem karnesi oluşmadı." />;
  const resolved = snapshot.matchesAnalysis.filter((m) => m.resultInfo && m.resultInfo.systemCorrect !== null);
  if (!resolved.length) {
    return <EmptyState icon="⏳" title="Henüz sonuç yok" message="Maçlar sonuçlandıkça sistem karnesi burada oluşacak." />;
  }
  const correct = resolved.filter((m) => m.resultInfo.systemCorrect).length;
  const rate = Math.round((correct / resolved.length) * 100);
  const errorCounts = {};
  resolved.forEach((m) => {
    if (!m.resultInfo.systemCorrect && m.resultInfo.errorTag) {
      errorCounts[m.resultInfo.errorTag] = (errorCounts[m.resultInfo.errorTag] || 0) + 1;
    }
  });
  const wrong = resolved.length - correct;
  return (
    <ScrollView contentContainerStyle={styles.listPad}>
      <DashboardChartCard
        title={`Sistem başarısı: ${correct}/${resolved.length} (%${rate})`}
        rows={[{ label: 'Doğru oran', value: rate, color: colors.green }]}
      />
      {Object.keys(errorCounts).length > 0 && (
        <DashboardChartCard
          title="Hata dağılımı"
          rows={Object.entries(errorCounts).map(([tag, n]) => ({
            label: `${ERROR_TAG_LABEL[tag] || tag} (${n})`,
            value: wrong ? Math.round((n / wrong) * 100) : 0,
            color: colors.red,
          }))}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.lg, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  muted: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
  listPad: { padding: spacing.md, paddingBottom: spacing.xl },
  lockNote: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic', marginBottom: spacing.sm, lineHeight: 17 },
  cta: { marginTop: spacing.md, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  ctaTxt: { color: colors.bg, fontSize: 14.5, fontWeight: '800' },
  couponHead: { marginBottom: spacing.sm },
  couponHeadTxt: { color: colors.textMuted, fontSize: 12.5, fontWeight: '700', marginBottom: spacing.sm },
  couponBtnRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  editBtn: { backgroundColor: colors.cardAlt, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8 },
  editBtnTxt: { color: colors.primary, fontSize: 12, fontWeight: '800' },
});
