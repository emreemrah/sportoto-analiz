// MASTER ANALİZ GÖRÜNÜMÜ — MatchDetail "Analiz" sekmesinin backend paneli.
// Kriter hesabının TEK doğruluk kaynağı backend'dir; bu bileşen yalnız sonucu
// ve açıklamaları gösterir.
//
// ÇEVRİMDIŞI (2026-08-07): cihazda yedek motor ARTIK YOK — yerel hafif motor
// kriter seçme sistemiyle birlikte kaldırıldı. Sunucuya ulaşılamazsa analiz
// GÖSTERİLMEZ; uydurma sonuç üretmek yerine durum dürüstçe yazılır.
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme';
import { humanizeVerdictText as insanDili } from '../labels';
import { calculateMatchMaster } from '../services/masterAnalysisService';

const OUT_NAME = { '1': 'Ev', X: 'Beraberlik', '2': 'Deplasman' };

function SupportBar({ label, value, tone }) {
  return (
    <View style={st.barRow}>
      <Text style={st.barLbl}>{label}</Text>
      <View style={st.barTrack}>
        <View style={[st.barFill, { width: `${Math.max(2, value || 0)}%`, backgroundColor: tone }]} />
      </View>
      <Text style={[st.barVal, { color: tone }]}>%{value ?? 0}</Text>
    </View>
  );
}

function Chip({ label, tone }) {
  return (
    <View style={[st.chip, tone ? { borderColor: tone } : null]}>
      <Text style={[st.chipTxt, tone ? { color: tone } : null]}>{label}</Text>
    </View>
  );
}

function Section({ title, children }) {
  return (
    <View style={st.section}>
      <Text style={st.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

// KULLANICI PROFİLİ KALDIRILDI (2026-08-07, kullanıcı kararı). Analiz artık
// HER ZAMAN resmî profille hesaplanır; kriter seçme sistemi tamamen kalktı.
// Bileşen profile göndermez (null) → backend `buildOfficialProfile()` kullanır.
export default function MasterAnalysisView({ m }) {
  const [state, setState] = useState({ loading: true, error: null, data: null, offline: false });
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    calculateMatchMaster(m.no, null).then((res) => {
      if (!alive) return;
      if (!res?.match?.master) setState({ loading: false, error: null, data: null, offline: true });
      else setState({ loading: false, error: null, data: res, offline: false });
    });
    return () => { alive = false; };
  }, [m?.no]);

  if (state.loading) {
    return (
      <View style={st.wrap}>
        <Text style={st.head}>🧠 Master Analiz</Text>
        <View style={st.centerBox}><ActivityIndicator color={colors.primary} /><Text style={st.mutedTxt}>Sunucuda hesaplanıyor…</Text></View>
      </View>
    );
  }

  if (state.offline || !state.data) {
    return (
      <View style={st.wrap}>
        <Text style={st.head}>🧠 Master Analiz</Text>
        <Text style={st.offlineTxt}>
          ⚠ Analiz sunucudan alınamadı. Cihazda yedek hesap yapılmaz — yanlış
          sayı göstermektense hiç göstermemek doğrudur. Bağlantını kontrol edip
          tekrar dene.
          Mühürlü/resmî sonuçlar için bağlantı gerekir.
        </Text>
      </View>
    );
  }

  const { match, freezeStatus } = state.data;
  const ms = match.master;
  const radar = match.radarMaster;

  if (!ms?.ok) {
    return (
      <View style={st.wrap}>
        <Text style={st.head}>🧠 Master Analiz</Text>
        <Text style={st.mutedTxt}>{ms?.message || 'Analiz üretilemedi.'}</Text>
      </View>
    );
  }

  const dirRows = (sig) => ms.contributions.filter((c) => c.signal === sig);
  const cappedFamilies = ms.familyNotes || [];
  const agree = radar?.mainPrediction && ms.mainPrediction && radar.mainPrediction === ms.mainPrediction;

  return (
    <View style={st.wrap}>
      {/* ÜST: profil + sayılar + kilit */}
      <View style={st.headRow}>
        <Text style={st.head}>🧠 Master Analiz</Text>
        {freezeStatus === 'sealed' ? <Chip label="🔏 Mühürlü" tone={colors.success} /> : <Chip label="Canlı — kilitte mühürlenecek" />}
      </View>
      {/* Profil satırı kaldırıldı: tek profil var (resmî), seçim yok. */}
      <View style={st.metaRow}>
        <Chip label={`Kriter ${ms.selectedCriteriaCount}`} />
        <Chip label={`Verisi olan ${ms.availableCriteriaCount}`} tone={colors.success} />
        {ms.unavailableCriteriaCount ? <Chip label={`Veri yok ${ms.unavailableCriteriaCount}`} tone={colors.warning} /> : null}
        <Chip label={`Veri yeterliliği %${ms.dataQuality}`} tone={ms.dataQuality >= 70 ? colors.success : colors.warning} />
        <Chip label={`Güven: ${ms.confidence}`} tone={ms.confidence === 'Yüksek' ? colors.success : ms.confidence === 'Orta' ? colors.warning : colors.danger} />
      </View>

      {/* ANA KARAR */}
      <Section title="Analiz Desteği (1 / X / 2)">
        <SupportBar label="1" value={ms.normalizedSupport1} tone={colors.success} />
        <SupportBar label="X" value={ms.normalizedSupportX} tone={colors.warning} />
        <SupportBar label="2" value={ms.normalizedSupport2} tone={colors.danger} />
        <Text style={st.tinyNote}>{insanDili(ms.supportNote)}</Text>
        <View style={st.decisionRow}>
          {ms.mainPrediction ? <View style={st.mainPill}><Text style={st.mainPillTxt}>Ana: {ms.mainPrediction}</Text></View> : null}
          {ms.alternativePrediction ? <View style={st.altPill}><Text style={st.altPillTxt}>Alternatif: {ms.alternativePrediction}</Text></View> : null}
          {ms.closedPrediction ? <View style={st.altPill}><Text style={st.altPillTxt}>Kapalı: {ms.closedPrediction}</Text></View> : null}
        </View>
        <View style={st.metaRow}>
          <Chip label={ms.bankoEligible ? 'Güçlü aday koşulları sağlandı (garanti değil)' : 'Güçlü aday için uygun değil'} tone={ms.bankoEligible ? colors.success : colors.danger} />
          <Chip label={`Uzlaşma %${ms.agreementScore}`} />
          <Chip label={`Çatışma %${ms.conflictScore}`} tone={ms.conflictScore >= 55 ? colors.danger : undefined} />
        </View>
        {ms.decisionNote ? <Text style={st.noteTxt}>{insanDili(ms.decisionNote)}</Text> : null}
        {!ms.bankoEligible && ms.bankoNote ? <Text style={st.noteTxt}>{insanDili(ms.bankoNote)}</Text> : null}
      </Section>

      {/* ÖZET */}
      {ms.summary ? (
        <Section title="Master Analiz Özeti">
          <Text style={st.summaryTxt}>{insanDili(ms.summary)}</Text>
        </Section>
      ) : null}

      {/* RADAR KIYASI — ayrı sistem */}
      {radar ? (
        <Section title="Radar Sistemiyle Karşılaştırma (ayrı sistem)">
          <Text style={st.noteTxt}>
            Master Analiz: {ms.mainPrediction ?? '—'} · Master Radar: {radar.mainPrediction ?? '—'}
            {radar.classification === 'surprise_candidate' ? ' · Radar favori tuzağı uyarısı veriyor' : ''}
          </Text>
          <Text style={[st.noteTxt, { color: agree ? colors.success : colors.warning }]}>
            {agree ? '✔ İki bağımsız sistem ortak görüşte.' : '⚠ Sistemler farklı görüşte — temkinli olunmalı.'}
          </Text>
        </Section>
      ) : null}

      {/* DETAY AÇ/KAPA */}
      <TouchableOpacity style={st.detailToggle} onPress={() => setShowDetail((v) => !v)} activeOpacity={0.85}>
        <Text style={st.detailToggleTxt}>{showDetail ? 'Kriter detaylarını gizle ▲' : 'Kriter detaylarını göster ▼'}</Text>
      </TouchableOpacity>

      {showDetail ? (
        <>
          <Section title={`Ana tercihi destekleyenler (${dirRows(ms.mainPrediction).length})`}>
            {dirRows(ms.mainPrediction).slice(0, 8).map((c) => (
              <Text key={c.key} style={st.critLine}>• {c.label} <Text style={st.critPts}>+{c.points}</Text>{c.familyDedupFactor < 1 ? <Text style={st.critFam}> (aile dengesi ×{c.familyDedupFactor})</Text> : null}</Text>
            ))}
            {!dirRows(ms.mainPrediction).length ? <Text style={st.mutedTxt}>Bu yönü destekleyen kriter yok.</Text> : null}
          </Section>
          {['1', 'X', '2'].filter((o) => o !== ms.mainPrediction).map((o) => (
            <Section key={o} title={`${OUT_NAME[o]} (${o}) yönünü destekleyenler (${dirRows(o).length})`}>
              {dirRows(o).slice(0, 5).map((c) => (
                <Text key={c.key} style={st.critLine}>• {c.label} <Text style={st.critPts}>+{c.points}</Text></Text>
              ))}
              {!dirRows(o).length ? <Text style={st.mutedTxt}>Sinyal yok.</Text> : null}
            </Section>
          ))}
          {ms.missingData?.length ? (
            <Section title={`Veri bulunamayan kriterler (${ms.missingData.length})`}>
              {ms.missingData.slice(0, 8).map((x) => <Text key={x.key} style={st.mutedTxt}>– {x.label}</Text>)}
            </Section>
          ) : null}
          {cappedFamilies.length ? (
            <Section title="Aile dengelemesi (çifte sayım engeli)">
              {cappedFamilies.map((f, i) => <Text key={i} style={st.noteTxt}>• {insanDili(f.note)}</Text>)}
            </Section>
          ) : null}
          {ms.mode === 'smart' && ms.reliabilityNotes?.length ? (
            <Section title="Akıllı Destek ayarlamaları">
              {ms.reliabilityNotes.map((r, i) => <Text key={i} style={st.noteTxt}>• {r.label}: {insanDili(r.note)}</Text>)}
            </Section>
          ) : null}
          <Text style={st.tinyNote}>Metodoloji: {ms.methodologyVersion} · Hesap: {new Date(ms.calculatedAt || Date.now()).toLocaleString('tr-TR')}{freezeStatus === 'sealed' ? ' · 🔏 Kilitli analiz — güncel motorla yeniden hesaplanmaz.' : ''}</Text>
        </>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  head: { color: colors.text, fontSize: 16, fontWeight: '900' },
  profLine: { color: colors.textSoft, fontSize: 12, fontWeight: '700', marginTop: 6 },
  bold: { fontWeight: '900', color: colors.text },
  metaRow: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.surfaceSoft },
  chipTxt: { color: colors.textSoft, fontSize: 10.5, fontWeight: '800' },
  centerBox: { alignItems: 'center', paddingVertical: 18, gap: 8 },
  mutedTxt: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  offlineTxt: { color: colors.warning, fontSize: 12, lineHeight: 17, fontWeight: '700', marginTop: 6 },
  cta: { marginTop: 10, backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  ctaTxt: { color: '#fff', fontSize: 13.5, fontWeight: '900' },

  section: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  sectionTitle: { color: colors.text, fontSize: 12.5, fontWeight: '900', marginBottom: 6 },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  barLbl: { width: 16, color: colors.text, fontSize: 12.5, fontWeight: '900', textAlign: 'center' },
  barTrack: { flex: 1, height: 10, backgroundColor: colors.cardAlt, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5 },
  barVal: { width: 44, fontSize: 12, fontWeight: '900', textAlign: 'right' },
  tinyNote: { color: colors.textMuted, fontSize: 10, lineHeight: 14, marginTop: 6, fontStyle: 'italic' },

  decisionRow: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  mainPill: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  mainPillTxt: { color: '#fff', fontSize: 13, fontWeight: '900' },
  altPill: { backgroundColor: colors.cardAlt, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  altPillTxt: { color: colors.text, fontSize: 12.5, fontWeight: '800' },
  noteTxt: { color: colors.textSoft, fontSize: 11.5, lineHeight: 16, marginTop: 4 },
  summaryTxt: { color: colors.text, fontSize: 12.5, lineHeight: 19, fontWeight: '600' },

  detailToggle: { marginTop: spacing.md, alignItems: 'center', paddingVertical: 8, borderRadius: radius.sm, backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border },
  detailToggleTxt: { color: colors.textSoft, fontSize: 12, fontWeight: '800' },
  critLine: { color: colors.textSoft, fontSize: 11.5, lineHeight: 17 },
  critPts: { color: colors.success, fontWeight: '900' },
  critFam: { color: colors.textMuted, fontSize: 10.5 },
});
