// Gelişmiş Kadro Tahmini — futbol sahası + diziliş + mevki bazlı oyuncu seçimi.
// Topluluk kadro tahmini (bahis değil). Takım bazlı (ev/deplasman) kaydedilir.
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, spacing, radius } from './theme';
import { api } from './api';

// --- Dizilişler (alttan GK → üstte forvet, her satır bir hat) ---
export const FORMATIONS = {
  '4-4-2': [['GK'], ['LB', 'CB', 'CB', 'RB'], ['LM', 'CM', 'CM', 'RM'], ['ST', 'ST']],
  '4-3-3': [['GK'], ['LB', 'CB', 'CB', 'RB'], ['CDM', 'CM', 'CM'], ['LW', 'ST', 'RW']],
  '3-5-2': [['GK'], ['CB', 'CB', 'CB'], ['LWB', 'CM', 'CAM', 'CM', 'RWB'], ['ST', 'ST']],
  '5-3-2': [['GK'], ['LWB', 'CB', 'CB', 'CB', 'RWB'], ['CM', 'CM', 'CM'], ['ST', 'ST']],
  '4-2-3-1': [['GK'], ['LB', 'CB', 'CB', 'RB'], ['CDM', 'CDM'], ['LW', 'CAM', 'RW'], ['ST']],
  '3-4-3': [['GK'], ['CB', 'CB', 'CB'], ['LM', 'CM', 'CM', 'RM'], ['LW', 'ST', 'RW']],
};
const FORMATION_KEYS = Object.keys(FORMATIONS);

const roleOf = (label) => {
  if (label === 'GK') return 'GK';
  if (['LB', 'CB', 'RB', 'LWB', 'RWB'].includes(label)) return 'DEF';
  if (['CDM', 'CM', 'CAM', 'LM', 'RM', 'DM', 'AM'].includes(label)) return 'MID';
  return 'FWD';
};
const ROLE_LABEL = { GK: 'Kaleci', DEF: 'Defans', MID: 'Orta Saha', FWD: 'Forvet' };
const ROLE_ORDER = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
const POS_TO_ROLE = { K: 'GK', D: 'DEF', O: 'MID', F: 'FWD' };

function buildSlots(formationKey) {
  const rows = FORMATIONS[formationKey];
  const slots = [];
  let gi = 0;
  rows.forEach((row, ri) => {
    const y = rows.length === 1 ? 50 : 88 - (ri / (rows.length - 1)) * 78;
    row.forEach((label, ci) => {
      const x = ((ci + 1) / (row.length + 1)) * 100;
      slots.push({ key: `s${gi}`, label, role: roleOf(label), x, y });
      gi++;
    });
  });
  return slots;
}

// Takım oyuncu havuzu (gerçek kadro varsa ondan, yoksa mock)
function teamPlayers(squad, teamName) {
  if (squad && squad.length) {
    return squad.map((p, i) => ({ id: `${teamName}-${i}`, name: p.name, role: POS_TO_ROLE[p.pos] || 'MID', jersey: p.no ?? null, minutes: p.minutes || 0, apps: p.apps || 0 }));
  }
  let n = 0;
  const mk = (role, count) => Array.from({ length: count }, (_, i) => { n++; return { id: `${teamName}-${role}-${i}`, name: `${ROLE_LABEL[role]} ${i + 1}`, role, jersey: n, minutes: (count - i) * 200, apps: count - i }; });
  return [...mk('GK', 2), ...mk('DEF', 6), ...mk('MID', 6), ...mk('FWD', 4)];
}

const surname = (name) => { const w = String(name || '').trim().split(/\s+/); return w[w.length - 1] || name; };

// Diziliş değişince mevcut seçimleri role göre yeni slotlara taşı
function remap(oldSel, oldSlots, newSlots) {
  const byRole = {};
  oldSlots.forEach((s) => { const p = oldSel[s.key]; if (p) (byRole[s.role] = byRole[s.role] || []).push(p); });
  const newSel = {};
  newSlots.forEach((s) => { const pool = byRole[s.role]; if (pool && pool.length) newSel[s.key] = pool.shift(); });
  let dropped = 0;
  Object.values(byRole).forEach((arr) => { dropped += arr.length; });
  return { newSel, dropped };
}

export default function LineupBuilder({ matchId, match, homeName, awayName, initial, onClose, onSaved }) {
  const [team, setTeam] = useState('home');
  const [formations, setFormations] = useState({ home: '4-4-2', away: '4-4-2' });
  const [selected, setSelected] = useState({ home: {}, away: {} });
  const [modalSlot, setModalSlot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState(null);

  // Kayıtlı kadroları yükle
  useEffect(() => {
    if (!initial) return;
    const f = { home: '4-4-2', away: '4-4-2' };
    const sel = { home: {}, away: {} };
    ['home', 'away'].forEach((tk) => {
      const row = initial[tk];
      if (row && row.formation && FORMATIONS[row.formation]) {
        f[tk] = row.formation;
        const slots = buildSlots(row.formation);
        (row.selected_players || []).forEach((p) => {
          const slot = slots.find((s) => s.key === p.slotKey);
          if (slot) sel[tk][slot.key] = { id: p.playerId || p.playerName, name: p.playerName, role: roleOf(slot.label), jersey: p.jerseyNumber || null };
        });
      }
    });
    setFormations(f); setSelected(sel);
  }, [initial]);

  const pool = useMemo(() => teamPlayers(team === 'home' ? match.stats?.home?.squad : match.stats?.away?.squad, team === 'home' ? homeName : awayName), [team, match, homeName, awayName]);
  const slots = useMemo(() => buildSlots(formations[team]), [formations, team]);
  const sel = selected[team];
  const filled = Object.keys(sel).length;
  const usedIds = new Set(Object.values(sel).map((p) => p.id));

  const changeFormation = (fk) => {
    const oldSlots = buildSlots(formations[team]);
    const newSlots = buildSlots(fk);
    const { newSel, dropped } = remap(sel, oldSlots, newSlots);
    setFormations((f) => ({ ...f, [team]: fk }));
    setSelected((s) => ({ ...s, [team]: newSel }));
    if (dropped > 0) { setWarn(`${dropped} oyuncu yeni dizilişe uymadığı için kaldırıldı.`); setTimeout(() => setWarn(null), 3000); }
  };

  const assign = (slot, player) => {
    setSelected((s) => ({ ...s, [team]: { ...s[team], [slot.key]: player } }));
    setModalSlot(null);
  };
  const clearSlot = (slotKey) => setSelected((s) => { const c = { ...s[team] }; delete c[slotKey]; return { ...s, [team]: c }; });

  const save = async () => {
    setBusy(true);
    try {
      const players = slots.filter((sl) => sel[sl.key]).map((sl) => ({
        slotKey: sl.key, positionLabel: sl.label, playerName: sel[sl.key].name,
        playerPosition: ROLE_LABEL[sel[sl.key].role], jerseyNumber: sel[sl.key].jersey || null, playerId: sel[sl.key].id,
      }));
      await api.saveLineup({ matchId, teamId: team, teamName: team === 'home' ? homeName : awayName, formation: formations[team], selectedPlayers: players });
      onSaved(`${team === 'home' ? homeName : awayName} kadro tahminin kaydedildi`);
    } catch (e) { onSaved(null, e.message); } finally { setBusy(false); }
  };

  // Modal için ilgili mevki listesi (seçili olanlar hariç), mevkiye göre
  // En çok oynayan (dakika/maç) önce
  const modalList = modalSlot
    ? pool.filter((p) => p.role === modalSlot.role && !usedIds.has(p.id)).sort((a, b) => (b.minutes - a.minutes) || (b.apps - a.apps) || a.name.localeCompare(b.name))
    : [];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.wrap}>
        <View style={st.head}>
          <Text style={st.title}>📋 Kadro Tahmini</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Text style={st.x}>✕</Text></TouchableOpacity>
        </View>

        {/* Takım seçimi */}
        <View style={st.teamRow}>
          {[['home', homeName], ['away', awayName]].map(([tk, nm]) => (
            <TouchableOpacity key={tk} style={[st.teamBtn, team === tk && st.teamBtnOn]} onPress={() => setTeam(tk)}>
              <Text style={[st.teamTxt, team === tk && st.teamTxtOn]} numberOfLines={1}>{nm}</Text>
              <Text style={[st.teamSub, team === tk && { color: colors.bg }]}>{Object.keys(selected[tk]).length}/11</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Diziliş — kısa, iOS segment tarzı */}
        <Text style={st.fHead}>DİZİLİŞ</Text>
        <View style={st.fBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.fRow}>
            {FORMATION_KEYS.map((fk) => (
              <TouchableOpacity key={fk} style={[st.fPill, formations[team] === fk && st.fPillOn]} onPress={() => changeFormation(fk)} activeOpacity={0.8}>
                <Text style={[st.fTxt, formations[team] === fk && st.fTxtOn]}>{fk}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {warn ? <Text style={st.warn}>⚠️ {warn}</Text> : null}

        {/* Saha — pro çizgiler + çim şeritleri */}
        <View style={st.pitchWrap}>
          <View style={st.pitch}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <View key={i} pointerEvents="none" style={[st.stripe, { top: `${i * 12.5}%`, backgroundColor: i % 2 ? '#0f4a2c' : '#0c3f25' }]} />
            ))}
            <View pointerEvents="none" style={st.outline} />
            <View pointerEvents="none" style={st.midLine} />
            <View pointerEvents="none" style={st.centerCircle} />
            <View pointerEvents="none" style={st.centerSpot} />
            <View pointerEvents="none" style={st.penTop} />
            <View pointerEvents="none" style={st.goalTop} />
            <View pointerEvents="none" style={st.penBottom} />
            <View pointerEvents="none" style={st.goalBottom} />
            {[{ top: -11, left: -11 }, { top: -11, right: -11 }, { bottom: -11, left: -11 }, { bottom: -11, right: -11 }].map((pos, i) => (
              <View key={i} pointerEvents="none" style={[st.corner, pos]} />
            ))}
            {slots.map((slot) => {
              const p = sel[slot.key];
              return (
                <View key={slot.key} style={[st.slotWrap, { left: `${slot.x}%`, top: `${slot.y}%` }]} pointerEvents="box-none">
                  <TouchableOpacity
                    style={[st.slot, p ? st.slotOn : st.slotOff]}
                    onPress={() => setModalSlot(slot)}
                    onLongPress={() => p && clearSlot(slot.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={p ? st.slotInitial : st.slotLabel}>{p ? (p.jersey != null ? p.jersey : surname(p.name).slice(0, 3).toUpperCase()) : slot.label}</Text>
                  </TouchableOpacity>
                  <Text style={[st.slotCaption, p && st.slotCaptionOn]} numberOfLines={1}>{p ? surname(p.name) : slot.label}</Text>
                </View>
              );
            })}
          </View>
          <Text style={st.hint}>Boş pozisyona dokun → oyuncu seç · dolu pozisyona uzun bas → kaldır</Text>
        </View>

        {/* Kaydet */}
        <View style={st.footer}>
          <Text style={st.count}>{filled}/11 seçildi</Text>
          <TouchableOpacity style={[st.save, (busy || filled !== 11) && { opacity: 0.5 }]} onPress={save} disabled={busy || filled !== 11}>
            {busy ? <ActivityIndicator color={colors.bg} /> : <Text style={st.saveTxt}>{filled === 11 ? 'Kaydet' : `${11 - filled} oyuncu daha`}</Text>}
          </TouchableOpacity>
        </View>

        {/* Oyuncu seçme modalı (mevkiye göre) */}
        {modalSlot && (
          <Modal visible transparent animationType="fade" onRequestClose={() => setModalSlot(null)}>
            <View style={st.pmWrap}>
              <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setModalSlot(null)} />
              <View style={st.pmSheet}>
                <View style={st.pmHead}>
                  <Text style={st.pmTitle}>{modalSlot.label} · {ROLE_LABEL[modalSlot.role]}</Text>
                  <TouchableOpacity onPress={() => setModalSlot(null)}><Text style={st.x}>✕</Text></TouchableOpacity>
                </View>
                <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ padding: spacing.md }}>
                  {modalList.length === 0 ? (
                    <Text style={st.pmEmpty}>Bu mevkide seçilebilir oyuncu kalmadı.</Text>
                  ) : modalList.map((p) => (
                    <TouchableOpacity key={p.id} style={st.pRow} onPress={() => assign(modalSlot, p)}>
                      <View style={st.pAvatar}><Text style={st.pJersey}>{p.jersey != null ? p.jersey : '⚽'}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={st.pName} numberOfLines={1}>{p.name}</Text>
                        <Text style={st.pMeta} numberOfLines={1}>{ROLE_LABEL[p.role]}{p.apps ? ` · ${p.apps} maç` : ''}</Text>
                      </View>
                      <Text style={st.pPick}>Seç</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, paddingTop: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  x: { color: colors.textMuted, fontSize: 18, fontWeight: '900' },
  teamRow: { flexDirection: 'row', gap: 8, padding: spacing.md },
  teamBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  teamBtnOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  teamTxt: { color: colors.text, fontSize: 14, fontWeight: '800' },
  teamTxtOn: { color: colors.bg },
  teamSub: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  fHead: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1, paddingHorizontal: spacing.md, marginBottom: 4 },
  fBar: { height: 40, justifyContent: 'center', marginBottom: spacing.sm },
  fRow: { paddingHorizontal: spacing.md, gap: 8, alignItems: 'center' },
  fPill: { paddingHorizontal: 16, height: 32, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  fPillOn: { backgroundColor: colors.field, borderColor: colors.field },
  fTxt: { color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  fTxtOn: { color: colors.bg },
  warn: { color: colors.gold, fontSize: 12, paddingHorizontal: spacing.md, marginBottom: 4 },
  pitchWrap: { flex: 1, paddingHorizontal: spacing.md, paddingTop: 2 },
  pitch: { flex: 1, backgroundColor: '#0c3f25', borderRadius: radius.md, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)' },
  stripe: { position: 'absolute', left: 0, right: 0, height: '12.5%' },
  outline: { position: 'absolute', left: 6, right: 6, top: 6, bottom: 6, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.32)', borderRadius: 4 },
  midLine: { position: 'absolute', left: 6, right: 6, top: '50%', height: 1.5, backgroundColor: 'rgba(255,255,255,0.32)' },
  centerCircle: { position: 'absolute', left: '50%', top: '50%', width: 66, height: 66, borderRadius: 33, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.32)', marginLeft: -33, marginTop: -33 },
  centerSpot: { position: 'absolute', left: '50%', top: '50%', width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)', marginLeft: -2.5, marginTop: -2.5 },
  penTop: { position: 'absolute', top: 6, left: '22%', width: '56%', height: '15%', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.32)', borderTopWidth: 0 },
  goalTop: { position: 'absolute', top: 6, left: '37%', width: '26%', height: '7%', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.32)', borderTopWidth: 0 },
  penBottom: { position: 'absolute', bottom: 6, left: '22%', width: '56%', height: '15%', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.32)', borderBottomWidth: 0 },
  goalBottom: { position: 'absolute', bottom: 6, left: '37%', width: '26%', height: '7%', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.32)', borderBottomWidth: 0 },
  corner: { position: 'absolute', width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.28)' },
  slotWrap: { position: 'absolute', width: 64, marginLeft: -32, marginTop: -28, alignItems: 'center' },
  slot: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  slotOff: { backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)', borderStyle: 'dashed' },
  slotOn: { backgroundColor: colors.accent, borderWidth: 2, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  slotLabel: { color: 'rgba(255,255,255,0.92)', fontSize: 11, fontWeight: '900' },
  slotInitial: { color: colors.bg, fontSize: 13, fontWeight: '900' },
  slotCaption: { color: 'rgba(0,0,0,0)', fontSize: 9, fontWeight: '700', marginTop: 2 },
  slotCaptionOn: { color: '#fff', fontSize: 9.5, fontWeight: '800', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 4, borderRadius: 4, overflow: 'hidden' },
  hint: { color: colors.textMuted, fontSize: 11, textAlign: 'center', paddingVertical: 8 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  count: { color: colors.text, fontSize: 14, fontWeight: '800' },
  save: { backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: radius.md, minWidth: 150, alignItems: 'center' },
  saveTxt: { color: colors.bg, fontSize: 15, fontWeight: '800' },
  pmWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  pmSheet: { backgroundColor: colors.bgAlt, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  pmHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  pmTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  pmEmpty: { color: colors.textMuted, fontSize: 13, textAlign: 'center', padding: spacing.lg },
  pRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: radius.sm, padding: 10, marginBottom: 6 },
  pAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.field + '22', borderWidth: 1, borderColor: colors.field, alignItems: 'center', justifyContent: 'center' },
  pJersey: { color: colors.field, fontSize: 13, fontWeight: '900' },
  pName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  pMeta: { color: colors.textMuted, fontSize: 11.5, marginTop: 1 },
  pPick: { color: colors.accent, fontSize: 13, fontWeight: '800' },
});
