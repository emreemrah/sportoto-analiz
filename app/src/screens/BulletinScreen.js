import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Image, Platform } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { api } from '../api';
import { colors, spacing, radius, shadow } from '../theme';
import { matchDate } from '../utils';
import { getPref, setPref } from '../prefs';
import { pickHits } from '../liveLogic';
import { getRankedCoupon, finalVersion } from '../couponStore';
import { toOfficial } from '../couponConfig';
import { RecordBadges } from '../components';
import ScoreLegend from '../components/ScoreLegend';
import LiveBulletinView from '../components/LiveBulletinView';
import BultenBackdrop from '../components/BultenBackdrop';

const MARK = { correct: '✅', wrong: '❌', pending: '⏳', none: '' };

// Resmi sonuç 1/X/2 (sadece resmi skordan). null → henüz yok.
const officialResolved = (m) => !!(m && m.result && m.score);
// Geçmiş maç durumu: resmi sonuç / geçici skor / bekliyor.
const histCategory = (m) => (officialResolved(m) ? 'official' : (m && m.provisional ? 'provisional' : 'waiting'));

// Geçmiş maçın CANLI-uyumlu durumu (Bülten ile aynı filtreler için).
const pastStatus = (m) => {
  if (officialResolved(m)) return 'finished';
  if (m && m.provisional && m.provisional.live) return 'live';
  if (m && m.provisional && m.provisional.finished) return 'finished';
  if (m && m.date && new Date(m.date).getTime() <= Date.now()) return 'awaiting';
  return 'notStarted';
};
// Anlık 1/X/2 (resmi varsa resmi, yoksa geçici skordan).
const pastResult = (m) => {
  if (officialResolved(m)) return m.result;
  if (m && m.provisional) { const s = m.provisional.score; return s.home > s.away ? '1' : s.home < s.away ? '2' : 'X'; }
  return null;
};
// "04.07.2026 19:12" biçimi (kontrol/kaynak zamanı).
const fmtStamp = (iso) => { if (!iso) return ''; const d = matchDate(iso); return `${d.day} ${d.time}`; };
// Takım imzası — eşleşme/teknik görünüm için normalize (spec örneği).
const teamSig = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');

// Maç başlamış mı? Sonucu/skoru var VEYA maç saati geçmiş (görüntüleme anında hesaplanır).
const isStarted = (m) => m.status === 'finished' || (m.date ? new Date(m.date).getTime() <= Date.now() : false);

// Türkçe biçim (Intl'siz): 30578.23 -> ₺30.578,23 · 412124 -> 412.124
const group = (s) => String(s).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const fmtTL = (n) => {
  if (n == null) return '–';
  const [int, dec] = Number(n).toFixed(2).split('.');
  return `₺${group(int)},${dec}`;
};
const fmtCount = (n) => (n == null ? '–' : group(n));

export default function BulletinScreen({ navigation }) {
  const [data, setData] = useState(null);          // güncel analizli bülten
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [rounds, setRounds] = useState(null);       // { currentRoundId, rounds:[{id,name,year,...}] }
  const [selectedId, setSelectedId] = useState(null); // görüntülenen hafta (null = güncel)
  const [hist, setHist] = useState(null);           // geçmiş hafta verisi { roundId, matches, prize }
  const [histLoading, setHistLoading] = useState(false);
  const [histError, setHistError] = useState(null);
  const [histChecking, setHistChecking] = useState(false);      // "Resmi sonuçlar kontrol ediliyor"
  const [histUpdateMsg, setHistUpdateMsg] = useState(null);      // null | 'updated' | 'noNew'
  const [corrections, setCorrections] = useState([]);           // oturum-içi resmi sonuç DÜZELTMELERİ
  const [prizeView, setPrizeView] = useState(getPref('prizeView'));       // list|table|card
  const [histFilter, setHistFilter] = useState('all');                    // all|live|risk|coupon|done
  const [histRiskSubs, setHistRiskSubs] = useState({ coupon: true, system: true });
  const [histBoost, setHistBoost] = useState(false);                      // "Başlamadı" → üste taşı
  const [histSort, setHistSort] = useState(getPref('histSort'));          // bulletin|resolvedTop|waitingBottom
  const [toast, setToast] = useState(null);
  const [refreshSheet, setRefreshSheet] = useState(null);       // null | { no } → 🔄 seçenek kutusu
  const toastTimer = useRef(null);
  const isFocused = useIsFocused();

  const showToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  };
  useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);

  // Yeni resmi sonuçları (fresh) çek, mevcutla karşılaştır: yeni sonuç geldi mi,
  // resmi sonuç DEĞİŞTİ mi (düzeltme). Sahte/tahmini skor asla basılmaz.
  const checkOfficial = useCallback(async (roundId, onlyNo = null) => {
    setHistChecking(true);
    try {
      const fresh = await api.history(roundId, true);
      setHist((prev) => {
        if (!prev || prev.roundId !== roundId) return { ...fresh, roundId };
        const prevBy = new Map(prev.matches.map((m) => [m.no, m]));
        // "Bu maçı yenile" → sadece o satırın resmi sonucunu uygula.
        const mergedMatches = onlyNo != null
          ? prev.matches.map((m) => (m.no === onlyNo ? (fresh.matches.find((f) => f.no === onlyNo) || m) : m))
          : fresh.matches;
        // Düzeltme tespiti: önceki RESMİ sonuç ≠ yeni RESMİ sonuç.
        const newCorr = [];
        for (const nm of mergedMatches) {
          const pm = prevBy.get(nm.no);
          if (officialResolved(pm) && officialResolved(nm)
            && (pm.result !== nm.result || pm.score.home !== nm.score.home || pm.score.away !== nm.score.away)) {
            newCorr.push({ no: nm.no, home: nm.home?.name, away: nm.away?.name,
              oldScore: pm.score, oldResult: pm.result, newScore: nm.score, newResult: nm.result });
            console.warn(`[audit] Resmi sonuç düzeltmesi · hafta ${roundId} maç ${nm.no}: ${pm.score.home}-${pm.score.away}(${pm.result}) → ${nm.score.home}-${nm.score.away}(${nm.result}) · Kaynak: Spor Toto · ${new Date().toISOString()}`);
          }
        }
        const prevResolved = prev.matches.filter(officialResolved).length;
        const newResolved = mergedMatches.filter(officialResolved).length;
        if (newCorr.length) { setCorrections((c) => [...c, ...newCorr]); showToast('Resmi sonuç düzeltmesi var'); setHistUpdateMsg('updated'); }
        else if (newResolved > prevResolved) { showToast('Resmi sonuçlar güncellendi'); setHistUpdateMsg('updated'); }
        else setHistUpdateMsg('noNew');
        return { ...fresh, matches: mergedMatches, roundId };
      });
    } catch { /* sessiz — mevcut veri kalır */ }
    finally { setHistChecking(false); }
  }, []);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [d, r] = await Promise.all([
        api.bulletin(),
        api.rounds().catch(() => null),
      ]);
      setData(d);
      if (r) setRounds(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Tarayıcı otomatik çevirisini kapat (takım adları resmi/İngilizce kalsın).
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.setAttribute('translate', 'no');
      document.documentElement.classList.add('notranslate');
      if (!document.querySelector('meta[name="google"]')) {
        const meta = document.createElement('meta');
        meta.name = 'google';
        meta.content = 'notranslate';
        document.head.appendChild(meta);
      }
    }
  }, []);

  const currentRoundId = rounds?.currentRoundId ?? null;
  const effectiveId = selectedId ?? currentRoundId;
  const viewingCurrent = effectiveId == null || effectiveId === currentRoundId;

  // Navigasyon listesi: en eski → güncel (gelecekteki yayımlanmamış haftalar hariç)
  const allRounds = rounds?.rounds || [];
  const curIdx = allRounds.findIndex((r) => r.id === currentRoundId);
  const navRounds = curIdx >= 0 ? allRounds.slice(0, curIdx + 1) : allRounds;
  const selIdx = navRounds.findIndex((r) => r.id === effectiveId);
  const selMeta = navRounds[selIdx] || null;
  const canPrev = selIdx > 0;                       // daha eski hafta var
  const canNext = selIdx >= 0 && selIdx < navRounds.length - 1; // daha yeni hafta var

  // Geçmiş hafta seçilince: KAYITLI veriyi hemen göster, sonra resmi sonuçları
  // arka planda kontrol et (spec: açılış davranışı).
  useEffect(() => {
    if (viewingCurrent || effectiveId == null) { setHist(null); setHistError(null); setHistUpdateMsg(null); setCorrections([]); setHistFilter('all'); setHistBoost(false); return; }
    if (hist && hist.roundId === effectiveId) return;
    let alive = true;
    setHistLoading(true); setHistError(null); setHistUpdateMsg(null); setCorrections([]); setHistFilter('all'); setHistBoost(false);
    api.history(effectiveId)
      .then((h) => { if (alive) { setHist({ ...h, roundId: effectiveId }); checkOfficial(effectiveId); } })
      .catch((e) => { if (alive) setHistError(e.message); })
      .finally(() => { if (alive) setHistLoading(false); });
    return () => { alive = false; };
  }, [effectiveId, viewingCurrent]); // eslint-disable-line

  // 15 sn OTO KONTROL — sadece ekran açık + geçmiş bülten görünür + tam
  // açıklanmamışsa. 15/15 resmi sonuç + ikramiye gelince veya ekrandan çıkınca durur.
  useEffect(() => {
    if (viewingCurrent || !hist || hist.roundId !== effectiveId || !isFocused) return;
    const done = hist.matches.length > 0 && hist.matches.every(officialResolved) && !!hist.prize;
    if (done) return;
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      checkOfficial(effectiveId);
    }, 15000);
    return () => clearInterval(id);
  }, [viewingCurrent, hist, effectiveId, isFocused, checkOfficial]);

  // Güncel bülten 15 sn CANLI yenileme — ekran açık + güncel görünümde.
  useEffect(() => {
    if (!isFocused || !viewingCurrent) return;
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      load();
    }, 15000);
    return () => clearInterval(id);
  }, [isFocused, viewingCurrent, load]);

  const goPrev = () => { if (canPrev) setSelectedId(navRounds[selIdx - 1].id); };
  const goNext = () => { if (canNext) setSelectedId(navRounds[selIdx + 1].id); };
  const goCurrent = () => setSelectedId(currentRoundId);

  // İlk yükleme: hiç veri yokken tam ekran bekleme
  if (loading && !data) {
    return <Center><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.muted}>Bülten yükleniyor…</Text></Center>;
  }

  // ——— Başlık / hafta seçici ———
  const upcomingCount = data ? data.matches.filter((m) => !isStarted(m)).length : 0;
  // GEÇMİŞ SONUÇ DURUMU — "Sonuçlar açıklandı" YALNIZ 15/15 resmi skor + 1/X/2
  // + ikramiye gelince. Aksi halde dereceli durum (n/15).
  const histMatches = hist?.matches || [];
  const totalM = histMatches.length;
  const resolvedCount = histMatches.filter(officialResolved).length;
  const hasPrize = !!hist?.prize;
  const fullyResolved = totalM > 0 && resolvedCount === totalM;   // 15/15 resmi sonuç
  const allAnnounced = fullyResolved && hasPrize;                 // + ikramiye

  // Geçmiş bülten üst özet + filtre/sıralama (Canlı Bülten yapısı, resmi-sonuç uyarlaması)
  const histCounts = { live: 0, notStarted: 0, finished: 0, couponRisk: 0, systemRisk: 0 };
  for (const m of histMatches) {
    const st = pastStatus(m);
    if (st === 'live') histCounts.live += 1;
    else if (st === 'notStarted') histCounts.notStarted += 1;
    else if (st === 'finished') histCounts.finished += 1;
    if (st === 'live' && pickHits(m.prediction?.symbol, pastResult(m)) === false) histCounts.systemRisk += 1;
    // couponRisk: gerçek kupon yok → 0
  }
  const histSorted = (() => {
    let list = histMatches;
    if (histFilter === 'live') list = list.filter((m) => pastStatus(m) === 'live');
    else if (histFilter === 'done') list = list.filter((m) => pastStatus(m) === 'finished');
    else if (histFilter === 'coupon') list = []; // kupon yok
    else if (histFilter === 'risk') list = list.filter((m) => pastStatus(m) === 'live' && histRiskSubs.system && pickHits(m.prediction?.symbol, pastResult(m)) === false);
    const byNo = (a, b) => a.no - b.no;
    const arr = [...list];
    if (histBoost && histFilter === 'all') arr.sort((a, b) => { const an = pastStatus(a) === 'notStarted' ? 0 : 1; const bn = pastStatus(b) === 'notStarted' ? 0 : 1; return an - bn || byNo(a, b); });
    else if (histSort === 'resolvedTop') { const w = (m) => (histCategory(m) === 'official' ? 0 : histCategory(m) === 'provisional' ? 1 : 2); arr.sort((a, b) => w(a) - w(b) || byNo(a, b)); }
    else if (histSort === 'waitingBottom') { const w = (m) => (histCategory(m) === 'waiting' ? 1 : 0); arr.sort((a, b) => w(a) - w(b) || byNo(a, b)); }
    else arr.sort(byNo);
    return arr;
  })();

  const roundName = selMeta?.name || data?.round || '—';
  const roundYear = selMeta?.year || '';
  const subtitle = viewingCurrent
    ? (error ? 'güncel bülten alınamadı'
      : data?.pending ? 'güncel resmi bülten bekleniyor'
      : upcomingCount > 0
        ? `${upcomingCount}/${data.matchCount} maç başlamadı · analiz hazır${data.usingExampleKey ? ' · (örnek anahtar)' : ''}`
        : 'bu haftanın maçları başladı')
    : (histLoading ? 'yükleniyor…'
      : histError ? 'sonuç alınamadı'
      : histChecking && !totalM ? 'Resmi sonuçlar kontrol ediliyor 🔄'
      : allAnnounced ? 'Sonuçlar açıklandı'
      : histChecking ? `Resmi sonuçlar kontrol ediliyor 🔄${resolvedCount ? ` · ${resolvedCount}/${totalM} geldi` : ''}`
      : fullyResolved ? 'Maç sonuçları tamamlandı · İkramiye bekleniyor'
      : corrections.length ? `Resmi sonuç düzeltmesi var · ${resolvedCount}/${totalM} geldi`
      : histUpdateMsg === 'updated' ? `Resmi sonuçlar güncellendi · ${resolvedCount}/${totalM} geldi`
      : histUpdateMsg === 'noNew' ? `Yeni resmi sonuç bulunamadı · ${resolvedCount}/${totalM} geldi`
      : `Resmi sonuçlar bekleniyor${resolvedCount ? ` · ${resolvedCount}/${totalM} geldi` : ''}`);

  // Resmi teyit rozeti — sadece güncel + teyit edilmiş bültende.
  const verifiedNow = viewingCurrent && !data?.pending && data?.verification?.status === 'confirmed';
  const verifiedAt = data?.verification?.verifiedAt ? matchDate(data.verification.verifiedAt) : null;

  const Header = (
    <View style={styles.header}>
      <View style={styles.weekNav}>
        <TouchableOpacity onPress={goPrev} disabled={!canPrev} style={[styles.navBtn, !canPrev && styles.navBtnOff]}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <View style={styles.weekMid}>
          {roundYear ? <Text style={styles.weekYear}>{roundYear}</Text> : null}
          <Text style={styles.title}>Spor Toto · {roundName}</Text>
          <Text style={styles.muted}>{subtitle}</Text>
          {verifiedNow && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedTxt}>
                ✓ Resmi bülten teyit edildi{verifiedAt ? ` · ${verifiedAt.day} ${verifiedAt.time}` : ''}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={goNext} disabled={!canNext} style={[styles.navBtn, !canNext && styles.navBtnOff]}>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>
      {!viewingCurrent && (
        <TouchableOpacity onPress={goCurrent} style={styles.currentBtn}>
          <Text style={styles.currentBtnTxt}>Güncel Bültene Dön</Text>
        </TouchableOpacity>
      )}
      {/* Kupon giriş noktaları */}
      <View style={styles.couponRow}>
        {viewingCurrent && !data?.pending && data?.verification?.status === 'confirmed' ? (
          <TouchableOpacity onPress={() => navigation.navigate('CouponBuilder', { roundId: data.roundId })} style={styles.couponBtnMain}>
            <Text style={styles.couponBtnMainTxt}>🎟️ Kupon Oluştur</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={() => navigation.navigate('Coupons')} style={styles.couponBtn}>
          <Text style={styles.couponBtnTxt}>Kuponlarım</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={() => navigation.navigate('BulletinHistory')} style={styles.historyLink}>
        <Text style={styles.historyLinkTxt}>📜 Bülten Geçmişi · Kilitli Analiz ›</Text>
      </TouchableOpacity>
      {viewingCurrent && !data?.pending && data?.coverage?.uncoveredCount > 0 ? (
        <View style={styles.coverBanner}>
          <Text style={styles.coverBannerTxt}>
            ⚠ {data.coverage.uncoveredCount}/{data.coverage.total} maçta analiz verisi yok — aşağıda ⚠ ile işaretli.
          </Text>
        </View>
      ) : null}
    </View>
  );


  // ——— Geçmiş bülten satırı — RESMİ sonuç odaklı. Resmi sonuç yoksa ASLA "-"
  // yazmaz; "Resmi sonuç bekleniyor 🔄" + yenile gösterir. (Geçmiş bültende
  // canlı/geçici skor tutulmaz; canlı takip ayrı "Canlı Bülten" ekranında.)
  const renderHistoryItem = ({ item }) => {
    const resolved = officialResolved(item);
    const corr = corrections.find((c) => c.no === item.no);
    const prov = !resolved ? item.provisional : null;
    const notStarted = pastStatus(item) === 'notStarted';
    const d = item.date ? matchDate(item.date) : null;
    const sysSym = item.prediction && item.prediction.symbol && item.prediction.symbol !== '-' ? item.prediction.symbol : null;
    let sysMark = 'none';
    if (sysSym) sysMark = resolved ? (pickHits(sysSym, item.result) ? 'correct' : 'wrong') : 'pending';
    const rec = (r, align) => (r ? <RecordBadges wins={r.w} draws={r.d} losses={r.l} played={r.p} align={align} /> : null);
    return (
      <View style={[styles.mCard, corr && styles.mCardCorr]}>
        <View style={styles.mRow}>
          <Text style={styles.mNo}>{item.no}</Text>

          <View style={styles.mTeam}>
            <View style={styles.mTeamLine}>
              <TeamLogo logo={item.home.logo} name={item.home.name} />
              <Text style={styles.mName} numberOfLines={1}>{item.home.name}</Text>
            </View>
            {rec(item.home.record)}
          </View>

          <View style={styles.mCenter}>
            {resolved || prov ? (() => {
              // Renk kodu: yeşil=resmi sonuç · sarı=henüz resmi değil · kırmızı=canlı
              const sc = resolved ? item.score : prov.score;
              const col = resolved ? colors.success : (prov.live ? colors.accent : colors.warning);
              const res = resolved ? item.result : (sc.home > sc.away ? '1' : sc.home < sc.away ? '2' : 'X');
              return (
                <>
                  <Text style={[styles.mScore, { color: col }]}>{sc.home} - {sc.away}</Text>
                  <Text style={[styles.mRes, { color: col }]}>{res}</Text>
                </>
              );
            })() : (
              <>
                <Text style={styles.mTime}>{d ? d.time : '—'}</Text>
                <Text style={styles.mDay} numberOfLines={1}>{d ? d.day : ''}</Text>
              </>
            )}
          </View>

          <View style={[styles.mTeam, styles.mTeamR]}>
            <View style={[styles.mTeamLine, styles.mTeamLineR]}>
              <Text style={[styles.mName, styles.mNameR]} numberOfLines={1}>{item.away.name}</Text>
              <TeamLogo logo={item.away.logo} name={item.away.name} />
            </View>
            {rec(item.away.record, 'right')}
          </View>
        </View>

        <View style={styles.mDivider} />

        <View style={styles.mFoot}>
          <View style={styles.mFootLeft}>
            {resolved ? (
              <Text style={styles.mOfficial}>MS · Resmi Sonuç</Text>
            ) : notStarted ? (
              <Text style={styles.mWaitMuted}>Başlamadı</Text>
            ) : (
              <Text style={styles.mWait}>Resmi sonuç bekliyor</Text>
            )}
            <Text style={styles.mPicks} numberOfLines={1}>
              <Text style={styles.mPickLabel}>Sen </Text><Text style={styles.mPickVal}>Kupon yok</Text>
              <Text style={styles.mPickDot}>    ·    </Text>
              <Text style={styles.mPickLabel}>Sistem </Text><Text style={styles.mPickValStrong}>{sysSym || '—'}</Text>{sysMark !== 'none' ? <Text> {MARK[sysMark]}</Text> : null}
            </Text>
          </View>

          {corr ? (
            <TouchableOpacity onPress={() => setRefreshSheet({ correction: corr })} style={styles.corrBadge}><Text style={styles.corrTxt}>Düzeltme</Text></TouchableOpacity>
          ) : (!resolved && !notStarted) ? (
            <TouchableOpacity onPress={() => setRefreshSheet({ no: item.no })} style={styles.mRefresh}><Text style={styles.mRefreshTxt}>↻ Yenile</Text></TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  // İkramiye & bilen kişi — YALNIZ en altta. 15/15 gelmeden gösterilmez.
  const PrizeSection = (
    <View style={styles.prizeBox}>
      <Text style={styles.prizeTitle}>İkramiye & Bilen Kişiler</Text>
      {!fullyResolved ? (
        <Text style={styles.prizeEmpty}>
          {resolvedCount === 0
            ? 'Resmi sonuçlar bekleniyor. Tüm maçlar tamamlanınca ikramiye burada görünecek.'
            : `Şu ana kadar ${resolvedCount}/${totalM} resmi sonuç geldi. Tüm sonuçlar tamamlanınca ikramiye görünecek.`}
        </Text>
      ) : !hasPrize ? (
        <Text style={styles.prizeEmpty}>15/15 resmi sonuç geldi.{'\n'}12/13/14/15 bilen kişi ve ikramiye bilgileri bekleniyor.</Text>
      ) : (
        <>
          <View style={styles.prizeViewRow}>
            {[{ k: 'list', l: 'Liste' }, { k: 'table', l: 'Tablo' }, { k: 'card', l: 'Kart' }].map((v) => (
              <TouchableOpacity key={v.k} onPress={() => { setPrizeView(v.k); setPref('prizeView', v.k); }} style={[styles.pvChip, prizeView === v.k && styles.pvChipOn]}>
                <Text style={[styles.pvTxt, prizeView === v.k && styles.pvTxtOn]}>{v.l}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {prizeView === 'table' ? (
            <>
              <View style={[styles.prizeRow, styles.prizeHead]}>
                <Text style={[styles.prizeHit, styles.prizeHeadTxt]}>Derece</Text>
                <Text style={[styles.prizeCount, styles.prizeHeadTxt]}>Kişi</Text>
                <Text style={[styles.prizeAmt, styles.prizeHeadTxt]}>İkramiye</Text>
              </View>
              {hist.prize.tiers.map((t) => (
                <View key={t.hit} style={styles.prizeRow}>
                  <Text style={styles.prizeHit}>{t.hit}</Text>
                  <Text style={styles.prizeCount}>{fmtCount(t.count)}</Text>
                  <Text style={[styles.prizeAmt, t.count === 0 && styles.prizeRoll]}>{t.count === 0 ? 'Devretti' : fmtTL(t.prize)}</Text>
                </View>
              ))}
            </>
          ) : prizeView === 'card' ? (
            <View style={styles.prizeCards}>
              {hist.prize.tiers.map((t) => (
                <View key={t.hit} style={styles.prizeCard}>
                  <Text style={styles.pcHit}>{t.hit} Bilen</Text>
                  <Text style={styles.pcCount}>{fmtCount(t.count)} kişi</Text>
                  <Text style={[styles.pcAmt, t.count === 0 && styles.prizeRoll]}>{t.count === 0 ? 'Devretti' : fmtTL(t.prize)}</Text>
                </View>
              ))}
            </View>
          ) : (
            hist.prize.tiers.map((t) => (
              <View key={t.hit} style={styles.prizeRow}>
                <Text style={styles.prizeHit}>{t.hit} Bilen</Text>
                <Text style={styles.prizeCount}>{fmtCount(t.count)} kişi</Text>
                <Text style={[styles.prizeAmt, t.count === 0 && styles.prizeRoll]}>{t.count === 0 ? 'Devretti' : fmtTL(t.prize)}</Text>
              </View>
            ))
          )}
          {hist.prize.description ? <Text style={styles.prizeDesc}>{hist.prize.description}</Text> : null}
        </>
      )}
    </View>
  );

  // ——— Gövde ———
  let body;
  if (viewingCurrent) {
    if (error) {
      body = (
        <Center>
          <Text style={styles.errEmoji}>⚠️</Text>
          <Text style={styles.errText}>Güncel başlamamış Spor Toto programı alınamadı.</Text>
          <Text style={styles.muted}>{error}</Text>
          <TouchableOpacity style={styles.retry} onPress={load}><Text style={styles.retryText}>Tekrar Dene</Text></TouchableOpacity>
        </Center>
      );
    } else if (!data.matches || data.matches.length === 0) {
      body = (
        <Center>
          <Text style={styles.errEmoji}>🕐</Text>
          <Text style={styles.errText}>
            {data?.title || (data?.pending ? 'Henüz açıklanmadı' : 'Bülten henüz açıklanmadı')}
          </Text>
          <Text style={[styles.muted, { textAlign: 'center', marginTop: 6 }]}>
            {data?.pending
              ? `${data?.reason || 'Güncel resmi bülten bekleniyor.'}\nYalnızca resmi Spor Toto listesinde teyit edilen (tam 15 maçlık) bülten gösterilir.\nGeçmiş haftaların sonuçları için ‹ oka bas.`
              : 'Yeni hafta resmi Spor Toto listesinde genellikle Pazar günü yayınlanır.\nGeçmiş haftaların sonuçları için ‹ oka bas.'}
          </Text>
        </Center>
      );
    } else {
      // Güncel bülten artık CANLI yapısıyla (üst özet + filtre + sıralama + sade kartlar).
      // DERECELİ kupon seçimleri (no -> sembol, ör. '10') — kart altındaki "Sen"i besler.
      // isFocused değişince yeniden okunur → dereceliyi değiştirip dönünce güncellenir.
      const rankedPicks = {};
      if (data?.roundId != null) {
        const rc = getRankedCoupon(data.roundId);
        const rv = rc ? finalVersion(rc) : null;
        if (rv) for (const sc of rv.selections) if (sc.selectedOutcomes?.length) rankedPicks[sc.no] = sc.selectedOutcomes.map(toOfficial).join('');
      }
      body = (
        <LiveBulletinView
          matches={data.matches}
          userPicks={rankedPicks}
          hasCoupon={Object.keys(rankedPicks).length > 0}
          subtitle={subtitle}
          onCardPress={(no) => {
            const m = data.matches.find((x) => x.no === no);
            const started = !!(m && (m.started || m.live || m.finalized || (m.date && new Date(m.date).getTime() <= Date.now())));
            navigation.navigate(started ? 'LiveMatchDetail' : 'MatchDetail', { no });
          }}
          onRefresh={load}
        />
      );
    }
  } else if (histLoading) {
    body = <Center><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.muted}>Geçmiş bülten yükleniyor…</Text></Center>;
  } else if (histError) {
    body = (
      <Center>
        <Text style={styles.errEmoji}>⚠️</Text>
        <Text style={styles.errText}>Geçmiş bülten bilgisi alınamadı.</Text>
        <Text style={styles.muted}>{histError}</Text>
      </Center>
    );
  } else if (hist) {
    // Güncel bültenle BİREBİR AYNI özet + filtreler.
    const HIST_SUMMARY = [
      { key: 'live', label: 'Canlı', n: histCounts.live, color: colors.accent },
      { key: 'notStarted', label: 'Başlamadı', n: histCounts.notStarted, color: colors.muted },
      { key: 'finished', label: 'Biten', n: histCounts.finished, color: colors.success },
      { key: 'couponRisk', label: 'Kupon Riskte', n: histCounts.couponRisk, color: colors.warning },
      { key: 'systemRisk', label: 'Sistem Riskte', n: histCounts.systemRisk, color: colors.red },
    ];
    const HIST_FILTERS = [
      { key: 'all', label: 'Tümü' },
      { key: 'live', label: 'Canlı' },
      { key: 'risk', label: 'Riskte' },
      { key: 'coupon', label: 'Kuponum' },
      { key: 'done', label: 'Biten' },
    ];
    const pickHistFilter = (key) => {
      if (key === 'coupon') { showToast('Henüz kupon oluşturmadın.'); return; }
      setHistBoost(false);
      if (key === 'risk') setHistRiskSubs({ coupon: true, system: true });
      setHistFilter(key);
    };
    const onHistSummary = (key) => {
      if (key === 'live') pickHistFilter('live');
      else if (key === 'finished') pickHistFilter('done');
      else if (key === 'notStarted') { setHistBoost(true); setHistFilter('all'); }
      else if (key === 'couponRisk') { setHistBoost(false); setHistRiskSubs({ coupon: true, system: false }); setHistFilter('risk'); }
      else if (key === 'systemRisk') { setHistBoost(false); setHistRiskSubs({ coupon: false, system: true }); setHistFilter('risk'); }
    };
    const HistHeader = (
      <View>
        <ScoreLegend />
        {/* Üst özet kutuları — yatay kaydırmalı (Bülten ile aynı) */}
        <View style={styles.hSummaryWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hSummaryRow}>
            {HIST_SUMMARY.map((b) => (
              <TouchableOpacity key={b.key} style={styles.hSumBox} activeOpacity={0.8} onPress={() => onHistSummary(b.key)}>
                <Text style={[styles.hSumN, { color: b.color }]}>{b.n}</Text>
                <Text style={styles.hSumLabel} numberOfLines={1}>{b.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Filtreler */}
        <View style={styles.hFilterRow}>
          {HIST_FILTERS.map((f) => {
            const on = histFilter === f.key && !(histBoost && f.key === 'all');
            return (
              <TouchableOpacity key={f.key} style={[styles.chip, on && styles.chipOn]} onPress={() => pickHistFilter(f.key)}>
                <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Riskte alt filtreleri */}
        {histFilter === 'risk' && (
          <View style={styles.hSubRow}>
            {[{ k: 'coupon', l: 'Kupon Riskte' }, { k: 'system', l: 'Sistem Riskte' }].map((sf) => (
              <TouchableOpacity key={sf.k} style={[styles.subChip, histRiskSubs[sf.k] && styles.subChipOn]}
                onPress={() => setHistRiskSubs((r) => ({ ...r, [sf.k]: !r[sf.k] }))}>
                <Text style={[styles.subTxt, histRiskSubs[sf.k] && styles.subTxtOn]}>{histRiskSubs[sf.k] ? '✓ ' : ''}{sf.l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {histChecking && (
          <View style={styles.checkBar}><ActivityIndicator size="small" color={colors.primary} /><Text style={styles.checkTxt}>Resmi sonuçlar kontrol ediliyor…</Text></View>
        )}
        {corrections.length > 0 && (
          <View style={styles.corrWarn}>
            <Text style={styles.corrWarnTitle}>Resmi sonuç düzeltmesi var</Text>
            <Text style={styles.corrWarnBody}>{corrections.length} maçta resmi sonuç güncellendi.</Text>
          </View>
        )}
      </View>
    );
    body = (
      <FlatList
        data={histSorted}
        keyExtractor={(m) => String(m.no)}
        renderItem={renderHistoryItem}
        contentContainerStyle={styles.listPad}
        ListHeaderComponent={HistHeader}
        ListFooterComponent={PrizeSection}
        ListEmptyComponent={<Text style={styles.hEmpty}>Bu filtrede maç yok.</Text>}
        refreshControl={<RefreshControl refreshing={histChecking} onRefresh={() => checkOfficial(effectiveId)} tintColor={colors.primary} />}
      />
    );
  }

  return (
    <BultenBackdrop>
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      {Header}
      {body}

      {/* Yenile seçenek kutusu / düzeltme detayı */}
      {refreshSheet && (
        <View style={styles.sheetWrap}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setRefreshSheet(null)} />
          <View style={styles.sheet}>
            {refreshSheet.correction ? (() => {
              const c = refreshSheet.correction;
              return (
                <>
                  <Text style={styles.sheetTitle}>Düzeltme Detayı</Text>
                  <Text style={styles.sheetSub}>#{c.no} {c.home} - {c.away}</Text>
                  <Text style={styles.sheetLine}>Eski sonuç: <Text style={styles.sheetOld}>{c.oldScore.home} - {c.oldScore.away} · {c.oldResult}</Text></Text>
                  <Text style={styles.sheetLine}>Yeni resmi sonuç: <Text style={styles.sheetNew}>{c.newScore.home} - {c.newScore.away} · {c.newResult}</Text></Text>
                  <Text style={styles.sheetNote}>Kupon ve sistem sonucu yeniden hesaplandı (resmi sonuç esas alınır).</Text>
                  <TouchableOpacity style={styles.sheetBtn} onPress={() => setRefreshSheet(null)}><Text style={styles.sheetBtnTxt}>Kapat</Text></TouchableOpacity>
                </>
              );
            })() : (
              <>
                <Text style={styles.sheetTitle}>Resmi sonucu yenile</Text>
                <TouchableOpacity style={styles.sheetBtn} onPress={() => { checkOfficial(effectiveId, refreshSheet.no); setRefreshSheet(null); }}>
                  <Text style={styles.sheetBtnTxt}>Bu maçı yenile (#{refreshSheet.no})</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.sheetBtn, styles.sheetBtnAlt]} onPress={() => { checkOfficial(effectiveId); setRefreshSheet(null); }}>
                  <Text style={styles.sheetBtnTxt}>Tümünü yenile (15 maç)</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setRefreshSheet(null)}><Text style={styles.sheetCancel}>Vazgeç</Text></TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}

      {toast && <View style={styles.toast}><Text style={styles.toastTxt}>{toast}</Text></View>}
    </View>
    </BultenBackdrop>
  );
}

function Center({ children }) {
  return <View style={styles.center}>{children}</View>;
}

// Resmi 1 / X / 2 sonucu (sadece resmi veriden). 1=ev, X=beraberlik, 2=deplasman.
function ResultBadge({ symbol }) {
  if (!symbol) return <View style={styles.resEmpty}><Text style={styles.resEmptyTxt}>–</Text></View>;
  const c = symbol === '1' ? colors.primary : symbol === '2' ? colors.yellow : colors.gray;
  return <View style={[styles.resBadge, { backgroundColor: c }]}><Text style={styles.resTxt}>{symbol}</Text></View>;
}

// Takım logosu — gerçek kulüp arması (FootyStats CDN). Logo yoksa/alınamazsa nötr ⚽.
function TeamLogo({ logo, name }) {
  const [err, setErr] = useState(false);
  if (logo && !err) {
    return <Image source={{ uri: logo }} style={styles.logo} resizeMode="contain" onError={() => setErr(true)} accessibilityLabel={name} />;
  }
  return <View style={styles.logoFallback}><Text style={styles.logoBall}>⚽</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24 },
  listPad: { padding: spacing.md, paddingBottom: spacing.xl },

  // Başlık + hafta seçici
  header: { paddingVertical: spacing.md, paddingHorizontal: spacing.md, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  weekNav: { flexDirection: 'row', alignItems: 'center' },
  navBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardAlt },
  navBtnOff: { opacity: 0.3 },
  navArrow: { color: colors.text, fontSize: 24, fontWeight: '900', lineHeight: 26 },
  weekMid: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  weekYear: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  muted: { color: colors.textMuted, fontSize: 12.5, marginTop: 2, textAlign: 'center' },
  verifiedBadge: { marginTop: 5, alignSelf: 'center', paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.sm, backgroundColor: colors.successSoft, borderWidth: 1, borderColor: colors.success },
  verifiedTxt: { color: colors.success, fontSize: 10.5, fontWeight: '800' },
  currentBtn: { marginTop: 10, alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.sm, backgroundColor: colors.primary + '22', borderWidth: 1, borderColor: colors.primary },
  currentBtnTxt: { color: colors.primary, fontSize: 12.5, fontWeight: '800' },
  couponRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  couponBtnMain: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 11, alignItems: 'center' },
  couponBtnMainTxt: { color: '#fff', fontSize: 13, fontWeight: '900' },
  couponBtn: { flex: 1, backgroundColor: colors.cardAlt, borderRadius: radius.md, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  couponBtnTxt: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  historyLink: { marginTop: 10, alignSelf: 'center' },
  historyLinkTxt: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  coverBanner: { marginTop: 10, backgroundColor: colors.warningSoft, borderRadius: radius.md, borderWidth: 1, borderColor: colors.warning, paddingHorizontal: 12, paddingVertical: 8 },
  coverBannerTxt: { color: '#7a4a00', fontSize: 11.5, fontWeight: '800', lineHeight: 15, textAlign: 'center' },

  // Geçmiş sonuç: kontrol/düzeltme başlığı + görünüm modu
  checkBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.infoSoft, borderRadius: radius.sm, padding: 8, marginBottom: spacing.sm },
  checkTxt: { color: colors.info, fontSize: 12, fontWeight: '800' },
  corrWarn: { backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: colors.warning, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  corrWarnTitle: { color: '#7a4a00', fontSize: 13, fontWeight: '900' },
  corrWarnBody: { color: '#7a4a00', fontSize: 12, fontWeight: '700', marginTop: 2 },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  modeLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  modeChip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: radius.sm, backgroundColor: colors.cardAlt },
  modeChipOn: { backgroundColor: colors.primary },
  modeTxt: { color: colors.textSoft, fontSize: 11.5, fontWeight: '800' },
  modeTxtOn: { color: colors.white },

  // Geçmiş: üst özet kutuları + filtre + sıralama (Canlı Bülten yapısı)
  hSummaryWrap: { marginBottom: spacing.sm },
  hSummaryRow: { gap: 8, paddingRight: spacing.md },
  hSumBox: { minWidth: 84, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center' },
  hSumN: { fontSize: 18, fontWeight: '900' },
  hSumLabel: { color: colors.textSoft, fontSize: 10.5, fontWeight: '800', marginTop: 1 },
  hFilterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  hSortRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipTxt: { color: colors.textSoft, fontSize: 12.5, fontWeight: '800' },
  chipTxtOn: { color: colors.white },
  hSubRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.sm },
  subChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  subChipOn: { borderColor: colors.warning, backgroundColor: colors.warningSoft },
  subTxt: { color: colors.textMuted, fontSize: 11.5, fontWeight: '800' },
  subTxtOn: { color: '#7a4a00' },
  hEmpty: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 24 },

  // ——— Modern maç kartı ———
  mCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border, ...shadow.soft },
  mCardCorr: { borderColor: colors.warning },
  mRow: { flexDirection: 'row', alignItems: 'center' },
  mNo: { color: colors.muted, fontSize: 11, fontWeight: '900', width: 16, textAlign: 'center', marginRight: 4 },
  mTeam: { flex: 1, gap: 6, minWidth: 0 },
  mTeamR: { alignItems: 'flex-end' },
  mTeamLine: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'stretch' },
  mTeamLineR: { justifyContent: 'flex-end' },
  mName: { flexShrink: 1, color: colors.text, fontSize: 13.5, fontWeight: '800' },
  mNameR: { textAlign: 'right' },
  mCenter: { minWidth: 64, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 6 },
  mScore: { color: colors.text, fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  mRes: { fontSize: 12, fontWeight: '900', marginTop: 1 },
  mScoreTemp: { color: colors.textSoft, fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  mTime: { color: colors.text, fontSize: 14, fontWeight: '800' },
  mDay: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  tempPill: { backgroundColor: colors.warningSoft, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  tempTxt: { color: '#8a5a00', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.5 },
  mDivider: { height: 1, backgroundColor: colors.border, marginTop: 12, marginBottom: 9 },
  mFoot: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mFootLeft: { flex: 1, gap: 3 },
  mOfficial: { color: colors.success, fontSize: 11, fontWeight: '900', letterSpacing: 0.2 },
  mWait: { color: colors.warning, fontSize: 11, fontWeight: '900', letterSpacing: 0.2 },
  mWaitMuted: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  mPicks: { fontSize: 12, color: colors.text },
  mPickLabel: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  mPickVal: { color: colors.textSoft, fontWeight: '700' },
  mPickValStrong: { color: colors.text, fontWeight: '900' },
  mPickDot: { color: colors.border },
  mRefresh: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border },
  mRefreshTxt: { color: colors.textSoft, fontSize: 11, fontWeight: '800' },

  // Geçmiş maç kartı (eski)
  hCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  hCardCorr: { borderColor: colors.warning },
  hTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hSide: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  hSideR: { justifyContent: 'flex-end' },
  hCenter: { minWidth: 70, alignItems: 'center', gap: 1, paddingHorizontal: 2 },
  centerScore: { color: colors.text, fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  centerProv: { color: colors.textSoft, fontSize: 14, fontWeight: '800', fontStyle: 'italic' },
  centerStatus: { color: colors.textMuted, fontSize: 10.5, fontWeight: '900' },
  centerTime: { color: colors.textMuted, fontSize: 10.5, fontWeight: '700' },
  recRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, gap: 8 },
  recCol: { flex: 1 },
  hTeams: { flex: 1, gap: 3 },
  hTeamRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  hRight: { minWidth: 74, alignItems: 'flex-end', gap: 4, flexDirection: 'row', justifyContent: 'flex-end' },
  hStatusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, gap: 8, flexWrap: 'wrap' },
  official: { flex: 1, color: colors.success, fontSize: 11, fontWeight: '800' },
  waiting: { flex: 1, color: colors.warning, fontSize: 11.5, fontWeight: '800', lineHeight: 16 },
  provScore: { color: colors.textSoft, fontSize: 14, fontWeight: '800', fontStyle: 'italic' },
  provTag: { color: colors.warning, fontSize: 9, fontWeight: '900', letterSpacing: 0.3 },
  provNote: { color: colors.textMuted, fontSize: 10, fontWeight: '600', marginTop: 5, lineHeight: 13 },
  refreshMini: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm, backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border },
  refreshMiniTxt: { color: colors.textSoft, fontSize: 11, fontWeight: '800' },
  corrBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: colors.warning },
  corrTxt: { color: '#7a4a00', fontSize: 10.5, fontWeight: '900' },
  tech: { color: colors.textMuted, fontSize: 10, fontWeight: '600', marginTop: 6, lineHeight: 14 },
  hPicks: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 7 },
  hPickTxt: { color: colors.text, fontSize: 12, fontWeight: '700' },
  hPickLabel: { color: colors.textMuted, fontWeight: '800' },
  hPickSym: { color: colors.text, fontWeight: '900' },
  hSep: { color: colors.border, fontSize: 12 },

  // İkramiye görünüm seçici + tablo/kart
  prizeViewRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  pvChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.sm, backgroundColor: colors.cardAlt },
  pvChipOn: { backgroundColor: colors.primary },
  pvTxt: { color: colors.textSoft, fontSize: 11.5, fontWeight: '800' },
  pvTxtOn: { color: colors.white },
  prizeHead: { borderTopWidth: 0 },
  prizeHeadTxt: { color: colors.textMuted, fontWeight: '900', fontSize: 11 },
  prizeCards: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  prizeCard: { width: '48%', backgroundColor: colors.surfaceSoft, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 10 },
  pcHit: { color: colors.text, fontSize: 13, fontWeight: '900' },
  pcCount: { color: colors.textMuted, fontSize: 11.5, fontWeight: '700', marginTop: 2 },
  pcAmt: { color: colors.green, fontSize: 13, fontWeight: '800', marginTop: 2 },

  // Yenile/düzeltme kutusu (bottom sheet) + toast
  sheetWrap: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: spacing.lg, gap: 10 },
  sheetTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  sheetSub: { color: colors.textMuted, fontSize: 12.5, fontWeight: '700' },
  sheetLine: { color: colors.text, fontSize: 13, fontWeight: '700' },
  sheetOld: { color: colors.textMuted, fontWeight: '900' },
  sheetNew: { color: colors.success, fontWeight: '900' },
  sheetNote: { color: colors.textMuted, fontSize: 11.5, fontWeight: '600', marginTop: 2 },
  sheetBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  sheetBtnAlt: { backgroundColor: colors.accent },
  sheetBtnTxt: { color: colors.white, fontSize: 13.5, fontWeight: '800' },
  sheetCancel: { color: colors.textMuted, fontSize: 12.5, fontWeight: '800', textAlign: 'center', paddingVertical: 6 },
  toast: { position: 'absolute', bottom: 28, alignSelf: 'center', backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill },
  toastTxt: { color: colors.white, fontSize: 12.5, fontWeight: '800' },

  // Maç kartı (ortak)
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  cardStarted: { opacity: 0.5 },
  startedMini: { color: colors.gray, fontSize: 9, fontWeight: '900', letterSpacing: 0.3, marginTop: 2 },
  no: { color: colors.textMuted, fontSize: 14, fontWeight: '800', width: 18, textAlign: 'center' },
  dateBox: { width: 46, alignItems: 'center' },
  dateDay: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  dateTime: { color: colors.text, fontSize: 12, fontWeight: '800', marginTop: 1 },
  homeSide: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  awaySide: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 7 },
  teamName: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
  teamNameR: { textAlign: 'right' },
  vs: { color: colors.text, fontSize: 13, fontWeight: '900', letterSpacing: 1, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.cardAlt, borderRadius: 6 },
  logo: { width: 22, height: 22, borderRadius: 4 },
  logoFallback: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  logoBall: { fontSize: 13 },

  // Geçmiş: skor + resmi sonuç
  scoreBox: { minWidth: 50, alignItems: 'center', paddingHorizontal: 4, paddingVertical: 3, backgroundColor: colors.cardAlt, borderRadius: 6 },
  scoreTxt: { color: colors.text, fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  resBadge: { width: 26, height: 26, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  resTxt: { color: '#fff', fontSize: 14, fontWeight: '900' },
  resEmpty: { width: 26, height: 26, borderRadius: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardAlt },
  resEmptyTxt: { color: colors.textMuted, fontSize: 13, fontWeight: '800' },

  // İkramiye / Açıklanan Sonuçlar
  prizeBox: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  prizeTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginBottom: 10 },
  prizeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderTopWidth: 1, borderTopColor: colors.border },
  prizeHit: { width: 78, color: colors.text, fontSize: 13, fontWeight: '800' },
  prizeCount: { flex: 1, color: colors.textMuted, fontSize: 12.5, fontWeight: '600' },
  prizeAmt: { color: colors.green, fontSize: 13, fontWeight: '800' },
  prizeRoll: { color: colors.textMuted, fontStyle: 'italic', fontWeight: '700' },
  prizeDesc: { color: colors.textMuted, fontSize: 12, marginTop: 10, fontStyle: 'italic' },
  prizeEmpty: { color: colors.textMuted, fontSize: 13, paddingVertical: 6 },

  // Hata ekranı
  errEmoji: { fontSize: 40 },
  errText: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 6, textAlign: 'center' },
  retry: { marginTop: 18, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: colors.bg, fontWeight: '800' },
});
