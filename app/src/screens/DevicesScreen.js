// BAĞLI CİHAZLAR — kullanıcının etkin oturumları; istediği cihazı UZAKTAN kapatır.
//
//   • Liste sunucudan gelir; yalnız KENDİ oturumların görünür.
//   • "Oturumu Kapat" sunucudaki kaydı iptal eder: o cihazın yenilemesi ve
//     korumalı istekleri anında reddedilir.
//   • Bu cihazın oturumu "Bu cihaz" olarak işaretlenir ve buradan kapatılmaz
//     (çıkış için Profil → Çıkış Yap).
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { colors, spacing, radius } from '../theme';
import ScreenBackdrop from '../components/ScreenBackdrop';
import { api } from '../api';

const PLATFORM_ICON = { android: '🤖', ios: '📱', web: '💻' };

function timeAgo(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'şimdi';
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat önce`;
  return `${Math.floor(h / 24)} gün önce`;
}

export default function DevicesScreen() {
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setErr(null);
    try { setData(await api.sessions()); }
    catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const revoke = async (id) => {
    setBusyId(id); setErr(null);
    try { await api.revokeSession(id); await load(); }
    catch (e) { setErr(e.message); } finally { setBusyId(null); }
  };

  return (
    <ScreenBackdrop>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <Text style={styles.title}>Bağlı Cihazlar</Text>
        <Text style={styles.help}>
          Hesabına açık oturumlar aşağıda. Tanımadığın bir cihaz görürsen oturumunu
          kapat ve şifreni değiştir.
        </Text>

        {err && <Text style={styles.err}>{err}</Text>}
        {data === null && <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.lg }} />}
        {data?.note && <Text style={styles.note}>{data.note}</Text>}

        {(data?.sessions || []).map((s) => (
          <View key={s.id} style={styles.card}>
            <Text style={styles.deviceIcon}>{PLATFORM_ICON[s.platform] || '🖥️'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.deviceName}>
                {s.deviceName}{s.current ? '  ' : ''}
                {s.current && <Text style={styles.currentTag}>Bu cihaz</Text>}
              </Text>
              <Text style={styles.deviceMeta}>Son görülme: {timeAgo(s.lastSeenAt)} · Giriş: {new Date(s.createdAt).toLocaleDateString('tr-TR')}</Text>
            </View>
            {!s.current && (
              <TouchableOpacity style={styles.revokeBtn} onPress={() => revoke(s.id)} disabled={busyId === s.id}>
                {busyId === s.id
                  ? <ActivityIndicator size="small" color={colors.red} />
                  : <Text style={styles.revokeTxt}>Oturumu Kapat</Text>}
              </TouchableOpacity>
            )}
          </View>
        ))}

        {data && !data.note && (data.sessions || []).length === 0 && (
          <Text style={styles.note}>Etkin oturum görünmüyor.</Text>
        )}
      </ScrollView>
    </ScreenBackdrop>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 6 },
  help: { color: colors.textMuted, fontSize: 12.5, lineHeight: 18, marginBottom: spacing.md },
  note: { color: colors.textMuted, fontSize: 12.5, lineHeight: 18, textAlign: 'center', marginTop: spacing.md },
  err: { color: colors.red, fontSize: 13, fontWeight: '600', marginBottom: spacing.sm },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  deviceIcon: { fontSize: 26 },
  deviceName: { color: colors.text, fontSize: 14.5, fontWeight: '800' },
  currentTag: { color: colors.green, fontSize: 11.5, fontWeight: '800' },
  deviceMeta: { color: colors.textMuted, fontSize: 11.5, marginTop: 3 },
  revokeBtn: { borderWidth: 1, borderColor: colors.red, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 7 },
  revokeTxt: { color: colors.red, fontSize: 12, fontWeight: '800' },
});
