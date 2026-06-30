import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { api } from '../api';
import { colors, spacing, radius } from '../theme';
import { QuickAccessCard, MatchCard, SkeletonCard, EmptyState } from '../ui';
import { ProfileAvatar } from '../components';

const QUICK = [
  { key: 'bulletin', icon: '📋', label: 'Güncel Bülten', sub: 'Bu hafta', color: colors.accent, tab: 'BulletinTab' },
  { key: 'past', icon: '🗂️', label: 'Geçmiş Bültenler', sub: 'Sonuçlar', color: colors.field, tab: 'BulletinTab' },
  { key: 'analiz', icon: '📊', label: 'Analizler', sub: 'Sürpriz & form', color: colors.gold, tab: 'AnalizTab' },
  { key: 'forum', icon: '💬', label: 'Forum', sub: 'Topluluk', color: colors.accent, tab: 'ForumTab' },
  { key: 'profil', icon: '👤', label: 'Profilim', sub: 'Hesabım', color: colors.field, tab: 'ProfileTab' },
];

export default function HomeScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try { setError(null); setData(await api.bulletin()); } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const upcoming = data ? data.matches.filter((m) => m.status !== 'finished').slice(0, 4) : [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xl }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.accent} />}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>Spor Toto <Text style={{ color: colors.accent }}>Analiz</Text></Text>
          <Text style={styles.tagline}>{data?.round ? `${data.round} · analiz hazır` : 'Analiz · İstatistik · Topluluk'}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('ProfileTab')} activeOpacity={0.8}>
          <ProfileAvatar size={40} />
        </TouchableOpacity>
      </View>

      {/* Hızlı erişim */}
      <Text style={styles.sectionLabel}>Hızlı Erişim</Text>
      <View style={styles.quickGrid}>
        {QUICK.map((q) => (
          <QuickAccessCard key={q.key} icon={q.icon} label={q.label} sub={q.sub} color={q.color}
            onPress={() => navigation.navigate(q.tab)} />
        ))}
      </View>

      {/* Güncel bülten özeti */}
      <View style={styles.rowBetween}>
        <Text style={styles.sectionLabel}>Güncel Bülten</Text>
        <TouchableOpacity onPress={() => navigation.navigate('BulletinTab')}><Text style={styles.seeAll}>Tümünü gör ›</Text></TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: spacing.md }}>
        {error ? (
          <EmptyState icon="⚠️" title="Bülten alınamadı" subtitle={error} />
        ) : !data ? (
          <><SkeletonCard /><SkeletonCard /></>
        ) : upcoming.length === 0 ? (
          <EmptyState icon="🕐" title="Analiz hazırlanıyor" subtitle="Başlamamış güncel program yayınlanınca burada görünecek." />
        ) : (
          upcoming.map((m) => (
            <MatchCard key={m.no} match={m} onPress={() => navigation.navigate('MatchDetail', { no: m.no })} />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, paddingTop: spacing.xl, gap: spacing.md },
  brand: { color: colors.text, fontSize: 22, fontWeight: '900' },
  tagline: { color: colors.textMuted, fontSize: 12.5, marginTop: 3, fontWeight: '600' },
  sectionLabel: { color: colors.text, fontSize: 16, fontWeight: '800', paddingHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.sm },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: spacing.md },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: spacing.lg },
  seeAll: { color: colors.accent, fontSize: 13, fontWeight: '800' },
});
