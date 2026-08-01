// HAFTA SEÇİCİ — Radar Merkezi'nin üstündeki hafta gezintisi.
//
// ESKİ HÂLİ: bütün haftalar yan yana çipti ("53 · Güncel | 52 🔏 | 51 🔏").
// Yeni sezon 1. haftayla başlayınca hem numaralar küçülüyor hem de haftalar
// birikiyor (sezonda 52) — şerit okunmaz hâle geliyor.
//
// YENİ KALIP resmî Spor Toto listesindekiyle aynıdır — İKİ açılır liste:
//
//   [2025/2026 Sezonu ▼]   [53. Hafta ▼]
//
// Hafta listesi seçili sezonun BÜTÜN haftalarını taşır, güncel dahil, en
// üstte. Sezon TEK ise açılır liste değil DÜZ YAZI gösterilir: tek seçenekli
// bir liste, dokunup hiçbir şeyin değişmemesi demektir.
//
// Bu bileşen DURUM TUTMAZ — açık/kapalı ve seçimler RadarScreen'de yaşar.
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';
import { haftaSeciciVerisi } from '../radarScreenData';

// Liste bu yükseklikten sonra kaydırılır: 52 haftalık sezon tek ekrana sığmaz
// (resmî listede de kaydırma vardır).
const LISTE_MAX_YUKSEKLIK = 300;

export default function HaftaSecici({
  weeks, curId, selectedId,
  acik = null,                    // null | 'sezon' | 'hafta' — tek seferde tek liste
  onToggle = () => {},
  navSezon = null, onSelectSezon = () => {},
  onSelectWeek = () => {},
}) {
  const v = haftaSeciciVerisi(weeks, { curId, selectedId, navSezon });
  if (!v.liste.length) return null;

  return (
    <View>
      <View style={styles.satir}>
        {/* SEZON — tek sezon olsa bile AÇILIR kalır. Düz yazı denendi ve
            "açılır olduğu anlaşılmıyor" geri bildirimi geldi; ikinci sezon
            gelince görünümün değişmemesi de daha tutarlı. */}
        <TouchableOpacity
          onPress={() => onToggle('sezon')}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`Sezon seç, şu an ${v.sezonAdi}`}
          style={[styles.sec, acik === 'sezon' && styles.secAcik]}
        >
          <Text style={styles.secTxt}>{v.sezonAdi}</Text>
          <Text testID="sezon-ok" style={styles.ok}>{acik === 'sezon' ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onToggle('hafta')}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`Hafta seç, şu an ${v.haftaAdi || 'seçili değil'}`}
          style={[styles.sec, acik === 'hafta' && styles.secAcik]}
        >
          <Text style={styles.secTxt}>
            {v.haftaAdi || 'Seç'}{v.haftaGuncelMi ? ' · Güncel' : ''}
          </Text>
          <Text testID="hafta-ok" style={styles.ok}>{acik === 'hafta' ? '▲' : '▼'}</Text>
        </TouchableOpacity>
      </View>

      {acik === 'sezon' ? (
        <View style={styles.liste}>
          {v.sezonlar.map((s) => {
            const secili = s.y === v.seciliSezon;
            return (
              <TouchableOpacity
                key={s.y}
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
                  {/* Sağdaki işaret: güncel mi, mühürlü mü. Mühür "sonradan
                      değişmez" güvencesidir, gizlenmez. */}
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
  satir: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  // DOKUNULABİLİR OLDUĞU BELLİ OLMALI: çerçeve + zemin + ok. Önce resmî
  // listedeki gibi çerçevesiz düz yazı denendi, "açılır olduğu anlaşılmıyor"
  // geri bildirimi geldi.
  sec: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft, paddingHorizontal: 12, paddingVertical: 7,
  },
  secAcik: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  secTxt: { color: colors.text, fontSize: 13.5, fontWeight: '800' },
  // ▼/▲ (U+25BC/25B2) — önce ⌄/⌃ (U+2304/2303) kullanılmıştı ve cihazda
  // GÖRÜNMÜYORDU; o karakterler birçok yazı tipinde yok. Bu ikisi aynı
  // ekranda Radar 5 satır açılımında zaten çalışıyor.
  ok: { color: colors.primary, fontSize: 11, fontWeight: '900' },
  liste: {
    marginTop: 6, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    backgroundColor: colors.card, overflow: 'hidden', alignSelf: 'flex-start', minWidth: 210,
  },
  listeKaydirmali: { maxHeight: LISTE_MAX_YUKSEKLIK },
  oge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingVertical: 11, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  ogeSecili: { backgroundColor: colors.primarySoft },
  ogeTxt: { color: colors.primary, fontSize: 13.5, fontWeight: '700' },
  ogeTxtSecili: { color: colors.primary, fontWeight: '900' },
  ogeMeta: { color: colors.muted, fontSize: 11, fontWeight: '700' },
});
