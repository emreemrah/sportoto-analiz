// BİYOMETRİK KİLİT EKRANI — uygulama açılışında, kullanıcı bu özelliği
// AÇMIŞSA gösterilir. Cihazın kendi doğrulaması (parmak izi / yüz / cihaz PIN'i)
// başarılı olana dek uygulama içeriği görünmez.
//
//   • Başarısızlıkta güvenli alternatif HER ZAMAN sunulur: "Şifreyle giriş" —
//     oturum kapatılır ve kullanıcı şifresiyle yeniden giriş yapar.
//   • Biyometrik veri uygulamaya girmez; yalnız başarılı/başarısız sonucu gelir.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, spacing, radius } from '../theme';
import { BRAND_LINE_1, BRAND_LINE_2 } from '../brand';
import { authenticate } from '../security/biometricLock';
import { afterFailure } from '../security/bioLockPolicy';
import { logout } from '../auth';

export default function BiometricLockScreen({ onUnlock }) {
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const policy = afterFailure(attempts);

  const tryUnlock = useCallback(async () => {
    setBusy(true);
    const outcome = await authenticate();
    setBusy(false);
    if (outcome === 'unlocked') onUnlock();
    else setAttempts((a) => a + 1);
  }, [onUnlock]);

  // Açılışta doğrulama kendiliğinden başlar.
  useEffect(() => { tryUnlock(); }, [tryUnlock]);

  const passwordFallback = async () => {
    setBusy(true);
    await logout();          // oturum sunucuda da kapanır; şifre gerekir
    setBusy(false);
    onUnlock();              // kilit kalkar → girişsiz durum → Giriş ekranı
  };

  return (
    <View style={styles.container}>
      <Text style={styles.lockIcon}>🔒</Text>
      <Text style={styles.brand}>
        {BRAND_LINE_1} <Text style={{ color: colors.accent }}>{BRAND_LINE_2}</Text>
      </Text>
      <Text style={styles.help}>
        Devam etmek için kimliğini doğrula. Parmak izi ya da yüz tanıma verilerin
        cihazından asla çıkmaz.
      </Text>

      {attempts > 0 && (
        <Text style={styles.err}>Doğrulama başarısız oldu. Tekrar deneyebilir ya da şifrenle giriş yapabilirsin.</Text>
      )}

      <TouchableOpacity style={[styles.btn, busy && { opacity: 0.6 }]} onPress={tryUnlock} disabled={busy}>
        {busy ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.btnTxt}>🫆  Kilidi Aç</Text>}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btnAlt, policy.emphasizePasswordFallback && styles.btnAltEmph]}
        onPress={passwordFallback}
        disabled={busy}
      >
        <Text style={[styles.btnAltTxt, policy.emphasizePasswordFallback && { color: colors.accent }]}>
          Şifreyle giriş yap
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  lockIcon: { fontSize: 52, marginBottom: 14 },
  brand: { color: '#fff', fontSize: 20, fontWeight: '900', marginBottom: 10 },
  help: { color: '#c9d4ea', fontSize: 13.5, lineHeight: 20, textAlign: 'center', marginBottom: spacing.lg, maxWidth: 320 },
  err: { color: '#ffb4a8', fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: spacing.md, maxWidth: 320 },
  btn: { backgroundColor: colors.accent, paddingVertical: 14, paddingHorizontal: 38, borderRadius: radius.md, marginBottom: spacing.md },
  btnTxt: { color: colors.bg, fontSize: 15.5, fontWeight: '800' },
  btnAlt: { paddingVertical: 10, paddingHorizontal: 20 },
  btnAltEmph: { borderWidth: 1, borderColor: colors.accent, borderRadius: radius.md },
  btnAltTxt: { color: '#c9d4ea', fontSize: 13.5, fontWeight: '700' },
});
