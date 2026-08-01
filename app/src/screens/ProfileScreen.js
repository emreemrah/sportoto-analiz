import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { uyari } from '../components/Uyari';
import { colors, spacing, radius } from '../theme';
import { ProfileAvatar } from '../components';
import ScreenBackdrop from '../components/ScreenBackdrop';
import { api } from '../api';
import { useAuth, logout, refreshUser } from '../auth';
import { COPYRIGHT, INDEPENDENCE_NOTICE } from '../brand';

const MAX_BYTES = 2 * 1024 * 1024;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Kendi resmini yükle (web): tür+boyut doğrula, 256px JPEG'e küçült, sunucuya gönder.
function ImageUploadButton({ onDone }) {
  const [busy, setBusy] = useState(false);
  const pick = () => {
    if (typeof document === 'undefined') { uyari.alert('Bilgi', 'Resim yükleme şimdilik web sürümünde.'); return; }
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

      {/* Gizlilik metni giriş yapmadan da erişilebilir olmalıdır. */}
      <TouchableOpacity style={[styles.btn, styles.btnDelete]} onPress={() => navigation.navigate('About')}>
        <Text style={styles.btnDeleteTxt}>Hakkında ve Gizlilik</Text>
      </TouchableOpacity>
      <Text style={styles.legalNote}>{INDEPENDENCE_NOTICE}</Text>
      <Text style={styles.copyright}>{COPYRIGHT}</Text>
    </ScrollView>
  );
}

// İlerleme bölümü: puan, seviye, başarılar, görevler — TÜMÜ sunucudan gelir;
// istemci hiçbir puanı kendisi hesaplamaz/yazamaz.
function ProgressSection() {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    api.progress()
      .then((p) => { if (alive) setProgress(p); })
      .catch(() => { /* ilerleme yüklenemezse bölüm sessizce gizlenir */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading) return <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />;
  if (!progress) return null;
  if (progress.available === false) {
    return <Text style={styles.progressNote}>{progress.note}</Text>;
  }
  const lvl = progress.level || {};
  const earned = (progress.achievements || []).filter((a) => a.earned);
  const tasks = progress.tasks || [];
  const doneTasks = tasks.filter((t) => t.completedAt).length;
  return (
    <View style={styles.progressWrap}>
      {/* Seviye + puan kartı */}
      <View style={styles.levelCard}>
        <View style={styles.levelBadge}><Text style={styles.levelBadgeTxt}>{lvl.level ?? 1}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.levelTitle}>Seviye {lvl.level ?? 1} · {progress.points ?? 0} puan</Text>
          <View style={styles.levelTrack}>
            <View style={[styles.levelFill, { width: `${lvl.progressPct ?? 0}%` }]} />
          </View>
          <Text style={styles.levelSub}>
            {lvl.nextAt != null ? `Sonraki seviye: ${lvl.nextAt} puan (%${lvl.progressPct ?? 0})` : 'En üst seviye'}
          </Text>
        </View>
      </View>

      {/* Başarılar */}
      <Text style={styles.sectionTitle}>🏅 Başarılar ({earned.length}/{(progress.achievements || []).length})</Text>
      <View style={styles.badgeRowLeft}>
        {(progress.achievements || []).map((a) => (
          <View key={a.key} style={[styles.achBadge, !a.earned && styles.achBadgeLocked]}>
            <Text style={[styles.achBadgeTxt, !a.earned && styles.achBadgeTxtLocked]}>{a.icon} {a.title}</Text>
          </View>
        ))}
      </View>

      {/* Görevler + genel ilerleme */}
      <Text style={styles.sectionTitle}>📋 Görevler ({doneTasks}/{tasks.length})</Text>
      {tasks.map((t) => (
        <View key={t.key} style={styles.taskRow}>
          <Text style={styles.taskIcon}>{t.completedAt ? '✅' : t.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.taskTitle, t.completedAt && styles.taskDone]}>{t.title} <Text style={styles.taskPts}>+{t.points}p</Text></Text>
            <View style={styles.taskTrack}>
              <View style={[styles.taskFill, { width: `${Math.min(100, Math.round((t.progress / t.target) * 100))}%` }]} />
            </View>
          </View>
          <Text style={styles.taskCount}>{Math.min(t.progress, t.target)}/{t.target}</Text>
        </View>
      ))}
    </View>
  );
}

export default function ProfileScreen({ navigation }) {
  const { user, token, ready } = useAuth();
  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [fav, setFav] = useState(null);
  const [savingFav, setSavingFav] = useState(false);
  const [operator, setOperator] = useState(false);

  // İNCELEME GİRİŞİ — kararı SUNUCU verir, uygulama değil.
  //
  // Uygulamanın içinde hiçbir operatör e-postası veya listesi YOKTUR; Android
  // paketi açılıp okunabildiği için oraya yazılan her şey herkese açıktır.
  // Bunun yerine her açılışta /api/moderation/access sorulur.
  //
  // Uç, yetkisiz hesaba 403 değil {operator:false} döner: bu yüzden normal
  // kullanıcıda ne bir hata görünür ne de bu satır çizilir. Giriş görünmüyorsa
  // kullanıcı reddedilecek bir ekrana hiç gitmez.
  useEffect(() => {
    let iptal = false;
    if (!token) { setOperator(false); return undefined; }
    api.moderationAccess()
      .then((r) => { if (!iptal) setOperator(r?.operator === true); })
      .catch(() => { if (!iptal) setOperator(false); }); // yetki bilinmiyorsa GÖSTERME
    return () => { iptal = true; };
  }, [token]);

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
  const displayFav = fav != null ? fav : (user.favorite_team || '');
  const favChanged = fav != null && fav.trim() !== (user.favorite_team || '');
  const saveFav = async () => {
    setSavingFav(true);
    try { await api.updateProfile({ favoriteTeam: displayFav.trim() }); await refreshUser(); setFav(null); }
    catch (e) { alert(e.message); } finally { setSavingFav(false); }
  };

  return (
    <ScreenBackdrop>
    <ScrollView style={[styles.container, { backgroundColor: 'transparent' }]} contentContainerStyle={{ padding: spacing.lg }}>
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
        <View style={styles.emailRow}>
          <Text style={styles.email}>{user.email}</Text>
          {user.email_verified
            ? <Text style={styles.verified}>✓ doğrulandı</Text>
            : <Text style={styles.unverified}>doğrulanmadı</Text>}
        </View>
        <View style={styles.stats}>
          <Text style={styles.stat}>💬 {user.total_comments ?? 0} yorum</Text>
          <Text style={styles.stat}>♥ {user.total_likes_received ?? 0} beğeni</Text>
          <Text style={styles.stat}>🎯 {user.total_predictions ?? 0} tahmin</Text>
        </View>

        <View style={styles.favRow}>
          <Text style={styles.favLabel}>⚽ Takımım:</Text>
          <TextInput style={styles.favInput} value={displayFav} onChangeText={setFav} placeholder="Desteklediğin takım" placeholderTextColor={colors.textMuted} maxLength={40} />
          {favChanged && (
            <TouchableOpacity style={styles.nameSave} onPress={saveFav} disabled={savingFav}>
              <Text style={styles.nameSaveTxt}>{savingFav ? '…' : 'Kaydet'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {user.badges?.length > 0 && (
          <View style={styles.badgeRow}>
            {user.badges.map((b) => (
              <View key={b.key} style={styles.badge}><Text style={styles.badgeTxt}>{b.icon} {b.label}</Text></View>
            ))}
          </View>
        )}
      </View>

      {/* Puan · seviye · başarılar · görevler (sunucu doğrulamalı) */}
      <ProgressSection />

      <ImageUploadButton />
      <TouchableOpacity style={[styles.btn, styles.btnAlt]} onPress={() => navigation.navigate('AvatarPicker')}>
        <Text style={styles.btnAltTxt}>⚽  Hazır Avatar Seç</Text>
      </TouchableOpacity>
      {user.avatar_type !== 'default' && (
        <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={removeAvatar}>
          <Text style={styles.btnGhostTxt}>Resmi Kaldır (varsayılana dön)</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={[styles.btn, styles.btnLeader]} onPress={() => navigation.navigate('UserDashboard')}>
        <Text style={styles.btnLeaderTxt}>📊  Başarı Panelim</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, styles.btnLeader]} onPress={() => navigation.navigate('AnalysisSettings')}>
        <Text style={styles.btnLeaderTxt}>🧩  Analiz Kriterlerim</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, styles.btnLeader]} onPress={() => navigation.navigate('Leaderboard')}>
        <Text style={styles.btnLeaderTxt}>🏆  Tahmin Sıralaması</Text>
      </TouchableOpacity>

      {/* Güvenlik: şifre/e-posta değiştirme, güvenlik olayları, bağlı cihazlar */}
      <TouchableOpacity style={[styles.btn, styles.btnAlt]} onPress={() => navigation.navigate('SecuritySettings')}>
        <Text style={styles.btnAltTxt}>🔐  Güvenlik Ayarları</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, styles.btnAlt]} onPress={() => navigation.navigate('Devices')}>
        <Text style={styles.btnAltTxt}>📱  Bağlı Cihazlar</Text>
      </TouchableOpacity>

      {/* Engellediğin kullanıcılar ve engeli kaldırma. Engellemek yorumun
          altından yapılır; GERİ ALMAK için de bir yol olmak zorunda. */}
      <TouchableOpacity style={[styles.btn, styles.btnAlt]} onPress={() => navigation.navigate('BlockedUsers')}>
        <Text style={styles.btnAltTxt}>🚫  Engellenen Kullanıcılar</Text>
      </TouchableOpacity>

      {/* İNCELEME — yalnız sunucunun operatör dediği hesapta çizilir.
          Koşul `operator` başlangıçta false'tur: yetki cevabı gelene kadar
          giriş görünmez. Ters kurgu (önce göster, sonra gizle) girişi bir an
          herkese göstermek olurdu. */}
      {operator && (
        <TouchableOpacity style={[styles.btn, styles.btnAlt]} onPress={() => navigation.navigate('Moderation')}>
          <Text style={styles.btnAltTxt}>🛡️  İnceleme (bildirilen yorumlar)</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={[styles.btn, styles.btnAlt]} onPress={() => navigation.navigate('About')}>
        <Text style={styles.btnAltTxt}>ℹ️  Hakkında ve Gizlilik</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, styles.btnLogout]} onPress={logout}>
        <Text style={styles.btnLogoutTxt}>Çıkış Yap</Text>
      </TouchableOpacity>

      {/* HESAP SİLME — Google Play, hesap açan uygulamalarda uygulama içinden
          erişilebilen bir silme yolu ister. Silme gerçek ve kalıcıdır. */}
      <TouchableOpacity style={[styles.btn, styles.btnDelete]} onPress={() => navigation.navigate('DeleteAccount')}>
        <Text style={styles.btnDeleteTxt}>Hesabımı Sil</Text>
      </TouchableOpacity>

      {/* Kurum bağımsızlığı ve telif — kullanıcıya görünen sabit yasal metin. */}
      <Text style={styles.legalNote}>{INDEPENDENCE_NOTICE}</Text>
      <Text style={styles.copyright}>{COPYRIGHT}</Text>
    </ScrollView>
    </ScreenBackdrop>
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
  email: { color: colors.textMuted, fontSize: 12.5 },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  verified: { color: colors.green, fontSize: 11.5, fontWeight: '800' },
  unverified: { color: '#f0883e', fontSize: 11.5, fontWeight: '800' },
  progressWrap: { marginBottom: spacing.md },
  progressNote: { color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginBottom: spacing.md },
  levelCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  levelBadge: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.gold + '22', borderWidth: 2, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  levelBadgeTxt: { color: colors.gold, fontSize: 18, fontWeight: '900' },
  levelTitle: { color: colors.text, fontSize: 14.5, fontWeight: '800', marginBottom: 6 },
  levelTrack: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  levelFill: { height: 6, backgroundColor: colors.gold, borderRadius: 3 },
  levelSub: { color: colors.textMuted, fontSize: 11.5, marginTop: 5 },
  sectionTitle: { color: colors.text, fontSize: 14.5, fontWeight: '800', marginTop: spacing.sm, marginBottom: 8 },
  badgeRowLeft: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  achBadge: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  achBadgeLocked: { backgroundColor: 'transparent', borderColor: colors.border },
  achBadgeTxt: { color: colors.accent, fontSize: 11.5, fontWeight: '800' },
  achBadgeTxtLocked: { color: colors.textMuted, fontWeight: '700' },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 10, marginBottom: 7 },
  taskIcon: { fontSize: 17 },
  taskTitle: { color: colors.text, fontSize: 13, fontWeight: '700', marginBottom: 5 },
  taskDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  taskPts: { color: colors.gold, fontSize: 11.5, fontWeight: '800' },
  taskTrack: { height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' },
  taskFill: { height: 4, backgroundColor: colors.primary, borderRadius: 2 },
  taskCount: { color: colors.textMuted, fontSize: 11.5, fontWeight: '800' },
  stats: { flexDirection: 'row', gap: 14, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' },
  stat: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  favRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  favLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  favInput: { color: colors.text, fontSize: 14, fontWeight: '700', borderBottomWidth: 1, borderBottomColor: colors.border, minWidth: 120, paddingVertical: 3, textAlign: 'center' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7, marginTop: 14 },
  badge: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  badgeTxt: { color: colors.accent, fontSize: 11.5, fontWeight: '800' },
  btnLeader: { backgroundColor: colors.gold + '22', borderWidth: 1, borderColor: colors.gold },
  btnLeaderTxt: { color: colors.gold, fontSize: 15, fontWeight: '800' },
  btn: { paddingVertical: 13, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.sm },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryTxt: { color: colors.bg, fontSize: 15, fontWeight: '800' },
  btnAlt: { backgroundColor: colors.cardAlt },
  btnAltTxt: { color: colors.text, fontSize: 15, fontWeight: '800' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  btnGhostTxt: { color: colors.textMuted, fontSize: 13.5, fontWeight: '700' },
  btnLogout: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.red, marginTop: spacing.xl },
  btnLogoutTxt: { color: colors.red, fontSize: 14, fontWeight: '800' },
  btnDelete: { backgroundColor: 'transparent', paddingVertical: 10 },
  btnDeleteTxt: { color: colors.textMuted, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
  legalNote: {
    color: colors.textMuted, fontSize: 11.5, lineHeight: 17,
    textAlign: 'center', marginTop: spacing.lg,
  },
  copyright: {
    color: colors.textMuted, fontSize: 11.5, textAlign: 'center',
    marginTop: 6, marginBottom: spacing.lg,
  },
});
