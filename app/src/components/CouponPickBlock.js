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
    /* OLABİLDİĞİNCE KÜÇÜK (kullanıcı isteği, 2026-08-06). Blok beş satırdı:
       başlık, iki satırlık açıklama, düğmeler, "Henüz seçim yok…" ipucu ve
       "Seçimin: 1" tekrarı. İkisi de gereksizdi — seçilen işaret ZATEN kendi
       düğmesinde ✓ ve dolgu ile görünüyor; açıklama da düğmelerin yaptığı işi
       kelimeyle anlatıyordu. Şimdi iki satır: başlık + Kupon Oluştur yan yana,
       altında 1/X/2 + Sistemden al. Hiçbir işlev kaybolmadı. */
    <View style={s.block}>
      <View style={s.head}>
        <Text style={s.title}>🎟️ KUPONA İŞLE</Text>
        {!locked ? (
          <TouchableOpacity
            onPress={() => navigation.navigate('CouponEditor', { roundId: m.roundId })}
            style={s.goBtn}
            activeOpacity={0.85}
          >
            <Text style={s.goTxt}>Kupon Oluştur ›</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {locked ? (
        <Text style={s.locked}>🔒 Maç başladı — bu maç için seçim değiştirilemez.</Text>
      ) : (
        <View style={s.row}>
          {OUT.map((o) => { const on = pick.includes(o); return (
            <TouchableOpacity
              key={o}
              onPress={() => toggle(o)}
              activeOpacity={0.85}
              style={[s.btn, on && s.btnOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${o} işareti${on ? ' — seçili' : ''}`}
            >
              {on ? <Text style={s.check}>✓</Text> : null}
              <Text style={[s.txt, on && s.txtOn]}>{o}</Text>
            </TouchableOpacity>
          ); })}
          <TouchableOpacity onPress={fromSystem} activeOpacity={0.85} style={s.sysBtn}>
            <Text style={s.sysTxt} numberOfLines={1}>⚙ Sistemden al</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  block: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary, padding: 8, marginBottom: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { color: colors.primary, fontSize: 11, fontWeight: '900', letterSpacing: 0.3, flexShrink: 1 },
  locked: { color: colors.warning, fontSize: 11.5, fontWeight: '800', marginTop: 6 },
  row: { flexDirection: 'row', gap: 6, marginTop: 7 },
  btn: { flex: 1, flexDirection: 'row', gap: 4, paddingVertical: 7, borderRadius: radius.sm, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  btnOn: { backgroundColor: colors.primary, borderColor: colors.primary, ...shadow.soft },
  txt: { color: colors.textSoft, fontSize: 14, fontWeight: '900' }, txtOn: { color: '#fff' },
  check: { color: '#fff', fontSize: 11, fontWeight: '900' },
  // Sistemden al, üç işaret kutusuyla aynı yükseklikte kalsın diye flexShrink'li:
  // uzun metinde küçülür, satırı alta itmez.
  sysBtn: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: radius.sm, backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', flexShrink: 1 },
  sysTxt: { color: colors.primary, fontSize: 10.5, fontWeight: '900' },
  goBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: colors.primary },
  goTxt: { color: '#fff', fontSize: 10.5, fontWeight: '900' },
});
