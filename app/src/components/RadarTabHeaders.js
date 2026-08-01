// RADAR SEKME BAŞLIKLARI — Radar 3/4/5 ve performans sekmelerinin üst panelleri.
//
// NEDEN AYRI DOSYA: RadarScreen 1500 satırdı ve bu paneller ekranın ortasında,
// veri çekme mantığıyla iç içe duruyordu. Buradaki bileşenler DURUM TUTMAZ —
// yalnız verilen veriyi çizer. Davranış taşınırken DEĞİŞMEDİ (altın kopya
// testi bunu kanıtlar), yalnız yeri değişti.
//
// Panellerdeki metinler ürünün dürüstlük sözleşmesidir; sadeleştirilmemeli:
//  * Radar 3 (oynanma YÜZDESİ) ile Radar 4 (gerçek ORAN) her panelde ayrı ayrı
//    ayrıştırılır — kullanıcı ikisini karıştırırsa yanlış sonuç çıkarır.
//  * "Mühürlenir ve sonradan değişmez" cümlesi her iki panelde de durur.
//  * Kaynak yoksa uydurma yüzde gösterilmez; bunun söylendiği satır da burada.
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme';
import { DNA_PERIODS } from '../radarScreenData';

// Oynanma yüzdesi sağlayıcı adları (Radar 3 kaynağı = hangi bahis sitesi).
const PROVIDER_NAMES = { nesine: 'Nesine', bilyoner: 'Bilyoner', misli: 'Misli', oley: 'Oley' };
export const providerLabel = (s) => PROVIDER_NAMES[s] || s;

/** Gün çipleri (Pazar→Cuma). Verisi olmayan gün soluk gösterilir, GİZLENMEZ. */
export function DayChipsRow({ data, selected, onSelect }) {
  if (!data?.days?.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.oddsDayRow}>
      {data.days.map((day) => {
        const on = selected === day.date;
        const has = (data.matches || []).some((m) => m.cells?.[day.date]);
        return (
          <TouchableOpacity key={day.date} onPress={() => onSelect(day.date)}
            style={[styles.dnaPeriodChip, on && styles.dnaPeriodChipOn, !has && !on && styles.oddsChipEmpty]} activeOpacity={0.85}>
            <Text style={[styles.dnaPeriodTxt, on && styles.dnaPeriodTxtOn]}>{day.weekday}{day.isMatchDay ? ' ⚽' : ''}</Text>
            <Text style={[styles.oddsChipSub, on && styles.dnaPeriodTxtOn]}>{(day.label.split(' ')[1] || '')}{has ? '' : ' · yok'}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// SAYAÇ (Radar 4): "15 maçın 5'inde oran var". Ekranda TEK GÜN görüldüğü için
// asıl sayı o güne aittir; eksik olanların sebebi kendi satırlarında yazar.
// Sayı arka uçtan gelir (day.withData) — burada uydurulmaz/tahmin edilmez.
export function OddsCounter({ data, day }) {
  const d = (data?.days || []).find((x) => x.date === day);
  const toplam = data?.counts?.total ?? (data?.matches || []).length;
  if (!toplam || !d) return null;
  const varOlan = d.withData ?? (data?.matches || []).filter((m) => m.cells?.[day]).length;
  return (
    <View>
      <Text style={styles.oddsCount}>
        {d.label}: {toplam} maçın {varOlan}'inde oran var
        {varOlan < toplam ? ` · ${toplam - varOlan} maçta yok (sebebi satırında yazıyor)` : ''}
      </Text>
    </View>
  );
}

/**
 * Sekme üst paneli. Master sekmesinde ve Radar Merkezi yokken hiçbir şey
 * çizilmez (null döner) — çağıran tarafta ek koşul gerekmesin diye karar
 * burada verilir.
 */
export default function RadarTabHeader({
  centerMode, tab, masterMatches = [],
  dailyOdds, oddsDay, onSelectOddsDay,
  dailyPlayed, playedDay, onSelectPlayedDay,
  positionDna, dnaPeriod, onSelectDnaPeriod,
  donemGucu = {}, donemEgilimi = {},
  muhurluHafta, muhurluRadar5Yok, meta,
}) {
  if (!centerMode || tab === 'master') return null;

  // RADAR 4 — ORAN TAKİBİ: gün filtreleri (Pazar→Cuma) + Radar 3/4 ayrımı.
  if (tab === 'market') {
    const dd = dailyOdds;
    return (
      <View>
        <View style={styles.tabBanner}>
          <Text style={styles.tabBannerTitle}>💹 Oran Takibi · Günlük 1/X/2 Oranları</Text>
          <Text style={styles.tabBannerTxt}>
            Gerçek 1/X/2 maç oranlarının gün gün hareketi. Bir gün seçin; 15 maçın o güne ait
            mühürlü oranı kendi satırında görünür (ör. 1: 1.61 · X: 3.20 · 2: 4.25). Oran bir önceki güne göre
            yükseldi (▲), düştü (▼) veya sabit (=) olarak işaretlenir.
          </Text>
          <Text style={styles.tabBannerTxt}>
            Radar 3 (Oynanma DNA) kullanıcıların oynama YÜZDESİNİ, Radar 4 ise gerçek 1/X/2 ORANINI
            gösterir — burada yüzde değil, oran vardır.
          </Text>
          <Text style={styles.tabBannerWarn}>Her günün oranı 23:55'te (maç günü ilk maçtan 5 dk önce) mühürlenir ve sonradan değişmez.</Text>
        </View>
        {dd?.days?.length ? (
          <>
            <DayChipsRow data={dd} selected={oddsDay} onSelect={onSelectOddsDay} />
            <OddsCounter data={dd} day={oddsDay} />
          </>
        ) : (
          <Text style={styles.dnaHint}>{dd ? (dd.note || 'Bu hafta için oran kaydı yok.') : 'Oran kayıtları yükleniyor…'}</Text>
        )}
      </View>
    );
  }

  // RADAR 3 — OYNANMA DNA: gün filtreleri (Pazar→Cuma) + günlük mühürlü yüzde.
  if (tab === 'publicBetting') {
    const dp = dailyPlayed;
    return (
      <View>
        <View style={styles.tabBanner}>
          <Text style={styles.tabBannerTitle}>📊 Oynanma DNA · Günlük 1/X/2 Yüzdeleri</Text>
          <Text style={styles.tabBannerTxt}>
            Kullanıcıların 1/X/2 OYNAMA YÜZDESİNİN gün gün değişimi. Bir gün seçin; 15 maçın o güne ait mühürlü
            yüzdesi kendi satırında görünür (ör. 1 %62 · X %21 · 2 %17). Yüzde bir önceki güne göre yükseldi (▲),
            düştü (▼) veya sabit (=) olarak işaretlenir.
          </Text>
          <Text style={styles.tabBannerTxt}>
            Bu bir ORAN değildir — Radar 4 (Oran Takibi) gerçek oranı gösterir; Radar 3 oynanma yüzdesidir.
          </Text>
          {dp ? (
            <Text style={styles.tabBannerTxt}>
              {dp.sources?.length
                ? `Aktif kaynak: ${dp.sources.map(providerLabel).join(' · ')}${dp.sources.includes('bilyoner') ? '' : ' · Bilyoner erişim engelli (IP/WAF)'} — her maçta kaynaklar ayrı ayrı gösterilir.`
                : 'Aktif kaynak yok — sağlayıcı verisi bekleniyor (uydurma yüzde gösterilmez).'}
            </Text>
          ) : null}
          <Text style={styles.tabBannerWarn}>Her günün yüzdesi 23:55'te (maç günü ilk maçtan 5 dk önce) mühürlenir ve sonradan değişmez. Kaynak yoksa uydurma yüzde gösterilmez.</Text>
        </View>
        {dp?.days?.length ? (
          <DayChipsRow data={dp} selected={playedDay} onSelect={onSelectPlayedDay} />
        ) : (
          <Text style={styles.dnaHint}>{dp ? (dp.note || 'Oynanma yüzdesi gözlemi yok — veri kaynağı bekleniyor.') : 'Yükleniyor…'}</Text>
        )}
      </View>
    );
  }

  const items = masterMatches.map((mm) => mm.radars?.[tab]).filter(Boolean);
  const anyData = items.some((r) => r.hasData);

  if (tab === 'bulletinMemory') {
    // MÜHÜRLÜ HAFTA: dönem filtresi GÖSTERİLMEZ. Filtre canlı yeniden hesap
    // demektir; mühürlü haftada tek doğru kaynak snapshot'taki dondurulmuş
    // değerdir. Yalnız hangi ana ait olduğu yazılır.
    if (muhurluHafta && !positionDna?.dna) {
      return (
        <View style={styles.dnaFilterWrap}>
          <Text style={styles.dnaHint}>
            {muhurluRadar5Yok
              ? 'Bu hafta için mühürlü Radar 5 kaydı yok.'
              : `Mühürlü kayıt — bu hafta donduğu andaki değerler${meta?.sealedAt ? ` (${String(meta.sealedAt).slice(0, 10)})` : ''}. Sonradan gelen sonuçlar bu ekranı değiştirmez.`}
          </Text>
        </View>
      );
    }
    // SADE MAÇ ODAKLI GÖRÜNÜM: üstte yalnız küçük dönem filtresi. Sıra
    // yüzdeleri her maçın kendi kartında görünür. Teknik bilgiler (n, arşiv
    // sayısı, shrinkage) ana ekranda YOK — yalnız metodolojide.
    return (
      <View style={styles.dnaFilterWrap}>
        <View style={styles.dnaFilterRow}>
          {DNA_PERIODS.map((p) => {
            const on = dnaPeriod === p.k;
            return (
              <TouchableOpacity key={p.k} onPress={() => onSelectDnaPeriod(p.k)}
                style={[styles.dnaPeriodChip, on && styles.dnaPeriodChipOn]} activeOpacity={0.85}>
                <View style={styles.dnaPeriodLabel}>
                  <Text style={[styles.dnaPeriodTxt, on && styles.dnaPeriodTxtOn]}>
                    {p.label}{donemGucu[p.k] != null ? ` · %${donemGucu[p.k]}` : ''}
                  </Text>
                  {donemEgilimi[p.k] ? (
                    <Text style={[
                      styles.dnaTrend,
                      donemEgilimi[p.k].key === 'up' && styles.dnaTrendUp,
                      donemEgilimi[p.k].key === 'down' && styles.dnaTrendDown,
                      donemEgilimi[p.k].key === 'flat' && styles.dnaTrendFlat,
                    ]}>{donemEgilimi[p.k].symbol}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        {positionDna && !positionDna.hasData ? (
          <Text style={styles.dnaHint}>
            {positionDna.note || 'Resmî geçmiş arşiv birikiyor — veri geldikçe sıra yüzdeleri görünür.'}
          </Text>
        ) : null}
        {positionDna?.retrospective ? (
          <Text style={styles.dnaHint}>
            Simülasyon: bu hafta için resmî mühür yok. Hesap yalnız bu haftadan önce tamamlanmış sonuçlardan üretildi.
          </Text>
        ) : null}
      </View>
    );
  }

  if (tab === 'performance' && anyData) {
    return (
      <View style={styles.tabBanner}>
        <Text style={styles.tabBannerTitle}>🛡 Rakip Gücü & Saha Performansı</Text>
        <Text style={styles.tabBannerTxt}>
          Form, rakibin MAÇ TARİHİNDEKİ ligdeki yerine göre tartılır (bugünkü tablo geçmişe uygulanmaz).
          Ev sahibi yalnız İÇ SAHA, deplasman yalnız DEPLASMAN maçlarıyla değerlendirilir. Zayıf rakiplere karşı
          gelen seriler "Şişirilmiş Form", güçlü rakiplere karşı gelenler "Kaliteli Form" olarak etiketlenir;
          ham form da ayrıca gösterilir — hiçbir veri gizlenmez.
        </Text>
      </View>
    );
  }

  if (!anyData) {
    return (
      <View style={styles.tabBanner}>
        <Text style={styles.tabBannerTitle}>— Bu radar bu hafta devre dışı</Text>
        <Text style={styles.tabBannerTxt}>{items[0]?.note || 'Gerekli veri bulunamadı; skora katkısı yok.'}</Text>
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  tabBanner: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  tabBannerTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  tabBannerTxt: { color: colors.textSoft, fontSize: 11.5, lineHeight: 16, marginTop: 4 },
  tabBannerWarn: { color: colors.warning, fontSize: 11, fontWeight: '800', marginTop: 6, fontStyle: 'italic' },

  // YAPIŞIK BAŞLIK ZEMİNİ: bu panel FlatList'te stickyHeaderIndices ile üstte
  // sabit kalıyor (bkz. RadarScreen). Zemin verilmezse altından kayan maç
  // satırları filtre çiplerinin arasından görünür ve ikisi iç içe okunur.
  dnaFilterWrap: {
    marginBottom: spacing.sm,
    backgroundColor: colors.bg,
    paddingTop: 2,
    paddingBottom: 6,
  },
  dnaFilterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dnaPeriodChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  dnaPeriodChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  dnaPeriodLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dnaPeriodTxt: { color: colors.textSoft, fontSize: 12, fontWeight: '800' },
  dnaPeriodTxtOn: { color: '#fff' },
  dnaTrend: { fontSize: 11, fontWeight: '900' },
  dnaTrendUp: { color: colors.success },
  dnaTrendDown: { color: colors.danger },
  dnaTrendFlat: { color: colors.warning },
  dnaHint: { color: colors.textMuted, fontSize: 11.5, lineHeight: 16, marginTop: 8 },

  oddsCount: { color: colors.textMuted, fontSize: 11.5, fontWeight: '700', marginTop: 6, marginBottom: 2 },
  oddsDayRow: { flexDirection: 'row', gap: 6, paddingVertical: 2, marginBottom: spacing.sm },
  oddsChipSub: { color: colors.textMuted, fontSize: 9.5, fontWeight: '700', marginTop: 1 },
  oddsChipEmpty: { opacity: 0.55, borderStyle: 'dashed' },
});
