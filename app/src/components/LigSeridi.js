// ANA SAYFA ÜLKE ŞERİDİ — bu haftanın bültenindeki ÜLKELER: bayrak + ad,
// soldan sağa kayan tek satır.
// ---------------------------------------------------------------------------
// Eskiden lig logosu + lig adı gösteriyordu; kullanıcı isteğiyle (2026-08-04)
// ülke bayrağı + BÜYÜK HARF ülke adına çevrildi ("Danimarka · Kulüp ·
// Finlandiya · İsveç · Norveç · Polonya" düzeni). Ülke çıkarma mantığı saf
// modülde: src/ulkeSeridi.js (ayrıca test edilir).
//
// BAYRAK YOKSA: uydurma URL kurulmaz. "Kulüp" (kapsam dışı maçlar) ve
// tanınmayan ülkeler nötr ⚽ simgesiyle görünür — bu bir hata değil.
// Bayrak görselleri flagcdn'den gelir; aynı kaynak kadro ekranında da
// kullanılıyor (MatchDetailScreen).
import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

import { colors, spacing, radius } from '../theme';
import { Logo } from '../ui';
import KayanSerit from './KayanSerit';
import { ulkeListesi } from '../ulkeSeridi';

export { ulkeListesi }; // geriye dönük içe aktarım kolaylığı

function UlkeRozeti({ ulke }) {
  return (
    <View style={styles.rozet}>
      {ulke.code ? (
        <Image
          source={{ uri: `https://flagcdn.com/48x36/${ulke.code}.png` }}
          style={styles.bayrak}
          resizeMode="cover"
        />
      ) : (
        <Logo uri={null} name={ulke.name} size={20} />
      )}
      <Text style={styles.rozetAd} numberOfLines={1}>{ulke.name.toLocaleUpperCase('tr-TR')}</Text>
      {/* Maç sayısı rozeti (kullanıcı isteği, 2026-08-04). */}
      <View style={styles.sayiRozet}>
        <Text style={styles.sayiTxt}>{ulke.count}</Text>
      </View>
    </View>
  );
}

export default function LigSeridi({ matches }) {
  const ulkeler = useMemo(() => ulkeListesi(matches), [matches]);

  // Ülke yoksa boş bir çubuk çizilmez — bülten gelmeden şerit hiç görünmez.
  if (!ulkeler.length) return null;

  return (
    <KayanSerit
      testID="lig-seridi"
      style={styles.serit}
      accessibilityLabel={`Bu haftanın ülkeleri: ${ulkeler.map((u) => u.name).join(', ')}`}
    >
      {ulkeler.map((u) => <UlkeRozeti key={u.name} ulke={u} />)}
    </KayanSerit>
  );
}

const styles = StyleSheet.create({
  serit: {
    marginTop: spacing.md,
    paddingVertical: 8,
  },
  rozet: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line ?? 'rgba(255,255,255,0.08)',
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  bayrak: {
    width: 22,
    height: 16,
    borderRadius: 3,
  },
  rozetAd: {
    color: colors.text,
    fontSize: 12.5,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 0.6,
    marginLeft: 8,
  },
  sayiRozet: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginLeft: 7,
  },
  sayiTxt: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
});
