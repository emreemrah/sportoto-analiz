// SPOR TOTO — KULLANICI SEÇİMLİ ANALİZ GÖRÜNÜMÜ
// Sabit analiz YOK. Aktif analiz profili okunur; SADECE kullanıcının açtığı
// kriterlerle sonuç üretilir. Profil yoksa/boşsa uyarı + "kriter seç" yönlendirmesi.
// Veri yoksa "veri bulunamadı" açıkça gösterilir (uydurma yok).
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius, shadow } from '../theme';
import { matchDate } from '../utils';
import { api } from '../api';
import { getPref, setPref } from '../prefs';
import { userSelectedAnalysisEngine } from '../analysis/engine';
import { getActiveProfile, subscribeProfile, countOn } from '../analysisProfile';
import VenueMark from './VenueMark';

// Kriter karnesi (resmi sonuçlara göre gerçek isabet) — modül içi basit cache:
// maç detayına her girişte yeniden istek atılmaz (5 dk tazelik yeter).
let _perfCache = { at: 0, map: null, note: null };
function useCriteriaPerf() {
  const [perf, setPerf] = useState(_perfCache.map);
  useEffect(() => {
    let alive = true;
    if (_perfCache.map && Date.now() - _perfCache.at < 5 * 60 * 1000) return undefined;
    api.criteriaScorecard()
      .then((d) => {
        const map = d?.hasData && Array.isArray(d.criteria)
          ? Object.fromEntries(d.criteria.map((c) => [c.key, c]))
          : null;
        _perfCache = { at: Date.now(), map, note: d?.note || null };
        if (alive) setPerf(map);
      })
      .catch(() => {});                    // karne yoksa rozetsiz devam (uydurma yok)
    return () => { alive = false; };
  }, []);
  return perf;
}
// İsabet rengi: %60+ yeşil · %50-59 sarı · altı kırmızı · az örnek gri.
const accColor = (p) => (p.lowSample ? colors.textMuted : p.accuracy >= 60 ? colors.success : p.accuracy >= 50 ? colors.warning : colors.danger);

const symColor = (s) => (s === 'X' ? colors.warning : colors.success);
const confColor = (d) => (d === 'Yüksek' ? colors.success : d === 'Orta' ? colors.warning : colors.danger);
const sideColor = (side) => (side === 'home' ? colors.success : side === 'away' ? colors.orange : side === 'draw' ? colors.warning : colors.muted);
const sideTag = (side) => (side === 'home' ? '1' : side === 'away' ? '2' : side === 'draw' ? 'X' : 'ℹ');

function Pills({ value }) {
  const chars = String(value || '').split('');
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {chars.map((s, i) => (
        <View key={i} style={[st.pill, { borderColor: symColor(s), backgroundColor: symColor(s) + '18' }]}>
          <Text style={[st.pillTxt, { color: symColor(s) }]}>{s}</Text>
        </View>
      ))}
    </View>
  );
}

function useActiveProfile() {
  const [profile, setProfile] = useState(() => getActiveProfile());
  useEffect(() => subscribeProfile((p) => setProfile(p)), []);
  return profile;
}

export default function UserAnalysisView({ m, navigation }) {
  const profile = useActiveProfile();
  const perf = useCriteriaPerf();          // kriter isabet karnesi (varsa)
  const [mode, setMode] = useState(() => getPref('analysisViewMode') || 'expert'); // 'simple' | 'expert'
  const r = useMemo(() => userSelectedAnalysisEngine(m, profile), [m, profile]);
  const goSettings = () => navigation?.navigate('AnalysisSettings');

  // — Profil yok / hiç kriter yok —
  if (r.empty || !profile || countOn(profile) === 0) {
    return (
      <View style={st.empty}>
        <Text style={st.emptyIcon}>🧩</Text>
        <Text style={st.emptyTitle}>Analiz profili oluşturulmadı</Text>
        <Text style={st.emptyMsg}>{r.message || 'Analiz yapılabilmesi için önce analiz kriterlerinizi seçmelisiniz.'}</Text>
        <TouchableOpacity onPress={goSettings} style={st.emptyBtn} activeOpacity={0.9}>
          <Text style={st.emptyBtnTxt}>Analiz Kriterlerini Seç ›</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const d = m?.date ? matchDate(m.date) : null;

  // — İstatistik verisi yok —
  if (r.noStats) {
    return (
      <View>
        <ProfileBanner name={profile.name} count={countOn(profile)} onEdit={goSettings} />
        <View style={st.crit}><Text style={st.critNote}>{r.message}</Text></View>
      </View>
    );
  }

  const v = r.verdict;
  const simple = mode === 'simple';
  // Sade mod için en güçlü 3 kanıt (taraf gösteren, puana göre)
  const topEvidence = r.results
    .filter((c) => c.available && c.side && c.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);
  return (
    <View>
      {/* Aktif profil */}
      <ProfileBanner name={r.profileName} count={r.usedCount} onEdit={goSettings} />

      {/* Sade / Uzman mod anahtarı */}
      <View style={st.modeRow}>
        {[['simple', 'Sade'], ['expert', 'Uzman']].map(([k, l]) => (
          <TouchableOpacity key={k} onPress={() => { setMode(k); setPref('analysisViewMode', k); }} style={[st.modeBtn, mode === k && st.modeBtnOn]} activeOpacity={0.85}>
            <Text style={[st.modeTxt, mode === k && st.modeTxtOn]}>{l}</Text>
          </TouchableOpacity>
        ))}
        <Text style={st.modeHint}>{simple ? 'Karar + risk + en güçlü 3 neden' : 'Tüm kriterler ve puanlar'}</Text>
      </View>

      {/* Nihai yorum */}
      <View style={st.verdict}>
        <Text style={st.vKicker}>🧩 SPOR TOTO YORUMU · seçili kriterlere göre</Text>
        <View style={st.vRow}>
          <View style={st.vBox}><Text style={st.vLbl}>Ana Seçim</Text><Pills value={v.main} /></View>
          <View style={st.vBox}><Text style={st.vLbl}>Alternatif</Text><Pills value={v.alt} /></View>
          <View style={st.vBox}><Text style={st.vLbl}>Güven</Text><Text style={[st.vStrong, { color: confColor(v.confidence) }]}>{v.confidence}</Text></View>
        </View>
        <View style={st.riskWrap}>
          <Text style={st.riskLbl}>⚠ Risk</Text>
          <Text style={st.riskTxt}>{v.risk}</Text>
        </View>
        <Text style={st.vReason}>{v.reason}</Text>
      </View>

      {/* SADE MOD: karar + risk yukarıda; burada yalnız en güçlü 3 neden */}
      {simple ? (
        <View style={st.crit}>
          <Text style={st.secTitle}>En Güçlü 3 Neden</Text>
          {topEvidence.length ? topEvidence.map((c) => (
            <View key={c.key} style={st.critRow}>
              <View style={[st.sideBadge, { backgroundColor: sideColor(c.side) }]}>
                <Text style={st.sideBadgeTxt}>{sideTag(c.side)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.critNote}>{c.note}</Text>
                {perf?.[c.key] ? (
                  <Text style={[st.accLine, { color: accColor(perf[c.key]) }]}>Bu kriter şimdiye dek %{perf[c.key].accuracy} tuttu ({perf[c.key].hit}/{perf[c.key].total})</Text>
                ) : null}
              </View>
              <View style={[st.ptsPill, { borderColor: sideColor(c.side) }]}>
                <Text style={[st.ptsTxt, { color: sideColor(c.side) }]}>+{c.points.toFixed(1)}</Text>
              </View>
            </View>
          )) : <Text style={st.critNote}>Taraf gösteren güçlü kanıt bulunamadı — Uzman moddan detaya bakabilirsin.</Text>}
        </View>
      ) : (
      <>
      {/* Maç bilgisi */}
      <View style={st.crit}>
        <View style={st.miRow}>
          <VenueMark side="home" size={15} />
          <Text style={st.miName} numberOfLines={1}>{r.matchInfo.home}</Text>
          <Text style={st.miVs}>–</Text>
          <VenueMark side="away" size={15} />
          <Text style={st.miName} numberOfLines={1}>{r.matchInfo.away}</Text>
        </View>
        <Text style={st.kv}><Text style={st.kvK}>Lig: </Text>{r.matchInfo.league || '—'}{d ? `   ·   ${d.day} ${d.time}` : ''}</Text>
      </View>

      {/* Kullanılan kriterler — karne varsa gerçek isabet % rozetiyle */}
      <View style={st.crit}>
        <Text style={st.secTitle}>Kullanılan Analiz Kriterleri ({r.usedCount})</Text>
        {perf ? <Text style={st.perfHint}>Yüzdeler: kriterin resmi sonuçlara göre gerçek isabet oranı.</Text> : null}
        <View style={st.chips}>
          {r.results.map((c) => (
            <View key={c.key} style={[st.chip, !c.available && st.chipNa]}>
              <Text style={[st.chipTxt, !c.available && st.chipNaTxt]}>{c.label}</Text>
              <Text style={[st.chipImp, !c.available && st.chipNaTxt]}>· {c.impactLabel}</Text>
              {perf?.[c.key] ? (
                <Text style={[st.chipAcc, { color: accColor(perf[c.key]) }]}> · %{perf[c.key].accuracy}</Text>
              ) : null}
            </View>
          ))}
        </View>
      </View>

      {/* Kriter bazlı yorumlar */}
      <View style={st.crit}>
        <Text style={st.secTitle}>Kriter Bazlı Yorumlar</Text>
        {r.results.map((c) => {
          const showPts = c.available && (c.side === 'home' || c.side === 'away' || c.side === 'draw') && c.points > 0;
          const p = perf?.[c.key] || null;
          return (
            <View key={c.key} style={st.critRow}>
              <View style={[st.sideBadge, { backgroundColor: c.available ? sideColor(c.side) : colors.muted }]}>
                <Text style={st.sideBadgeTxt}>{c.available ? sideTag(c.side) : '—'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[st.critNote, !c.available && st.naNote]}>{c.note}</Text>
                {p ? (
                  <Text style={[st.accLine, { color: accColor(p) }]}>
                    Bu kriter şimdiye dek %{p.accuracy} tuttu ({p.hit}/{p.total}){p.lowSample ? ' · az veri' : ''}
                  </Text>
                ) : null}
              </View>
              {showPts ? (
                <View style={[st.ptsPill, { borderColor: sideColor(c.side) }]}>
                  <Text style={[st.ptsTxt, { color: sideColor(c.side) }]}>+{c.points.toFixed(1)}</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      {/* Alt toplam — taraf puanları ve fark */}
      <Subtotal tally={r.tally} names={r.matchInfo} />
      </>
      )}
    </View>
  );
}

function Subtotal({ tally, names }) {
  if (!tally) return null;
  const { home, away, draw, diff, leader } = tally;
  const total = Math.max(home + away, 0.0001);
  const leadName = leader === 'home' ? names.home : leader === 'away' ? names.away : 'Beraberlik';
  return (
    <View style={st.crit}>
      <Text style={st.secTitle}>Alt Toplam — Taraf Puanları</Text>
      <View style={st.tallyRow}>
        <View style={st.tallyCell}>
          <View style={[st.tallyTag, { backgroundColor: colors.success }]}><Text style={st.tallyTagTxt}>1</Text></View>
          <View style={st.tallyNameRow}><VenueMark side="home" size={12} /><Text style={st.tallyName} numberOfLines={1}>{names.home}</Text></View>
          <Text style={[st.tallyVal, { color: colors.success }]}>{home.toFixed(1)}</Text>
        </View>
        <View style={st.tallyCell}>
          <View style={[st.tallyTag, { backgroundColor: colors.warning }]}><Text style={st.tallyTagTxt}>X</Text></View>
          <Text style={st.tallyName}>Beraberlik</Text>
          <Text style={[st.tallyVal, { color: colors.warning }]}>{draw.toFixed(1)}</Text>
        </View>
        <View style={st.tallyCell}>
          <View style={[st.tallyTag, { backgroundColor: colors.orange }]}><Text style={st.tallyTagTxt}>2</Text></View>
          <View style={st.tallyNameRow}><VenueMark side="away" size={12} /><Text style={st.tallyName} numberOfLines={1}>{names.away}</Text></View>
          <Text style={[st.tallyVal, { color: colors.orange }]}>{away.toFixed(1)}</Text>
        </View>
      </View>

      {/* 1 vs 2 karşılaştırma barı */}
      <View style={st.tallyBar}>
        <View style={{ flex: Math.max(home, 0.001), backgroundColor: colors.success }} />
        <View style={{ flex: Math.max(away, 0.001), backgroundColor: colors.orange }} />
      </View>

      <View style={st.diffWrap}>
        <Text style={st.diffTxt}>
          Fark: {diff === 0 ? 'eşit — taraflar denk' : <><Text style={{ color: leader === 'home' ? colors.success : colors.orange, fontWeight: '900' }}>{leadName}</Text> +{diff.toFixed(1)} puan önde</>}
        </Text>
      </View>
    </View>
  );
}

function ProfileBanner({ name, count, onEdit }) {
  return (
    <View style={st.banner}>
      <View style={{ flex: 1 }}>
        <Text style={st.bannerLbl}>Aktif Analiz Profili</Text>
        <Text style={st.bannerName}>{name || 'Kullanıcı Seçimli Analiz'}</Text>
        <Text style={st.bannerCount}>Kullanılan kriter sayısı: {count}</Text>
      </View>
      <TouchableOpacity onPress={onEdit} style={st.bannerBtn} activeOpacity={0.9}>
        <Text style={st.bannerBtnTxt}>Düzenle</Text>
      </TouchableOpacity>
    </View>
  );
}

const st = StyleSheet.create({
  empty: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, alignItems: 'center' },
  emptyIcon: { fontSize: 34 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 8 },
  emptyMsg: { color: colors.textSoft, fontSize: 12.5, lineHeight: 18, fontWeight: '600', textAlign: 'center', marginTop: 6 },
  emptyBtn: { marginTop: 14, backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: 18, paddingVertical: 12 },
  emptyBtnTxt: { color: '#fff', fontSize: 13.5, fontWeight: '900' },

  banner: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  bannerLbl: { color: colors.textMuted, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.2 },
  bannerName: { color: colors.primary, fontSize: 14, fontWeight: '900', marginTop: 2 },
  bannerCount: { color: colors.textSoft, fontSize: 11.5, fontWeight: '700', marginTop: 2 },
  bannerBtn: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  bannerBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '900' },

  verdict: { backgroundColor: colors.darkCard, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.sm, ...shadow.card },
  vKicker: { color: 'rgba(255,255,255,0.6)', fontSize: 10.5, fontWeight: '900', letterSpacing: 0.3, marginBottom: 10 },
  vRow: { flexDirection: 'row', gap: 8 },
  vBox: { flex: 1, alignItems: 'center', gap: 4 },
  vLbl: { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '700' },
  vStrong: { fontSize: 15, fontWeight: '900' },
  riskWrap: { marginTop: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: radius.sm, padding: 10 },
  riskLbl: { color: colors.warning, fontSize: 11, fontWeight: '900' },
  riskTxt: { color: 'rgba(255,255,255,0.85)', fontSize: 12, lineHeight: 18, fontWeight: '600', marginTop: 3 },
  vReason: { color: 'rgba(255,255,255,0.75)', fontSize: 11.5, lineHeight: 17, fontWeight: '600', marginTop: 10 },
  pill: { minWidth: 22, height: 22, paddingHorizontal: 4, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  pillTxt: { fontSize: 12.5, fontWeight: '900' },

  crit: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.sm },
  secTitle: { color: colors.text, fontSize: 13, fontWeight: '900', marginBottom: 8 },
  kv: { color: colors.textSoft, fontSize: 12, lineHeight: 18, fontWeight: '700', marginTop: 2 },
  kvK: { color: colors.textMuted, fontWeight: '700', fontSize: 12 },
  miRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  miName: { color: colors.text, fontSize: 13, fontWeight: '900', flexShrink: 1 },
  miVs: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginHorizontal: 2 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardAlt, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  chipNa: { backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border },
  chipTxt: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  chipImp: { color: colors.textMuted, fontSize: 10, fontWeight: '700', marginLeft: 3 },
  chipNaTxt: { color: colors.muted },
  chipAcc: { fontSize: 10.5, fontWeight: '900' },
  perfHint: { color: colors.textMuted, fontSize: 10.5, fontWeight: '600', marginBottom: 6 },
  accLine: { fontSize: 10.5, fontWeight: '800', marginTop: 3 },

  modeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  modeBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  modeBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeTxt: { color: colors.textSoft, fontSize: 12, fontWeight: '900' },
  modeTxtOn: { color: '#fff' },
  modeHint: { flex: 1, color: colors.textMuted, fontSize: 10.5, fontWeight: '600', marginLeft: 4 },

  critRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
  sideBadge: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  sideBadgeTxt: { color: '#fff', fontSize: 12, fontWeight: '900' },
  critNote: { flex: 1, color: colors.textSoft, fontSize: 12.5, lineHeight: 18, fontWeight: '600' },
  naNote: { color: colors.textMuted, fontStyle: 'italic' },
  ptsPill: { minWidth: 34, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, borderWidth: 1.3, marginTop: 1 },
  ptsTxt: { fontSize: 11.5, fontWeight: '900' },

  tallyRow: { flexDirection: 'row', gap: 8 },
  tallyCell: { flex: 1, alignItems: 'center', backgroundColor: colors.surfaceSoft, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: 10, paddingHorizontal: 4 },
  tallyTag: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  tallyTagTxt: { color: '#fff', fontSize: 12, fontWeight: '900' },
  tallyNameRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 5 },
  tallyName: { color: colors.textMuted, fontSize: 10.5, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  tallyVal: { fontSize: 19, fontWeight: '900', marginTop: 2 },
  tallyBar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: colors.cardAlt, marginTop: 12 },
  diffWrap: { marginTop: 8, alignItems: 'center' },
  diffTxt: { color: colors.textSoft, fontSize: 12.5, fontWeight: '700' },
});
