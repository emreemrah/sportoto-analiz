import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeScreen from './src/screens/HomeScreen';
import BulletinScreen from './src/screens/BulletinScreen';
import MatchDetailScreen from './src/screens/MatchDetailScreen';
import RadarScreen from './src/screens/RadarScreen';
import ForumScreen from './src/screens/ForumScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AvatarPickerScreen from './src/screens/AvatarPickerScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import { LoginScreen, RegisterScreen, ForgotPasswordScreen } from './src/screens/AuthScreens';
import { initAuth } from './src/auth';
import { colors } from './src/theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.card, text: colors.text, border: colors.border, primary: colors.accent },
};

const header = {
  headerStyle: { backgroundColor: colors.card },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '800' },
};

// Maç detayı kendi premium başlığını kullanır → native header gizli
const detailScreen = <Stack.Screen name="MatchDetail" component={MatchDetailScreen} options={{ headerShown: false }} />;

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={header}>
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      {detailScreen}
    </Stack.Navigator>
  );
}
function BulletinStack() {
  return (
    <Stack.Navigator screenOptions={header}>
      <Stack.Screen name="Bulletin" component={BulletinScreen} options={{ headerShown: false }} />
      {detailScreen}
    </Stack.Navigator>
  );
}
function AnalizStack() {
  return (
    <Stack.Navigator screenOptions={header}>
      <Stack.Screen name="Analiz" component={RadarScreen} options={{ headerShown: false }} />
      {detailScreen}
    </Stack.Navigator>
  );
}
function ForumStack() {
  return (
    <Stack.Navigator screenOptions={header}>
      <Stack.Screen name="Forum" component={ForumScreen} options={{ headerShown: false }} />
      {detailScreen}
    </Stack.Navigator>
  );
}
function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={header}>
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AvatarPicker" component={AvatarPickerScreen} options={{ title: 'Hazır Avatar Seç' }} />
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Giriş Yap' }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Kayıt Ol' }} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Şifremi Unuttum' }} />
    </Stack.Navigator>
  );
}

const TabIcon = ({ emoji, focused }) => <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>;

export default function App() {
  useEffect(() => { initAuth(); }, []);
  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: colors.bgAlt, borderTopColor: colors.border, height: 62, paddingBottom: 8, paddingTop: 6 },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: { fontSize: 10.5, fontWeight: '700' },
        }}
      >
        <Tab.Screen name="HomeTab" component={HomeStack}
          options={{ title: 'Ana Sayfa', tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} /> }} />
        <Tab.Screen name="BulletinTab" component={BulletinStack}
          options={{ title: 'Bülten', tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} /> }} />
        <Tab.Screen name="AnalizTab" component={AnalizStack}
          options={{ title: 'Analiz', tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} /> }} />
        <Tab.Screen name="ForumTab" component={ForumStack}
          options={{ title: 'Forum', tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused} /> }} />
        <Tab.Screen name="ProfileTab" component={ProfileStack}
          options={{ title: 'Profil', tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} /> }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
