// GİRİŞ / KAYIT / ŞİFREMİ UNUTTUM — üç ayrı ekran.
//   • Şifre göster/gizle · şifre gücü göstergesi · net yükleniyor/başarı/hata durumu
//   • E-posta doğrulaması açıkken kayıt sonrası bilgi + "yeniden gönder"
//   • ŞİFRE hiçbir yerde saklanmaz; yalnız girişte sunucuya HTTPS ile gider
import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { colors, spacing, radius } from '../theme';
import { login, register, forgotPassword, resendVerification } from '../auth';
import { passwordStrength, MIN_PASSWORD_LENGTH } from '../security/passwordStrength';

function Field({ label, ...props }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={colors.textMuted} autoCapitalize="none" {...props} />
    </View>
  );
}

// Şifre alanı: göster/gizle düğmesi + istenirse güç göstergesi.
export function PasswordField({ label, value, onChangeText, showStrength = false, placeholder }) {
  const [hidden, setHidden] = useState(true);
  const strength = useMemo(() => (showStrength ? passwordStrength(value) : null), [showStrength, value]);
  const strengthColor = strength
    ? { red: colors.red, orange: '#f0883e', yellow: '#d4a017', green: colors.green }[strength.color]
    : null;
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.pwRow}>
        <TextInput
          style={[styles.input, { flex: 1, marginBottom: 0 }]}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          secureTextEntry={hidden}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder || `en az ${MIN_PASSWORD_LENGTH} karakter`}
        />
        <TouchableOpacity
          style={styles.eyeBtn}
          onPress={() => setHidden(!hidden)}
          accessibilityLabel={hidden ? 'Şifreyi göster' : 'Şifreyi gizle'}
        >
          <Text style={styles.eyeTxt}>{hidden ? '👁' : '🙈'}</Text>
        </TouchableOpacity>
      </View>
      {strength && value ? (
        <View style={{ marginTop: 6 }}>
          <View style={styles.strengthTrack}>
            <View style={[styles.strengthFill, { width: `${(strength.score / 4) * 100}%`, backgroundColor: strengthColor }]} />
          </View>
          <Text style={[styles.strengthTxt, { color: strengthColor }]}>
            {strength.label}{strength.hints.length ? ` · ${strength.hints[0]}` : ''}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Submit({ busy, onPress, children }) {
  return (
    <TouchableOpacity style={[styles.btn, busy && { opacity: 0.6 }]} onPress={onPress} disabled={busy}>
      {busy ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.btnTxt}>{children}</Text>}
    </TouchableOpacity>
  );
}

// Doğrulama bekleyen e-posta için bilgi kutusu + yeniden gönderme.
function VerificationNotice({ email, message }) {
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState(null);
  const resend = async () => {
    setBusy(true); setInfo(null);
    try { const r = await resendVerification(email); setInfo(r.message || 'Bağlantı yeniden gönderildi.'); }
    catch (e) { setInfo(e.message); } finally { setBusy(false); }
  };
  return (
    <View style={styles.verifyBox}>
      <Text style={styles.verifyTitle}>📧 E-postanı doğrula</Text>
      <Text style={styles.verifyTxt}>{message}</Text>
      {info && <Text style={styles.ok}>{info}</Text>}
      <TouchableOpacity onPress={resend} disabled={busy}>
        <Text style={styles.link}>{busy ? 'Gönderiliyor…' : 'Doğrulama bağlantısını yeniden gönder'}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const submit = async () => {
    setErr(null); setNeedsVerification(false); setBusy(true);
    try { await login(email.trim(), password); navigation.navigate('Profile'); }
    catch (e) {
      setErr(e.message);
      if (e.needsVerification) setNeedsVerification(true);
    } finally { setBusy(false); }
  };
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.pad}>
      <Text style={styles.title}>Giriş Yap</Text>
      <Field label="E-posta" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="ornek@mail.com" />
      <PasswordField label="Şifre" value={password} onChangeText={setPassword} placeholder="••••••••" />
      {err && <Text style={styles.err}>{err}</Text>}
      {needsVerification && <VerificationNotice email={email.trim()} message="Giriş için önce e-postana gelen doğrulama bağlantısına tıklaman gerekiyor." />}
      <Submit busy={busy} onPress={submit}>Giriş Yap</Submit>
      <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}><Text style={styles.link}>Şifremi unuttum</Text></TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Register')}><Text style={styles.link}>Hesabın yok mu? Kayıt ol</Text></TouchableOpacity>
    </ScrollView>
  );
}

export function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [verifyMsg, setVerifyMsg] = useState(null);
  const submit = async () => {
    setErr(null); setBusy(true);
    try {
      const r = await register(email.trim(), username.trim(), password);
      if (r?.needsVerification) { setVerifyMsg(r.message); return; }
      navigation.navigate('Profile');
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  if (verifyMsg) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.pad}>
        <Text style={styles.title}>Kayıt Alındı ✅</Text>
        <VerificationNotice email={email.trim()} message={verifyMsg} />
        <TouchableOpacity onPress={() => navigation.navigate('Login')}><Text style={styles.link}>Doğruladım — girişe git</Text></TouchableOpacity>
      </ScrollView>
    );
  }
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.pad}>
      <Text style={styles.title}>Kayıt Ol</Text>
      <Field label="E-posta" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="ornek@mail.com" />
      <Field label="Kullanıcı adı" value={username} onChangeText={setUsername} placeholder="3-24 karakter" maxLength={24} />
      <PasswordField label="Şifre" value={password} onChangeText={setPassword} showStrength />
      {err && <Text style={styles.err}>{err}</Text>}
      <Submit busy={busy} onPress={submit}>Kayıt Ol</Submit>
      <TouchableOpacity onPress={() => navigation.navigate('Login')}><Text style={styles.link}>Zaten hesabın var mı? Giriş yap</Text></TouchableOpacity>
    </ScrollView>
  );
}

export function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const submit = async () => {
    setErr(null); setMsg(null); setBusy(true);
    try { const r = await forgotPassword(email.trim()); setMsg(r.message || 'Sıfırlama bağlantısı gönderildi.'); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.pad}>
      <Text style={styles.title}>Şifremi Unuttum</Text>
      <Text style={styles.help}>E-postanı gir; şifre sıfırlama bağlantısı gönderelim.</Text>
      <Field label="E-posta" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="ornek@mail.com" />
      {msg && <Text style={styles.ok}>{msg}</Text>}
      {err && <Text style={styles.err}>{err}</Text>}
      <Submit busy={busy} onPress={submit}>Bağlantı Gönder</Submit>
      <TouchableOpacity onPress={() => navigation.navigate('Login')}><Text style={styles.link}>Girişe dön</Text></TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: spacing.lg },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: spacing.lg },
  help: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.md },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: { backgroundColor: colors.card, color: colors.text, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: colors.border },
  pwRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn: { padding: 10, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  eyeTxt: { fontSize: 16 },
  strengthTrack: { height: 5, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  strengthFill: { height: 5, borderRadius: 3 },
  strengthTxt: { fontSize: 11.5, fontWeight: '700', marginTop: 4 },
  verifyBox: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  verifyTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginBottom: 6 },
  verifyTxt: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  btn: { backgroundColor: colors.primary, paddingVertical: 14, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.sm },
  btnTxt: { color: colors.bg, fontSize: 16, fontWeight: '800' },
  link: { color: colors.primary, fontSize: 13.5, fontWeight: '700', textAlign: 'center', marginTop: spacing.md },
  err: { color: colors.red, fontSize: 13, marginBottom: spacing.sm, fontWeight: '600' },
  ok: { color: colors.green, fontSize: 13, marginBottom: spacing.sm, fontWeight: '600' },
});
