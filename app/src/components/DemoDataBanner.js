// app/src/components/DemoDataBanner.js
// GÜVEN KURALI: Bu ekrandaki bülten/sonuç/kupon verileri MOCK (örnek) veridir,
// gerçek Spor Toto verisi DEĞİLDİR. Kullanıcıya asla gerçekmiş gibi gösterilmez;
// bu banner her mock-beslemeli ekranın en üstünde büyük ve net durur.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';

export default function DemoDataBanner({ note }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.tag}>🧪 DEMO VERİ</Text>
      <Text style={styles.body}>
        {note || 'Bu ekrandaki bülten/sonuç/kupon örnektir — gerçek Spor Toto verisi değildir.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.warningSoft,
    borderWidth: 1.5,
    borderColor: colors.warning,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    margin: spacing.md,
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tag: {
    color: colors.white,
    backgroundColor: colors.warning,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    overflow: 'hidden',
  },
  body: { flex: 1, color: '#7a4a00', fontSize: 11.5, fontWeight: '700', lineHeight: 15 },
});
