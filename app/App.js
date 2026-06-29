import React from 'react';
import { Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import BulletinScreen from './src/screens/BulletinScreen';
import MatchDetailScreen from './src/screens/MatchDetailScreen';
import RadarScreen from './src/screens/RadarScreen';
import CouponScreen from './src/screens/CouponScreen';
import { colors } from './src/theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.card, text: colors.text, border: colors.border, primary: colors.primary },
};

const header = {
  headerStyle: { backgroundColor: colors.card },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '800' },
};

function BulletinStack() {
  return (
    <Stack.Navigator screenOptions={header}>
      <Stack.Screen name="Bulletin" component={BulletinScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MatchDetail" component={MatchDetailScreen} options={{ title: 'Maç Analizi' }} />
    </Stack.Navigator>
  );
}

function RadarStack() {
  return (
    <Stack.Navigator screenOptions={header}>
      <Stack.Screen name="Radar" component={RadarScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MatchDetail" component={MatchDetailScreen} options={{ title: 'Maç Analizi' }} />
    </Stack.Navigator>
  );
}

function CouponStack() {
  return (
    <Stack.Navigator screenOptions={header}>
      <Stack.Screen name="Coupon" component={CouponScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MatchDetail" component={MatchDetailScreen} options={{ title: 'Maç Analizi' }} />
    </Stack.Navigator>
  );
}

const TabIcon = ({ emoji, focused }) => <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;

export default function App() {
  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, height: 60, paddingBottom: 8, paddingTop: 6 },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        }}
      >
        <Tab.Screen name="BulletinTab" component={BulletinStack}
          options={{ title: 'Bülten', tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} /> }} />
        <Tab.Screen name="RadarTab" component={RadarStack}
          options={{ title: 'Sürpriz Radarı', tabBarIcon: ({ focused }) => <TabIcon emoji="🎯" focused={focused} /> }} />
        <Tab.Screen name="CouponTab" component={CouponStack}
          options={{ title: 'Kupon', tabBarIcon: ({ focused }) => <TabIcon emoji="🎟️" focused={focused} /> }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
