// ANALİZ KRİTERLERİM — kullanıcı analizin hangi verilere göre yapılacağını seçer.
// Katalog ve kriter karnesi BACKEND'den gelir (tek doğruluk kaynağı); bu ekran
// yalnız katalog + kullanıcı seçimleri + karne/açıklama gösterir.
// Yenilikler: çoklu profil (kaydet=yeni sürüm, kopyala, sil, varsayılan),
// Manuel/Akıllı Destek modu, global filtreler, kriter arama + durum filtreleri,
// veri var/yok rozetleri, zenginleştirilmiş bilgi penceresi.
// Mevcut tasarım dili korunur; kapalı kriter analize HİÇ etki etmez.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Modal, TextInput, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, shadow } from '../theme';
import { CATEGORIES, criteriaByCategory, IMPACT, IMPACT_ORDER, CRITERIA_INFO } from '../analysis/criteria';
import {
  getDraftProfile, saveProfile, countOn, listProfiles, setActiveProfile,
  createProfileLocal, duplicateActiveProfile, renameActiveProfile, deleteProfileLocal,
  DEFAULT_GLOBAL_FILTERS,
} from '../analysisProfile';
import { getCriteriaScorecardIndex, getCriteriaCatalog } from '../services/masterAnalysisService';
import { api } from '../api';
import { criteriaBadgeUsable } from '../scorecardLogic';

const impactColor = (k) => (k === 'low' ? colors.textMuted : k === 'mid' ? colors.warning : k === 'high' ? colors.accent : colors.danger);
const cats = Object.fromEntries(CATEGORIES.map((c) => [c.id, `${c.icon}  ${c.title}`]));
// İsabet rozeti rengi: %60+ yeşil · %50-59 sarı · altı kırmızı · az örnek gri.
const accColor = (p) => (p.lowSample ? colors.textMuted : p.accuracy >= 60 ? colors.success : p.accuracy >= 50 ? colors.warning : colors.danger);

const STATUS_FILTERS = [
  { k: 'all', label: 'Tümü' },
  { k: 'on', label: 'Açık' },
  { k: 'off', label: 'Kapalı' },
  { k: 'hasData', label: 'Veri var' },
  { k: 'noData', label: 'Veri yok' },
  { k: 'rising', label: '📈 Yükselişte' },
  { k: 'falling', label: '📉 Düşüşte' },
];

const PERIOD_OPTS = [{ k: 'season', l: 'Bu sezon' }, { k: 'last5', l: 'Son 5' }, { k: 'blend', l: 'Sezon+Son5' }];
const VENUE_OPTS = [{ k: 'overall', l: 'Genel' }, { k: 'split', l: 'Ev içi/Dep dışı' }, { k: 'weighted', l: 'İç/Dış ağırlıklı' }];
const OPP_OPTS = [{ k: 'all', l: 'Tüm rakipler' }, { k: 'strong', l: 'Güçlüye karşı' }, { k: 'mid', l: 'Ortaya karşı' }, { k: 'weak', l: 'Zayıfa karşı' }];

export default function AnalysisSettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const draft = getDraftProfile();
  const [criteria, setCriteria] = useState(() => draft.criteria);
  const [mode, setMode] = useState(draft.mode || 'manual');
  const [gFilters, setGFilters] = useState(draft.globalFilters || { ...DEFAULT_GLOBAL_FILTERS });
  const [profiles, setProfiles] = useState(() => listProfiles());
  const [profModal, setProfModal] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toast, setToast] = useState(null);
  const [info, setInfo] = useState(null);
  const [perf, setPerf] = useState(null);        // yeni motor karnesi: key → satır
  const [perfNote, setPerfNote] = useState(null);
  const [catalogMeta, setCatalogMeta] = useState(null); // key → backend katalog metası

  const reloadDraft = () => {
    const d = getDraftProfile();
    setCriteria(d.criteria);
    setMode(d.mode || 'manual');
    setGFilters(d.globalFilters || { ...DEFAULT_GLOBAL_FILTERS });
    setProfiles(listProfiles());
  };

  // Kriter karnesi (YENİ motor: mühürlü değerlendirme × resmî sonuç) + katalog metası.
  // Yeni uç yoksa eski criteriaScorecard'a düşülür — rozetler yine gerçek veridir.
  useEffect(() => {
    let alive = true;
    getCriteriaScorecardIndex().then(({ byKey, note }) => {
      if (!alive) return;
      if (byKey) {
        setPerf(Object.fromEntries(Object.entries(byKey).map(([k, c]) => [k, {
          accuracy: c.accuracy, shrunk: c.shrunkAccuracy, total: c.signals,
          lowSample: !c.sample?.usable, sampleLabel: c.sample?.label, trend: c.trend,
          coverage: c.coverage, noData: c.noData, informational: c.informational,
        }])));
        setPerfNote(note || null);
      } else {
        api.criteriaScorecard().then((d) => {
          if (!alive || !d) return;
          setPerfNote(d.note || null);
          // PROVENANCE KORUMASI: rozetler yalnız official_forward veriden dolar.
          // Demo/backfill/retrospektif veya kanıt alanı olmayan yanıt rozet ÜRETMEZ.
          if (criteriaBadgeUsable(d) && Array.isArray(d.criteria)) {
            setPerf(Object.fromEntries(d.criteria.map((c) => [c.key, { accuracy: c.accuracy, total: c.total, lowSample: c.lowSample }])));
          }
        }).catch(() => {});
      }
    });
    getCriteriaCatalog().then((d) => {
      if (!alive || !d?.criteria) return;
      setCatalogMeta(Object.fromEntries(d.criteria.map((c) => [c.key, c])));
    });
    return () => { alive = false; };
  }, []);

  const onCount = useMemo(() => countOn({ criteria }), [criteria]);

  const toggle = (key) => setCriteria((c) => ({ ...c, [key]: { ...c[key], on: !c[key]?.on } }));
  const setImpact = (key, impact) => setCriteria((c) => ({ ...c, [key]: { ...c[key], on: true, impact } }));

  const save = () => {
    // Genel filtre bu ekrandan kalktı → profile YAZILMAZ (görünmez filtre kalmasın).
    const p = saveProfile(criteria, null, { mode });
    setProfiles(listProfiles());
    setToast(onCount === 0
      ? 'Profil kaydedildi — ama hiç kriter seçmediniz. Analiz için en az bir kriter açın.'
      : `"${p.name}" v${p.version} olarak kaydedildi ✓ ${onCount} kriter aktif. Eski sürümler korunur; mühürlü analizler kendi sürümünde kalır.`);
    setTimeout(() => setToast(null), 4000);
  };

  const selectAllIn = (catId, on) => setCriteria((c) => {
    const next = { ...c };
    for (const cr of criteriaByCategory(catId)) next[cr.key] = { ...next[cr.key], on };
    return next;
  });

  // Kriter görünür mü? (arama + durum filtresi)
  const visible = (cr) => {
    if (search && !`${cr.label} ${cr.key}`.toLowerCase().includes(search.toLowerCase())) return false;
    const conf = criteria[cr.key];
    const avail = catalogMeta?.[cr.key]?.currentAvailability;
    const hasData = avail ? avail.available > 0 : null;
    const trend = perf?.[cr.key]?.trend;
    switch (statusFilter) {
      case 'on': return !!conf?.on;
      case 'off': return !conf?.on;
      case 'hasData': return hasData !== false;
      case 'noData': return hasData === false;
      case 'rising': return trend === 'rising';
      case 'falling': return trend === 'falling';
      default: return true;
    }
  };

  const openInfo = (cr) => {
    const meta = catalogMeta?.[cr.key];
    const p = perf?.[cr.key];
    const avail = meta?.currentAvailability;
    const lines = [];
    lines.push(meta?.detailedExplanation || CRITERIA_INFO[cr.key] || cr.desc);
    if (meta?.whenMisleading) lines.push(`⚠ Ne zaman yanıltır: ${meta.whenMisleading}`);
    if (meta?.dataSources?.length) lines.push(`📡 Veri kaynağı: ${meta.dataSources.join(', ')}`);
    if (avail) lines.push(`📶 Bu bültende veri: ${avail.available}/${avail.total} maçta mevcut.`);
    if (p?.informational) lines.push('ℹ️ Bilgi kriteri — yön üretmez, tahmin doğruluğu ölçülmez.');
    else if (p?.total > 0) lines.push(`📈 Geçmiş karne: %${p.shrunk ?? p.accuracy} isabet (n=${p.total}${p.sampleLabel ? `, ${p.sampleLabel} örneklem` : ''}${p.coverage != null ? ` · kapsama %${p.coverage}` : ''}${p.trend ? ` · eğilim: ${p.trend === 'rising' ? 'yükseliyor' : p.trend === 'falling' ? 'düşüyor' : 'yatay'}` : ''}).`);
    else lines.push('📈 Geçmiş karne: henüz mühürlü sonuç yok — resmi sonuçlar geldikçe dolacak (uydurma başarı gösterilmez).');
    setInfo({ label: cr.label, cat: cats[cr.cat], text: lines.join('\n\n') });
  };

  const FilterChips = ({ value, opts, onSet }) => (
    <View style={s.filterRow}>
      {opts.map((o) => {
        const on = value === o.k;
        return (
          <TouchableOpacity key={o.k} onPress={() => onSet(o.k)} style={[s.fChip, on && s.fChipOn]}>
            <Text style={[s.fChipTxt, on && s.fChipTxtOn]}>{o.l}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 120 }}>
        {/* Başlık */}
        <View style={s.head}>
          <Text style={s.h1}>🧩 Analiz Kriterlerim</Text>
          <Text style={s.hSub}>Analizin hangi verilere göre yapılacağını sen seç. Sistem yalnızca açtığın kriterleri kullanır — kapalı kriterler sonuca, güvene ve riske etki etmez.</Text>

          {/* PROFİL ÇUBUĞU */}
          <View style={s.profileBar}>
            <View style={{ flex: 1 }}>
              <Text style={s.profileName}>👤 {draft.name || 'Profil'} <Text style={s.profileVer}>v{draft.version || 1}</Text></Text>
              <Text style={s.profileSub}>Seçili: {onCount} · Verisi olan: {catalogMeta ? Object.values(catalogMeta).filter((c) => c.currentAvailability?.available > 0).length : '—'}/40</Text>
            </View>
            <TouchableOpacity onPress={() => { setProfModal(true); setNameInput(''); }} style={s.profileBtn}>
              <Text style={s.profileBtnTxt}>Profiller ›</Text>
            </TouchableOpacity>
          </View>

          {/* MOD SEÇİMİ */}
          <View style={s.modeRow}>
            {[{ k: 'manual', l: 'Manuel Mod', d: 'Yalnız senin etki seviyelerin; karne bilgi amaçlı.' }, { k: 'smart', l: 'Akıllı Destek', d: 'Yeterli örnekli kriter karnesi ağırlığı sınırlı ayarlar.' }].map((mo) => {
              const on = mode === mo.k;
              return (
                <TouchableOpacity key={mo.k} onPress={() => setMode(mo.k)} style={[s.modeBtn, on && s.modeBtnOn]}>
                  <Text style={[s.modeTxt, on && s.modeTxtOn]}>{mo.l}</Text>
                  <Text style={[s.modeDesc, on && s.modeDescOn]}>{mo.d}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* GENEL FİLTRELER BURADAN KALDIRILDI (kullanıcı kararı): üstten seçilen
              ayarın her kritere körlemesine yayılması istenmedi. Filtreli görünüm
              artık Maç Detayı → İstatistik sekmesindedir; analiz motoru için
              kriter-bazlı filtre desteği motorda hazırdır. */}

          {/* ARAMA + DURUM FİLTRELERİ */}
          <TextInput
            style={s.search}
            placeholder="Kriter ara…"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.statusRow}>
            {STATUS_FILTERS.map((f) => {
              const on = statusFilter === f.k;
              return (
                <TouchableOpacity key={f.k} onPress={() => setStatusFilter(on ? 'all' : f.k)} style={[s.fChip, on && s.fChipOn]}>
                  <Text style={[s.fChipTxt, on && s.fChipTxtOn]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {(perf || perfNote) ? (
            <View style={s.perfBox}>
              <Text style={s.perfTitle}>📈 Kriter Karnesi</Text>
              <Text style={s.perfTxt}>
                {perf ? 'Rozetler her kriterin MÜHÜRLÜ maç-öncesi sinyalleri × resmî 90 dk sonuçlarına göre gerçek isabetini gösterir (n = sinyal sayısı; küçük örneklem gri).' : null}
                {perfNote ? `${perf ? ' ' : ''}${perfNote}` : ''}
              </Text>
            </View>
          ) : null}
        </View>

        {CATEGORIES.map((cat) => {
          const items = criteriaByCategory(cat.id).filter(visible);
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
                const meta = catalogMeta?.[cr.key];
                const avail = meta?.currentAvailability;
                const hasData = avail ? avail.available > 0 : null;
                const p = perf?.[cr.key];
                return (
                  <View key={cr.key} style={[s.card, conf.on && s.cardOn]}>
                    <View style={s.cardTop}>
                      <TouchableOpacity style={{ flex: 1, paddingRight: 8 }} activeOpacity={0.7} onPress={() => openInfo(cr)}>
                        <View style={s.crNameRow}>
                          <Text style={s.crName}>{cr.label}</Text>
                          <View style={s.infoDot}><Text style={s.infoDotTxt}>i</Text></View>
                          {hasData != null ? (
                            <View style={[s.dataDot, { backgroundColor: hasData ? colors.success : colors.danger }]} />
                          ) : null}
                          {p && !p.informational && p.total > 0 ? (
                            <View style={[s.accBadge, { borderColor: accColor({ lowSample: p.lowSample, accuracy: p.shrunk ?? p.accuracy }) }]}>
                              <Text style={[s.accTxt, { color: accColor({ lowSample: p.lowSample, accuracy: p.shrunk ?? p.accuracy }) }]}>
                                %{p.shrunk ?? p.accuracy} · n={p.total}{p.lowSample ? ' · az veri' : ''}{p.trend === 'rising' ? ' 📈' : p.trend === 'falling' ? ' 📉' : ''}
                              </Text>
                            </View>
                          ) : null}
                          {meta?.familyLabel ? <View style={s.famChip}><Text style={s.famChipTxt}>{meta.familyLabel}</Text></View> : null}
                        </View>
                        <Text style={s.crDesc}>{cr.desc}</Text>
                        {hasData === false ? <Text style={s.noDataTxt}>Bu bültende veri yok — açsan da analiz dışı kalır (uydurulmaz).</Text> : null}
                        <Text style={s.crTapHint}>Ne işe yarar? · Karne · Kaynak ›</Text>
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

        <Text style={s.note}>Not: Kriter hesapları backend'de merkezî yapılır ve bülten kilidiyle mühürlenir; kapalı kriterler "gölge değerlendirme" ile ölçülmeye devam eder ama analize asla karışmaz. Yeni kriter yalnız gerçek veri kaynağı eklenirse katalog sürümüyle gelir.</Text>
      </ScrollView>

      {/* Sabit Kaydet çubuğu */}
      <View style={[s.saveBar, { paddingBottom: 12 + (insets.bottom || 0) }]}>
        <TouchableOpacity onPress={save} activeOpacity={0.9} style={s.saveBtn}>
          <Text style={s.saveTxt}>💾  Analiz Profilini Kaydet (yeni sürüm)</Text>
        </TouchableOpacity>
      </View>

      {/* PROFİL YÖNETİMİ */}
      <Modal visible={profModal} transparent animationType="fade" onRequestClose={() => setProfModal(false)}>
        <TouchableOpacity style={s.modalBg} activeOpacity={1} onPress={() => setProfModal(false)}>
          <TouchableOpacity style={s.modalCard} activeOpacity={1} onPress={() => {}}>
            <Text style={s.modalTitle}>Analiz Profilleri</Text>
            {profiles.map((p) => (
              <TouchableOpacity key={p.id} onPress={() => { setActiveProfile(p.id); reloadDraft(); setProfModal(false); }} style={[s.profRow, p.active && s.profRowOn]}>
                <Text style={[s.profRowTxt, p.active && { color: '#fff' }]}>{p.active ? '✓ ' : ''}{p.name} <Text style={[s.profRowSub, p.active && { color: 'rgba(255,255,255,0.8)' }]}>v{p.currentVersion} · {p.onCount} kriter · {p.mode === 'smart' ? 'Akıllı' : 'Manuel'}</Text></Text>
                {profiles.length > 1 ? (
                  <TouchableOpacity onPress={() => { deleteProfileLocal(p.id); reloadDraft(); }} style={s.profDel}>
                    <Text style={s.profDelTxt}>Sil</Text>
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            ))}
            <TextInput
              style={s.search}
              placeholder="Yeni profil / yeni ad…"
              placeholderTextColor={colors.textMuted}
              value={nameInput}
              onChangeText={setNameInput}
            />
            <View style={s.profActions}>
              <TouchableOpacity onPress={() => { createProfileLocal(nameInput || null); reloadDraft(); setNameInput(''); }} style={s.profActBtn}><Text style={s.profActTxt}>+ Yeni</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => { duplicateActiveProfile(nameInput || null); reloadDraft(); setNameInput(''); }} style={s.profActBtn}><Text style={s.profActTxt}>Kopyala</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => { if (nameInput) { renameActiveProfile(nameInput); reloadDraft(); setNameInput(''); } }} style={s.profActBtn}><Text style={s.profActTxt}>Yeniden Adlandır</Text></TouchableOpacity>
            </View>
            <Text style={s.profNote}>Hazır başlangıçlar için "Yeni" ile boş profil açıp örneğin "Dengeli Analiz", "Sürpriz Avcısı", "xG Odaklı" adını verebilirsin. Kaydet her zaman YENİ sürüm oluşturur; mühürlü analizler eski sürümde kalır.</Text>
            <TouchableOpacity onPress={() => setProfModal(false)} style={s.modalBtn} activeOpacity={0.9}>
              <Text style={s.modalBtnTxt}>Kapat</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Kriter bilgi kutusu */}
      <Modal visible={!!info} transparent animationType="fade" onRequestClose={() => setInfo(null)}>
        <TouchableOpacity style={s.modalBg} activeOpacity={1} onPress={() => setInfo(null)}>
          <TouchableOpacity style={s.modalCard} activeOpacity={1} onPress={() => {}}>
            {info?.cat ? <Text style={s.modalCat}>{info.cat}</Text> : null}
            <Text style={s.modalTitle}>{info?.label}</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              <Text style={s.modalText}>{info?.text}</Text>
            </ScrollView>
            <TouchableOpacity onPress={() => setInfo(null)} style={s.modalBtn} activeOpacity={0.9}>
              <Text style={s.modalBtnTxt}>Anladım</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Kaydet bildirimi */}
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

  profileBar: { marginTop: 10, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileName: { color: colors.text, fontSize: 13.5, fontWeight: '900' },
  profileVer: { color: colors.accent, fontSize: 11.5, fontWeight: '900' },
  profileSub: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  profileBtn: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8 },
  profileBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '900' },

  modeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  modeBtn: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, padding: 10 },
  modeBtnOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  modeTxt: { color: colors.text, fontSize: 12.5, fontWeight: '900' },
  modeTxtOn: { color: colors.accent },
  modeDesc: { color: colors.textMuted, fontSize: 10, lineHeight: 13, marginTop: 3, fontWeight: '600' },
  modeDescOn: { color: colors.textSoft },

  filterToggle: { marginTop: 8, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 10 },
  filterToggleTxt: { color: colors.text, fontSize: 12.5, fontWeight: '800' },
  filterSummary: { color: colors.textMuted, fontSize: 10.5, fontWeight: '700' },
  filterBox: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 10, marginTop: 6 },
  filterLbl: { color: colors.textMuted, fontSize: 11, fontWeight: '800', marginTop: 6, marginBottom: 4 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filterNote: { color: colors.textMuted, fontSize: 10.5, lineHeight: 14, marginTop: 8, fontStyle: 'italic' },
  fChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  fChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  fChipTxt: { color: colors.textSoft, fontSize: 11, fontWeight: '800' },
  fChipTxtOn: { color: '#fff' },

  search: { marginTop: 8, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 9, color: colors.text, fontSize: 13 },
  statusRow: { flexDirection: 'row', gap: 6, paddingVertical: 8 },

  perfBox: { marginTop: 2, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 10 },
  perfTitle: { color: colors.text, fontSize: 12.5, fontWeight: '900' },
  perfTxt: { color: colors.textMuted, fontSize: 11.5, lineHeight: 16, fontWeight: '600', marginTop: 3 },
  accBadge: { borderWidth: 1.2, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  accTxt: { fontSize: 10, fontWeight: '900' },
  dataDot: { width: 8, height: 8, borderRadius: 4 },
  famChip: { backgroundColor: colors.surfaceSoft, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 6, paddingVertical: 2 },
  famChipTxt: { color: colors.textMuted, fontSize: 9, fontWeight: '800' },
  noDataTxt: { color: colors.warning, fontSize: 10.5, fontWeight: '700', marginTop: 3 },

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
  crNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
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
  modalCard: { width: '100%', maxWidth: 420, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.xl, ...shadow.card },
  modalCat: { color: colors.textMuted, fontSize: 11.5, fontWeight: '800', marginBottom: 4 },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  modalText: { color: colors.textSoft, fontSize: 13.5, lineHeight: 21, fontWeight: '600', marginTop: 10 },
  modalBtn: { marginTop: 18, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  modalBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '900' },

  profRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceSoft, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: 10, marginTop: 8 },
  profRowOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  profRowTxt: { flex: 1, color: colors.text, fontSize: 12.5, fontWeight: '800' },
  profRowSub: { color: colors.textMuted, fontSize: 10.5, fontWeight: '700' },
  profDel: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm, backgroundColor: colors.dangerSoft },
  profDelTxt: { color: colors.danger, fontSize: 10.5, fontWeight: '900' },
  profActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  profActBtn: { flex: 1, backgroundColor: colors.cardAlt, borderRadius: radius.sm, paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  profActTxt: { color: colors.text, fontSize: 11.5, fontWeight: '800' },
  profNote: { color: colors.textMuted, fontSize: 10.5, lineHeight: 15, marginTop: 10, fontStyle: 'italic' },
});
