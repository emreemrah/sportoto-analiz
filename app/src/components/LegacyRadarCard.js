// LEGACY SÜRPRİZ RADARI KARTI — Radar Merkezi ÖNCESİ haftaların görünümü.
//
// BU KOD DONMUŞTUR. Eski haftalar kullanıcıya o hafta göründüğü gibi
// gösterilmelidir; yeni sistemin dili, rozetleri veya hesapları buraya
// SIZDIRILMAZ. Geriye dönük "iyileştirme" yapılırsa arşiv, gerçekte hiç
// var olmamış bir görüntüyü sunmaya başlar.
//
// Ekrandan ayrılma nedeni sadece boyut değil: karışmaması gereken iki sistem
// aynı dosyada durdukça, birinde yapılan bir düzeltme kazara diğerine
// geçebiliyordu.
//
// Yeni başlangıç kararı gereği bu görünümde de BAŞARI YÜZDESİ yoktur; yalnız
// o haftanın kendi mühürlü çıktısı ve (varsa) resmî sonucu görünür.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius, labelColors } from '../theme';
// Not: paylaşılan rozetler src/components.js DOSYASINDA (bu klasörde değil).
import { SurpriseBadge, FormStrip } from '../components';
import VenueMark from './VenueMark';
import { ord, wdl, num1 } from '../radarScreenData';

/**
 * @param item        legacy radar satırı (eski arşiv biçimi)
 * @param index       liste sırası (kart numarası)
 * @param legacyView  'r1' (tam kart) | diğer (yalnız sinyal satırı)
 * @param expanded    kart açık mı
 */
export default function LegacyRadarCard({
  item, index, legacyView, expanded, onToggle, onDetail,
}) {
  const c = labelColors[item.labelColor] || colors.gray;
  const p = item.probabilities || null;
  const sig = item.signals || null;
  const factors = item.factors || [];

  // Sinyal özeti: yalnız GERÇEKTEN gelen alanlar yazılır. Eksik olan sessizce
  // atlanır — yerine sıfır/tire basılmaz (num1 null döner, satır düşer).
  const bits = [];
  if (sig?.position) bits.push(`Sıra ${ord(sig.position.home)} – ${ord(sig.position.away)}`);
  if (sig?.venue && (sig.venue.home || sig.venue.away)) bits.push(`İç/Dış ${wdl(sig.venue.home) || '—'} · ${wdl(sig.venue.away) || '—'}`);
  if (sig?.xg) {
    const xh = num1(sig.xg.homeVenue ?? sig.xg.home);
    const xa = num1(sig.xg.awayVenue ?? sig.xg.away);
    if (xh != null && xa != null) bits.push(`xG ${xh} – ${xa}`);
  }
  if (sig?.goals) {
    const gh = num1(sig.goals.home?.for);
    const ga = num1(sig.goals.away?.for);
    if (gh != null && ga != null) bits.push(`Gol/maç ${gh} – ${ga}`);
  }

  return (
    <TouchableOpacity style={[styles.row, expanded && styles.rowExpanded]} activeOpacity={0.8} onPress={onToggle}>
      <View style={styles.topRow}>
        <Text style={styles.rank}>{index + 1}</Text>
        <View style={{ flex: 1 }}>
          <View style={styles.teamsRow}>
            <VenueMark side="home" size={14} />
            <Text style={[styles.teams, styles.teamName]} numberOfLines={1}>{item.home}</Text>
            <Text style={styles.teamsVs}>–</Text>
            <VenueMark side="away" size={14} />
            <Text style={[styles.teams, styles.teamName]} numberOfLines={1}>{item.away}</Text>
          </View>
          <View style={styles.scoreBar}>
            <View style={{ width: `${item.surpriseScore}%`, height: 6, backgroundColor: c, borderRadius: 3 }} />
          </View>
        </View>
        <View style={styles.right}>
          <Text style={[styles.scoreNum, { color: c }]}>{item.surpriseScore}</Text>
          <SurpriseBadge label={item.label} labelColor={item.labelColor} small />
        </View>
      </View>

      {item.result && item.score ? (
        <View style={styles.resultRow}>
          <Text style={styles.resultTxt}>Sonuç: <Text style={styles.resultStrong}>{item.result}</Text> · {item.score.home}-{item.score.away}</Text>
          {item.favHit != null ? (
            <View style={[styles.hitPill, { backgroundColor: item.favHit ? colors.success : colors.danger }]}>
              <Text style={styles.hitPillTxt}>{item.favHit ? '✓ Favori tuttu' : '✗ Sürpriz oldu'}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {legacyView === 'r1' ? (
        <>
          {(item.favorite || p) && (
            <View style={styles.favRow}>
              {item.favorite ? (
                <View style={styles.favPill}>
                  {/* "≈": yüzde ORANDAN değil formdan türetilmiş. Bu işaret
                      kaldırılırsa tahmini sayı piyasa oranı sanılır. */}
                  <Text style={styles.favPillTxt}>Favori {item.favorite.symbol} · %{item.favorite.percent}{item.estimated ? ' ≈' : ''}</Text>
                </View>
              ) : null}
              {p ? <Text style={styles.probs}>1 %{p['1']} · X %{p['X']} · 2 %{p['2']}</Text> : null}
            </View>
          )}
          {bits.length > 0 && <Text style={styles.signals} numberOfLines={expanded ? 2 : 1}>{bits.join('   ·   ')}</Text>}
          {sig?.form && (sig.form.home?.length || sig.form.away?.length) ? (
            <View style={styles.formRow}>
              <Text style={styles.formLbl}>Form</Text>
              <FormStrip form={sig.form.home} size={16} />
              <Text style={styles.formSep}>—</Text>
              <FormStrip form={sig.form.away} size={16} />
            </View>
          ) : null}
          {factors.length > 0 && (
            <View style={styles.factors}>
              {(expanded ? factors : factors.slice(0, 3)).map((f, i) => (
                <Text key={i} style={styles.factorTxt} numberOfLines={1}>• {f.label} <Text style={styles.factorPts}>+{f.points}</Text></Text>
              ))}
            </View>
          )}
          {item.comment ? <Text style={styles.comment} numberOfLines={expanded ? 0 : 2}>{item.comment}</Text> : null}
        </>
      ) : (
        <>
          {bits.length > 0 ? (
            <Text style={styles.signals} numberOfLines={2}>{bits.join('   ·   ')}</Text>
          ) : <Text style={styles.signals}>İstatistik verisi bulunamadı.</Text>}
        </>
      )}

      <View style={styles.actionRow}>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={onDetail} style={styles.detailBtn} activeOpacity={0.85}>
          <Text style={styles.detailBtnTxt}>Analiz ›</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  rowExpanded: { borderWidth: 1.5, borderColor: colors.primary },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rank: { color: colors.textMuted, fontSize: 16, fontWeight: '800', width: 22, textAlign: 'center' },
  teams: { color: colors.text, fontSize: 14, fontWeight: '700' },
  teamsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  teamName: { flexShrink: 1 },
  teamsVs: { color: colors.textMuted, fontSize: 13, fontWeight: '700', marginHorizontal: 1 },
  scoreBar: { marginTop: 6, height: 6, backgroundColor: colors.cardAlt, borderRadius: 3, overflow: 'hidden' },
  right: { alignItems: 'flex-end', gap: 4 },
  scoreNum: { fontSize: 18, fontWeight: '900' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  resultTxt: { color: colors.textSoft, fontSize: 12, fontWeight: '700' },
  resultStrong: { color: colors.text, fontWeight: '900' },
  hitPill: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  hitPillTxt: { color: '#fff', fontSize: 10.5, fontWeight: '900' },
  favRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  favPill: { backgroundColor: colors.cardAlt, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  favPillTxt: { color: colors.text, fontSize: 11.5, fontWeight: '900' },
  probs: { color: colors.textSoft, fontSize: 11.5, fontWeight: '700' },
  signals: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 7 },
  formRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 },
  formLbl: { color: colors.textMuted, fontSize: 10.5, fontWeight: '800' },
  formSep: { color: colors.textMuted, fontSize: 10 },
  factors: { marginTop: 7, gap: 2 },
  factorTxt: { color: colors.textSoft, fontSize: 11.5, fontWeight: '600', lineHeight: 16 },
  factorPts: { color: colors.warning, fontWeight: '900' },
  comment: { color: colors.textMuted, fontSize: 11, fontStyle: 'italic', lineHeight: 15, marginTop: 7 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  detailBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.sm, backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border },
  detailBtnTxt: { color: colors.textSoft, fontSize: 11.5, fontWeight: '800' },
});
