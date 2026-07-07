// FORM İKONLARI — son maç sonuçlarını BİZİM ikonlarla gösterir.
// Ev takımı = ev ikonu · Deplasman = uçak. Renk sonuca göre bakılıdır (PNG'ler
// zaten renkli): G yeşil · B sarı · M kırmızı. (Harf yerine ikon.)
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors } from '../theme';

const ICONS = {
  home: { G: require('../../assets/venue/home-win.png'), B: require('../../assets/venue/home-draw.png'), M: require('../../assets/venue/home-loss.png') },
  away: { G: require('../../assets/venue/away-win.png'), B: require('../../assets/venue/away-draw.png'), M: require('../../assets/venue/away-loss.png') },
};

export default function FormIcons({ form, venue = 'home', size = 18 }) {
  const raw = Array.isArray(form) ? form.join('') : String(form || '');
  const chars = raw.split('').filter((c) => 'GBM'.includes(c));
  if (!chars.length) return <Text style={s.na}>—</Text>;
  const set = ICONS[venue] || ICONS.home;
  return (
    <View style={s.row}>
      {chars.map((c, i) => <Image key={i} source={set[c]} style={{ width: size, height: size }} resizeMode="contain" />)}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 3, flexWrap: 'wrap' },
  na: { color: colors.textMuted, fontSize: 12 },
});
