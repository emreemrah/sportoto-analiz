// ---------------------------------------------------------------------------
// MAÇ RADAR PANELİ — Radar 3 / 4 / 5, YALNIZ BU MAÇ İÇİN (2026-08-07)
// ---------------------------------------------------------------------------
// KULLANICI İSTEĞİ: "Radar 3-4-5'i maç detayına koyalım ama her maçın KENDİ
// sırasını koyacağız." Radar sekmesinde bu üç panel bültenin 15 maçını birden
// listeliyor; maçın içindeyken o kalabalığa gerek yok — tek satır lazım.
//
// NE GÖSTERİR (hepsi mevcut uçlardan, yeni uç açılmadı):
//   • Radar 3 — Oynanma DNA: bu maçın günlük 1/X/2 oynanma yüzdeleri, her
//     kaynak ayrı satır. Kaynak satırına dokununca geçmiş DNA paneli açılır.
//   • Radar 4 — Oran Takibi: bu maçın seçili gündeki mühürlü 1/X/2 oranı ve
//     bir önceki güne göre yönü.
//   • Radar 5 — Bülten DNA: bu maçın BÜLTEN SIRASININ geçmişi (aynı sırada
//     oynanmış maçlar, sonuçlarıyla).
//
// TASARIM KARARI: satırları Radar ekranındaki bileşenlerin AYNISI çizer
// (`RadarDayRows`, `SiraGecmisListesi`). Kopya bileşen yazılmadı; iki ekran
// aynı veriyi farklı gösterirse hangisinin doğru olduğu bilinemez.
//
// DÜRÜSTLÜK: veri yoksa uydurma yüzde/oran yazılmaz; ilgili bölüm sebebini
// yazar. Gelecek gün seçilirse yüzde basılmaz ("bu gün henüz gelmedi").

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView,
} from 'react-native';

import { api } from '../api';
import { colors, spacing, radius } from '../theme';
import { MarketRow, PublicRow } from './RadarDayRows';
import SiraGecmisListesi from './SiraGecmisListesi';

const KISA_GUN = {
  Pazartesi: 'Pzt', Salı: 'Sal', Çarşamba: 'Çar', Perşembe: 'Per',
  Cuma: 'Cum', Cumartesi: 'Cmt', Pazar: 'Paz',
};

/** Gün seçici — Radar ekranındakiyle aynı mantık, dar alana göre kısaltılmış. */
function GunSecici({ gunler, secili, onSec }) {
  if (!gunler?.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.gunSira}>
      {gunler.map((g) => {
        const acik = g.date === secili;
        return (
          <TouchableOpacity
            key={g.date}
            style={[st.gun, acik && st.gunAcik, g.future && st.gunGelecek]}
            onPress={() => onSec(g.date)}
            accessibilityRole="button"
            accessibilityLabel={`${g.weekday || g.date} gününü seç`}
          >
            <Text style={[st.gunTxt, acik && st.gunTxtAcik]}>
              {KISA_GUN[g.weekday] || g.weekday || g.date}
            </Text>
            <Text style={[st.gunAlt, acik && st.gunTxtAcik]}>{(g.date || '').slice(5)}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function Bolum({ baslik, alt, children }) {
  return (
    <View style={st.kart}>
      <Text style={st.baslik}>{baslik}</Text>
      {alt ? <Text style={st.altBaslik}>{alt}</Text> : null}
      {children}
    </View>
  );
}

/**
 * Son (en güncel) veri günü: gelecek olmayan günlerin sonuncusu.
 * Hiç uygun gün yoksa null döner — varsayılan gün UYDURULMAZ.
 */
function sonGun(gunler) {
  const uygun = (gunler || []).filter((g) => !g.future);
  return uygun.length ? uygun[uygun.length - 1].date : ((gunler || [])[0]?.date ?? null);
}

export default function MacRadarPaneli({ m }) {
  const roundId = m?.roundId ?? null;
  const no = m?.no ?? null;

  const [oynanma, setOynanma] = useState({ yukleniyor: true, veri: null, hata: null });
  const [oran, setOran] = useState({ yukleniyor: true, veri: null, hata: null });
  const [siraDna, setSiraDna] = useState({ yukleniyor: true, veri: null, hata: null });
  const [siraMaclari, setSiraMaclari] = useState({ yukleniyor: true, liste: [], hata: null });

  const [oynanmaGun, setOynanmaGun] = useState(null);
  const [oranGun, setOranGun] = useState(null);
  const [acikDna, setAcikDna] = useState(null);   // "<no>|<kaynak>"

  // Radar 3 — günlük oynanma yüzdeleri (yalnız bu maç).
  useEffect(() => {
    let iptal = false;
    if (roundId == null || no == null) return undefined;
    api.radarDailyPlayed(roundId, no)
      .then((d) => {
        if (iptal) return;
        setOynanma({ yukleniyor: false, veri: d, hata: null });
        setOynanmaGun((x) => x || sonGun(d?.days));
      })
      .catch((e) => { if (!iptal) setOynanma({ yukleniyor: false, veri: null, hata: e?.message || 'okunamadı' }); });
    return () => { iptal = true; };
  }, [roundId, no]);

  // Radar 4 — günlük mühürlü oranlar (yalnız bu maç).
  useEffect(() => {
    let iptal = false;
    if (roundId == null || no == null) return undefined;
    api.radarDailyOdds(roundId, no)
      .then((d) => {
        if (iptal) return;
        setOran({ yukleniyor: false, veri: d, hata: null });
        setOranGun((x) => x || sonGun(d?.days));
      })
      .catch((e) => { if (!iptal) setOran({ yukleniyor: false, veri: null, hata: e?.message || 'okunamadı' }); });
    return () => { iptal = true; };
  }, [roundId, no]);

  // Radar 5 — bu SIRANIN bülten DNA'sı + aynı sırada oynanmış geçmiş maçlar.
  useEffect(() => {
    let iptal = false;
    if (roundId == null || no == null) return undefined;
    api.radarPositionDna(roundId)
      .then((d) => { if (!iptal) setSiraDna({ yukleniyor: false, veri: d, hata: null }); })
      .catch((e) => { if (!iptal) setSiraDna({ yukleniyor: false, veri: null, hata: e?.message || 'okunamadı' }); });
    api.radarPositionMatches(no, roundId)
      .then((d) => { if (!iptal) setSiraMaclari({ yukleniyor: false, liste: d?.matches || [], hata: null }); })
      .catch((e) => { if (!iptal) setSiraMaclari({ yukleniyor: false, liste: [], hata: e?.message || 'okunamadı' }); });
    return () => { iptal = true; };
  }, [roundId, no]);

  if (roundId == null || no == null) {
    return (
      <View style={st.kart}>
        <Text style={st.bos}>Bu maç için hafta/sıra bilgisi yok — radar gösterilemez.</Text>
      </View>
    );
  }

  // Satır bileşenlerinin beklediği asgari şekil: { no, home, away }.
  const satir = {
    no,
    home: m?.home?.mediumName || m?.home?.name || 'Ev sahibi',
    away: m?.away?.mediumName || m?.away?.name || 'Deplasman',
  };

  // Radar 5: bu sıranın geçmiş dağılımı (varsa).
  const siraKaydi = (siraDna.veri?.dna?.positions || []).find((p) => Number(p.position) === Number(no)) || null;

  return (
    <View>
      {/* ——— RADAR 3 ——— */}
      <Bolum
        baslik="Radar 3 · Oynanma DNA"
        alt={`${no}. sıra — günlük 1/X/2 oynanma yüzdeleri. Her kaynak ayrı satır; dokununca o kaynağın geçmişi açılır.`}
      >
        {oynanma.yukleniyor ? (
          <ActivityIndicator color={colors.primary} style={st.bekle} />
        ) : oynanma.hata ? (
          <Text style={st.bos}>Oynanma verisi okunamadı: {oynanma.hata}</Text>
        ) : (
          <>
            <GunSecici gunler={oynanma.veri?.days} secili={oynanmaGun} onSec={setOynanmaGun} />
            <PublicRow
              item={satir}
              data={oynanma.veri}
              day={oynanmaGun}
              openKey={acikDna}
              onToggleDna={setAcikDna}
              roundId={roundId}
              tick={0}
            />
          </>
        )}
      </Bolum>

      {/* ——— RADAR 4 ——— */}
      <Bolum
        baslik="Radar 4 · Oran Takibi"
        alt={`${no}. sıra — maç öncesi mühürlenmiş günlük 1/X/2 oranı ve bir önceki güne göre yönü.`}
      >
        {oran.yukleniyor ? (
          <ActivityIndicator color={colors.primary} style={st.bekle} />
        ) : oran.hata ? (
          <Text style={st.bos}>Oran verisi okunamadı: {oran.hata}</Text>
        ) : (
          <>
            <GunSecici gunler={oran.veri?.days} secili={oranGun} onSec={setOranGun} />
            <MarketRow item={satir} data={oran.veri} day={oranGun} />
          </>
        )}
      </Bolum>

      {/* ——— RADAR 5 ——— */}
      <Bolum
        baslik="Radar 5 · Bülten DNA"
        alt={`${no}. sırada geçmişte oynanmış maçlar ve sonuçları. Bu maça değil, BU SIRAYA bakar.`}
      >
        {siraDna.yukleniyor ? (
          <ActivityIndicator color={colors.primary} style={st.bekle} />
        ) : siraDna.hata ? (
          <Text style={st.bos}>Sıra DNA'sı okunamadı: {siraDna.hata}</Text>
        ) : (
          <>
            {(() => {
              // Dağılım TÜM ZAMANLAR penceresinden okunur; örneklem yoksa
              // yüzde YAZILMAZ (0 göstermek "hiç olmamış" demek olurdu).
              const w = siraKaydi?.windows?.allTime || null;
              if (!w || !w.sample) {
                return <Text style={st.bos}>Bu sıra için doğrulanmış geçmiş dağılım yok.</Text>;
              }
              return (
                <View style={st.dagilim}>
                  {['1', 'X', '2'].map((k) => (
                    <View key={k} style={st.dagilimHucre}>
                      <Text style={st.dagilimK}>{k}</Text>
                      <Text style={st.dagilimV}>{w.pct?.[k] == null ? '–' : `%${w.pct[k]}`}</Text>
                    </View>
                  ))}
                  <Text style={st.dagilimNot}>
                    {`${w.sample} sonuçlanmış maç`}
                    {siraKaydi.sampleLabel ? ` · ${siraKaydi.sampleLabel}` : ''}
                  </Text>
                </View>
              );
            })()}
            <SiraGecmisListesi kayit={siraMaclari} />
          </>
        )}
      </Bolum>
    </View>
  );
}

const st = StyleSheet.create({
  kart: {
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  baslik: { color: colors.text, fontSize: 13.5, fontWeight: '900' },
  altBaslik: { color: colors.textMuted, fontSize: 10.5, lineHeight: 14, marginTop: 2, marginBottom: 8 },
  bos: { color: colors.textMuted, fontSize: 11.5, lineHeight: 16 },
  bekle: { marginVertical: 12 },

  gunSira: { gap: 5, paddingBottom: 8 },
  gun: {
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.sm,
    backgroundColor: colors.bgAlt, alignItems: 'center', minWidth: 46,
  },
  gunAcik: { backgroundColor: colors.primary },
  gunGelecek: { opacity: 0.55 },
  gunTxt: { color: colors.textSoft, fontSize: 11, fontWeight: '800' },
  gunTxtAcik: { color: colors.white },
  gunAlt: { color: colors.textMuted, fontSize: 9 },

  dagilim: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  dagilimHucre: {
    backgroundColor: colors.bgAlt, borderRadius: radius.sm,
    paddingHorizontal: 9, paddingVertical: 4, alignItems: 'center', minWidth: 52,
  },
  dagilimK: { color: colors.textMuted, fontSize: 9.5, fontWeight: '900' },
  dagilimV: { color: colors.text, fontSize: 13, fontWeight: '900' },
  dagilimNot: { color: colors.textMuted, fontSize: 10 },
});
