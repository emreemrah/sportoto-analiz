import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme';
import { matchDate } from '../utils';

const OPTIONS = ['1', 'X', '2'];

// Kupon Oluştur ekranındaki satır: kullanıcı 1/X/2 seçer, yanında küçük olarak
// sistem önerisi + güven + sürpriz riski görünür.
export default function CouponMatchRow({ match, analysis, value, onChange, disabled }) {
  const d = matchDate(match.startTime);
  return (
    <View style={styles.row}>
      <View style={styles.head}>
        <Text style={styles.no}>{match.orderNo}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.teams} numberOfLines={1}>{match.homeTeam.name} - {match.awayTeam.name}</Text>
          <Text style={styles.meta} numberOfLines={1}>{match.league} · {d.day} {d.time}</Text>
        </View>
      </View>

      <View style={styles.pickRow}>
        {OPTIONS.map((opt) => {
          const active = value === opt;
          return (
            <TouchableOpacity
              key={opt}
              disabled={disabled}
              style={[styles.pickBtn, active && styles.pickBtnOn, disabled && styles.pickBtnOff]}
              onPress={() => onChange(opt)}
              activeOpacity={0.8}
            >
              <Text style={[styles.pickTxt, active && styles.pickTxtOn]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
        {analysis && (
          <View style={styles.sysBox}>
            <Text style={styles.sysLabel} numberOfLines={1}>Sistem: <Text style={styles.sysVal}>{analysis.prediction}</Text></Text>
            <Text style={styles.sysLabel} numberOfLines={1}>Güven %{analysis.confidenceScore} · Sürpriz %{analysis.surpriseRisk}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  no: { width: 20, textAlign: 'center', color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  teams: { color: colors.text, fontSize: 14, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  pickBtn: { width: 40, height: 36, borderRadius: 8, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgAlt },
  pickBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  pickBtnOff: { opacity: 0.5 },
  pickTxt: { color: colors.text, fontSize: 14, fontWeight: '900' },
  pickTxtOn: { color: colors.bg },
  sysBox: { marginLeft: 8, flex: 1 },
  sysLabel: { color: colors.textMuted, fontSize: 10.5, fontWeight: '700' },
  sysVal: { color: colors.text, fontWeight: '900' },
});
