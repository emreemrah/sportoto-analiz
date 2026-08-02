// ANA SAYFA LİG ŞERİDİ — bu haftanın bültenindeki liglerin logosu + adı,
// soldan sağa kayan tek satır.
// ---------------------------------------------------------------------------
// Kayma/döngü/erişilebilirlik mekaniğinin tamamı KayanSerit'te; burada yalnız
// "hangi ligler ve nasıl görünürler" sorusu var.
//
// LOGO YOKSA: uydurma URL kurulmaz. Logo alanı boşsa Logo bileşeni nötr ⚽
// çizer. "Kulüp Maçları" bizim kendi etiketimizdir (kapsam dışı maçlar için),
// kaynakta karşılığı yoktur ve hep nötr simgeyle görünür — bu bir hata değil.
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { colors, spacing, radius } from '../theme';
import { Logo } from '../ui';
import KayanSerit from './KayanSerit';

/**
 * Bültenden TEKİL lig listesi çıkarır (bültendeki ilk görülme sırasıyla).
 * Aynı lig hem logolu hem logosuz maçta geçebilir (biri kapsam dışı kalmışsa);
 * bu durumda logolu olan kazanır — bulunan bir görseli kaybetmeyiz.
 * Saf fonksiyon: ayrıca test edilir.
 */
export function ligListesi(matches) {
  const gorulen = new Map();
  for (const m of matches || []) {
    const ad = m?.league;
    if (!ad) continue;
    const mevcut = gorulen.get(ad);
    if (!mevcut) {
      gorulen.set(ad, { name: ad, image: m.leagueImage || null });
    } else if (!mevcut.image && m.leagueImage) {
      mevcut.image = m.leagueImage;
    }
  }
  return [...gorulen.values()];
}

function LigRozeti({ lig }) {
  return (
    <View style={styles.rozet}>
      <Logo uri={lig.image} name={lig.name} size={22} />
      <Text style={styles.rozetAd} numberOfLines={1}>{lig.name}</Text>
    </View>
  );
}

export default function LigSeridi({ matches }) {
  const ligler = useMemo(() => ligListesi(matches), [matches]);

  // Lig yoksa boş bir çubuk çizilmez — bülten gelmeden şerit hiç görünmez.
  if (!ligler.length) return null;

  return (
    <KayanSerit
      testID="lig-seridi"
      style={styles.serit}
      accessibilityLabel={`Bu haftanın ligleri: ${ligler.map((l) => l.name).join(', ')}`}
    >
      {ligler.map((l) => <LigRozeti key={l.name} lig={l} />)}
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
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginRight: 8,
  },
  rozetAd: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 8,
  },
});
