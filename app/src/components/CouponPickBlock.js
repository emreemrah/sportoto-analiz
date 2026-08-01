// Maç detayında KUPON SEÇİM bloğu — analiz görürken [1][X][2] + Sistemden al.
// Seçim paylaşılan TASLAK'a işlenir; Kupon Oluştur'dan kaydedilir. Kilit sonrası
// sadece görüntüleme. Yalnız resmi TEYİTLİ güncel bültendeki maçta görünür.
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius, shadow } from '../theme';
import { setDraftPick } from '../coupon/store';
import { isMatchLocked } from '../couponConfig';
import { userSelectedAnalysisEngine } from '../analysis/engine';
import { getActiveProfile, countOn, ensureDefaultProfile } from '../analysisProfile';

const OUT = ['1', 'X', '2'];

export default function CouponPickBlock({ m, navigation }) {
  // Otomatik gelmez — kullanıcı 1/X/2 seçer veya "Sistemden al"a basar.
  const [pick, setPick] = useState([]);
  if (!m || m.verificationStatus !== 'confirmed' || m.roundId == null) return null;
  // KİLİT MAÇ BAZINDA: yalnız BU maç başladıysa seçim donar; bülten mühürlense
  // bile başlamamış maça hafta boyunca seçim yapılabilir. Maç saati yoksa
  // (belirsizlik) eski bülten kapanışına düşülür — asla habersiz açık kalmaz.
  const locked = m.date
    ? isMatchLocked(m)
    : (m.closeDate && Date.now() >= new Date(m.closeDate).getTime());

  const write = (arr) => { setPick(arr); setDraftPick(m.roundId, m.no, arr); };
  const toggle = (o) => { if (locked) return; const set = new Set(pick); set.has(o) ? set.delete(o) : set.add(o); write(OUT.filter((x) => set.has(x))); };
  // "Sistemden al" → AKTİF ANALİZ PROFİLİ'ne göre Ana Seçim (1X / X2 / 1X2 vb.).
  // Profil yoksa/boşsa analiz üretilmez → kullanıcıyı kriter seçimine yönlendir.
  const fromSystem = () => {
    if (locked) return;
    let profile = getActiveProfile();
    if (!profile) profile = ensureDefaultProfile();   // kurulum istemeden çalışır
    if (!profile || countOn(profile) === 0) { navigation.navigate('AnalysisSettings'); return; }
    const main = userSelectedAnalysisEngine(m, profile)?.verdict?.main || '';
    write(OUT.filter((o) => main.includes(o)));
  };

  return (
    <View style={s.block}>
      <Text style={s.title}>🎟️ KUPONA İŞLE</Text>
      <Text style={s.sub}>Analizi gördün — seçimini yap. Kupon taslağına işlenir, Kupon Oluştur'dan kaydedersin.</Text>
      {locked ? (
        <Text style={s.locked}>🔒 Maç başladı — bu maç için seçim değiştirilemez.</Text>
      ) : (
        <>
          <View style={s.row}>
            {OUT.map((o) => { const on = pick.includes(o); return (
              <TouchableOpacity key={o} onPress={() => toggle(o)} activeOpacity={0.85} style={[s.btn, on && s.btnOn]}>
                {on ? <Text style={s.check}>✓</Text> : null}
                <Text style={[s.txt, on && s.txtOn]}>{o}</Text>
              </TouchableOpacity>
            ); })}
            <TouchableOpacity onPress={fromSystem} activeOpacity={0.85} style={s.sysBtn}><Text style={s.sysTxt}>⚙ Sistemden al</Text></TouchableOpacity>
          </View>
          <View style={s.footer}>
            {pick.length ? (
              <View style={s.pickedWrap}>
                <Text style={s.pickedLbl}>Seçimin:</Text>
                {pick.map((o) => <View key={o} style={s.pickedPill}><Text style={s.pickedPillTxt}>{o}</Text></View>)}
              </View>
            ) : <Text style={s.noneTxt}>Henüz seçim yok — 1/X/2 seç ya da “Sistemden al”</Text>}
            <TouchableOpacity onPress={() => navigation.navigate('CouponEditor', { roundId: m.roundId })} style={s.goBtn}><Text style={s.goTxt}>Kupon Oluştur ›</Text></TouchableOpacity>
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
  btn: { flex: 1, flexDirection: 'row', gap: 4, paddingVertical: 12, borderRadius: radius.sm, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  btnOn: { backgroundColor: colors.primary, borderColor: colors.primary, ...shadow.soft },
  txt: { color: colors.textSoft, fontSize: 16, fontWeight: '900' }, txtOn: { color: '#fff' },
  check: { color: '#fff', fontSize: 12, fontWeight: '900' },
  sysBtn: { paddingHorizontal: 11, paddingVertical: 12, borderRadius: radius.sm, backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  sysTxt: { color: colors.primary, fontSize: 11, fontWeight: '900' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 8 },
  pickedWrap: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  pickedLbl: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  pickedPill: { minWidth: 22, height: 22, paddingHorizontal: 5, borderRadius: 6, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  pickedPillTxt: { color: '#fff', fontSize: 12.5, fontWeight: '900' },
  noneTxt: { color: colors.textMuted, fontSize: 11, fontWeight: '700', flex: 1 },
  goBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm, backgroundColor: colors.primary },
  goTxt: { color: '#fff', fontSize: 11.5, fontWeight: '900' },
});
