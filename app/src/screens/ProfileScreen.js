import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { colors, spacing, radius } from '../theme';
import { ProfileAvatar } from '../components';
import { api } from '../api';
import { useAuth, logout, refreshUser } from '../auth';

const MAX_BYTES = 2 * 1024 * 1024;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Kendi resmini yükle (web): tür+boyut doğrula, 256px JPEG'e küçült, sunucuya gönder.
function ImageUploadButton({ onDone }) {
  const [busy, setBusy] = useState(false);
  const pick = () => {
    if (typeof document === 'undefined') { Alert.alert('Bilgi', 'Resim yükleme şimdilik web sürümünde.'); return; }
    const input = document.createElement('input');
    input.type = 'file'; input.accept = OK_TYPES.join(',');
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return;
      if (!OK_TYPES.includes(file.type)) { alert('Sadece JPG, PNG veya WEBP.'); return; }
      if (file.size > MAX_BYTES) { alert('Resim en fazla 2 MB olmalı.'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const img = new window.Image();
        img.onload = async () => {
          const S = 256;
          const canvas = document.createElement('canvas');
          canvas.width = S; canvas.height = S;
          const ctx = canvas.getContext('2d');
          const scale = Math.max(S / img.width, S / img.height);
          const w = img.width * scale, h = img.height * scale;
          ctx.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setBusy(true);
          try { await api.uploadAvatar(dataUrl); await refreshUser(); }
          catch (e) { alert(e.message); } finally { setBusy(false); onDone && onDone(); }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };
  return (
    <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={pick} disabled={busy}>
      <Text style={styles.btnPrimaryTxt}>{busy ? 'Yükleniyor…' : '📷  Resim Yükle'}</Text>
    </TouchableOpacity>
  );
}

function LoggedOut({ navigation }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.padCenter}>
      <Text style={styles.bigEmoji}>⚽</Text>
      <Text style={styles.title}>Profil</Text>
      <Text style={styles.help}>Maçlara yorum yapmak, beğenmek ve avatarını seçmek için giriş yap.</Text>
      <TouchableOpacity style={[styles.btn, styles.btnPrimary, { width: '100%' }]} onPress={() => navigation.navigate('Login')}>
        <Text style={styles.btnPrimaryTxt}>Giriş Yap</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.btn, styles.btnAlt, { width: '100%' }]} onPress={() => navigation.navigate('Register')}>
        <Text style={styles.btnAltTxt}>Kayıt Ol</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

export default function ProfileScreen({ navigation }) {
  const { user, token, ready } = useAuth();
  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);

  if (!ready) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  if (!token || !user) return <LoggedOut navigation={navigation} />;

  const displayName = name || user.username;
  const nameChanged = name && name.trim() !== user.username;

  const saveName = async () => {
    setSavingName(true);
    try { await api.updateProfile({ username: name.trim() }); await refreshUser(); setName(''); }
    catch (e) { alert(e.message); } finally { setSavingName(false); }
  };
  const removeAvatar = async () => {
    try { await api.updateProfile({ avatarType: 'default' }); await refreshUser(); } catch (e) { alert(e.message); }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={styles.title}>Profil</Text>

      <View style={styles.avatarWrap}>
        <ProfileAvatar size={112} />
        <View style={styles.nameRow}>
          <TextInput style={styles.nameInput} value={displayName} onChangeText={setName} maxLength={24} />
          {nameChanged && (
            <TouchableOpacity style={styles.nameSave} onPress={saveName} disabled={savingName}>
              <Text style={styles.nameSaveTxt}>{savingName ? '…' : 'Kaydet'}</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.email}>{user.email}</Text>
        <View style={styles.stats}>
          <Text style={styles.stat}>💬 {user.total_comments ?? 0} yorum</Text>
          <Text style={styles.stat}>♥ {user.total_likes_received ?? 0} beğeni</Text>
        </View>
      </View>

      <ImageUploadButton />
      <TouchableOpacity style={[styles.btn, styles.btnAlt]} onPress={() => navigation.navigate('AvatarPicker')}>
        <Text style={styles.btnAltTxt}>⚽  Hazır Avatar Seç</Text>
      </TouchableOpacity>
      {user.avatar_type !== 'default' && (
        <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={removeAvatar}>
          <Text style={styles.btnGhostTxt}>Resmi Kaldır (varsayılana dön)</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={[styles.btn, styles.btnLogout]} onPress={logout}>
        <Text style={styles.btnLogoutTxt}>Çıkış Yap</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  padCenter: { padding: spacing.lg, alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  bigEmoji: { fontSize: 56, marginBottom: 8 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: spacing.lg, alignSelf: 'flex-start' },
  help: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 20 },
  avatarWrap: { alignItems: 'center', marginBottom: spacing.lg },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  nameInput: { color: colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, minWidth: 140, paddingVertical: 4 },
  nameSave: { backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.sm },
  nameSaveTxt: { color: colors.bg, fontWeight: '800', fontSize: 12 },
  email: { color: colors.textMuted, fontSize: 12.5, marginTop: 6 },
  stats: { flexDirection: 'row', gap: 16, marginTop: 10 },
  stat: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  btn: { paddingVertical: 13, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.sm },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryTxt: { color: colors.bg, fontSize: 15, fontWeight: '800' },
  btnAlt: { backgroundColor: colors.cardAlt },
  btnAltTxt: { color: colors.text, fontSize: 15, fontWeight: '800' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  btnGhostTxt: { color: colors.textMuted, fontSize: 13.5, fontWeight: '700' },
  btnLogout: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.red, marginTop: spacing.xl },
  btnLogoutTxt: { color: colors.red, fontSize: 14, fontWeight: '800' },
});
