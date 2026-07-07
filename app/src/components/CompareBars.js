// KARŞILAŞTIRMA BARLARI — sıkışık yazı yerine görsel kıyas.
// Her satır: etiket · ev değeri · [yeşil|turuncu bar] · deplasman değeri.
// Yeşil = ev sahibi lehine · turuncu = deplasman lehine. Üstün olan koyu.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';

const n1 = (v) => { const x = Number(v); return Number.isFinite(x) ? (Number.isInteger(x) ? String(x) : x.toFixed(1)) : null; };

// stats (m.stats: { home, away }) → CompareBars için sig. Backend radarSignals ile aynı mantık.
// Böylece Radar 2'deki kıyas barları maç detayında da aynı veriden üretilir.
export function signalsFromStats(stats) {
  if (!stats?.home || !stats?.away) return null;
  const h = stats.home, a = stats.away, sig = {};
  if (h.last5?.length || a.last5?.length) sig.form = { home: h.last5 || [], away: a.last5 || [] };
  const hv = h.standing?.home, av = a.standing?.away;
  if (hv || av) sig.venue = {
    home: hv ? { wins: hv.wins || 0, draws: hv.draws || 0, losses: hv.losses || 0 } : null,
    away: av ? { wins: av.wins || 0, draws: av.draws || 0, losses: av.losses || 0 } : null,
  };
  if (h.season?.xgFor != null && a.season?.xgFor != null) sig.xg = {
    home: h.season.xgFor, away: a.season.xgFor,
    homeVenue: h.season.xgForHome ?? null, awayVenue: a.season.xgForAway ?? null,
    homeAgainst: h.season.xgAgainstHome ?? null, awayAgainst: a.season.xgAgainstAway ?? null,
  };
  if (h.season?.goalsPerGame != null && a.season?.goalsPerGame != null) sig.goals = {
    home: { for: h.season.goalsPerGame, against: h.season.concededPerGame ?? null },
    away: { for: a.season.goalsPerGame, against: a.season.concededPerGame ?? null },
  };
  if (h.standing?.position != null && a.standing?.position != null) sig.position = { home: h.standing.position, away: a.standing.position };
  return Object.keys(sig).length ? sig : null;
}

function Bar({ label, hv, av, unit, lowerBetter }) {
  const h = Number(hv), a = Number(av);
  if (!Number.isFinite(h) || !Number.isFinite(a)) return null;
  // Bar payları — düşük iyi ise ters çevir.
  const hShare = lowerBetter ? 1 / Math.max(h, 0.1) : Math.max(h, 0.01);
  const aShare = lowerBetter ? 1 / Math.max(a, 0.1) : Math.max(a, 0.01);
  const hWin = lowerBetter ? h <= a : h >= a;
  const suf = unit || '';
  return (
    <View style={s.row}>
      <Text style={s.lbl}>{label}</Text>
      <Text style={[s.val, hWin && s.hWin]}>{n1(hv)}{suf}</Text>
      <View style={s.track}>
        <View style={{ flex: hShare, backgroundColor: colors.green, borderTopLeftRadius: 4, borderBottomLeftRadius: 4 }} />
        <View style={{ flex: aShare, backgroundColor: colors.orange, borderTopRightRadius: 4, borderBottomRightRadius: 4 }} />
      </View>
      <Text style={[s.val, s.valR, !hWin && s.aWin]}>{n1(av)}{suf}</Text>
    </View>
  );
}

function Rec({ r }) {
  if (!r) return <Text style={s.recNa}>—</Text>;
  return (
    <View style={s.recRow}>
      <Text style={[s.recSeg, { color: colors.green }]}>{r.wins || 0}G</Text>
      <Text style={[s.recSeg, { color: colors.warning }]}>{r.draws || 0}B</Text>
      <Text style={[s.recSeg, { color: colors.danger }]}>{r.losses || 0}M</Text>
    </View>
  );
}

export default function CompareBars({ sig }) {
  if (!sig) return null;
  const xh = sig.xg?.homeVenue ?? sig.xg?.home, xa = sig.xg?.awayVenue ?? sig.xg?.away;
  const gh = sig.goals?.home?.for, ga = sig.goals?.away?.for;
  const ph = sig.position?.home, pa = sig.position?.away;
  const v = sig.venue;
  const rows = [];
  if (ph != null && pa != null) rows.push(<Bar key="sira" label="Sıra" hv={ph} av={pa} unit="." lowerBetter />);
  if (xh != null && xa != null) rows.push(<Bar key="xg" label="xG" hv={xh} av={xa} />);
  if (gh != null && ga != null) rows.push(<Bar key="gol" label="Gol/maç" hv={gh} av={ga} />);
  if (!rows.length && !(v?.home || v?.away)) return null;
  return (
    <View style={s.wrap}>
      {rows}
      {(v?.home || v?.away) ? (
        <View style={s.row}>
          <Text style={s.lbl}>İç/Dış</Text>
          <Rec r={v.home} />
          <Text style={s.mid}>—</Text>
          <Rec r={v.away} />
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 6, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lbl: { width: 52, color: colors.textMuted, fontSize: 10.5, fontWeight: '800' },
  val: { width: 34, color: colors.textSoft, fontSize: 11.5, fontWeight: '700', textAlign: 'right' },
  valR: { textAlign: 'left' },
  hWin: { color: colors.green, fontWeight: '900' },
  aWin: { color: colors.orange, fontWeight: '900' },
  track: { flex: 1, flexDirection: 'row', height: 9, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.cardAlt },
  mid: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  recRow: { flexDirection: 'row', gap: 5, flex: 1 },
  recSeg: { fontSize: 11, fontWeight: '900' },
  recNa: { color: colors.textMuted, fontSize: 11, flex: 1 },
});
