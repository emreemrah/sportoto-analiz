import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Image, Platform } from 'react-native';
import { api } from '../api';
import { colors, spacing, radius } from '../theme';
import { PickGrid, MiniBars } from '../components';
import { matchDate } from '../utils';

// Maç başlamış mı? Sonucu/skoru var VEYA maç saati geçmiş (görüntüleme anında hesaplanır).
const isStarted = (m) => m.status === 'finished' || (m.date ? new Date(m.date).getTime() <= Date.now() : false);

export default function BulletinScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setError(null);
      const d = await api.bulletin();
      setData(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Tarayıcı otomatik çevirisini kapat (takım adları resmi/İngilizce kalsın).
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.setAttribute('translate', 'no');
      document.documentElement.classList.add('notranslate');
      if (!document.querySelector('meta[name="google"]')) {
        const meta = document.createElement('meta');
        meta.name = 'google';
        meta.content = 'notranslate';
        document.head.appendChild(meta);
      }
    }
  }, []);

  if (loading) {
    return <Center><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.muted}>Bülten yükleniyor…</Text></Center>;
  }
  if (error) {
    return (
      <Center>
        <Text style={styles.errEmoji}>⚠️</Text>
        <Text style={styles.errText}>Güncel başlamamış Spor Toto programı alınamadı.</Text>
        <Text style={styles.muted}>{error}</Text>
        <Text style={[styles.muted, { marginTop: 8, textAlign: 'center' }]}>
          Backend çalışıyor mu? (npm start) ve telefon aynı Wi-Fi'da mı?
        </Text>
        <TouchableOpacity style={styles.retry} onPress={load}><Text style={styles.retryText}>Tekrar Dene</Text></TouchableOpacity>
      </Center>
    );
  }

  // Tüm program başlamış/oynanmışsa: güncel başlamamış program henüz yok.
  const upcomingCount = data.matches.filter((m) => !isStarted(m)).length;
  if (upcomingCount === 0) {
    return (
      <Center>
        <Text style={styles.errEmoji}>🕐</Text>
        <Text style={styles.errText}>Program henüz yayınlanmadı</Text>
        <Text style={[styles.muted, { textAlign: 'center', marginTop: 6 }]}>
          Başlamamış güncel Spor Toto programı henüz yayınlanmadı.{'\n'}Bu haftanın maçları başlamış ya da oynanmış görünüyor.
        </Text>
        <TouchableOpacity style={styles.retry} onPress={load}><Text style={styles.retryText}>Yenile</Text></TouchableOpacity>
      </Center>
    );
  }

  const renderItem = ({ item }) => {
    const a = item.analysis;
    const d = matchDate(item.date);
    const started = isStarted(item);
    return (
      <TouchableOpacity
        style={[styles.card, started && styles.cardStarted]}
        activeOpacity={started ? 1 : 0.7}
        onPress={started ? undefined : () => navigation.navigate('MatchDetail', { no: item.no })}
      >
        {/* Sol: sıra no */}
        <Text style={styles.no}>{item.no}</Text>

        {/* Tarih / saat */}
        <View style={styles.dateBox}>
          <Text style={styles.dateDay}>{d.day}</Text>
          <Text style={styles.dateTime}>{d.time}</Text>
          {started ? <Text style={styles.startedMini}>başladı</Text> : null}
        </View>

        {/* Ev sahibi — VS — Deplasman */}
        <View style={styles.homeSide}>
          <TeamLogo logo={item.stats?.home?.logo} name={item.home.name} />
          <Text style={styles.teamName} numberOfLines={1}>{item.home.name}</Text>
        </View>
        <Text style={styles.vs}>VS</Text>
        <View style={styles.awaySide}>
          <Text style={[styles.teamName, styles.teamNameR]} numberOfLines={1}>{item.away.name}</Text>
          <TeamLogo logo={item.stats?.away?.logo} name={item.away.name} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Spor Toto · {data.round}</Text>
        <Text style={styles.muted}>
          {upcomingCount}/{data.matchCount} maç başlamadı · analiz hazır
          {data.usingExampleKey ? ' · (örnek anahtar)' : ''}
        </Text>
      </View>
      <FlatList
        data={data.matches}
        keyExtractor={(m) => String(m.no)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.primary} />}
      />
    </View>
  );
}

function Center({ children }) {
  return <View style={styles.center}>{children}</View>;
}

// Takım logosu — gerçek kulüp arması (FootyStats CDN). Logo yoksa/alınamazsa nötr ⚽.
function TeamLogo({ logo, name }) {
  const [err, setErr] = useState(false);
  if (logo && !err) {
    return <Image source={{ uri: logo }} style={styles.logo} resizeMode="contain" onError={() => setErr(true)} accessibilityLabel={name} />;
  }
  return <View style={styles.logoFallback}><Text style={styles.logoBall}>⚽</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24 },
  header: { padding: spacing.lg, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  muted: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  startedMini: { color: colors.gray, fontSize: 9, fontWeight: '900', letterSpacing: 0.3, marginTop: 2 },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  homeSide: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  awaySide: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 7 },
  teamName: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
  teamNameR: { textAlign: 'right' },
  vs: { color: colors.text, fontSize: 13, fontWeight: '900', letterSpacing: 1, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.cardAlt, borderRadius: 6 },
  no: { color: colors.textMuted, fontSize: 14, fontWeight: '800', width: 18, textAlign: 'center' },
  dateBox: { width: 46, alignItems: 'center' },
  dateDay: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  dateTime: { color: colors.text, fontSize: 12, fontWeight: '800', marginTop: 1 },
  teamsBox: { flex: 1, gap: 6 },
  teamLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  team: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
  logo: { width: 22, height: 22, borderRadius: 4 },
  logoFallback: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  logoBall: { fontSize: 13 },
  cardStarted: { opacity: 0.5 },
  startedTag: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm, backgroundColor: colors.gray + '22', borderWidth: 1, borderColor: colors.gray },
  startedTxt: { color: colors.textMuted, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  chartBox: { width: 28, alignItems: 'center', justifyContent: 'center' },
  errEmoji: { fontSize: 40 },
  errText: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 6 },
  retry: { marginTop: 18, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: colors.bg, fontWeight: '800' },
});
