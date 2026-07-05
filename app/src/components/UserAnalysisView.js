// SPOR TOTO KULLANICI ANALİZİ — 6 kriterlik kullanıcı mantığı görünümü.
// Üstte nihai yorum (Ana Seçim / Alternatif / Risk / Güven), altında 8 bölüm.
// Veri yoksa "Bu veri bulunamadı" açıkça gösterilir (uydurma yok).
import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, spacing, radius, shadow } from '../theme';
import { matchDate } from '../utils';
import { analyzeUserMatch } from '../userMatchEngine';

// Form ikonları: ev = ev simgesi, deplasman = uçak; sonuç rengi (G yeşil · B sarı · M kırmızı).
const VENUE_ICONS = {
  home: { G: require('../../assets/venue/home-win.png'), B: require('../../assets/venue/home-draw.png'), M: require('../../assets/venue/home-loss.png') },
  away: { G: require('../../assets/venue/away-win.png'), B: require('../../assets/venue/away-draw.png'), M: require('../../assets/venue/away-loss.png') },
};
function FormIcons({ form, venue = 'home', size = 19 }) {
  const chars = String(form || '').split('').filter((c) => 'GBM'.includes(c));
  if (!chars.length) return <Text style={st.na2}>—</Text>;
  const set = VENUE_ICONS[venue];
  return (
    <View style={{ flexDirection: 'row', gap: 3, flexWrap: 'wrap' }}>
      {chars.map((c, i) => <Image key={i} source={set[c]} style={{ width: size, height: size }} resizeMode="contain" />)}
    </View>
  );
}

// İç saha/deplasman kaydı — renkli DOLGU: G yeşil · B sarı · M kırmızı.
function RecordPills({ record }) {
  if (!record) return <Text style={st.na2}>—</Text>;
  const segs = [
    { v: record.w, s: 'G', c: colors.success },
    { v: record.d, s: 'B', c: colors.warning },
    { v: record.l, s: 'M', c: colors.danger },
  ];
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {segs.map((x, i) => (
        <View key={i} style={[st.recPill, { backgroundColor: x.c }]}>
          <Text style={st.recPillTxt}>{x.v}{x.s}</Text>
        </View>
      ))}
    </View>
  );
}

const riskColor = (r) => (r === 'Düşük' ? colors.success : r === 'Orta' ? colors.warning : colors.danger);
const dataColor = (d) => (d === 'Yüksek' ? colors.success : d === 'Orta' ? colors.warning : colors.danger);
const symColor = (s) => (s === 'X' ? colors.warning : colors.success);

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

// Bir kriter kartı — verili/yok durumuna göre.
function Crit({ n, title, available, note, children }) {
  return (
    <View style={st.crit}>
      <View style={st.critHead}>
        <View style={st.critNo}><Text style={st.critNoTxt}>{n}</Text></View>
        <Text style={st.critTitle}>{title}</Text>
        {!available ? <Text style={st.naBadge}>veri yok</Text> : null}
      </View>
      {note ? <Text style={[st.critNote, !available && st.naNote]}>{note}</Text> : null}
      {children}
    </View>
  );
}

export default function UserAnalysisView({ m }) {
  const r = useMemo(() => analyzeUserMatch(m), [m]);
  const v = r.verdict;
  const d = m?.date ? matchDate(m.date) : null;

  return (
    <View>
      {/* NİHAİ YORUM (üstte) */}
      <View style={st.verdict}>
        <Text style={st.vKicker}>🧩 SPOR TOTO YORUMU · kullanıcı mantığı</Text>
        <View style={st.vRow}>
          <View style={st.vBox}>
            <Text style={st.vLbl}>Ana Seçim</Text>
            <Pills value={v.main} />
          </View>
          <View style={st.vBox}>
            <Text style={st.vLbl}>Alternatif</Text>
            <Pills value={v.alt} />
          </View>
          <View style={st.vBox}>
            <Text style={st.vLbl}>Risk</Text>
            <Text style={[st.vStrong, { color: riskColor(v.risk) }]}>{v.risk}</Text>
          </View>
          <View style={st.vBox}>
            <Text style={st.vLbl}>Güven</Text>
            <Text style={[st.vStrong, { color: dataColor(v.dataConfidence) }]}>{v.dataConfidence}</Text>
          </View>
        </View>
        <Text style={st.vReason}>{v.reason}</Text>
      </View>

      {/* 1 · Maç Bilgisi */}
      <Crit n={1} title="Maç Bilgisi" available>
        <Text style={st.kv}><Text style={st.kvK}>Ev: </Text>{r.matchInfo.home}   <Text style={st.kvK}>Deplasman: </Text>{r.matchInfo.away}</Text>
        <Text style={st.kv}><Text style={st.kvK}>Lig: </Text>{r.matchInfo.league}{d ? `   ·   ${d.day} ${d.time}` : ''}</Text>
      </Crit>

      {/* 2 · Puan Durumu */}
      <Crit n={2} title="Puan Durumu Avantajı" available={r.points.available} note={r.points.note}>
        {r.points.available ? (
          <Text style={st.kv}>{r.matchInfo.home} <Text style={st.kvStrong}>{r.points.homePts}</Text> puan ({r.points.homePos}.) · {r.matchInfo.away} <Text style={st.kvStrong}>{r.points.awayPts}</Text> puan ({r.points.awayPos}.) · fark {r.points.abs}</Text>
        ) : null}
      </Crit>

      {/* 3 · Ev Sahibi */}
      <Crit n={3} title="Ev Sahibi Analizi" available={r.homeForm.available} note={r.homeForm.note}>
        {r.homeForm.available ? (
          <View style={st.formRow}>
            <Text style={st.kvK}>İç saha:</Text>
            <FormIcons form={r.homeForm.form5} venue="home" />
            <RecordPills record={r.homeForm.record} />
          </View>
        ) : null}
      </Crit>

      {/* 4 · Deplasman */}
      <Crit n={4} title="Deplasman Analizi" available={r.awayForm.available} note={r.awayForm.note}>
        {r.awayForm.available ? (
          <View style={st.formRow}>
            <Text style={st.kvK}>Deplasman:</Text>
            <FormIcons form={r.awayForm.form5} venue="away" />
            <RecordPills record={r.awayForm.record} />
            <Text style={[st.formRec, { color: colors.text, fontWeight: '800' }]}>{r.awayForm.level}</Text>
          </View>
        ) : null}
      </Crit>

      {/* 5 · Eksik Oyuncu */}
      <Crit n={5} title="Eksik Oyuncu Etkisi" available={r.missing.available} note={r.missing.note} />

      {/* 6 · Teknik Direktör */}
      <Crit n={6} title="Teknik Direktör Etkisi" available={r.coach.available} note={r.coach.note} />

      {/* 7 · Ortak Rakip */}
      <Crit n={7} title="Ortak Rakip Kıyaslaması" available={r.common.available} note={r.common.note}>
        {r.common.available && r.common.opponents.length ? (
          <View style={st.oppWrap}>
            <View style={st.oppHead}>
              <Text style={[st.oppCell, { flex: 1.4, textAlign: 'left' }]}>Ortak rakip</Text>
              <Text style={st.oppCell}>{r.matchInfo.home}</Text>
              <Text style={st.oppCell}>{r.matchInfo.away}</Text>
            </View>
            {r.common.opponents.map((o, i) => (
              <View key={i} style={st.oppRow}>
                <Text style={[st.oppName]} numberOfLines={1}>{o.name}</Text>
                <Text style={[st.oppRes, { color: resC(o.homeRes) }]}>{o.homeRes} · {o.homeScore}</Text>
                <Text style={[st.oppRes, { color: resC(o.awayRes) }]}>{o.awayRes} · {o.awayScore}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Crit>

      {/* Lider (güçlü) takımlara karşı sonuçlar */}
      <Crit
        n={'★'}
        title="Lider Takımlara Karşı (İlk 5)"
        available={r.vsTop.home.available || r.vsTop.away.available}
        note={(r.vsTop.home.available || r.vsTop.away.available) ? 'Son maçlarda ligin ilk sıralarındaki takımlara karşı sonuçlar — güçlülere karşı ne yapmışlar.' : 'Son 5 maçta ligin ilk 5\'indeki takımlara karşı maç bulunamadı.'}
      >
        {[{ team: r.matchInfo.home, d: r.vsTop.home }, { team: r.matchInfo.away, d: r.vsTop.away }].map((x, i) => (
          <View key={i} style={st.vtTeam}>
            <Text style={st.vtName}>{x.team} — {x.d.available ? `${x.d.record.w}G ${x.d.record.d}B ${x.d.record.l}M` : 'lidere karşı maç yok'}</Text>
            {x.d.matches.map((mm, j) => (
              <View key={j} style={st.vtRow}>
                <Text style={st.vtOpp} numberOfLines={1}>{mm.pos}. {mm.opp}</Text>
                <Text style={[st.vtRes, { color: resC(mm.result) }]}>{mm.result} · {mm.score}</Text>
              </View>
            ))}
          </View>
        ))}
      </Crit>

      {/* Karşılıklı Maçlar (H2H) */}
      <Crit n={'⚔'} title="Karşılıklı Maçlar (H2H)" available={r.h2h.available} note={r.h2h.note}>
        {r.h2h.available ? (() => {
          const { homeWins, draws, awayWins, played } = r.h2h;
          const tot = Math.max(homeWins + draws + awayWins, 1);
          return (
            <View style={{ marginTop: 8 }}>
              <View style={st.h2hBar}>
                <View style={{ flex: Math.max(homeWins, 0.001), backgroundColor: colors.success }} />
                <View style={{ flex: Math.max(draws, 0.001), backgroundColor: colors.warning }} />
                <View style={{ flex: Math.max(awayWins, 0.001), backgroundColor: '#ea580c' }} />
              </View>
              <View style={st.h2hLegend}>
                <Text style={[st.h2hL, { color: colors.success }]}>{r.matchInfo.home} {homeWins}</Text>
                <Text style={[st.h2hL, { color: colors.warning }]}>Beraberlik {draws}</Text>
                <Text style={[st.h2hL, { color: '#ea580c' }]}>{r.matchInfo.away} {awayWins}</Text>
              </View>
              <Text style={st.h2hTot}>Toplam {played} karşılaşma</Text>
            </View>
          );
        })() : null}
      </Crit>
    </View>
  );
}

const resC = (r) => (r === 'G' ? colors.success : r === 'M' ? colors.danger : colors.warning);

const st = StyleSheet.create({
  verdict: { backgroundColor: colors.darkCard, borderRadius: radius.lg, padding: spacing.md, ...shadow.card },
  vKicker: { color: 'rgba(255,255,255,0.6)', fontSize: 10.5, fontWeight: '900', letterSpacing: 0.3, marginBottom: 10 },
  vRow: { flexDirection: 'row', gap: 8 },
  vBox: { flex: 1, alignItems: 'center', gap: 4 },
  vLbl: { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '700' },
  vStrong: { fontSize: 14, fontWeight: '900' },
  vReason: { color: 'rgba(255,255,255,0.82)', fontSize: 12, lineHeight: 18, fontWeight: '600', marginTop: 12 },
  pill: { minWidth: 22, height: 22, paddingHorizontal: 4, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  pillTxt: { fontSize: 12.5, fontWeight: '900' },

  crit: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.sm },
  critHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  critNo: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  critNoTxt: { color: '#fff', fontSize: 11, fontWeight: '900' },
  critTitle: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '900' },
  naBadge: { color: colors.textMuted, fontSize: 10, fontWeight: '800', borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 1 },
  critNote: { color: colors.textSoft, fontSize: 12.5, lineHeight: 18, fontWeight: '600', marginTop: 6 },
  naNote: { color: colors.textMuted, fontStyle: 'italic' },
  kv: { color: colors.textSoft, fontSize: 12, lineHeight: 18, fontWeight: '700', marginTop: 6 },
  kvK: { color: colors.textMuted, fontWeight: '700', fontSize: 12 },
  kvStrong: { color: colors.text, fontWeight: '900' },
  formRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  formRec: { color: colors.textSoft, fontSize: 12, fontWeight: '800' },
  recPill: { minWidth: 26, paddingHorizontal: 6, paddingVertical: 3, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  recPillTxt: { color: '#fff', fontSize: 11.5, fontWeight: '900' },
  na2: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic' },

  oppWrap: { marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 },
  oppHead: { flexDirection: 'row', paddingBottom: 4 },
  oppRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.border },
  oppCell: { flex: 1, color: colors.textMuted, fontSize: 10.5, fontWeight: '800', textAlign: 'center' },
  oppName: { flex: 1.4, color: colors.text, fontSize: 11.5, fontWeight: '700' },
  oppRes: { flex: 1, fontSize: 11.5, fontWeight: '800', textAlign: 'center' },
  h2hBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: colors.cardAlt },
  h2hLegend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  h2hL: { fontSize: 11.5, fontWeight: '900' },
  h2hTot: { color: colors.textMuted, fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  vtTeam: { marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 },
  vtName: { color: colors.text, fontSize: 12.5, fontWeight: '900', marginBottom: 4 },
  vtRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 3 },
  vtOpp: { flex: 1, color: colors.textSoft, fontSize: 11.5, fontWeight: '700' },
  vtRes: { fontSize: 11.5, fontWeight: '900', marginLeft: 8 },
});
