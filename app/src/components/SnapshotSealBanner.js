// app/src/components/SnapshotSealBanner.js
// Bülten ekranındaki mühür durumu şeridi (mevcut banner dilinde, kompakt):
//  * Aktif:      "Analizler {tarih saat} itibarıyla kilitlenecek" + geri sayım
//  * Kilitli:    "Mühürlü Analiz" + kilit zamanı + değiştirilemezlik + kısa hash
//  * Tamamlandı: mühür bilgisi + arşiv notu
// Veri backend arşivinden gelir (data.archive); arşiv yoksa hiçbir şey çizmez.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';
import { matchDate } from '../utils';

function remainingText(ms) {
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d} gün ${h} sa`;
  if (h > 0) return `${h} sa ${m} dk`;
  if (m > 0) return `${m} dk ${String(sec).padStart(2, '0')} sn`;
  return `${sec} sn`;
}

export default function SnapshotSealBanner({ archive }) {
  const freezeAtMs = archive?.freezeAt ? new Date(archive.freezeAt).getTime() : null;
  const [now, setNow] = useState(Date.now());

  const counting = !!(archive && !archive.immutable && freezeAtMs && freezeAtMs > now);
  useEffect(() => {
    if (!counting) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [counting]);

  if (!archive) return null;

  // 1) MÜHÜRLÜ (kilitli/tamamlanmış): değiştirilemezlik + doğrulama hash'i.
  if (archive.immutable && archive.snapshot?.exists) {
    const lockD = archive.lockedAt ? matchDate(archive.lockedAt) : null;
    const doneD = archive.completedAt ? matchDate(archive.completedAt) : null;
    return (
      <View style={[styles.wrap, styles.sealed]}>
        <Text style={styles.sealedTitle}>
          🔏 Mühürlü Analiz{lockD ? ` · ${lockD.day} ${lockD.time}` : ''}
        </Text>
        <Text style={styles.sealedTxt}>
          Bu bültenin tahmin ve analizleri kilitlendi; hiçbir şekilde değiştirilemez.
          {archive.snapshot.late ? ' (Mühür, sunucu yeniden açıldığında alındı — veri anı kayıtlıdır.)' : ''}
        </Text>
        <Text style={styles.hashTxt}>
          Doğrulama: #{archive.snapshot.shortHash || '—'}
          {archive.status === 'completed' && doneD ? ` · Tamamlandı: ${doneD.day}` : ''}
        </Text>
      </View>
    );
  }

  // 2) AKTİF + kilit zamanı belli: geri sayım.
  if (freezeAtMs) {
    const d = matchDate(archive.freezeAt);
    const left = remainingText(freezeAtMs - now);
    return (
      <View style={[styles.wrap, styles.counting]}>
        <Text style={styles.countTitle}>
          🔒 Analizler {d.day} {d.time} itibarıyla kilitlenecek
        </Text>
        <Text style={styles.countTxt}>
          {left
            ? `Kalan süre: ${left} · Kilitten sonra tahmin/analiz değişmez, arşive mühürlenir.`
            : 'Kilit zamanı geldi — analizler mühürleniyor…'}
        </Text>
        {archive.dataGaps?.length ? (
          <Text style={styles.gapTxt}>⚠ {archive.dataGaps.length} maçta veri eksik — eksikler snapshot’a "veri yok" olarak yazılır.</Text>
        ) : null}
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  counting: { borderColor: colors.warning, backgroundColor: colors.warningSoft || 'rgba(245,158,11,0.08)' },
  sealed: { borderColor: colors.success || colors.green, backgroundColor: 'rgba(34,197,94,0.08)' },
  countTitle: { color: colors.text, fontSize: 12.5, fontWeight: '800' },
  countTxt: { color: colors.textMuted, fontSize: 11.5, marginTop: 2, lineHeight: 15 },
  gapTxt: { color: colors.warning, fontSize: 11, marginTop: 4, fontWeight: '700' },
  sealedTitle: { color: colors.success || colors.green, fontSize: 12.5, fontWeight: '900' },
  sealedTxt: { color: colors.textMuted, fontSize: 11.5, marginTop: 2, lineHeight: 15 },
  hashTxt: { color: colors.textMuted, fontSize: 10.5, marginTop: 4, fontFamily: undefined, fontWeight: '700' },
});
