import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { uyari } from '../components/Uyari';
import { colors, spacing, radius } from '../theme';
import { ProfileAvatar } from '../components';
import { Logo } from '../ui';
// Hareketli arka plan (ScreenBackdrop) kullanıcı isteğiyle KALDIRILDI
// (2026-08-04): zeminde yalnız takım logosu filigranı kalır.
import { View as DuzZemin } from 'react-native';
import TakimLogoZemin from '../components/TakimLogoZemin';
import { api } from '../api';
import { useAuth, logout, refreshUser } from '../auth';
import { COPYRIGHT, INDEPENDENCE_NOTICE } from '../brand';

const MAX_BYTES = 2 * 1024 * 1024;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Geliştirme derlemesi mi? (App.js:70 ile aynı okuma.) Metro yayın derlemesinde
// `__DEV__` false'a sabitlenir, bu yüzden yayında bu kapı DAİMA kapalıdır.
const IS_DEV_BUILD = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

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

// (ProgressSection — puan/seviye/başarı/görev — TAMAMEN SİLİNDİ.
//  Oyunlaştırma sistemi kullanıcı kararıyla söküldü, 2026-08-06.)

export default function ProfileScreen({ navigation }) {
  const { user, token, ready } = useAuth();
  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [fav, setFav] = useState(null);
  // Takım arması (kullanıcı isteği, 2026-08-04): ad → arma eşlemesi takım
  // kataloğundan yapılır (backend 7 gün cache'ler). Bulunamazsa nötr ⚽ kalır
  // — başka kulübün arması ASLA konmaz (proje kuralı).
  const [favLogo, setFavLogo] = useState(null);
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

  // Takım adı → arma (katalogdan; büyük/küçük harf duyarsız). Bulunamazsa null.
  const favAd = user?.favorite_team || '';
  useEffect(() => {
    let iptal = false;
    if (!favAd) { setFavLogo(null); return undefined; }
    api.favoriteTeams()
      .then((d) => {
        if (iptal) return;
        const kucuk = favAd.toLocaleLowerCase('tr-TR');
        for (const lig of d?.leagues || []) {
          const t = (lig.teams || []).find((x) => x.name.toLocaleLowerCase('tr-TR') === kucuk
            || (x.cleanName || '').toLocaleLowerCase('tr-TR') === kucuk);
          if (t) { setFavLogo(t.image || null); return; }
        }
        setFavLogo(null); // eşleşme yoksa arma konmaz — benzeri görsel yasak
      })
      .catch(() => { if (!iptal) setFavLogo(null); });
    return () => { iptal = true; };
  }, [favAd]);

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
    <DuzZemin style={{ flex: 1, backgroundColor: colors.bg }}>
    {/* Favori takım arması zeminde soluk filigran (kullanıcı isteği). */}
    <TakimLogoZemin />
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

        {/* Takım artık YAZILMAZ, listeden SEÇİLİR (kullanıcı isteği, 2026-08-04).
            Seçim ekranı: TeamPicker (Süper Lig, Premier League, La Liga, ...). */}
        <View style={styles.favRow}>
          {/* Etiketteki ⚽ yerine de takım arması (kullanıcı isteği). Arma yoksa ⚽ kalır. */}
          {favLogo ? <Logo uri={favLogo} name={user.favorite_team} size={18} /> : null}
          <Text style={styles.favLabel}>{favLogo ? 'Takımım:' : '⚽ Takımım:'}</Text>
          <TouchableOpacity style={styles.favPick} activeOpacity={0.85} onPress={() => navigation.navigate('TeamPicker')}>
            {user.favorite_team ? <Logo uri={favLogo} name={user.favorite_team} size={20} /> : null}
            <Text style={[styles.favPickTxt, !user.favorite_team && { color: colors.textMuted }]} numberOfLines={1}>
              {user.favorite_team || 'Takımını seç'}
            </Text>
            <Text style={styles.favPickOk}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Rozet satırı + puan/seviye/başarı/görev paneli KALDIRILDI
            (kullanıcı kararı, 2026-08-04: "başarım, rozetler, seviye vs
            kaldır"). Kod duruyor (ProgressSection + badgeRow stilleri),
            yalnız çizilmiyor — istenirse tek satırla geri gelir. */}
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

      <TouchableOpacity style={[styles.btn, styles.btnLeader]} onPress={() => navigation.navigate('UserDashboard')}>
        <Text style={styles.btnLeaderTxt}>📊  Başarı Panelim</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, styles.btnLeader]} onPress={() => navigation.navigate('AnalysisSettings')}>
        <Text style={styles.btnLeaderTxt}>🧩  Analiz Kriterlerim</Text>
      </TouchableOpacity>

      {/* "Tahmin Sıralaması" (puan tabanlı liderlik) oyunlaştırmayla birlikte kaldırıldı. */}

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

      {/* SİSTEM KARNESİ — Master Analiz'in tekli 1/X/2 tahmininin resmî
          karnesi. Normal kullanıcıya GÖSTERİLMEZ: uygulamadaki "Sistem"
          sütunu kupon kapsamasıdır (çoklu tercih dahil), bu ise tekli ana
          tahmin — ikisi aynı hafta için farklı yüzde verir.
          KAPI: operatör YA DA geliştirme derlemesi. `operator` tek başına
          yetmez: sunucuda operatör listesi tanımlı değilken kapı fail-closed
          olduğu için (backend/src/moderatorGate.js) giriş hiç çizilmezdi.
          Yayın derlemesinde `__DEV__` false olduğu için orada yalnız
          operatör görür. */}
      {(operator || IS_DEV_BUILD) && (
        <TouchableOpacity style={[styles.btn, styles.btnAlt]} onPress={() => navigation.navigate('SystemScorecard')}>
          <Text style={styles.btnAltTxt}>📊  Sistem Karnesi (Master analiz)</Text>
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
    </DuzZemin>
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
  favRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, minWidth: 0 },
  favLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  favPick: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 7, maxWidth: 220,
  },
  favPickTxt: { color: colors.text, fontSize: 13.5, fontWeight: '800', flexShrink: 1 },
  favPickOk: { color: colors.accent, fontSize: 15, fontWeight: '900' },
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
