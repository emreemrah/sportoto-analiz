// Maç detayında KUPON SEÇİM bloğu — analiz görürken [1][X][2] + Sistemden al.
// Seçim paylaşılan TASLAK'a işlenir; Kupon Oluştur'dan kaydedilir. Kilit sonrası
// sadece görüntüleme. Yalnız resmi TEYİTLİ güncel bültendeki maçta görünür.
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme';
import { expandPick } from '../liveLogic';
import { getDraft, setDraftPick } from '../couponStore';

const OUT = ['1', 'X', '2'];

export default function CouponPickBlock({ m, navigation }) {
  const [pick, setPick] = useState([]);
  useEffect(() => { if (m?.roundId != null) setPick(getDraft(m.roundId).picks?.[m.no] || []); }, [m?.roundId, m?.no]);
  if (!m || m.verificationStatus !== 'confirmed' || m.roundId == null) return null;
  const locked = m.closeDate && Date.now() >= new Date(m.closeDate).getTime();

  const write = (arr) => { setPick(arr); setDraftPick(m.roundId, m.no, arr); };
  const toggle = (o) => { if (locked) return; const set = new Set(pick); set.has(o) ? set.delete(o) : set.add(o); write(OUT.filter((x) => set.has(x))); };
  const fromSystem = () => { if (locked) return; write(expandPick(m.prediction?.symbol)); };

  return (
    <View style={s.block}>
      <Text style={s.title}>🎟️ KUPONA İŞLE</Text>
      <Text style={s.sub}>Analizi gördün — seçimini yap. Kupon taslağına işlenir, Kupon Oluştur'dan kaydedersin.</Text>
      {locked ? (
        <Text style={s.locked}>🔒 Bülten kilitlendi — bu maç için seçim değiştirilemez.</Text>
      ) : (
        <>
          <View style={s.row}>
            {OUT.map((o) => { const on = pick.includes(o); return (
              <TouchableOpacity key={o} onPress={() => toggle(o)} style={[s.btn, on && s.btnOn]}><Text style={[s.txt, on && s.txtOn]}>{o}</Text></TouchableOpacity>
            ); })}
            <TouchableOpacity onPress={fromSystem} style={s.sysBtn}><Text style={s.sysTxt}>Sistemden al</Text></TouchableOpacity>
          </View>
          <View style={s.footer}>
            <Text style={s.picked}>{pick.length ? `Seçimin: ${pick.join(' / ')}` : 'Henüz seçim yok'}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('CouponBuilder', { roundId: m.roundId })} style={s.goBtn}><Text style={s.goTxt}>Kupon Oluştur ›</Text></TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  block: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary, padding: spacing.md, marginBottom: spacing.md },
  title: { color: colors.primary, fontSize: 12.5, fontWeight: '900', letterSpacing: 0.3 },
  sub: { color: colors.textMuted, fontSize: 11, fontWeight: '600', marginTop: 4, lineHeight: 15 },
  locked: { color: colors.warning, fontSize: 12.5, fontWeight: '800', marginTop: 8 },
  row: { flexDirection: 'row', gap: 7, marginTop: 10 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: radius.sm, backgroundColor: colors.cardAlt, alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  btnOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  txt: { color: colors.textSoft, fontSize: 16, fontWeight: '900' }, txtOn: { color: colors.primary },
  sysBtn: { paddingHorizontal: 11, paddingVertical: 12, borderRadius: radius.sm, backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  sysTxt: { color: colors.textSoft, fontSize: 11, fontWeight: '800' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  picked: { color: colors.text, fontSize: 12.5, fontWeight: '800' },
  goBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.sm, backgroundColor: colors.primary },
  goTxt: { color: '#fff', fontSize: 11.5, fontWeight: '900' },
});
