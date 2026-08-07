// ---------------------------------------------------------------------------
// KRİTER MAÇ TABLOSU — ham veri, yorum yok (2026-08-07)
// ---------------------------------------------------------------------------
// KULLANICI TALİMATI (birebir): "Yorum katmayacaksın, olanı göstereceksin.
// 'Bu kriter burada başarılı' demeyecek — bunu ben tutan maçlardan kendim
// bakarak anlamam lazım."
//
// Bu yüzden ekranda YOK:
//   • "uzmanlık", "zayıf alan", "şurada iyi" gibi hiçbir hüküm
//   • bant adları ("ağır favori", "kalabalık kararlı") — türetilmiş etiketler
//   • hangi eksenin daha önemli olduğunu söyleyen açıklama paragrafları
//
// Ekranda VAR: kriterin yön söylediği her maç, ham değerleriyle tek tabloda.
//   Sıra · Maç · Oran (1/X/2) · Oynanma % (1/X/2) · Kriter · Sonuç · ✓/✗
//
// Araçlar (hüküm değil, süzgeç): tuttu / tutmadı filtresi ve sıralama.
// Yorumu kullanıcı yapar.

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity,
} from 'react-native';

import { api } from '../api';
import { colors, spacing, radius } from '../theme';

const SUZGECLER = [['hepsi', 'Hepsi'], ['tuttu', 'Tuttu'], ['tutmadi', 'Tutmadı']];
const SIRALAMALAR = [['hafta', 'Hafta'], ['sira', 'Sıra'], ['oran', 'Oran'], ['oynanma', 'Oynanma']];

/** Değeri yazar; yoksa "—". Sıfır uydurulmaz. */
const d = (v) => (v == null || v === '' ? '—' : String(v));

/** Üçlü değeri "a / b / c" biçiminde yazar. */
function uclu(o, anahtarlar) {
  if (!o) return '—';
  return anahtarlar.map((k) => d(o[k])).join(' / ');
}

function Satir({ m }) {
  return (
    <View style={st.satir}>
      <View style={st.ust}>
        <Text style={st.no}>{d(m.no)}</Text>
        <Text style={st.ad} numberOfLines={1}>
          {m.ev || '—'} – {m.deplasman || '—'}
        </Text>
        <Text style={[st.isaret, m.dogru ? st.dogru : st.yanlis]}>
          {m.dogru ? '✓' : '✗'}
        </Text>
      </View>
      <Text style={st.bilgi} numberOfLines={1}>
        <Text style={st.etiket}>Oran </Text>{uclu(m.oran, ['home', 'draw', 'away'])}
        <Text style={st.etiket}>   Oynanma </Text>{uclu(m.oynanma, ['1', 'X', '2'])}
      </Text>
      <Text style={st.bilgi} numberOfLines={1}>
        <Text style={st.etiket}>Kriter </Text>{d(m.sinyal)}
        <Text style={st.etiket}>   Sonuç </Text>{d(m.sonuc)}
        {m.skor ? <Text style={st.etiket}>{`  ${m.skor}`}</Text> : null}
        <Text style={st.etiket}>{`   ${d(m.hafta)}`}</Text>
      </Text>
    </View>
  );
}

export default function KriterKirilimScreen({ route, navigation }) {
  const { key, ad } = route.params || {};
  const [veri, setVeri] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const [suzgec, setSuzgec] = useState('hepsi');
  const [sirala, setSirala] = useState('hafta');

  useEffect(() => {
    let iptal = false;
    (async () => {
      try {
        const r = await api.analysisCriterionKirilim(key);
        if (!iptal) setVeri(r);
      } catch (e) {
        if (!iptal) setHata(e?.message || 'Okunamadı.');
      } finally {
        if (!iptal) setYukleniyor(false);
      }
    })();
    return () => { iptal = true; };
  }, [key]);

  const maclar = useMemo(() => {
    let liste = (veri?.maclar || []).slice();
    if (suzgec === 'tuttu') liste = liste.filter((m) => m.dogru);
    if (suzgec === 'tutmadi') liste = liste.filter((m) => !m.dogru);

    // Sıralama bir ARAÇTIR, hüküm değil. Eksik değer her zaman sona düşer;
    // `Number(null) === 0` yüzünden en başa çıkmasın diye açıkça elenir.
    const sayi = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const enDusukOran = (m) => {
      if (!m.oran) return null;
      const x = [m.oran.home, m.oran.draw, m.oran.away].map(sayi).filter((v) => v != null);
      return x.length === 3 ? Math.min(...x) : null;
    };
    const enYuksekOynanma = (m) => {
      if (!m.oynanma) return null;
      const x = ['1', 'X', '2'].map((k) => sayi(m.oynanma[k])).filter((v) => v != null);
      return x.length === 3 ? Math.max(...x) : null;
    };
    const anahtar = {
      hafta: (m) => sayi(m.roundId),
      sira: (m) => sayi(m.no),
      oran: enDusukOran,
      oynanma: enYuksekOynanma,
    }[sirala];

    return liste.sort((a, b) => {
      const x = anahtar(a);
      const y = anahtar(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;                 // verisi olmayan sona
      if (y == null) return -1;
      if (sirala === 'hafta') return y - x || (sayi(a.no) ?? 0) - (sayi(b.no) ?? 0);
      return x - y;
    });
  }, [veri, suzgec, sirala]);

  const tuttu = (veri?.maclar || []).filter((m) => m.dogru).length;
  const toplam = (veri?.maclar || []).length;

  return (
    <View style={st.kok}>
      <View style={st.baslikCubugu}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={st.geri}
          accessibilityRole="button"
          accessibilityLabel="Geri dön"
        >
          <Text style={st.geriTxt}>‹</Text>
        </TouchableOpacity>
        <View style={st.baslikOrta}>
          <Text style={st.baslikAd} numberOfLines={1}>{veri?.ad || ad || key}</Text>
          <Text style={st.baslikSayi}>
            {toplam ? `${toplam} maçta ${tuttu}` : 'ölçülebilir maç yok'}
          </Text>
        </View>
      </View>

      <View style={st.araclar}>
        <View style={st.dugmeSirasi}>
          {SUZGECLER.map(([k, etiket]) => (
            <TouchableOpacity
              key={k}
              style={[st.dugme, suzgec === k && st.dugmeAcik]}
              onPress={() => setSuzgec(k)}
              accessibilityRole="button"
              accessibilityLabel={etiket}
            >
              <Text style={[st.dugmeTxt, suzgec === k && st.dugmeTxtAcik]}>{etiket}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={st.dugmeSirasi}>
          {SIRALAMALAR.map(([k, etiket]) => (
            <TouchableOpacity
              key={k}
              style={[st.dugmeKucuk, sirala === k && st.dugmeAcik]}
              onPress={() => setSirala(k)}
              accessibilityRole="button"
              accessibilityLabel={`${etiket} sırala`}
            >
              <Text style={[st.dugmeTxtKucuk, sirala === k && st.dugmeTxtAcik]}>{etiket}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {yukleniyor ? (
        <View style={st.bekle}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : hata ? (
        <View style={st.icerik}><Text style={st.hata}>{hata}</Text></View>
      ) : (
        <ScrollView contentContainerStyle={st.icerik}>
          {maclar.length ? (
            maclar.map((m, i) => <Satir key={`${m.roundId}-${m.no}-${i}`} m={m} />)
          ) : (
            <Text style={st.bos}>Bu süzgeçle maç yok.</Text>
          )}
          {veri?.kesildi ? (
            <Text style={st.bos}>{veri.kesildi} eski maç listeye sığmadı.</Text>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  kok: { flex: 1, backgroundColor: colors.bg },
  baslikCubugu: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  geri: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  geriTxt: { fontSize: 26, color: colors.primary, fontWeight: '800', marginTop: -4 },
  // TAŞMA KORUMASI (ders §11): flex:1 tek başına yetmez.
  baslikOrta: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, marginLeft: 4 },
  baslikAd: { color: colors.text, fontSize: 15, fontWeight: '900' },
  baslikSayi: { color: colors.textMuted, fontSize: 11.5, fontWeight: '700' },

  araclar: {
    backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingBottom: 8, gap: 6,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  dugmeSirasi: { flexDirection: 'row', gap: 6 },
  dugme: {
    flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, paddingVertical: 6,
    borderRadius: radius.sm, backgroundColor: colors.bgAlt, alignItems: 'center',
  },
  dugmeKucuk: {
    flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, paddingVertical: 5,
    borderRadius: radius.sm, backgroundColor: colors.bgAlt, alignItems: 'center',
  },
  dugmeAcik: { backgroundColor: colors.primary },
  dugmeTxt: { color: colors.textSoft, fontSize: 12.5, fontWeight: '800' },
  dugmeTxtKucuk: { color: colors.textSoft, fontSize: 11, fontWeight: '700' },
  dugmeTxtAcik: { color: colors.white },

  bekle: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hata: { color: colors.danger, fontSize: 12.5, lineHeight: 18 },
  icerik: { padding: spacing.md, paddingBottom: spacing.xl },
  bos: { color: colors.textMuted, fontSize: 12, marginTop: 8 },

  satir: {
    backgroundColor: colors.surface, borderRadius: radius.sm, padding: 9, marginBottom: 6,
    borderWidth: 1, borderColor: colors.border,
  },
  ust: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  no: { color: colors.textMuted, fontSize: 11, fontWeight: '900', minWidth: 18 },
  ad: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, color: colors.text, fontSize: 12.5, fontWeight: '800' },
  isaret: { fontSize: 15, fontWeight: '900', width: 18, textAlign: 'right' },
  dogru: { color: colors.success },
  yanlis: { color: colors.danger },
  bilgi: { color: colors.text, fontSize: 11.5, fontWeight: '700' },
  etiket: { color: colors.textMuted, fontSize: 10.5, fontWeight: '600' },
});
