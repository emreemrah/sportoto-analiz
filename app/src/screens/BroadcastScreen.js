// YAYIN MODU — canlı yayın / OBS kadrajı için tek düğmelik sunum ekranı.
//
// NEDEN VAR: Yayıncı segmenti ("bu hafta 3 güçlü aday var") anlatırken normal
// uygulama ekranı işe yaramaz — punto küçük, arka plan beyaz (stüdyoda patlar),
// alt sekme çubuğu kadrajı kirletir ve kaydırmak zorunda kalırsın.
// Bu ekran: KOYU + YÜKSEK KONTRAST + BÜYÜK PUNTO + slayt slayt + sekmesiz.
//
// KESİN KURALLAR
//   • Tüm içerik GERÇEK bültenden gelir (broadcast.js — saf, testli). Uydurma yok.
//   • Veri yoksa dürüstçe "gösterilecek analiz yok" denir; sahte slayt üretilmez.
//   • KİŞİSEL VERİ YOK: bu ekranı on binlerce kişi görüyor. Kullanıcı adı,
//     e-posta, belirteç, kupon veya puan bu ekrana hiçbir yoldan girmez —
//     buildBroadcastSlides yalnız bülteni alır.
//   • Satırlar TIKLANMAZ. Yayında kazara başka ekrana atlamak felakettir.
//   • Yasal uyarı (18+ / kesin sonuç vaadi değildir) her slaytta görünür kalır.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, useWindowDimensions,
} from 'react-native';
import { api } from '../api';
import { BRAND_LINE_1, BRAND_LINE_2, LEGAL_FOOTER } from '../brand';
import { buildBroadcastSlides, clampIndex, SCALES, DEFAULT_SCALE_INDEX } from '../broadcast';

// —— Yayın paleti: koyu tema burada YAŞAR (B5). Uygulamanın geri kalanı
//    değişmez; stüdyo ekranı ayrı bir yüzeydir, global tema riski alınmaz.
const BG = '#05070D';         // neredeyse siyah — OBS'te en temiz zemin
const PANEL = '#0D1526';
const PANEL_2 = '#121C31';
const LINE = '#22344F';
const INK = '#FFFFFF';
const INK_SOFT = '#A9BCD8';
const AMBER = '#FFB35C';
const GOOD = '#5DD39E';
const BAD = '#FF7A6E';

const TONE = { good: GOOD, bad: BAD, warn: AMBER, neutral: INK };

// Yığın ekranlarının web'de ortalanmış 1140px gövdesi vardır; yayın modunda bu
// iki yanda AÇIK RENK şerit bırakır — OBS kadrajında tam da kaçınmak istediğimiz
// şey. Bu ekran uçtan uca ve koyu olmalı, o yüzden gövde stili burada ezilir.
export const BROADCAST_CONTENT_STYLE = {
  width: '100%',
  maxWidth: undefined,
  alignSelf: 'stretch',
  backgroundColor: BG,
};

export default function BroadcastScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [i, setI] = useState(0);
  const [scaleIdx, setScaleIdx] = useState(DEFAULT_SCALE_INDEX);
  const { width } = useWindowDimensions();

  const load = useCallback(async () => {
    try { setError(null); setData(await api.bulletin()); }
    catch (e) { setError(e?.message || 'Bülten alınamadı.'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const slides = useMemo(() => (data ? buildBroadcastSlides(data) : []), [data]);
  const idx = clampIndex(i, slides.length);
  const slide = slides[idx] || null;

  const cikis = useCallback(() => {
    if (navigation?.canGoBack?.()) navigation.goBack();
    else navigation?.navigate?.('Home');
  }, [navigation]);

  const git = useCallback((adim) => setI((v) => clampIndex(v + adim, slides.length)), [slides.length]);

  // Klavye ile sürüş — yayıncı sunum kumandası/klavye ile ilerler.
  // YALNIZ web'de: mobilde window/keydown yoktur, yeni paket de kurulmaz.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const onKey = (e) => {
      const k = e.key;
      if (k === 'ArrowRight' || k === 'PageDown' || k === ' ') { e.preventDefault(); git(1); }
      else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); git(-1); }
      else if (k === 'Escape') { e.preventDefault(); cikis(); }
      else if (k === 'Home') { e.preventDefault(); setI(0); }
      else if (k === 'End') { e.preventDefault(); setI(slides.length - 1); }
      else if (k === '+' || k === '=') { setScaleIdx((v) => Math.min(SCALES.length - 1, v + 1)); }
      else if (k === '-' || k === '_') { setScaleIdx((v) => Math.max(0, v - 1)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [git, cikis, slides.length]);

  // Punto ölçeği ekran genişliğine göre uyarlanır:
  //   • ≥1100px — asıl hedef (OBS 1920 kadrajı): en büyük punto.
  //   • 560–1100px — temel ölçek.
  //   • <560px (telefon) — yayın puntosu olduğu gibi sığmaz; taban küçültülür,
  //     yoksa takım adı ikiye bölünüp satırlar üst üste biner. A+ ile yine
  //     büyütülebilir; kullanıcı isterse eski ölçeğe çıkabilir.
  const dar = width < 560;
  const k = SCALES[clampIndex(scaleIdx, SCALES.length)] * (width >= 1100 ? 1.15 : dar ? 0.72 : 1);
  const f = (n) => Math.round(n * k);

  return (
    <View style={st.root} testID="broadcast-root">
      {/* ——— ÜST ÇUBUK: yayında kadrajın dışında kalabilecek kadar ince ——— */}
      <View style={st.topBar}>
        <TouchableOpacity onPress={cikis} style={st.iconBtn} activeOpacity={0.8} accessibilityLabel="Yayın modundan çık">
          <Text style={st.iconTxt}>✕</Text>
        </TouchableOpacity>

        <View style={st.topMid}>
          <Text style={st.topBrand} numberOfLines={1}>
            {BRAND_LINE_1} <Text style={{ color: AMBER }}>{BRAND_LINE_2}</Text>
          </Text>
          <Text style={st.topMode}>YAYIN MODU</Text>
        </View>

        <View style={st.topRight}>
          <TouchableOpacity
            onPress={() => setScaleIdx((v) => Math.max(0, v - 1))}
            style={[st.iconBtn, scaleIdx === 0 && st.iconBtnOff]}
            activeOpacity={0.8}
            accessibilityLabel="Yazıyı küçült"
          >
            <Text style={st.iconTxt}>A−</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setScaleIdx((v) => Math.min(SCALES.length - 1, v + 1))}
            style={[st.iconBtn, scaleIdx === SCALES.length - 1 && st.iconBtnOff]}
            activeOpacity={0.8}
            accessibilityLabel="Yazıyı büyült"
          >
            <Text style={st.iconTxt}>A+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ——— GÖVDE ——— */}
      {error ? (
        <Durum
          baslik="Bülten alınamadı"
          metin={error}
          eylem="Tekrar Dene"
          onPress={load}
        />
      ) : !data ? (
        <Durum baslik="Yayın hazırlanıyor…" metin="Hafta verisi alınıyor." />
      ) : !slides.length ? (
        // DÜRÜST BOŞ DURUM: slayt uydurmaktansa hiç göstermemek doğrudur.
        <Durum
          baslik="Gösterilecek analiz yok"
          metin="Bu hafta için analizli maç bulunmuyor. Yayın modu veri olmadan slayt üretmez; uydurma aday gösterilmez."
          eylem="Yenile"
          onPress={load}
        />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[st.body, { paddingHorizontal: width >= 900 ? 48 : 18 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[st.stage, { maxWidth: width >= 1100 ? 1180 : 820 }]}>
            <Text style={[st.kicker, { fontSize: f(13), letterSpacing: f(3) / 2 }]}>{slide.kicker}</Text>
            <Text style={[st.title, { fontSize: f(34), lineHeight: f(42) }]} testID="broadcast-title">{slide.title}</Text>
            {slide.subtitle ? (
              <Text style={[st.subtitle, { fontSize: f(16) }]}>{slide.subtitle}</Text>
            ) : null}

            {slide.kind === 'intro' ? <Acilis slide={slide} f={f} /> : null}
            {slide.kind === 'list' ? <Liste slide={slide} f={f} dar={dar} /> : null}
            {slide.kind === 'outro' ? <Kapanis slide={slide} f={f} /> : null}
          </View>
        </ScrollView>
      )}

      {/* ——— ALT ÇUBUK: gezinme + her slaytta duran yasal şerit ——— */}
      <View style={st.bottomBar}>
        {slides.length ? (
          <View style={st.navRow}>
            <TouchableOpacity
              onPress={() => git(-1)}
              disabled={idx === 0}
              style={[st.navBtn, idx === 0 && st.navBtnOff]}
              activeOpacity={0.85}
              accessibilityLabel="Önceki slayt"
            >
              <Text style={st.navTxt}>‹ Geri</Text>
            </TouchableOpacity>

            <View style={st.dots}>
              {slides.map((s, n) => (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => setI(n)}
                  style={[st.dot, n === idx && st.dotOn]}
                  activeOpacity={0.7}
                  accessibilityLabel={`${n + 1}. slayt`}
                />
              ))}
              {/* testID: doğrulama betiği sayacı zorluk metnindeki "68/100"
                  gibi sayılarla karıştırmasın diye. */}
              <Text style={st.counter} testID="broadcast-counter">{idx + 1}/{slides.length}</Text>
            </View>

            <TouchableOpacity
              onPress={() => git(1)}
              disabled={idx === slides.length - 1}
              style={[st.navBtn, idx === slides.length - 1 && st.navBtnOff]}
              activeOpacity={0.85}
              accessibilityLabel="Sonraki slayt"
            >
              <Text style={st.navTxt}>İleri ›</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={st.legal}>{LEGAL_FOOTER}</Text>
        {Platform.OS === 'web' ? (
          <Text style={st.hint}>Klavye: ← →  slayt · +/−  punto · Esc  çıkış</Text>
        ) : null}
      </View>
    </View>
  );
}

/* ————————————————— SLAYT TÜRLERİ ————————————————— */

function Acilis({ slide, f }) {
  const d = slide.difficulty;
  const renk = d ? (d.score < 30 ? GOOD : d.score < 50 ? AMBER : BAD) : INK_SOFT;
  return (
    <View style={{ width: '100%' }}>
      <View style={st.statRow}>
        {slide.stats.map((s) => (
          <View key={s.label} style={st.statBox}>
            <Text style={[st.statN, { color: TONE[s.tone] || INK, fontSize: f(46) }]}>{s.n}</Text>
            <Text style={[st.statL, { fontSize: f(13) }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {d ? (
        <View style={st.diffBox}>
          <View style={st.diffHead}>
            <Text style={[st.diffLabel, { fontSize: f(14) }]}>Bülten zorluğu</Text>
            <Text style={[st.diffVal, { color: renk, fontSize: f(18) }]}>{d.level} · {d.score}/100</Text>
          </View>
          <View style={st.diffTrack}>
            <View style={[st.diffFill, { width: `${Math.min(100, Math.max(0, d.score))}%`, backgroundColor: renk }]} />
          </View>
          {d.text ? <Text style={[st.diffTxt, { fontSize: f(14), lineHeight: f(21) }]}>{d.text}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

function Liste({ slide, f, dar }) {
  // Dar telefonda satır içi boşluklar takım adına yer bırakmıyor; iç dolgu ve
  // aradaki boşluk kısılır. Geniş kadrajda (yayının asıl hedefi) hiçbir şey değişmez.
  const rowStyle = dar ? [st.row, { gap: 8, paddingHorizontal: 12, paddingVertical: 12 }] : st.row;
  return (
    <View style={{ width: '100%', marginTop: 22 }}>
      {slide.rows.length ? slide.rows.map((r) => (
        // Bilerek TouchableOpacity değil: yayında kazara dokunup başka ekrana
        // düşmek kadrajı bozar. Bu ekran yalnız gösterim yüzeyidir.
        <View key={r.no} style={rowStyle}>
          <Text style={[st.rowNo, { fontSize: f(18), width: f(dar ? 26 : 40) }]}>{r.no}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[st.rowTeams, { fontSize: f(24), lineHeight: f(31) }]} numberOfLines={2}>{r.teams}</Text>
            <Text style={[st.rowSub, { fontSize: f(14), lineHeight: f(20) }]}>{r.sub}</Text>
          </View>
          {r.pick ? (
            <View style={[st.pill, dar && st.pillDar, { borderColor: TONE[r.tone], backgroundColor: `${TONE[r.tone]}1F` }]}>
              <Text style={[st.pillPick, { color: TONE[r.tone], fontSize: f(28) }]}>{r.pick}</Text>
              {r.percent != null ? (
                <Text style={[st.pillPct, { color: TONE[r.tone], fontSize: f(15) }]}>%{r.percent}</Text>
              ) : null}
            </View>
          ) : r.badge ? (
            <View style={[st.pill, dar && st.pillDar, { borderColor: TONE[r.tone], backgroundColor: `${TONE[r.tone]}1F` }]}>
              <Text style={[st.pillPct, { color: TONE[r.tone], fontSize: f(16) }]}>{r.badge}</Text>
            </View>
          ) : null}
        </View>
      )) : (
        <View style={st.emptyBox}>
          <Text style={[st.emptyTxt, { fontSize: f(18), lineHeight: f(27) }]}>{slide.emptyText}</Text>
        </View>
      )}

      {slide.note ? <Text style={[st.note, { fontSize: f(14) }]}>ℹ️ {slide.note}</Text> : null}
    </View>
  );
}

function Kapanis({ slide, f }) {
  return (
    <View style={{ width: '100%', marginTop: 26 }}>
      {slide.lines.map((l) => (
        <View key={l} style={st.legalRow}>
          <View style={st.legalDot} />
          <Text style={[st.legalLine, { fontSize: f(18), lineHeight: f(27) }]}>{l}</Text>
        </View>
      ))}
    </View>
  );
}

function Durum({ baslik, metin, eylem, onPress }) {
  return (
    <View style={st.durum}>
      <Text style={st.durumBaslik}>{baslik}</Text>
      <Text style={st.durumMetin}>{metin}</Text>
      {eylem ? (
        <TouchableOpacity style={st.durumBtn} onPress={onPress} activeOpacity={0.85}>
          <Text style={st.durumBtnTxt}>{eylem}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/* ————————————————— STİL ————————————————— */

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: LINE,
  },
  topMid: { flex: 1, alignItems: 'center' },
  topBrand: { color: INK, fontSize: 15, fontWeight: '900', letterSpacing: -0.2 },
  topMode: { color: INK_SOFT, fontSize: 10, fontWeight: '900', letterSpacing: 2.4, marginTop: 1 },
  topRight: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    minWidth: 40, height: 36, paddingHorizontal: 10, borderRadius: 10,
    backgroundColor: PANEL, borderWidth: 1, borderColor: LINE,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnOff: { opacity: 0.35 },
  iconTxt: { color: INK, fontSize: 15, fontWeight: '900' },

  body: { paddingTop: 26, paddingBottom: 30, alignItems: 'center' },
  stage: { width: '100%' },

  kicker: { color: AMBER, fontWeight: '900' },
  title: { color: INK, fontWeight: '900', marginTop: 8, letterSpacing: -0.6 },
  subtitle: { color: INK_SOFT, fontWeight: '800', marginTop: 8 },

  statRow: { flexDirection: 'row', gap: 12, marginTop: 26, flexWrap: 'wrap' },
  statBox: {
    flexGrow: 1, flexBasis: 130, backgroundColor: PANEL, borderRadius: 16,
    borderWidth: 1, borderColor: LINE, alignItems: 'center', paddingVertical: 20,
  },
  statN: { fontWeight: '900' },
  statL: { color: INK_SOFT, fontWeight: '900', marginTop: 4, letterSpacing: 0.4 },

  diffBox: { backgroundColor: PANEL, borderRadius: 16, borderWidth: 1, borderColor: LINE, padding: 18, marginTop: 16 },
  diffHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  diffLabel: { color: INK_SOFT, fontWeight: '800' },
  diffVal: { fontWeight: '900' },
  diffTrack: { height: 12, backgroundColor: LINE, borderRadius: 7, overflow: 'hidden', marginTop: 12 },
  diffFill: { height: 12, borderRadius: 7 },
  diffTxt: { color: INK_SOFT, marginTop: 12 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: PANEL, borderRadius: 16, borderWidth: 1, borderColor: LINE,
    paddingVertical: 16, paddingHorizontal: 18, marginBottom: 12,
  },
  rowNo: { color: INK_SOFT, fontWeight: '900', textAlign: 'center' },
  rowTeams: { color: INK, fontWeight: '900', letterSpacing: -0.3 },
  rowSub: { color: INK_SOFT, fontWeight: '700', marginTop: 5 },
  pill: { borderRadius: 14, borderWidth: 2, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', minWidth: 84 },
  pillDar: { paddingHorizontal: 10, paddingVertical: 8, minWidth: 58 },
  pillPick: { fontWeight: '900' },
  pillPct: { fontWeight: '900', marginTop: 2 },

  emptyBox: { backgroundColor: PANEL_2, borderRadius: 16, borderWidth: 1, borderColor: LINE, borderStyle: 'dashed', padding: 22 },
  emptyTxt: { color: INK_SOFT, fontWeight: '700', fontStyle: 'italic' },
  note: { color: INK_SOFT, fontWeight: '700', marginTop: 12, fontStyle: 'italic' },

  legalRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 14 },
  legalDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: AMBER, marginTop: 8 },
  legalLine: { color: INK, fontWeight: '700', flex: 1 },

  bottomBar: { borderTopWidth: 1, borderTopColor: LINE, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14, gap: 8 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  navBtn: { backgroundColor: PANEL, borderWidth: 1, borderColor: LINE, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 22 },
  navBtnOff: { opacity: 0.3 },
  navTxt: { color: INK, fontSize: 16, fontWeight: '900' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: LINE },
  dotOn: { backgroundColor: AMBER, width: 22 },
  counter: { color: INK_SOFT, fontSize: 12, fontWeight: '900', marginLeft: 6 },

  legal: { color: '#8FA3BD', fontSize: 11.5, fontStyle: 'italic', textAlign: 'center' },
  hint: { color: '#6E829E', fontSize: 10.5, textAlign: 'center' },

  durum: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  durumBaslik: { color: INK, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  durumMetin: { color: INK_SOFT, fontSize: 15, textAlign: 'center', marginTop: 12, lineHeight: 22, maxWidth: 560 },
  durumBtn: { marginTop: 22, backgroundColor: PANEL, borderWidth: 1, borderColor: LINE, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28 },
  durumBtnTxt: { color: INK, fontSize: 15, fontWeight: '900' },
});
