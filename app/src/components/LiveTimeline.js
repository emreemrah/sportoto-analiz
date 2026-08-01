// CANLI OLAY ŞERİDİ — maçın gol/kırmızı kart dakikaları tek bakışta.
// Ev sahibi olayları üst şeritte, deplasman alt şeritte. Mantık saf modülde
// (src/liveEvents.js) ve testlidir. Gösterilecek olay yoksa bileşen HİÇ
// görünmez — boş/uydurma şerit çizilmez.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { timelineMarkers, REG_MINUTES, HALF_MINUTES } from '../liveEvents';

const HOME_C = '#2f6fed';
const AWAY_C = '#e0762c';

const iconOf = (e) => (e.kind === 'red' ? '🟥' : e.ownGoal ? '⚽' : e.penalty ? '⚽' : '⚽');

export default function LiveTimeline({ events, minute = null, homeName = '', awayName = '' }) {
  const markers = timelineMarkers(events, { maxMinute: minute || REG_MINUTES });
  if (!markers.length) return null;

  const cap = Math.max(REG_MINUTES, minute || 0, ...markers.map((m) => m.at));
  const nowPos = minute != null ? Math.max(0, Math.min(1, minute / cap)) : null;
  const halfPos = HALF_MINUTES / cap;
  const home = markers.filter((m) => m.side === 'home');
  const away = markers.filter((m) => m.side === 'away');
  const noSide = markers.filter((m) => !m.side);

  const lane = (list, color, align) => (
    <View style={st.lane}>
      {list.map((e, i) => (
        <View key={`${e.at}-${i}`} style={[st.marker, { left: `${e.pos * 100}%`, marginTop: align === 'top' ? e.slot * -1 : e.slot * 1 }]}>
          <Text style={st.markerIcon}>{iconOf(e)}</Text>
          <Text style={[st.markerMin, { color }]}>{e.minute}{e.extra ? `+${e.extra}` : ''}'</Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={st.wrap}>
      <View style={st.head}>
        <Text style={[st.side, { color: HOME_C }]} numberOfLines={1}>{homeName}</Text>
        <Text style={st.title}>Maç Şeridi</Text>
        <Text style={[st.side, { color: AWAY_C, textAlign: 'right' }]} numberOfLines={1}>{awayName}</Text>
      </View>

      {lane(home, HOME_C, 'top')}

      <View style={st.track}>
        <View style={[st.half, { left: `${halfPos * 100}%` }]} />
        {nowPos != null ? <View style={[st.now, { left: `${nowPos * 100}%` }]} /> : null}
        {nowPos != null ? <View style={[st.played, { width: `${nowPos * 100}%` }]} /> : null}
      </View>

      <View style={st.scale}>
        <Text style={st.scaleTxt}>0'</Text>
        <Text style={st.scaleTxt}>45'</Text>
        <Text style={st.scaleTxt}>{cap > REG_MINUTES ? `${cap}'` : "90'"}</Text>
      </View>

      {lane(away, AWAY_C, 'bottom')}

      {noSide.length ? (
        <Text style={st.note}>
          {noSide.length} olayın takımı eşleştirilemedi — şeritte gösterilmiyor, listede duruyor.
        </Text>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: {
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingTop: 8, paddingBottom: 10, marginBottom: spacing.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  side: { flex: 1, fontSize: 11, fontWeight: '900' },
  title: { color: colors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  lane: { height: 26, justifyContent: 'center' },
  marker: { position: 'absolute', alignItems: 'center', transform: [{ translateX: -11 }], width: 22 },
  markerIcon: { fontSize: 12 },
  markerMin: { fontSize: 8.5, fontWeight: '900' },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceSoft, overflow: 'hidden', justifyContent: 'center' },
  played: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.border },
  half: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: colors.textMuted, opacity: 0.5 },
  now: { position: 'absolute', top: -2, bottom: -2, width: 2, backgroundColor: colors.accent, zIndex: 2 },
  scale: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  scaleTxt: { color: colors.textMuted, fontSize: 8.5, fontWeight: '800' },
  note: { color: colors.textMuted, fontSize: 9.5, fontStyle: 'italic', marginTop: 4 },
});
