import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { colors, spacing, radius } from '../theme';
import { login, register, forgotPassword } from '../auth';

function Field({ label, ...props }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={colors.textMuted} autoCapitalize="none" {...props} />
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

export function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const submit = async () => {
    setErr(null); setBusy(true);
    try { await login(email.trim(), password); navigation.navigate('Profile'); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.pad}>
      <Text style={styles.title}>Giriş Yap</Text>
      <Field label="E-posta" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="ornek@mail.com" />
      <Field label="Şifre" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••" />
      {err && <Text style={styles.err}>{err}</Text>}
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
  const submit = async () => {
    setErr(null); setBusy(true);
    try { await register(email.trim(), username.trim(), password); navigation.navigate('Profile'); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.pad}>
      <Text style={styles.title}>Kayıt Ol</Text>
      <Field label="E-posta" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="ornek@mail.com" />
      <Field label="Kullanıcı adı" value={username} onChangeText={setUsername} placeholder="3-24 karakter" maxLength={24} />
      <Field label="Şifre" value={password} onChangeText={setPassword} secureTextEntry placeholder="en az 6 karakter" />
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
  btn: { backgroundColor: colors.primary, paddingVertical: 14, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.sm },
  btnTxt: { color: colors.bg, fontSize: 16, fontWeight: '800' },
  link: { color: colors.primary, fontSize: 13.5, fontWeight: '700', textAlign: 'center', marginTop: spacing.md },
  err: { color: colors.red, fontSize: 13, marginBottom: spacing.sm, fontWeight: '600' },
  ok: { color: colors.green, fontSize: 13, marginBottom: spacing.sm, fontWeight: '600' },
});
