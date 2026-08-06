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

// YARI YARIYA KÜÇÜLTÜLDÜ (kullanıcı isteği, 2026-08-06): dolgular ve puntolar
// indirildi — satır incecik, ⓘ yine rahat basılır boyutta.
const st = StyleSheet.create({
  kutu: {
    backgroundColor: colors.card,
    borderRadius: radius.sm ?? 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ozet: { color: colors.text, fontSize: 11, fontWeight: '800' },
  iKutu: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 1, borderColor: colors.info,
    alignItems: 'center', justifyContent: 'center',
  },
  iKutuAcik: { backgroundColor: colors.info, borderColor: colors.info },
  iTxt: { color: colors.info, fontSize: 9.5, fontWeight: '900', fontStyle: 'italic' },
  iTxtAcik: { color: '#fff', fontStyle: 'normal' },
  detay: { marginTop: 5, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 5 },
  detayTxt: { color: colors.textSoft, fontSize: 11, lineHeight: 15 },
});
