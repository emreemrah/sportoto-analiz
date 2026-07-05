import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { colors, spacing, radius } from '../theme';
import { useCoupon } from '../hooks/useCoupon';
import { MOCK_USER_ID } from '../data/mockCoupons';
import CouponMatchRow from '../components/CouponMatchRow';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import DemoDataBanner from '../components/DemoDataBanner';

// C) Kupon Oluştur Ekranı — 15 maç, 1/X/2 seçim, sistem önerisi/güven/sürpriz
// yanında görünür, kaydet. Kaydetmeden önce tüm maçlar seçilmiş olmalı.
export default function CouponCreateScreen({ route, navigation }) {
  const { bulletinId } = route.params || {};
  const { bulletin, snapshot, coupon, editable, loading, error, saving, actionError, save, reload } = useCoupon(bulletinId, MOCK_USER_ID);
  const [picks, setPicks] = useState({});

  useEffect(() => {
    if (coupon) {
      const init = {};
      coupon.selections.forEach((s) => { init[s.matchId] = s.userPick; });
      setPicks(init);
    }
  }, [coupon?.id]);

  if (loading && !bulletin) return <LoadingState message="Kupon bilgisi yükleniyor…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!bulletin) return null;

  if (!editable) {
    return (
      <ErrorState
        icon="🔒"
        title="Kupon artık düzenlenemez"
        message="Bu bültenin ilk maçı başladığı için kupon oluşturma/düzenleme kapandı."
      />
    );
  }

  const total = bulletin.matches.length;
  const filled = Object.keys(picks).filter((k) => picks[k]).length;
  const remaining = total - filled;

  const onSave = async () => {
    if (remaining > 0) {
      Alert.alert('Eksik seçim', `Kaydetmeden önce ${remaining} maç için seçim yapmalısın.`);
      return;
    }
    try {
      await save(bulletin.matches.map((m) => ({ matchId: m.id, userPick: picks[m.id] })));
      Alert.alert('Kaydedildi', 'Kuponun kaydedildi.', [{ text: 'Tamam', onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert('Hata', e.message);
    }
  };

  return (
    <View style={styles.container}>
      <DemoDataBanner note="Bu kupon ekranı ÖRNEK bülten üzerinde çalışır — gerçek Spor Toto bülteni/kuponu değildir." />
      <View style={styles.header}>
        <Text style={styles.title}>Kupon Oluştur · {bulletin.bulletinNo}</Text>
        <Text style={styles.muted}>
          {filled}/{total} maç seçildi{coupon ? ` · kaydedince v${coupon.version + 1} olacak` : ''}
        </Text>
      </View>

      <FlatList
        data={bulletin.matches}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <CouponMatchRow
            match={item}
            analysis={snapshot?.matchesAnalysis.find((a) => a.matchId === item.id)}
            value={picks[item.id]}
            onChange={(v) => setPicks((p) => ({ ...p, [item.id]: v }))}
          />
        )}
        contentContainerStyle={styles.listPad}
      />

      {!!actionError && <Text style={styles.errTxt}>{actionError}</Text>}

      <TouchableOpacity
        style={[styles.saveBtn, remaining > 0 && styles.saveBtnOff]}
        onPress={onSave}
        disabled={saving}
        activeOpacity={0.85}
      >
        <Text style={[styles.saveBtnTxt, remaining > 0 && styles.saveBtnTxtOff]}>
          {saving ? 'Kaydediliyor…' : remaining > 0 ? `${remaining} maç eksik` : 'Kuponu Kaydet'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.lg, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  muted: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
  listPad: { padding: spacing.md, paddingBottom: 90 },
  errTxt: { color: colors.red, fontSize: 12.5, textAlign: 'center', marginBottom: 8, paddingHorizontal: spacing.lg },
  saveBtn: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.lg, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  saveBtnOff: { backgroundColor: colors.cardAlt },
  saveBtnTxt: { color: colors.bg, fontSize: 15, fontWeight: '800' },
  saveBtnTxtOff: { color: colors.textMuted },
});
