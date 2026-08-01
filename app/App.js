import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View, Image, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { APP_NAME, BRAND_LINE_1, BRAND_LINE_2 } from './src/brand';

import HomeScreen from './src/screens/HomeScreen';
import BulletinScreen from './src/screens/BulletinScreen';
import MatchDetailScreen from './src/screens/MatchDetailScreen';
import RadarScreen from './src/screens/RadarScreen';
import LiveMatchDetailScreen from './src/screens/LiveMatchDetailScreen';
import ForumScreen from './src/screens/ForumScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AvatarPickerScreen from './src/screens/AvatarPickerScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import { LoginScreen, RegisterScreen, ForgotPasswordScreen } from './src/screens/AuthScreens';
import BulletinHistoryScreen from './src/screens/BulletinHistoryScreen';
import BulletinDetailScreen from './src/screens/BulletinDetailScreen';
import CouponResultScreen from './src/screens/CouponResultScreen';
import CouponEditorScreen from './src/screens/CouponEditorScreen';
import CouponShareScreen from './src/screens/CouponShareScreen';
import CouponCenterScreen from './src/screens/CouponCenterScreen';
import UserDashboardScreen from './src/screens/UserDashboardScreen';
import SystemDashboardScreen from './src/screens/SystemDashboardScreen';
import SystemScorecardScreen from './src/screens/SystemScorecardScreen';
import AnalysisSettingsScreen from './src/screens/AnalysisSettingsScreen';
import AboutScreen from './src/screens/AboutScreen';
import DeleteAccountScreen from './src/screens/DeleteAccountScreen';
import SecuritySettingsScreen from './src/screens/SecuritySettingsScreen';
import BlockedUsersScreen from './src/screens/BlockedUsersScreen';
import ModerationScreen from './src/screens/ModerationScreen';
import DevicesScreen from './src/screens/DevicesScreen';
import WeekSummaryScreen from './src/screens/WeekSummaryScreen';
import WeekRecapScreen from './src/screens/WeekRecapScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import BroadcastScreen, { BROADCAST_CONTENT_STYLE } from './src/screens/BroadcastScreen';
// YAYIN STÜDYOSU — yayıncının canlı yayında ilerlediği üç ekran: tablo, maç
// detayı, geçmiş hafta karnesi. (Dördüncü bir "Final Kupon" ekranı vardı;
// kaydetme tabloya taşındığı için kaldırıldı.)
import StudioBulletinScreen from './src/screens/StudioBulletinScreen';
import StudioMatchScreen from './src/screens/StudioMatchScreen';
import StudioKarneScreen from './src/screens/StudioKarneScreen';
// UYARI/ONAY PENCERESİ: React Native'in Alert'i web'de boş taslaktır (hiç
// çizmez). Onay isteyen düğmeler web'de sessiz kalmasın diye pencereyi çizen
// host uygulama kökünde BİR KEZ bağlanır.
import { UyariHost } from './src/components/Uyari';
import { STUDIO_CONTENT_STYLE, FULLSCREEN_ROUTES } from './src/studioTheme';
import { useStudioFontLoader } from './src/studioFonts';
import { YAYIN_STUDYOSU_ACIK } from './src/features';
import { initAuth, getToken } from './src/auth';
import { needsLockOnLaunch } from './src/security/biometricLock';
import {
  initPush, addResponseListener, syncMatchReminders, getPushPrefs, isDesteklenir,
  sonYanitVerisi, sonYanitiTemizle,
} from './src/services/pushService';
import { loadPushInputs } from './src/services/notificationsService';
import { rotaKuyrugu, rotayiUygula, maclariBildir } from './src/pushRoute';
import BiometricLockScreen from './src/screens/BiometricLockScreen';
import { colors } from './src/theme';
import AnimatedLogo from './src/components/AnimatedLogo';
import { FanWoman, KickingMan, AnalystMan, AnalystWoman, AnalysisCard } from './src/components/SplashCharacters';
import SplashTacticalScreen from './src/components/SplashTacticalScreen';

// Yayın derlemesinde geliştirici/demo ekranları kayda alınmaz.
const IS_DEV_BUILD = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.card,
    text: colors.text,
    border: colors.border,
    primary: colors.accent,
  },
};

const header = {
  headerStyle: { backgroundColor: colors.card },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '800' },
  // YAYIN GÖRSELLİĞİ (yalnız web): geniş ekranda içerik uçtan uca yayılmaz;
  // ~1140px'te ortalanır — 1080p yayında "boş uygulama" izlenimi biter.
  // Mobilde hiçbir etkisi yoktur.
  ...(Platform.OS === 'web'
    ? { contentStyle: { width: '100%', maxWidth: 1140, alignSelf: 'center', backgroundColor: colors.bg } }
    : {}),
};

// Maç detayı kendi premium başlığını kullanır, native header gizli
const detailScreen = (
  <Stack.Screen
    name="MatchDetail"
    component={MatchDetailScreen}
    options={{ headerShown: false }}
  />
);

// Analiz Kriterlerim — maç detayından ve profilden erişilir (aynı ekran, çok yerde kayıtlı).
const analysisSettingsScreen = (
  <Stack.Screen
    name="AnalysisSettings"
    component={AnalysisSettingsScreen}
    options={{ title: 'Analiz Kriterlerim' }}
  />
);

// Alt sekme çubuğu stili TEK yerde durur. Yayın Modu'nda çubuk gizlenirken
// stilin "undefined" ile ezilmesi (React Navigation seçenekleri yayılarak
// birleştirir) diğer ekranlarda çubuğu bozardı; bu yüzden iki sabit tutulur.
const TAB_BAR_STYLE = {
  backgroundColor: colors.bgAlt,
  borderTopColor: colors.border,
  height: 64,
  paddingBottom: 8,
  paddingTop: 7,
};
const TAB_BAR_HIDDEN = { display: 'none' };

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={header}>
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="WeekSummary" component={WeekSummaryScreen} options={{ title: 'Haftanın Özeti' }} />
      <Stack.Screen name="WeekRecap" component={WeekRecapScreen} options={{ title: 'Hafta Kapanışı' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Bildirimler' }} />
      {/* YAYIN STÜDYOSU — features.js ile KAPALI (emrah şu an kullanmıyor).
          Rotalar hiç KAYDEDİLMİYOR: düğmeyi gizlemek yetmez, kayıtlı bir rota
          derin bağlantıyla ya da unutulmuş bir navigate çağrısıyla yine
          açılabilir. Kod, testler ve stiller yerinde — geri açmak tek satır
          (src/features.js → YAYIN_STUDYOSU_ACIK = true).

          İçindeki dört ekran: Broadcast (eski "Sunum" tam ekran modu),
          StudioBulletin, StudioMatch, StudioKarne. Dördü de tam ekran; alt
          sekme çubuğu FULLSCREEN_ROUTES kuralıyla gizlenir. */}
      {YAYIN_STUDYOSU_ACIK ? (
        <>
          <Stack.Screen
            name="Broadcast"
            component={BroadcastScreen}
            options={{ headerShown: false, contentStyle: BROADCAST_CONTENT_STYLE }}
          />
          <Stack.Screen
            name="StudioBulletin"
            component={StudioBulletinScreen}
            options={{ headerShown: false, contentStyle: STUDIO_CONTENT_STYLE }}
          />
          <Stack.Screen
            name="StudioMatch"
            component={StudioMatchScreen}
            options={{ headerShown: false, contentStyle: STUDIO_CONTENT_STYLE }}
          />
          {/* KARNE: geçmiş haftanın "ne oldu, kaç tuttu" ekranı. */}
          <Stack.Screen
            name="StudioKarne"
            component={StudioKarneScreen}
            options={{ headerShown: false, contentStyle: STUDIO_CONTENT_STYLE }}
          />
        </>
      ) : null}
      {detailScreen}
      {/* Topluluk (eski "Stadyum" sekmesi) — alt menüden kaldırıldı, Ana Sayfa
          "Toplulukta Gündem" bölümünden erişilir. */}
      <Stack.Screen name="Forum" component={ForumScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ headerShown: false }} />
      {analysisSettingsScreen}
    </Stack.Navigator>
  );
}

function BulletinStack() {
  return (
    <Stack.Navigator screenOptions={header}>
      <Stack.Screen name="Bulletin" component={BulletinScreen} options={{ headerShown: false }} />
      {detailScreen}
      {/* Canlı maç detayı (istatistik/olaylar) — "Canlı" sekmesi Bülten'e taşındı. */}
      <Stack.Screen name="LiveMatchDetail" component={LiveMatchDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CouponEditor" component={CouponEditorScreen} options={{ title: 'Kupon Hazırla' }} />
      <Stack.Screen name="CouponCenter" component={CouponCenterScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BulletinHistory" component={BulletinHistoryScreen} options={{ title: 'Bülten Geçmişi' }} />
      <Stack.Screen name="BulletinDetail" component={BulletinDetailScreen} options={{ title: 'Bülten Detayı' }} />
      <Stack.Screen name="CouponResult" component={CouponResultScreen} options={{ title: 'Kupon Sonucu' }} />
      <Stack.Screen name="CouponShare" component={CouponShareScreen} options={{ title: 'Kuponu Paylaş' }} />
      {analysisSettingsScreen}
    </Stack.Navigator>
  );
}

function AnalizStack() {
  return (
    <Stack.Navigator screenOptions={header}>
      <Stack.Screen name="Analiz" component={RadarScreen} options={{ headerShown: false }} />
      {detailScreen}
      <Stack.Screen name="SystemScorecard" component={SystemScorecardScreen} options={{ title: 'Sistem Karnesi' }} />
      {/* GELİŞTİRİCİ EKRANI — yalnız geliştirmede kayıtlıdır. Yayın (release)
          derlemesinde demo/örnek veri içeren hiçbir ekran gezinmeye açılmaz. */}
      {IS_DEV_BUILD ? (
        <Stack.Screen name="SystemDashboard" component={SystemDashboardScreen} options={{ title: 'Analiz Detayı (Demo)' }} />
      ) : null}
      {analysisSettingsScreen}
    </Stack.Navigator>
  );
}

// KUPONLARIM sekmesi — alt bardan doğrudan erişim (kullanıcı isteği).
// Aynı ekranlar Bülten akışında da kayıtlı; React Navigation'da farklı
// navigator'larda aynı isim sorun değildir (MatchDetail deseniyle aynı).
function CouponsStack() {
  return (
    <Stack.Navigator screenOptions={header}>
      <Stack.Screen name="CouponCenter" component={CouponCenterScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CouponEditor" component={CouponEditorScreen} options={{ title: 'Kupon Hazırla' }} />
      <Stack.Screen name="CouponResult" component={CouponResultScreen} options={{ title: 'Kupon Sonucu' }} />
      <Stack.Screen name="CouponShare" component={CouponShareScreen} options={{ title: 'Kuponu Paylaş' }} />
      {detailScreen}
      {analysisSettingsScreen}
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={header}>
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AvatarPicker" component={AvatarPickerScreen} options={{ title: 'Hazır Avatar Seç' }} />
      <Stack.Screen name="UserDashboard" component={UserDashboardScreen} options={{ title: 'Başarı Panelim' }} />
      {analysisSettingsScreen}
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Giriş Yap' }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Kayıt Ol' }} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Şifremi Unuttum' }} />
      {/* GÜVENLİK EKRANLARI — şifre/e-posta değiştirme, güvenlik olayları,
          bağlı cihazlar ve uzaktan oturum kapatma. */}
      <Stack.Screen name="SecuritySettings" component={SecuritySettingsScreen} options={{ title: 'Güvenlik Ayarları' }} />
      <Stack.Screen name="Devices" component={DevicesScreen} options={{ title: 'Bağlı Cihazlar' }} />
      {/* MODERASYON — engellenen kullanıcılar ve engeli kaldırma. Google Play,
          engelleme sunan uygulamalarda geri almanın da uygulama içinden
          erişilebilir olmasını bekler. */}
      <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} options={{ title: 'Engellenen Kullanıcılar' }} />
      {/* İNCELEME — bildirilen yorumların elle incelendiği ekran. Kayıt her
          derlemede yapılır ama YETKİ SUNUCUDADIR: ekranın kendisi açılışta
          /api/moderation/access sorar ve yetkisiz hesaba liste göstermez.
          Ekranı kayıttan çıkarmak bir güvenlik önlemi OLMAZDI; uçlar zaten
          kapalı, ekran ise yalnız bir görüntüleyicidir. */}
      <Stack.Screen name="Moderation" component={ModerationScreen} options={{ title: 'İnceleme' }} />
      {/* YASAL EKRANLAR — Google Play zorunluluğu: hesap silme yolu uygulama
          içinden de erişilebilir olmalıdır. */}
      <Stack.Screen name="About" component={AboutScreen} options={{ title: 'Hakkında' }} />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} options={{ title: 'Hesabımı Sil' }} />
    </Stack.Navigator>
  );
}

const TAB_ICONS = {
  home: require('./assets/tab-home.png'),
  bulletin: require('./assets/tab-bulletin.png'),
  analysis: require('./assets/tab-analysis.png'),
  stadium: require('./assets/tab-stadium.png'),
  profile: require('./assets/tab-profile.png'),
};

const TabIcon = ({ name, focused }) => (
  <Image
    source={TAB_ICONS[name]}
    style={{ width: 28, height: 28, opacity: focused ? 1 : 0.5 }}
    resizeMode="contain"
  />
);

// Analiz sekmesi: RADAR ikonu (eş merkezli halkalar + tarama kolu + iz).
const RadarIcon = ({ focused }) => {
  const c = focused ? colors.accent : colors.muted;
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="9.5" stroke={c} strokeWidth="1.5" fill="none" opacity={0.45} />
      <Circle cx="12" cy="12" r="6" stroke={c} strokeWidth="1.5" fill="none" opacity={0.55} />
      <Circle cx="12" cy="12" r="2.6" stroke={c} strokeWidth="1.5" fill="none" opacity={0.75} />
      <Line x1="12" y1="12" x2="20" y2="6" stroke={c} strokeWidth="2" strokeLinecap="round" />
      <Circle cx="16.6" cy="8.4" r="1.7" fill={c} />
      <Circle cx="12" cy="12" r="1.1" fill={c} />
    </Svg>
  );
};

// Kuponlarım sekmesi: BİLET ikonu (kenar çentikli kupon + zımba çizgisi).
const TicketIcon = ({ focused }) => {
  const c = focused ? colors.accent : colors.muted;
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24">
      <Path
        d="M3.5 8.2c0-1.1.9-2 2-2h13c1.1 0 2 .9 2 2v1.6a2.2 2.2 0 0 0 0 4.4v1.6c0 1.1-.9 2-2 2h-13c-1.1 0-2-.9-2-2v-1.6a2.2 2.2 0 0 0 0-4.4V8.2z"
        stroke={c} strokeWidth="1.6" fill="none" strokeLinejoin="round"
      />
      <Line x1="14.6" y1="7.4" x2="14.6" y2="16.6" stroke={c} strokeWidth="1.4" strokeDasharray="2.1 2.1" />
    </Svg>
  );
};

// Açılış ekranı: marka animasyonu en az ~1.2sn görünür kalır ve initAuth
// tamamlanana kadar bekler (hangisi uzun sürerse), sonra ana uygulamaya geçer.
// Sahne: sol üstte tezahürat eden taraftar, sağ üstte topu sektirip vuran
// oyuncu, ortada marka logosu, altta grafiğe bakan analist ikilisi.
function SplashScreen() {
  return (
    <View style={splashStyles.container}>
      <StatusBar style="light" />

      <View style={splashStyles.topRow}>
        <FanWoman width={78} height={196} />
        <View style={splashStyles.centerBlock}>
          <AnimatedLogo size={80} />
          <Text style={splashStyles.brand}>
            {BRAND_LINE_1}{'\n'}
            <Text style={{ color: colors.accent }}>{BRAND_LINE_2}</Text>
          </Text>
        </View>
        <KickingMan width={82} height={178} />
      </View>

      <View style={splashStyles.bottomRow}>
        <AnalystMan width={54} height={135} />
        <AnalysisCard width={92} height={66} />
        <AnalystWoman width={54} height={135} />
      </View>
    </View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  centerBlock: {
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 6,
    marginBottom: 40,
  },
  brand: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
    textAlign: 'center',
    lineHeight: 22,
  },
  bottomRow: {
    position: 'absolute',
    bottom: 54,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
  },
});

export default function App() {
  // Stüdyo yazı tipi arka planda yüklenir. BEKLENMEZ: dönüş değeri kullanılmaz,
  // uygulama fontsuz da açılır; font gelince stüdyo ekranları kendini yeniler.
  // Stüdyo kapalıyken yüklemeye hiç girilmez (kanca her koşulda ÇAĞRILIR —
  // koşullu çağırmak kanca sırasını bozar; kararı kancanın kendisi verir).
  useStudioFontLoader(YAYIN_STUDYOSU_ACIK);
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const navRef = useRef(null);
  // Dokunulan bildirimin hedefi burada BEKLER. Açılış animasyonu, oturum yükleme
  // ve biyometrik kilit boyunca NavigationContainer HENÜZ BAĞLI DEĞİLDİR; hedef
  // saklanmazsa dokunma sessizce düşer ve kullanıcı ana sayfada kalırdı.
  const rotaRef = useRef(rotaKuyrugu());

  // Gezinme hazır olduğu her anda (ilk bağlanma, kilit açıldıktan sonraki
  // yeniden bağlanma, yeni dokunma) bekleyen hedef uygulanır.
  const rotayiDene = useCallback(() => {
    rotayiUygula(rotaRef.current, navRef.current);
  }, []);

  const rotayiKuyrukla = useCallback((data) => {
    // Yabancı bildirim kuyruğa bile alınmaz; hedefi bildirimin serbest metni
    // değil, tanınan `kind` belirler (pushRoute.js).
    if (!rotaRef.current.koy(data)) return;
    rotayiDene();
  }, [rotayiDene]);

  // TELEFON HATIRLATMASI — açılışta hazırlık.
  // İZİN BURADA İSTENMEZ: izin yalnız kullanıcı ayardan açtığında sorulur
  // (uygulama açılır açılmaz izin penceresi çıkarmak kaba ve gereksizdir).
  // Kapalıysa hiçbir şey kurulmaz; açıksa zamanlama sessizce tazelenir —
  // maç saati değişmiş ya da kupon güncellenmiş olabilir.
  useEffect(() => {
    if (!isDesteklenir()) return undefined;
    let iptal = false;

    (async () => {
      await initPush();
      const prefs = await getPushPrefs();
      if (iptal || !prefs.enabled) return;
      try {
        const girdi = await loadPushInputs();
        // Bültendeki maç NUMARALARI: bildirimdeki maç hâlâ var mı sorusunu
        // yanıtlar (yalnız numara; tahmin/kupon/kullanıcı bilgisi tutulmaz).
        maclariBildir(girdi?.bulletin);
        await syncMatchReminders({ now: Date.now(), ...girdi });
      } catch { /* hatırlatma kurulamazsa uygulama normal çalışır */ }
    })();

    // 1) Uygulama TAMAMEN KAPALIYKEN dokunulmuşsa: dokunma, bu dinleyici
    //    kurulmadan önce yerli katmanda yakalanmıştır — oradan okunur.
    const acilisVerisi = sonYanitVerisi();
    if (acilisVerisi) {
      rotayiKuyrukla(acilisVerisi);
      // Temizlenmezse aynı dokunma sonraki açılışlarda da gezinme yaptırırdı.
      sonYanitiTemizle();
    }

    // 2) Uygulama açıkken ya da arka plandayken dokunulursa dinleyici çalışır.
    const birak = addResponseListener((data) => { rotayiKuyrukla(data); });

    return () => { iptal = true; birak(); };
  }, [rotayiKuyrukla]);

  useEffect(() => {
    let cancelled = false;
    const minDelay = new Promise((resolve) => setTimeout(resolve, 1200));
    Promise.all([initAuth(), minDelay]).then(async () => {
      // Biyometrik kilit: yalnız kullanıcı AÇMIŞSA ve cihaz destekliyorsa.
      // Web'de ve girişsiz durumda hiç devreye girmez.
      const mustLock = await needsLockOnLaunch(!!getToken()).catch(() => false);
      if (!cancelled) { setLocked(mustLock); setReady(true); }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <SplashTacticalScreen />
      </SafeAreaProvider>
    );
  }

  if (locked) {
    return (
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <StatusBar style="light" />
        <BiometricLockScreen onUnlock={() => setLocked(false)} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
    {/* documentTitle: web'de tarayıcı sekmesi başlığı. Bu prop verilmezse
        React Navigation, odaktaki route'un ADINI (ör. "Home", "AnalizTab")
        document.title'a yazar ve app.json'daki web.name'i ezer. Başlık da
        merkezî marka kaynağından beslenir. */}
    <NavigationContainer
      ref={navRef} theme={navTheme}
      documentTitle={{ formatter: () => APP_NAME }}
      onReady={rotayiDene}
    >
      <StatusBar style="light" />

      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: TAB_BAR_STYLE,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: {
            fontSize: 10.5,
            fontWeight: '800',
          },
          // GEZİNME SIFIRLAMA: sekmeden ayrılınca yığın köke döner. Böylece
          // "Bülteni Aç" ya da alt sekme her zaman HEDEF ekrana götürür —
          // eski gezintiden kalan maç detayı/alt ekran karşına çıkmaz.
          popToTopOnBlur: true,
        }}
      >
        <Tab.Screen
          name="HomeTab"
          component={HomeStack}
          options={({ route }) => ({
            title: 'Ana Sayfa',
            tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
            // Yayın ekranları tam ekrandır: alt sekme çubuğu OBS kadrajını
            // kirletir. Liste studioTheme.js'te TEK yerde durur; rota adı iki
            // dosyada ayrı ayrı yazılmaz.
            tabBarStyle: FULLSCREEN_ROUTES.includes(getFocusedRouteNameFromRoute(route))
              ? TAB_BAR_HIDDEN
              : TAB_BAR_STYLE,
          })}
        />

        <Tab.Screen
          name="BulletinTab"
          component={BulletinStack}
          options={{
            title: 'Bülten',
            tabBarIcon: ({ focused }) => <TabIcon name="bulletin" focused={focused} />,
          }}
        />

        <Tab.Screen
          name="AnalizTab"
          component={AnalizStack}
          options={{
            title: 'Radar',
            tabBarLabel: 'Radar',
            tabBarIcon: ({ focused }) => <RadarIcon focused={focused} />,
          }}
        />

        <Tab.Screen
          name="CouponsTab"
          component={CouponsStack}
          options={{
            title: 'Kuponlarım',
            tabBarIcon: ({ focused }) => <TicketIcon focused={focused} />,
          }}
        />

        <Tab.Screen
          name="ProfileTab"
          component={ProfileStack}
          options={{
            title: 'Profil',
            tabBarIcon: ({ focused }) => <TabIcon name="profile" focused={focused} />,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
    <UyariHost />
    </SafeAreaProvider>
  );
}
