// RADAR MERKEZİ KARTLARI — RadarScreen'in yeni görünüm bileşenleri.
// Mevcut tasarım dili (beyaz/lacivert/kırmızı, kart + pill + ince bar) korunur.
// Veri yoksa alan çizilmez; "veri yok" durumları açıkça yazılır (uydurma yok).
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme';

// Kullanıcı dili sadeleştirmesi: "Orta Risk"→"Temkinli", "Sürpriz Adayı"→
// "Sürpriz Sinyali", "Yetersiz Veri"→"Analiz Hazır Değil" (anahtarlar aynı).
export const CLASS_META = {
  strong_candidate: { label: 'Güçlü Aday', color: colors.success, soft: colors.successSoft, icon: '🟢' },
  medium_risk: { label: 'Temkinli', color: colors.warning, soft: colors.warningSoft, icon: '🟡' },
  surprise_candidate: { label: 'Sürpriz Sinyali', color: colors.danger, soft: colors.dangerSoft, icon: '🔴' },
  insufficient_data: { label: 'Analiz Hazır Değil', color: colors.muted, soft: colors.surfaceSoft, icon: '⚪' },
};

export const RADAR_TAB_DEFS = [
  { k: 'master', label: 'Master', sub: 'Birleşik' },
  { k: 'performance', label: 'Radar 1', sub: 'Rakip Gücü' },
  { k: 'expectation', label: 'Radar 2', sub: 'xG' },
  { k: 'publicBetting', label: 'Radar 3', sub: 'Oynanma DNA' },
  { k: 'market', label: 'Radar 4', sub: 'Oran Takibi' },
  { k: 'bulletinMemory', label: 'Radar 5', sub: 'Bülten DNA' },
];

// "Kullanılan veriler" satırı — hangi veri ailelerinin AKTİF olduğu açıkça yazılır.
const DATA_SOURCE_LABELS = {
  performance: 'Form · Rakip Seviyesi',
  expectation: 'xG',
  publicBetting: 'Oynanma DNA',
  market: 'Oran Takibi',
  bulletinMemory: 'Bülten Hafızası',
};
export function usedDataLine(radars) {
  const used = Object.entries(DATA_SOURCE_LABELS)
    .filter(([k]) => radars?.[k]?.hasData)
    .map(([, v]) => v);
  return used.length ? `Kullanılan veriler: ${used.join(' · ')}` : null;
}

const fmtTime = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function ClassPill({ classification, small }) {
  const meta = CLASS_META[classification] || CLASS_META.insufficient_data;
  return (
    <View style={[st.classPill, { backgroundColor: meta.soft, borderColor: meta.color }, small && { paddingVertical: 2 }]}>
      <Text style={[st.classPillTxt, { color: meta.color }]}>{meta.icon} {meta.label}</Text>
    </View>
  );
}

function MetaChip({ label, value, tone }) {
  return (
    <View style={st.metaChip}>
      <Text style={st.metaChipLbl}>{label}</Text>
      <Text style={[st.metaChipVal, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

// Radar satırı (detay panelinde): ad + skorlar/yön + veri kalitesi VEYA durum.
function RadarRow({ r }) {
  if (!r) return null;
  return (
    <View style={st.radarRow}>
      <View style={{ flex: 1 }}>
        <Text style={st.radarRowName}>{r.name}</Text>
        {r.hasData ? (
          <Text style={st.radarRowLine}>
            {r.homeScore != null ? `1 %${r.homeScore} · X %${r.drawScore} · 2 %${r.awayScore}` : 'Yön puanı üretmez (yardımcı sinyal)'}
            {r.favoriteFailureRisk != null ? ` · Risk sinyali ${r.favoriteFailureRisk}` : ''}
          </Text>
        ) : (
          <Text style={st.radarRowOff}>{r.status === 'no_source' ? '⏳ Veri kaynağı bekleniyor' : '— Veri yetersiz'}{r.note ? ` · ${r.note}` : ''}</Text>
        )}
      </View>
      {r.hasData ? <Text style={st.radarRowDq}>Veri %{r.dataQuality}</Text> : null}
    </View>
  );
}

// MASTER KART — 15 maçlık listede her maç.
export function MasterMatchCard({ item, expanded, onToggle, onDetail, pickRow, sealed }) {
  const m = item.master || {};
  const risk = m.favoriteFailureRisk;
  const meta = CLASS_META[m.classification] || CLASS_META.insufficient_data;
  const reasons = [
    ...(m.classification === 'surprise_candidate' ? (m.riskReasons || []) : []),
    ...(m.topReasons || []),
    ...(m.classification !== 'surprise_candidate' ? (m.riskReasons || []) : []),
  ].slice(0, expanded ? 6 : 3);
  const consensus = m.conflictScore != null ? Math.max(0, 100 - m.conflictScore) : null;

  return (
    <TouchableOpacity style={[st.card, expanded && st.cardOn]} activeOpacity={0.85} onPress={onToggle}>
      <View style={st.top}>
        <Text style={st.no}>{item.no}</Text>
        <View style={{ flex: 1 }}>
          <Text style={st.teams} numberOfLines={1}>{item.home} – {item.away}</Text>
          <Text style={st.kick}>{fmtTime(item.kickoffAt) || 'Saat bilinmiyor'}{item.league ? ` · ${item.league}` : ''}</Text>
          {risk != null ? (
            <View style={st.bar}>
              <View style={{ width: `${risk}%`, height: 6, backgroundColor: meta.color, borderRadius: 3 }} />
            </View>
          ) : null}
        </View>
        <View style={st.right}>
          {risk != null ? <Text style={[st.risk, { color: meta.color }]}>{risk}</Text> : null}
          <ClassPill classification={m.classification} small />
        </View>
      </View>

      {/* Tahmin satırı */}
      <View style={st.predRow}>
        {m.mainPrediction ? <View style={st.predPill}><Text style={st.predPillTxt}>Ana: {m.mainPrediction}</Text></View> : null}
        {m.alternativePrediction ? <View style={st.altPill}><Text style={st.altPillTxt}>Alternatif: {m.alternativePrediction}</Text></View> : null}
        {m.favorite ? <Text style={st.favTxt}>Favori {m.favorite.symbol} · %{m.favorite.percent}</Text> : null}
        {m.exactDirection && m.classification === 'surprise_candidate' ? (
          <Text style={st.exactTxt}>Sürpriz yönü: {m.exactDirection}</Text>
        ) : null}
      </View>

      {/* Ölçü satırı: veri yeterliliği + güven AYRI + radar sayısı + uzlaşma */}
      <View style={st.metaRow}>
        <MetaChip label="Veri" value={`%${m.dataQuality ?? 0}`} tone={(m.dataQuality ?? 0) < 60 ? colors.warning : colors.success} />
        {m.confidence != null ? <MetaChip label="Güven" value={`%${m.confidence}`} /> : null}
        <MetaChip label="Radar" value={`${m.activeRadarCount ?? 0}/5`} />
        {consensus != null ? (
          <MetaChip label="Uzlaşma" value={`%${consensus}`} tone={consensus < 55 ? colors.danger : undefined} />
        ) : null}
        {m.surpriseDnaScore != null ? <MetaChip label="DNA" value={m.surpriseDnaScore} /> : null}
      </View>

      {/* Resmî sonuç (geçmiş hafta) */}
      {item.official ? (
        <View style={st.resultRow}>
          <Text style={st.resultTxt}>Resmî sonuç: <Text style={st.resultStrong}>{item.official.result}</Text> · {item.official.score?.home}-{item.official.score?.away}</Text>
          {item.outcome?.mainHit != null ? (
            <View style={[st.hitPill, { backgroundColor: item.outcome.mainHit ? colors.success : colors.danger }]}>
              <Text style={st.hitPillTxt}>{item.outcome.mainHit ? '✓ Ana tahmin tuttu' : '✗ Ana tahmin tutmadı'}</Text>
            </View>
          ) : null}
          {item.outcome?.favoriteFailed ? (
            <View style={[st.hitPill, { backgroundColor: colors.warning }]}>
              <Text style={st.hitPillTxt}>Sürpriz oldu</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Gerekçeler */}
      {reasons.length ? (
        <View style={st.reasons}>
          {reasons.map((r, i) => (
            <Text key={i} style={st.reasonTxt} numberOfLines={2}>• <Text style={st.reasonSrc}>{r.radar}:</Text> {r.text}</Text>
          ))}
        </View>
      ) : null}

      {/* Eksik veri uyarısı */}
      {!expanded && m.missingData?.length ? (
        <Text style={st.missTxt}>⚠ {m.missingData.length} veri alanı eksik — detayda listeli.</Text>
      ) : null}

      {/* Genişletilmiş detay */}
      {expanded ? (
        <View style={st.detail}>
          {usedDataLine(item.radars) ? (
            <Text style={st.usedDataTxt}>📎 {usedDataLine(item.radars)}</Text>
          ) : null}
          <Text style={st.detailHead}>Radar kırılımı</Text>
          {['performance', 'expectation', 'publicBetting', 'market', 'bulletinMemory'].map((k) => (
            <RadarRow key={k} r={item.radars?.[k]} />
          ))}

          {m.conflictNotes?.length ? (
            <>
              <Text style={st.detailHead}>Radar uzlaşması</Text>
              {m.conflictNotes.map((t, i) => <Text key={i} style={st.detailTxt}>• {t}</Text>)}
            </>
          ) : null}
          {m.gateNotes?.length ? (
            <>
              <Text style={st.detailHead}>Sınıf kapıları</Text>
              {m.gateNotes.map((t, i) => <Text key={i} style={st.detailTxt}>• {t}</Text>)}
            </>
          ) : null}

          {m.surpriseDna?.features?.length ? (
            <>
              <Text style={st.detailHead}>Sürpriz DNA'sı ({m.surpriseDnaScore}/100)</Text>
              {m.surpriseDna.features.filter((f) => f.state === 'present').map((f, i) => (
                <Text key={i} style={st.detailTxt}>🧬 {f.label}{f.note ? ` — ${f.note}` : ''}</Text>
              ))}
              {m.surpriseDna.features.filter((f) => f.state === 'unavailable').length ? (
                <Text style={st.detailMuted}>
                  Veri yok: {m.surpriseDna.features.filter((f) => f.state === 'unavailable').map((f) => f.label).join(', ')}
                </Text>
              ) : null}
            </>
          ) : null}

          {m.missingData?.length ? (
            <>
              <Text style={st.detailHead}>Eksik veri</Text>
              {m.missingData.slice(0, 6).map((x, i) => <Text key={i} style={st.detailMuted}>– {x.radar}: {x.reason}</Text>)}
            </>
          ) : null}

          {item.radars?.bulletinMemory?.details?.disclaimer ? (
            <Text style={st.disclaimer}>{item.radars.bulletinMemory.details.disclaimer}</Text>
          ) : null}
          <Text style={st.methTxt}>
            Metodoloji: {m.methodologyVersion}{sealed ? ' · 🔏 Kilitli analiz — güncel motorla yeniden hesaplanmaz.' : ''}
          </Text>
        </View>
      ) : null}

      {/* Aksiyonlar: kupona işle + detay */}
      <View style={st.actionRow}>
        {pickRow}
        <TouchableOpacity onPress={onDetail} style={st.detailBtn} activeOpacity={0.85}>
          <Text style={st.detailBtnTxt}>{expanded ? 'Analiz ›' : 'Detaylı Analiz'}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// TEK RADAR SEKMESİ KARTI — seçilen radarın maç bazlı çıktısı.
export function RadarTabCard({ item, radarId }) {
  const r = item.radars?.[radarId];
  // Radar objesi hiç yoksa BİLE maçı listeden düşürme — 15 maç Spor Toto
  // sırasıyla korunur; bu maçta bu radarın verisi yoksa dürüstçe belirtilir.
  if (!r) {
    return (
      <View style={st.card}>
        <View style={st.top}>
          <Text style={st.no}>{item.no}</Text>
          <View style={{ flex: 1 }}>
            <Text style={st.teams} numberOfLines={1}>{item.home} – {item.away}</Text>
            <Text style={st.radarRowOff}>— Bu maçta bu radar için veri yok</Text>
          </View>
        </View>
      </View>
    );
  }
  // Radar 1 (Rakip Gücü): backend her maç için AYNI 4 çekirdek satırı üretir
  // (güç dengesi · ev karnesi · dep karnesi · form hükmü) — kartlar tutarlı olur,
  // "birinde var birinde yok" olmaz. coreLines yoksa eski davranışa düşülür.
  const lines = radarId === 'performance'
    ? (r.details?.coreLines?.length
      ? r.details.coreLines
      : [...(r.positives || []).slice(0, 2), ...(r.negatives || []).slice(0, 2)])
    : [...(r.positives || []), ...(r.negatives || [])].slice(0, 3);
  return (
    <View style={st.card}>
      <View style={st.top}>
        <Text style={st.no}>{item.no}</Text>
        <View style={{ flex: 1 }}>
          <Text style={st.teams} numberOfLines={1}>{item.home} – {item.away}</Text>
          {r.hasData ? (
            <Text style={st.kick}>
              {r.homeScore != null ? `1 %${r.homeScore} · X %${r.drawScore} · 2 %${r.awayScore} · ` : ''}
              {r.direction ? `Yön: ${r.direction} · ` : ''}Veri %{r.dataQuality}
            </Text>
          ) : (
            <Text style={st.radarRowOff}>{r.status === 'no_source' ? '⏳ Veri kaynağı bekleniyor' : '— Bu maçta veri yetersiz'}</Text>
          )}
        </View>
        {r.favoriteFailureRisk != null ? (
          <View style={st.right}>
            <Text style={[st.risk, { color: r.favoriteFailureRisk >= 65 ? colors.danger : r.favoriteFailureRisk >= 35 ? colors.warning : colors.success }]}>
              {r.favoriteFailureRisk}
            </Text>
            <Text style={st.riskLbl}>Risk sinyali</Text>
          </View>
        ) : null}
      </View>
      {lines.map((t, i) => <Text key={i} style={st.reasonTxt} numberOfLines={radarId === 'performance' ? 3 : 2}>• {t}</Text>)}

      {/* OYNANMA DNA (Radar 3): gerçek Bilyoner cümlesi + benzer geçmiş sonuç. */}
      {radarId === 'publicBetting' && r.details?.playedDna ? (
        <View style={st.dnaBox}>
          <Text style={st.dnaSentence}>💬 {r.details.playedDna.userSentence}</Text>
          {r.details.playedDna.similarDna?.hasData ? (
            <Text style={st.dnaSim}>📈 {r.details.playedDna.similarDna.sentence}</Text>
          ) : (
            <Text style={st.dnaLearn}>{r.details.playedDna.similarDna?.note || 'Benzer sonuç için sistem öğreniyor.'}</Text>
          )}
          <Text style={st.dnaNote}>{r.details.playedDna.note}</Text>
        </View>
      ) : null}

      {(() => {
        // 'unsupported' alanlar (yapısal olarak sağlanmayan, ör. sakatlık
        // listesi) tekrar tekrar GÖSTERİLMEZ — metodolojide bir kez açıklanır.
        const shown = (r.missingSignals || []).filter((s) => s.availability !== 'unsupported');
        return shown.length && r.hasData ? (
          <Text style={st.missTxt}>⚠ Eksik: {shown.map((s) => s.label).join(', ')}</Text>
        ) : null;
      })()}
    </View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  cardOn: { borderWidth: 1.5, borderColor: colors.primary },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  no: { color: colors.textMuted, fontSize: 15, fontWeight: '800', width: 22, textAlign: 'center' },
  teams: { color: colors.text, fontSize: 14, fontWeight: '800' },
  kick: { color: colors.textMuted, fontSize: 10.5, fontWeight: '700', marginTop: 2 },
  bar: { marginTop: 6, height: 6, backgroundColor: colors.cardAlt, borderRadius: 3, overflow: 'hidden' },
  right: { alignItems: 'flex-end', gap: 3 },
  risk: { fontSize: 18, fontWeight: '900' },
  riskLbl: { color: colors.textMuted, fontSize: 9, fontWeight: '700' },

  classPill: { borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  classPillTxt: { fontSize: 10, fontWeight: '900' },

  predRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  predPill: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  predPillTxt: { color: '#fff', fontSize: 11.5, fontWeight: '900' },
  altPill: { backgroundColor: colors.cardAlt, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  altPillTxt: { color: colors.text, fontSize: 11.5, fontWeight: '800' },
  favTxt: { color: colors.textSoft, fontSize: 11.5, fontWeight: '700' },
  exactTxt: { color: colors.danger, fontSize: 11.5, fontWeight: '800' },

  metaRow: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  metaChip: { flexDirection: 'row', gap: 4, backgroundColor: colors.surfaceSoft, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 8, paddingVertical: 3, alignItems: 'center' },
  metaChipLbl: { color: colors.textMuted, fontSize: 9.5, fontWeight: '800' },
  metaChipVal: { color: colors.text, fontSize: 10.5, fontWeight: '900' },

  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  resultTxt: { color: colors.textSoft, fontSize: 12, fontWeight: '700' },
  resultStrong: { color: colors.text, fontWeight: '900' },
  hitPill: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  hitPillTxt: { color: '#fff', fontSize: 10, fontWeight: '900' },

  reasons: { marginTop: 8, gap: 2 },
  reasonTxt: { color: colors.textSoft, fontSize: 11.5, lineHeight: 16 },
  reasonSrc: { color: colors.textMuted, fontWeight: '800' },
  missTxt: { color: colors.warning, fontSize: 10.5, fontWeight: '700', marginTop: 6 },

  detail: { marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  detailHead: { color: colors.text, fontSize: 11.5, fontWeight: '900', marginTop: 6, marginBottom: 3 },
  detailTxt: { color: colors.textSoft, fontSize: 11, lineHeight: 15, marginBottom: 2 },
  detailMuted: { color: colors.textMuted, fontSize: 10.5, lineHeight: 14, marginBottom: 2 },
  disclaimer: { color: colors.warning, fontSize: 10.5, fontWeight: '700', marginTop: 6, fontStyle: 'italic' },
  usedDataTxt: { color: colors.textMuted, fontSize: 10.5, fontWeight: '800', marginBottom: 4 },
  dnaBox: { marginTop: 8, backgroundColor: colors.surfaceSoft, borderRadius: radius.sm, padding: 8, gap: 3 },
  dnaSentence: { color: colors.text, fontSize: 11.5, fontWeight: '800', lineHeight: 16 },
  dnaSim: { color: colors.success, fontSize: 11, fontWeight: '700', lineHeight: 15 },
  dnaLearn: { color: colors.textMuted, fontSize: 10.5, fontStyle: 'italic', lineHeight: 14 },
  dnaNote: { color: colors.textMuted, fontSize: 9.5, lineHeight: 13 },
  methTxt: { color: colors.textMuted, fontSize: 10, marginTop: 6 },

  radarRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  radarRowName: { color: colors.text, fontSize: 11, fontWeight: '800' },
  radarRowLine: { color: colors.textSoft, fontSize: 10.5, marginTop: 1 },
  radarRowOff: { color: colors.textMuted, fontSize: 10.5, fontStyle: 'italic', marginTop: 1 },
  radarRowDq: { color: colors.textMuted, fontSize: 10, fontWeight: '800' },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  detailBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.sm, backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border },
  detailBtnTxt: { color: colors.textSoft, fontSize: 11.5, fontWeight: '800' },
});
