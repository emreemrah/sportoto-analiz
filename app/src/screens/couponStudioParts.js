// KUPON EKRANLARI — yayın stüdyosuyla AYNI tablo görünümü.
//
// NEDEN AYRI DOSYA: Kupon tarafı (hazırla / kuponlarım / sonuç / paylaş) dört
// ayrı ekran. Tablo çerçevesi, zebra satır, arma+ad hücresi her ekranda ayrı
// yazılırsa dördü birbirinden farklı görünür — stüdyoda çözülen sorunun aynısı.
// Tek kaynak burasıdır.
//
// NEDEN studioParts.js'e EKLENMEDİ: o dosya yayın ekranlarının parçalarını
// tutar ve kaynak metni testlerle satır satır bekçilenir. Kupon tarafının
// parçaları oraya karışırsa iki taraf birbirinin testini kırar. Ortak olan
// (arma, 1-0-2 kutuları, panel, yasal şerit) oradan İÇE AKTARILIR, kopyalanmaz.
//
// KURALLAR:
//  • Bu dosya HESAP YAPMAZ. Kolon, maliyet, isabet, kilit — hepsi ekranlara
//    hazır gelir (yinelenen istatistik yasağı).
//  • Hiçbir metin veya renk "kesin/garanti/banko" anlamı taşımaz.
//  • Arma UYDURULMAZ: kulüp arması yoksa nötr simge çizilir (TeamCrest).
//  • Kişisel veri almaz: yalnız bülten satırı ve kullanıcının kendi seçimi.
import React from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, useWindowDimensions } from 'react-native';

import { S, R, SP, TABLE, T, ETIKET, NARROW_MAX, scaleFor } from '../studioTheme';
import { fontOf, useStudioFontReady, TABULAR } from '../studioFonts';
import { TeamCrest, PickBoxes, Panel, LegalStrip, Chip, Etiket, StudioState } from './studioParts';

// Stüdyo parçaları kupon ekranlarında da tek adresten çağrılsın diye dışa verilir.
export { TeamCrest, PickBoxes, Panel, LegalStrip, Chip, Etiket, StudioState };

/* ————————————————————————— ÖLÇEK ————————————————————————— */

/**
 * Ekran genişliğine göre ölçek + punto + font hazırlığı + dar yerleşim.
 * Dört kupon ekranı da aynı eşikleri kullansın diye tek kanca.
 */
export function useKuponOlcek() {
  const { width } = useWindowDimensions();
  const k = scaleFor(width);
  return { width, k, t: T(k), f: useStudioFontReady(), dar: width <= NARROW_MAX };
}

/* ————————————————————————— TABLO ————————————————————————— */

/** Tablo çerçevesi — ince gri çizgi, köşeli, taşan içerik kırpılır. */
export function Tablo({ children, style, testID }) {
  return <View style={[st.tablo, style]} testID={testID}>{children}</View>;
}

/** Koyu sütun başlığı şeridi. */
export function Thead({ k = 1, children, style }) {
  return <View style={[st.thead, { height: Math.round(TABLE.headH * k) }, style]}>{children}</View>;
}

/**
 * Tek sütun başlığı. `tam` dar ekranda kısaltılmış başlığın AÇIK hâlidir —
 * kırpılmış bir başlık sütunun neyi gösterdiğini saklar, tam adı ekran
 * okuyucuya verilir.
 */
export function Th({ text, k = 1, style, center = false, tam }) {
  const f = useStudioFontReady();
  return (
    <View style={[st.th, style, center && { alignItems: 'center' }]} accessibilityLabel={tam || text || undefined}>
      <Text style={[st.thTxt, ETIKET, fontOf(600, f), { fontSize: T(k).mikro }]} numberOfLines={1}>{text}</Text>
    </View>
  );
}

/** Satır çerçevesi. `secili` turuncu, `kilitli` soluk — ikisi de yalnız görsel. */
export function Tr({ k = 1, zebra = false, secili = false, kilitli = false, children, style, testID }) {
  return (
    <View
      style={[
        st.tr,
        { minHeight: Math.round(TABLE.rowH * k) },
        zebra && st.trZebra,
        secili && st.trSecili,
        kilitli && st.trKilitli,
        style,
      ]}
      testID={testID}
    >
      {children}
    </View>
  );
}

/** Hücre. `dar` sayı sütunları için (dolgu daralır, "20:00" kırpılmaz). */
export function Td({ children, style, center = false, dar = false }) {
  return <View style={[st.td, dar && st.tdDar, center && st.tdCenter, style]}>{children}</View>;
}

/** Tablo altı açıklama şeridi. */
export function Tfoot({ k = 1, children, style }) {
  const f = useStudioFontReady();
  return (
    <Text style={[st.tfoot, fontOf(400, f), { fontSize: T(k).kucuk }, style]}>{children}</Text>
  );
}

/* ————————————————————————— MAÇ SATIRI ————————————————————————— */

/**
 * Kupon tarafının ana satırı — yayın stüdyosundaki satırın birebir karşılığı:
 *   SIRA | arma  EV SAHİBİ - KONUK  arma | (ekrana özel sağ yuva)
 *
 * `sag` her ekranda farklıdır: hazırla ekranında 1-0-2 kutuları, sonuç
 * ekranında ✅/❌/⏳, listede seçim özeti. Satırın SOL yarısı hep aynıdır.
 *
 * @param {number|string} sira bülten sırası (hesaplanmaz, verilir)
 * @param {string} home/away resmî listedeki ad
 * @param {string} homeLogo/awayLogo arma adresi — yoksa nötr simge çizilir
 * @param {React.ReactNode} alt takım adlarının altındaki küçük satır(lar)
 * @param {React.ReactNode} ek maç ile sağ yuva arasındaki ara sütun (geniş ekran)
 * @param {React.ReactNode} sag sağ hücrenin içeriği
 * @param {number} sagGenislik sağ hücre genişliği (ölçekle çarpılmış piksel)
 */
export function MacSatiri({
  k = 1, zebra = false, secili = false, kilitli = false,
  sira, home, away, homeLogo, awayLogo,
  alt = null, ek = null, ekGenislik, sag = null, sagGenislik,
  onPress, erisimEtiketi, testID, siraGenislik = 32,
}) {
  const f = useStudioFontReady();
  const t = T(k);
  const armaBoy = Math.round(17 * k);
  const adlar = (
    <>
      <View style={st.macSatir}>
        <TeamCrest uri={homeLogo} size={armaBoy} />
        <Text style={[st.takim, fontOf(600, f), { fontSize: t.orta }]} numberOfLines={1}>{home || '—'}</Text>
        <Text style={[st.tire, fontOf(400, f), { fontSize: t.kucuk }]}>-</Text>
        <Text style={[st.takim, fontOf(600, f), { fontSize: t.orta }]} numberOfLines={1}>{away || '—'}</Text>
        <TeamCrest uri={awayLogo} size={armaBoy} />
        {kilitli ? <Text style={[st.kilitIm, { fontSize: t.kucuk }]}>🔒</Text> : null}
      </View>
      {alt ? <View style={st.macAlt}>{alt}</View> : null}
    </>
  );

  return (
    <Tr k={k} zebra={zebra} secili={secili} kilitli={kilitli} testID={testID}>
      <Td center dar style={{ width: Math.round(siraGenislik * k) }}>
        <Text style={[st.sira, fontOf(700, f), TABULAR, { fontSize: t.orta }]}>{sira}</Text>
      </Td>

      {onPress ? (
        <TouchableOpacity
          style={[st.td, st.tdMac]}
          onPress={onPress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={erisimEtiketi || `${sira}. maç`}
        >
          {adlar}
        </TouchableOpacity>
      ) : (
        <Td style={st.tdMac}>{adlar}</Td>
      )}

      {ek != null ? (
        <Td style={ekGenislik ? { width: Math.round(ekGenislik * k) } : null}>{ek}</Td>
      ) : null}

      {sag != null ? (
        <Td center style={sagGenislik ? { width: Math.round(sagGenislik * k) } : null}>{sag}</Td>
      ) : null}
    </Tr>
  );
}

/** Takım adlarının altındaki küçük gri satır (lig, saat, "analiz detayı ▾"). */
export function AltBilgi({ text, k = 1, color = S.inkDim, sayi = false, style }) {
  const f = useStudioFontReady();
  if (text == null || text === '') return null;
  return (
    <Text
      style={[st.altBilgi, fontOf(500, f), sayi ? TABULAR : null, { color, fontSize: T(k).mikro }, style]}
      numberOfLines={1}
    >
      {text}
    </Text>
  );
}

/* ————————————————————————— KÜÇÜK PARÇALAR ————————————————————————— */

/** Etiket + değer satırı (özet kutularında). */
export function OzetSatir({ label, value, tone = S.ink, k = 1, guclu = false }) {
  const f = useStudioFontReady();
  const t = T(k);
  return (
    <View style={st.ozetSatir}>
      <Text style={[st.ozetLbl, fontOf(500, f), { fontSize: t.metin }]} numberOfLines={1}>{label}</Text>
      <View style={{ flex: 1 }} />
      <Text style={[st.ozetVal, fontOf(guclu ? 700 : 600, f), TABULAR, { color: tone, fontSize: guclu ? t.buyuk : t.orta }]}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Üstte büyük-harf etiket, altında sayı. Üst şeritteki "SEÇİLEN / KOLON /
 * MALİYET" gibi ölçüler için. Değer VERİLİR — burada hesaplanmaz.
 */
export function SayiKutu({ etiket, deger, alt, tone = S.ink, k = 1, testID }) {
  const f = useStudioFontReady();
  const t = T(k);
  return (
    <View style={st.sayiKutu} testID={testID}>
      <Text style={[st.sayiEtiket, ETIKET, fontOf(600, f), { fontSize: t.mikro }]} numberOfLines={1}>{etiket}</Text>
      <Text style={[st.sayiDeger, fontOf(700, f), TABULAR, { color: tone, fontSize: t.buyuk }]} numberOfLines={1}>
        {deger}
      </Text>
      {alt ? (
        <Text style={[st.sayiAlt, fontOf(500, f), { color: tone, fontSize: t.mikro }]} numberOfLines={1}>{alt}</Text>
      ) : null}
    </View>
  );
}

/**
 * Düğme. `ana` dolu turuncu, aksi halde açık zemin + ince çizgi.
 * KURAL (projede geçerli): sebepsiz kapalı düğme, sessiz düğmeden beterdir —
 * `disabled` verilecekse ekran mutlaka bir sebep yazısı da göstermelidir.
 */
export function Dugme({ text, onPress, k = 1, ana = false, disabled = false, style, testID, tone }) {
  const f = useStudioFontReady();
  const renk = tone || (ana ? S.accent : S.line);
  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      testID={testID}
      style={[
        st.dugme,
        { borderColor: renk },
        ana && { backgroundColor: renk },
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      <Text
        style={[st.dugmeTxt, fontOf(ana ? 700 : 600, f), { color: ana ? S.accentInk : S.ink, fontSize: T(k).metin }]}
        numberOfLines={1}
      >
        {text}
      </Text>
    </TouchableOpacity>
  );
}

/** Stüdyo yazımında metin kutusu. */
export function Giris({ k = 1, style, ...rest }) {
  const f = useStudioFontReady();
  return (
    <TextInput
      placeholderTextColor={S.inkDim}
      style={[st.giris, fontOf(600, f), { fontSize: T(k).orta }, style]}
      {...rest}
    />
  );
}

/** Küçük eğik açıklama — dürüstlük notları bu yazımla görünür. */
export function Not({ text, k = 1, tone = S.inkDim, style }) {
  const f = useStudioFontReady();
  if (!text) return null;
  return (
    <Text style={[st.not, fontOf(400, f), { color: tone, fontSize: T(k).kucuk }, style]}>{text}</Text>
  );
}

/** Ekran başlığı şeridi — koyu bant, solda başlık, sağda serbest yuva. */
export function Baslik({ text, alt, right = null, k = 1, testID }) {
  const f = useStudioFontReady();
  const t = T(k);
  return (
    <View style={st.baslik} testID={testID}>
      <View style={{ flexShrink: 1, minWidth: 0 }}>
        <Text style={[st.baslikTxt, fontOf(700, f), ETIKET, { fontSize: t.metin }]} numberOfLines={1}>{text}</Text>
        {alt ? (
          <Text style={[st.baslikAlt, fontOf(500, f), { fontSize: t.mikro }]} numberOfLines={1}>{alt}</Text>
        ) : null}
      </View>
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
}

/* ————————————————————————— STİL ————————————————————————— */

const st = StyleSheet.create({
  tablo: {
    backgroundColor: S.panel, borderWidth: TABLE.hair, borderColor: S.line, borderRadius: R.md,
    overflow: 'hidden',
  },
  thead: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: S.head,
    borderBottomWidth: TABLE.hair, borderBottomColor: S.head,
  },
  th: { paddingHorizontal: TABLE.cellPadX, justifyContent: 'center' },
  thTxt: { color: S.headInk },

  tr: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: TABLE.hair, borderBottomColor: S.lineSoft,
  },
  trZebra: { backgroundColor: S.panel2 },
  trSecili: { backgroundColor: S.accentSoft },
  trKilitli: { opacity: 0.78 },
  td: { paddingHorizontal: TABLE.cellPadX, paddingVertical: SP.xs, justifyContent: 'center' },
  tdCenter: { alignItems: 'center' },
  /* DAR SAYI SÜTUNU: standart dolgu bu genişlikte içeriği kırpıyordu. */
  tdDar: { paddingHorizontal: 5 },
  tdMac: { flex: 1, minWidth: 0 },

  sira: { color: S.inkSoft },
  macSatir: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 0 },
  takim: { color: S.ink, flexShrink: 1 },
  tire: { color: S.inkDim, marginHorizontal: 1 },
  kilitIm: { marginLeft: 2 },
  macAlt: { flexDirection: 'row', alignItems: 'center', gap: SP.sm, flexWrap: 'wrap' },
  altBilgi: { color: S.inkDim },

  tfoot: {
    color: S.inkDim, lineHeight: 16, paddingHorizontal: TABLE.cellPadX,
    paddingVertical: SP.sm, backgroundColor: S.panel2,
  },

  ozetSatir: { flexDirection: 'row', alignItems: 'baseline', paddingVertical: 2 },
  ozetLbl: { color: S.inkSoft, flexShrink: 1 },
  ozetVal: {},

  sayiKutu: { minWidth: 62, gap: 1 },
  sayiEtiket: { color: S.inkDim },
  sayiDeger: {},
  sayiAlt: {},

  dugme: {
    paddingHorizontal: SP.md, paddingVertical: SP.sm, borderRadius: R.sm,
    borderWidth: TABLE.hair, backgroundColor: S.panel, alignItems: 'center', justifyContent: 'center',
  },
  dugmeTxt: {},

  giris: {
    backgroundColor: S.panel, borderWidth: TABLE.hair, borderColor: S.line, borderRadius: R.sm,
    paddingHorizontal: SP.md, paddingVertical: SP.sm, color: S.ink,
  },

  not: { fontStyle: 'italic', lineHeight: 15 },

  baslik: {
    flexDirection: 'row', alignItems: 'center', gap: SP.sm,
    backgroundColor: S.head, paddingHorizontal: SP.md, paddingVertical: SP.sm,
    borderRadius: R.md,
  },
  baslikTxt: { color: S.headInk },
  baslikAlt: { color: '#D6DDE5' },
});

export const kuponStilleri = st;
