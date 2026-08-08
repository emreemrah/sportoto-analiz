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
import InfoIpucu from './InfoIpucu';
import { colors, spacing, radius } from '../theme';
import { DNA_PERIODS } from '../radarScreenData';
import { DNA_SUZGEC_MODLARI, MAC_LIMITLERI, suzgecModuMu, TOLERANS } from '../radar/oynanmaSuzgeci';

// OYNANMA YÜZDESİ KAYNAKLARI — uygulama marka kimliğini HİÇ GÖRMEZ.
//
// Uygulama bahis sitesi tanıtımı yapamaz (yasal + mağaza kısıtı). Bu yüzden:
//  * Arka uç kaynak kimliğini API sınırında NÖTR KODA çevirir (k1/k2/…) —
//    bkz. backend/src/providers/kaynakKodu.js. Marka adı ne yanıtta ne burada.
//  * Kullanıcı kaynakları RENK ADIYLA görür; maç satırında renkli nokta durur.
//
// EŞLEME SABİT (k1 sarı · k2 turuncu · k3 yeşil): aynı kaynak her hafta aynı
// kod ve aynı renk olmalı, yoksa kullanıcı haftalar arasında kıyas yapamaz.
const PROVIDER_NAMES = {
  k1: 'Sarı kaynak', k2: 'Turuncu kaynak', k3: 'Yeşil kaynak',
  k4: 'Mor kaynak', k5: 'Mavi kaynak', k0: 'Kaynak',
};

export const PROVIDER_COLORS = {
  k1: '#E8B923',   // sarı
  k2: '#E8792B',   // turuncu
  k3: '#2FA96B',   // yeşil
  k4: '#7A6FF0',   // mor
  k5: '#3B82F6',   // mavi
  k0: '#9AA3AF',   // bilinmeyen kaynak — gri
};

// ESKİ SUNUCU KORUMASI. Arka uç kimliği koda çeviriyor, AMA yayına alınmamış
// bir sunucu hâlâ ham kimlik gönderebilir. Bu eşleme onu koda çevirir; hem
// doğru renk çıkar hem marka adı ekrana ULAŞAMAZ.
const ESKI_KIMLIKLER = { nesine: 'k1', misli: 'k2', bilyoner: 'k3', oley: 'k4', iddaa: 'k5' };

/**
 * Gelen kaynak anahtarını GÜVENLİ koda çevirir.
 * Tanınmayan her değer 'k0' olur — ham değer ASLA geri döndürülmez.
 */
export const kaynakKodu = (s) => {
  const k = String(s ?? '').trim();
  if (PROVIDER_NAMES[k]) return k;
  return ESKI_KIMLIKLER[k.toLowerCase()] || 'k0';
};

// DİKKAT — burada "|| s" YAZILAMAZ. Eski hâli tanınmayan anahtarı OLDUĞU GİBİ
// basıyordu; sunucu ham kimlik gönderince ekranda marka adı çıktı. Bilinmeyen
// kaynak "Kaynak" olarak görünür, kimliği asla sızmaz.
export const providerLabel = (s) => PROVIDER_NAMES[kaynakKodu(s)];
export const providerColor = (s) => PROVIDER_COLORS[kaynakKodu(s)];

/**
 * SEÇİLİ GÜNÜN ÇEKİM SAATİ — "bu günün sayıları kaynaktan kaçta alındı".
 *
 * İLK SÜRÜM YANLIŞTI: haftanın EN SON çekimini yazıyordu ("Son güncelleme:
 * 22:39"). Kullanıcı Pazar sekmesine bakarken Pazartesi'nin saatini görüyordu
 * ve haklı olarak "ne alaka" dedi. Ekranda TEK GÜN görünür; o yüzden buradaki
 * saat de SEÇİLİ GÜNE ait olmalı.
 *
 * Saat SUNUCUDA İstanbul'a çevrilir (`days[].lastObservedLabel`); cihazın saat
 * dilimi yanlışsa burada yanlış saat görünmesin diye biçimlendirme yapılmaz.
 * O gün gözlem alınmamışsa saat UYDURULMAZ, sebebi yazılır.
 */
function GunCekimBilgisi({ data, day }) {
  const d = (data?.days || []).find((x) => x.date === day);
  if (!d || d.future) return null;          // gelecek günde çekim beklenmez
  return (
    <Text style={styles.tabBannerAge}>
      {d.label} · {d.lastObservedLabel
        ? `kaynaktan son çekim ${d.lastObservedLabel}`
        : 'bu gün için kayıt alınamadı'}
    </Text>
  );
}

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
            {/* Alt satır: tarih + O GÜNÜN son çekim saati. Her gün ayrı
                mühürlendiği için her günün kendi tazeliği vardır — Salı
                23:52'de kapanmış, Çarşamba 14:03'te susmuş olabilir. Saat
                yoksa (o gün gözlem alınamamış) "· yok" yazar; uydurulmaz. */}
            <Text style={[styles.oddsChipSub, on && styles.dnaPeriodTxtOn]}>
              {(day.label.split(' ')[1] || '')}
              {day.lastObservedLabel ? ` · ${day.lastObservedLabel}` : (has ? '' : ' · yok')}
            </Text>
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
  macLimiti, onSelectMacLimiti, suzgecAcik = false,
  muhurluHafta, muhurluRadar5Yok, meta,
}) {
  if (!centerMode || tab === 'master') return null;

  // RADAR 4 — ORAN TAKİBİ: gün filtreleri (Pazar→Cuma) + Radar 3/4 ayrımı.
  if (tab === 'market') {
    const dd = dailyOdds;
    return (
      <View>
        {/* MOBİL SADELİK (2026-08-06): açıklamalar ⓘ arkasında — yer kaplamaz. */}
        <InfoIpucu
          ozet="💹 Oran Takibi · Günlük 1/X/2 Oranları"
          detay={'Gerçek 1/X/2 maç oranlarının gün gün hareketi. Bir gün seçin; 15 maçın o güne ait mühürlü oranı kendi satırında görünür (ör. 1: 1.61 · X: 3.20 · 2: 4.25). Oran bir önceki güne göre yükseldi (▲), düştü (▼) veya sabit (=) olarak işaretlenir.\n\nRadar 3 (Oynanma DNA) kullanıcıların oynama YÜZDESİNİ, Radar 4 ise gerçek 1/X/2 ORANINI gösterir — burada yüzde değil, oran vardır.\n\nHer günün oranı 23:55\'te (maç günü ilk maçtan 5 dk önce) mühürlenir ve sonradan değişmez.'}
        />
        {dd?.days?.length ? (
          <>
            <DayChipsRow data={dd} selected={oddsDay} onSelect={onSelectOddsDay} />
            <OddsCounter data={dd} day={oddsDay} />
            <GunCekimBilgisi data={dd} day={oddsDay} />
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
        {/* MOBİL SADELİK (2026-08-06): açıklamalar ⓘ arkasında. VERİ YOKLUĞU
            notu ⓘ DIŞINDA görünür kalır — dürüstlük kuralı gizlenmez. */}
        <InfoIpucu
          ozet="📊 Oynanma DNA · Günlük 1/X/2 Yüzdeleri"
          detay={'Kullanıcıların 1/X/2 OYNAMA YÜZDESİNİN gün gün değişimi. Bir gün seçin; 15 maçın o güne ait mühürlü yüzdesi kendi satırında görünür (ör. 1 %62 · X %21 · 2 %17). Yüzde bir önceki güne göre yükseldi (▲), düştü (▼) veya sabit (=) olarak işaretlenir.\n\nBu bir ORAN değildir — Radar 4 (Oran Takibi) gerçek oranı gösterir; Radar 3 oynanma yüzdesidir.\n\nHer günün yüzdesi 23:55\'te (maç günü ilk maçtan 5 dk önce) mühürlenir ve sonradan değişmez. Kaynak yoksa uydurma yüzde gösterilmez.'}
        />
        {dp && !dp.sources?.length ? (
          <Text style={styles.dnaHint}>Kaynak yok — veri bekleniyor (uydurma yüzde gösterilmez).</Text>
        ) : null}
        {/* KAYNAK LEJANTI eskiden kaldırılmıştı; VERİ YOKLUĞU notu yukarıda
            GÖRÜNÜR duruyor (ⓘ'ye saklanmaz — dürüstlük kuralı). */}
        {dp?.days?.length ? (
          <>
            <DayChipsRow data={dp} selected={playedDay} onSelect={onSelectPlayedDay} />
            {/* Çekim saati çiplerin ALTINDA: hangi güne ait olduğu ancak gün
                seçildikten sonra anlamlı. Başlıkta dururken haftanın en son
                saatini gösteriyordu ve seçili günle ilgisizdi. */}
            <GunCekimBilgisi data={dp} day={playedDay} />
          </>
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
    // ÜST SATIR = HAFTA penceresi + (varsa) süzgeç modları.
    // ALT SATIR = MAÇ sayısı; YALNIZ süzgeç modunda görünür.
    // İki satırın BİRİMİ FARKLIDIR (hafta ≠ maç) — bu yüzden alt satır ayrı
    // görünür ve altındaki ipucu farkı açıkça yazar. Aynı görünen iki şerit
    // sessizce yanlış okunur.
    const suzgecte = suzgecAcik && suzgecModuMu(dnaPeriod);
    const ustCipler = suzgecAcik ? [...DNA_PERIODS, ...DNA_SUZGEC_MODLARI] : DNA_PERIODS;
    return (
      <View style={styles.dnaFilterWrap}>
        <View style={styles.dnaFilterRow}>
          {ustCipler.map((p) => {
            const on = dnaPeriod === p.k;
            return (
              // ÇİP YALNIZ FİLTREDİR. Üzerinde "· %66.7" ve eğilim oku (▲▼—)
              // duruyordu; kullanıcı kararıyla kaldırıldı ("dönem başarısı kafa
              // karıştırıyor"). Aynı sayı maç satırında da tekrarlanıyordu.
              <TouchableOpacity key={p.k} onPress={() => onSelectDnaPeriod(p.k)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${p.label} — dönem filtresi${on ? ' (seçili)' : ''}`}
                style={[styles.dnaPeriodChip, on && styles.dnaPeriodChipOn]} activeOpacity={0.85}>
                <Text style={[styles.dnaPeriodTxt, on && styles.dnaPeriodTxtOn]}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {suzgecte ? (
          <>
            {/* Dar ekranda taşmasın diye SARMALI (flexWrap) — çip sayısı
                arttıkça alt satıra iner, hiçbir çip ekran dışında kalmaz. */}
            <View style={[styles.dnaFilterRow, styles.dnaLimitRow]}>
              {MAC_LIMITLERI.map((p) => {
                const on = macLimiti === p.k;
                return (
                  <TouchableOpacity key={p.k} onPress={() => onSelectMacLimiti(p.k)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${p.label} — kaç geçmiş maç alınacağı${on ? ' (seçili)' : ''}`}
                    style={[styles.dnaPeriodChip, styles.dnaLimitChip, on && styles.dnaPeriodChipOn]} activeOpacity={0.85}>
                    <Text style={[styles.dnaPeriodTxt, on && styles.dnaPeriodTxtOn]}>{p.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {/* BİRİM FARKI AÇIKÇA YAZILIR + modun ne yaptığı tek cümlede. */}
            <Text style={styles.dnaHint}>
              {dnaPeriod === 'oynanmaYuzdesi'
                ? `Üst satır HAFTA, alt satır MAÇ sayar. Her sıra için bu haftanın oynanma yüzdesine ±${TOLERANS} puan yakın geçmiş maçlar süzülür; yüzdeler yalnız o maçlardan hesaplanır.`
                : 'Üst satır HAFTA, alt satır MAÇ sayar. Geçmiş maçların ORANI arşivde yok — bu modda yüzde hesaplanmaz, satırlar bunu yazar.'}
            </Text>
          </>
        ) : null}
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
    // MOBİL SADELİK (2026-08-06): açıklama ⓘ arkasında.
    return (
      <InfoIpucu
        ozet="🛡 Rakip Gücü & Saha Performansı"
        detay={'Form, rakibin MAÇ TARİHİNDEKİ ligdeki yerine göre tartılır (bugünkü tablo geçmişe uygulanmaz). Ev sahibi yalnız İÇ SAHA, deplasman yalnız DEPLASMAN maçlarıyla değerlendirilir. Zayıf rakiplere karşı gelen seriler "Şişirilmiş Form", güçlü rakiplere karşı gelenler "Kaliteli Form" olarak etiketlenir; ham form da ayrıca gösterilir — hiçbir veri gizlenmez.'}
      />
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
  // Verinin yaşı — uyarı değil, olgu. Bu yüzden uyarı sarısı değil sönük ton.
  tabBannerAge: { color: colors.textMuted, fontSize: 11, fontWeight: '800', marginTop: 6 },

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
  // ALT SATIR (maç sayısı) üst satırdan GÖRSEL OLARAK ayrılır: içeriden başlar
  // ve çipleri daha küçüktür. Birimi farklı olan iki şerit aynı görünmemeli.
  dnaLimitRow: { marginTop: 6, marginLeft: 10 },
  dnaLimitChip: { paddingHorizontal: 10, paddingVertical: 5, borderStyle: 'dashed' },
  dnaPeriodChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  dnaPeriodChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  dnaPeriodTxt: { color: colors.textSoft, fontSize: 12, fontWeight: '800' },
  dnaPeriodTxtOn: { color: '#fff' },
  dnaHint: { color: colors.textMuted, fontSize: 11.5, lineHeight: 16, marginTop: 8 },

  oddsCount: { color: colors.textMuted, fontSize: 11.5, fontWeight: '700', marginTop: 6, marginBottom: 2 },
  oddsDayRow: { flexDirection: 'row', gap: 6, paddingVertical: 2, marginBottom: spacing.sm },
  oddsChipSub: { color: colors.textMuted, fontSize: 9.5, fontWeight: '700', marginTop: 1 },
  oddsChipEmpty: { opacity: 0.55, borderStyle: 'dashed' },
});
