import React, { useState } from 'react';
import { View, Text, FlatList, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme';
import { Tabs, EmptyState } from '../ui';
import { useBulletinDetail } from '../hooks/useBulletinHistory';
import MatchPredictionRow from '../components/MatchPredictionRow';
import ResultComparisonCard from '../components/ResultComparisonCard';
import DashboardChartCard from '../components/DashboardChartCard';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import DemoDataBanner from '../components/DemoDataBanner';
import { BULLETIN_STATUS_LABEL } from '../types/bulletin';
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

  const sealed = !!(snapshot && snapshot.isLocked);
  const shortHash = snapshot?.shortHash || null;
  const rs = bulletin.resultSummary;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bülten {bulletin.bulletinNo}</Text>
        <Text style={styles.muted}>
          {BULLETIN_STATUS_LABEL[bulletin.status]}
          {bulletin.lockedAt ? ` · Kilit: ${matchDate(bulletin.lockedAt).day} ${matchDate(bulletin.lockedAt).time}` : ''}
          {bulletin.status === 'completed' && rs ? ` · Sistem: ${rs.systemCorrect}/${rs.totalCount}` : ''}
        </Text>
        {sealed ? (
          <Text style={styles.sealLine}>
            🔏 Mühürlü Analiz — bu bültenin tahmin ve analizleri değiştirilemez
            {shortHash ? ` · Doğrulama: #${shortHash}` : ''}
          </Text>
        ) : bulletin.freezeAt ? (
          <Text style={styles.freezeLine}>
            🔒 Analizler {matchDate(bulletin.freezeAt).day} {matchDate(bulletin.freezeAt).time} itibarıyla kilitlenecek
          </Text>
        ) : null}
      </View>

      {bulletin._demo && (
        <DemoDataBanner note="Arşiv sunucusuna ulaşılamadı — bu bülten detayı ÖRNEK veridir, gerçek Spor Toto bülteni/sonucu değildir." />
      )}

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
    const f = bulletin.freezeAt ? matchDate(bulletin.freezeAt) : null;
    return (
      <EmptyState
        icon="🔒"
        title="Analiz henüz mühürlenmedi"
        message={f
          ? `Analizler ${f.day} ${f.time} itibarıyla (ilk maçtan 5 dk önce) kilitlenecek ve arşive mühürlenecek.`
          : 'Bu bülten için henüz bir analiz kaydı oluşmadı.'}
      />
    );
  }
  const lockD = snapshot.lockedAt ? matchDate(snapshot.lockedAt) : null;
  return (
    <FlatList
      data={bulletin.matches}
      keyExtractor={(m) => m.id}
      renderItem={({ item }) => (
        <MatchPredictionRow match={item} analysis={snapshot.matchesAnalysis.find((a) => String(a.matchId) === String(item.id))} />
      )}
      contentContainerStyle={styles.listPad}
      ListHeaderComponent={
        <Text style={styles.lockNote}>
          {snapshot.isLocked
            ? `🔏 Mühürlü Analiz${lockD ? ` · ${lockD.day} ${lockD.time}` : ''} — maçlar başlamadan önce donduruldu; bu bültenin tahmin ve analizleri değiştirilemez. Sonradan gelen skor/istatistik bu kayda işlemez.${snapshot.shortHash ? ` Doğrulama: #${snapshot.shortHash}` : ''}`
            : '🔓 Analiz henüz düzenlenebilir (ilk maç başlamadı).'}
        </Text>
      }
    />
  );
}

function KuponTab() {
  // ESKİ demo kupon akışı KALDIRILDI. Kuponlar artık tek yerden, GERÇEK
  // veriyle çalışan Kupon Merkezi'nden yönetilir (alt bar → Kuponlarım).
  return (
    <View style={styles.listPad}>
      <EmptyState
        icon="🎟️"
        title="Kuponlar Kupon Merkezi'nde"
        message="Kupon oluşturma, sonuç ve paylaşım artık alt bardaki Kuponlarım (Kupon Merkezi) bölümünde — gerçek veriyle çalışır, demo kupon üretilmez."
      />
    </View>
  );
}
function ResultsTab({ bulletin, snapshot }) {
  if (!snapshot) return <EmptyState icon="📭" title="Sonuç yok" message="Bu hafta için analiz/sonuç kaydı yok." />;
  const rows = snapshot.matchesAnalysis.filter((m) => m.resultInfo && m.resultInfo.actualResult);
  if (!rows.length) {
    return <EmptyState icon="⏳" title="Resmî sonuçlar henüz açıklanmadı" message="Resmî 90 dakika sonuçları (1/X/2) geldikçe burada görünecek." />;
  }
  const dataD = rows[0]?.dataTimestamp ? matchDate(rows[0].dataTimestamp) : null;
  return (
    <FlatList
      data={rows}
      keyExtractor={(m) => String(m.matchId)}
      renderItem={({ item }) => {
        const match = bulletin.matches.find((m2) => String(m2.id) === String(item.matchId));
        return (
          <ResultComparisonCard
            orderNo={match?.orderNo ?? item.orderNo}
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
      ListHeaderComponent={
        <Text style={styles.lockNote}>
          {`Soldaki tahminler ${dataD ? `${dataD.day} ${dataD.time}` : 'kilit anı'} verisiyle MÜHÜRLENMİŞ hali; sağdaki sonuçlar resmî Spor Toto 90 dk sonucudur. İkisi ayrı kayıtlarda tutulur — sonuç, analizi geriye dönük değiştirmez.`}
        </Text>
      }
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
  sealLine: { color: colors.green, fontSize: 11.5, fontWeight: '800', marginTop: 6, lineHeight: 15 },
  freezeLine: { color: colors.orange, fontSize: 11.5, fontWeight: '800', marginTop: 6, lineHeight: 15 },
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
