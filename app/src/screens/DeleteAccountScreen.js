// HESABIMI SİL — uygulama içi kalıcı hesap silme (Google Play zorunluluğu).
//
// KESİN KURALLAR
// • Silme GERÇEKTİR; pasife alma değildir. Sunucu gerçekten siler.
// • Ne silinir / ne silinmez kullanıcıya AÇIKÇA yazılır.
// • Onay ifadesi yazılmadan buton çalışmaz.
// • Sunucu "tamamlanamadı" derse ekranda "silindi" YAZILMAZ; hata dürüstçe
//   gösterilir ve kullanıcı tekrar deneyebilir.
// • Yerel veriler yalnız silme BAŞARILI olduktan sonra temizlenir.
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { uyari } from '../components/Uyari';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius } from '../theme';
import ScreenBackdrop from '../components/ScreenBackdrop';
import { api } from '../api';
import { logout } from '../auth';
import { wipeLocalData } from '../localData';
import { cancelAllOurNotifications } from '../services/pushService';

export const CONFIRM_PHRASE = 'HESABIMI SIL';

// Büyük/küçük harf ve Türkçe "İ/I" farkı kullanıcıyı engellemesin.
export function isConfirmed(text) {
  return String(text || '')
    .replace(/İ/g, 'I')
    .replace(/ı/g, 'i')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim() === CONFIRM_PHRASE;
}

const SILINENLER = [
  'Hesabın (e-posta ve giriş bilgilerin)',
  'Profilin, kullanıcı adın ve profil fotoğrafın',
  'Yorumların ve beğenilerin',
  'Skor tahminlerin, kadro tahminlerin, oyuncu ve anket oyların',
  'Kaydettiğin kuponların',
  'Analiz profillerin ve kendi analiz kayıtların',
];

const SILINMEYENLER = [
  'Haftalık bülten arşivi',
  'Mühürlü analiz kayıtları ve resmî maç sonuçları',
  'Radar ve Sistem Karnesi verileri',
];

export default function DeleteAccountScreen({ navigation }) {
  const [text, setText] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [hata, setHata] = useState(null);
  const onaylandi = isConfirmed(text) && password.length > 0;

  const sil = async () => {
    if (!onaylandi || busy) return;
    setBusy(true);
    setHata(null);
    try {
      // Yeniden kimlik doğrulama: sunucu, onay ifadesine ek olarak MEVCUT
      // ŞİFREYİ de doğrular — ele geçirilmiş bir oturum tek başına silemez.
      const r = await api.deleteAccount(CONFIRM_PHRASE, password);
      if (!r?.ok) throw new Error('Silme tamamlanamadı. Hesabın silinmedi, lütfen tekrar dene.');

      // Sunucu silmeyi ONAYLADIKTAN sonra cihazdaki izler temizlenir.
      // Zamanlanmış maç hatırlatmaları da iptal edilir; aksi hâlde hesap
      // silindikten SONRA da telefon çalmaya devam ederdi.
      try { await cancelAllOurNotifications(); } catch { /* silmeyi engellemesin */ }
      await wipeLocalData({
        localStore: typeof localStorage !== 'undefined' ? localStorage : null,
        asyncStore: AsyncStorage,
      });
      logout();
      uyari.alert('Hesap silindi', 'Hesabın ve sana ait tüm veriler kalıcı olarak silindi.');
    } catch (e) {
      setHata(e.message || 'Silme tamamlanamadı. Hesabın silinmedi, lütfen tekrar dene.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenBackdrop>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl * 2 }}
      >
        <Text style={styles.title}>Hesabımı Sil</Text>
        <Text style={styles.lead}>
          Bu işlem geri alınamaz. Hesabın pasife alınmaz, kalıcı olarak silinir.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Silinecekler</Text>
          {SILINENLER.map((s) => (
            <Text key={s} style={styles.item}>•  {s}</Text>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Silinmeyecekler</Text>
          <Text style={styles.note}>
            Sana ait olmayan ve kimliğinle ilişkilendirilmeyen kayıtlar korunur:
          </Text>
          {SILINMEYENLER.map((s) => (
            <Text key={s} style={styles.item}>•  {s}</Text>
          ))}
        </View>

        <View style={[styles.card, styles.warnCard]}>
          <Text style={styles.warnTitle}>Onay</Text>
          <Text style={styles.note}>
            Devam etmek için aşağıya <Text style={styles.mono}>{CONFIRM_PHRASE}</Text> yaz.
          </Text>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={CONFIRM_PHRASE}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!busy}
          />
          <Text style={[styles.note, { marginTop: spacing.sm }]}>
            Güvenlik için mevcut şifreni de gir:
          </Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Mevcut şifren"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            editable={!busy}
          />
        </View>

        {hata ? <Text style={styles.error}>{hata}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, styles.btnDanger, (!onaylandi || busy) && styles.btnDisabled]}
          onPress={sil}
          disabled={!onaylandi || busy}
        >
          <Text style={styles.btnDangerTxt}>
            {busy ? 'Siliniyor…' : 'Hesabımı kalıcı olarak sil'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnGhost]}
          onPress={() => navigation.goBack()}
          disabled={busy}
        >
          <Text style={styles.btnGhostTxt}>Vazgeç</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenBackdrop>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  title: { color: colors.text, fontSize: 22, fontWeight: '900', marginBottom: 8 },
  lead: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md,
  },
  warnCard: { borderColor: colors.red },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginBottom: 8 },
  warnTitle: { color: colors.red, fontSize: 15, fontWeight: '800', marginBottom: 8 },
  item: { color: colors.textMuted, fontSize: 13.5, lineHeight: 21 },
  note: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 8 },
  mono: { color: colors.text, fontWeight: '900' },
  input: {
    color: colors.text, fontSize: 15, fontWeight: '800', letterSpacing: 1,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 10, marginTop: 4,
  },
  error: {
    color: colors.red, fontSize: 13, lineHeight: 19, marginBottom: spacing.sm,
  },
  btn: { paddingVertical: 14, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.sm },
  btnDanger: { backgroundColor: colors.red },
  btnDangerTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  btnDisabled: { opacity: 0.45 },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  btnGhostTxt: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
});
