// ANALİZ KRİTERLERİM — kullanıcı analizin hangi verilere göre yapılacağını seçer.
// Her kriter kart: ad + açıklama + Açık/Kapalı + etki seviyesi (Düşük/Orta/Yüksek/Kritik).
// "Analiz Profilini Kaydet" → seçim kalıcı; sonraki bültenlerde otomatik geçerli.
// Kaydedilmeden hiçbir kriter analizde çalışmaz (motor boş başlar).
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Modal, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, shadow } from '../theme';
import { CATEGORIES, criteriaByCategory, IMPACT, IMPACT_ORDER, CRITERIA_INFO } from '../analysis/criteria';
import { getDraftProfile, saveProfile, countOn } from '../analysisProfile';
import { api } from '../api';

const impactColor = (k) => (k === 'low' ? colors.textMuted : k === 'mid' ? colors.warning : k === 'high' ? colors.accent : colors.danger);
const cats = Object.fromEntries(CATEGORIES.map((c) => [c.id, `${c.icon}  ${c.title}`]));
// İsabet rozeti rengi: %60+ yeşil · %50-59 sarı · altı kırmızı · az örnek gri.
const accColor = (p) => (p.lowSample ? colors.textMuted : p.accuracy >= 60 ? colors.success : p.accuracy >= 50 ? colors.warning : colors.danger);

export default function AnalysisSettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [criteria, setCriteria] = useState(() => getDraftProfile().criteria);
  const [toast, setToast] = useState(null);
  const [info, setInfo] = useState(null); // {label, cat, text} — bilgi kutusu
  const [perf, setPerf] = useState(null); // kriter karnesi: key → {accuracy,total,lowSample}
  const [perfNote, setPerfNote] = useState(null);

  // Kriter karnesi (resmi sonuçlara göre hangi kriter ne kadar tutuyor)
  useEffect(() => {
    let alive = true;
    api.criteriaScorecard()
      .then((d) => {
        if (!alive || !d) return;
        setPerfNote(d.note || null);
        if (d.hasData && Array.isArray(d.criteria)) {
          setPerf(Object.fromEntries(d.criteria.map((c) => [c.key, c])));
        }
      })
      .catch(() => {});                    // karne alınamazsa rozetsiz devam (uydurma yok)
    return () => { alive = false; };
  }, []);

  const onCount = useMemo(() => countOn({ criteria }), [criteria]);

  const toggle = (key) => setCriteria((c) => ({ ...c, [key]: { ...c[key], on: !c[key]?.on } }));
  const setImpact = (key, impact) => setCriteria((c) => ({ ...c, [key]: { ...c[key], on: true, impact } }));

  const save = () => {
    saveProfile(criteria);
    setToast(onCount === 0
      ? 'Profil kaydedildi — ama hiç kriter seçmediniz. Analiz için en az bir kriter açın.'
      : `Analiz profili kaydedildi ✓ ${onCount} kriter aktif. Sonraki bültenlerde otomatik uygulanacak.`);
    setTimeout(() => setToast(null), 4000);
  };

  const selectAllIn = (catId, on) => setCriteria((c) => {
    const next = { ...c };
    for (const cr of criteriaByCategory(catId)) next[cr.key] = { ...next[cr.key], on };
    return next;
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 120 }}>
        {/* Başlık */}
        <View style={s.head}>
          <Text style={s.h1}>🧩 Analiz Kriterlerim</Text>
          <Text style={s.hSub}>Analizin hangi verilere göre yapılacağını sen seç. Sistem yalnızca açtığın kriterleri kullanır — kapalı kriterler sonuca, güvene ve riske etki etmez.</Text>
          <View style={s.countBox}>
            <Text style={s.countTxt}>Seçili kriter: <Text style={s.countNum}>{onCount}</Text></Text>
            {onCount === 0 ? <Text style={s.countWarn}>Analiz için en az bir kriter açmalısın.</Text> : null}
          </View>
          {(perf || perfNote) ? (
            <View style={s.perfBox}>
              <Text style={s.perfTitle}>📈 Kriter Karnesi</Text>
              <Text style={s.perfTxt}>
                {perf
                  ? 'Rozetler, her kriterin resmi sonuçlara göre gerçek isabet oranını gösterir (yanındaki sayı: kaç maçta sinyal verdiği).'
                  : null}
                {perfNote ? `${perf ? ' ' : ''}${perfNote}` : ''}
              </Text>
            </View>
          ) : null}
        </View>

        {CATEGORIES.map((cat) => {
          const items = criteriaByCategory(cat.id);
          if (!items.length) return null;
          return (
            <View key={cat.id} style={s.cat}>
              <View style={s.catHead}>
                <Text style={s.catTitle}>{cat.icon}  {cat.title}</Text>
                <View style={s.catActions}>
                  <TouchableOpacity onPress={() => selectAllIn(cat.id, true)} style={s.catBtn}><Text style={s.catBtnTxt}>Tümü Aç</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => selectAllIn(cat.id, false)} style={s.catBtn}><Text style={s.catBtnTxt}>Kapat</Text></TouchableOpacity>
                </View>
              </View>

              {items.map((cr) => {
                const conf = criteria[cr.key] || { on: false, impact: cr.defaultImpact };
                return (
                  <View key={cr.key} style={[s.card, conf.on && s.cardOn]}>
                    <View style={s.cardTop}>
                      <TouchableOpacity
                        style={{ flex: 1, paddingRight: 8 }}
                        activeOpacity={0.7}
                        onPress={() => setInfo({ label: cr.label, cat: cats[cr.cat], text: CRITERIA_INFO[cr.key] || cr.desc })}
                      >
                        <View style={s.crNameRow}>
                          <Text style={s.crName}>{cr.label}</Text>
                          <View style={s.infoDot}><Text style={s.infoDotTxt}>i</Text></View>
                          {perf?.[cr.key] ? (
                            <View style={[s.accBadge, { borderColor: accColor(perf[cr.key]) }]}>
                              <Text style={[s.accTxt, { color: accColor(perf[cr.key]) }]}>
                                %{perf[cr.key].accuracy} · {perf[cr.key].total}{perf[cr.key].lowSample ? ' · az veri' : ''}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={s.crDesc}>{cr.desc}</Text>
                        <Text style={s.crTapHint}>Ne işe yarar? ›</Text>
                      </TouchableOpacity>
                      <Switch
                        value={!!conf.on}
                        onValueChange={() => toggle(cr.key)}
                        trackColor={{ false: colors.border, true: colors.accent }}
                        thumbColor="#fff"
                      />
                    </View>
                    {conf.on ? (
                      <View style={s.impRow}>
                        <Text style={s.impLbl}>Etki:</Text>
                        {IMPACT_ORDER.map((k) => {
                          const on = conf.impact === k;
                          return (
                            <TouchableOpacity key={k} onPress={() => setImpact(cr.key, k)} style={[s.impBtn, on && { backgroundColor: impactColor(k), borderColor: impactColor(k) }]}>
                              <Text style={[s.impTxt, on && { color: '#fff' }]}>{IMPACT[k].label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          );
        })}

        <Text style={s.note}>Not: Takım adı, lig adı gibi kimlik bilgileri kıyaslanabilir olmadığından kriter olarak listelenmez. Kaynağa yeni istatistik eklenirse buraya kriter olarak eklenebilir.</Text>
      </ScrollView>

      {/* Sabit Kaydet çubuğu */}
      <View style={[s.saveBar, { paddingBottom: 12 + (insets.bottom || 0) }]}>
        <TouchableOpacity onPress={save} activeOpacity={0.9} style={s.saveBtn}>
          <Text style={s.saveTxt}>💾  Analiz Profilini Kaydet</Text>
        </TouchableOpacity>
      </View>

      {/* Kriter bilgi kutusu — karta dokununca ekranın ortasında açılır */}
      <Modal visible={!!info} transparent animationType="fade" onRequestClose={() => setInfo(null)}>
        <TouchableOpacity style={s.modalBg} activeOpacity={1} onPress={() => setInfo(null)}>
          <TouchableOpacity style={s.modalCard} activeOpacity={1} onPress={() => {}}>
            {info?.cat ? <Text style={s.modalCat}>{info.cat}</Text> : null}
            <Text style={s.modalTitle}>{info?.label}</Text>
            <Text style={s.modalText}>{info?.text}</Text>
            <TouchableOpacity onPress={() => setInfo(null)} style={s.modalBtn} activeOpacity={0.9}>
              <Text style={s.modalBtnTxt}>Anladım</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Ekranın ORTASINDA beliren kaydet bildirimi (scroll konumundan bağımsız) */}
      {toast ? (
        <View style={s.toastOverlay} pointerEvents="none">
          <View style={[s.toast, onCount === 0 ? s.toastWarn : s.toastOk]}>
            <Text style={s.toastIcon}>{onCount === 0 ? '⚠️' : '✅'}</Text>
            <Text style={s.toastTxt}>{toast}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  head: { marginBottom: spacing.sm },
  h1: { color: colors.text, fontSize: 20, fontWeight: '900' },
  hSub: { color: colors.textSoft, fontSize: 12.5, lineHeight: 18, fontWeight: '600', marginTop: 6 },
  countBox: { marginTop: 10, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 10 },
  countTxt: { color: colors.textSoft, fontSize: 13, fontWeight: '800' },
  countNum: { color: colors.accent, fontWeight: '900' },
  countWarn: { color: colors.danger, fontSize: 12, fontWeight: '800', marginTop: 3 },
  perfBox: { marginTop: 8, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 10 },
  perfTitle: { color: colors.text, fontSize: 12.5, fontWeight: '900' },
  perfTxt: { color: colors.textMuted, fontSize: 11.5, lineHeight: 16, fontWeight: '600', marginTop: 3 },
  accBadge: { borderWidth: 1.2, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  accTxt: { fontSize: 10, fontWeight: '900' },

  toastOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  toast: { maxWidth: 360, borderRadius: radius.lg, paddingVertical: 20, paddingHorizontal: 22, alignItems: 'center', ...shadow.card },
  toastOk: { backgroundColor: colors.success },
  toastWarn: { backgroundColor: colors.warning },
  toastIcon: { fontSize: 34, marginBottom: 8 },
  toastTxt: { color: '#fff', fontSize: 14, fontWeight: '800', lineHeight: 20, textAlign: 'center' },

  cat: { marginTop: spacing.md },
  catHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  catTitle: { color: colors.text, fontSize: 14.5, fontWeight: '900', flex: 1 },
  catActions: { flexDirection: 'row', gap: 6 },
  catBtn: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  catBtnTxt: { color: colors.textSoft, fontSize: 10.5, fontWeight: '800' },

  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.sm },
  cardOn: { borderColor: colors.accent, ...shadow.soft },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  crNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  crName: { color: colors.text, fontSize: 13.5, fontWeight: '900' },
  infoDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.3, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  infoDotTxt: { color: colors.accent, fontSize: 10, fontWeight: '900', fontStyle: 'italic', lineHeight: 12 },
  crDesc: { color: colors.textMuted, fontSize: 11.5, lineHeight: 16, fontWeight: '600', marginTop: 3 },
  crTapHint: { color: colors.accent, fontSize: 10.5, fontWeight: '800', marginTop: 4 },

  impRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  impLbl: { color: colors.textMuted, fontSize: 11.5, fontWeight: '800' },
  impBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  impTxt: { color: colors.textSoft, fontSize: 11, fontWeight: '800' },

  note: { color: colors.textMuted, fontSize: 11, lineHeight: 16, fontWeight: '600', marginTop: spacing.md, fontStyle: 'italic' },

  saveBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.md, paddingTop: 12, backgroundColor: colors.bgAlt, borderTopWidth: 1, borderTopColor: colors.border },
  saveBtn: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center', ...shadow.card },
  saveTxt: { color: '#fff', fontSize: 15, fontWeight: '900' },

  modalBg: { flex: 1, backgroundColor: 'rgba(11,27,58,0.55)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  modalCard: { width: '100%', maxWidth: 400, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.xl, ...shadow.card },
  modalCat: { color: colors.textMuted, fontSize: 11.5, fontWeight: '800', marginBottom: 4 },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  modalText: { color: colors.textSoft, fontSize: 13.5, lineHeight: 21, fontWeight: '600', marginTop: 10 },
  modalBtn: { marginTop: 18, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  modalBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
