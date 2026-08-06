// KUPON EDİTÖRÜ — Kupon Merkezi'nin hazırlama ekranı (sıfırdan).
// • Resmi bültendeki 15 maç, bülten SIRASI bozulmadan listelenir.
// • Her maçta 1/X/2 tekli-çifte-üçlü; kolon + maliyet ANLIK güncellenir.
// • Maliyet yalnız GERÇEK fiyat verisiyle (couponPricing: kaynak+tarih) görünür;
//   veri yoksa "birim bedel verisi yok" denir — yanlış maliyet gösterilmez.
// • Analizden aktarım (Sistem/Radar) ve Akıllı Kupon ASLA seçimleri sessizce
//   değiştirmez: önce fark listesi gösterilir, karar kullanıcınındır.
// • Kilitli haftada düzenleme/oluşturma YOK (geriye dönük başarı üretilmez).
// • Teknik detaylar satır içi "detay" açılırında kalır — ana ekran sade.
//
// GÖRÜNÜM (kullanıcı isteği: "kuponlarım kısmını da yayıncı modundaki gibi
// görsellerden yapalım"): yayın stüdyosunun RESMÎ BÜLTEN TABLOSU. Satır =
// sıra no · ev arması · takım adları · konuk arması · 1-0-2 kutuları. Tablo
// parçaları couponStudioParts.js'ten gelir; burada ikinci bir tablo yazılmaz.
// Armalar zaten bültenle geliyordu (m.home.logo / m.away.logo) — yalnız
// çizilmiyordu.
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { uyari } from '../components/Uyari';
import { api } from '../api';
import { S, R, SP, TABLE } from '../studioTheme';
import { fontOf, TABULAR } from '../studioFonts';
import {
  Tablo, Thead, Th, Tfoot, MacSatiri, AltBilgi, SayiKutu, Dugme, Giris, Not, PickBoxes,
  useKuponOlcek,
} from './couponStudioParts';
import { OUTCOMES, columnCount, costOf, validPricing, COUPON_MAX_COLUMNS, lockAtOf, lockMapOf } from '../couponConfig';
import { getCoupon, finalVersion, createCoupon, addVersion, renameCoupon, getDraft, clearDraft } from '../coupon/store';
import { buildSmartCoupon, diffSelections, proposalFrom, signalsOf } from '../coupon/smart';
import { getActiveProfile, countOn } from '../analysisProfile';
import { kriterAktarimi } from '../kriterAktarim';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
// Backend etiketi ('BANKO' gibi) EKRANA HAM BASILMAZ; sözlükten geçirilir.
import { displayLabel } from '../labels';

const fmtTL = (n) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} TL`;

export default function CouponEditorScreen({ route, navigation }) {
  const { roundId, couponId } = route.params || {};
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [picks, setPicks] = useState({});           // { no: ['1','X'] }
  const [name, setName] = useState('');
  const [openNo, setOpenNo] = useState(null);       // detay açık maç
  const [importState, setImportState] = useState(null); // { title, changes, proposed, notes }
  const [kriterSecim, setKriterSecim] = useState(false); // tekli/geniş seçim penceresi
  const [kriterYukleniyor, setKriterYukleniyor] = useState(false);
  const [smartOpen, setSmartOpen] = useState(false);
  const [budgetTxt, setBudgetTxt] = useState('');
  const [target, setTarget] = useState(13);
  const [smartPreview, setSmartPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  // Ölçek/punto/font — koşullu return'lerden ÖNCE (kanca sırası bozulmasın).
  const { k, t, f, dar } = useKuponOlcek();

  const load = useCallback(async () => {
    try { setError(null); setData(await api.bulletin()); }
    catch (e) { setError(e.message || 'Bülten alınamadı.'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Başlangıç seçimi: mevcut kupon → final versiyon; yeni kupon → KUPONA İŞLE taslağı.
  useEffect(() => {
    if (couponId) {
      const c = getCoupon(couponId);
      const v = c ? finalVersion(c) : null;
      if (v) {
        const p = {}; for (const sc of v.selections) if (sc.selectedOutcomes?.length) p[sc.no] = sc.selectedOutcomes;
        setPicks(p); setName(c.name || '');
        return;
      }
    }
    const d = getDraft(roundId);
    if (d?.picks && Object.keys(d.picks).length) setPicks({ ...d.picks });
  }, [couponId, roundId]);

  // YENİ kuponda başlamış maçların taslak seçimleri DÜŞÜRÜLÜR: taslak kayıtlı
  // kupon değildir; kilitten önce yapıldığı kanıtlanamaz. Dürüst kural gereği
  // bu maçlar boş kalır ve ekranda "başladı — boş" olarak açıkça görünür.
  useEffect(() => {
    if (!data || couponId) return;
    const lm = lockMapOf(data.matches || []);
    const t = Date.now();
    setPicks((p) => {
      const next = { ...p };
      let changed = false;
      for (const no of Object.keys(next)) {
        const la = lm[no];
        if (la != null && t >= la) { delete next[no]; changed = true; }
      }
      return changed ? next : p;
    });
  }, [data, couponId]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <LoadingState message="Bülten yükleniyor…" />;
  if (data.roundId !== roundId) {
    return <ErrorState message="Bu hafta güncel bülten değil — kupon yalnız güncel bültende hazırlanır." onRetry={load} />;
  }

  const matches = data.matches || [];                        // bülten sırası korunur
  const lockAt = lockAtOf(matches);
  // KİLİT MAÇ BAZINDA: başlamış maçta seçim donar, kalanlar hafta boyu serbest.
  const lockMap = lockMapOf(matches);
  const now = Date.now();
  const lockedNos = new Set(matches.filter((m) => lockMap[m.no] != null && now >= lockMap[m.no]).map((m) => m.no));
  const allLocked = matches.length > 0 && lockedNos.size === matches.length;
  const someLocked = lockedNos.size > 0;
  const pricing = validPricing(data.couponPricing) ? data.couponPricing : null;

  const selections = matches.map((m) => ({ no: m.no, selectedOutcomes: picks[m.no] || [] }));
  const filled = selections.filter((s) => s.selectedOutcomes.length);
  const cols = columnCount(filled.length ? filled : [{ selectedOutcomes: [] }]);
  const cost = costOf(cols, pricing);
  const overLimit = cols > COUPON_MAX_COLUMNS;
  // Tamamlık: BAŞLAMAMIŞ maçların hepsi seçili olmalı; başlamış (kilitli) ve
  // boş kalan maç kupona boş girer ve İSABET SAYILMAZ (dürüst kural).
  const openMatches = matches.filter((m) => !lockedNos.has(m.no));
  const emptyLockedCount = matches.filter((m) => lockedNos.has(m.no) && !(picks[m.no] || []).length).length;
  const complete = matches.length > 0 && openMatches.every((m) => (picks[m.no] || []).length) && filled.length > 0;

  const toggle = (no, o) => {
    if (lockedNos.has(no)) return;
    setPicks((p) => {
      const cur = new Set(p[no] || []);
      cur.has(o) ? cur.delete(o) : cur.add(o);
      const arr = OUTCOMES.filter((x) => cur.has(x));
      const next = { ...p };
      if (arr.length) next[no] = arr; else delete next[no];
      return next;
    });
  };

  // ——— AKTARIM: önce fark, sonra kullanıcı kararı. ———
  const startImport = (source) => {
    const proposed = proposalFrom(matches, source);
    // Kilitli maçlara öneri UYGULANMAZ (seçim donmuştur) — sessizce atılmaz,
    // fark listesinde zaten görünmez.
    for (const no of Object.keys(proposed)) if (lockedNos.has(Number(no)) || lockedNos.has(no)) delete proposed[no];
    if (!Object.keys(proposed).length) {
      uyari.alert('Veri yok', source === 'radar' ? 'Radar tahmini kayıtlı değil — aktarım yapılamaz (uydurulmaz).' : 'Sistem tahmini bulunamadı.');
      return;
    }
    const changes = diffSelections(picks, proposed);
    if (!changes.length) { uyari.alert('Fark yok', 'Öneri, mevcut seçimlerinle zaten aynı.'); return; }
    setImportState({
      title: source === 'radar' ? 'Radar tahminlerinden aktar' : 'Sistem Master Analizi tahminlerinden aktar',
      changes, proposed,
    });
  };
  const applyImport = () => {
    setPicks((p) => ({ ...p, ...importState.proposed }));
    setImportState(null);
  };

  // ——— KRİTER: kullanıcının SEÇTİĞİ kriterlerle hesap (tekli / geniş). ———
  const kriterAktar = async (genis) => {
    setKriterSecim(false);
    const profil = getActiveProfile();
    if (!profil || !countOn(profil)) {
      uyari.alert('Kriter seti yok', 'Önce "Analiz Kriterlerim" ekranından kriterlerini seç — kriter aktarımı senin setinle hesaplanır, uydurulmaz.');
      return;
    }
    setKriterYukleniyor(true);
    try {
      const calc = await api.analysisCalcBulletin(data.roundId, { profile: profil });
      // Seçim mantığı SAF modülde (kriterAktarim.js) — testli.
      // Geniş artık "kapalı tercih" değil: tekli + GEREKİRSE ikinci işaret.
      // Sebep: kriter seti X üretmiyorsa kapalı tercih her maçta '12' oluyor
      // ve 15 maçın hepsi "1-2" görünüyordu (kullanıcı bildirimi, 2026-08-06).
      const { secimler: proposed, uyarilar } = kriterAktarimi(calc?.matches || [], {
        genis, kilitliNolar: lockedNos,
      });
      if (!Object.keys(proposed).length) {
        uyari.alert('Veri yok', ['Kriter setinle hesaplanan tahmin bulunamadı.', ...uyarilar].join('\n\n'));
        return;
      }
      const changes = diffSelections(picks, proposed);
      if (!changes.length) { uyari.alert('Fark yok', 'Kriter önerisi, mevcut seçimlerinle zaten aynı.'); return; }
      setImportState({
        title: genis ? 'Kriter analizinden aktar (geniş)' : 'Kriter analizinden aktar (tekli)',
        changes, proposed, notes: uyarilar,
      });
    } catch (e) {
      uyari.alert('Hesaplanamadı', e.message);
    } finally {
      setKriterYukleniyor(false);
    }
  };

  // ——— SEÇİMİM: elle seçim — kilitli olmayan tüm seçimleri temizler. ———
  const secimimTemizle = () => {
    const doluAcik = Object.keys(picks).filter((no) => !lockedNos.has(Number(no)));
    if (!doluAcik.length) { uyari.alert('Zaten boş', 'Seçimler boş — maç satırlarından 1/X/2 işaretleyerek kendi kuponunu kur.'); return; }
    uyari.alert(
      'Kendi seçimini yap',
      `${doluAcik.length} maçın seçimi temizlenecek (kilitli maçlara dokunulmaz). Sonra 1/X/2 kutularından kendin işaretlersin.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Temizle',
          style: 'destructive',
          onPress: () => setPicks((p) => Object.fromEntries(Object.entries(p).filter(([no]) => lockedNos.has(Number(no))))),
        },
      ],
    );
  };

  // ——— AKILLI KUPON ———
  const runSmart = () => {
    let budgetColumns = COUPON_MAX_COLUMNS;
    const b = Number(String(budgetTxt).replace(',', '.'));
    if (Number.isFinite(b) && b > 0) budgetColumns = pricing ? Math.floor(b / pricing.unitPrice) : Math.floor(b);
    if (budgetColumns < 1) { uyari.alert('Bütçe yetersiz', 'Bu bütçeyle tek kolon bile oluşmuyor.'); return; }
    const res = buildSmartCoupon({ matches, budgetColumns, target });
    setSmartPreview({ ...res, changes: diffSelections(picks, Object.fromEntries(res.selections.filter((s) => s.selectedOutcomes.length).map((s) => [s.no, s.selectedOutcomes]))) });
  };
  const applySmart = () => {
    const p = {};
    for (const s of smartPreview.selections) if (s.selectedOutcomes.length) p[s.no] = s.selectedOutcomes;
    // Kilitli maçların MEVCUT seçimi korunur; akıllı taslak onlara dokunamaz.
    setPicks((prev) => {
      const next = { ...p };
      for (const no of lockedNos) {
        if (prev[no]?.length) next[no] = prev[no]; else delete next[no];
      }
      return next;
    });
    setSmartPreview(null); setSmartOpen(false);
  };

  const save = () => {
    if (allLocked) { uyari.alert('Kilitli', 'Tüm maçlar başladı — bu hafta kupon kaydedilemez/değiştirilemez.'); return; }
    if (!complete) { uyari.alert('Eksik seçim', `${openMatches.filter((m) => !(picks[m.no] || []).length).length} açık maçta seçim yok — başlamamış maçların hepsi işaretlenmeli.`); return; }
    // KOLON SINIRI ARTIK KAYDI ENGELLEMEZ (kullanıcı kararı, 2026-08-04):
    // resmî sınırın (2500) üstünde de kayıt yapılır; kullanıcı yalnız açıkça
    // UYARILIR ve kararı kendisi verir. Uyarı metni sınırı söylemeye devam
    // eder — bilgi saklanmaz.
    if (overLimit) {
      uyari.alert(
        'Kolon sınırı aşılıyor',
        `Kolon sayısı ${cols} — resmî oyun sınırı ${COUPON_MAX_COLUMNS}. Bu kupon kaydedilir ama bu genişlikte resmî oyunda oynanamaz. Yine de kaydedilsin mi?`,
        [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Yine de Kaydet', onPress: () => saveOnaydan() },
        ],
      );
      return;
    }
    saveOnaydan();
  };
  const saveOnaydan = () => {
    const doSave = () => {
      setSaving(true);
      const versionData = { selections: matches.map((m) => ({ no: m.no, selectedOutcomes: picks[m.no] || [] })) };
      let res;
      if (couponId) {
        res = addVersion(couponId, versionData, { lockMap });
        if (!res.error && name.trim()) renameCoupon(couponId, name);
      } else {
        res = createCoupon({ season: data.season || null, weekNumber: data.weekNumber || null, roundId, lockedAt: lockAt, lockMap }, versionData, name);
      }
      setSaving(false);
      if (res.error === 'max') { uyari.alert('Sınır', 'Bu hafta için kupon hakkın doldu.'); return; }
      if (res.error === 'locked' || res.error === 'locked-match') {
        const list = res.matches?.length ? ` (${res.matches.join(', ')}. maç)` : '';
        uyari.alert('Kilitli', `Başlamış maçın seçimi değiştirilemez${list}.`);
        return;
      }
      if (res.error) { uyari.alert('Hata', 'Kupon kaydedilemedi — yerel taslağın duruyor, tekrar dene.'); return; }
      clearDraft(roundId);
      navigation.goBack();
    };
    if (emptyLockedCount > 0) {
      uyari.alert(
        'Boş kalan maçlar',
        `${emptyLockedCount} maç sen seçim yapmadan başladı — bu maçlar kuponda BOŞ kalır ve isabet sayılmaz. Kaydedilsin mi?`,
        [{ text: 'Vazgeç' }, { text: 'Kaydet', onPress: doSave }],
      );
      return;
    }
    doSave();
  };

  // Satır: resmî bülten tablosunun satırı. Sol yarısı (sıra · arma · adlar ·
  // arma) yayın stüdyosuyla AYNI bileşenden çizilir; sağ yarısı 1-0-2 kutuları.
  // Analiz detayı satırın ALTINA açılır — tablo düzeni bozulmaz.
  const renderRow = ({ item: m, index: i }) => {
    const sel = picks[m.no] || [];
    const sig = signalsOf(m);
    const open = openNo === m.no;
    const rowLocked = lockedNos.has(m.no);
    const zebra = i % 2 === 1;
    const detayYazi = rowLocked
      ? (sel.length ? 'başladı — seçim dondu' : 'başladı — boş (isabet sayılmaz)')
      : (open ? 'detayı kapat ▴' : 'analiz detayı ▾');
    return (
      <View>
        <MacSatiri
          k={k}
          zebra={zebra}
          secili={sel.length > 0}
          kilitli={rowLocked}
          sira={m.no}
          home={m.home?.mediumName || m.home?.name}
          away={m.away?.mediumName || m.away?.name}
          homeLogo={m.home?.logo}
          awayLogo={m.away?.logo}
          onPress={() => setOpenNo(open ? null : m.no)}
          erisimEtiketi={`${m.no}. maç analiz detayını ${open ? 'kapat' : 'aç'}`}
          testID={`kupon-satir-${m.no}`}
          alt={(
            <>
              {m.league ? <AltBilgi k={k} text={m.league} /> : null}
              <AltBilgi k={k} text={detayYazi} color={rowLocked ? S.warn : S.accent} />
            </>
          )}
          sag={<PickBoxes outcomes={sel} onToggle={(o) => toggle(m.no, o)} disabled={rowLocked} k={k} compact={dar} />}
          sagGenislik={dar ? 104 : 122}
        />
        {open ? (
          <View style={[st.detay, zebra && { backgroundColor: S.panel2 }]}>
            <Text style={[st.detayTxt, fontOf(400, f), { fontSize: t.kucuk }]}>Sistem: <Text style={[st.detayStrong, fontOf(700, f)]}>{sig.sysSym ? sig.sysSym.split('').map((c) => (c === '0' ? 'X' : c)).join('-') : 'kayıt yok'}</Text>{m.prediction?.label ? ` (${displayLabel(m.prediction.label)})` : ''}</Text>
            <Text style={[st.detayTxt, fontOf(400, f), { fontSize: t.kucuk }]}>Radar favorisi: <Text style={[st.detayStrong, fontOf(700, f)]}>{sig.radarSym || 'kayıt yok'}</Text></Text>
            <Text style={[st.detayTxt, fontOf(400, f), { fontSize: t.kucuk }]}>İhtimaller: <Text style={[st.detayStrong, fontOf(700, f), TABULAR]}>{sig.probs ? `1 %${sig.probs['1']} · X %${sig.probs['X']} · 2 %${sig.probs['2']}` : 'veri yok'}</Text></Text>
            <Text style={[st.detayTxt, fontOf(400, f), { fontSize: t.kucuk }]}>Sürpriz puanı: <Text style={[st.detayStrong, fontOf(700, f), TABULAR]}>{sig.surprise != null ? sig.surprise : 'veri yok'}</Text></Text>
          </View>
        ) : null}
      </View>
    );
  };

  // Tablo başlığı ve alt açıklaması — listenin üstünde/altında bir kez çizilir.
  const tabloBasi = (
    <Thead k={k}>
      <Th text="SIRA" k={k} style={{ width: Math.round(32 * k), paddingHorizontal: 5 }} center />
      <Th text="EV SAHİBİ - KONUK TAKIM" k={k} style={{ flex: 1, minWidth: 0 }} />
      <Th text="1 - 0 - 2" k={k} style={{ width: Math.round((dar ? 104 : 122) * k) }} center />
    </Thead>
  );

  return (
    <View style={st.root}>
      {/* Üst özet — kolon + maliyet ANLIK */}
      <View style={st.header}>
        <Giris
          k={k}
          value={name}
          onChangeText={setName}
          placeholder="Kupon adı (boşsa otomatik verilir)"
          editable={!allLocked}
        />
        <View style={st.sumRow}>
          <SayiKutu k={k} etiket="SEÇİLEN" deger={`${filled.length}/${matches.length}`} />
          <SayiKutu
            k={k}
            etiket="KOLON"
            deger={String(cols)}
            tone={overLimit ? S.bad : S.ink}
            alt={overLimit ? `sınır ${COUPON_MAX_COLUMNS}!` : null}
          />
          <SayiKutu k={k} etiket="MALİYET" deger={cost != null ? fmtTL(cost) : '—'} />
        </View>
        <Not
          k={k}
          text={pricing
            ? `Birim kolon bedeli: ${pricing.unitPrice} TL · Kaynak: ${pricing.source} · Güncelleme: ${String(pricing.updatedAt).slice(0, 10)}`
            : 'Birim kolon bedeli verisi yok — maliyet gösterilmiyor (uydurma fiyat kullanılmaz).'}
        />
        {allLocked ? (
          <Text style={[st.lockNote, fontOf(700, f), { fontSize: t.kucuk }]}>🔒 Tüm maçlar başladı — bu hafta kupon artık değiştirilemez.</Text>
        ) : someLocked ? (
          <Text style={[st.lockNote, fontOf(700, f), { fontSize: t.kucuk }]}>🔒 {lockedNos.size} maç başladı — o maçlarda seçim kilitli, kalan {matches.length - lockedNos.size} maç serbest.</Text>
        ) : null}
      </View>

      {/* 15 satırlık sabit bir tablo — sanallaştırma gerekmez; çerçevenin tek
          parça (üstte başlık şeridi, altta açıklama) kalması için düz liste. */}
      <ScrollView contentContainerStyle={st.listPad}>
        <Tablo testID="kupon-tablo">
          {tabloBasi}
          {matches.map((m, i) => (
            <View key={m.no}>{renderRow({ item: m, index: i })}</View>
          ))}
          <Tfoot k={k}>
            Seçimler bu cihazda saklanır. Kolon sayısı seçim genişliklerinin
            çarpımıdır; resmî sınır {COUPON_MAX_COLUMNS} kolondur. Başlamış maçın
            seçimi donar, boş kalırsa isabet sayılmaz. Yalnız resmî Spor Toto
            sonucu kesindir.
          </Tfoot>
        </Tablo>
      </ScrollView>

      {!allLocked ? (
        <View style={st.footer}>
          {/* AKTARIM SEÇENEKLERİ YENİLENDİ (kullanıcı kararı, 2026-08-04):
              "Sistemden/Radardan/Akıllı" yerine üç seçenek:
              • Sistem  → bülten maç kartındaki tahminler (m.prediction)
              • Kriter  → kullanıcının SEÇTİĞİ kriterlerle hesap (tekli/geniş)
              • Seçimim → elle seçim: otomatik dolguları temizler
              Akıllı Kupon kodu ve testleri duruyor; yalnız düğmesi kaldırıldı. */}
          <Dugme k={k} text="⚙ Sistem" onPress={() => startImport('system')} style={{ flex: 1 }} />
          <Dugme k={k} text="🎛 Kriter" onPress={() => setKriterSecim(true)} style={{ flex: 1 }} />
          <Dugme k={k} text="✍️ Seçimim" onPress={secimimTemizle} style={{ flex: 1 }} />
          <Dugme
            k={k}
            ana
            text={saving ? '…' : 'Kaydet'}
            onPress={save}
            disabled={saving}
            style={[{ flex: 1 }, !complete && { opacity: 0.5 }]}
          />
        </View>
      ) : null}

      {/* AKTARIM ONAYI — fark listesi, karar kullanıcının */}
      <Modal visible={!!importState} transparent animationType="fade" onRequestClose={() => setImportState(null)}>
        <View style={st.modalBg}>
          <View style={st.modal}>
            <Text style={st.mTitle}>{importState?.title}</Text>
            <Text style={st.mSub}>Mevcut seçimlerin SİLİNMEZ — aşağıdaki değişiklikleri sen onaylarsan uygulanır:</Text>
            {(importState?.notes || []).map((n) => (
              <Text key={n} style={st.mUyari}>ℹ️ {n}</Text>
            ))}
            <ScrollView style={st.mScroll}>
              {(importState?.changes || []).map((c) => (
                <Text key={c.no} style={st.mLine}>
                  {c.no}. maç: <Text style={st.mStrong}>{c.from}</Text> → <Text style={[st.mStrong, { color: S.accent }]}>{c.to}</Text>{c.kind === 'fill' ? ' (boş dolduruluyor)' : ' (mevcut değişecek)'}
                </Text>
              ))}
            </ScrollView>
            <View style={st.mBtns}>
              <TouchableOpacity style={st.mCancel} onPress={() => setImportState(null)}><Text style={st.mCancelTxt}>Vazgeç</Text></TouchableOpacity>
              <TouchableOpacity style={st.mOk} onPress={applyImport}><Text style={st.mOkTxt}>Uygula ({importState?.changes?.length})</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* KRİTER AKTARIMI — tekli mi geniş mi? Karar kullanıcının. */}
      <Modal visible={kriterSecim} transparent animationType="fade" onRequestClose={() => setKriterSecim(false)}>
        <View style={st.modalBg}>
          <View style={st.modal}>
            <Text style={st.mTitle}>🎛 Kriter Analizinden Aktar</Text>
            <Text style={st.mSub}>
              Senin seçtiğin kriterlerle hesaplanır ("Analiz Kriterlerim").
              Tekli: her maça tek işaret. Geniş: gerekli görülen maçlarda
              alternatifli (çifte) işaret — kolon sayısı artar.
            </Text>
            <View style={st.mBtns}>
              <TouchableOpacity style={st.mCancel} onPress={() => kriterAktar(false)} disabled={kriterYukleniyor}>
                <Text style={st.mCancelTxt}>Tekli</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.mOk} onPress={() => kriterAktar(true)} disabled={kriterYukleniyor}>
                <Text style={st.mOkTxt}>Geniş</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setKriterSecim(false)}>
              <Text style={[st.mCancelTxt, { textAlign: 'center', marginTop: 10 }]}>Vazgeç</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* AKILLI KUPON — düğmesi kaldırıldı (2026-08-04); kod ve testler duruyor. */}
      <Modal visible={smartOpen} transparent animationType="fade" onRequestClose={() => setSmartOpen(false)}>
        <View style={st.modalBg}>
          <View style={st.modal}>
            <Text style={st.mTitle}>🧠 Akıllı Kupon</Text>
            {!smartPreview ? (
              <>
                <Text style={st.mSub}>{pricing ? `Bütçen (TL) — birim bedel ${pricing.unitPrice} TL` : 'Bütçen KOLON cinsinden (fiyat verisi olmadığı için TL kullanılamaz)'}</Text>
                <Giris k={k} style={st.mInput} value={budgetTxt} onChangeText={setBudgetTxt} keyboardType="numeric" placeholder={pricing ? 'ör. 500' : `ör. 48 (boş = ${COUPON_MAX_COLUMNS})`} />
                <Text style={st.mSub}>Hedef doğru sayısı:</Text>
                <View style={st.mTargets}>
                  {[12, 13, 14, 15].map((t) => (
                    <TouchableOpacity key={t} style={[st.tChip, target === t && st.tChipOn]} onPress={() => setTarget(t)}>
                      <Text style={[st.tTxt, target === t && st.tTxtOn]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={st.mBtns}>
                  <TouchableOpacity style={st.mCancel} onPress={() => setSmartOpen(false)}><Text style={st.mCancelTxt}>Vazgeç</Text></TouchableOpacity>
                  <TouchableOpacity style={st.mOk} onPress={runSmart}><Text style={st.mOkTxt}>Taslak Oluştur</Text></TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={st.mSub}>
                  Kolon: {smartPreview.columns}{costOf(smartPreview.columns, pricing) != null ? ` · Maliyet: ${fmtTL(costOf(smartPreview.columns, pricing))}` : ''} · Hedef: {smartPreview.target}
                  {smartPreview.coverageScore != null ? ` · Kapsama puanı: ${smartPreview.coverageScore}` : ''}
                </Text>
                <Text style={st.mNote}>{smartPreview.coverageNote}</Text>
                {smartPreview.insufficient.length ? (
                  <Text style={[st.mNote, { color: S.bad }]}>Veri yetersiz (boş bırakıldı, elle seç): {smartPreview.insufficient.join(', ')}. maçlar</Text>
                ) : null}
                <ScrollView style={st.mScroll}>
                  {smartPreview.explanations.map((e) => (
                    <Text key={e.no} style={st.mLine}><Text style={st.mStrong}>{e.no}.</Text> {e.text}</Text>
                  ))}
                </ScrollView>
                <Text style={st.mSub}>Uygulanırsa değişecek seçim: {smartPreview.changes.length} maç (onaylamadan hiçbir şey değişmez).</Text>
                <View style={st.mBtns}>
                  <TouchableOpacity style={st.mCancel} onPress={() => setSmartPreview(null)}><Text style={st.mCancelTxt}>Geri</Text></TouchableOpacity>
                  <TouchableOpacity style={st.mOk} onPress={applySmart}><Text style={st.mOkTxt}>Taslağı Uygula</Text></TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* STİL — yayın stüdyosunun paleti (studioTheme). Genel uygulama teması
   (theme.js) burada KULLANILMAZ; iki palet karışırsa aynı ekranda iki farklı
   gri, iki farklı köşe yarıçapı çıkıyor. */
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: S.bg },
  header: {
    backgroundColor: S.panel, borderBottomWidth: TABLE.hair, borderBottomColor: S.line,
    paddingHorizontal: SP.md, paddingVertical: SP.sm, gap: SP.sm,
  },
  sumRow: { flexDirection: 'row', gap: SP.lg, flexWrap: 'wrap', alignItems: 'flex-start' },
  lockNote: { color: S.bad },
  listPad: { padding: SP.md, paddingBottom: 96 },

  detay: {
    backgroundColor: S.panel, borderBottomWidth: TABLE.hair, borderBottomColor: S.lineSoft,
    paddingHorizontal: TABLE.cellPadX, paddingVertical: SP.sm, gap: 2,
  },
  detayTxt: { color: S.inkSoft, lineHeight: 16 },
  detayStrong: { color: S.ink },

  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: SP.sm,
    padding: SP.md, backgroundColor: S.panel, borderTopWidth: TABLE.hair, borderTopColor: S.line,
  },

  modalBg: { flex: 1, backgroundColor: 'rgba(20,32,43,0.55)', alignItems: 'center', justifyContent: 'center', padding: SP.xl },
  modal: {
    width: '100%', maxWidth: 440, maxHeight: '85%', backgroundColor: S.panel,
    borderWidth: TABLE.hair, borderColor: S.line, borderRadius: R.md, padding: SP.lg,
  },
  mTitle: { color: S.ink, fontSize: 15.5, fontWeight: '700' },
  mUyari: { color: S.warn ?? S.accent, fontSize: 11.5, lineHeight: 16, marginTop: 6 },
  mSub: { color: S.inkSoft, fontSize: 12, marginTop: SP.sm, lineHeight: 17 },
  mNote: { color: S.inkDim, fontSize: 10.5, fontStyle: 'italic', marginTop: 5, lineHeight: 14 },
  mScroll: { marginTop: SP.sm, maxHeight: 260 },
  mLine: { color: S.ink, fontSize: 12, lineHeight: 18, marginTop: 3 },
  mStrong: { fontWeight: '700' },
  mInput: { marginTop: SP.sm },
  mTargets: { flexDirection: 'row', gap: SP.sm, marginTop: SP.sm },
  tChip: {
    flex: 1, paddingVertical: SP.sm, borderRadius: R.sm, borderWidth: TABLE.hair,
    borderColor: S.line, alignItems: 'center', backgroundColor: S.panel2,
  },
  tChipOn: { backgroundColor: S.accent, borderColor: S.accent },
  tTxt: { color: S.inkSoft, fontSize: 14, fontWeight: '700' },
  tTxtOn: { color: S.accentInk },
  mBtns: { flexDirection: 'row', gap: SP.md, marginTop: SP.md },
  mCancel: { flex: 1, paddingVertical: SP.md, borderRadius: R.sm, borderWidth: TABLE.hair, borderColor: S.line, alignItems: 'center' },
  mCancelTxt: { color: S.inkSoft, fontSize: 13, fontWeight: '600' },
  mOk: { flex: 1, paddingVertical: SP.md, borderRadius: R.sm, backgroundColor: S.accent, alignItems: 'center' },
  mOkTxt: { color: S.accentInk, fontSize: 13, fontWeight: '700' },
});
