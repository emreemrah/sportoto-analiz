import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, radius } from '../theme';
import { CATEGORIES, presetsByCategory } from '../avatars';
import { api } from '../api';
import { useAuth, refreshUser } from '../auth';

// Tek hazır avatar kutusu
function AvatarOptionCard({ preset, selected, onPress }) {
  return (
    <TouchableOpacity style={styles.cardWrap} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.circle, { backgroundColor: preset.bg }, selected && styles.circleOn]}>
        <Text style={styles.emoji}>{preset.emoji}</Text>
      </View>
      <Text style={styles.cardLabel} numberOfLines={1}>{preset.label}</Text>
    </TouchableOpacity>
  );
}

// Bir kategorinin avatar ızgarası
function AvatarGrid({ category, selectedKey, onSelect }) {
  const items = presetsByCategory(category.key);
  if (!items.length) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.catTitle}>{category.label}</Text>
      <View style={styles.grid}>
        {items.map((p) => (
          <AvatarOptionCard key={p.key} preset={p} selected={selectedKey === p.key} onPress={() => onSelect(p.key)} />
        ))}
      </View>
    </View>
  );
}

export default function AvatarPickerScreen({ navigation }) {
  const { user } = useAuth();
  const onSelect = async (key) => {
    try { await api.updateProfile({ avatarType: 'preset', avatarKey: key }); await refreshUser(); } catch (e) { alert(e.message); }
    navigation.goBack();
  };
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
      <Text style={styles.note}>Futbol temalı hazır avatarlar. Birine dokun, profilin güncellensin.</Text>
      {CATEGORIES.map((c) => (
        <AvatarGrid key={c.key} category={c} selectedKey={user?.avatar_type === 'preset' ? user.avatar_key : null} onSelect={onSelect} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  note: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.md },
  section: { marginBottom: spacing.lg },
  catTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cardWrap: { width: 76, alignItems: 'center' },
  circle: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  circleOn: { borderColor: colors.primary },
  emoji: { fontSize: 30, lineHeight: 38 },
  cardLabel: { color: colors.textMuted, fontSize: 10.5, fontWeight: '600', marginTop: 5, textAlign: 'center' },
});
