// ---------------------------------------------------------------------------
// KRİTER BAŞARILARI — maç detayı "Analiz" sekmesinin listesi (2026-08-07)
// ---------------------------------------------------------------------------
// KULLANICI KARARI: maçın analizine bakarken kriterlerin BU MAÇTA ne dediği
// değil, GEÇMİŞTE ne yaptığı görünsün. Hükmü kullanıcı verir; ekran yorum
// katmaz ("bu kriter iyidir/kötüdür" cümlesi YOKTUR).
//
// Satır: kriter adı + "12 maçta 7 başarı · %58" + ›
// Satıra dokun → o kriterin ham maç tablosu (KriterKirilimScreen).
//
// KAYNAK: /api/scorecards/criteria — mühürlü maç-öncesi sinyaller × resmî 90 dk
// sonuçları. Yalnız resmî ileri-test haftaları sayılır (karne kapısı aynen).
//
// DÜRÜSTLÜK: sinyal üretmemiş kriter gizlenmez, "sinyal yok" / "veri yok"
// yazar. Yüzde uydurulmaz; ölçüm yoksa oran gösterilmez.

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
} from 'react-native';

import { api } from '../api';
import { colors, spacing, radius } from '../theme';

const DONEMLER = [
  ['allTime', 'Genel'], ['last1', 'Son Hafta'], ['last5', 'Son 5'],
  ['last10', 'Son 10'], ['last15', 'Son 15'],
];

export default function KriterBasariListesi({ navigation }) {
  const [veri, setVeri] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const [donem, setDonem] = useState('allTime');

  useEffect(() => {
    let iptal = false;
    (async () => {
      try {
        const r = await api.scorecardsCriteria();
        if (!iptal) setVeri(r);
      } catch (e) {
        if (!iptal) setHata(e?.message || 'Kriter karnesi okunamadı.');
      } finally {
        if (!iptal) setYukleniyor(false);
      }
    })();
    return () => { iptal = true; };
  }, []);

  if (yukleniyor) {
    return (
      <View style={st.kart}>
        <Text style={st.baslik}>Kriter Başarıları</Text>
        <View style={st.bekle}><ActivityIndicator color={colors.primary} /></View>
      </View>
    );
  }
  if (hata) {
    return (
      <View style={st.kart}>
        <Text style={st.baslik}>Kriter Başarıları</Text>
        <Text style={st.bos}>{hata}</Text>
      </View>
    );
  }
  if (!veri?.hasData) {
    return (
      <View style={st.kart}>
        <Text style={st.baslik}>Kriter Başarıları</Text>
        <Text style={st.bos}>
          {veri?.note || 'Henüz resmî kriter verisi yok — haftalar mühürlenip sonuçlandıkça dolacak.'}
        </Text>
      </View>
    );
  }

  const liste = (veri.criteria || [])
    .filter((c) => !c.informational)
    .sort((a, b) => (b.windows?.[donem]?.total || 0) - (a.windows?.[donem]?.total || 0));

  return (
    <View style={st.kart}>
      <Text style={st.baslik}>Kriter Başarıları</Text>

      <View style={st.donemSatir}>
        {DONEMLER.map(([k, etiket]) => (
          <TouchableOpacity
            key={k}
            style={[st.donemBtn, donem === k && st.donemBtnAcik]}
            onPress={() => setDonem(k)}
            accessibilityRole="button"
            accessibilityLabel={etiket}
          >
            <Text style={[st.donemTxt, donem === k && st.donemTxtAcik]}>{etiket}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Arşiv küçükken tüm dönemler aynı sayıyı gösterir; kullanıcı bunu
          "bozuk" sanmasın diye tek satır bilgi. Hüküm değil, olgu. */}
      {Number(veri.includedCount) > 0 && Number(veri.includedCount) < 5 ? (
        <Text style={st.not}>
          Arşivde {veri.includedCount} resmî hafta var — bu yüzden tüm dönemler
          aynı sayıları gösteriyor.
        </Text>
      ) : null}

      {liste.map((c) => {
        const w = c.windows?.[donem] || { rate: null, hits: 0, total: 0 };
        const olculdu = w.rate != null;
        return (
          <TouchableOpacity
            key={c.key}
            style={st.satir}
            activeOpacity={0.7}
            onPress={() => navigation?.navigate('KriterKirilim', { key: c.key, ad: c.label })}
            accessibilityRole="button"
            accessibilityLabel={`${c.label} kriterinin maçlarını aç`}
          >
            <Text style={st.ad} numberOfLines={1}>{c.label}</Text>
            <Text style={[st.deger, !olculdu && st.degerYok]}>
              {olculdu
                ? `${w.total} maçta ${w.hits} başarı · %${w.rate}`
                : (c.noData >= c.evaluated ? 'veri yok' : 'sinyal yok')}
            </Text>
            <Text style={st.ok}>›</Text>
          </TouchableOpacity>
        );
      })}

      <Text style={st.altNot}>
        "X maçta Y başarı" = kriterin yön gösterdiği maç sayısı ve doğru çıkan
        yön sayısı. Satıra dokun: o maçların tamamı oranı ve oynanma yüzdesiyle
        listelenir.
      </Text>
    </View>
  );
}

const st = StyleSheet.create({
  kart: {
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  baslik: { color: colors.text, fontSize: 14, fontWeight: '900', marginBottom: 8 },
  bekle: { paddingVertical: 16, alignItems: 'center' },
  bos: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  not: { color: colors.textMuted, fontSize: 10.5, lineHeight: 14, marginBottom: 6 },

  donemSatir: { flexDirection: 'row', gap: 4, marginBottom: 8 },
  donemBtn: {
    flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, paddingVertical: 5,
    borderRadius: radius.sm, backgroundColor: colors.bgAlt, alignItems: 'center',
  },
  donemBtnAcik: { backgroundColor: colors.primary },
  donemTxt: { color: colors.textSoft, fontSize: 10.5, fontWeight: '800' },
  donemTxtAcik: { color: colors.white },

  satir: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  // TAŞMA KORUMASI (ders §11): uzun kriter adları satırdan taşıyordu.
  ad: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, color: colors.text, fontSize: 12.5, fontWeight: '700' },
  deger: { color: colors.text, fontSize: 11.5, fontWeight: '800' },
  degerYok: { color: colors.textMuted, fontWeight: '600' },
  ok: { color: colors.textMuted, fontSize: 16, fontWeight: '900' },

  altNot: { color: colors.textMuted, fontSize: 10, lineHeight: 14, marginTop: 8 },
});
