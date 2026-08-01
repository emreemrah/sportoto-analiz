// ENGELLENEN KULLANICILAR — kullanıcının kendi engel listesi (E9).
//
//   • Liste sunucudan gelir ve YALNIZ kendi engellerin görünür.
//   • "Beni kim engelledi" diye bir ekran YOKTUR ve olmayacaktır: engel karşı
//     tarafa ilan edilmez. Bunu göstermek, engelin kendisini bir tacize
//     dönüştürürdü.
//   • Engel geri alınabilir. Google Play, engelleme sunan uygulamalarda geri
//     almanın da uygulama içinden erişilebilir olmasını bekler.
//   • Hesabı silinmiş kişi listeden DÜŞMEZ, "Silinmiş kullanıcı" diye
//     etiketlenir. Satırı gizlemek, kullanıcıya engelinin kendiliğinden
//     kalktığı izlenimini verirdi.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { colors, spacing, radius } from '../theme';
import ScreenBackdrop from '../components/ScreenBackdrop';
import { CommentAvatar } from '../components';
import { api } from '../api';

function tarih(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('tr-TR'); } catch { return '—'; }
}

export default function BlockedUsersScreen() {
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setErr(null);
    try { setData(await api.blocks()); }
    catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const kaldir = async (userId) => {
    setBusyId(userId); setErr(null);
    try { await api.unblockUser(userId); await load(); }
    catch (e) { setErr(e.message); } finally { setBusyId(null); }
  };

  const list = data?.blocks || [];

  return (
    <ScreenBackdrop>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <Text style={styles.title}>Engellenen Kullanıcılar</Text>
        <Text style={styles.help}>
          Engellediğin kişilerin yorumlarını görmezsin, onlar da seninkileri göremez.
          Engellediğin kişiye bildirim gitmez. İstediğin zaman engeli kaldırabilirsin.
        </Text>

        {err && <Text style={styles.err}>{err}</Text>}
        {data === null && !err && <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.lg }} />}

        {list.map((b) => (
          <View key={b.userId} style={styles.card}>
            <CommentAvatar
              size={38}
              author={{ username: b.username, avatarType: b.avatarType, avatarKey: b.avatarKey, avatarUrl: b.avatarUrl }}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{b.username}</Text>
              <Text style={styles.meta}>Engellendi: {tarih(b.createdAt)}</Text>
            </View>
            <TouchableOpacity
              style={styles.unblockBtn}
              onPress={() => kaldir(b.userId)}
              disabled={busyId === b.userId}
            >
              {busyId === b.userId
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Text style={styles.unblockTxt}>Engeli Kaldır</Text>}
            </TouchableOpacity>
          </View>
        ))}

        {data && list.length === 0 && (
          <Text style={styles.note}>
            Engellediğin kimse yok. Bir kullanıcıyı, yorumunun altındaki “Engelle”
            düğmesinden engelleyebilirsin.
          </Text>
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
  name: { color: colors.text, fontSize: 14.5, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: 11.5, marginTop: 3 },
  unblockBtn: { borderWidth: 1, borderColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 7 },
  unblockTxt: { color: colors.primary, fontSize: 12, fontWeight: '800' },
});
