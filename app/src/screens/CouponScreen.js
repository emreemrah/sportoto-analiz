import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { api } from '../api';
import { colors, spacing, radius } from '../theme';
import { PredictionBadge } from '../components';

export default function CouponScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await api.bulletin());
    } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error) return <View style={styles.center}><Text style={styles.muted}>{error}</Text></View>;
  if (!data) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  const matches = data.matches.filter((m) => m.prediction && m.prediction.symbol !== '-');

  // Dağılım: tek / çifte / üçlü
  const tek = matches.filter((m) => m.prediction.symbol.length === 1).length;
  const cifte = matches.filter((m) => m.prediction.symbol.length === 2).length;
  const uclu = matches.filter((m) => m.prediction.symbol === '102').length;

  // Kopyalanacak düz metin
  const couponText = matches
    .map((m) => `${m.no}. ${m.home.mediumName} - ${m.away.mediumName} → ${m.prediction.symbol}`)
    .join('\n');

  const copy = async () => {
    try {
      if (Platform.OS === 'web' && navigator?.clipboard) {
        await navigator.clipboard.writeText(couponText);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => navigation.navigate('MatchDetail', { no: item.no })}>
      <Text style={styles.no}>{item.no}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.teams} numberOfLines={1}>{item.home.mediumName} - {item.away.mediumName}</Text>
        <Text style={styles.reason} numberOfLines={1}>{item.prediction.label} · {item.prediction.reason}</Text>
      </View>
      <PredictionBadge symbol={item.prediction.symbol} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🎟️ Kupon · {data.round}</Text>
        <Text style={styles.muted}>{tek} tek · {cifte} çifte · {uclu} üçlü</Text>
      </View>

      <FlatList
        data={matches}
        keyExtractor={(m) => String(m.no)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 90 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.primary} />}
        ListFooterComponent={
          <Text style={styles.note}>
            Tahminler kurallı motor tarafından üretilir (form, iç/dış saha, H2H, beraberlik riski, sürpriz).
            Eksik/sakat verisi dahil değildir. Kupon tavsiyesi değil, analiz amaçlıdır.
          </Text>
        }
      />

      <TouchableOpacity style={styles.copyBtn} activeOpacity={0.85} onPress={copy}>
        <Text style={styles.copyText}>{copied ? '✓ Kopyalandı' : '📋 Kuponu Kopyala'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24 },
  header: { padding: spacing.lg, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  muted: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  no: { color: colors.textMuted, fontSize: 14, fontWeight: '800', width: 22, textAlign: 'center' },
  teams: { color: colors.text, fontSize: 14, fontWeight: '700' },
  reason: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  note: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: spacing.md, paddingHorizontal: spacing.xs },
  copyBtn: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.lg, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  copyText: { color: colors.bg, fontSize: 15, fontWeight: '800' },
});
