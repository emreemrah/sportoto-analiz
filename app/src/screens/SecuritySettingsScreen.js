// GÜVENLİK AYARLARI — şifre değiştir · e-posta değiştir · diğer oturumları
// kapat · son güvenlik olayları.
//
//   • Şifre ve e-posta değişikliği MEVCUT ŞİFRE ile yeniden doğrulama ister
//     (sunucu da ayrıca zorunlu kılar — arayüz atlatılamaz).
//   • Şifre değişince diğer cihazlardaki oturumlar sunucuda kapatılır.
//   • Olay listesinde şifre/token benzeri hassas veri YOKTUR (sunucu süzer).
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Switch, TextInput } from 'react-native';
import { colors, spacing, radius } from '../theme';
import ScreenBackdrop from '../components/ScreenBackdrop';
import { api } from '../api';
import { useAuth, refreshUser } from '../auth';
import { PasswordField } from './AuthScreens';
import {
  biometricsSupported, isBioLockEnabled, setBioLockEnabled, authenticate,
} from '../security/biometricLock';

function Card({ title, children }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Feedback({ ok, err }) {
  if (ok) return <Text style={styles.ok}>{ok}</Text>;
  if (err) return <Text style={styles.err}>{err}</Text>;
  return null;
}

// Biyometrik kilit — yalnız destekleyen cihazlarda görünür (web'de hiç).
// Aç/kapat için önce cihazın biyometrik doğrulaması istenir; böylece kilidi
// yalnız cihaz sahibi değiştirebilir. Biyometrik veri uygulamaya girmez.
function BiometricCard() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await biometricsSupported();
      if (!alive) return;
      setSupported(s);
      if (s) setEnabled(await isBioLockEnabled());
    })();
    return () => { alive = false; };
  }, []);

  if (!supported) return null;

  const toggle = async (next) => {
    setBusy(true); setMsg(null);
    const outcome = await authenticate(); // değişiklik için kimlik doğrulaması şart
    if (outcome !== 'unlocked') {
      setMsg('Doğrulama başarısız — ayar değiştirilmedi.');
      setBusy(false);
      return;
    }
    await setBioLockEnabled(next);
    setEnabled(next);
    setMsg(next
      ? 'Biyometrik kilit açıldı. Uygulama her açılışta kimlik doğrulaması isteyecek.'
      : 'Biyometrik kilit kapatıldı.');
    setBusy(false);
  };

  return (
    <Card title="🫆 Biyometrik Kilit">
      <Text style={styles.hint}>
        Açıkken uygulama her açılışta parmak izi / yüz tanıma ister. Biyometrik
        verilerin cihazından asla çıkmaz ve uygulama tarafından kaydedilmez;
        doğrulama başarısız olursa şifreyle giriş her zaman mümkündür.
      </Text>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>{enabled ? 'Açık' : 'Kapalı'}</Text>
        <Switch value={enabled} onValueChange={toggle} disabled={busy} trackColor={{ true: colors.primary }} />
      </View>
      {msg && <Text style={styles.ok}>{msg}</Text>}
    </Card>
  );
}

const EVENT_LABELS = {
  login_success: '✅ Giriş yapıldı',
  login_failed: '⚠️ Başarısız giriş denemesi',
  login_unverified: '⚠️ Doğrulanmamış e-posta ile giriş denemesi',
  logout: '👋 Çıkış yapıldı',
  logout_all: '🚪 Diğer oturumlar kapatıldı',
  session_revoked: '📵 Bir cihazın oturumu kapatıldı',
  password_changed: '🔑 Şifre değiştirildi',
  email_change_requested: '📧 E-posta değişikliği istendi',
  reauth_failed: '⚠️ Hatalı şifreyle doğrulama denemesi',
  refresh_denied: '⛔ Kapatılmış oturumla erişim denemesi',
  register: '🆕 Hesap oluşturuldu',
  account_delete_started: '🗑️ Hesap silme başlatıldı',
};

export default function SecuritySettingsScreen() {
  const { user } = useAuth();

  // Şifre değiştirme
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwOk, setPwOk] = useState(null);
  const [pwErr, setPwErr] = useState(null);
  const changePw = async () => {
    setPwOk(null); setPwErr(null); setPwBusy(true);
    try {
      const r = await api.changePassword({ currentPassword: curPw, newPassword: newPw });
      setPwOk(r.message || 'Şifren değiştirildi.');
      setCurPw(''); setNewPw('');
    } catch (e) { setPwErr(e.message); } finally { setPwBusy(false); }
  };

  // E-posta değiştirme
  const [newEmail, setNewEmail] = useState('');
  const [emailPw, setEmailPw] = useState('');
  const [emBusy, setEmBusy] = useState(false);
  const [emOk, setEmOk] = useState(null);
  const [emErr, setEmErr] = useState(null);
  const changeEmail = async () => {
    setEmOk(null); setEmErr(null); setEmBusy(true);
    try {
      const r = await api.changeEmail({ newEmail: newEmail.trim(), currentPassword: emailPw });
      setEmOk(r.message);
      setNewEmail(''); setEmailPw('');
      refreshUser();
    } catch (e) { setEmErr(e.message); } finally { setEmBusy(false); }
  };

  // Diğer oturumları kapatma
  const [allBusy, setAllBusy] = useState(false);
  const [allMsg, setAllMsg] = useState(null);
  const closeOthers = async () => {
    setAllBusy(true); setAllMsg(null);
    try {
      const r = await api.logoutAll();
      setAllMsg(`${r.closed} oturum kapatıldı. Bu cihaz açık kaldı.`);
    } catch (e) { setAllMsg(e.message); } finally { setAllBusy(false); }
  };

  // Güvenlik olayları
  const [events, setEvents] = useState(null);
  useEffect(() => {
    let alive = true;
    api.securityEvents().then((r) => { if (alive) setEvents(r.events || []); }).catch(() => { if (alive) setEvents([]); });
    return () => { alive = false; };
  }, []);

  return (
    <ScreenBackdrop>
      <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={styles.title}>Güvenlik Ayarları</Text>

        <BiometricCard />

        <Card title="🔑 Şifre Değiştir">
          <Text style={styles.hint}>Onaylandığında diğer cihazlardaki oturumların güvenlik için kapatılır.</Text>
          <PasswordField label="Mevcut şifre" value={curPw} onChangeText={setCurPw} placeholder="••••••••" />
          <PasswordField label="Yeni şifre" value={newPw} onChangeText={setNewPw} showStrength />
          <Feedback ok={pwOk} err={pwErr} />
          <TouchableOpacity style={[styles.btn, pwBusy && styles.btnBusy]} onPress={changePw} disabled={pwBusy}>
            {pwBusy ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.btnTxt}>Şifreyi Değiştir</Text>}
          </TouchableOpacity>
        </Card>

        <Card title="📧 E-posta Değiştir">
          <Text style={styles.hint}>Mevcut adres: {user?.email || '—'}. Değişiklik, yeni adrese gelen doğrulama bağlantısıyla tamamlanır.</Text>
          <Text style={styles.label}>Yeni e-posta</Text>
          <TextInput style={styles.input} value={newEmail} onChangeText={setNewEmail} autoCapitalize="none" keyboardType="email-address" placeholder="yeni@ornek.com" placeholderTextColor={colors.textMuted} />
          <PasswordField label="Mevcut şifre" value={emailPw} onChangeText={setEmailPw} placeholder="••••••••" />
          <Feedback ok={emOk} err={emErr} />
          <TouchableOpacity style={[styles.btn, emBusy && styles.btnBusy]} onPress={changeEmail} disabled={emBusy}>
            {emBusy ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.btnTxt}>Doğrulama Bağlantısı Gönder</Text>}
          </TouchableOpacity>
        </Card>

        <Card title="🚪 Diğer Oturumları Kapat">
          <Text style={styles.hint}>Şüpheli bir durum fark edersen bu cihaz dışındaki tüm oturumları tek dokunuşla kapatabilirsin.</Text>
          {allMsg && <Text style={styles.ok}>{allMsg}</Text>}
          <TouchableOpacity style={[styles.btn, styles.btnWarn, allBusy && styles.btnBusy]} onPress={closeOthers} disabled={allBusy}>
            {allBusy ? <ActivityIndicator color={colors.red} /> : <Text style={styles.btnWarnTxt}>Diğer Tüm Oturumları Kapat</Text>}
          </TouchableOpacity>
        </Card>

        <Card title="🕓 Son Güvenlik Olayları">
          {events === null && <ActivityIndicator color={colors.primary} />}
          {events?.length === 0 && <Text style={styles.hint}>Henüz kayıtlı olay yok.</Text>}
          {(events || []).map((e, i) => (
            <View key={i} style={styles.eventRow}>
              <Text style={styles.eventLabel}>{EVENT_LABELS[e.event] || e.event}</Text>
              <Text style={styles.eventMeta}>
                {new Date(e.created_at).toLocaleString('tr-TR')}{e.ip ? ` · ${e.ip}` : ''}
              </Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </ScreenBackdrop>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: spacing.lg },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  cardTitle: { color: colors.text, fontSize: 15.5, fontWeight: '800', marginBottom: 8 },
  hint: { color: colors.textMuted, fontSize: 12.5, lineHeight: 18, marginBottom: spacing.md },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: { backgroundColor: colors.cardAlt, color: colors.text, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  btn: { backgroundColor: colors.primary, paddingVertical: 13, borderRadius: radius.md, alignItems: 'center', marginTop: 4 },
  btnBusy: { opacity: 0.6 },
  btnTxt: { color: colors.bg, fontSize: 14.5, fontWeight: '800' },
  btnWarn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.red },
  btnWarnTxt: { color: colors.red, fontSize: 14.5, fontWeight: '800' },
  ok: { color: colors.green, fontSize: 13, marginBottom: 8, fontWeight: '600' },
  err: { color: colors.red, fontSize: 13, marginBottom: 8, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { color: colors.text, fontSize: 14, fontWeight: '800' },
  eventRow: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 8 },
  eventLabel: { color: colors.text, fontSize: 13, fontWeight: '700' },
  eventMeta: { color: colors.textMuted, fontSize: 11.5, marginTop: 2 },
});
