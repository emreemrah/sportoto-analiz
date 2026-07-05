// Maç bilgi kartı (detay/Özet): bayrak + lig + lig haftası, tarih·gün·saat,
// hava, stadyum. Yalnız GERÇEK veri gösterilir; olmayan satır hiç çizilmez
// (uydurma yok). Veri kaynağı: backend m.info (+ m.league, m.date).
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, shadow } from '../theme';
import { countryFlag } from '../utils';

const WEEKDAY = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const AY = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

export default function MatchInfoCard({ m }) {
  const info = m?.info || {};
  const league = m?.league || '';
  const flag = countryFlag(info.country) || '';
  const leagueShort = info.country && league.startsWith(info.country) ? league.slice(info.country.length).trim() : league;
  const leagueText = [leagueShort, info.leagueWeek ? `${info.leagueWeek}. Hafta` : null].filter(Boolean).join(' · ');

  const d = m?.date ? new Date(m.date) : null;
  const valid = d && !Number.isNaN(d.getTime());
  const p = (n) => String(n).padStart(2, '0');
  const dateText = valid ? `${d.getDate()} ${AY[d.getMonth()]} ${d.getFullYear()}, ${WEEKDAY[d.getDay()]} · ${p(d.getHours())}:${p(d.getMinutes())}` : '';

  const rows = [];
  if (leagueText) rows.push({ icon: flag || '🏆', text: leagueText, strong: true });
  if (dateText) rows.push({ icon: '🕐', text: dateText });
  if (info.weather) rows.push({ icon: info.weather.emoji || '🌡️', text: `${info.weather.label} · ${info.weather.tempC}°C` });
  if (info.stadium) rows.push({ icon: '🏟️', text: info.city ? `${info.stadium}, ${info.city}` : info.stadium });

  if (!rows.length) return null;

  return (
    <View style={s.card}>
      {rows.map((r, i) => (
        <View key={i} style={[s.row, i > 0 && s.rowBorder]}>
          <Text style={s.icon}>{r.icon}</Text>
          <Text style={[s.text, r.strong && s.textStrong]} numberOfLines={1}>{r.text}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, marginBottom: spacing.md, ...shadow.soft },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  icon: { fontSize: 15, width: 22, textAlign: 'center' },
  text: { flex: 1, color: colors.textSoft, fontSize: 12.5, fontWeight: '700' },
  textStrong: { color: colors.text, fontSize: 13, fontWeight: '800' },
});
