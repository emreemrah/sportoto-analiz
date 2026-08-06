// ⓘ BİLGİ İPUCU — mobilde yarım ekran kaplayan açıklama kutularının ilacı
// (kullanıcı isteği, 2026-08-06: "infolar görünmesin, i işareti olsun, basınca
// küçük şekilde gösterilsin").
// ---------------------------------------------------------------------------
// Tek satırlık ÖZET her zaman görünür; uzun açıklama ⓘ'ye basınca altında
// açılır, tekrar basınca kapanır. Açıklamalar SİLİNMEZ — sadece istenince
// görünür (dürüstlük metinleri kaybolmaz, yer de kaplamaz).
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../theme';

export default function InfoIpucu({ ozet, detay, renk, stil, testID }) {
  const [acik, setAcik] = useState(false);
  return (
    <View style={[st.kutu, renk ? { borderColor: renk } : null, stil]} testID={testID}>
      <TouchableOpacity
        style={st.satir}
        onPress={() => setAcik((a) => !a)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={acik ? 'Açıklamayı kapat' : 'Açıklamayı göster'}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          {typeof ozet === 'string'
            ? <Text style={st.ozet} numberOfLines={2}>{ozet}</Text>
            : ozet}
        </View>
        <View style={[st.iKutu, acik && st.iKutuAcik]}>
          <Text style={[st.iTxt, acik && st.iTxtAcik]}>{acik ? '✕' : 'i'}</Text>
        </View>
      </TouchableOpacity>
      {acik ? (
        <View style={st.detay}>
          {typeof detay === 'string' ? <Text style={st.detayTxt}>{detay}</Text> : detay}
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  kutu: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    marginBottom: spacing.sm,
  },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ozet: { color: colors.text, fontSize: 12.5, fontWeight: '800' },
  iKutu: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: colors.info,
    alignItems: 'center', justifyContent: 'center',
  },
  iKutuAcik: { backgroundColor: colors.info, borderColor: colors.info },
  iTxt: { color: colors.info, fontSize: 12, fontWeight: '900', fontStyle: 'italic' },
  iTxtAcik: { color: '#fff', fontStyle: 'normal' },
  detay: { marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  detayTxt: { color: colors.textSoft, fontSize: 12, lineHeight: 17 },
});
