// RADAR MERKEZİ — karar destek ekranı.
// Master Radar + 5 alt radar (Performans · xG · Halk · Oran Takibi · Hafıza), hafta
// arşivi, mühür/kilit durumu, veri yeterliliği, radar karnesi ve metodoloji.
// * Güncel hafta: merkezi hesaplanan Radar Merkezi sonucu (backend cache'inden).
// * Kilitli hafta: YALNIZ snapshot'a mühürlenmiş çıktı — yeniden hesap yok.
// * Radar Merkezi öncesi eski haftalar: legacy sürpriz radarı görünümü korunur.
// Veri yoksa alan gösterilmez / "veri kaynağı bekleniyor" yazılır (uydurma yok).
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { api } from '../api';
import { colors, spacing, radius, labelColors } from '../theme';
import { SurpriseBadge, FormStrip } from '../components';
import VenueMark from '../components/VenueMark';
import NoInternetScreen, { isNetworkError } from '../components/NoInternetScreen';
import ScreenBackdrop from '../components/ScreenBackdrop';
import AnalysisHeader from '../components/AnalysisHeader';
import { MasterMatchCard, RadarTabCard, RADAR_TAB_DEFS } from '../components/RadarCenterCards';
import RadarTabHeader, { providerLabel } from '../components/RadarTabHeaders';
import PlayedDnaPanel from '../components/PlayedDnaPanel';
import { getDraft, setDraftPick } from '../coupon/store';
import { OUTCOMES } from '../couponConfig';
import {
  normalizeWeeks, resolveCurrentId, isCurrentWeek, deriveScreenState, screenStateMessage,
} from '../radarScreenLogic';
// Veri türetme (filtre/sıralama/sayaç/biçim) ekrandan ayrıldı — bkz.
// radarScreenData.js. Ekran yalnız ÇİZER; ne göstereceğine orası karar verir.
import {
  DNA_PERIODS, MASTER_FILTERS, roundPct100, ord, wdl, num1, fmtClock, birOndalik,
  classCountsOf, filterMaster, sortMaster, freezeMinutes,
  legacyCountsOf, legacyFiltered, radar5PeriodSuccess, radar5PeriodTrend, rowTrend,
} from '../radarScreenData';

// RADAR 3 OTOMATİK TAZELEME — sekme açıkken ekran kendiliğinden yenilenir.
// Sağlayıcı gözlemi arka planda 15 dk'da bir yazıldığı için 60 sn'lik ekran
// temposu yeni değeri gecikmeden gösterir, sunucuya da yük bindirmez.
// Yalnız GÜNCEL hafta tazelenir: mühürlü/geçmiş haftanın değeri değişmez.
const PLAYED_REFRESH_MS = 60e3;


export default function RadarScreen({ navigation }) {
  const [view, setView] = useState(null);            // Radar Merkezi görünümü (matches[])
  const [legacyRadar, setLegacyRadar] = useState(null); // eski sürpriz radarı listesi
  const [meta, setMeta] = useState(null);            // gösterilen haftanın bilgisi
  const [weeks, setWeeks] = useState([]);
  const [curId, setCurId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('master');          // master | performance | ... | bulletinMemory
  const [legacyView, setLegacyView] = useState('r1'); // legacy haftalar için eski 2 sekme
  const [filter, setFilter] = useState('all');
  const [legacyFilter, setLegacyFilter] = useState(null);
  const [sortMode, setSortMode] = useState('order'); // order | risk — varsayılan: Spor Toto sırası (no 1→15)
  const [expandedNo, setExpandedNo] = useState(null);
  const [picks, setPicks] = useState({});
  const [rsc, setRsc] = useState(null);              // Radar Merkezi karnesi (yalnız resmî ileri-test)
  const [showCriteria, setShowCriteria] = useState(false); // Kriter Karnesi (lig kırılımlı) aç/kapa
  // (Eski radar karnesi TAMAMEN kaldırıldı — legacy Banko/Sürpriz yüzdeleri
  //  yeni başlangıç kararıyla hiçbir görünümde gösterilmez.)
  const [methodology, setMethodology] = useState(null);
  const [showMeth, setShowMeth] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [positionDna, setPositionDna] = useState(null); // Bülten DNA (Radar 5 detayı)
  const [dnaPeriod, setDnaPeriod] = useState('allTime'); // dönem filtresi (Tüm/5/10/15)
  const [dailyOdds, setDailyOdds] = useState(null);   // Radar 4 Oran Takibi (günlük mühürlü oran)
  const [oddsDay, setOddsDay] = useState(null);       // seçili gün (Pazar..Cuma)
  const [dailyPlayed, setDailyPlayed] = useState(null); // Radar 3 Oynanma DNA (günlük mühürlü yüzde)
  const [playedDay, setPlayedDay] = useState(null);   // seçili gün (Pazar..Cuma)
  // OYNANMA DNA PANELİ — kaynak satırına dokununca açılır.
  // dnaKey: "<maçNo>|<kaynak>" — panelin KENDİ durumu components/PlayedDnaPanel.js'te.
  const [dnaKey, setDnaKey] = useState(null);
  const [playedTick, setPlayedTick] = useState(0);  // Radar 3 otomatik tazeleme sayacı

  // SEKME VERİSİ ÇEKME KİLİTLERİ — "bu hafta için istek zaten gitti mi?"
  //
  // ÖNCEKİ HÂLİ TEHLİKELİYDİ: her effect KENDİ doldurduğu state'i (dailyOdds,
  // dailyPlayed, positionDna) bağımlılık dizisinde taşıyor ve döngüyü yalnız
  // "gelen yanıtın roundId'si istediğimle aynı mı?" kontrolü kesiyordu. Sunucu
  // farklı ya da eksik roundId dönerse kontrol tutmaz, effect kendi yazdığı
  // state'le yeniden tetiklenir ve SONSUZ İSTEK DÖNGÜSÜ başlar — üstelik
  // sessizce, yalnız ağ trafiğinden anlaşılır.
  //
  // Artık kilit İSTENEN haftadadır (yanıta bakmaz) ve ref'te tutulur, yani
  // effect kendi sonucuna bağımlı değildir. Hata olursa kilit açılır ki tekrar
  // denenebilsin; hafta değişince zaten yeni kilit oluşur.
  const cekilenDna = useRef(null);
  const cekilenOran = useRef(null);
  const cekilenOynanma = useRef(null);
  const zatenCekildi = (ref, rid) => {
    if (ref.current != null && Number(ref.current) === Number(rid)) return true;
    ref.current = rid;
    return false;
  };

  const applyResponse = useCallback((d, { current: fallbackCurrent }) => {
    // GÜNCEL/GEÇMİŞ ayrımı backend'in current alanından okunur (tek doğruluk
    // kaynağı); alan yoksa çağıranın bağlamı kullanılır. roundId sıralamasına
    // göre "güncellik" TAHMİN EDİLMEZ.
    const current = d?.current === true ? true : d?.current === false ? false : fallbackCurrent;
    if (d?.hasData && Array.isArray(d.matches) && d.matches.length) {
      setView(d);
      setLegacyRadar(null);
      setTab('master');
      setMeta({
        round: d.round || null, year: d.year || null, current,
        sealed: !!d.sealed, sealedAt: d.sealedAt || null,
        shortHash: d.verificationHash ? d.verificationHash.slice(0, 10) : null,
        freezeAt: d.radarFreezeAt || d.freezeAt || null,
        frozenAt: d.radarFrozenAt || d.sealedAt || null,
        avgDq: d.summary?.avgDataQuality ?? null,
        methodologyVersion: d.methodologyVersion || null,
      });
    } else {
      // Radar Merkezi kaydı yok → eski hafta (legacy arşiv) YA DA bekleyen bülten.
      const isLegacy = d?.legacyOnly === true || (Array.isArray(d?.radar) && d.radar.length > 0);
      setView(null);
      setLegacyRadar(Array.isArray(d?.radar) ? d.radar : []);
      setTab(isLegacy ? 'legacy' : 'master');
      setMeta({
        round: d?.round || null, year: d?.year || null, current,
        sealed: !!d?.sealed, sealedAt: d?.sealedAt || null, shortHash: null,
        freezeAt: d?.radarFreezeAt || d?.freezeAt || null, frozenAt: d?.radarFrozenAt || null,
        avgDq: null, legacyOnly: isLegacy, pending: d?.pending === true, note: d?.note || null,
      });
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [d, wk] = await Promise.all([
        api.radarCurrent(),
        api.radarWeeksList().catch(() => null),
      ]);
      const nwk = normalizeWeeks(wk);
      const rid = resolveCurrentId(d, nwk);
      setCurId(rid);
      setSelectedId(rid);
      if (nwk.weeks.length) {
        setWeeks(nwk.weeks);
      } else if (rid != null) {
        // Arşiv boşken bile hafta seçici iskeleti görünür kalsın (yalnız güncel).
        setWeeks([{ roundId: rid, round: d?.round || null, year: d?.year || null, current: true, archived: false, locked: false, sealed: false }]);
      }
      applyResponse(d, { current: true });
      if (rid != null) setPicks(getDraft(rid).picks || {});
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [applyResponse]);

  const selectWeek = useCallback(async (ridRaw) => {
    const rid = Number(ridRaw);
    // Güncel haftaya dönüş: /current akışı kullanılır (arşiv ucu DEĞİL).
    if (curId != null && rid === Number(curId)) { setSelectedId(rid); load(); return; }
    try {
      setError(null);
      setSelectedId(rid);
      setView(null); setLegacyRadar(null); setExpandedNo(null); setFilter('all');
      setDailyOdds(null); setOddsDay(null); setDailyPlayed(null); setPlayedDay(null);
      // Veri TEMİZLENDİĞİ için çekme kilitleri de açılır. Açılmazsa A→B→A
      // dönüşünde ref "A zaten çekildi" der ama state boştur → panel sonsuza
      // kadar boş kalır.
      cekilenDna.current = null; cekilenOran.current = null; cekilenOynanma.current = null;
      const d = await api.radarRound(rid);
      applyResponse(d, { current: false });
    } catch (e) {
      // Hata durumunda hangi haftada olduğumuz bilinsin ki durum makinesi
      // güncel/geçmiş ayrımını doğru yapsın (iskelet görünür kalır).
      const w = weeks.find((x) => Number(x.roundId) === rid);
      setMeta({
        round: w?.round || null, year: w?.year || null,
        current: isCurrentWeek(w, curId) || (curId != null && rid === Number(curId)),
        sealed: !!w?.sealed, sealedAt: w?.sealedAt || null, shortHash: null,
        freezeAt: w?.freezeAt || null, frozenAt: null, avgDq: null,
      });
      setError(e.message);
    }
  }, [curId, weeks, load, applyResponse]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    // Yalnız RESMÎ Radar Karnesi (mühürlü official_forward) çekilir — eski
    // /api/radar-scorecard (legacy arşiv) ARTIK ÇAĞRILMAZ.
    api.radarCenterScorecard().then((d) => { if (d?.hasData) setRsc(d); }).catch(() => {});
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Bülten DNA — GÖRÜNTÜLENEN haftaya göre çekilir. Her haftanın tarihsel
  // kesimi ayrıdır (51. hafta 51 öncesini, 52. hafta 51 dâhil olanı görür),
  // bu yüzden hafta değişince YENİDEN çekilir; tek seferlik değildir.
  useEffect(() => {
    if (tab !== 'bulletinMemory') return;
    // Mühürlü haftada bu uç yalnız snapshot verisini döner; canlı hesap yapmaz.
    const rid = view?.roundId ?? selectedId;
    if (rid == null) return;
    if (zatenCekildi(cekilenDna, rid)) return;
    api.radarPositionDna(rid).then(setPositionDna).catch(() => { cekilenDna.current = null; });
  }, [tab, selectedId, view]);

  // Radar 4 (Oran Takibi): sekme açılınca gösterilen haftanın günlük mühürlü
  // oranları çekilir. Hafta değişince yeniden çekilir; varsayılan gün = veri
  // olan SON gün (yoksa penceredeki son gün — Cuma).
  useEffect(() => {
    if (tab !== 'market') return;
    const rid = view?.roundId ?? selectedId;
    if (rid == null) return;
    if (zatenCekildi(cekilenOran, rid)) return;
    api.radarDailyOdds(rid).then((d) => {
      setDailyOdds(d);
      const withData = (d?.days || []).filter((day) => (d.matches || []).some((m) => m.cells?.[day.date]));
      const pick = withData.length ? withData[withData.length - 1] : (d?.days || [])[(d?.days?.length || 1) - 1];
      setOddsDay(pick?.date || null);
    }).catch(() => { cekilenOran.current = null; });
  }, [tab, selectedId, view]);

  // Radar 3 (Oynanma DNA): gösterilen haftanın günlük mühürlü yüzdelerini çeker.
  // Tazelemede SEÇİLİ GÜN korunur — kullanıcının seçimi otomatik yenilemeyle
  // ezilmez. Varsayılan gün yalnız ilk yüklemede (veya seçili gün listeden
  // düştüyse) belirlenir. Hata olursa ekrandaki son GERÇEK değer kalır; boş
  // ekran gösterilmez, uydurma yüzde de yazılmaz.
  // Dönüş: başarılı mı? (çağıran, hata hâlinde çekme kilidini açabilsin diye —
  // hata yine SESSİZDİR, ekranda son gerçek değer kalır.)
  const fetchDailyPlayed = useCallback(async (rid, { ilkYukleme } = {}) => {
    try {
      const d = await api.radarDailyPlayed(rid);
      setDailyPlayed(d);
      setPlayedDay((mevcut) => {
        const gunler = d?.days || [];
        if (!ilkYukleme && mevcut && gunler.some((g) => g.date === mevcut)) return mevcut;
        const veriliGunler = gunler.filter((g) => (d?.matches || []).some((m) => m.cells?.[g.date]));
        const sec = veriliGunler.length ? veriliGunler[veriliGunler.length - 1] : gunler[gunler.length - 1];
        return sec?.date || null;
      });
      return true;
    } catch { return false; }   /* sessiz: son gerçek değer ekranda kalır */
  }, []);

  // İlk yükleme: sekme açılınca bir kez (hafta değişince yeniden).
  useEffect(() => {
    if (tab !== 'publicBetting') return;
    const rid = view?.roundId ?? selectedId;
    if (rid == null) return;
    if (zatenCekildi(cekilenOynanma, rid)) return;
    fetchDailyPlayed(rid, { ilkYukleme: true })
      .then((ok) => { if (!ok) cekilenOynanma.current = null; });   // hata → tekrar denenebilsin
  }, [tab, selectedId, view, fetchDailyPlayed]);

  // OTOMATİK TAZELEME: Radar 3 açıkken her PLAYED_REFRESH_MS'te sessizce yenile.
  // Mühürlü/geçmiş haftada ÇALIŞMAZ (o değerler tanım gereği değişmez) ve sekme
  // kapanınca timer temizlenir — arka planda boşuna istek atılmaz.
  useEffect(() => {
    if (tab !== 'publicBetting') return undefined;
    if (meta?.current === false) return undefined;
    const rid = view?.roundId ?? selectedId;
    if (rid == null) return undefined;
    const t = setInterval(() => {
      fetchDailyPlayed(rid, { ilkYukleme: false });
      setPlayedTick((n) => n + 1);          // açık DNA paneli de aynı anda tazelenir
    }, PLAYED_REFRESH_MS);
    return () => clearInterval(t);
  }, [tab, selectedId, view, meta, fetchDailyPlayed]);


  const toggleMethodology = () => {
    if (!showMeth && !methodology) {
      api.radarMethodology().then(setMethodology).catch(() => {});
    }
    setShowMeth((v) => !v);
  };

  // Karttan kupona işle (yalnız güncel hafta) — mevcut akış korunur; kullanıcı
  // onayı olmadan mevcut kupon EZİLMEZ (yalnız paylaşılan taslağa yazar).
  const togglePick = (no, o) => {
    if (curId == null || meta?.current === false) return;
    const cur = new Set(picks[no] || []);
    cur.has(o) ? cur.delete(o) : cur.add(o);
    const arr = OUTCOMES.filter((x) => cur.has(x));
    const next = { ...picks }; if (arr.length) next[no] = arr; else delete next[no];
    setPicks(next);
    setDraftPick(curId, no, arr);
  };

  const PickRow = ({ no }) => {
    if (meta?.current === false) return <View style={{ flex: 1 }} />;
    const myPicks = picks[no] || [];
    return (
      <View style={styles.pickBtns}>
        {OUTCOMES.map((o) => {
          const on = myPicks.includes(o);
          return (
            <TouchableOpacity key={o} onPress={() => togglePick(no, o)} style={[styles.pickBtn, on && styles.pickBtnOn]} activeOpacity={0.85}>
              <Text style={[styles.pickTxt, on && styles.pickTxtOn]}>{on ? '✓ ' : ''}{o}</Text>
            </TouchableOpacity>
          );
        })}
        <Text style={styles.pickHint}>{myPicks.length ? 'taslağa işlendi' : 'kupona işle'}</Text>
      </View>
    );
  };

  // ---- DURUM MAKİNESİ: loading / error / currentPending / data / pastUnarchived
  // Yalnız GERÇEK ağ hatası tam ekran olur; diğer tüm durumlarda iskelet
  // (başlık + hafta seçici + sekmeler) görünür kalır — boş ekran YOK.
  const screenState = deriveScreenState({ loading, error, view, legacyRadar, meta });
  if (error && isNetworkError(error)) {
    return <NoInternetScreen onRetry={load} onGoHome={() => navigation.navigate('HomeTab')} />;
  }
  if (loading && !meta && !weeks.length) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }
  const retry = () => {
    if (selectedId == null || (curId != null && Number(selectedId) === Number(curId))) load();
    else selectWeek(selectedId);
  };

  const centerMode = !!view;
  const legacyMode = !centerMode && meta?.legacyOnly === true;

  // ---- Master liste: filtre + sıralama ----
  const masterMatches = centerMode ? (view.matches || []) : [];
  // MÜHÜRLÜ HAFTA: güncel olmayan her hafta mühürlüdür. Bu haftalarda Radar 5
  // YENİDEN HESAPLANMAZ ve canlı /position-dna ucuna GİDİLMEZ.
  const muhurluHafta = centerMode && meta?.current === false;
  const classCounts = classCountsOf(masterMatches);
  const sortedMaster = sortMaster(filterMaster(masterMatches, filter), sortMode);

  // Donma geri sayımı
  const freezeMin = freezeMinutes(meta, now);

  // ---- Legacy kart (Radar Merkezi öncesi haftalar) — eski görünüm AYNEN ----
  const legacyCounts = legacyCountsOf(legacyRadar);
  const legacyShown = legacyFiltered(legacyRadar, legacyFilter);

  const renderLegacyItem = ({ item, index }) => {
    const c = labelColors[item.labelColor] || colors.gray;
    const p = item.probabilities || null;
    const sig = item.signals || null;
    const factors = item.factors || [];
    const expanded = expandedNo === item.no;
    const bits = [];
    if (sig?.position) bits.push(`Sıra ${ord(sig.position.home)} – ${ord(sig.position.away)}`);
    if (sig?.venue && (sig.venue.home || sig.venue.away)) bits.push(`İç/Dış ${wdl(sig.venue.home) || '—'} · ${wdl(sig.venue.away) || '—'}`);
    if (sig?.xg) {
      const xh = num1(sig.xg.homeVenue ?? sig.xg.home), xa = num1(sig.xg.awayVenue ?? sig.xg.away);
      if (xh != null && xa != null) bits.push(`xG ${xh} – ${xa}`);
    }
    if (sig?.goals) {
      const gh = num1(sig.goals.home?.for), ga = num1(sig.goals.away?.for);
      if (gh != null && ga != null) bits.push(`Gol/maç ${gh} – ${ga}`);
    }
    return (
      <TouchableOpacity style={[styles.row, expanded && styles.rowExpanded]} activeOpacity={0.8} onPress={() => setExpandedNo(expanded ? null : item.no)}>
        <View style={styles.topRow}>
          <Text style={styles.rank}>{index + 1}</Text>
          <View style={{ flex: 1 }}>
            <View style={styles.teamsRow}>
              <VenueMark side="home" size={14} />
              <Text style={[styles.teams, styles.teamName]} numberOfLines={1}>{item.home}</Text>
              <Text style={styles.teamsVs}>–</Text>
              <VenueMark side="away" size={14} />
              <Text style={[styles.teams, styles.teamName]} numberOfLines={1}>{item.away}</Text>
            </View>
            <View style={styles.scoreBar}>
              <View style={{ width: `${item.surpriseScore}%`, height: 6, backgroundColor: c, borderRadius: 3 }} />
            </View>
          </View>
          <View style={styles.right}>
            <Text style={[styles.scoreNum, { color: c }]}>{item.surpriseScore}</Text>
            <SurpriseBadge label={item.label} labelColor={item.labelColor} small />
          </View>
        </View>
        {item.result && item.score ? (
          <View style={styles.resultRow}>
            <Text style={styles.resultTxt}>Sonuç: <Text style={styles.resultStrong}>{item.result}</Text> · {item.score.home}-{item.score.away}</Text>
            {item.favHit != null ? (
              <View style={[styles.hitPill, { backgroundColor: item.favHit ? colors.success : colors.danger }]}>
                <Text style={styles.hitPillTxt}>{item.favHit ? '✓ Favori tuttu' : '✗ Sürpriz oldu'}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {legacyView === 'r1' ? (
          <>
            {(item.favorite || p) && (
              <View style={styles.favRow}>
                {item.favorite ? (
                  <View style={styles.favPill}>
                    <Text style={styles.favPillTxt}>Favori {item.favorite.symbol} · %{item.favorite.percent}{item.estimated ? ' ≈' : ''}</Text>
                  </View>
                ) : null}
                {p ? <Text style={styles.probs}>1 %{p['1']} · X %{p['X']} · 2 %{p['2']}</Text> : null}
              </View>
            )}
            {bits.length > 0 && <Text style={styles.signals} numberOfLines={expanded ? 2 : 1}>{bits.join('   ·   ')}</Text>}
            {sig?.form && (sig.form.home?.length || sig.form.away?.length) ? (
              <View style={styles.formRow}>
                <Text style={styles.formLbl}>Form</Text>
                <FormStrip form={sig.form.home} size={16} />
                <Text style={styles.formSep}>—</Text>
                <FormStrip form={sig.form.away} size={16} />
              </View>
            ) : null}
            {factors.length > 0 && (
              <View style={styles.factors}>
                {(expanded ? factors : factors.slice(0, 3)).map((f, i) => (
                  <Text key={i} style={styles.factorTxt} numberOfLines={1}>• {f.label} <Text style={styles.factorPts}>+{f.points}</Text></Text>
                ))}
              </View>
            )}
            {item.comment ? <Text style={styles.comment} numberOfLines={expanded ? 0 : 2}>{item.comment}</Text> : null}
          </>
        ) : (
          <>
            {bits.length > 0 ? (
              <Text style={styles.signals} numberOfLines={2}>{bits.join('   ·   ')}</Text>
            ) : <Text style={styles.signals}>İstatistik verisi bulunamadı.</Text>}
          </>
        )}
        <View style={styles.actionRow}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => navigation.navigate('MatchDetail', { no: item.no })} style={styles.detailBtn} activeOpacity={0.85}>
            <Text style={styles.detailBtnTxt}>Analiz ›</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // ---- Radar sekmesi içerikleri ----
  // Sekme üst panelleri components/RadarTabHeaders.js'e taşındı (durum tutmayan
  // saf çizim). Ekran yalnız veriyi verir; panel metinleri orada.
  const radarTabHeader = () => (
    <RadarTabHeader
      centerMode={centerMode} tab={tab} masterMatches={masterMatches}
      dailyOdds={dailyOdds} oddsDay={oddsDay} onSelectOddsDay={setOddsDay}
      dailyPlayed={dailyPlayed} playedDay={playedDay} onSelectPlayedDay={setPlayedDay}
      positionDna={positionDna} dnaPeriod={dnaPeriod} onSelectDnaPeriod={setDnaPeriod}
      donemGucu={donemGucu} donemEgilimi={donemEgilimi}
      muhurluHafta={muhurluHafta} muhurluRadar5Yok={muhurluRadar5Yok} meta={meta}
    />
  );

  // TÜM alt radar sekmeleri (Radar 1-5) master'ın 15 maçlık listesinden beslenir
  // → her sekmede 15 maç, HEP Spor Toto sırasıyla (no 1→15). Günlük oran/yüzde
  // verisi maç NO'suna göre eşlenir (aşağıdaki *CellsByNo haritaları). Böylece
  // veri gelmeyen maç bile satırda "kayıt yok" ile görünür, listeden düşmez.
  const listData = centerMode
    ? (tab === 'master' ? sortedMaster : masterMatches)
    : legacyMode ? legacyShown : [];

  // Radar 5 (Bülten DNA): seçili döneme göre sıra → geçmiş 1/X/2 yüzde haritası.
  // Pencere backend'de EN SON tamamlanmış bültenden geriye sayılır; güncel hafta
  // hariç. Örneklem yoksa null (kartta dürüst "geçmiş sonuç yok" gösterilir).
  // KAYNAK AYRIMI (bütünlük kuralı):
  //  • Mühürlü hafta  → YALNIZ snapshot içindeki dondurulmuş Radar 5 çıktısı.
  //    Canlı hesap yapılmaz, canlı uca gidilmez, güncel arşivle birleştirilmez.
  //    O haftanın kendi sonuçları kendi ekranına ASLA yansımaz.
  //  • Güncel/kilitsiz hafta → canlı hesap (önceki tamamlanmış haftalarla).
  const dnaByPosition = new Map();
  const dnaStatsByPosition = new Map();
  let muhurluRadar5Yok = false;
  if (muhurluHafta) {
    let bulundu = false;
    for (const mm of masterMatches) {
      const pos = mm.radars?.bulletinMemory?.details?.position;
      if (pos?.pct && pos.sample) { dnaByPosition.set(mm.no, pos.pct); bulundu = true; }
    }
    // Snapshot'ta Radar 5 kaydı yoksa GERİYE DÖNÜK HESAP YAPILMAZ.
    muhurluRadar5Yok = !bulundu;
  } else if (positionDna?.dna?.positions) {
    for (const p of positionDna.dna.positions) {
      const w = p.windows?.[dnaPeriod] || null;
      dnaByPosition.set(p.position, w && w.sample ? w.pct : null);
      dnaStatsByPosition.set(p.position, p.windows || {});
    }
  }
  // Dönem gücü ve eğilim hesabı radarScreenData.js'te (saf, ayrı test edilir).
  const donemGucu = radar5PeriodSuccess(positionDna);
  const donemEgilimi = radar5PeriodTrend(donemGucu);
  const renderMemoryRow = ({ item }) => {
    const pct = birOndalik(dnaByPosition.get(item.no));
    const highest = pct ? Math.max(...['1', 'X', '2'].map((key) => Number(pct[key]))) : null;
    const strongest = pct ? ['1', 'X', '2'].filter((key) => Number(pct[key]) === highest) : [];
    const allTimePct = dnaStatsByPosition.get(item.no)?.allTime?.pct;
    const allTimeHighest = allTimePct ? Math.max(Number(allTimePct['1']) || 0, Number(allTimePct.X) || 0, Number(allTimePct['2']) || 0) : null;
    const trend = rowTrend({ highest, allTimeHighest, dnaPeriod });
    return (
      <View style={styles.memRow}>
        <View style={styles.memTop}>
          <Text style={styles.memNo}>{item.no}</Text>
          <Text style={styles.memTeams} numberOfLines={1}>{item.home} – {item.away}</Text>
        </View>
        {pct ? (
          <>
            <View style={styles.memPctRow}>
              <Text style={styles.memPctLabel}>Geçmiş {item.no}. sıra</Text>
              <View style={styles.memOutcome}><Text style={[styles.memOutcomeKey, styles.memOutcomeOneKey]}>1</Text><Text style={styles.memOutcomeValue}>%{pct['1']}</Text></View>
              <View style={styles.memOutcome}><Text style={[styles.memOutcomeKey, styles.memOutcomeDrawKey]}>X</Text><Text style={styles.memOutcomeValue}>%{pct.X}</Text></View>
              <View style={styles.memOutcome}><Text style={[styles.memOutcomeKey, styles.memOutcomeTwoKey]}>2</Text><Text style={styles.memOutcomeValue}>%{pct['2']}</Text></View>
            </View>
            <View style={styles.memSuccessRow}>
              <Text style={styles.memSuccess}>Dönem başarısı:</Text>
              {strongest.map((key) => (
                <Text key={key} style={[
                  styles.memOutcomeKey,
                  key === '1' && styles.memOutcomeOneKey,
                  key === 'X' && styles.memOutcomeDrawKey,
                  key === '2' && styles.memOutcomeTwoKey,
                ]}>{key}</Text>
              ))}
              <Text style={styles.memSuccessValue}>%{highest.toFixed(1)}</Text>
              {trend ? <Text style={[
                styles.memTrend,
                trend.key === 'up' && styles.dnaTrendUp,
                trend.key === 'down' && styles.dnaTrendDown,
                trend.key === 'flat' && styles.dnaTrendFlat,
              ]}>{trend.symbol}</Text> : null}
            </View>
          </>
        ) : (
          <Text style={styles.memNone}>
            {muhurluRadar5Yok
              ? 'Bu hafta için mühürlü Radar 5 kaydı yok.'
              : 'Bu dönemde geçmiş sonuç yok.'}
          </Text>
        )}
      </View>
    );
  };

  // Radar 4 (Oran Takibi): seçili günün mühürlü oranı + önceki güne göre yön.
  // Satır omurgası masterMatches (15, Spor Toto sırası); günlük hücreler maç
  // NO'suna göre eşlenir (endpoint az maç dönse bile 15 satır korunur).
  const oddsDays = dailyOdds?.days || [];
  const oddsCellsByNo = new Map((dailyOdds?.matches || []).map((m) => [m.no, m.cells || {}]));
  // EKSİK ORANIN SEBEBİ: boş hücrenin arkasında yapısal olarak farklı sebepler
  // var (kapsam dışı / henüz yayınlanmadı / mühür alınamadı / gün gelmedi).
  // Hepsine aynı cümleyi yazmak kullanıcıyı yanıltıyordu; her satır artık
  // KENDİ sebebini söyler. Sebep arka uçta ÜRETİLİR — burada uydurulmaz.
  const oddsNotesByNo = new Map((dailyOdds?.matches || []).map((m) => [m.no, m.notes || {}]));
  const oddsSelIdx = oddsDays.findIndex((d) => d.date === oddsDay);
  const prevOddsCell = (cells) => {
    for (let i = oddsSelIdx - 1; i >= 0; i--) {
      const dd = oddsDays[i];
      if (cells?.[dd.date]) return cells[dd.date];
    }
    return null;
  };
  // TEK ORAN KAYNAĞI (27 Temmuz 2026 — kullanıcı kararı): denenen ikinci kaynak
  // kaldırıldı, Radar 4 yalnız BİRİNCİL kaynağı gösterir. Ekranda kaynak başlığı
  // ya da ikinci oran satırı yoktur; rakam doğrudan kendi hücresinde durur.
  const fmtOdd = (v) => (v == null ? '—' : Number(v).toFixed(2));
  const oddsArrow = (cur, prev) => {
    if (prev == null || cur == null) return null;
    const d = cur - prev;
    if (Math.abs(d) < 0.005) return { s: '=', c: colors.warning };                 // sabit → sarı
    return d > 0 ? { s: '▲', c: colors.success } : { s: '▼', c: colors.danger };    // yükseliş → yeşil, düşüş → kırmızı
  };
  // 1/X/2 üçlüsü + aynı kaynağın önceki gününe göre yön oku.
  const OddsTriple = ({ odds, prev }) => (
    <View style={styles.oddsLine}>
      {[['1', 'home'], ['X', 'draw'], ['2', 'away']].map(([lbl, key]) => {
        const v = odds?.[key];
        const a = oddsArrow(v, prev?.[key]);
        return (
          <View key={lbl} style={styles.oddsCell}>
            <Text style={styles.oddsK}>{lbl}</Text>
            <Text style={styles.oddsV}>{fmtOdd(v)}</Text>
            {a ? <Text style={[styles.oddsArrow, { color: a.c }]}>{a.s}</Text> : null}
          </View>
        );
      })}
    </View>
  );

  const renderMarketRow = ({ item }) => {
    const cells = oddsCellsByNo.get(item.no) || {};
    const cell = cells[oddsDay] || null;
    // Arka uç sebebi vermiyorsa (eski sürüm) tek jenerik cümleye düşülür.
    const why = cell ? null : (oddsNotesByNo.get(item.no)?.[oddsDay] || null);
    const head = (
      <View style={styles.memTop}>
        <Text style={styles.memNo}>{item.no}</Text>
        <Text style={styles.memTeams} numberOfLines={1}>{item.home} – {item.away}</Text>
      </View>
    );

    // TEK KAYNAKLI GÖRÜNÜM (eski davranış aynen korunur).
    const prev = cell ? prevOddsCell(cells) : null;
    return (
      <View style={styles.memRow}>
        {head}
        {cell ? (
          <View style={styles.oddsWrap}>
            <OddsTriple odds={cell.odds} prev={prev?.odds} />
            <Text style={styles.oddsHint}>{prev ? 'Bir önceki güne göre değişim' : 'İlk kayıtlı gün (kıyas yok)'}</Text>
          </View>
        ) : (
          <View>
            <Text style={styles.memNone}>{why?.text ? `${why.text}.` : 'Bu gün için oran kaydı yok.'}</Text>
            {why?.detail ? <Text style={styles.memWhy}>{why.detail}</Text> : null}
          </View>
        )}
      </View>
    );
  };

  // Radar 3 (Oynanma DNA): seçili günün mühürlü yüzdesi + önceki güne göre yön.
  // Omurga yine masterMatches (15, Spor Toto sırası); yüzde hücreleri no ile eşlenir.
  const playedDays = dailyPlayed?.days || [];
  const playedCellsByNo = new Map((dailyPlayed?.matches || []).map((m) => [m.no, m.cells || {}]));
  const playedSelIdx = playedDays.findIndex((d) => d.date === playedDay);
  const PROVIDER_ORDER = ['nesine', 'misli', 'bilyoner', 'oley'];
  // Bir sağlayıcının, seçili günden önceki en yakın günkü değeri (ok kıyası için).
  const prevProviderCell = (cells, provider) => {
    for (let i = playedSelIdx - 1; i >= 0; i--) {
      const bs = cells?.[playedDays[i].date]?.bySource;
      if (bs && bs[provider]) return bs[provider];
    }
    return null;
  };
  // Bu hafta veri veren sağlayıcılar, sabit sırayla (Nesine · Misli · Bilyoner).
  const activeProviders = (dailyPlayed?.sources || []).slice()
    .sort((a, b) => ((PROVIDER_ORDER.indexOf(a) + 1) || 99) - ((PROVIDER_ORDER.indexOf(b) + 1) || 99));
  // Seçili gün henüz gelmediyse (gelecek) yüzde basılmaz.
  const playedDayFuture = !!(playedDays.find((d) => d.date === playedDay)?.future);
  // GEÇMİŞ OYNANMA DNA'SI PANELİ — kaynak satırına dokununca açılır.
  // Yalnız GERÇEK arşiv kayıtları gösterilir: adet + yüzde. Bu panelde güven
  // seviyesi, örneklem uyarısı veya olasılık iddiası YOKTUR (tasarım gereği);
  // "kaç kayıtta" ifadesi örneklemi zaten şeffaf biçimde bildirir.

  // Her maçta HER kaynağın (Nesine/Misli/Bilyoner) o günkü yüzdesi ayrı satırda.
  const renderPublicRow = ({ item }) => {
    if (playedDayFuture) {
      return (
        <View style={styles.memRow}>
          <View style={styles.memTop}>
            <Text style={styles.memNo}>{item.no}</Text>
            <Text style={styles.memTeams} numberOfLines={1}>{item.home} – {item.away}</Text>
          </View>
          <Text style={styles.memNone}>Bu gün henüz gelmedi — yüzde o gün oluştukça dolar.</Text>
        </View>
      );
    }
    const cells = playedCellsByNo.get(item.no) || {};
    const bySource = cells[playedDay]?.bySource || null;
    return (
      <View style={styles.memRow}>
        <View style={styles.memTop}>
          <Text style={styles.memNo}>{item.no}</Text>
          <Text style={styles.memTeams} numberOfLines={1}>{item.home} – {item.away}</Text>
        </View>
        {activeProviders.length ? activeProviders.map((pv) => {
          const c = bySource?.[pv] || null;
          const prev = c ? prevProviderCell(cells, pv) : null;
          const key = `${item.no}|${pv}`;
          const acik = dnaKey === key;
          return (
            <View key={pv}>
              {/* Kaynak satırı: dokununca o kaynağın GEÇMİŞ Oynanma DNA'sı açılır. */}
              <TouchableOpacity
                style={styles.provRow}
                activeOpacity={c ? 0.7 : 1}
                disabled={!c}
                onPress={() => setDnaKey(acik ? null : key)}
              >
                <Text style={styles.provTag}>{providerLabel(pv)}</Text>
                {c ? (
                  <View style={styles.provVals}>
                    {['1', 'X', '2'].map((k) => {
                      const v = c.percentages?.[k];
                      const a = oddsArrow(v, prev?.percentages?.[k]);
                      return (
                        <Text key={k} style={styles.provVal}>
                          {k} %{Math.round(Number(v))}
                          {a ? <Text style={{ color: a.c, fontWeight: '900' }}> {a.s}</Text> : null}
                        </Text>
                      );
                    })}
                    <Text style={styles.provChev}>{acik ? '⌄' : '›'}</Text>
                  </View>
                ) : <Text style={styles.provNone}>bu gün kayıt yok</Text>}
              </TouchableOpacity>
              {acik ? (
                <PlayedDnaPanel
                  roundId={view?.roundId ?? selectedId}
                  no={item.no}
                  source={pv}
                  day={playedDay}
                  tick={playedTick}
                />
              ) : null}
            </View>
          );
        }) : <Text style={styles.memNone}>Bu gün için oynanma yüzdesi kaydı yok.</Text>}
      </View>
    );
  };

  const renderItem = centerMode
    ? (tab === 'master'
      ? ({ item }) => (
        <MasterMatchCard
          item={item}
          sealed={!!meta?.sealed}
          expanded={expandedNo === item.no}
          onToggle={() => setExpandedNo(expandedNo === item.no ? null : item.no)}
          onDetail={() => navigation.navigate('MatchDetail', { no: item.no })}
          pickRow={<PickRow no={item.no} />}
        />
      )
      : tab === 'bulletinMemory'
        ? renderMemoryRow
        : tab === 'market'
          ? renderMarketRow
          : tab === 'publicBetting'
            ? renderPublicRow
            : ({ item }) => <RadarTabCard item={item} radarId={tab} />)
    : renderLegacyItem;

  return (
    <ScreenBackdrop>
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <AnalysisHeader
        title={meta?.round ? `${meta.round} · Radar Merkezi` : 'Radar Merkezi'}
        subtitle={legacyMode ? 'Sürpriz radarı arşivi (eski sistem görünümü)' : 'Master Radar + 5 radar · açıklanabilir karar desteği'}
      >
        {meta?.sealed || meta?.frozenAt ? (
          <View style={styles.frozenBadge}>
            <Text style={styles.frozenTxt}>
              🔏 Mühürlü analiz · {fmtClock(meta.sealedAt || meta.frozenAt)} itibarıyla kilitlendi — sonuçlar gelse de bu görüntü değişmez
              {meta.shortHash ? ` · Doğrulama #${meta.shortHash}` : ''}
            </Text>
          </View>
        ) : freezeMin != null ? (
          <View style={styles.frozenBadge}>
            <Text style={styles.frozenTxt}>⏳ Radar {freezeMin} dk sonra (ilk maçtan 5 dk önce) mühürlenecek — sonrasında değişmez</Text>
          </View>
        ) : null}
        {centerMode && meta?.avgDq != null ? (
          <View style={styles.dqBadge}>
            <Text style={styles.dqTxt}>
              📡 Veri yeterliliği: %{meta.avgDq} · Aktif radar: {masterMatches[0] ? `${masterMatches[0].master?.activeRadarCount ?? '—'}/5` : '—'}
              {' · Tahmin güveni her kartta ayrı gösterilir'}
            </Text>
          </View>
        ) : null}
        {rsc ? (
          <View style={styles.rscBadge}>
            <Text style={styles.rscTxt}>
              🎯 Radar Karnesi: Ana tahmin %{rsc.master.allTime.mainAccuracy.rate ?? '—'} (n={rsc.master.allTime.mainAccuracy.total})
              · Güçlü aday %{rsc.master.allTime.strongCandidate.rate ?? '—'} (n={rsc.master.allTime.strongCandidate.total})
              · Sürpriz yakalama %{rsc.master.allTime.surpriseCandidate.catchRate ?? '—'} (n={rsc.master.allTime.surpriseCandidate.total})
              {rsc.note ? ' · az örneklem' : ''}
            </Text>
            {/* KRİTER KARNESİ (lig kırılımlı): her sinyalin ve güç dengesi
                kuralının GERÇEK başarısı maçlar sonuçlandıkça burada birikir —
                "form X liginde işliyor mu?" sorusunun veri cevabı. */}
            {rsc.criteria ? (
              <TouchableOpacity onPress={() => setShowCriteria((v) => !v)} activeOpacity={0.85}>
                <Text style={[styles.rscTxt, { marginTop: 4 }]}>
                  🧪 Kriter Karnesi (lig kırılımlı) {showCriteria ? '▾' : '›'}
                </Text>
                {showCriteria ? (
                  <View>
                    {rsc.criteria.strengthRule?.evaluated ? (
                      <Text style={styles.rscTxt}>
                        ⚖️ {rsc.criteria.strengthRule.label} — {['homeStrong', 'awayStrong', 'even'].map((k) => {
                          const t = rsc.criteria.strengthRule.tiers?.[k];
                          if (!t?.total) return null;
                          return t.expectedRate != null
                            ? `${t.label}: beklenen taraf %${t.expectedRate} (n${t.total})`
                            : `${t.label}: 1/X/2 → ${t.results['1']}/${t.results.X}/${t.results['2']} (n${t.total})`;
                        }).filter(Boolean).join(' · ')}
                      </Text>
                    ) : null}
                    {rsc.criteria.masterByBalance ? (() => {
                      const mb = rsc.criteria.masterByBalance;
                      const seg = ['even', 'homeStrong', 'awayStrong']
                        .map((k) => (mb[k]?.mainAccuracy?.total ? `${mb[k].label}: %${mb[k].mainAccuracy.rate ?? '—'} (n${mb[k].mainAccuracy.total})` : null))
                        .filter(Boolean);
                      return seg.length ? (
                        <Text style={styles.rscTxt}>🎚️ Maç tipine göre ana tahmin — {seg.join(' · ')}</Text>
                      ) : null;
                    })() : null}
                    {(rsc.criteria.signals || []).slice(0, 6).map((s) => {
                      const tierSeg = ['strong', 'even', 'weak']
                        .map((k) => (s.byOpponentTier?.[k]?.total ? `${s.byOpponentTier[k].label} %${s.byOpponentTier[k].rate ?? '—'} (n${s.byOpponentTier[k].total})` : null))
                        .filter(Boolean);
                      return (
                        <Text key={s.key} style={styles.rscTxt}>
                          • {s.label}: %{s.overall.rate ?? '—'} (n{s.overall.total})
                          {s.byLeague?.length ? ` — ${s.byLeague.slice(0, 3).map((l) => `${l.league} %${l.rate ?? '—'} (n${l.total})`).join(' · ')}` : ''}
                          {tierSeg.length ? ` — ${tierSeg.join(' · ')}` : ''}
                        </Text>
                      );
                    })}
                    <Text style={styles.rscMuted}>{rsc.criteria.note}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          // YENİ BAŞLANGIÇ: eski Banko/Sürpriz yüzdeleri hiçbir koşulda
          // gösterilmez — karne yalnız resmî mühürlü haftalarla dolar.
          <View style={styles.rscBadge}>
            <Text style={styles.rscTxt}>🎯 Radar Karnesi ilk resmî mühürlü hafta sonuçlandığında oluşacaktır. Geçmişe dönük başarı üretilmez.</Text>
          </View>
        )}
        <View style={styles.headLinks}>
          <TouchableOpacity onPress={() => navigation.navigate('SystemScorecard')}>
            <Text style={[styles.headLinkTxt, { color: '#9FC4B0' }]}>📊 Sistem Karnesi ›</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleMethodology}>
            <Text style={[styles.headLinkTxt, { color: '#A8C4E8' }]}>{showMeth ? '📖 Metodolojiyi gizle' : '📖 Metodoloji'}</Text>
          </TouchableOpacity>
        </View>
        {showMeth ? (
          <View style={styles.methBox}>
            {(methodology?.notes || [
              'Yalnız resmî 90 dakika 1/X/2 sonucu kullanılır.',
            ]).map((t, i) => <Text key={i} style={styles.methLine}>• {t}</Text>)}
            {methodology ? (
              <Text style={styles.methLine}>
                • Ağırlıklar: Rakip Gücü %{methodology.weights.base.performance} · xG %{methodology.weights.base.expectation} · Oynanma DNA %{methodology.weights.base.publicBetting} · Oran Takibi %{methodology.weights.base.market} · Bülten DNA %{methodology.weights.base.bulletinMemory} — verisi olmayan radar sıfırlanır, kalanlar 100'e normalize edilir.
              </Text>
            ) : null}
            <Text style={styles.methLine}>• Sürüm: {meta?.methodologyVersion || methodology?.methodologyVersion || '—'}</Text>
          </View>
        ) : null}
      </AnalysisHeader>

      {/* HAFTA ÇUBUKLARI */}
      {weeks.length > 0 && (
        <View style={styles.weekBarWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekBar}>
            {weeks.map((w) => {
              const on = Number(w.roundId) === Number(selectedId);
              const isCur = isCurrentWeek(w, curId); // backend current:true alanı esas
              return (
                <TouchableOpacity key={w.roundId} onPress={() => selectWeek(w.roundId)} style={[styles.weekChip, on && styles.weekChipOn]} activeOpacity={0.85}>
                  <Text style={[styles.weekChipTxt, on && styles.weekChipTxtOn]}>
                    {w.round || `#${w.roundId}`}{isCur ? ' · Güncel' : (w.locked || w.sealed) ? ' 🔏' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* SEKMELER — Master + Radar 1-5 şeridi legacy haftalar DIŞINDA her durumda
          görünür (boş/bekleyen/hatalı durumlarda da iskelet korunur). */}
      {!legacyMode ? (
        <View style={styles.tabsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsBar}>
            {RADAR_TAB_DEFS.map((t) => {
              const on = tab === t.k;
              return (
                <TouchableOpacity key={t.k} onPress={() => { setTab(t.k); setExpandedNo(null); }} style={[styles.radarTab, on && styles.radarTabOn]} activeOpacity={0.85}>
                  <Text style={[styles.radarTabTxt, on && styles.radarTabTxtOn]}>{t.label}</Text>
                  <Text style={[styles.radarTabSub, on && styles.radarTabSubOn]}>{t.sub}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.tabsWrapRow}>
          {[{ k: 'r1', label: 'Radar 1', sub: 'Karar destek' }, { k: 'r2', label: 'Radar 2', sub: 'xG görünümü' }].map((t) => {
            const on = legacyView === t.k;
            return (
              <TouchableOpacity key={t.k} onPress={() => setLegacyView(t.k)} style={[styles.radarTab, { flex: 1 }, on && styles.radarTabOn]} activeOpacity={0.85}>
                <Text style={[styles.radarTabTxt, on && styles.radarTabTxtOn]}>{t.label}</Text>
                <Text style={[styles.radarTabSub, on && styles.radarTabSubOn]}>{t.sub}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* FİLTRELER (Master) / ÖZET ŞERİDİ (legacy) */}
      {centerMode && tab === 'master' ? (
        <View style={styles.filterWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sumStrip}>
            {MASTER_FILTERS.map((f) => {
              const on = filter === f.k;
              const count = f.k === 'strong' ? classCounts.strong
                : f.k === 'medium' ? classCounts.medium
                : f.k === 'surprise' ? classCounts.surprise
                : f.k === 'insufficient' ? classCounts.insufficient
                : null;
              return (
                <TouchableOpacity key={f.k} onPress={() => setFilter(on ? 'all' : f.k)} style={[styles.sumChip, on && styles.sumChipOn]} activeOpacity={0.85}>
                  <Text style={[styles.sumChipTxt, on && styles.sumChipTxtOn]}>{f.label}{count != null ? ` (${count})` : ''}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity onPress={() => setSortMode(sortMode === 'risk' ? 'order' : 'risk')} style={[styles.sumChip, styles.sortChip]} activeOpacity={0.85}>
              <Text style={styles.sumChipTxt}>⇅ {sortMode === 'risk' ? 'Risk sırası' : 'Bülten sırası'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      ) : legacyMode ? (
        <View style={styles.sumStrip}>
          {[
            { k: 'red', label: 'Sürprize açık', icon: '🔴' },
            { k: 'yellow', label: 'Dikkat', icon: '🟡' },
            { k: 'green', label: 'Güçlü Aday', icon: '🟢' },
          ].map((t) => {
            const on = legacyFilter === t.k;
            return (
              <TouchableOpacity key={t.k} onPress={() => setLegacyFilter(on ? null : t.k)} style={[styles.sumChip, on && styles.sumChipOn]} activeOpacity={0.85}>
                <Text style={[styles.sumChipTxt, on && styles.sumChipTxtOn]}>{t.icon} {legacyCounts[t.k]} {t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      <FlatList
        data={listData}
        extraData={[tab, legacyView, filter, legacyFilter, sortMode, expandedNo, picks, dnaPeriod, positionDna, dailyOdds, oddsDay, dailyPlayed, playedDay, dnaKey]}
        keyExtractor={(r) => String(r.no)}
        // BUG DÜZELTMESİ: Web'de FlatList varsayılan ilk 10 satırı çizer
        // (initialNumToRender=10) ve filtre küçülüp "Tümü"ne dönünce
        // sanallaştırma penceresi 10'da takılı kalabiliyordu (15 maçın 10'u
        // görünüyordu). Liste zaten en çok 15 satır — sanallaştırmaya gerek
        // yok; tamamı baştan çizilir.
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={21}
        removeClippedSubviews={false}
        renderItem={renderItem}
        ListHeaderComponent={radarTabHeader()}
        ListFooterComponent={
          centerMode && tab === 'bulletinMemory' && positionDna?.hasData ? (
            <Text style={styles.dnaFootnote}>
              Yalnız resmî tam maç sonuçları · en son tamamlanmış bültenden geriye · güncel hafta hariç.
              {' '}Tarihsel yardımcı bilgidir; tek başına tahmin değildir.
            </Text>
          ) : null
        }
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => (meta?.current === false ? selectWeek(selectedId) : load())} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.stateBox}>
            {screenState === 'error' ? (
              <>
                <Text style={styles.stateTitle}>⚠️ Radar verisi alınamadı</Text>
                <Text style={[styles.muted, { textAlign: 'center' }]}>{error}</Text>
                <TouchableOpacity onPress={retry} style={styles.retryBtn} activeOpacity={0.85}>
                  <Text style={styles.retryTxt}>↻ Tekrar Dene</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={[styles.muted, { textAlign: 'center' }]}>
                {centerMode && filter !== 'all'
                  ? 'Bu filtrede maç yok.'
                  : legacyMode
                    ? (meta?.note || 'Bu haftanın radar arşivi boş.')
                    : screenStateMessage(screenState, meta) || 'Bu hafta için radar verisi yok.'}
              </Text>
            )}
          </View>
        }
      />
    </View>
    </ScreenBackdrop>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24 },
  muted: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  frozenBadge: { marginTop: 8, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  frozenTxt: { color: '#E8D9A8', fontSize: 11, fontWeight: '700', lineHeight: 15 },
  dqBadge: { marginTop: 6, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  dqTxt: { color: '#CFE3F7', fontSize: 11, fontWeight: '800', lineHeight: 15 },
  rscBadge: { marginTop: 6, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  rscTxt: { color: '#B9E3C6', fontSize: 11, fontWeight: '800', lineHeight: 15 },
  rscMuted: { color: 'rgba(185,227,198,0.65)', fontSize: 10, fontWeight: '700', lineHeight: 13, marginTop: 3 },
  headLinks: { flexDirection: 'row', gap: 16, marginTop: 8 },
  headLinkTxt: { fontSize: 12, fontWeight: '700' },
  methBox: { marginTop: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.sm, padding: 10 },
  methLine: { color: '#D7E3F4', fontSize: 10.5, lineHeight: 15 },

  weekBarWrap: { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  weekBar: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, paddingVertical: 8 },
  weekChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  weekChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  weekChipTxt: { color: colors.textSoft, fontSize: 12, fontWeight: '800' },
  weekChipTxtOn: { color: '#fff' },

  tabsWrap: { backgroundColor: 'transparent' },
  tabsWrapRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  tabsBar: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  radarTab: { minWidth: 86, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center' },
  radarTabOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  radarTabTxt: { color: colors.text, fontSize: 13, fontWeight: '900' },
  radarTabTxtOn: { color: '#fff' },
  radarTabSub: { color: colors.textMuted, fontSize: 10, fontWeight: '700', marginTop: 1 },
  radarTabSubOn: { color: 'rgba(255,255,255,0.8)' },

  filterWrap: {},
  sumStrip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 6, flexWrap: 'wrap' },
  sumChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  sumChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  sumChipTxt: { color: colors.textSoft, fontSize: 11, fontWeight: '800' },
  sumChipTxtOn: { color: '#fff' },
  sortChip: { backgroundColor: colors.surfaceSoft, borderStyle: 'dashed' },

  // Radar 5 (Bülten DNA) — sade dönem filtresi + maç odaklı satır.
  dnaTrendUp: { color: colors.success },
  dnaTrendDown: { color: colors.danger },
  dnaTrendFlat: { color: colors.warning },
  dnaFootnote: { color: colors.textMuted, fontSize: 10.5, lineHeight: 15, marginTop: 6, fontStyle: 'italic' },
  memRow: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  memTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  memNo: { color: colors.textMuted, fontSize: 15, fontWeight: '800', width: 22, textAlign: 'center' },
  memTeams: { color: colors.text, fontSize: 14, fontWeight: '800', flex: 1 },
  memPctRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 6, marginLeft: 34 },
  memPctLabel: { color: colors.textSoft, fontSize: 12, fontWeight: '800' },
  memOutcome: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, paddingHorizontal: 5, paddingVertical: 3, backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border },
  memOutcomeKey: { color: colors.white, backgroundColor: colors.primary, borderRadius: radius.pill, minWidth: 20, paddingVertical: 2, textAlign: 'center', fontSize: 11, fontWeight: '900' },
  memOutcomeOneKey: { backgroundColor: colors.info },
  memOutcomeDrawKey: { backgroundColor: colors.warning, color: colors.primary },
  memOutcomeTwoKey: { backgroundColor: colors.accent },
  memOutcomeValue: { color: colors.textSoft, fontSize: 12, fontWeight: '900' },
  memSuccessRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, marginLeft: 34 },
  memSuccess: { color: colors.success, fontSize: 12, fontWeight: '900' },
  memSuccessValue: { color: colors.success, fontSize: 12, fontWeight: '900' },
  memTrend: { fontSize: 12, fontWeight: '900' },
  memNone: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic', marginTop: 6, marginLeft: 34 },
  // Eksik oranın AYRINTILI gerekçesi (kapsam raporundan gelen gerçek cümle).
  memWhy: { color: colors.textMuted, fontSize: 11, marginTop: 2, marginLeft: 34, opacity: 0.85 },

  // Radar 4 (Oran Takibi) — gün filtresi + günlük 1/X/2 oran satırı.
  oddsWrap: { marginTop: 8, marginLeft: 34 },
  oddsLine: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  oddsCell: { flexDirection: 'row', alignItems: 'baseline', gap: 4, backgroundColor: colors.surfaceSoft, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 5 },
  oddsK: { color: colors.textMuted, fontSize: 11, fontWeight: '900' },
  oddsV: { color: colors.text, fontSize: 14, fontWeight: '900' },
  oddsArrow: { fontSize: 11, fontWeight: '900' },
  oddsHint: { color: colors.textMuted, fontSize: 10, fontWeight: '700', marginTop: 5 },
  // Radar 3 — kaynak (site) bazlı satır: Nesine / Misli / Bilyoner ayrı ayrı.
  provRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, marginLeft: 34, flexWrap: 'wrap' },
  provTag: { color: colors.text, fontSize: 11, fontWeight: '900', minWidth: 62, backgroundColor: colors.surfaceSoft, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 7, paddingVertical: 3, textAlign: 'center' },
  provVals: { flexDirection: 'row', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' },
  provVal: { color: colors.textSoft, fontSize: 13, fontWeight: '800' },
  provNone: { color: colors.textMuted, fontSize: 11, fontStyle: 'italic' },
  provChev: { color: colors.textMuted, fontSize: 13, fontWeight: '900' },

  // Oynanma DNA paneli (kaynak satırına dokununca açılır)
  dnaFoot: { color: colors.textMuted, fontSize: 9.5, marginTop: 8, opacity: 0.8 },

  row: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  rowExpanded: { borderWidth: 1.5, borderColor: colors.primary },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rank: { color: colors.textMuted, fontSize: 16, fontWeight: '800', width: 22, textAlign: 'center' },
  teams: { color: colors.text, fontSize: 14, fontWeight: '700' },
  teamsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  teamName: { flexShrink: 1 },
  teamsVs: { color: colors.textMuted, fontSize: 13, fontWeight: '700', marginHorizontal: 1 },
  scoreBar: { marginTop: 6, height: 6, backgroundColor: colors.cardAlt, borderRadius: 3, overflow: 'hidden' },
  right: { alignItems: 'flex-end', gap: 4 },
  scoreNum: { fontSize: 18, fontWeight: '900' },

  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  resultTxt: { color: colors.textSoft, fontSize: 12, fontWeight: '700' },
  resultStrong: { color: colors.text, fontWeight: '900' },
  hitPill: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  hitPillTxt: { color: '#fff', fontSize: 10.5, fontWeight: '900' },

  favRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  favPill: { backgroundColor: colors.cardAlt, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  favPillTxt: { color: colors.text, fontSize: 11.5, fontWeight: '900' },
  probs: { color: colors.textSoft, fontSize: 11.5, fontWeight: '700' },

  signals: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 7 },
  formRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 },
  formLbl: { color: colors.textMuted, fontSize: 10.5, fontWeight: '800' },
  formSep: { color: colors.textMuted, fontSize: 10 },

  factors: { marginTop: 7, gap: 2 },
  factorTxt: { color: colors.textSoft, fontSize: 11.5, fontWeight: '600', lineHeight: 16 },
  factorPts: { color: colors.warning, fontWeight: '900' },
  comment: { color: colors.textMuted, fontSize: 11, fontStyle: 'italic', lineHeight: 15, marginTop: 7 },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  // Yayında okunur seçim pilleri: büyük dokunma alanı + belirgin çerçeve.
  pickBtns: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  pickBtn: { minWidth: 46, paddingVertical: 11, borderRadius: radius.sm, backgroundColor: colors.cardAlt, borderWidth: 2, borderColor: colors.border, alignItems: 'center' },
  pickBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  pickTxt: { color: colors.text, fontSize: 15, fontWeight: '900' },
  pickTxtOn: { color: '#fff' },
  pickHint: { color: colors.textMuted, fontSize: 11, fontWeight: '800', marginLeft: 4 },
  detailBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.sm, backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border },
  detailBtnTxt: { color: colors.textSoft, fontSize: 11.5, fontWeight: '800' },

  stateBox: { alignItems: 'center', marginTop: 40, gap: 10, paddingHorizontal: spacing.lg },
  stateTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  retryBtn: { marginTop: 4, paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.primary },
  retryTxt: { color: '#fff', fontSize: 13, fontWeight: '900' },
});
