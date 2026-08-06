// ÜLKE ETİKETİ — maç kartlarında "hangi ülkenin maçı" bilgisi:
// bayrak + BÜYÜK HARF ülke adı (+ istenirse lig kalanı).
// ---------------------------------------------------------------------------
// Kullanıcı isteği (2026-08-04): ana sayfa Yaklaşan Maçlar kartları ve bülten
// maç kartları ülkeyi göstersin. Ülke çıkarma mantığı saf modülde
// (src/ulkeSeridi.js). Bayrak görselleri flagcdn'den (kadro ekranıyla aynı
// kaynak). DÜRÜSTLÜK: tanınmayan lig adı için ülke UYDURULMAZ —
// `gizleTanimsiz` açıksa hiç çizilmez, değilse lig adı olduğu gibi yazılır.
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

import { colors } from '../theme';
import { countryCode } from '../utils';
import { ulkeAyikla, KULUP_ETIKETI } from '../ulkeSeridi';

// `kisa`: YALNIZ bayrak çizilir (ülke adı yazılmaz). Dar ekranda yan yana
// duran kartlarda "FİNLANDİYA" yazısı satırı taşırıyordu; bilgi kaybolmasın
// diye ülke adı erişilebilirlik etiketinde ve bayrakta duruyor.
export default function UlkeEtiketi({ league, ligGoster = true, gizleTanimsiz = false, kisa = false, style }) {
  const u = ulkeAyikla(league);
  if (!u) return null;

  // Tanınmayan lig (ülkesiz ve "Kulüp Maçları" da değil).
  if (!u.en && league !== KULUP_ETIKETI) {
    if (gizleTanimsiz) return null;
    return <Text style={[st.lig, style]} numberOfLines={1}>{league}</Text>;
  }

  const code = u.en ? countryCode(u.en) : '';
  const ligKalan = ligGoster && u.en ? String(league).slice(u.en.length).trim() : '';

  if (kisa) {
    const ad = u.name.toLocaleUpperCase('tr-TR');
    return code ? (
      <Image
        source={{ uri: `https://flagcdn.com/48x36/${code}.png` }}
        style={[st.bayrak, st.bayrakTek, style]}
        resizeMode="cover"
        accessibilityLabel={ad}
      />
    ) : (
      <Text style={[st.top, style]} accessibilityLabel={ad}>⚽</Text>
    );
  }

  return (
    <View style={[st.satir, style]}>
      {code ? (
        <Image source={{ uri: `https://flagcdn.com/48x36/${code}.png` }} style={st.bayrak} resizeMode="cover" />
      ) : (
        <Text style={st.top}>⚽</Text>
      )}
      <Text style={st.ulke} numberOfLines={1}>{u.name.toLocaleUpperCase('tr-TR')}</Text>
      {ligKalan ? <Text style={st.lig} numberOfLines={1}> · {ligKalan}</Text> : null}
    </View>
  );
}

const st = StyleSheet.create({
  satir: { flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  bayrak: { width: 18, height: 13, borderRadius: 2, marginRight: 5 },
  bayrakTek: { marginRight: 0 },
  top: { fontSize: 11, marginRight: 4 },
  ulke: { color: colors.textSoft ?? colors.text, fontSize: 10.5, fontWeight: '900', letterSpacing: 0.5 },
  lig: { color: colors.muted, fontSize: 10.5, fontWeight: '700', flexShrink: 1 },
});
