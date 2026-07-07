// ESKİ BACKEND ANALİZİ (birebir) — Radar 1'de ve maç detayında kullanılan sabit
// sistem tahmini görünümü: KUPON TAHMİNİ kartı + 🧠 Analiz (Genel Değerlendirme /
// Güçlü Sinyaller / Kupon Yorumu / Risk Notu) + Kazanma İhtimalleri barı.
// Girdi radar item'ının düz alanları: prediction (simge), predictionLabel, predictionReason,
// comment, probabilities, estimated. Veri yoksa ilgili bölüm gösterilmez (uydurma yok).
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme';

const SYMBOL_TR = {
  '1': 'Ev sahibi kazanır', '0': 'Beraberlik', '2': 'Deplasman kazanır',
  '10': 'Ev sahibi kaybetmez', '02': 'Deplasman kaybetmez', '12': 'Beraberlik beklenmez',
  '102': 'Üç ihtimal de açık', '-': 'Veri yok',
};
const SYM_WHO = {
  '1': 'Ev sahibi', '0': 'Beraberlik', '2': 'Deplasman',
  '10': 'Ev / Beraberlik', '02': 'Beraberlik / Dep.', '12': 'Ev / Deplasman', '102': 'Üç ihtimal',
};
// Kupon tipine göre güven/risk seviyesi ve vurgu rengi (MatchDetail PRED_META ile aynı).
const PRED_META = {
  BANKO: { guven: 'Yüksek', risk: 'Kontrollü', color: colors.green },
  NET: { guven: 'Yüksek', risk: 'Düşük', color: colors.primary },
  TEMKİNLİ: { guven: 'Orta', risk: 'Orta', color: colors.yellow },
  ÇİFTE: { guven: 'Orta', risk: 'Orta', color: colors.yellow },
  AÇIK: { guven: 'Düşük', risk: 'Yüksek', color: colors.red },
};

// Teknik terimleri anlaşılır Türkçeye çevir.
const TERM_MAP = [
  [/beklenen gol \(xg\)/gi, 'gol beklentisi'],
  [/\bH2H\b/gi, 'karşılıklı maç geçmişi'],
  [/\bxG\b/gi, 'gol beklentisi'],
  [/\bedge\b/gi, 'avantaj'],
];
const humanize = (t) => { let s = String(t || ''); for (const [re, rep] of TERM_MAP) s = s.replace(re, rep); return s; };
const capTr = (x) => (x ? x.charAt(0).toLocaleUpperCase('tr') + x.slice(1) : x);

// Tahmin gerekçesini madde madde "Güçlü Sinyaller" listesine çevirir.
const buildSinyaller = (reason) => String(reason || '')
  .split(/[;·]/).map((x) => x.trim()).filter((x) => x && !/^oran yok/i.test(x)).map((x) => capTr(humanize(x)));

function buildPickDesc(p) {
  if (!p || p.symbol === '-') return '';
  if (p.label === 'BANKO') return 'Mevcut tablo bu seçeneği güçlü gösteriyor. Risk tamamen sıfır değildir; kontrollü değerlendirilmelidir.';
  if (p.label === 'NET' || p.label === 'TEMKİNLİ') return 'Göstergeler bu yönü destekliyor; risk dengesi makul görünüyor.';
  return 'Sonuç net değil; bu seçenek riski daha dengeli dağıtıyor.';
}
function buildKuponYorumu(p) {
  if (!p || p.symbol === '-') return '';
  const mean = p.meaning || '';
  if (p.label === 'BANKO') return `${mean} seçeneği güçlü şekilde öne çıkıyor. Yine de geçmiş karşılaşmalardaki denge göz önünde bulundurularak kontrollü değerlendirilmeli.`;
  if (p.label === 'NET' || p.label === 'TEMKİNLİ') return `${mean} seçeneği öne çıkıyor; risk dengesi makul görünüyor.`;
  return `Tek bir sonuç net değil; "${mean}" tercihiyle riski dağıtmak daha mantıklı.`;
}
function buildRiskNotu(score) {
  if (score == null) return '';
  if (score < 25) return 'Risk seviyesi düşük — dengeli ve güçlü bir görünüm.';
  if (score <= 45) return 'Risk seviyesi orta — sonuç tartışmaya açık, kontrollü ilerleyin.';
  return 'Risk seviyesi yüksek — sürprize oldukça açık bir maç.';
}

function ProbBars({ probabilities }) {
  if (!probabilities) return <Text style={styles.muted}>Oran yok</Text>;
  const segs = [
    { k: '1', v: probabilities['1'], c: colors.primary },
    { k: 'X', v: probabilities['X'], c: colors.gray },
    { k: '2', v: probabilities['2'], c: colors.yellow },
  ];
  return (
    <View style={styles.pbWrap}>
      {segs.map((s) => (
        <View key={s.k} style={[styles.pbSeg, { flex: Math.max(s.v || 0, 1), backgroundColor: s.c }]}>
          <Text style={styles.pbK}>{s.k}</Text>
          <Text style={styles.pbV}>%{s.v}</Text>
        </View>
      ))}
    </View>
  );
}

export default function BackendMatchAnalysis({ prediction, label, reason, comment, probabilities, estimated, surpriseScore }) {
  const sym = prediction && prediction !== '-' ? String(prediction) : null;
  const p = sym ? { symbol: sym, meaning: SYMBOL_TR[sym] || '', label } : null;
  const pmeta = (label && PRED_META[label]) || { guven: '—', risk: '—', color: colors.gray };
  const pickDesc = buildPickDesc(p);
  const sinyaller = buildSinyaller(reason);
  const kuponYorumu = buildKuponYorumu(p);
  const riskNotu = buildRiskNotu(surpriseScore);

  return (
    <View>
      {/* Kupon Tahmini — premium karar kartı */}
      {p ? (
        <View style={[styles.predCard, { borderLeftColor: pmeta.color }]}>
          <View style={styles.pcTop}>
            <View style={styles.pcLeft}>
              <View style={[styles.pcSymbol, { borderColor: pmeta.color }]}>
                <Text style={[styles.pcSymbolTxt, { color: pmeta.color }]}>{p.symbol}</Text>
              </View>
              <Text style={styles.pcWho}>{SYM_WHO[p.symbol] || ''}</Text>
            </View>
            <View style={styles.pcMid}>
              <Text style={styles.pcKicker}>KUPON TAHMİNİ</Text>
              <Text style={styles.pcMain}>{p.meaning}</Text>
              {pickDesc ? <Text style={styles.pcDesc}>{pickDesc}</Text> : null}
              {sinyaller.slice(0, 3).map((sg, i) => (
                <Text key={i} style={styles.pcBullet}>•  {sg}</Text>
              ))}
            </View>
          </View>
          <View style={styles.pcRight}>
            <View style={[styles.pcBadge, { backgroundColor: pmeta.color + '22', borderColor: pmeta.color }]}>
              <Text style={[styles.pcBadgeTxt, { color: pmeta.color }]}>{label}</Text>
            </View>
            <View style={styles.pcMetaRow}><Text style={styles.pcMetaK}>Güven</Text><Text style={styles.pcMetaV}>{pmeta.guven}</Text></View>
            <View style={styles.pcMetaRow}><Text style={styles.pcMetaK}>Risk</Text><Text style={styles.pcMetaV}>{pmeta.risk}</Text></View>
          </View>
        </View>
      ) : null}

      {/* Analiz — profesyonel, çok bölümlü */}
      <View style={styles.commentCard}>
        <Text style={styles.commentLabel}>🧠 Analiz</Text>

        {comment ? (
          <>
            <Text style={styles.aSub}>Genel Değerlendirme</Text>
            <Text style={styles.comment}>{humanize(comment)}</Text>
          </>
        ) : null}

        {sinyaller.length > 0 && (
          <>
            <Text style={styles.aSub}>Güçlü Sinyaller</Text>
            {sinyaller.map((sg, i) => (
              <Text key={i} style={styles.aBullet}>•  {sg}</Text>
            ))}
          </>
        )}

        {kuponYorumu ? (
          <>
            <Text style={styles.aSub}>Kupon Yorumu</Text>
            <Text style={styles.comment}>{kuponYorumu}</Text>
          </>
        ) : null}

        {riskNotu ? (
          <>
            <Text style={styles.aSub}>Risk Notu</Text>
            <Text style={styles.comment}>{riskNotu}</Text>
          </>
        ) : null}
      </View>

      {/* İhtimaller */}
      {probabilities ? (
        <>
          <Text style={styles.sectionTitle}>Kazanma İhtimalleri</Text>
          <View style={styles.probCard}>
            <ProbBars probabilities={probabilities} />
            {estimated && <Text style={styles.estNote}>≈ tahmini (oran yok, form + gol beklentisinden)</Text>}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  predCard: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.md,
    backgroundColor: colors.cardAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    borderLeftWidth: 4, padding: spacing.lg, marginTop: spacing.lg,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  pcTop: { flex: 1, minWidth: 240, flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  pcLeft: { width: 60, alignItems: 'center', justifyContent: 'center' },
  pcSymbol: { width: 56, height: 56, borderRadius: radius.md, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  pcSymbolTxt: { fontSize: 24, fontWeight: '900', letterSpacing: 0.5 },
  pcWho: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 5, textAlign: 'center' },
  pcMid: { flex: 1, justifyContent: 'center' },
  pcKicker: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  pcMain: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: 2 },
  pcDesc: { color: colors.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: 5 },
  pcBullet: { color: colors.text, fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  pcRight: { minWidth: 132, justifyContent: 'center', gap: 7, paddingLeft: spacing.sm },
  pcBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.sm, borderWidth: 1.5 },
  pcBadgeTxt: { fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  pcMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  pcMetaK: { color: colors.textMuted, fontSize: 12.5 },
  pcMetaV: { color: colors.text, fontSize: 12.5, fontWeight: '800' },

  commentCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.lg },
  commentLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  comment: { color: colors.text, fontSize: 15, lineHeight: 22 },
  aSub: { color: colors.primary, fontSize: 13, fontWeight: '800', marginTop: spacing.md, marginBottom: 4 },
  aBullet: { color: colors.text, fontSize: 14, lineHeight: 21, marginBottom: 3 },

  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: spacing.xl, marginBottom: spacing.sm },
  probCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg },
  pbWrap: { flexDirection: 'row', height: 46, borderRadius: 10, overflow: 'hidden', gap: 3 },
  pbSeg: { alignItems: 'center', justifyContent: 'center' },
  pbK: { color: colors.bg, fontSize: 12, fontWeight: '900' },
  pbV: { color: colors.bg, fontSize: 14, fontWeight: '800', marginTop: 1 },
  estNote: { color: colors.textMuted, fontSize: 11, fontStyle: 'italic', marginTop: 8 },
  muted: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm, lineHeight: 18 },
});
