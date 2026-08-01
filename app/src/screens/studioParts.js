// YAYIN STÜDYOSU — ortak arayüz parçaları (bütün stüdyo ekranları bunları kullanır).
//
// NEDEN: Logo, seçim kutuları, risk şeridi ve durum ekranı ayrı ayrı yazılırsa
// yayında biri diğerinden farklı görünür. Burada bir kez tanımlanır.
//
// GÖRÜNÜM: "resmî bülten tablosu" — açık zemin, ince gri çizgi, köşeli kutu,
// koyu başlık şeridi, küçük punto. Yuvarlak-koyu-gölgeli kart görünümü bilerek
// terk edildi; ölçüler studioTheme.js'ten (TABLE / T / SP / R) okunur.
//
// KURALLAR:
//  • Bu dosya HESAP YAPMAZ. Bütün sayılar broadcastStudio.js'ten hazır gelir
//    (yinelenen istatistik yasağı).
//  • Hiçbir metin "kesin/garanti/banko" demez; renk de kesinlik anlamı taşımaz.
//  • Kişisel veri almaz: parçalar yalnız bülten satırı ve yayıncının seçimini alır.
//  • Arma UYDURULMAZ: kulüp arması yoksa nötr bir simge çizilir, benzeri üretilmez.
import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';

import { APP_NAME_UPPER, NO_GUARANTEE_NOTICE } from '../brand';
import { API_BASE } from '../config';
import { crestUrlOf } from '../crestUrl';
import { OUTCOMES } from '../couponConfig';
import { officialSymbol } from '../broadcastStudio';
import { S, R, SP, TABLE, T, ETIKET } from '../studioTheme';
import { fontOf, useStudioFontReady, TABULAR } from '../studioFonts';

/* ————————————————————————— MARKA ————————————————————————— */

/**
 * Stüdyo logosu — uygulamanın "SM" monogramının resmî-tablo karşılığı.
 * Yeni marka ÜRETİLMEZ: ad brand.js'ten okunur, monogram uygulamayla aynıdır.
 * Koyu başlık şeridinin üstünde durur, bu yüzden yazı rengi headInk'tir.
 */
export function StudioLogo({ k = 1 }) {
  const f = useStudioFontReady();
  const t = T(k);
  const d = Math.round(26 * k);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Math.round(8 * k), flexShrink: 1 }}>
      <View style={[st.mono, { width: d, height: d }]}>
        <Text style={[st.monoTxt, fontOf(700, f), { fontSize: Math.round(12 * k) }]}>SM</Text>
      </View>
      <View style={{ flexShrink: 1 }}>
        <Text style={[st.brand, fontOf(700, f), { fontSize: t.metin }]} numberOfLines={1}>
          {APP_NAME_UPPER}
        </Text>
        <Text style={[st.brandSub, fontOf(600, f), { fontSize: t.mikro }]} numberOfLines={1}>
          YAYIN STÜDYOSU
        </Text>
      </View>
    </View>
  );
}

/**
 * Üst çubuk — resmî tablodaki koyu başlık şeridi.
 * Solda marka, sağda ekrana özel düğmeler ve çıkış. `line` alt satıra yazılır
 * (hafta / maç sayısı gibi bağlam), böylece şerit tek satır kalır.
 */
export function StudioHeader({ k = 1, line, onExit, right = null, exitLabel = 'Stüdyodan çık' }) {
  const f = useStudioFontReady();
  const t = T(k);
  return (
    <View style={st.header} testID="studio-header">
      <View style={st.headerTop}>
        <StudioLogo k={k} />
        <View style={{ flex: 1 }} />
        {right}
        {onExit ? (
          <TouchableOpacity onPress={onExit} style={st.iconBtn} activeOpacity={0.85} accessibilityLabel={exitLabel}>
            <Text style={[st.iconTxt, fontOf(700, f)]}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {line ? (
        <Text style={[st.headerLine, fontOf(500, f), { fontSize: t.kucuk }]} numberOfLines={1}>{line}</Text>
      ) : null}
    </View>
  );
}

/** Koyu şerit üstünde duran küçük düğme — ekranlar `right` içinde kullanır. */
export function HeaderButton({ text, onPress, k = 1, label, testID }) {
  const f = useStudioFontReady();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={st.hBtn}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label || text}
      testID={testID}
    >
      <Text style={[st.hBtnTxt, fontOf(600, f), { fontSize: T(k).kucuk }]} numberOfLines={1}>{text}</Text>
    </TouchableOpacity>
  );
}

/* ————————————————————————— ARMA ————————————————————————— */

/**
 * Kulüp arması. Adres yoksa ya da resim yüklenmezse NÖTR bir top simgesi çizilir;
 * başka kulübün arması veya "benzeri" bir görsel ASLA konmaz.
 * Adres backend'den gelir; burada bir sağlayıcı adı geçmez (marka gizliliği).
 *
 * ADRES VEKİLDEN GEÇER (crestUrl.js): dış kaynaktan gelen bir görsel ekranda
 * görünse bile "ekran görselini paylaş" karesine giremiyordu. Kendi sunucumuz
 * üstünden geçince kareye giriyor. Gerekçenin tamamı crestUrl.js başında.
 * Vekil armayı bulamazsa 404 döner → onError → aşağıdaki nötr ⚽. Yani
 * "arma yok" durumu bu değişiklikten sonra da aynı yere düşer.
 */
export function TeamCrest({ uri, size = 18, style }) {
  const [hata, setHata] = useState(false);
  const adres = crestUrlOf(uri, API_BASE);
  const kutu = { width: size, height: size, borderRadius: R.sm };
  if (!adres || hata) {
    return (
      <View style={[st.crestBos, kutu, style]}>
        <Text style={{ fontSize: Math.round(size * 0.62), lineHeight: Math.round(size * 0.95) }}>⚽</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: adres }}
      style={[kutu, style]}
      resizeMode="contain"
      onError={() => setHata(true)}
      accessibilityIgnoresInvertColors
    />
  );
}

/* ———————————————————— SEÇİM KUTULARI ———————————————————— */

/**
 * 1 - 0 - 2 kutuları. Tablo satırında ve maç detayında AYNI bileşen kullanılır;
 * böylece iki yerde farklı davranış olması mümkün değildir.
 *
 * Kutular köşeli ve dar: tablo satırının yüksekliğini büyütmemeli.
 *
 * @param {string[]} outcomes seçili işaretler (kanonik: 1, X, 2)
 * @param {(o:string)=>void} onToggle kutuya dokunma
 * @param {boolean} disabled kilitli maç → dokunulamaz (kilit tek kaynaktan gelir)
 * @param {boolean} salt SALT GÖRÜNTÜLEME → dokunulamaz ama SOLDURULMAZ
 *
 * `disabled` ile `salt` AYNI ŞEY DEĞİLDİR ve karıştırılırsa görsel bozulur:
 *  • `disabled` bir DURUMDUR — "bu maç başladı, artık işaretleyemezsin".
 *    Solukluk (%42) o durumun kendisini anlatır, bilgi taşır.
 *  • `salt` bir YÜZEY özelliğidir — kupon listesi, sonuç, paylaşılan kare.
 *    Orada zaten hiçbir kutuya dokunulamaz; hepsini soldurmak hiçbir şey
 *    anlatmaz, yalnız kuponu soluk gösterir. Paylaşılan görselde bu, işaretin
 *    turuncusunu açık somona çevirip kareyi silik yapıyordu.
 */
export function PickBoxes({ outcomes = [], onToggle, disabled = false, salt = false, k = 1, compact = false }) {
  const f = useStudioFontReady();
  const h = Math.round((compact ? 26 : 30) * k);
  const w = Math.round((compact ? 30 : 36) * k);
  return (
    <View style={[st.picks, { gap: Math.round(4 * k) }]} testID="studio-picks">
      {OUTCOMES.map((o) => {
        const on = outcomes.includes(o);
        // Dokunulamazlık iki sebepten olabilir; SOLUKLUK yalnız kilitten gelir.
        const pasif = disabled || salt;
        return (
          <TouchableOpacity
            key={o}
            onPress={pasif ? undefined : () => onToggle?.(o)}
            disabled={pasif}
            activeOpacity={0.75}
            style={[
              st.pick,
              { height: h, minWidth: w },
              on && st.pickOn,
              disabled && st.pickOff,
            ]}
            // Salt görüntülemede kutu bir düğme değildir; ekran okuyucuya
            // "kapalı düğme" diye okutmak yanlış olur, okunacak şey işaretin
            // kendisidir.
            accessibilityRole={salt ? 'text' : 'button'}
            accessibilityState={salt ? { selected: on } : { selected: on, disabled }}
            accessibilityLabel={`${officialSymbol(o)} işareti${on ? ', seçili' : ''}${disabled ? ', kilitli' : ''}`}
            testID={`studio-pick-${o}`}
          >
            <Text
              style={[
                st.pickTxt, fontOf(700, f), TABULAR,
                { fontSize: Math.round((compact ? 13 : 15) * k) },
                on && st.pickTxtOn,
              ]}
            >
              {officialSymbol(o)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ———————————————————— KÜÇÜK PARÇALAR ———————————————————— */

/**
 * Küçük dikdörtgen etiket. Hap/pill biçimi bilerek kullanılmaz — resmî tabloda
 * yuvarlak rozet yoktur. `solid` dolu zemin, aksi halde açık zemin + ince çizgi.
 */
export function Chip({ text, tone = S.inkSoft, solid = false, soft, k = 1 }) {
  const f = useStudioFontReady();
  if (text == null || text === '') return null;
  return (
    <View style={[
      st.chip,
      { borderColor: tone, paddingHorizontal: Math.round(6 * k), paddingVertical: Math.round(2 * k) },
      soft ? { backgroundColor: soft } : null,
      solid && { backgroundColor: tone, borderColor: tone },
    ]}>
      <Text
        style={[st.chipTxt, fontOf(600, f), { color: solid ? S.accentInk : tone, fontSize: T(k).kucuk }]}
        numberOfLines={1}
      >
        {text}
      </Text>
    </View>
  );
}

/** Büyük-harf sütun/bölüm etiketi — başlık yerine kullanılır, yer kaplamaz. */
export function Etiket({ text, k = 1, color = S.inkDim, style }) {
  const f = useStudioFontReady();
  if (!text) return null;
  return (
    <Text style={[{ color, fontSize: T(k).mikro }, ETIKET, fontOf(600, f), style]} numberOfLines={1}>
      {text}
    </Text>
  );
}

/** İnce ölçek şeridi. Değer yoksa çubuk ÇİZİLMEZ — boş çubuk sahte sayı izlenimi verir. */
export function Bar({ value, tone, height = 5 }) {
  if (value == null || !Number.isFinite(value)) return null;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={[st.track, { height }]}>
      <View style={{ width: `${pct}%`, height, backgroundColor: tone || S.accent }} />
    </View>
  );
}

/* SEVİYE ROZETİ (LevelBadge) SİLİNDİ — yayıncı isteği.
   "Düşük/Orta/Yüksek · 44/100" biçiminde maça not veren tek bileşendi.
   Bileşen hiç yoksa yayıncı ekranlarına geri sızamaz; renk eşlemesi
   (toneOfLevel/toneSoftOfLevel) da aynı sebeple studioTheme.js'ten kaldırıldı.
   Ölçümün KENDİSİ broadcastStudio.js'te olduğu gibi durur (testleriyle
   birlikte); yalnız yayıncı modunda ÇİZİLMEZ. */

/**
 * Başlıklı bölüm kutusu — detay, final ve karne ekranlarının iskeleti.
 * Başlık koyu şeritte değil, ince çizginin üstünde küçük büyük-harf etikettir.
 */
export function Panel({ title, hint, right = null, children, k = 1, style, testID }) {
  const f = useStudioFontReady();
  const t = T(k);
  return (
    <View style={[st.panel, style]} testID={testID}>
      {title ? (
        <View style={st.panelHead}>
          <Text style={[st.panelTitle, fontOf(700, f), { fontSize: t.orta }]}>{title}</Text>
          <View style={{ flex: 1 }} />
          {right}
        </View>
      ) : null}
      {hint ? (
        <Text style={[st.panelHint, fontOf(400, f), { fontSize: t.kucuk }]}>{hint}</Text>
      ) : null}
      {children}
    </View>
  );
}

/** Yükleniyor / hata / boş — bütün stüdyo ekranlarında aynı yüzey. */
export function StudioState({ title, text, actionLabel, onAction, testID = 'studio-state' }) {
  const f = useStudioFontReady();
  return (
    <View style={st.state} testID={testID}>
      <Text style={[st.stateTitle, fontOf(700, f)]}>{title}</Text>
      {text ? <Text style={[st.stateText, fontOf(400, f)]}>{text}</Text> : null}
      {actionLabel ? (
        <TouchableOpacity style={st.stateBtn} onPress={onAction} activeOpacity={0.85}>
          <Text style={[st.stateBtnTxt, fontOf(600, f)]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** Yasal şerit — yayın yüzeyinde her ekranda görünür kalır. */
export function LegalStrip({ extra }) {
  const f = useStudioFontReady();
  return (
    <Text style={[st.legal, fontOf(400, f)]} numberOfLines={2}>
      18+ · {NO_GUARANTEE_NOTICE}{extra ? ` · ${extra}` : ''}
    </Text>
  );
}

/* ————————————————————————— STİL ————————————————————————— */

const st = StyleSheet.create({
  // Koyu başlık şeridi: resmî tablonun üst bandı gibi. Sayfa zemininden ayrılır.
  header: {
    backgroundColor: S.head,
    paddingHorizontal: SP.md, paddingTop: SP.sm, paddingBottom: SP.sm,
    gap: 2,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: SP.sm },
  headerLine: { color: '#C9D4DE' },
  mono: {
    backgroundColor: S.accent, alignItems: 'center', justifyContent: 'center', borderRadius: R.sm,
  },
  monoTxt: { color: S.accentInk, letterSpacing: 0.3 },
  brand: { color: S.headInk, letterSpacing: 0.2 },
  brandSub: { color: '#F0A882', letterSpacing: 1.6, marginTop: 1 },

  iconBtn: {
    minWidth: 30, height: 26, paddingHorizontal: 8, borderRadius: R.sm,
    borderWidth: 1, borderColor: '#63758A', backgroundColor: '#4B5E73',
    alignItems: 'center', justifyContent: 'center',
  },
  iconTxt: { color: S.headInk, fontSize: 12 },
  hBtn: {
    height: 26, paddingHorizontal: 9, borderRadius: R.sm,
    borderWidth: 1, borderColor: '#63758A', backgroundColor: '#4B5E73',
    alignItems: 'center', justifyContent: 'center',
  },
  hBtnTxt: { color: S.headInk },

  crestBos: {
    backgroundColor: S.panel3, alignItems: 'center', justifyContent: 'center',
    borderWidth: TABLE.hair, borderColor: S.lineSoft,
  },

  picks: { flexDirection: 'row', alignItems: 'center' },
  pick: {
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderRadius: R.sm,
    backgroundColor: S.panel, borderWidth: 1, borderColor: S.lineStrong,
  },
  pickOn: { backgroundColor: S.accent, borderColor: S.accent },
  pickOff: { opacity: 0.42 },
  pickTxt: { color: S.inkSoft },
  pickTxtOn: { color: S.accentInk },

  chip: {
    borderWidth: TABLE.hair, borderRadius: R.sm, alignSelf: 'flex-start', maxWidth: '100%',
  },
  chipTxt: { letterSpacing: 0.1 },

  track: { width: '100%', backgroundColor: S.lineSoft, overflow: 'hidden', borderRadius: R.sm },

  panel: {
    backgroundColor: S.panel, borderRadius: R.md, borderWidth: TABLE.hair, borderColor: S.line,
    padding: SP.md, gap: SP.sm,
  },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: SP.sm },
  panelTitle: { color: S.ink, letterSpacing: -0.1 },
  panelHint: { color: S.inkDim, lineHeight: 16 },

  state: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 26 },
  stateTitle: { color: S.ink, fontSize: 17, textAlign: 'center' },
  stateText: { color: S.inkSoft, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 19, maxWidth: 520 },
  stateBtn: {
    marginTop: 16, backgroundColor: S.panel, borderWidth: 1, borderColor: S.lineStrong,
    borderRadius: R.sm, paddingVertical: 9, paddingHorizontal: 20,
  },
  stateBtnTxt: { color: S.ink, fontSize: 13 },

  legal: { color: S.inkDim, fontSize: 10.5, textAlign: 'center' },
});

export const studioPartStyles = st;
