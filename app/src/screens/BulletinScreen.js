import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Image, Platform } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { api } from '../api';
import { colors, spacing, radius, shadow } from '../theme';
import { matchDate } from '../utils';
import { getPref, setPref } from '../prefs';
import { pickHits } from '../liveLogic';
import { getRankedCoupon, finalVersion } from '../coupon/store';
import { toOfficial } from '../couponConfig';
import { RecordBadges, SurpriseBadge, FormStrip } from '../components';
import { LEGAL_FOOTER } from '../brand';
import { crestUrlOf } from '../crestUrl';
import { API_BASE } from '../config';
import ScoreLegend from '../components/ScoreLegend';
import SnapshotSealBanner from '../components/SnapshotSealBanner';
import LiveBulletinView from '../components/LiveBulletinView';
// Hareketli arka plan (BultenBackdrop) kullanıcı isteğiyle KALDIRILDI
// (2026-08-04): zeminde yalnız takım logosu filigranı kalır.
import { View as DuzZemin } from 'react-native';
import BultenEmptyState from '../components/BultenEmptyState';
import UlkeEtiketi from '../components/UlkeEtiketi';
import TakimLogoZemin from '../components/TakimLogoZemin';

// Maç profili etiketleri — backend'deki kriterKirilim.js ile AYNI adlar.
// İki ekran aynı maça farklı isim vermesin diye anahtarlar birebir kopyalandı.
const MAC_TIPI_ADI = {
  agirFavori: 'Ağır favori', favori: 'Favori var', denk: 'Denk', acik: 'Açık / zor',
};
const KALABALIK_ADI = {
  cokEmin: 'Kalabalık çok emin', kararli: 'Kalabalık kararlı',
  bolunmus: 'Kalabalık bölünmüş', dagimik: 'Kalabalık dağınık',
};

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
// "2026" → "2025/2026 Sezonu" (resmî listedeki yazım).
const sezonAdi = (y) => (Number.isFinite(Number(y)) ? `${Number(y) - 1}/${Number(y)} Sezonu` : String(y || ''));
// RESMÎ yazım: tutar SONDA ₺ ile — "4.035.942,42 ₺" (uygulamanın ₺30.578,23
// biçimi diğer görünümlerde korunur).
const fmtTLResmi = (n) => {
  if (n == null) return '–';
  const [int, dec] = Number(n).toFixed(2).split('.');
  return `${group(int)},${dec} ₺`;
};
// "24 Temmuz Cuma 2026 19:55" — resmî listedeki kapanış biçimi.
// BOŞ DEĞER TUZAĞI: new Date(null) 1970 döndürür, o yüzden önce boşluk elenir.
const AYLAR_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const GUNLER_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const kapanisResmi = (iso) => {
  if (iso == null || iso === '') return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const iki = (n) => String(n).padStart(2, '0');
  return `${iki(d.getDate())} ${AYLAR_TR[d.getMonth()]} ${GUNLER_TR[d.getDay()]} `
    + `${d.getFullYear()} ${iki(d.getHours())}:${iki(d.getMinutes())}`;
};

export default function BulletinScreen({ navigation }) {
  const [data, setData] = useState(null);          // güncel analizli bülten
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [rounds, setRounds] = useState(null);       // { currentRoundId, rounds:[{id,name,year,...}] }
  const [selectedId, setSelectedId] = useState(null); // görüntülenen hafta (null = güncel)
  const [hist, setHist] = useState(null);           // geçmiş hafta verisi { roundId, matches, prize }
  // MAÇ PROFİLİ (2026-08-07): mühürlü oran + oynanma yüzdesi + maç tipi ve
  // kalabalık profili etiketleri. Kullanıcı bunları kriter kırılımında görüp
  // "bunu bülten geçmişinde de istiyorum" dedi. AYRI istek: geçmiş bülten
  // yanıtı bu veriyi taşımıyor ve taşıması da doğru değil (biri resmî sonuç
  // kaynağı, diğeri arşiv). Profil gelmezse kart eskisi gibi çalışır.
  const [profil, setProfil] = useState(null);       // { roundId, maclar: [...] }
  const [histLoading, setHistLoading] = useState(false);
  const [histError, setHistError] = useState(null);
  const [histChecking, setHistChecking] = useState(false);      // "Resmi sonuçlar kontrol ediliyor"
  const [histUpdateMsg, setHistUpdateMsg] = useState(null);      // null | 'updated' | 'noNew'
  const [corrections, setCorrections] = useState([]);           // oturum-içi resmi sonuç DÜZELTMELERİ
  const [prizeView, setPrizeView] = useState(getPref('prizeView'));       // list|table|card
  // Geçmiş hafta üst sayaç kutuları + filtre çipleri KALDIRILDI (kullanıcı isteği);
  // liste bülten sırasında (veya kayıtlı sıralama tercihinde) akar.
  const [histSort, setHistSort] = useState(getPref('histSort'));          // bulletin|resolvedTop|waitingBottom
  const [sezonAcik, setSezonAcik] = useState(false);
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
  //
  // ÇÖKME DÜZELTMESİ: burada eskiden setHistFilter('all') ve setHistBoost(false)
  // da çağrılıyordu. O iki durum (geçmiş bülten filtresi/vurgusu) ekrandan
  // kaldırılmış ama ÇAĞRILARI kalmıştı; tanımsız işlev olduğu için bu etki her
  // çalıştığında ReferenceError atıyor ve Bülten sekmesi beyaz ekrana düşüyordu.
  // Ekranın ilk mount'unda effectiveId null olduğu için hata KESİNLİKLE oluşuyordu.
  useEffect(() => {
    if (viewingCurrent || effectiveId == null) { setHist(null); setHistError(null); setHistUpdateMsg(null); setCorrections([]); return; }
    if (hist && hist.roundId === effectiveId) return;
    let alive = true;
    setHistLoading(true); setHistError(null); setHistUpdateMsg(null); setCorrections([]);
    api.history(effectiveId)
      .then((h) => { if (alive) { setHist({ ...h, roundId: effectiveId }); checkOfficial(effectiveId); } })
      .catch((e) => { if (alive) setHistError(e.message); })
      .finally(() => { if (alive) setHistLoading(false); });
    // Profil AYRI ve İSTEĞE BAĞLI: hata verirse bülten yine görünür, yalnız
    // rozetler çizilmez. Sessizce yutulmuyor — durum profil=null olur ve
    // kart "bu hafta için oran/oynanma kaydı yok" yazar.
    setProfil(null);
    api.historyProfil(effectiveId)
      .then((p) => { if (alive) setProfil({ ...p, roundId: effectiveId }); })
      .catch(() => { if (alive) setProfil({ roundId: effectiveId, maclar: [], hata: true }); });
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
  const currentMatches = Array.isArray(data?.matches) ? data.matches : [];
  const upcomingCount = currentMatches.filter((m) => !isStarted(m)).length;
  // GEÇMİŞ SONUÇ DURUMU — "Sonuçlar açıklandı" YALNIZ 15/15 resmi skor + 1/X/2
  // + ikramiye gelince. Aksi halde dereceli durum (n/15).
  const histMatches = hist?.matches || [];
  const totalM = histMatches.length;
  const resolvedCount = histMatches.filter(officialResolved).length;
  const hasPrize = !!hist?.prize;
  const fullyResolved = totalM > 0 && resolvedCount === totalM;   // 15/15 resmi sonuç
  const allAnnounced = fullyResolved && hasPrize;                 // + ikramiye

  // Geçmiş bülten sıralaması (filtre yok — 15 maç olduğu gibi listelenir).
  const histSorted = (() => {
    const byNo = (a, b) => a.no - b.no;
    const arr = [...histMatches];
    if (histSort === 'resolvedTop') { const w = (m) => (histCategory(m) === 'official' ? 0 : histCategory(m) === 'provisional' ? 1 : 2); arr.sort((a, b) => w(a) - w(b) || byNo(a, b)); }
    else if (histSort === 'waitingBottom') { const w = (m) => (histCategory(m) === 'waiting' ? 1 : 0); arr.sort((a, b) => w(a) - w(b) || byNo(a, b)); }
    else arr.sort(byNo);
    return arr;
  })();

  const roundName = selMeta?.name || data?.round || '—';
  const roundYear = selMeta?.year || '';
  // Sezon listesi navRounds'tan: yayımlanmamış gelecek haftalar girmez.
  // Yeniden eskiye — kullanıcı önce güncel sezonu arar.
  const sezonlar = [...new Set(navRounds.map((r) => r.year).filter((y) => y != null))].sort((a, b) => b - a);
  const subtitle = viewingCurrent
    ? (error ? 'güncel bülten alınamadı'
      : data?.pending ? 'güncel resmi bülten bekleniyor'
      : upcomingCount > 0
        ? `${upcomingCount}/${data?.matchCount ?? currentMatches.length} maç başlamadı · analiz hazır${data?.usingExampleKey ? ' · (örnek anahtar)' : ''}`
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
        <TouchableOpacity onPress={goPrev} disabled={!canPrev} accessibilityRole="button" accessibilityLabel="Önceki hafta" style={[styles.navBtn, !canPrev && styles.navBtnOff]}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <View style={styles.weekMid}>
          {/* SEZON SEÇİMİ — resmî listedeki gibi açılır liste. Eskiden burası
              düz yazıydı; ‹ › okları tek adım ilerlediği için eski sezona
              gitmek onlarca dokunuş demekti. Sezon seçilince o sezonun EN
              YENİ haftasına gidilir. Tek sezon varsa liste açılmaz. */}
          {roundYear ? (
            sezonlar.length > 1 ? (
              // FİLTRE DÜĞMESİ — çerçeveli, etiketli, dokunulabilir olduğu
              // belli. Önce 11 punto soluk düz yazıydı ve seçilebilir olduğu
              // ANLAŞILMIYORDU; "Sezon" etiketi de ne olduğunu söylüyor.
              <TouchableOpacity
                onPress={() => setSezonAcik((v) => !v)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`Sezon seç, şu an ${sezonAdi(roundYear)}`}
                style={[styles.sezonChip, sezonAcik && styles.sezonChipAcik]}
              >
                <Text style={styles.sezonChipEtiket}>SEZON</Text>
                <Text style={styles.sezonChipTxt}>{sezonAdi(roundYear)}</Text>
                <Text style={styles.sezonChipOk}>{sezonAcik ? '▲' : '▼'}</Text>
              </TouchableOpacity>
            ) : (
              // Tek sezon varsa seçecek bir şey yok: düğme gibi göstermek
              // dokunup hiçbir şey olmamasına yol açar.
              <Text style={styles.weekYear}>{sezonAdi(roundYear)}</Text>
            )
          ) : null}
          {sezonAcik ? (
            <View style={styles.sezonListe}>
              {sezonlar.map((y) => {
                const secili = y === roundYear;
                return (
                  <TouchableOpacity
                    key={String(y)}
                    style={[styles.sezonOge, secili && styles.sezonOgeSecili]}
                    onPress={() => {
                      // O sezonun EN YENİ haftası (navRounds zaten güncelle sınırlı).
                      const enYeni = [...navRounds].reverse().find((r) => r.year === y);
                      if (enYeni) setSelectedId(enYeni.id);
                      setSezonAcik(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.sezonOgeTxt, secili && styles.sezonOgeTxtSecili]}>{sezonAdi(y)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
          <Text style={styles.title}>Haftalık Bülten · {roundName}</Text>
          <Text style={styles.muted}>{subtitle}</Text>
          {verifiedNow && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedTxt} numberOfLines={1}>
                ✓ Resmi bülten teyit edildi{verifiedAt ? ` · ${verifiedAt.day} ${verifiedAt.time}` : ''}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={goNext} disabled={!canNext} accessibilityRole="button" accessibilityLabel="Sonraki hafta" style={[styles.navBtn, !canNext && styles.navBtnOff]}>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>
      {!viewingCurrent && (
        <TouchableOpacity onPress={goCurrent} style={styles.currentBtn}>
          <Text style={styles.currentBtnTxt}>Güncel Bültene Dön</Text>
        </TouchableOpacity>
      )}
      {/* Kupon Oluştur / Kuponlarım buton çifti KALDIRILDI (kullanıcı kararı,
          2026-08-06): alt sekme çubuğu Kuponlarım'a zaten götürüyor, kupon
          oluşturma da Kupon Merkezi'nden yapılıyor — üstte yer kaplıyordu. */}
      <TouchableOpacity onPress={() => navigation.navigate('BulletinHistory')} style={styles.historyLink}>
        <Text style={styles.historyLinkTxt}>📜 Bülten Geçmişi · Kilitli Analiz ›</Text>
      </TouchableOpacity>
      {/* MÜHÜR DURUMU — kilit geri sayımı / "Mühürlü Analiz" + doğrulama hash'i.
          Veri kalıcı arşivden (data.archive); arşiv yoksa şerit çizilmez. */}
      {viewingCurrent && !data?.pending ? <SnapshotSealBanner archive={data?.archive} /> : null}
      {/* Bülten zorluk satırı da KALDIRILDI (kullanıcı isteği, 2026-08-06).
          Aynı özet ana sayfadaki hafta kartında zaten duruyor; bültende
          ekranın üstünü işgal ediyordu. Backend'in difficulty verisi yerinde. */}
      {/* ÜST KAPSAM UYARISI KALDIRILDI (kullanıcı isteği, 2026-08-06): mobilde
          yer kaplıyordu. Bilgi KAYBOLMUYOR — verisi olmayan maç kendi kartında
          "VERİ YOK" rozeti ve "Maç verisi eşleştirilemedi" satırıyla zaten
          açıkça görünüyor (dürüstlük kuralı korunur). */}
      <Text style={styles.legalTxt}>{LEGAL_FOOTER}</Text>
    </View>
  );


  // ——— Geçmiş bülten satırı — RESMİ sonuç odaklı. Resmi sonuç yoksa ASLA "-"
  // yazmaz; "Resmi sonuç bekleniyor 🔄" + yenile gösterir. (Geçmiş bültende
  // canlı/geçici skor tutulmaz; canlı takip ayrı "Canlı Bülten" ekranında.)
  // Sıra numarasına göre profil satırını bulur. Profil gelmediyse null döner
  // ve kart eskisi gibi çizilir (özellik isteğe bağlı, kartı kırmaz).
  const prof = (no) => (profil?.maclar || []).find((x) => Number(x.no) === Number(no)) || null;

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
      // TIKLANABİLİR (2026-08-07). Geçmiş bültende kart düz bir <View>'dı;
      // maçın içine girmenin hiçbir yolu yoktu. Oysa mühürlü haftada en
      // değerli bilgi orada: maç öncesi ne demişiz, sonra ne olmuş.
      // Detay ekranı arşivdeki MÜHÜRLÜ kaydı okur; yeniden hesap yapmaz.
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => navigation.navigate('GecmisMacDetay', {
          roundId: effectiveId, no: item.no, mac: item,
        })}
        accessibilityRole="button"
        accessibilityLabel={`${item.no}. maç ${item.home?.name} - ${item.away?.name} detayını aç`}
        style={[styles.mCard, corr && styles.mCardCorr]}
      >
        {/* Ülke satırı (kullanıcı isteği, 2026-08-04). Geçmiş bültende lig alanı
            "Final" gibi tur adı olabilir — ülke çıkarılamıyorsa satır çizilmez,
            ülke uydurulmaz (gizleTanimsiz). */}
        <UlkeEtiketi league={item.league} gizleTanimsiz style={styles.mUlke} />
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
            {/* CANLI MAÇTA SKOR GÖSTERİLMEZ (kullanıcı kararı, 2 Ağustos 2026).
                Yalnız maçın oynanmakta olduğu belirtilir.
                Projenin kendi kuralıyla aynı yönde: "yalnız resmî 90 dakika
                sonucu kesindir; canlı ve geçici veriler kesin sayılmaz".
                Anlık skor saniyede değişir ve resmî sonuçla karışma riski
                taşır — ayrıca skordan türetilen 1/X/2 harfi de yazılmaz. */}
            {(!resolved && prov?.live) ? (
              <>
                <Text style={styles.mCanli}>CANLI</Text>
                <Text style={styles.mCanliAlt}>
                  {prov.minute != null ? `${prov.minute}'` : 'oynanıyor'}
                </Text>
              </>
            ) : resolved || prov ? (() => {
              // RESMÎ ile GEÇİCİ sonuç ayrımı RENKLE YETİNMEZ, YAZIYLA da söylenir.
              //
              // Önceden fark yalnız renkti (yeşil=resmî, sarı=geçici). Renk tek
              // ayırt ediciyken renk körü kullanıcı — ya da rengin anlamını
              // bilmeyen herkes — harici sağlayıcıdan TÜRETİLMİŞ bir sonucu
              // resmî sanıyordu. Resmî sonuç gelmeden "kesin" izlenimi vermek,
              // projenin uydurma çıktı yasağı kapsamındadır.
              const sc = resolved ? item.score : prov.score;
              const col = resolved ? colors.success : colors.warning;
              const res = resolved ? item.result : (sc.home > sc.away ? '1' : sc.home < sc.away ? '2' : 'X');
              return (
                <>
                  <Text style={[styles.mScore, { color: col }]}>{sc.home} - {sc.away}</Text>
                  <Text style={[styles.mRes, { color: col }]}>{res}</Text>
                  {!resolved ? (
                    <Text style={styles.mGecici} numberOfLines={1}>geçici · resmî değil</Text>
                  ) : null}
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

        {/* ANALİZ ÖZETİ — yalnız başlamamış maçta: bir bakışta sürpriz etiketi,
            favori yüzdesi ve (veri varsa) son maç formları. Radar ile tutarlı. */}
        {notStarted && item.analysis && (item.analysis.label || item.analysis.favorite) ? (
          <View style={styles.mAnalysisRow}>
            {item.analysis.label ? <SurpriseBadge label={item.analysis.label} labelColor={item.analysis.labelColor} small /> : null}
            {item.analysis.favorite ? (
              <Text style={styles.mFavTxt}>
                Favori <Text style={styles.mFavStrong}>{String(item.analysis.favorite.symbol).replace('0', 'X')}</Text> · %{item.analysis.favorite.percent}{item.analysis.estimated ? ' ≈' : ''}
              </Text>
            ) : null}
            {item.analysis.surpriseScore != null ? (
              <Text style={styles.mSurTxt}>Sürpriz {item.analysis.surpriseScore}</Text>
            ) : null}
          </View>
        ) : null}
        {notStarted && (item.home?.form?.length || item.away?.form?.length) ? (
          <View style={styles.mFormRow}>
            <FormStrip form={item.home.form} size={15} />
            <Text style={styles.mFormMid}>son maçlar</Text>
            <FormStrip form={item.away.form} size={15} />
          </View>
        ) : null}

        <View style={styles.mDivider} />

        <View style={styles.mFoot}>
          <View style={styles.mFootLeft}>
            {resolved ? (
              <Text style={styles.mOfficial}>MS · Resmi Sonuç</Text>
            ) : notStarted ? (
              <Text style={styles.mWaitMuted}>Başlamadı</Text>
            ) : (prov && prov.live) ? (
              <Text style={styles.mLive}>🔴 CANLI{prov.minute != null ? ` ${prov.minute}'` : ''}</Text>
            ) : (prov && prov.finished) ? (
              <Text style={styles.mWait}>Bitti · resmi sonuç bekleniyor</Text>
            ) : (
              <Text style={styles.mWait}>Resmi sonuç bekliyor</Text>
            )}
            <Text style={styles.mPicks} numberOfLines={1}>
              <Text style={styles.mPickLabel}>Sen </Text><Text style={styles.mPickVal}>Kupon yok</Text>
              <Text style={styles.mPickDot}>    ·    </Text>
              <Text style={styles.mPickLabel}>Sistem </Text><Text style={styles.mPickValStrong}>{sysSym ? sysSym.split('').map((c) => (c === '0' ? 'X' : c)).join('-') : '—'}</Text>{sysMark !== 'none' ? <Text> {MARK[sysMark]}</Text> : null}
            </Text>
          </View>

          {/* "↻ Yenile" düğmesi KALDIRILDI (kullanıcı kararı, 2 Ağustos 2026).
              Ekran zaten 15 saniyede bir kendini yeniliyordu; düğme aynı işi
              elle tekrarlıyor ve her canlı maç satırına bir düğme daha
              ekliyordu. "Düzeltme" rozeti AYRI bir şeydir (resmî sonuç
              değişikliğini açıklar) ve yerinde duruyor. */}
          {corr ? (
            <TouchableOpacity onPress={() => setRefreshSheet({ correction: corr })} style={styles.corrBadge}><Text style={styles.corrTxt}>Düzeltme</Text></TouchableOpacity>
          ) : null}
          {/* Tıklanabilir olduğunu belli eden tek işaret — ek satır açmadan. */}
          <Text style={styles.mDetay}>›</Text>
        </View>

        {/* ——— MAÇ PROFİLİ (2026-08-07) ———
            Kullanıcı isteği: favori miydi sürpriz mi çıktı, oranı neydi, kaç
            oynanmıştı — bunlar bültenin kendisinde görünsün.
            SÜRPRİZ kararı burada verilir: RESMÎ sonuç + piyasa favorisi.
            Resmî sonuç yoksa damga vurulmaz ("sonuç bekleniyor").
            flexWrap + numberOfLines ile dar ekranda taşma engellendi (§11). */}
        {(() => {
          const pr = prof(item.no);
          if (!pr) {
            return profil?.hata || (profil && !profil.maclar?.length) ? (
              <Text style={styles.pfYok}>Bu hafta için oran/oynanma kaydı yok.</Text>
            ) : null;
          }
          const surpriz = (resolved && item.result && pr.piyasaFavorisi)
            ? item.result !== pr.piyasaFavorisi
            : null;
          return (
            <View style={styles.pfKutu}>
              <View style={styles.pfRozetler}>
                {surpriz === true ? (
                  <Text style={[styles.pfRozet, styles.pfSurpriz]}>SÜRPRİZ</Text>
                ) : surpriz === false ? (
                  <Text style={[styles.pfRozet, styles.pfFavori]}>favori kazandı</Text>
                ) : (
                  <Text style={[styles.pfRozet, styles.pfNotr]}>sonuç bekleniyor</Text>
                )}
                {pr.macTipi ? (
                  <Text style={styles.pfRozet}>{MAC_TIPI_ADI[pr.macTipi] || pr.macTipi}</Text>
                ) : null}
                {pr.kalabalikProfili ? (
                  <Text style={styles.pfRozet}>{KALABALIK_ADI[pr.kalabalikProfili] || pr.kalabalikProfili}</Text>
                ) : null}
              </View>
              <Text style={styles.pfSatir} numberOfLines={1}>
                <Text style={styles.pfEtiket}>Oran </Text>
                {pr.oran ? `${pr.oran.home ?? '—'} / ${pr.oran.draw ?? '—'} / ${pr.oran.away ?? '—'}` : '—'}
                <Text style={styles.pfEtiket}>   Oynanma % </Text>
                {pr.oynanma ? `${pr.oynanma['1'] ?? '—'} / ${pr.oynanma.X ?? '—'} / ${pr.oynanma['2'] ?? '—'}` : '—'}
              </Text>
            </View>
          );
        })()}
      </TouchableOpacity>
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
            // LİSTE görünümü RESMÎ yazımda: "9 ADET 4.035.942,42 ₺".
            // (Tablo ve Kart görünümleri kendi düzenlerinde bırakıldı —
            //  değiştirilen yalnız paylaşılan görüntüdeki yer.)
            hist.prize.tiers.map((t) => (
              <View key={t.hit} style={styles.prizeRow}>
                <Text style={styles.prizeHit}>{t.hit} Bilen</Text>
                <Text style={styles.prizeCount}>{fmtCount(t.count)} ADET</Text>
                <Text style={[styles.prizeAmt, t.count === 0 && styles.prizeRoll]}>{t.count === 0 ? 'Devretti' : fmtTLResmi(t.prize)}</Text>
              </View>
            ))
          )}
          {/* KAPANIŞ ve AÇIKLAMALAR — resmî listede etiketli satır olarak
              duruyor, bizde eksikti. Veri yoksa satır ÇİZİLMEZ (uydurulmaz). */}
          {kapanisResmi(hist.prize.closeDate || selMeta?.closeDate) ? (
            <View style={styles.prizeRow}>
              <Text style={styles.prizeHit}>Kapanış</Text>
              <Text style={styles.prizeMeta}>{kapanisResmi(hist.prize.closeDate || selMeta?.closeDate)}</Text>
            </View>
          ) : null}
          {hist.prize.description ? (
            <View style={styles.prizeRow}>
              <Text style={styles.prizeHit}>Açıklamalar</Text>
              <Text style={styles.prizeMeta}>{hist.prize.description}</Text>
            </View>
          ) : null}
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
          <Text style={styles.errText}>Güncel başlamamış haftalık program alınamadı.</Text>
          <Text style={styles.muted}>{error}</Text>
          <TouchableOpacity style={styles.retry} onPress={load}><Text style={styles.retryText}>Tekrar Dene</Text></TouchableOpacity>
        </Center>
      );
    } else if (currentMatches.length === 0) {
      body = (
        <BultenEmptyState
          title={data?.title || 'Bu haftanın bülteni henüz yayınlanmadı'}
          message={data?.pending
            ? `${data?.reason || 'Güncel resmi bülten bekleniyor.'}\nGeçmiş haftaların sonuçları için ‹ oka bas.`
            : 'Yeni hafta genellikle Pazar günü resmi listede yayınlanır.\nGeçmiş haftaların sonuçları için ‹ oka bas.'}
          onRefresh={load}
        />
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
          matches={currentMatches}
          userPicks={rankedPicks}
          subtitle={subtitle}
          onCardPress={(no) => {
            const m = currentMatches.find((x) => x.no === no);
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
    // Güncel bültenle BİREBİR AYNI sade başlık: yalnız skor renk açıklaması.
    const HistHeader = (
      <View>
        <ScoreLegend />

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
        ListEmptyComponent={<Text style={styles.hEmpty}>Bu haftanın maç listesi bulunamadı.</Text>}
        refreshControl={<RefreshControl refreshing={histChecking} onRefresh={() => checkOfficial(effectiveId)} tintColor={colors.primary} />}
      />
    );
  }

  return (
    <DuzZemin style={{ flex: 1, backgroundColor: colors.bg }}>
    {/* Favori takım arması zeminde soluk filigran (kullanıcı isteği). */}
    <TakimLogoZemin />
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
    </DuzZemin>
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

// Takım logosu — gerçek kulüp arması. Logo yoksa/alınamazsa nötr ⚽.
//
// ADRES VEKİLDEN GEÇER (/api/crest). Buradaki gerekçe paylaşım karesi değil
// GİZLİLİK: doğrudan dış adrese giden her görsel isteği kullanıcının IP'sini
// ve hangi bülteni açtığını üçüncü tarafa bildirir — bülten her açıldığında
// 15 maç × 2 arma. Vekil zaten vardı ve izinli konak listesi tek yerde
// (backend/src/crestProxy.js, varsayılan-ret).
//
// crestUrlOf BOZMAMA kuralıyla yazılmıştır: taban adres bilinmiyorsa ya da
// adres zaten yerelse dokunmaz — bugün çizilen bir arma bu değişiklik
// yüzünden kaybolmaz.
function TeamLogo({ logo, name }) {
  const [err, setErr] = useState(false);
  const adres = crestUrlOf(logo, API_BASE);
  if (adres && !err) {
    return <Image source={{ uri: adres }} style={styles.logo} resizeMode="contain" onError={() => setErr(true)} accessibilityLabel={name} />;
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
  diffBanner: { marginTop: 10, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1.2, padding: 10 },
  diffTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  diffTxt: { color: colors.textSoft, fontSize: 11.5, lineHeight: 16, fontWeight: '600', marginTop: 3 },
  legalTxt: { color: colors.textMuted, fontSize: 10, fontWeight: '600', textAlign: 'center', marginTop: 10, lineHeight: 14 },
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

  // Geçmiş hafta listesi (üst sayaç kutuları + filtre çipleri kaldırıldı)
  hEmpty: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 24 },

  // ——— Modern maç kartı ———
  mCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border, ...shadow.soft },
  mUlke: { marginBottom: 7 },
  mCardCorr: { borderColor: colors.warning },
  mDetay: { color: colors.muted, fontSize: 20, fontWeight: '900', marginLeft: 6 },
  // ——— MAÇ PROFİLİ ———
  pfKutu: { marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 7 },
  pfRozetler: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
  pfRozet: {
    fontSize: 9.5, fontWeight: '800', color: colors.textSoft, backgroundColor: colors.bgAlt,
    borderWidth: 1, borderColor: colors.border, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
  },
  pfSurpriz: { color: colors.danger, borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  pfFavori: { color: colors.textSoft },
  pfNotr: { color: colors.muted },
  pfSatir: { color: colors.text, fontSize: 11, fontWeight: '700' },
  pfEtiket: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  pfYok: { color: colors.muted, fontSize: 10, marginTop: 7 },
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
  // Canlı maçta skorun yerini alan gösterge — skor YAZILMAZ, yalnız durum.
  mCanli: { color: colors.accent, fontSize: 15, fontWeight: '900', letterSpacing: 1.5 },
  mCanliAlt: { color: colors.textSoft, fontSize: 11, fontWeight: '800', marginTop: 1 },
  // Geçici sonuç uyarısı — renk tek ayırt edici olmasın diye YAZIYLA.
  mGecici: { color: colors.warning, fontSize: 9.5, fontWeight: '800', marginTop: 1 },
  mScoreTemp: { color: colors.textSoft, fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  mTime: { color: colors.text, fontSize: 14, fontWeight: '800' },
  mDay: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  tempPill: { backgroundColor: colors.warningSoft, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  tempTxt: { color: '#8a5a00', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.5 },
  mAnalysisRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' },
  mFavTxt: { color: colors.textMuted, fontSize: 11.5, fontWeight: '700' },
  mFavStrong: { color: colors.text, fontWeight: '900' },
  mSurTxt: { color: colors.textMuted, fontSize: 11.5, fontWeight: '700' },
  mFormRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 },
  mFormMid: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  mDivider: { height: 1, backgroundColor: colors.border, marginTop: 12, marginBottom: 9 },
  mFoot: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mFootLeft: { flex: 1, gap: 3 },
  mOfficial: { color: colors.success, fontSize: 11, fontWeight: '900', letterSpacing: 0.2 },
  mWait: { color: colors.warning, fontSize: 11, fontWeight: '900', letterSpacing: 0.2 },
  mLive: { color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 0.2 },
  mWaitMuted: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  mPicks: { fontSize: 12, color: colors.text },
  mPickLabel: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  mPickVal: { color: colors.textSoft, fontWeight: '700' },
  mPickValStrong: { color: colors.text, fontWeight: '900' },
  mPickDot: { color: colors.border },
  // mRefresh/mRefreshTxt kaldırıldı — "↻ Yenile" düğmesi artık çizilmiyor.

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
  // SEZON FİLTRESİ — bir kontrol gibi görünmeli: çerçeve, zemin, ok.
  sezonChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 12, paddingVertical: 6, marginBottom: 4,
  },
  sezonChipAcik: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  sezonChipEtiket: { color: colors.muted, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.6 },
  sezonChipTxt: { color: colors.text, fontSize: 13, fontWeight: '800' },
  sezonChipOk: { color: colors.primary, fontSize: 10, fontWeight: '900' },
  sezonListe: {
    marginTop: 4, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    backgroundColor: colors.card, overflow: 'hidden', minWidth: 170,
  },
  sezonOge: { paddingVertical: 11, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  sezonOgeSecili: { backgroundColor: colors.primarySoft },
  sezonOgeTxt: { color: colors.textSoft, fontSize: 13, fontWeight: '700' },
  sezonOgeTxtSecili: { color: colors.primary, fontWeight: '900' },
  prizeMeta: { flex: 1, textAlign: 'right', color: colors.textSoft, fontSize: 12, fontWeight: '700' },
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
