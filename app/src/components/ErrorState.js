import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Card } from '../ui';
import { colors, spacing, font } from '../theme';

// Ortak hata durumu kartı — mevcut ekranlardaki (BulletinScreen vb.) satır içi
// hata görünümüyle aynı üslupta, tekrar kullanılabilir hale getirildi.
export default function ErrorState({ message, onRetry, icon = '⚠️', title = 'Bir şeyler ters gitti' }) {
  return (
    <Card style={styles.wrap}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {!!message && <Text style={styles.message}>{message}</Text>}
      {onRetry && (
        <TouchableOpacity style={styles.btn} onPress={onRetry} activeOpacity={0.85}>
          <Text style={styles.btnTxt}>Tekrar Dene</Text>
        </TouchableOpacity>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: spacing.xxxl },
  icon: { fontSize: 34 },
  title: { color: colors.text, fontSize: font.lg, fontWeight: font.heavy, marginTop: spacing.md },
  message: { color: colors.textSoft, fontSize: font.sm, textAlign: 'center', marginTop: spacing.xs, paddingHorizontal: spacing.lg },
  btn: { marginTop: spacing.lg, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  btnTxt: { color: colors.bg, fontWeight: '800' },
});
