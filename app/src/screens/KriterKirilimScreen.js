// ---------------------------------------------------------------------------
// KRİTER KIRILIMI — "bu kriter NEREDE başarılı" (2026-08-07)
// ---------------------------------------------------------------------------
// NEDEN VAR: karne "xG Karşı %58" diyordu ve kullanıcı haklı olarak şunu
// söyledi: "favori maçlarda mı, normal maçlarda mı, zor maçlarda mı belli
// değil — yoksa bu kriter yanıltıcı oluyor." Tek ortalama, birbirinin zıddı
// iki gerçeği tek sayıya eziyor: aynı kriter ağır favorili maçta %80,
// açık maçta %35 tutuyor olabilir.
//
// Ekran o ortalamayı beş eksende açar (hepsi mühürlü arşivden):
//   1. Kalabalıkla uyum  — favoriyi tekrar ettiğinde mi haklı, ters düştüğünde mi
//   2. Maç tipi          — oranlara göre ağır favori / favori / denk / açık
//   3. Kalabalık profili — oynanma yüzdesine göre emin / kararlı / bölünmüş / dağınık
//   4. Söylediği yön     — 1 / X / 2 dediğinde
//   5. Bülten sırası     — 1-5 / 6-10 / 11-15 ve tek tek
//
// 1. EKSEN NEDEN EN ÜSTTE: kalabalıkla hep aynı şeyi söyleyen kriterin yüksek
// başarısı bilgi değildir — favori zaten çoğu zaman kazanır. Kriterin gerçek
// katkısı, çoğunluktan AYRILDIĞINDA haklı çıkabilmesidir.
//
// DÜRÜSTLÜK: boş hücrede "%0" değil "—" yazar (ölçüm yok ile sıfır aynı şey
// değildir). Az örneklemli hücre işaretlenir. Örneklem küçükken ekranın en
// üstünde "bu henüz kanıt değildir" uyarısı durur ve gizlenemez.

import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity,
} from 'react-native';

import { api } from '../api';
import { colors, spacing, radius } from '../theme';

/** Oranı yazar; ölçüm yoksa "—". "%0" YAZILMAZ. */
function oranMetni(h) {
  if (!h || h.oran == null) return '—';
  return `%${h.oran}`;
}

function HucreSatiri({ baslik, aciklama, h, vurgu = false }) {
  const yok = !h || h.oran == null;
  return (
    <View style={[st.hSatir, vurgu && st.hSatirVurgu]}>
      <View style={st.hSol}>
        <Text style={st.hBaslik} numberOfLines={2}>{baslik}</Text>
        {aciklama ? <Text style={st.hAciklama} numberOfLines={2}>{aciklama}</Text> : null}
      </View>
      <View style={st.hSag}>
        <Text style={[st.hOran, yok && st.hOranYok]}>{oranMetni(h)}</Text>
        <Text style={st.hMac}>
          {h?.mac ? `${h.mac} maçta ${h.dogru}` : 'maç yok'}
          {h?.azOrneklem && h?.mac ? ' · az' : ''}
        </Text>
      </View>
    </View>
  );
}

function Bolum({ baslik, alt, grup, vurgu = false }) {
  if (!grup) return null;
  const bilinmiyor = grup.bilinmiyor;
  return (
    <View style={[st.kart, vurgu && st.kartVurgu]}>
      <Text style={st.kartBaslik}>{baslik}</Text>
      {alt ? <Text style={st.kartAlt}>{alt}</Text> : null}
      {grup.satirlar.map((x) => (
        <HucreSatiri key={x.ad} baslik={x.baslik} aciklama={x.aciklama} h={x} vurgu={vurgu} />
      ))}
      {bilinmiyor?.mac ? (
        <Text style={st.bilinmiyor}>
          {bilinmiyor.mac} maçta bu bilgi yoktu; hiçbir gruba zorla konulmadı.
        </Text>
      ) : null}
    </View>
  );
}

export default function KriterKirilimScreen({ route, navigation }) {
  const { key, ad } = route.params || {};
  const [veri, setVeri] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const [sirayiAc, setSirayiAc] = useState(false);

  useEffect(() => {
    let iptal = false;
    (async () => {
      try {
        const r = await api.analysisCriterionKirilim(key);
        if (!iptal) setVeri(r);
      } catch (e) {
        if (!iptal) setHata(e?.message || 'Kırılım okunamadı.');
      } finally {
        if (!iptal) setYukleniyor(false);
      }
    })();
    return () => { iptal = true; };
  }, [key]);

  return (
    <View style={st.kok}>
      <View style={st.ust}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={st.geri}
          accessibilityRole="button"
          accessibilityLabel="Geri dön"
        >
          <Text style={st.geriTxt}>‹</Text>
        </TouchableOpacity>
        <View style={st.ustOrta}>
          <Text style={st.ustEtiket}>KRİTER KIRILIMI</Text>
          <Text style={st.ustAd} numberOfLines={1}>{veri?.ad || ad || key}</Text>
        </View>
      </View>

      {yukleniyor ? (
        <View style={st.bekle}>
          <ActivityIndicator color={colors.primary} />
          <Text style={st.bekleTxt}>Mühürlü arşiv taranıyor…</Text>
        </View>
      ) : hata ? (
        <View style={st.icerik}><Text style={st.hata}>{hata}</Text></View>
      ) : (
        <ScrollView contentContainerStyle={st.icerik}>
          {/* ÖRNEKLEM UYARISI — en üstte ve kapatılamaz. */}
          {veri?.uyari ? <Text style={st.uyari}>{veri.uyari}</Text> : null}

          <View style={st.kart}>
            <Text style={st.kartBaslik}>Genel</Text>
            <View style={st.genelSatir}>
              <Text style={st.genelOran}>{oranMetni(veri?.genel)}</Text>
              <Text style={st.genelAlt}>
                {veri?.genel?.mac
                  ? `${veri.genel.mac} maçta ${veri.genel.dogru} doğru`
                  : 'ölçülebilir maç yok'}
              </Text>
            </View>
            <Text style={st.kartAlt}>
              Aşağıdaki bölümler bu ortalamanın neyi gizlediğini gösterir.
            </Text>
          </View>

          <Bolum
            vurgu
            baslik="Kalabalıkla uyum — en önemlisi"
            alt={'Çoğunluğun favorisini tekrar ettiğinde başarılı olmak bir şey '
              + 'öğretmez; favori zaten çoğu zaman kazanır. Bu kriterin gerçek '
              + 'katkısı, kalabalıktan AYRILDIĞINDA haklı çıkabilmesidir.'}
            grup={veri?.kalabalikUyumu}
          />

          <Bolum
            baslik="Maç tipi (oranlara göre)"
            alt="Maç öncesi mühürlenmiş orana göre ayrıldı; en düşük oran esas alındı."
            grup={veri?.macTipleri}
          />

          <Bolum
            baslik="Kalabalık profili (oynanma yüzdesi)"
            alt="En çok oynanan sonucun payına göre."
            grup={veri?.kalabalik}
          />

          <Bolum
            baslik="Piyasa favorisiyle uyum"
            alt="Aynı soru, oran tarafından bakışı."
            grup={veri?.piyasaUyumu}
          />

          <Bolum
            baslik="Söylediği yöne göre"
            alt="Bazı kriterler yalnız bir yönde işe yarar."
            grup={veri?.yonler}
          />

          <Bolum baslik="Bülten sırası" grup={veri?.siraGruplari} />

          {/* SIRA TEKİL — istenirse açılır. 15 hücreye bugünkü maç sayısını
              bölmek anlamsız; bu yüzden varsayılan kapalı. */}
          {veri?.siraTekil?.length ? (
            <View style={st.kart}>
              <TouchableOpacity
                onPress={() => setSirayiAc((x) => !x)}
                accessibilityRole="button"
                accessibilityLabel="Sıra sıra dökümü aç veya kapat"
              >
                <Text style={st.acKapa}>
                  {sirayiAc ? '− Sıra sıra dökümü gizle' : '+ Sıra sıra dökümü (1-15)'}
                </Text>
              </TouchableOpacity>
              {sirayiAc && veri.siraTekil.map((x) => (
                <HucreSatiri key={x.no} baslik={`${x.no}. sıra`} h={x} />
              ))}
            </View>
          ) : null}

          <Text style={st.altNot}>
            "—" = o grupta ölçülebilir maç yok (sıfır başarı DEĞİL).
            "az" = {veri?.azOrneklemEsigi ?? 5} maçın altında; tesadüfe açık.
            Bunlar geçmiş gözlemleridir; kesin sonuç veya kazanç vaadi değildir.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  kok: { flex: 1, backgroundColor: colors.bg },
  ust: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  geri: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  geriTxt: { fontSize: 26, color: colors.primary, fontWeight: '800', marginTop: -4 },
  // TAŞMA KORUMASI (ders §11): uzun kriter adlarında başlık satırdan taşıyordu.
  ustOrta: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, marginLeft: 4 },
  ustEtiket: { color: colors.textMuted, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.5 },
  ustAd: { color: colors.text, fontSize: 15, fontWeight: '900' },

  bekle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  bekleTxt: { color: colors.textMuted, fontSize: 12 },
  hata: { color: colors.danger, fontSize: 12.5, lineHeight: 18 },

  icerik: { padding: spacing.md, paddingBottom: spacing.xl },
  uyari: {
    backgroundColor: colors.warningSoft, color: colors.text, fontSize: 11.5, lineHeight: 16,
    padding: spacing.sm, borderRadius: radius.sm, marginBottom: spacing.md,
  },

  kart: {
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  kartVurgu: { borderColor: colors.primary },
  kartBaslik: { color: colors.text, fontSize: 13, fontWeight: '900' },
  kartAlt: { color: colors.textMuted, fontSize: 11, lineHeight: 15, marginTop: 3, marginBottom: 4 },

  genelSatir: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 },
  genelOran: { color: colors.text, fontSize: 26, fontWeight: '900' },
  genelAlt: { color: colors.textSoft, fontSize: 12 },

  hSatir: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 8,
  },
  hSatirVurgu: { paddingVertical: 10 },
  hSol: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  hBaslik: { color: colors.text, fontSize: 12.5, fontWeight: '700' },
  hAciklama: { color: colors.textMuted, fontSize: 10.5, lineHeight: 14 },
  hSag: { alignItems: 'flex-end', minWidth: 92 },
  hOran: { color: colors.text, fontSize: 15, fontWeight: '900' },
  hOranYok: { color: colors.textMuted, fontSize: 15 },
  hMac: { color: colors.textMuted, fontSize: 10.5 },

  bilinmiyor: { color: colors.textMuted, fontSize: 10.5, lineHeight: 14, marginTop: 6 },
  acKapa: { color: colors.primary, fontSize: 12.5, fontWeight: '800' },
  altNot: { color: colors.textMuted, fontSize: 10, lineHeight: 14, textAlign: 'center' },
});
