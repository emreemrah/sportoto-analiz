// HAFTA ŞERİDİ — Radar Merkezi'nin üstündeki hafta gezintisi.
//
// ESKİ HÂLİ: tüm haftalar yan yana çipti ("53 · Güncel | 52 🔏 | 51 🔏 | 49 🔏").
// Arşiv büyüdükçe (sezonda 52 hafta) şerit okunmaz oluyordu. YENİ KALIP resmî
// Spor Toto listesindeki gezintiyle aynıdır: sezon seç → hafta seç.
//
//   [53. Hafta · Güncel]  [SEZON 2025/2026 ▼]  [GEÇMİŞ 52. Hafta ▼]
//
// Bu bileşen DURUM TUTMAZ (RadarTabHeaders ile aynı ilke): açık/kapalı ve
// seçimler RadarScreen'de yaşar; burada yalnız çizilir.
//
// Görünüm, Radar 5 filtre satırındaki SEZON seçicisiyle AYNI kalıptır
// (etiket + değer + ok çipi ve altında liste) — aynı işi yapan iki farklı
// görünüm kullanıcıyı yanıltır.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';
import { haftaSeridiVerisi, sezonKisa } from '../radarScreenData';

export default function HaftaSeridi({
  weeks, curId, selectedId,
  acik = null,                 // null | 'sezon' | 'gecmis' — tek seferde tek liste açık
  onToggle = () => {},
  navSezon = null, onSelectSezon = () => {},
  onSelectWeek = () => {},
}) {
  const v = haftaSeridiVerisi(weeks, { curId, selectedId, navSezon });
  if (!v.guncel && !v.gecmis.length) return null;

  const cipler = (
    <View style={styles.satir}>
      {v.guncel ? (
        <TouchableOpacity
          onPress={() => onSelectWeek(v.guncel.roundId)}
          style={[styles.guncelCip, Number(selectedId) === Number(v.guncel.roundId) && styles.guncelCipOn]}
          activeOpacity={0.85}
        >
          <Text style={[styles.guncelTxt, Number(selectedId) === Number(v.guncel.roundId) && styles.guncelTxtOn]}>
            {v.guncel.round || `#${v.guncel.roundId}`} · Güncel
          </Text>
        </TouchableOpacity>
      ) : null}

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

      {/* GEÇMİŞ — geçmiş hafta varsa HER ZAMAN çizilir: tek geçmiş hafta bile
          olsa oraya gitmenin başka yolu yok (filtre değil, gezinti). */}
      {v.gecmis.length ? (
        <TouchableOpacity
          onPress={() => onToggle('gecmis')}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`Geçmiş hafta seç${v.gecmisDeger ? `, şu an ${v.gecmisDeger}` : ''}`}
          style={[styles.secChip, acik === 'gecmis' && styles.secChipAcik]}
        >
          <Text style={styles.secEtiket}>GEÇMİŞ</Text>
          <Text style={styles.secTxt}>{v.gecmisDeger || 'Seç'}</Text>
          <Text testID="hafta-gecmis-ok" style={styles.secOk}>{acik === 'gecmis' ? '▲' : '▼'}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  return (
    <View>
      {cipler}
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
      {acik === 'gecmis' && v.liste.length ? (
        <View style={styles.liste}>
          {v.liste.map((w) => {
            const secili = Number(w.roundId) === Number(selectedId);
            return (
              <TouchableOpacity
                key={w.roundId}
                style={[styles.oge, secili && styles.ogeSecili]}
                onPress={() => onSelectWeek(w.roundId)}
                activeOpacity={0.8}
              >
                <Text style={[styles.ogeTxt, secili && styles.ogeTxtSecili]}>
                  {w.ad}{w.kilitli ? ' 🔏' : ''}
                </Text>
                {/* Sezon eki yalnız birden çok sezon varken — tek sezonda gürültü. */}
                {v.sezonlar.length > 1 && w.yil != null ? (
                  <Text style={styles.ogeMeta}>{sezonKisa(w.yil)}</Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  satir: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  // Güncel çipi eski hafta çipiyle aynı görünümde (davranış değişmedi).
  guncelCip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  guncelCipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  guncelTxt: { color: colors.textSoft, fontSize: 12, fontWeight: '800' },
  guncelTxtOn: { color: '#fff' },
  // SEZON/GEÇMİŞ — Radar 5 ve Bülten'deki seçici kalıbıyla aynı.
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
