// CANLI BÜLTEN — sadece resmi TEYİT EDİLMİŞ güncel bültendeki 15 maçı canlı
// takip. Ortak yapı LiveBulletinView'de; bu ekran veri çekme + teyit kilidi +
// 15 sn polling'i yönetir. (Aynı yapı "Bülten" ekranında da kullanılır.)
import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { colors, spacing } from '../theme';
import LiveBulletinView from '../components/LiveBulletinView';

const REFRESH_MS = 15000;

export default function LiveBulletinScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setError(null); setData(await api.bulletin()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  // 15 sn polling — SADECE ekran açıkken (ve web'de sekme görünürken).
  useFocusEffect(useCallback(() => {
    let alive = true;
    load();
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (alive) load();
    }, REFRESH_MS);
    return () => { alive = false; clearInterval(id); };
  }, [load]));

  if (loading && !data) {
    return <Center><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.muted}>Canlı bülten yükleniyor…</Text></Center>;
  }
  if (error) {
    return <Center><Text style={styles.emoji}>⚠️</Text><Text style={styles.errText}>Canlı bülten alınamadı.</Text><Text style={styles.muted}>{error}</Text>
      <TouchableOpacity style={styles.retry} onPress={load}><Text style={styles.retryTxt}>Tekrar Dene</Text></TouchableOpacity></Center>;
  }
  // TEYİT KİLİDİ: resmi teyit yoksa maç listesi AÇILMAZ.
  if (data?.pending || data?.verification?.status !== 'confirmed') {
    const failed = data?.verification?.status === 'failed';
    return <Center>
      <Text style={styles.emoji}>🕐</Text>
      <Text style={styles.errText}>{failed ? 'Bülten henüz resmi olarak doğrulanmadı' : 'Henüz açıklanmadı'}</Text>
      <Text style={[styles.muted, { textAlign: 'center', marginTop: 6 }]}>Güncel resmi bülten bekleniyor.{'\n'}Yalnızca resmi teyit edilen (tam 15 maçlık) bülten canlı takip edilir.</Text>
    </Center>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Canlı Bülten</Text>
      </View>
      <LiveBulletinView
        matches={data.matches || []}
        subtitle={`${data.round ? `${data.round} · ` : ''}✓ resmi teyitli · 15 sn'de bir yenilenir`}
        onCardPress={(no) => navigation.navigate('LiveMatchDetail', { no })}
        onRefresh={load}
      />
    </View>
  );
}

function Center({ children }) { return <View style={styles.center}>{children}</View>; }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontSize: 20, fontWeight: '900' },
  muted: { color: colors.textMuted, fontSize: 12, marginTop: 2, textAlign: 'center' },
  emoji: { fontSize: 40 },
  errText: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 6, textAlign: 'center' },
  retry: { marginTop: 16, backgroundColor: colors.primary, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 10 },
  retryTxt: { color: colors.white, fontWeight: '800' },
});
