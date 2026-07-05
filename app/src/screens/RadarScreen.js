import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { api } from '../api';
import { colors, spacing, radius, labelColors } from '../theme';
import { SurpriseBadge, PredictionBadge } from '../components';
import NoInternetScreen, { isNetworkError } from '../components/NoInternetScreen';
import ScreenBackdrop from '../components/ScreenBackdrop';

export default function RadarScreen({ navigation }) {
  const [radar, setRadar] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const d = await api.radar();
      setRadar(d.radar);
    } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error) {
    if (isNetworkError(error)) {
      return <NoInternetScreen onRetry={load} onGoHome={() => navigation.navigate('HomeTab')} />;
    }
    return <View style={styles.center}><Text style={styles.muted}>{error}</Text></View>;
  }
  if (!radar) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  const renderItem = ({ item, index }) => {
    const c = labelColors[item.labelColor] || colors.gray;
    return (
      <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => navigation.navigate('MatchDetail', { no: item.no })}>
        <Text style={styles.rank}>{index + 1}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.teams} numberOfLines={1}>{item.home} - {item.away}</Text>
          <View style={styles.scoreBar}>
            <View style={{ width: `${item.surpriseScore}%`, height: 6, backgroundColor: c, borderRadius: 3 }} />
          </View>
        </View>
        <View style={styles.right}>
          <Text style={[styles.scoreNum, { color: c }]}>{item.surpriseScore}</Text>
          <SurpriseBadge label={item.label} labelColor={item.labelColor} small />
        </View>
        <PredictionBadge symbol={item.prediction} small />
      </TouchableOpacity>
    );
  };

  return (
    <ScreenBackdrop>
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <View style={styles.header}>
        <Text style={styles.title}>🎯 Sürpriz Radarı</Text>
        <Text style={styles.muted}>En sürprize açıktan en bankoya doğru sıralı</Text>
        <TouchableOpacity onPress={() => navigation.navigate('SystemScorecard')} style={styles.dashboardLink}>
          <Text style={styles.dashboardLinkTxt}>📊 Sistem Karnesi · Doğru/Yanlış ›</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={radar}
        keyExtractor={(r) => String(r.no)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.primary} />}
        ListEmptyComponent={<Text style={[styles.muted, { textAlign: 'center', marginTop: 40 }]}>Henüz oranlı maç yok.{'\n'}Kendi anahtarınla lig ekleyince dolacak.</Text>}
      />
    </View>
    </ScreenBackdrop>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24 },
  header: { padding: spacing.lg, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  muted: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  dashboardLink: { marginTop: 8 },
  dashboardLinkTxt: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  rank: { color: colors.textMuted, fontSize: 16, fontWeight: '800', width: 22, textAlign: 'center' },
  teams: { color: colors.text, fontSize: 14, fontWeight: '700' },
  scoreBar: { marginTop: 6, height: 6, backgroundColor: colors.cardAlt, borderRadius: 3, overflow: 'hidden' },
  right: { alignItems: 'flex-end', gap: 4 },
  scoreNum: { fontSize: 18, fontWeight: '900' },
});
