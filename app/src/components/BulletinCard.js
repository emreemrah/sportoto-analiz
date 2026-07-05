import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme';
import { Pill, ProgressBar } from '../ui';
import { BULLETIN_STATUS, BULLETIN_STATUS_LABEL } from '../types/bulletin';
import { matchDate } from '../utils';

const STATUS_TONE = {
  [BULLETIN_STATUS.DRAFT]: 'default',
  [BULLETIN_STATUS.ACTIVE]: 'info',
  [BULLETIN_STATUS.LOCKED]: 'warning',
  [BULLETIN_STATUS.COMPLETED]: 'success',
  [BULLETIN_STATUS.CANCELLED]: 'danger',
};

// Geçmiş Bültenler listesindeki kart: durum, tarih, kaç maç oynandı, sistem
// başarı oranı ve (varsa) kullanıcının o bültendeki kupon sonucu.
export default function BulletinCard({ bulletin, onPress }) {
  const d = matchDate(bulletin.date);
  const total = bulletin.matches.length;
  const finished = bulletin._finishedCount ?? 0;
  const rs = bulletin.resultSummary;
  const myCoupon = bulletin.myCoupon;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.topRow}>
        <Text style={styles.no}>Bülten {bulletin.bulletinNo}</Text>
        <Pill label={BULLETIN_STATUS_LABEL[bulletin.status]} tone={STATUS_TONE[bulletin.status] || 'default'} />
      </View>

      <Text style={styles.date}>{d.day}{d.time ? ` · ${d.time}` : ''}</Text>

      <View style={styles.metaRow}>
        <Text style={styles.meta}>{finished}/{total} maç oynandı</Text>
        {bulletin.lockedAt ? <Text style={styles.meta}> · Kilit: {matchDate(bulletin.lockedAt).day}</Text> : null}
      </View>

      {rs ? (
        <View style={styles.rsBox}>
          <View style={styles.rsHead}>
            <Text style={styles.rsLabel}>Sistem başarısı</Text>
            <Text style={styles.rsValue}>%{rs.systemAccuracy} ({rs.systemCorrect}/{rs.resolvedCount})</Text>
          </View>
          <ProgressBar value={rs.systemAccuracy} tone={rs.systemAccuracy >= 60 ? 'success' : rs.systemAccuracy >= 40 ? 'warning' : 'danger'} />
        </View>
      ) : (
        <Text style={styles.noResult}>Henüz sonuç yok</Text>
      )}

      {myCoupon?.resultSummary ? (
        <Text style={styles.coupon}>🎟️ Kuponum: {myCoupon.resultSummary.correct}/{myCoupon.resultSummary.total} doğru</Text>
      ) : myCoupon ? (
        <Text style={styles.couponPending}>🎟️ Kuponum kayıtlı · sonuç bekleniyor</Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  no: { color: colors.text, fontSize: 15, fontWeight: '800' },
  date: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 4 },
  metaRow: { flexDirection: 'row', gap: 4, marginTop: 6 },
  meta: { color: colors.textMuted, fontSize: 11.5, fontWeight: '600' },
  rsBox: { marginTop: 10 },
  rsHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  rsLabel: { color: colors.textMuted, fontSize: 11.5, fontWeight: '700' },
  rsValue: { color: colors.text, fontSize: 11.5, fontWeight: '800' },
  noResult: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic', marginTop: 10 },
  coupon: { color: colors.green, fontSize: 12.5, fontWeight: '800', marginTop: 8 },
  couponPending: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 8 },
});
