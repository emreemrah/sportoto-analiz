// PAYLAŞILAN CANLI YAPI — sade maç kartı listesi. Hem "Canlı" hem "Bülten"
// ekranında AYNI yapı için kullanılır.
// ÜST ÇUBUK KALDIRILDI (kullanıcı isteği): ayar düğmesi + ayar paneli, sayaç
// kutuları (Canlı/Başlamadı/Sonuç Bekleniyor/Biten/Kupon Riskte/Sistem Riskte)
// ve filtre çipleri artık yok — ekran sade, liste bülten sırasında akar.
// Skor renk açıklaması KALIR: "yalnız resmi sonuç kesindir" kuralının görsel
// anahtarıdır (🟢 resmi · 🟡 henüz resmi değil · 🔴 canlı).
// Veri çekme/teyit kilidi/polling ÜST ekranda; bu bileşen sadece görünüm+etkileşim.
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';
import { getPref } from '../prefs';
import { deriveStatus } from '../liveLogic';
import LiveMatchCard from './LiveMatchCard';
import { api } from '../api';
import ScoreLegend from './ScoreLegend';

function sortList(list, sort) {
  const arr = [...list];
  const byNo = (a, b) => a.no - b.no;
  if (sort === 'liveTop') {
    const w = (m) => { const st = deriveStatus(m); return st === 'live' ? 0 : st === 'awaiting' || st === 'suspended' ? 1 : st === 'finished' ? 3 : 2; };
    return arr.sort((a, b) => w(a) - w(b) || byNo(a, b));
  }
  if (sort === 'doneBottom') {
    const w = (m) => (deriveStatus(m) === 'finished' ? 1 : 0);
    return arr.sort((a, b) => w(a) - w(b) || byNo(a, b));
  }
  return arr.sort(byNo);
}

export default function LiveBulletinView({ matches = [], onCardPress, onRefresh, subtitle, userPicks = {} }) {
  // TOPLULUK MS DAĞILIMI — 15 maç tek istekte (anonim sayımlar; kişisel veri yok).
  const [community, setCommunity] = useState({});
  useEffect(() => {
    let alive = true;
    const ids = matches.map((m) => m.sportotoMatchId).filter(Boolean).map(String);
    if (!ids.length) { setCommunity({}); return undefined; }
    api.msSummary(ids)
      .then((r) => { if (alive) setCommunity(r?.summary || {}); })
      .catch(() => { /* topluluk verisi süslemedir; kart onsuz da tam çalışır */ });
    return () => { alive = false; };
  }, [matches]);
  const USER_PICKS = userPicks;
  // Görünüm tercihleri kayıtlıdan okunur (bu ekranda ayar arayüzü yok).
  const sort = getPref('liveSort');
  const anim = getPref('liveAnim');

  const liste = useMemo(() => sortList(matches, sort), [matches, sort]);

  const Head = (
    <View>
      {subtitle ? (
        <View style={s.barRow}>
          <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text>
        </View>
      ) : null}
      <ScoreLegend />
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={liste}
        keyExtractor={(m) => String(m.no)}
        renderItem={({ item }) => (
          <LiveMatchCard match={item} userPick={USER_PICKS[item.no] || null} anim={anim} onPress={() => onCardPress && onCardPress(item.no)} onRefresh={onRefresh} community={community[String(item.sportotoMatchId)] || null} />
        )}
        ListHeaderComponent={Head}
        contentContainerStyle={s.listPad}
        ListEmptyComponent={<Text style={s.empty}>Bu bültende maç yok.</Text>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  barRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  subtitle: { flex: 1, color: colors.textMuted, fontSize: 11.5, fontWeight: '700' },

  listPad: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  empty: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 30 },
});
