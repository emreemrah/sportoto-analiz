import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';

import { api } from '../api';
import { BRAND_LINE_1, BRAND_LINE_2 } from '../brand';
import { colors, spacing, radius, shadows } from '../theme';
import { EmptyState, SkeletonCard, Logo } from '../ui';
import { ProfileAvatar } from '../components';
import { crestOf } from '../utils';
import BulletinHeroVisual, { BulletinHeroBackdrop } from '../components/BulletinHeroVisual';
import LigSeridi from '../components/LigSeridi';
import UlkeEtiketi from '../components/UlkeEtiketi';
import TakimLogoZemin from '../components/TakimLogoZemin';
import KayanSerit from '../components/KayanSerit';
import { yaklasanMaclar, oncekiRoundId } from '../yaklasanMaclar';
import { loadNotifications } from '../services/notificationsService';


function shortTeam(name) {
  return String(name || '')
    .replace(/\s+FK$/i, '')
    .replace(/\s+SK$/i, '')
    .trim();
}

function matchTime(iso) {
  if (!iso) return 'Saat yok';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Saat yok';
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function Header({ data, navigation, unread = 0 }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.brand}>
          {BRAND_LINE_1} <Text style={styles.brandAccent}>{BRAND_LINE_2}</Text>
        </Text>
      </View>


      {/* Zil GERÇEK çalışır: bildirim merkezini açar. Kırmızı sayı YALNIZ
          okunmamış GERÇEK bildirim varsa görünür — süs rozeti yoktur. */}
      <TouchableOpacity
        style={styles.topIconBtn}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('Notifications')}
        accessibilityLabel={unread > 0 ? `Bildirimler, ${unread} okunmamış` : 'Bildirimler'}
      >
        <Text style={styles.bellIcon}>🔔</Text>
        {unread > 0 ? (
          <View style={styles.notificationDot}>
            <Text style={styles.notificationDotTxt}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        ) : null}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.navigate('ProfileTab')}
        activeOpacity={0.85}
        style={styles.avatarBtn}
      >
        <ProfileAvatar size={34} />
      </TouchableOpacity>
    </View>
  );
}

// SÜRPRİZ SKORU EŞİKLERİ — TEK KAYNAK. Hem filtreyi hem etiketi bunlar besler.
// Ayrı yazılırlarsa biri değişip diğeri kalır ve ekran yalan söyler: "Öne Çıkan
// 45+" yazıp aslında 50+ sayan bir sayaç, kullanıcının doğrulayamayacağı bir
// hatadır. Bu yüzden sabit inline YAZILMAZ.
const ONE_CIKAN_ESIK = 45;
const SURPRIZ_ESIK = 65;

function HeroCard({ data, loading, onPress, onSummary, onRecap }) {
  const matches = data?.matches || [];
  // Sayılar YALNIZ güncel bültenin GERÇEK analizinden. "Maç Analizi" = analizi
  // olan (kapsanan) maç sayısı; kapsam dışı maç varsa şişirmez, yanıltmaz.
  // PAYDA GÖSTERİLİR (14/15): yalnız "14" yazınca bülten 15 maçlık olduğu için
  // kullanıcı eksik veri sanıyordu — kapsanmayan maç varsa bu görünmeliydi.
  const analyzed = matches.filter((m) => m?.analysis && m.analysis.surpriseScore != null);
  const total = analyzed.length;
  const bulletinTotal = matches.length;
  const featured = analyzed.filter((m) => Number(m.analysis.surpriseScore) >= ONE_CIKAN_ESIK).length;
  const surprise = analyzed.filter((m) => Number(m.analysis.surpriseScore) >= SURPRIZ_ESIK).length;
  const leagues = new Set(matches.map((m) => m.league).filter(Boolean)).size;
  const hazir = !loading && !!data;
  const v = (n) => (hazir ? n : '–');

  // Haftanın GERÇEK karakteri (kullanıcı isteği, 2026-08-04): sabit tanıtım
  // cümlesi yerine backend'in zorluk özeti + ilk maç zamanı. Veri yoksa eski
  // genel cümleye düşülür — uydurma yok.
  const zorluk = data?.difficulty || null;
  const zorlukRenk = zorluk?.level === 'Zor' ? colors.accent : zorluk?.level === 'Orta' ? colors.warning : colors.success;
  const ilkTarih = matches.length
    ? matches.reduce((en, m) => (m.date && (!en || m.date < en) ? m.date : en), null)
    : null;
  const ilkD = ilkTarih ? new Date(ilkTarih) : null;
  const ilkOk = ilkD && !Number.isNaN(ilkD.getTime());

  return (
    <View style={styles.heroCard}>
      <BulletinHeroBackdrop />

      <View style={[styles.heroWeekRow, { flexWrap: 'wrap', rowGap: 4 }]}>
        <View style={styles.heroWeekDot} />
        <Text style={styles.heroWeekText}>{data?.round || '—'}</Text>
        {hazir && zorluk?.level ? (
          <View style={[styles.heroZorluk, { borderColor: zorlukRenk }]}>
            <Text style={[styles.heroZorlukTxt, { color: zorlukRenk }]}>Zorluk: {zorluk.level}</Text>
          </View>
        ) : null}
        {hazir && ilkOk ? (
          <Text style={styles.heroIlkMac}>
            İlk maç: {ilkD.toLocaleDateString('tr-TR', { weekday: 'short' })} {matchTime(ilkTarih)}
          </Text>
        ) : null}
      </View>

      <View style={styles.heroTopRow}>
        <View style={styles.heroTextBlock}>
          <Text style={styles.heroTitle}>Bu Haftanın Bülteni</Text>
          <Text style={styles.heroDesc}>
            {zorluk?.text || 'Veriler hazır, analizler tamam. Haftaya dair öne çıkanlar burada.'}
          </Text>
        </View>
        <BulletinHeroVisual width={84} height={60} />
      </View>

      {/* Sayaçlar ve düğmeler AYRI satırlarda. Aynı satırda olduklarında telefon
          genişliğinde sütunlar eziliyor ve "Öne Çıkan Analiz" etiketi harf harf
          alt alta düşüyordu — yayında bozuk görünen gerçek bir kusurdu. */}
      <View style={styles.heroBottomRow}>
        <View style={styles.heroStats}>
          <View style={styles.heroStatItem}>
            {/* Payda küçük punto: "14/15" dar telefonda dört sütuna sığsın diye
                sayı 22pt kalır, "/15" 13pt'ye düşer — satır kırılmaz. */}
            <Text style={styles.heroStatValue} numberOfLines={1} testID="sayac-analiz">
              {v(total)}
              {hazir ? <Text style={styles.heroStatValueSuffix}>/{bulletinTotal}</Text> : null}
            </Text>
            <Text style={styles.heroStatLabel} numberOfLines={2}>Maç Analizi</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatValue} testID="sayac-one-cikan">{v(featured)}</Text>
            {/* Eşik sayısı (45+/65+) etiketten çıkarıldı — kafa karıştırıyordu
                (kullanıcı geri bildirimi, 2026-08-04). Eşikler hesapta duruyor. */}
            <Text style={styles.heroStatLabel} numberOfLines={2}>Öne Çıkan</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatValue} testID="sayac-surpriz">{v(surprise)}</Text>
            <Text style={styles.heroStatLabel} numberOfLines={2}>Sürpriz Adayı</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatValue}>{v(leagues)}</Text>
            <Text style={styles.heroStatLabel} numberOfLines={2}>Lig</Text>
          </View>
        </View>
      </View>

      <View style={styles.heroCtaRow}>
        <TouchableOpacity style={styles.heroButton} onPress={onPress} activeOpacity={0.88}>
          <Text style={styles.heroButtonText}>Bülteni Aç</Text>
          <Text style={styles.heroButtonArrow}>›</Text>
        </TouchableOpacity>

        {/* Yayın açılış segmenti: güçlü adaylar + sürprizler + zorluk tek kartta */}
        <TouchableOpacity style={styles.heroSummaryBtn} onPress={onSummary} activeOpacity={0.88}>
          <Text style={styles.heroSummaryTxt} numberOfLines={1}>📺 Haftanın Özeti</Text>
        </TouchableOpacity>
      </View>

      {/* Yayın kapanış segmenti: geçen haftanın RESMÎ sonuçlarıyla sen vs sistem
          karnesi. Sonuç gelmemişse ekran sayı üretmez, bunu açıkça söyler. */}
      <TouchableOpacity style={styles.heroRecapBtn} onPress={onRecap} activeOpacity={0.88}>
        <Text style={styles.heroRecapTxt}>🏁 Geçen Haftanın Kapanışı</Text>
        <Text style={styles.heroRecapArrow}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

function SectionHead({ title, right, onPress }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right ? (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
          <Text style={styles.sectionRight}>{right}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function AnalysisCard({ match, tag, color, navigation, dar = false }) {
  // Üst düzey kart (kullanıcı isteği, 2026-08-04): takım adları logoların
  // altında, ortada VS + saat, GERÇEK 1/X/2 ihtimal çubuğu (veri yoksa çubuk
  // hiç çizilmez — uydurma yüzde yok), altta tam genişlik buton.
  const probs = match.analysis?.probabilities || null;
  const fav = match.analysis?.favorite?.symbol ? String(match.analysis.favorite.symbol).replace('0', 'X') : null;
  const d = match.date ? new Date(match.date) : null;
  const dOk = d && !Number.isNaN(d.getTime());
  const segs = probs ? [
    { k: '1', v: Number(probs['1']) || 0 },
    { k: 'X', v: Number(probs.X ?? probs['0']) || 0 },
    { k: '2', v: Number(probs['2']) || 0 },
  ] : [];
  return (
    <TouchableOpacity
      style={[styles.analysisCard, dar && styles.analysisCardDar]}
      activeOpacity={0.88}
      onPress={() => navigation.navigate('MatchDetail', { no: match.no })}
    >
      <View style={styles.analysisTagRow}>
        <View style={[styles.tagPill, dar && styles.tagPillDar, { backgroundColor: color + '26' }]}>
          <Text style={[styles.tagText, dar && styles.tagTextDar, { color }]}>{tag}</Text>
        </View>
        {/* Hangi ülkenin maçı (kullanıcı isteği, 2026-08-04). Dar ekranda
            yan yana iki kart var; ülke adı satırı taşırdığı için yalnız
            bayrak çizilir (ad, erişilebilirlik etiketinde durur). */}
        <UlkeEtiketi league={match.league} ligGoster={false} kisa={dar} />
      </View>

      <View style={[styles.analysisTeams, dar && styles.analysisTeamsDar]}>
        <View style={styles.teamBlock}>
          <Logo uri={crestOf(match, 'home')} name={match.home?.name} size={dar ? 28 : 46} />
          {/* TEK satır — ad uzunsa kısalır; kart yükseklikleri simetrik kalır. */}
          <Text style={[styles.teamName, dar && styles.teamNameDar]} numberOfLines={1}>{shortTeam(match.home?.name)}</Text>
        </View>

        <View style={styles.vsBlock}>
          <View style={[styles.vsCircle, dar && styles.vsCircleDar]}>
            <Text style={styles.vsText}>VS</Text>
          </View>
          {dOk ? (
            /* Dar ekranda yan yana iki kart var: tarih ve saat ALT ALTA
               yazılır, tek satır olsa takım adlarının yerini yerdi. */
            <Text style={[styles.vsTime, dar && styles.vsTimeDar]} numberOfLines={dar ? 2 : 1}>
              {d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}{dar ? '\n' : ' · '}{matchTime(match.date)}
            </Text>
          ) : null}
        </View>

        <View style={styles.teamBlock}>
          <Logo uri={crestOf(match, 'away')} name={match.away?.name} size={dar ? 28 : 46} />
          <Text style={[styles.teamName, dar && styles.teamNameDar]} numberOfLines={1}>{shortTeam(match.away?.name)}</Text>
        </View>
      </View>

      {/* GERÇEK ihtimaller — her seçenek kendi kutusunda.
          (İlk sürümdeki ince çubuk "net anlaşılmıyor" bulundu, kutulara çevrildi.)
          Veri yoksa bu bölüm hiç çizilmez — uydurma yüzde yok.

          VURGU DİLİ DEĞİŞTİ (kullanıcı bildirimi, 2026-08-06: "MS1 %40
          seçilmiş gibi duruyor"): favori kutusu KOYU DOLGULUYDU; mobil
          arayüzde dolu kutu "seçildi" demektir, oysa burada seçim yok, yalnız
          en yüksek ihtimal işaretleniyor. Artık dolgu yerine açık ton + renkli
          çerçeve + ▲ işareti kullanılıyor ve altına "seçim değil" notu
          yazılıyor. Kupon seçimi yalnız Kupon ekranında yapılır. */}
      {segs.length ? (
        <>
          <View style={[styles.probRow, dar && styles.probRowDar]}>
            {segs.map((s) => {
              const favMi = s.k === fav;
              return (
                <View
                  key={s.k}
                  style={[styles.probBox, dar && styles.probBoxDar, favMi && styles.probBoxFav]}
                  accessibilityLabel={favMi ? `${s.k}: yüzde ${s.v} — en yüksek ihtimal` : `${s.k}: yüzde ${s.v}`}
                >
                  <Text style={[styles.probSym, dar && styles.probSymDar, favMi && styles.probSymFav]}>
                    {s.k}{favMi ? ' ▲' : ''}
                  </Text>
                  <Text style={[styles.probPct, dar && styles.probPctDar, favMi && styles.probPctFav]}>
                    %{s.v}{match.analysis?.estimated ? '≈' : ''}
                  </Text>
                </View>
              );
            })}
          </View>
          <Text style={[styles.probNot, dar && styles.probNotDar]} numberOfLines={1}>
            {dar ? '▲ en yüksek · seçim değil' : '▲ en yüksek ihtimal — seçim değil'}
          </Text>
        </>
      ) : null}

      <Text
        style={[styles.analysisDesc, dar && styles.analysisDescDar]}
        numberOfLines={dar ? 1 : 2}
      >
        {match.analysis?.comment || match.aiComment || 'Form ve istatistik verileri birlikte değerlendiriliyor.'}
      </Text>

      <TouchableOpacity
        style={[styles.analysisBtn, dar && styles.analysisBtnDar]}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('MatchDetail', { no: match.no })}
      >
        <Text style={[styles.analysisBtnTxt, dar && styles.analysisBtnTxtDar]}>Analiz Detayı</Text>
        <Text style={[styles.analysisBtnArrow, dar && styles.analysisBtnArrowDar]}>›</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function SurpriseCard({ match, navigation }) {
  // Seviye ve yüzde GERÇEK sürpriz puanından — sıraya göre etiket uydurulmaz.
  const score = Number(match.analysis?.surpriseScore || 0);
  const level = score >= 65 ? 'YÜKSEK' : score >= 45 ? 'ORTA' : 'DÜŞÜK';
  const color = score >= 65 ? colors.gold : score >= 45 ? colors.field : colors.gray;
  // İzleyici armadan takımı tanımaz — kısaltılmış ad her zaman görünür.
  const shortName = (t) => t?.mediumName || t?.shortName || (t?.name || '').slice(0, 10) || '—';

  return (
    <TouchableOpacity
      style={styles.surpriseCard}
      activeOpacity={0.86}
      onPress={() => navigation.navigate('MatchDetail', { no: match.no })}
    >
      {/* Hangi ülkenin maçı (kullanıcı isteği, 2026-08-04). */}
      <UlkeEtiketi league={match.league} ligGoster={false} style={styles.surpriseUlke} />
      <View style={styles.surpriseLogos}>
        <Logo uri={crestOf(match, 'home')} name={match.home?.name} size={30} />
        <Text style={styles.surpriseVs}>VS</Text>
        <Logo uri={crestOf(match, 'away')} name={match.away?.name} size={30} />
      </View>
      <View style={styles.surpriseNames}>
        <Text style={styles.surpriseName} numberOfLines={1}>{shortName(match.home)}</Text>
        <Text style={[styles.surpriseName, styles.surpriseNameR]} numberOfLines={1}>{shortName(match.away)}</Text>
      </View>

      <View style={styles.surpriseBottom}>
        <View style={[styles.surpriseLevel, { backgroundColor: color + '33' }]}>
          <Text style={[styles.surpriseLevelTxt, { color }]}>{level}</Text>
        </View>
        <Text style={styles.surprisePct}>{score > 0 ? `İhtimal: %${score}` : 'Veri bekleniyor'}</Text>
      </View>
    </TouchableOpacity>
  );
}

// Yaklaşan maç kartı — gerçek bülten verisi: gün + saat + takımlar + lig.
// HAFTA ROZETİ yalnız ÖNCEKİ haftanın maçlarında görünür: liste iki haftayı
// karıştırdığı için kullanıcının hangi bültene baktığını bilmesi gerekir.
// TIKLAMA HEDEFİ de haftaya göre değişir — açıklaması yaklasanMaclar.js'te.
function KickoffCard({ match, navigation }) {
  const d = match.date ? new Date(match.date) : null;
  const ok = d && !Number.isNaN(d.getTime());
  const day = ok ? d.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
  const git = () => (match.oncekiHafta
    ? navigation.navigate('BulletinDetail', { bulletinId: match.roundId })
    : navigation.navigate('MatchDetail', { no: match.no }));
  return (
    <TouchableOpacity
      style={styles.kickCard}
      activeOpacity={0.86}
      onPress={git}
    >
      {match.oncekiHafta && match.haftaAdi ? (
        <View style={styles.kickHaftaRozet}>
          <Text style={styles.kickHaftaTxt} numberOfLines={1}>{match.haftaAdi}</Text>
        </View>
      ) : null}
      <View style={styles.kickTimeRow}>
        <Text style={styles.kickDay} numberOfLines={1}>{day}</Text>
        <Text style={styles.kickTime}>{ok ? matchTime(match.date) : '—'}</Text>
      </View>
      <View style={styles.kickTeamRow}>
        <Logo uri={crestOf(match, 'home')} name={match.home?.name} size={22} />
        <Text style={styles.kickTeam} numberOfLines={1}>{shortTeam(match.home?.name)}</Text>
      </View>
      <View style={styles.kickTeamRow}>
        <Logo uri={crestOf(match, 'away')} name={match.away?.name} size={22} />
        <Text style={styles.kickTeam} numberOfLines={1}>{shortTeam(match.away?.name)}</Text>
      </View>
      {/* Lig adı yerine bayrak + ülke (kullanıcı isteği, 2026-08-04). */}
      <UlkeEtiketi league={match.league} style={styles.kickUlke} />
    </TouchableOpacity>
  );
}

function EmptyDashboard({ error }) {
  return (
    <View style={{ paddingHorizontal: spacing.md }}>
      <EmptyState
        icon="📊"
        title={error ? 'Bülten alınamadı' : 'Dashboard hazırlanıyor'}
        subtitle={error || 'Güncel bülten yayınlanınca analiz kartları burada görünecek.'}
      />
    </View>
  );
}

export default function HomeScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [unread, setUnread] = useState(0);

  // ÖNCEKİ HAFTANIN DEVAM EDEN MAÇLARI. Ayrı bir istektir ve BAŞARISIZ OLMASI
  // ana sayfayı BOZMAZ: bülten yine çizilir, liste yalnız güncel haftayı
  // gösterir. Ek bir veri için asıl ekranı riske atmak doğru olmazdı.
  const [onceki, setOnceki] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const result = await api.bulletin();
      setData(result);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const oncekiHaftayiYukle = useCallback(async () => {
    try {
      const r = await api.rounds();
      const id = oncekiRoundId(r);
      if (id == null) { setOnceki(null); return; }
      const h = await api.history(id);
      const ad = (r.rounds || []).find((x) => x.id === id)?.name ?? null;
      setOnceki({ roundId: id, round: ad, matches: h?.matches || [] });
    } catch {
      setOnceki(null);                      // sessiz geç — ana akış bozulmasın
    }
  }, []);

  useEffect(() => {
    load();
    oncekiHaftayiYukle();
  }, [load, oncekiHaftayiYukle]);

  // Zil rozeti: gerçek okunmamış bildirim sayısı. Hata olursa rozet yok
  // (sayı uydurulmaz), ekran akışı da etkilenmez.
  useEffect(() => {
    let iptal = false;
    const say = () => {
      loadNotifications({ now: Date.now() })
        .then((r) => { if (!iptal) setUnread(r?.unread || 0); })
        .catch(() => { if (!iptal) setUnread(0); });
    };
    say();
    const durdur = navigation.addListener?.('focus', say);
    return () => { iptal = true; if (typeof durdur === 'function') durdur(); };
  }, [navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([load(), oncekiHaftayiYukle()]);
    setRefreshing(false);
  }, [load, oncekiHaftayiYukle]);

  const matches = data?.matches || [];

  // 360px SINIFI EKRANLAR (kullanıcı isteği, 2026-08-06): dar ekranda analiz
  // kartları yan yana sıkışmak yerine ALT ALTA dizilir.
  const { width: ekranGenislik } = useWindowDimensions();
  const darEkran = ekranGenislik < 400;

  const topAnalysis = useMemo(() => {
    return [...matches]
      .filter((m) => m.status !== 'finished')
      .sort((a, b) => Number(b.analysis?.surpriseScore || 0) - Number(a.analysis?.surpriseScore || 0))
      .slice(0, 2);
  }, [matches]);

  const surpriseMatches = useMemo(() => {
    return [...matches]
      .filter((m) => m.status !== 'finished')
      .sort((a, b) => Number(b.analysis?.surpriseScore || 0) - Number(a.analysis?.surpriseScore || 0))
      .slice(0, 3);
  }, [matches]);

  const fallbackAnalysis = matches.slice(0, 2);
  const displayAnalysis = topAnalysis.length ? topAnalysis : fallbackAnalysis;
  const displaySurprise = surpriseMatches.length ? surpriseMatches : matches.slice(0, 3);

  // Yaklaşan maçlar — GÜNCEL hafta + ÖNCEKİ haftadan henüz oynanmamışlar,
  // tarihe göre en yakın önce. Birleştirme mantığı yaklasanMaclar.js'te
  // (saf ve ayrıca test edilir).
  const upcoming = useMemo(
    () => yaklasanMaclar({ roundId: data?.roundId, round: data?.round, matches }, onceki),
    [data?.roundId, data?.round, matches, onceki],
  );

  return (
    // Favori takım arması zeminde soluk filigran olarak durur (kullanıcı
    // isteği). Takım yoksa/arma bulunamazsa hiçbir şey çizilmez.
    <View style={styles.kokSarmal}>
    <TakimLogoZemin />
    <ScrollView
      style={[styles.container, { backgroundColor: 'transparent' }]}
      contentContainerStyle={{ paddingBottom: spacing.xl + 12 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
        />
      }
    >
      <Header data={data} navigation={navigation} unread={unread} />

      <HeroCard
        data={data}
        loading={!data && !error}
        onPress={() => navigation.navigate('BulletinTab')}
        onSummary={() => navigation.navigate('WeekSummary')}
        onRecap={() => navigation.navigate('WeekRecap')}
      />

      {/* Bu haftanın ligleri: logo + ad, kayan tek satır. Bülten yokken
          bileşen hiç çizilmez (boş çubuk bırakmaz). */}
      <LigSeridi matches={data?.matches} />

      {/* Yaklaşan Maçlar — GERÇEK bülten verisinden (gün + saat + takımlar).
          Toplulukta Gündem kaldırıldı (kullanıcı isteği; içeriği sahte örnekti —
          sahte veri yok kuralıyla da uyumlu).
          KONUM (kullanıcı isteği, 2026-08-06): "Öne Çıkan Analizler"in ÜSTÜNDE.
          Mantığı da bu: önce "ne zaman ne oynanıyor", sonra "hangisi ilginç" —
          en aşağıdayken üç bölüm kaydırmadan görünmüyordu. */}
      {upcoming.length > 0 && (
        <>
          <SectionHead
            title="Yaklaşan Maçlar"
            right="Tümünü Gör ›"
            onPress={() => navigation.navigate('BulletinTab')}
          />
          {/* Lig şeridiyle AYNI mekanizma: sürekli döner, parmak değince
              durur (hareket eden kartı isabetle tıklamak zordur), cihazda
              "hareketi azalt" açıksa hiç kaymaz.
              Anahtar hafta+no birlikte: iki haftanın maçları aynı listede ve
              sıra numaraları çakışıyor — yalnız m.no ile anahtar çakışırdı. */}
          <KayanSerit
            testID="yaklasan-serit"
            style={styles.surpriseScroll}
            accessibilityLabel={`Yaklaşan maçlar: ${upcoming.length} karşılaşma`}
          >
            {upcoming.map((m) => (
              <KickoffCard key={`${m.roundId}-${m.no}`} match={m} navigation={navigation} />
            ))}
          </KayanSerit>
        </>
      )}

      {/* Hızlı Erişim kullanıcı kararıyla KALDIRILDI ("hızlı erişim olmasın") —
          alt sekme çubuğu aynı sayfalara zaten götürüyor. */}
      <SectionHead
        title="Öne Çıkan Analizler"
        right="Tümünü Gör ›"
        onPress={() => navigation.navigate('AnalizTab')}
      />

      {!data && !error ? (
        <View style={styles.screenPad}>
          <SkeletonCard />
        </View>
      ) : error || matches.length === 0 ? (
        <EmptyDashboard error={error} />
      ) : (
        /* YAN YANA (kullanıcı isteği, 2026-08-06): dar ekranda da iki kart
           aynı satırda dursun, karşılaştırma tek bakışta yapılabilsin. Alt
           alta dizmek ekranı iki katına çıkarıyordu. Sığması için kart içi
           ölçüler ayrıca küçültüldü (bkz. `dar` bayrağı). */
        <View style={[styles.analysisGrid, darEkran && styles.analysisGridDar]}>
          {displayAnalysis.map((m) => {
            // Etiket GERÇEK sürpriz puanından — karta göre sabit etiket uydurulmaz.
            const sc = Number(m.analysis?.surpriseScore || 0);
            const t = sc >= 65 ? { tag: 'SÜRPRİZ ADAYI', color: colors.gold }
              : sc >= 45 ? { tag: 'AÇIK MAÇ', color: colors.accent }
                : { tag: 'DENGELİ', color: colors.field };
            return (
              <AnalysisCard
                key={m.no}
                match={m}
                tag={t.tag}
                color={t.color}
                navigation={navigation}
                dar={darEkran}
              />
            );
          })}
        </View>
      )}

      <SectionHead
        title="Sürpriz İhtimali Yüksek"
        right="Tümünü Gör ›"
        onPress={() => navigation.navigate('BulletinTab')}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.surpriseScroll}
      >
        {displaySurprise.length ? (
          displaySurprise.map((m) => (
            <SurpriseCard key={m.no} match={m} navigation={navigation} />
          ))
        ) : (
          <View style={styles.emptySmallCard}>
            <Text style={styles.emptySmallTxt}>Sürpriz analizi için veri bekleniyor.</Text>
          </View>
        )}
      </ScrollView>

    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  kokSarmal: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  screenPad: {
    paddingHorizontal: spacing.md,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl + 2,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },

  brand: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.7,
  },

  brandAccent: {
    color: colors.accent,
  },

  readyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 7,
  },

  readyDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.field,
  },

  readyText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },

  topIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bellIcon: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    transform: [{ rotate: '-18deg' }],
  },


  notificationDot: {
    position: 'absolute',
    right: 2,
    top: 2,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  notificationDotTxt: { color: '#fff', fontSize: 10, fontWeight: '900' },

  avatarBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
  },

  sectionRight: {
    color: colors.accent,
    fontSize: 13.5,
    fontWeight: '900',
  },

  analysisGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },

  // Dar ekranda iki kart yan yana: kenar boşlukları ve aradaki boşluk
  // daraltılır ki her karta daha fazla genişlik kalsın.
  analysisGridDar: {
    gap: 8,
    paddingHorizontal: 10,
  },

  analysisCard: {
    // AÇIK YAZILDI (2026-08-06): yalnız `flex: 1` yazılınca kartlar içeriğin
    // genişliğine göre büyüyüp satırdan taşıyordu (dar ekranda ikinci kart
    // ekranın dışında kalıyordu). flexBasis 0 + minWidth 0, "içerik ne olursa
    // olsun genişliği kap paylaş" demenin kesin yoludur.
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 205,
    ...shadows.soft,
  },

  // DAR EKRAN (kullanıcı bildirimi, 2026-08-06: "çok büyük olmuş" → sonra
  // "yan yana olsa daha da küçült"). Telefonda iki kart aynı satırda duruyor;
  // ~170px'lik karta sığması için tüm iç ölçüler küçültüldü. Bilgi KAYBOLMADI:
  // ülke bayrakta, açıklamanın tamamı Analiz Detayı'nda.
  analysisCardDar: {
    minHeight: 0,
    padding: 8,
    borderRadius: 12,
  },

  analysisTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  surpriseUlke: {
    marginBottom: 6,
  },
  tagPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  tagText: {
    fontSize: 10.5,
    fontWeight: '900',
  },

  // SİMETRİ (kullanıcı isteği, 2026-08-04): yan yana iki kartın satırları
  // hizalı kalsın diye takım bölümü SABİT yükseklikte, adlar tek satır,
  // açıklama alanı tam iki satırlık yer kaplar.
  analysisTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 8,
    height: 78,
  },

  analysisTeamsDar: { height: 56, marginTop: 6, marginBottom: 2, paddingHorizontal: 0 },

  teamBlock: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },

  vsText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  analysisTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },

  analysisDesc: {
    color: colors.textMuted,
    fontSize: 12.2,
    lineHeight: 16,
    marginTop: 10,
    marginBottom: 10,
    height: 32, // tam 2 satır — kartlar arası hiza bozulmaz
  },

  // Dar ekranda tek satır: kart yarı yarıya kısalıyor, cümlenin başı yine
  // okunuyor; tamamı zaten "Analiz Detayı"nda duruyor.
  // Yan yana kipte TEK satır: cümlenin başı yön veriyor, tamamı zaten
  // "Analiz Detayı"nda. Yükseklik satırla birebir — altta boşluk kalmasın.
  analysisDescDar: { height: 14, marginTop: 5, marginBottom: 5, fontSize: 10, lineHeight: 13 },

  // ÜST DÜZEY KART parçaları (2026-08-04 yenilemesi)
  teamName: {
    color: colors.text,
    fontSize: 11.5,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 6,
  },

  teamNameDar: { fontSize: 9.5, marginTop: 4 },

  vsBlock: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
  },

  vsTimeDar: { fontSize: 8.5, lineHeight: 11, textAlign: 'center' },

  vsCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  vsCircleDar: { width: 24, height: 24, borderRadius: 12 },

  vsTime: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },

  probRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },

  probRowDar: { marginTop: 5, gap: 3 },
  probBoxDar: { paddingVertical: 4, borderRadius: 8 },
  probSymDar: { fontSize: 10.5 },
  probPctDar: { fontSize: 9, marginTop: 0 },

  probBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 6,
  },

  // EN YÜKSEK İHTİMAL — "seçildi" gibi görünmemeli. Dolu koyu kutu mobilde
  // seçim demektir; bu yüzden açık ton + renkli çerçeve kullanılıyor.
  probBoxFav: {
    backgroundColor: colors.primary + '14',
    borderColor: colors.primary,
    borderWidth: 1.5,
  },

  probSym: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: '900',
  },

  probSymFav: {
    color: colors.primary,
  },

  probPct: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 1,
  },

  probPctFav: {
    color: colors.primary,
  },

  // Kısa ve net: işaretin ne anlama GELMEDİĞİNİ söyler.
  probNot: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },

  probNotDar: { fontSize: 8.5, marginTop: 3 },

  analysisBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 'auto',
    gap: 6,
  },

  analysisBtnDar: { paddingVertical: 6, borderRadius: 9, marginTop: 2, gap: 3 },
  analysisBtnTxtDar: { fontSize: 10.5, letterSpacing: 0 },
  analysisBtnArrowDar: { fontSize: 13 },
  tagPillDar: { paddingHorizontal: 6, paddingVertical: 3 },
  tagTextDar: { fontSize: 8.5 },

  analysisBtnTxt: {
    color: '#fff',
    fontSize: 12.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },

  analysisBtnArrow: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    marginTop: -1,
  },

  surpriseScroll: {
    paddingHorizontal: spacing.md,
    gap: 10,
  },

  surpriseCard: {
    width: 156,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    ...shadows.soft,
  },

  surpriseLogos: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  surpriseVs: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
  },

  surpriseNames: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, marginTop: 4 },
  surpriseName: { flex: 1, color: colors.textSoft, fontSize: 10.5, fontWeight: '800' },
  surpriseNameR: { textAlign: 'right' },
  surpriseBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 9,
    gap: 6,
  },

  surpriseLevel: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  surpriseLevelTxt: {
    fontSize: 10,
    fontWeight: '900',
  },

  surprisePct: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },

  emptySmallCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  emptySmallTxt: {
    color: colors.textMuted,
    fontSize: 13,
  },

  /* ===== Yaklaşan maç kartları (gerçek bülten verisi) ===== */
  kickCard: {
    width: 170,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    ...shadows.soft,
  },

  // Önceki hafta rozeti — kartın en üstünde, ayırt edici ama bağırmayan.
  kickHaftaRozet: {
    alignSelf: 'flex-start',
    backgroundColor: colors.cardAlt,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 4,
  },
  kickHaftaTxt: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },

  kickTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },

  kickDay: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'capitalize',
    flexShrink: 1,
  },

  kickTime: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '900',
    marginLeft: 6,
  },

  kickTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 4,
  },

  kickTeam: {
    color: colors.text,
    fontSize: 12.5,
    fontWeight: '800',
    flex: 1,
  },

  kickUlke: {
    marginTop: 8,
  },

  /* ===== Hero kart (component + gerçek istatistik) ===== */
  // HERO YARI BOYUT (kullanıcı isteği, 2026-08-06): kart ekranın yarısını
  // yiyordu; dolgu/punto/yükseklik indirildi, içerik aynen duruyor.
  heroCard: {
    marginHorizontal: 10,
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: '#0f2038',
    borderWidth: 1,
    borderColor: '#1c3a5e',
    padding: 10,
    overflow: 'hidden',
  },
  heroWeekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroWeekDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    marginRight: 7,
  },
  heroWeekText: {
    color: '#cdd8e6',
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  heroZorluk: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 10,
  },
  heroZorlukTxt: {
    fontSize: 10.5,
    fontWeight: '900',
  },
  heroIlkMac: {
    color: '#cdd8e6',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 'auto',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  heroBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  heroCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  heroTextBlock: {
    flex: 1,
    paddingRight: 10,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '900',
  },
  heroDesc: {
    color: '#b8c6c8',
    fontSize: 10,
    lineHeight: 13,
    marginTop: 2,
  },
  heroStats: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroStatItem: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  heroStatIcon: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  heroStatValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 1,
  },
  // "/15" paydası: sayının kendisiyle yarışmasın, ama okunur kalsın.
  heroStatValueSuffix: {
    color: '#9fb0b3',
    fontSize: 10,
    fontWeight: '800',
  },
  heroStatLabel: {
    color: '#c1cacc',
    fontSize: 8.5,
    fontWeight: '700',
    marginTop: 1,
  },
  heroDivider: {
    width: 1,
    height: 26,
    backgroundColor: '#12615d',
    marginHorizontal: 5,
  },
  heroRight: {
    width: 122,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroIllustration: {
    width: 120,
    height: 74,
    backgroundColor: 'transparent',
  },
  heroButton: {
    flex: 1,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 11,
    backgroundColor: '#ff7a00',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // Gösterişli dokunuş: turuncu parlama (gölge) — veri değil, saf görsel.
    shadowColor: '#ff7a00',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  heroSummaryBtn: {
    flex: 1,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  heroSummaryTxt: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  heroRecapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    marginTop: 6,
  },
  heroRecapTxt: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  heroRecapArrow: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    marginLeft: 6,
  },
  heroButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  heroButtonArrow: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    marginLeft: 6,
    marginTop: -2,
  },
});
