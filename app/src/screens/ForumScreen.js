import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { api } from '../api';
import { colors, spacing, radius } from '../theme';
import { MatchCard, SkeletonCard, EmptyState } from '../ui';

const FILTERS = ['Popüler', 'En Yeni', 'En Çok Beğenilen'];

export default function ForumScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('En Yeni');

  const load = useCallback(async () => {
    try { setError(null); setData(await api.bulletin()); } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const matches = data ? data.matches : [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xl }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.accent} />}>
      <View style={styles.header}>
        <Text style={styles.title}>Forum</Text>
        <Text style={styles.sub}>Topluluk · maç tartışmaları</Text>
      </View>

      {/* Filtre çipleri */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {FILTERS.map((f) => {
          const on = filter === f;
          return (
            <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[styles.chip, on && styles.chipOn]} activeOpacity={0.8}>
              <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{f}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.hint}>Bir maça dokun, Yorumlar sekmesinde toplulukla tartış.</Text>

      <View style={{ paddingHorizontal: spacing.md }}>
        {error ? (
          <EmptyState icon="⚠️" title="Akış alınamadı" subtitle={error} />
        ) : !data ? (
          <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
        ) : matches.length === 0 ? (
          <EmptyState icon="💬" title="Henüz tartışılacak maç yok" subtitle="Güncel bülten yayınlanınca maç tartışmaları burada listelenecek." />
        ) : (
          matches.map((m) => (
            <MatchCard key={m.no} match={m} onPress={() => navigation.navigate('MatchDetail', { no: m.no, tab: 'Yorumlar' })} />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.sm },
  title: { color: colors.text, fontSize: 24, fontWeight: '900' },
  sub: { color: colors.textMuted, fontSize: 12.5, marginTop: 3, fontWeight: '600' },
  chips: { paddingHorizontal: spacing.md, gap: 8, paddingVertical: spacing.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipTxt: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  chipTxtOn: { color: colors.accent, fontWeight: '800' },
  hint: { color: colors.textMuted, fontSize: 12, paddingHorizontal: spacing.lg, marginBottom: spacing.sm, fontStyle: 'italic' },
});
