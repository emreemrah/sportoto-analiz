// HAFTA ŞERİDİ — Radar Merkezi'nin üstündeki hafta gezintisi.
//
// ESKİ HÂLİ: tüm haftalar yan yana çipti ("53 · Güncel | 52 🔏 | 51 🔏 | 49 🔏").
// Arşiv tamamlanıp sezonda 52 hafta birikince şerit okunmaz oluyordu.
//
// YENİ KALIP resmî Spor Toto listesindeki gezintiyle aynıdır — İKİ açılır liste:
//
//   [SEZON 2025/2026 ▼]   [HAFTA 53. Hafta · Güncel ▼]
//
// HAFTA listesi seçili sezonun BÜTÜN haftalarını taşır, güncel dahil, en üstte.
// (Arada "güncel çipi + GEÇMİŞ listesi" denendi; resmî sitede tek liste var ve
// güncel de onun içinde — iki ayrı kontrol aynı işi yapan iki yol demekti.)
//
// Bu bileşen DURUM TUTMAZ (RadarTabHeaders ile aynı ilke): açık/kapalı ve
// seçimler RadarScreen'de yaşar; burada yalnız çizilir.
//
// Görünüm, Radar 5 filtre satırındaki ve Bülten'deki sezon seçicisiyle AYNI
// kalıptır (etiket + değer + ok çipi, altında liste) — aynı işi yapan üç farklı
// görünüm kullanıcıyı yanıltır.
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';
import { haftaSeridiVerisi, sezonKisa } from '../radarScreenData';

// Açılır liste en çok bu kadar uzar, sonrası kaydırılır. 52 haftalık bir sezon
// tek ekrana sığmaz; resmî listede de kaydırma vardır.
const LISTE_MAX_YUKSEKLIK = 300;

export default function HaftaSeridi({
  weeks, curId, selectedId,
  acik = null,                 // null | 'sezon' | 'hafta' — tek seferde tek liste açık
  onToggle = () => {},
  navSezon = null, onSelectSezon = () => {},
  onSelectWeek = () => {},
}) {
  const v = haftaSeridiVerisi(weeks, { curId, selectedId, navSezon });
  if (!v.liste.length) return null;

  return (
    <View>
      <View style={styles.satir}>
        {/* SEZON — yalnız birden çok sezon birikince çizilir; tek seçenekli
            açılır liste, dokunup hiçbir şeyin değişmemesi demektir. */}
        {v.sezonlar.length > 1 ? (
          <TouchableOpacity
            onPress={() => onToggle('sezon')}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`Sezon seç, şu an ${sezonKisa(v.seciliSezon)}`}
            style={[styles.secChip, acik === 'sezon' && styles.secChipAcik]}
          >
            <Text style={styles.secEtiket}>SEZON</Text>
            <Text style={styles.secTxt}>{sezonKisa(v.seciliSezon)}</Text>
            <Text testID="hafta-sezon-ok" style={styles.secOk}>{acik === 'sezon' ? '▲' : '▼'}</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          onPress={() => onToggle('hafta')}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`Hafta seç, şu an ${v.haftaDeger || 'seçili değil'}`}
          style={[styles.secChip, acik === 'hafta' && styles.secChipAcik]}
        >
          <Text style={styles.secEtiket}>HAFTA</Text>
          <Text style={styles.secTxt}>
            {v.haftaDeger || 'Seç'}{v.haftaGuncelMi ? ' · Güncel' : ''}
          </Text>
          <Text testID="hafta-ok" style={styles.secOk}>{acik === 'hafta' ? '▲' : '▼'}</Text>
        </TouchableOpacity>
      </View>

      {acik === 'sezon' && v.sezonlar.length > 1 ? (
        <View style={styles.liste}>
          {v.sezonlar.map((s) => {
            const secili = String(s.y) === String(v.seciliSezon);
            return (
              <TouchableOpacity
                key={String(s.y)}
                style={[styles.oge, secili && styles.ogeSecili]}
                onPress={() => onSelectSezon(s.y)}
                activeOpacity={0.8}
              >
                <Text style={[styles.ogeTxt, secili && styles.ogeTxtSecili]}>{s.ad}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {acik === 'hafta' ? (
        <View style={[styles.liste, styles.listeKaydirmali]}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
            {v.liste.map((w) => {
              const secili = Number(w.roundId) === Number(selectedId);
              return (
                <TouchableOpacity
                  key={w.roundId}
                  style={[styles.oge, secili && styles.ogeSecili]}
                  onPress={() => onSelectWeek(w.roundId)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.ogeTxt, secili && styles.ogeTxtSecili]}>{w.ad}</Text>
                  {/* Sağdaki işaret: güncel hafta mı, mühürlü mü. Mühür
                      "sonradan değişmez" güvencesidir, gizlenmez. */}
                  <Text style={styles.ogeMeta}>
                    {w.guncel ? 'Güncel' : w.kilitli ? '🔏' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  satir: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  secChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft, paddingHorizontal: 12, paddingVertical: 6,
  },
  secChipAcik: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  secEtiket: { color: colors.muted, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.6 },
  secTxt: { color: colors.text, fontSize: 12.5, fontWeight: '800' },
  secOk: { color: colors.primary, fontSize: 10, fontWeight: '900' },
  liste: {
    marginTop: 6, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    backgroundColor: colors.card, overflow: 'hidden', alignSelf: 'flex-start', minWidth: 200,
  },
  listeKaydirmali: { maxHeight: LISTE_MAX_YUKSEKLIK },
  oge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingVertical: 11, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  ogeSecili: { backgroundColor: colors.primarySoft },
  ogeTxt: { color: colors.textSoft, fontSize: 13, fontWeight: '700' },
  ogeTxtSecili: { color: colors.primary, fontWeight: '900' },
  ogeMeta: { color: colors.muted, fontSize: 11, fontWeight: '700' },
});
