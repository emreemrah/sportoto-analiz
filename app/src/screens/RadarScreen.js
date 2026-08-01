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
import { MasterMatchCard, RadarTabCard, RADAR_TAB_DEFS } from '../components/RadarCenterCards';
import RadarTabHeader, { providerLabel } from '../components/RadarTabHeaders';
import { MarketRow, PublicRow } from '../components/RadarDayRows';
import LegacyRadarCard from '../components/LegacyRadarCard';
import HaftaSecici from '../components/HaftaSecici';
import { getDraft, setDraftPick } from '../coupon/store';
import { OUTCOMES } from '../couponConfig';
import {
  normalizeWeeks, resolveCurrentId, isCurrentWeek, deriveScreenState, screenStateMessage,
} from '../radarScreenLogic';
// Veri türetme (filtre/sıralama/sayaç/biçim) ekrandan ayrıldı — bkz.
// radarScreenData.js. Ekran yalnız ÇİZER; ne göstereceğine orası karar verir.
import {
  DNA_PERIODS, MASTER_FILTERS, roundPct100, ord, wdl, num1, fmtClock, birOndalik,
  classCountsOf, filterMaster, sortMaster,
  legacyCountsOf, legacyFiltered, radar5PeriodSuccess, radar5PeriodTrend, rowTrend,
  DONEM_MAC_SAYISI, DNA_PERIOD_LABELS,
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
  const [positionDna, setPositionDna] = useState(null); // Bülten DNA (Radar 5 detayı)
  const [dnaPeriod, setDnaPeriod] = useState('allTime'); // dönem filtresi (Tüm/5/10/15)
  const [acikSira, setAcikSira] = useState(null);        // Radar 5'te açık satır (sıra no)
  const [siraMaclari, setSiraMaclari] = useState({});    // { sıra: {yukleniyor|hata|liste} }
  const [secAcik, setSecAcik] = useState(null);          // hafta seçici: null|'sezon'|'hafta'
  const [navSezon, setNavSezon] = useState(null);        // hafta listesinin sezon süzgeci
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
  // En son UYGULANAN haftanın kimliği — "aynı hafta mı yeniden yüklendi?"
  // sorusunun cevabı. Sekme sıfırlaması buna bakar (bkz. applyResponse).
  const uygulananHafta = useRef(null);
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

    // SEKME KORUMASI — aynı hafta yeniden yüklendiğinde açık radar KORUNUR.
    //
    // Eskiden burada koşulsuz setTab('master') vardı ve bu satır yalnız hafta
    // değişince değil, listeyi aşağı çekince (yenileme), güncel haftaya tekrar
    // dokununca ve "yeniden dene"de de çalışıyordu. Radar 3'te gün çipleri
    // listenin en üstünde olduğu için çipe uzanırken parmağın azıcık kayması
    // yenilemeyi tetikliyor ve kullanıcı Master'a atılıyordu.
    const gelenRid = d?.roundId != null ? Number(d.roundId) : null;
    const ayniHafta = gelenRid != null && uygulananHafta.current != null
      && Number(uygulananHafta.current) === gelenRid;
    uygulananHafta.current = gelenRid;

    if (d?.hasData && Array.isArray(d.matches) && d.matches.length) {
      setView(d);
      setLegacyRadar(null);
      // Hafta DEĞİŞTİYSE Master'a dön (yeni haftada o radarın verisi olmayabilir);
      // aynı haftaysa bulunduğun sekmede kal. 'legacy' artık geçerli değil.
      if (!ayniHafta) setTab('master');
      else setTab((t) => (t === 'legacy' ? 'master' : t));
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
      // Radar 5 satır açılımı da haftaya aittir: açık satır ve çekilmiş maç
      // listeleri temizlenmezse yeni haftada ESKİ haftanın maçları görünür.
      setAcikSira(null); setSiraMaclari({});
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

  // RADAR 5 SATIR AÇ/KAPA — açılırken o sıranın geçmiş maçları BİR KEZ çekilir
  // ve saklanır; aynı satıra tekrar dokunmak yeni istek atmaz. Tek seferde tek
  // satır açık kalır (birden çok açık liste ekranı okunmaz hâle getiriyordu).
  //
  // DİKKAT: bu kanca ERKEN RETURN'LERDEN ÖNCE durmalı. Aşağıya konduğunda
  // "Rendered more hooks than during the previous render" hatası veriyordu —
  // yükleniyor/hata durumlarında ekran o satıra hiç ulaşmıyor.
  const cekilenSira = useRef(new Set());
  const siraAcKapa = useCallback((no) => {
    setAcikSira((onceki) => (onceki === no ? null : no));
    // Anahtar haftayı da içerir: başka haftaya geçilince liste yeniden çekilir.
    const anahtar = `${selectedId}|${no}`;
    if (cekilenSira.current.has(anahtar)) return;
    cekilenSira.current.add(anahtar);
    setSiraMaclari((s) => ({ ...s, [no]: { yukleniyor: true } }));
    api.radarPositionMatches(no, selectedId)
      .then((d) => setSiraMaclari((s) => ({ ...s, [no]: { liste: d?.matches || [] } })))
      .catch((e) => {
        cekilenSira.current.delete(anahtar);           // hata → tekrar denenebilsin
        setSiraMaclari((s) => ({ ...s, [no]: { hata: e.message } }));
      });
  }, [selectedId]);

  useEffect(() => { load(); }, [load]);


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

  // ---- Legacy kart (Radar Merkezi öncesi haftalar) — eski görünüm AYNEN ----
  const legacyCounts = legacyCountsOf(legacyRadar);
  const legacyShown = legacyFiltered(legacyRadar, legacyFilter);

  // Legacy kart components/LegacyRadarCard.js'te. O kod DONMUŞTUR: eski
  // haftalar o hafta göründüğü gibi kalmalı, yeni sistemin dili karışmamalı.
  const renderLegacyItem = ({ item, index }) => (
    <LegacyRadarCard
      item={item} index={index} legacyView={legacyView}
      expanded={expandedNo === item.no}
      onToggle={() => setExpandedNo(expandedNo === item.no ? null : item.no)}
      onDetail={() => navigation.navigate('MatchDetail', { no: item.no })}
    />
  );

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
    // SATIR AÇILIMI — dokununca bu SIRANIN geçmiş maçları listelenir. Yüzdenin
    // arkasındaki maçlar gösterilmezse kullanıcı sayıyı doğrulayamaz.
    const acik = acikSira === item.no;
    const kayit = siraMaclari[item.no];
    return (
      <View style={styles.memRow}>
        <TouchableOpacity
          onPress={() => siraAcKapa(item.no)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`${item.no}. sıranın geçmiş maçları${acik ? ' — kapat' : ''}`}
        >
          <View style={styles.memTop}>
            <Text style={styles.memNo}>{item.no}</Text>
            <Text style={styles.memTeams} numberOfLines={1}>{item.home} – {item.away}</Text>
            <Text style={styles.memAc}>{acik ? '▲' : '▼'}</Text>
          </View>
        </TouchableOpacity>
        {pct ? (
          <>
            <View style={styles.memPctRow}>
              {/* Hafta sayısı parantez içinde yazılıyordu, kullanıcı kararıyla
                  kaldırıldı ("52/51/50 ne demek?"). Az örneklem uyarısı ALTTA
                  duruyor — sezon başında tek maçtan gelen "%100" için gerekli. */}
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
        {acik ? (
          <View style={styles.macListe}>
            {kayit?.yukleniyor ? (
              <Text style={styles.macBilgi}>Maçlar yükleniyor…</Text>
            ) : kayit?.hata ? (
              <Text style={styles.macBilgi}>Maçlar okunamadı: {kayit.hata}</Text>
            ) : kayit?.liste?.length ? (
              <>
                {/* Liste SEÇİLİ DÖNEMLE sınırlanır: "Son 5 Hafta" seçiliyken
                    51 maç göstermek, ekrandaki yüzdeyle uyuşmayan bir liste
                    olurdu. Yeniden eskiye. */}
                {kayit.liste.slice(0, DONEM_MAC_SAYISI[dnaPeriod] ?? kayit.liste.length).map((m, i) => (
                  <View key={`${m.roundId}-${i}`} style={styles.macSatir}>
                    <Text style={styles.macHafta} numberOfLines={1}>{m.week || '—'}</Text>
                    <Text style={styles.macTakim} numberOfLines={1}>{m.home} – {m.away}</Text>
                    <Text style={styles.macSkor}>{m.score || '—'}</Text>
                    <Text style={[
                      styles.macSonuc,
                      m.result === '1' && styles.memOutcomeOneKey,
                      m.result === 'X' && styles.memOutcomeDrawKey,
                      m.result === '2' && styles.memOutcomeTwoKey,
                    ]}>{m.result}</Text>
                  </View>
                ))}
                <Text style={styles.macBilgi}>
                  {DNA_PERIOD_LABELS[dnaPeriod] || 'Seçili dönem'} · {
                    Math.min(DONEM_MAC_SAYISI[dnaPeriod] ?? kayit.liste.length, kayit.liste.length)
                  } maç · resmî sonuçlar
                </Text>
              </>
            ) : (
              <Text style={styles.macBilgi}>Bu sıra için doğrulanmış geçmiş sonuç yok.</Text>
            )}
          </View>
        ) : null}
      </View>
    );
  };

  // Radar 4 satırı components/RadarDayRows.js'te (MarketRow). Gün/hücre
  // eşlemesi ve önceki-gün kıyası artık orada.
  const renderMarketRow = ({ item }) => (
    <MarketRow item={item} data={dailyOdds} day={oddsDay} />
  );

  // Radar 3 satırı components/RadarDayRows.js'te (PublicRow). Ekran yalnız
  // hangi gün seçili ve hangi DNA paneli açık bilgisini veriyor.
  const renderPublicRow = ({ item }) => (
    <PublicRow
      item={item} data={dailyPlayed} day={playedDay}
      openKey={dnaKey} onToggleDna={setDnaKey}
      roundId={view?.roundId ?? selectedId} tick={playedTick}
    />
  );

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
      {/* SADE BAŞLIK — yeşil saha paneli (AnalysisHeader) ve alt başlık
          kaldırıldı; geriye yalnız hangi haftaya bakıldığı kalıyor.
          Teknik bloklar (veri yeterliliği, karne, metodoloji) ve mühürlenme
          sayacı da çıkarıldı; yönetici tarafına taşınacak. */}
      <View style={styles.ekranBasligi}>
        <Text style={styles.ekranBasligiTxt}>
          {meta?.round ? `${meta.round} · Radar Merkezi` : 'Radar Merkezi'}
        </Text>
        {/* MÜHÜR ROZETİ KALIYOR — teknik gösterge değil, GEÇMİŞ bir haftaya
            bakan kullanıcıya verilen sözdür: "sonuçlar gelse de değişmez". */}
        {meta?.sealed || meta?.frozenAt ? (
          <View style={styles.frozenBadge}>
            <Text style={styles.frozenTxt}>
              🔏 Mühürlü analiz · {fmtClock(meta.sealedAt || meta.frozenAt)} itibarıyla kilitlendi — sonuçlar gelse de bu görüntü değişmez
              {meta.shortHash ? ` · Doğrulama #${meta.shortHash}` : ''}
            </Text>
          </View>
        ) : null}
      </View>

      {/* HAFTA SEÇİCİ — resmî listedeki gezinti: [sezon ▼] [hafta ▼].
          Çipler kaldırıldı: yeni sezon 1. haftayla başlayınca numaralar
          küçülüyor ve haftalar birikiyor (sezonda 52), şerit okunmuyordu. */}
      {weeks.length > 0 && (
        <View style={styles.weekBarWrap}>
          <HaftaSecici
            weeks={weeks} curId={curId} selectedId={selectedId}
            acik={secAcik}
            onToggle={(k) => setSecAcik((v) => (v === k ? null : k))}
            navSezon={navSezon}
            // Sezon seçilince hafta listesi açılır: resmî sitedeki akışla aynı,
            // sıradaki doğal adım hafta seçmektir.
            onSelectSezon={(y) => { setNavSezon(y); setSecAcik('hafta'); }}
            onSelectWeek={(rid) => { setSecAcik(null); selectWeek(rid); }}
          />
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
        extraData={[tab, legacyView, filter, legacyFilter, sortMode, expandedNo, picks, dnaPeriod, acikSira, siraMaclari, secAcik, navSezon, positionDna, dailyOdds, oddsDay, dailyPlayed, playedDay, dnaKey]}
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
        // FİLTRE SATIRI YAPIŞIK — liste aşağı kayınca üstte sabit kalır.
        // Kaymayınca kullanıcı 15. sıraya inip hangi dönemin seçili olduğunu
        // göremiyordu; dönem değiştirmek için hep başa dönmek gerekiyordu.
        //
        // YALNIZ RADAR 5: öbür sekmelerin başlığı uzun bir bilgi panelidir,
        // onu dondurmak ekranın yarısını harcar. Master'da başlık zaten hiç
        // çizilmez — sticky indeks vermek boş bir yapışık şerit bırakırdı.
        // (radarTabHeader() ile koşullamak İŞE YARAMAZ: o bir React öğesi
        // döndürür ve bileşen içeride null çizse bile öğe truthy'dir.)
        stickyHeaderIndices={centerMode && tab === 'bulletinMemory' ? [0] : undefined}
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
  // SADE BAŞLIK — yeşil panel kaldırıldıktan sonra ekranın kendi açık zemini.
  ekranBasligi: { paddingHorizontal: spacing.md, paddingTop: 12, paddingBottom: 10 },
  ekranBasligiTxt: { color: colors.text, fontSize: 20, fontWeight: '900' },
  // Mühür rozeti artık AÇIK zemin üzerinde: koyu panel için seçilmiş
  // saydam beyaz/krem renkler okunmuyordu.
  frozenBadge: { marginTop: 8, backgroundColor: colors.warningSoft || '#FDF3DC', borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  frozenTxt: { color: colors.text, fontSize: 11, fontWeight: '700', lineHeight: 15 },

  weekBarWrap: {
    backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 8,
  },

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
  // RADAR 5 SATIR AÇILIMI — o sıranın geçmiş maçları.
  memAc: { color: colors.primary, fontSize: 11, fontWeight: '900', marginLeft: 6 },
  macListe: { marginTop: 8, marginLeft: 34, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 },
  macSatir: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  macHafta: { width: 66, color: colors.muted, fontSize: 11, fontWeight: '800' },
  macTakim: { flex: 1, color: colors.textSoft, fontSize: 12, fontWeight: '600' },
  macSkor: { width: 38, textAlign: 'right', color: colors.textSoft, fontSize: 12, fontWeight: '800' },
  macSonuc: { width: 20, textAlign: 'center', fontSize: 11, fontWeight: '900', borderRadius: 4, overflow: 'hidden' },
  macBilgi: { color: colors.muted, fontSize: 11, fontStyle: 'italic', marginTop: 6 },
  // Eksik oranın AYRINTILI gerekçesi (kapsam raporundan gelen gerçek cümle).

  // Radar 4 (Oran Takibi) — gün filtresi + günlük 1/X/2 oran satırı.
  // Radar 3 — kaynak (site) bazlı satır: Nesine / Misli / Bilyoner ayrı ayrı.

  // Oynanma DNA paneli (kaynak satırına dokununca açılır)






  // Yayında okunur seçim pilleri: büyük dokunma alanı + belirgin çerçeve.
  pickBtns: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  pickBtn: { minWidth: 46, paddingVertical: 11, borderRadius: radius.sm, backgroundColor: colors.cardAlt, borderWidth: 2, borderColor: colors.border, alignItems: 'center' },
  pickBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  pickTxt: { color: colors.text, fontSize: 15, fontWeight: '900' },
  pickTxtOn: { color: '#fff' },
  pickHint: { color: colors.textMuted, fontSize: 11, fontWeight: '800', marginLeft: 4 },

  stateBox: { alignItems: 'center', marginTop: 40, gap: 10, paddingHorizontal: spacing.lg },
  stateTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  retryBtn: { marginTop: 4, paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.primary },
  retryTxt: { color: '#fff', fontSize: 13, fontWeight: '900' },
});
