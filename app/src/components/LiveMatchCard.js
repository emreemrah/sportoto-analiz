// Bülten liste kartı — modern, hizalı. Takım + O-G-B-M kaydı yan kolonlarda,
// skor/durum ortada; ayraç altında Sen/Sistem tahmini. Detaylı canlı istatistik
// burada YOK; maça girince görünür.
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { colors, spacing, radius, shadow } from '../theme';
import { matchDate, crestOf } from '../utils';
import { matchPicks } from '../liveLogic';
import { Logo } from '../ui';
import { RecordBadges, FormStrip } from '../components';
import VenueFormStrip from './VenueFormStrip';
import { favoriteSide } from '../favoriteTeam';
import { useAuth } from '../auth';
import UlkeEtiketi from './UlkeEtiketi';

const MARK = { correct: '✅', wrong: '❌', pending: '⏳', none: '' };

function statusMeta(st, m) {
  switch (st) {
    case 'live': return { text: `CANLI${m.minute ? ` ${m.minute}'` : ''}`, color: colors.accent, pulse: true };
    case 'finished': return { text: 'MS', color: colors.warning }; // henüz resmi Spor Toto sonucu değil
    case 'awaiting': return { text: 'Sonuç bekleniyor', color: colors.warning, refresh: true };
    case 'suspended': return { text: 'Maç durdu', color: colors.warning };
    case 'postponed': return { text: 'Ertelendi', color: colors.muted };
    case 'cancelled': return { text: 'İptal', color: colors.danger };
    default: return { text: 'Başlamadı', color: colors.muted };
  }
}

// `community`: analiz özeti satırıyla birlikte 2026-08-08'de kullanımdan
// kalktı. Prop imzada BIRAKILDI — çağıran (LiveBulletinView) hâlâ gönderiyor
// ve topluluk oyu ileride kartta yeniden gösterilmek istenirse veri akışı
// kurulu kalsın. Kullanılmadığı buraya yazılmasa, "neden bu prop var" sorusu
// bir sonraki okuyanı yanlış yere götürürdü.
export default function LiveMatchCard({ match, onPress, onRefresh, anim = 'important', userPick = null, community = null }) {
  const p = matchPicks(match, userPick);
  const st = p.status;
  const meta = statusMeta(st, match);
  // CANLI MAÇTA SKOR GÖSTERİLMEZ (kullanıcı kararı, 2 Ağustos 2026):
  // "skoru gösterme, sadece maçın oynandığı belli olsun". Durum rozeti
  // (meta.text) zaten "CANLI 34'" diyor. Anlık skor saniyede değişir ve
  // resmî sonuçla karışma riski taşır — projenin "yalnız resmî 90 dakika
  // sonucu kesindir" kuralıyla da aynı yönde.
  const showScore = st !== 'notStarted' && st !== 'postponed' && st !== 'cancelled'
    && st !== 'live' && match.score;
  const hidePicks = st === 'cancelled';
  const d = match.date ? matchDate(match.date) : null;

  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (meta.pulse && anim !== 'off') {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    }
    pulse.setValue(1);
  }, [meta.pulse, anim, pulse]);

  const homeName = match.home?.mediumName || match.home?.name || '';
  const awayName = match.away?.mediumName || match.away?.name || '';
  // FAVORİ TAKIM VURGUSU — profildeki favori takımın maçı ⭐ ile işaretlenir.
  const { user } = useAuth();
  const favSide = favoriteSide(match, user?.favorite_team);
  const hRec = match.stats?.home?.standing || null;
  const aRec = match.stats?.away?.standing || null;
  const rec = (r, align) => (r ? <RecordBadges wins={r.wins} draws={r.draws} losses={r.losses} played={r.played} align={align} /> : null);
  const uMark = st === 'postponed' ? 'none' : p.user.mark;
  const sMark = st === 'postponed' ? 'none' : p.system.mark;

  return (
    <TouchableOpacity style={s.card} activeOpacity={0.85} onPress={onPress}>
      {/* Ülke satırı — hangi ülkenin maçı (kullanıcı isteği, 2026-08-04). */}
      <UlkeEtiketi league={match.league} style={s.ulke} />
      <View style={s.row}>
        <Text style={s.no}>{match.no}</Text>

        <View style={s.team}>
          <View style={s.teamLine}>
            <Logo uri={crestOf(match, 'home')} name={homeName} size={20} />
            <Text style={s.name} numberOfLines={1}>{favSide === 'home' ? '⭐ ' : ''}{homeName}</Text>
          </View>
          {rec(hRec)}
        </View>

        <View style={s.center}>
          {st === 'notStarted' ? (
            <>
              <Text style={s.time}>{d ? d.time : '—'}</Text>
              <Text style={s.day} numberOfLines={1}>{d ? d.day : ''}</Text>
            </>
          ) : (
            <>
              {showScore ? <Text style={[s.score, { color: meta.color }]}>{match.score.home} - {match.score.away}</Text> : null}
              <Animated.View style={[s.badge, { borderColor: meta.color }, meta.pulse ? { opacity: pulse } : null]}>
                <Text style={[s.badgeTxt, { color: meta.color }]} numberOfLines={1}>{meta.text}</Text>
              </Animated.View>
            </>
          )}
        </View>

        <View style={[s.team, s.teamR]}>
          <View style={[s.teamLine, s.teamLineR]}>
            <Text style={[s.name, s.nameR]} numberOfLines={1}>{awayName}{favSide === 'away' ? ' ⭐' : ''}</Text>
            <Logo uri={crestOf(match, 'away')} name={awayName} size={20} />
          </View>
          {rec(aRec, 'right')}
        </View>
      </View>

      {/* ANALİZ ÖZETİ KALDIRILDI (kullanıcı kararı, 2026-08-08).
          Kartta "SÜRPRİZE AÇIK · Favori 1 · %44 · Sürpriz 78" satırı vardı.
          Kaldırıldı: bülten listesi maçların KİMLİĞİNİ göstersin, hükmü değil.
          Aynı bilgiler maç detayında (Özet sekmesi) ve Radar ekranında,
          bağlamıyla birlikte duruyor — silinmedi, listeden çıkarıldı. */}
      {st === 'notStarted' && (match.stats?.home?.last5?.length || match.stats?.away?.last5?.length) ? (
        <View style={s.formRow}>
          {/* SAHA İKONLARI (kullanıcı isteği, 2026-08-08): harfli renkli kareler
              yerine maç detayındaki ev/uçak ikonlarının aynısı. Aynı bilgi iki
              ekranda aynı görünsün diye tek bileşenden gelir.
              `last5detail` yoksa iç saha/deplasman bilinmez — ikon uydurmak
              yerine eski harfli şeride düşülür. */}
          {match.stats?.home?.last5detail?.length ? (
            <VenueFormStrip detail={match.stats.home.last5detail} size={15} limit={5} />
          ) : (
            <FormStrip form={match.stats?.home?.last5} size={14} />
          )}
          <Text style={s.formMid}>son maçlar</Text>
          {match.stats?.away?.last5detail?.length ? (
            <VenueFormStrip detail={match.stats.away.last5detail} size={15} limit={5} sag />
          ) : (
            <FormStrip form={match.stats?.away?.last5} size={14} />
          )}
        </View>
      ) : null}

      <View style={s.divider} />

      <View style={s.foot}>
        <View style={s.footLeft}>
          {hidePicks ? (
            <Text style={s.await}>Resmi karar bekleniyor</Text>
          ) : (
            <Text style={s.picks} numberOfLines={1}>
              <Text style={s.pickLabel}>Sen </Text><Text style={s.pickVal}>{p.user.sym || 'Kupon yok'}</Text>{MARK[uMark] ? <Text> {MARK[uMark]}</Text> : null}
              <Text style={s.pickDot}>    ·    </Text>
              <Text style={s.pickLabel}>Sistem </Text><Text style={s.pickValStrong}>{p.system.sym ? String(p.system.sym).split('').map((c) => (c === '0' ? 'X' : c)).join('-') : '—'}</Text>{MARK[sMark] ? <Text> {MARK[sMark]}</Text> : null}
              {st === 'postponed' ? <Text style={s.await}>   · Ertelendi</Text> : null}
            </Text>
          )}
        </View>
        {/* "↻ Yenile" düğmesi KALDIRILDI (kullanıcı kararı, 2 Ağustos 2026).
            Ekran zaten 15 saniyede bir kendini yeniliyor; düğme aynı işi elle
            tekrarlıyor ve her canlı satıra bir düğme daha ekliyordu. */}
      </View>
      {match.coverage && match.coverage.ok === false ? (
        <View style={s.coverWarn}>
          <Text style={s.coverWarnTxt} numberOfLines={2}>⚠ {match.coverage.reason || 'Analiz verisi hazır değil'}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: 'rgba(255,255,255,0.86)', borderRadius: radius.lg, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border, ...shadow.soft },
  ulke: { marginBottom: 7 },
  row: { flexDirection: 'row', alignItems: 'center' },
  no: { color: colors.muted, fontSize: 11, fontWeight: '900', width: 16, textAlign: 'center', marginRight: 4 },
  team: { flex: 1, gap: 6, minWidth: 0 },
  teamR: { alignItems: 'flex-end' },
  teamLine: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'stretch' },
  teamLineR: { justifyContent: 'flex-end' },
  name: { flexShrink: 1, color: colors.text, fontSize: 13.5, fontWeight: '800' },
  nameR: { textAlign: 'right' },
  center: { minWidth: 64, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 6 },
  score: { color: colors.text, fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  badge: { borderWidth: 1, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2 },
  badgeTxt: { fontSize: 9.5, fontWeight: '900' },
  time: { color: colors.text, fontSize: 14, fontWeight: '800' },
  day: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  formRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  formMid: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  divider: { height: 1, backgroundColor: colors.border, marginTop: 12, marginBottom: 9 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footLeft: { flex: 1 },
  picks: { fontSize: 12, color: colors.text },
  pickLabel: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  pickVal: { color: colors.textSoft, fontWeight: '700' },
  pickValStrong: { color: colors.text, fontWeight: '900' },
  pickDot: { color: colors.border },
  await: { color: colors.textMuted, fontSize: 11, fontWeight: '700', fontStyle: 'italic' },
  refresh: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border },
  refreshTxt: { color: colors.textSoft, fontSize: 11, fontWeight: '800' },
  coverWarn: { marginTop: 8, backgroundColor: colors.warningSoft, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: colors.warning },
  coverWarnTxt: { color: '#7a4a00', fontSize: 10.5, fontWeight: '800', lineHeight: 14 },
});
