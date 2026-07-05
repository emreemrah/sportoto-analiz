import React, { useEffect, useState } from 'react';
import { Text, View, Image, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

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
import CouponCreateScreen from './src/screens/CouponCreateScreen';
import CouponResultScreen from './src/screens/CouponResultScreen';
import CouponBuilderScreen from './src/screens/CouponBuilderScreen';
import CouponsScreen from './src/screens/CouponsScreen';
import UserDashboardScreen from './src/screens/UserDashboardScreen';
import SystemDashboardScreen from './src/screens/SystemDashboardScreen';
import SystemScorecardScreen from './src/screens/SystemScorecardScreen';
import { initAuth } from './src/auth';
import { colors } from './src/theme';
import AnimatedLogo from './src/components/AnimatedLogo';
import { FanWoman, KickingMan, AnalystMan, AnalystWoman, AnalysisCard } from './src/components/SplashCharacters';
import SplashTacticalScreen from './src/components/SplashTacticalScreen';

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
};

// Maç detayı kendi premium başlığını kullanır, native header gizli
const detailScreen = (
  <Stack.Screen
    name="MatchDetail"
    component={MatchDetailScreen}
    options={{ headerShown: false }}
  />
);

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={header}>
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      {detailScreen}
      {/* Topluluk (eski "Stadyum" sekmesi) — alt menüden kaldırıldı, Ana Sayfa
          "Toplulukta Gündem" bölümünden erişilir. */}
      <Stack.Screen name="Forum" component={ForumScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ headerShown: false }} />
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
      <Stack.Screen name="CouponBuilder" component={CouponBuilderScreen} options={{ title: 'Kupon Oluştur' }} />
      <Stack.Screen name="Coupons" component={CouponsScreen} options={{ title: 'Kuponlarım' }} />
      <Stack.Screen name="BulletinHistory" component={BulletinHistoryScreen} options={{ title: 'Bülten Geçmişi' }} />
      <Stack.Screen name="BulletinDetail" component={BulletinDetailScreen} options={{ title: 'Bülten Detayı' }} />
      <Stack.Screen name="CouponCreate" component={CouponCreateScreen} options={{ title: 'Kupon Oluştur' }} />
      <Stack.Screen name="CouponResult" component={CouponResultScreen} options={{ title: 'Kupon Sonucu' }} />
    </Stack.Navigator>
  );
}

function AnalizStack() {
  return (
    <Stack.Navigator screenOptions={header}>
      <Stack.Screen name="Analiz" component={RadarScreen} options={{ headerShown: false }} />
      {detailScreen}
      <Stack.Screen name="SystemScorecard" component={SystemScorecardScreen} options={{ title: 'Sistem Karnesi' }} />
      <Stack.Screen name="SystemDashboard" component={SystemDashboardScreen} options={{ title: 'Analiz Detayı (Demo)' }} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={header}>
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AvatarPicker" component={AvatarPickerScreen} options={{ title: 'Hazır Avatar Seç' }} />
      <Stack.Screen name="UserDashboard" component={UserDashboardScreen} options={{ title: 'Başarı Panelim' }} />
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Giriş Yap' }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Kayıt Ol' }} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Şifremi Unuttum' }} />
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
            Spor Toto{'\n'}
            <Text style={{ color: colors.accent }}>Analiz</Text>
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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const minDelay = new Promise((resolve) => setTimeout(resolve, 1200));
    Promise.all([initAuth(), minDelay]).then(() => {
      if (!cancelled) setReady(true);
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

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
    <NavigationContainer theme={navTheme}>
      <StatusBar style="light" />

      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.bgAlt,
            borderTopColor: colors.border,
            height: 64,
            paddingBottom: 8,
            paddingTop: 7,
          },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: {
            fontSize: 10.5,
            fontWeight: '800',
          },
        }}
      >
        <Tab.Screen
          name="HomeTab"
          component={HomeStack}
          options={{
            title: 'Ana Sayfa',
            tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
          }}
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
            title: 'Analiz',
            tabBarIcon: ({ focused }) => <TabIcon name="analysis" focused={focused} />,
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
    </SafeAreaProvider>
  );
}
