import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';
import { useBulletinHistory } from '../hooks/useBulletinHistory';
import BulletinCard from '../components/BulletinCard';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import DemoDataBanner from '../components/DemoDataBanner';
import { EmptyState } from '../ui';

// A) Geçmiş Bültenler Ekranı — bülten listesi, durum, kilitlenme zamanı,
// kaç maç oynandı/sonuçlandı, sistem başarı oranı, kullanıcının kupon sonucu.
export default function BulletinHistoryScreen({ navigation }) {
  const { bulletins, loading, error, reload } = useBulletinHistory();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bülten Geçmişi</Text>
        <Text style={styles.muted}>Her bültenin maç öncesi analiz hali ve sonuçları</Text>
      </View>

      <DemoDataBanner note="Bülten Geçmişi henüz gerçek Spor Toto verisine bağlı değil — buradaki bültenler ÖRNEKTİR." />

      {loading && !bulletins ? (
        <LoadingState message="Bülten geçmişi yükleniyor…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !bulletins?.length ? (
        <EmptyState icon="📭" title="Henüz bülten yok" message="Geçmiş bülten bulunamadı." />
      ) : (
        <FlatList
          data={bulletins}
          keyExtractor={(b) => b.id}
          renderItem={({ item }) => (
            <BulletinCard
              bulletin={item}
              onPress={() => navigation.navigate('BulletinDetail', { bulletinId: item.id })}
            />
          )}
          contentContainerStyle={styles.listPad}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.lg, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  muted: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
  listPad: { padding: spacing.md, paddingBottom: spacing.xl },
});
