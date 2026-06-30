import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Image, Platform } from 'react-native';
import { api } from '../api';
import { colors, spacing, radius } from '../theme';
import { matchDate } from '../utils';
import { MatchCard } from '../ui';

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

  // Geçmiş hafta seçilince veriyi çek
  useEffect(() => {
    if (viewingCurrent || effectiveId == null) { setHist(null); setHistError(null); return; }
    if (hist && hist.roundId === effectiveId) return;
    let alive = true;
    setHistLoading(true); setHistError(null);
    api.history(effectiveId)
      .then((h) => { if (alive) setHist({ ...h, roundId: effectiveId }); })
      .catch((e) => { if (alive) setHistError(e.message); })
      .finally(() => { if (alive) setHistLoading(false); });
    return () => { alive = false; };
  }, [effectiveId, viewingCurrent]); // eslint-disable-line

  const goPrev = () => { if (canPrev) setSelectedId(navRounds[selIdx - 1].id); };
  const goNext = () => { if (canNext) setSelectedId(navRounds[selIdx + 1].id); };
  const goCurrent = () => setSelectedId(currentRoundId);

  // İlk yükleme: hiç veri yokken tam ekran bekleme
  if (loading && !data) {
    return <Center><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.muted}>Bülten yükleniyor…</Text></Center>;
  }

  // ——— Başlık / hafta seçici ———
  const upcomingCount = data ? data.matches.filter((m) => !isStarted(m)).length : 0;
  const histAnyResult = hist ? hist.matches.some((m) => m.result) : false;
  const roundName = selMeta?.name || data?.round || '—';
  const roundYear = selMeta?.year || '';
  const subtitle = viewingCurrent
    ? (error ? 'güncel bülten alınamadı'
      : upcomingCount > 0
        ? `${upcomingCount}/${data.matchCount} maç başlamadı · analiz hazır${data.usingExampleKey ? ' · (örnek anahtar)' : ''}`
        : 'bu haftanın maçları başladı')
    : (histLoading ? 'yükleniyor…' : histError ? 'sonuç alınamadı' : histAnyResult ? 'Sonuçlar açıklandı' : 'Sonuçlar henüz açıklanmadı');

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
    </View>
  );

  // ——— Güncel bülten satırı (yeni premium MatchCard) ———
  const renderItem = ({ item }) => (
    <MatchCard match={item} onPress={() => navigation.navigate('MatchDetail', { no: item.no })} />
  );

  // ——— Geçmiş bülten satırı (sonuç odaklı: skor + resmi 1/X/2) ———
  const renderHistoryItem = ({ item }) => {
    const d = matchDate(item.date);
    const sc = item.score;
    return (
      <View style={styles.card}>
        <Text style={styles.no}>{item.no}</Text>
        <View style={styles.dateBox}>
          <Text style={styles.dateDay}>{d.day}</Text>
          <Text style={styles.dateTime}>{d.time}</Text>
        </View>
        <View style={styles.homeSide}>
          <TeamLogo logo={null} name={item.home.name} />
          <Text style={styles.teamName} numberOfLines={1}>{item.home.name}</Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreTxt}>{sc ? `${sc.home} - ${sc.away}` : '–'}</Text>
        </View>
        <View style={styles.awaySide}>
          <Text style={[styles.teamName, styles.teamNameR]} numberOfLines={1}>{item.away.name}</Text>
          <TeamLogo logo={null} name={item.away.name} />
        </View>
        <ResultBadge symbol={item.result} />
      </View>
    );
  };

  const PrizeSection = (
    <View style={styles.prizeBox}>
      <Text style={styles.prizeTitle}>Açıklanan Sonuçlar</Text>
      {!histAnyResult ? (
        <Text style={styles.prizeEmpty}>Bu hafta için sonuçlar henüz açıklanmadı.</Text>
      ) : hist?.prize ? (
        <>
          {hist.prize.tiers.map((t) => (
            <View key={t.hit} style={styles.prizeRow}>
              <Text style={styles.prizeHit}>{t.hit} Bilen</Text>
              <Text style={styles.prizeCount}>{fmtCount(t.count)} kişi</Text>
              <Text style={[styles.prizeAmt, t.count === 0 && styles.prizeRoll]}>
                {t.count === 0 ? 'Devretti' : fmtTL(t.prize)}
              </Text>
            </View>
          ))}
          {hist.prize.description ? <Text style={styles.prizeDesc}>{hist.prize.description}</Text> : null}
        </>
      ) : (
        <Text style={styles.prizeEmpty}>Bu hafta için açıklanmış ikramiye bilgisi bulunamadı.</Text>
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
    } else if (upcomingCount === 0) {
      body = (
        <Center>
          <Text style={styles.errEmoji}>🕐</Text>
          <Text style={styles.errText}>Program henüz yayınlanmadı</Text>
          <Text style={[styles.muted, { textAlign: 'center', marginTop: 6 }]}>
            Başlamamış güncel program henüz yok.{'\n'}Geçmiş haftaların sonuçları için ‹ oka bas.
          </Text>
        </Center>
      );
    } else {
      body = (
        <FlatList
          data={data.matches}
          keyExtractor={(m) => String(m.no)}
          renderItem={renderItem}
          contentContainerStyle={styles.listPad}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.primary} />}
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
    body = (
      <FlatList
        data={hist.matches}
        keyExtractor={(m) => String(m.no)}
        renderItem={renderHistoryItem}
        contentContainerStyle={styles.listPad}
        ListFooterComponent={PrizeSection}
      />
    );
  }

  return (
    <View style={styles.container}>
      {Header}
      {body}
    </View>
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
  currentBtn: { marginTop: 10, alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.sm, backgroundColor: colors.primary + '22', borderWidth: 1, borderColor: colors.primary },
  currentBtnTxt: { color: colors.primary, fontSize: 12.5, fontWeight: '800' },

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
