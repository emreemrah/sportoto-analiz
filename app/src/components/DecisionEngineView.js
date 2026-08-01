// KARAR MOTORU — Analiz sekmesi görünümü.
// Üstte her zaman kısa/net Karar Paneli. Normal mod sade, Uzman mod detaylı
// (akordiyonlar). Kesin/garanti dil YOK; veri yoksa "Bilinmiyor". Kupon seçimi
// sekmelerin üstündeki CouponPickBlock'tan yapılır (bu görünüm karar destekler).
import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius, shadow } from '../theme';
import { Accordion } from '../ui';
import { buildDecision, joinCoupon } from '../decisionEngine';
// Son güvenlik ağı: motorun ürettiği SERBEST METİN doğrudan basılmaz. Metinler
// bugün temiz ama tek bir kelime değişikliği kuralı deler; ağ bunu ekrana
// düşmeden yakalar. (Aynı ağ MasterAnalysisView'de de kullanılıyor.)
import { humanizeVerdictText as insanDili } from '../labels';

const bankoColor = (s) => (s === 'Evet' ? colors.success : s === 'Şartlı' ? colors.warning : colors.danger);
const riskColor = (r) => (r === 'Düşük' ? colors.success : r === 'Orta' ? colors.warning : r === 'Yüksek' ? '#ea580c' : colors.danger);
const dataColor = (dc) => (dc === 'Yüksek' ? colors.success : dc === 'Orta' ? colors.warning : colors.danger);
const tagColor = (w) => (w >= 70 ? colors.danger : w >= 55 ? '#ea580c' : colors.warning);
const symColor = (s) => (s === 'X' ? colors.warning : colors.success);

function Coupon({ arr }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {(arr || []).map((s) => (
        <View key={s} style={[st.symPill, { borderColor: symColor(s), backgroundColor: symColor(s) + '18' }]}>
          <Text style={[st.symPillTxt, { color: symColor(s) }]}>{s}</Text>
        </View>
      ))}
    </View>
  );
}

function PanelRow({ k, children }) {
  return (
    <View style={st.pRow}>
      <Text style={st.pK}>{k}</Text>
      <View style={st.pV}>{children}</View>
    </View>
  );
}

function KV({ k, v, na }) {
  return (
    <View style={st.kv}>
      <Text style={st.kvK}>{k}</Text>
      <Text style={[st.kvV, na && { color: colors.textMuted, fontStyle: 'italic' }]}>{v}</Text>
    </View>
  );
}

// 1-X-2 tek sonuç bloğu
function OutcomeBlock({ o, keep }) {
  if (!o) return null;
  return (
    <View style={[st.outc, { borderLeftColor: symColor(o.label) }]}>
      <View style={st.outcHead}>
        <View style={[st.symPill, { borderColor: symColor(o.label), backgroundColor: symColor(o.label) + '18' }]}>
          <Text style={[st.symPillTxt, { color: symColor(o.label) }]}>{o.label}</Text>
        </View>
        {o.percent != null ? <Text style={st.outcPct}>%{o.percent}</Text> : null}
        {keep ? <Text style={st.keepBadge}>silinmez</Text> : null}
      </View>
      <Text style={st.outcLine}><Text style={st.outcLbl}>Sebep: </Text>{insanDili(o.whyCanHappen)}</Text>
      <Text style={st.outcLine}><Text style={st.outcLbl}>Risk: </Text>{insanDili(o.whyMayFail)}</Text>
      <Text style={st.outcLine}><Text style={st.outcLbl}>Kupon etkisi: </Text>{insanDili(o.couponEffect)}</Text>
    </View>
  );
}

// Karşılaştırma çubuğu: ev (yeşil) vs deplasman (turuncu), ortada oranlı bar.
const HOME_C = colors.success;
const AWAY_C = colors.warning;
const fmtN = (v) => { const n = Number(v); return Number.isInteger(n) ? String(n) : n.toFixed(1); };

function CompareBar({ label, home, away, suffix = '', lowerBetter = false }) {
  const h = Number(home), a = Number(away);
  const valid = Number.isFinite(h) && Number.isFinite(a);
  let hp = 50;
  if (valid) {
    let hh, aa;
    if (lowerBetter) { const mx = Math.max(h, a) + 1; hh = mx - h; aa = mx - a; }
    else { const mn = Math.min(h, a, 0); hh = h - mn; aa = a - mn; }
    const tot = hh + aa;
    hp = tot > 0 ? Math.round((hh / tot) * 100) : 50;
  }
  const hWin = valid && (lowerBetter ? h < a : h > a);
  const aWin = valid && (lowerBetter ? a < h : a > h);
  return (
    <View style={st.cmpRow}>
      <Text style={st.cmpLabel}>{label}</Text>
      <View style={st.cmpBody}>
        <Text style={[st.cmpVal, hWin && st.cmpValWin]}>{valid ? fmtN(h) + suffix : '–'}</Text>
        <View style={st.cmpTrack}>
          <View style={{ flex: Math.max(hp, 1), backgroundColor: HOME_C }} />
          <View style={{ flex: Math.max(100 - hp, 1), backgroundColor: AWAY_C }} />
        </View>
        <Text style={[st.cmpVal, st.cmpValR, aWin && st.cmpValWin]}>{valid ? fmtN(a) + suffix : '–'}</Text>
      </View>
    </View>
  );
}

function CompareStats({ m }) {
  const s = m?.stats || {};
  const hs = s.home?.standing || {}, as = s.away?.standing || {};
  const hSea = s.home?.season || {}, aSea = s.away?.season || {};
  const homeName = m?.home?.mediumName || m?.home?.name || 'Ev';
  const awayName = m?.away?.mediumName || m?.away?.name || 'Dep';
  const q = (arr) => { if (!Array.isArray(arr) || !arr.length) return null; return Math.round((arr.reduce((x, r) => x + (r === 'G' ? 1 : r === 'B' ? 0.5 : 0), 0) / arr.length) * 100); };
  const rows = [
    { label: 'Sıra', home: hs.position, away: as.position, lowerBetter: true },
    { label: 'Puan', home: hs.points, away: as.points },
    { label: 'Averaj', home: hs.goalDiff, away: as.goalDiff },
    { label: 'Gol / maç', home: hSea.goalsPerGame, away: aSea.goalsPerGame },
    { label: 'Yediği / maç', home: hSea.concededPerGame, away: aSea.concededPerGame, lowerBetter: true },
    { label: 'xG (için)', home: hSea.xgFor, away: aSea.xgFor },
    { label: 'Form (son 5)', home: q(s.home?.last5venue || s.home?.last5), away: q(s.away?.last5venue || s.away?.last5), suffix: '' },
  ].filter((r) => Number.isFinite(Number(r.home)) || Number.isFinite(Number(r.away)));

  if (!rows.length) return <Text style={st.na2}>Karşılaştırma verisi yok (Bilinmiyor).</Text>;
  return (
    <View>
      <View style={st.cmpHead}>
        <View style={st.cmpTeam}><View style={[st.cmpDot, { backgroundColor: HOME_C }]} /><Text style={st.cmpTeamTxt} numberOfLines={1}>{homeName}</Text></View>
        <View style={[st.cmpTeam, { justifyContent: 'flex-end' }]}><Text style={[st.cmpTeamTxt, { textAlign: 'right' }]} numberOfLines={1}>{awayName}</Text><View style={[st.cmpDot, { backgroundColor: AWAY_C }]} /></View>
      </View>
      {rows.map((r, i) => <CompareBar key={i} {...r} />)}
    </View>
  );
}

export default function DecisionEngineView({ m }) {
  const [expert, setExpert] = useState(false);
  const d = useMemo(() => buildDecision(m), [m]);

  return (
    <View>
      {/* ——— ÜST KARAR PANELİ ——— */}
      <View style={st.panel}>
        <View style={st.panelHead}>
          <Text style={st.panelTitle}>⚙️ MASTER KARAR</Text>
          <Text style={st.panelSub}>Tahmin değil, kupon karar desteği</Text>
        </View>

        <View style={st.panelGrid}>
          <PanelRow k="Ana Eğilim">
            {d.mainTrend ? <View style={[st.symPill, { borderColor: symColor(d.mainTrend), backgroundColor: symColor(d.mainTrend) + '18' }]}><Text style={[st.symPillTxt, { color: symColor(d.mainTrend) }]}>{d.mainTrend}</Text></View> : <Text style={st.na}>Bilinmiyor</Text>}
          </PanelRow>
          <PanelRow k="Dar Kupon"><Coupon arr={d.narrowCoupon} /></PanelRow>
          <PanelRow k="Geniş kupon"><Coupon arr={d.safeCoupon} /></PanelRow>
          <PanelRow k="Güçlü Aday Uygunluğu"><Text style={[st.pStrong, { color: bankoColor(d.bankoStatus) }]}>{d.bankoStatus}</Text></PanelRow>
          <PanelRow k="Risk Seviyesi"><Text style={[st.pStrong, { color: riskColor(d.riskLevel) }]}>{d.riskLevel}</Text></PanelRow>
          <PanelRow k="Veri Güvenliği"><Text style={[st.pStrong, { color: dataColor(d.dataConfidence) }]}>{d.dataConfidence}</Text></PanelRow>
        </View>
      </View>

      {/* Mod geçişi */}
      <View style={st.modeRow}>
        {[{ k: false, l: 'Normal' }, { k: true, l: 'Uzman' }].map((o) => (
          <TouchableOpacity key={o.l} onPress={() => setExpert(o.k)} style={[st.modeBtn, expert === o.k && st.modeBtnOn]}>
            <Text style={[st.modeTxt, expert === o.k && st.modeTxtOn]}>{o.l} Mod</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Kısa risk yorumu */}
      <View style={st.commentCard}>
        <Text style={st.commentKicker}>KISA RİSK YORUMU</Text>
        <Text style={st.commentTxt}>{insanDili(d.shortComment)}</Text>
      </View>

      {/* Risk & tuzak etiketleri */}
      {d.tags.length > 0 && (
        <View style={st.tagsWrap}>
          {d.tags.map((t, i) => (
            <View key={i} style={[st.tag, { borderColor: tagColor(t.weight) }]}>
              <Text style={[st.tagName, { color: tagColor(t.weight) }]}>{insanDili(t.name)}</Text>
              <Text style={[st.tagW, { backgroundColor: tagColor(t.weight) }]}>{t.weight}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Çelişki uyarıları (varsa, her modda) */}
      {d.contradictionWarnings.length > 0 && (
        <View style={st.warnCard}>
          <Text style={st.warnKicker}>⚠ ÇELİŞKİ KONTROLÜ</Text>
          {d.contradictionWarnings.map((w, i) => <Text key={i} style={st.warnTxt}>• {insanDili(w)}</Text>)}
        </View>
      )}

      {/* ——— UZMAN MOD ——— */}
      {expert && (
        <View style={{ marginTop: spacing.sm }}>
          {d.tags.length > 0 && (
            <Accordion title="Risk & Tuzak Etiketleri" icon="🏷️" defaultOpen>
              {d.tags.map((t, i) => (
                <View key={i} style={st.tagDetail}>
                  <View style={st.tagDetailHead}>
                    <Text style={[st.tagDetailName, { color: tagColor(t.weight) }]}>{insanDili(t.name)}</Text>
                    <Text style={st.tagDetailW}>{t.weight}/100</Text>
                  </View>
                  <Text style={st.tagDetailLine}><Text style={st.outcLbl}>Sebep: </Text>{insanDili(t.reason)}</Text>
                  <Text style={st.tagDetailLine}><Text style={st.outcLbl}>Kupon etkisi: </Text>{insanDili(t.couponEffect)}</Text>
                </View>
              ))}
            </Accordion>
          )}

          {d.resultAnalysis && (
            <Accordion title="1-X-2 Sonuç Yorumu" icon="🔎">
              <OutcomeBlock o={d.resultAnalysis.home} keep={d.mustKeep.includes('1')} />
              <OutcomeBlock o={d.resultAnalysis.draw} keep={d.mustKeep.includes('X')} />
              <OutcomeBlock o={d.resultAnalysis.away} keep={d.mustKeep.includes('2')} />
            </Accordion>
          )}

          <Accordion title="Sonuç Silme Analizi" icon="✂️">
            <KV k="İlk silinebilir sonuç" v={d.firstRemovable ? d.firstRemovable : 'Yok (kapama adayı)'} na={!d.firstRemovable} />
            <KV k="Silinmemesi gerekenler" v={joinCoupon(d.mustKeep)} />
            <KV k="Silinirse risk" v={d.removalRisk} />
            <KV k="Dar kupon" v={joinCoupon(d.narrowCoupon)} />
            <KV k="Geniş kupon" v={joinCoupon(d.safeCoupon)} />
          </Accordion>

          <Accordion title="Hedef Stratejisi (12 / 13-14 / 15)" icon="🎯">
            <KV k="12 hedefi" v={joinCoupon(d.targetStrategy.target12)} />
            <KV k="13-14 hedefi" v={joinCoupon(d.targetStrategy.target13_14)} />
            <KV k="15 hedefi" v={`${joinCoupon(d.targetStrategy.target15)} (kapalı)`} />
            <Text style={st.note}>12'de minimum koruma yeterli olabilir; 13-14'te X silinmemeli; 15'te maç kapama adayıdır.</Text>
          </Accordion>

          {d.bankoChecklist.length > 0 && (
            <Accordion title="Güçlü Aday Kontrol Listesi" icon="✅">
              <View style={[st.warnCard, { marginBottom: 8 }]}>
                <Text style={st.warnKicker}>Güçlü Aday Uygunluğu: <Text style={{ color: bankoColor(d.bankoStatus) }}>{d.bankoStatus}</Text></Text>
                {d.bankoReasons.map((r, i) => <Text key={i} style={st.warnTxt}>• {insanDili(r)}</Text>)}
              </View>
              {d.bankoChecklist.map((c, i) => (
                <View key={i} style={st.chkRow}>
                  <Text style={st.chkMark}>{c.ok === true ? '✅' : c.ok === false ? '❌' : '❓'}</Text>
                  <Text style={st.chkLabel}>{insanDili(c.label)}</Text>
                  {c.note ? <Text style={st.chkNote}>{insanDili(c.note)}</Text> : null}
                </View>
              ))}
            </Accordion>
          )}

          {d.tactical && (
            <Accordion title="Taktik Eşleşme" icon="🧠">
              <KV k="Ev sahibi profili" v={d.tactical.homeProfile} na={d.tactical.homeProfile === 'Bilinmiyor'} />
              <KV k="Deplasman profili" v={d.tactical.awayProfile} na={d.tactical.awayProfile === 'Bilinmiyor'} />
              <KV k="Ev güçlü yönü" v={d.tactical.homeStrength} na={d.tactical.homeStrength === 'Bilinmiyor'} />
              <KV k="Ev zayıf yönü" v={d.tactical.homeWeak} na={d.tactical.homeWeak === 'Bilinmiyor'} />
              <KV k="Deplasman güçlü yönü" v={d.tactical.awayStrength} na={d.tactical.awayStrength === 'Bilinmiyor'} />
              <KV k="Deplasman zayıf yönü" v={d.tactical.awayWeak} na={d.tactical.awayWeak === 'Bilinmiyor'} />
              <KV k="Orta saha dengesi" v={d.tactical.midfield} na={d.tactical.midfield === 'Bilinmiyor'} />
              <KV k="Geçiş oyunu riski" v={d.tactical.transition} na={d.tactical.transition === 'Bilinmiyor'} />
              <KV k="Rakibe ters gelen yapı" v={d.tactical.mismatch} />
              <Text style={[st.note, { color: colors.text }]}>Taktik sonuç: {d.tactical.verdict}</Text>
            </Accordion>
          )}

          {d.advStats && (
            <Accordion title="Gelişmiş İstatistik" icon="📊" defaultOpen>
              <CompareStats m={m} />
              {(d.advStats.drawTend !== 'Bilinmiyor' || d.advStats.bttsOver !== 'Bilinmiyor') && (
                <View style={{ marginTop: 10 }}>
                  {d.advStats.drawTend !== 'Bilinmiyor' ? <Text style={st.cmpNote}>{d.advStats.drawTend}</Text> : null}
                  {d.advStats.bttsOver !== 'Bilinmiyor' ? <Text style={st.cmpNote}>{d.advStats.bttsOver}</Text> : null}
                </View>
              )}
            </Accordion>
          )}

          <Accordion title="Veri Güvenliği ve Bilinmeyenler" icon="🛡️">
            <KV k="Veri Güvenliği" v={d.dataConfidence} />
            {d.unknownData.map((u, i) => <Text key={i} style={st.unknownLine}>• {u}</Text>)}
            <Text style={st.note}>Eksik veri uydurulmaz; kritik veri eksikliği riski artırır ve güçlü aday değerlendirmesini frenler.</Text>
          </Accordion>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  panel: { backgroundColor: colors.darkCard, borderRadius: radius.lg, padding: spacing.md, ...shadow.card },
  panelHead: { marginBottom: 10 },
  panelTitle: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 0.3 },
  panelSub: { color: 'rgba(255,255,255,0.55)', fontSize: 10.5, fontWeight: '700', marginTop: 1 },
  panelGrid: { gap: 2 },
  pRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  pK: { color: 'rgba(255,255,255,0.7)', fontSize: 12.5, fontWeight: '700' },
  pV: { flexDirection: 'row', alignItems: 'center' },
  pStrong: { fontSize: 14, fontWeight: '900' },
  na: { color: 'rgba(255,255,255,0.5)', fontSize: 12.5, fontStyle: 'italic' },
  symPill: { minWidth: 24, height: 24, paddingHorizontal: 5, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  symPillTxt: { fontSize: 13, fontWeight: '900' },

  modeRow: { flexDirection: 'row', gap: 6, marginTop: spacing.md },
  modeBtn: { flex: 1, paddingVertical: 8, borderRadius: radius.sm, backgroundColor: colors.cardAlt, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  modeBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeTxt: { color: colors.textSoft, fontSize: 12.5, fontWeight: '800' },
  modeTxtOn: { color: '#fff' },

  commentCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.md },
  commentKicker: { color: colors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 0.4, marginBottom: 4 },
  commentTxt: { color: colors.text, fontSize: 13, lineHeight: 19, fontWeight: '600' },

  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: radius.pill, paddingLeft: 10, paddingRight: 4, paddingVertical: 3 },
  tagName: { fontSize: 11.5, fontWeight: '800' },
  tagW: { color: '#fff', fontSize: 10, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden' },

  warnCard: { backgroundColor: colors.dangerSoft, borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger, padding: spacing.md, marginTop: spacing.md },
  warnKicker: { color: '#7a1a1a', fontSize: 11, fontWeight: '900', marginBottom: 4 },
  warnTxt: { color: '#7a1a1a', fontSize: 12, fontWeight: '700', lineHeight: 17, marginTop: 2 },

  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  kvK: { color: colors.textMuted, fontSize: 12, fontWeight: '700', flexShrink: 1 },
  kvV: { color: colors.text, fontSize: 12.5, fontWeight: '800', flex: 1, textAlign: 'right' },

  outc: { backgroundColor: colors.cardAlt, borderRadius: radius.sm, borderLeftWidth: 3, padding: 10, marginBottom: 8 },
  outcHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  outcPct: { color: colors.text, fontSize: 13, fontWeight: '900' },
  keepBadge: { marginLeft: 'auto', color: colors.danger, fontSize: 10, fontWeight: '900', borderWidth: 1, borderColor: colors.danger, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 1 },
  outcLine: { color: colors.textSoft, fontSize: 12, lineHeight: 17, marginTop: 2 },
  outcLbl: { color: colors.textMuted, fontWeight: '800' },

  tagDetail: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  tagDetailHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tagDetailName: { fontSize: 13, fontWeight: '900' },
  tagDetailW: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  tagDetailLine: { color: colors.textSoft, fontSize: 12, lineHeight: 17, marginTop: 3 },

  chkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: colors.border },
  chkMark: { fontSize: 13, width: 20 },
  chkLabel: { color: colors.text, fontSize: 12, fontWeight: '700', flex: 1 },
  chkNote: { color: colors.textMuted, fontSize: 10.5, fontWeight: '700' },

  note: { color: colors.textMuted, fontSize: 11.5, fontWeight: '600', lineHeight: 16, marginTop: 8, fontStyle: 'italic' },
  unknownLine: { color: colors.textSoft, fontSize: 12, fontWeight: '700', marginTop: 3 },

  // Karşılaştırma çubukları (ev yeşil / deplasman turuncu)
  cmpHead: { flexDirection: 'row', marginBottom: 8 },
  cmpTeam: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  cmpDot: { width: 8, height: 8, borderRadius: 4 },
  cmpTeamTxt: { flex: 1, color: colors.text, fontSize: 12.5, fontWeight: '800' },
  cmpRow: { marginBottom: 10 },
  cmpLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800', textAlign: 'center', marginBottom: 3 },
  cmpBody: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cmpVal: { width: 34, color: colors.textSoft, fontSize: 12.5, fontWeight: '800', textAlign: 'left' },
  cmpValR: { textAlign: 'right' },
  cmpValWin: { color: colors.text, fontWeight: '900' },
  cmpTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden', flexDirection: 'row', backgroundColor: colors.cardAlt },
  cmpNote: { color: colors.textMuted, fontSize: 11.5, fontWeight: '700', marginTop: 2 },
  na2: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic' },
});
