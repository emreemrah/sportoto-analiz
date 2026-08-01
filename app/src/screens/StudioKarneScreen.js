// YAYIN STÜDYOSU · GEÇMİŞ HAFTA KARNESİ — "geçen hafta ne oldu, kaç tuttu?"
//
// NE YAPAR: Yayıncı bir sonraki haftanın yayınını yaparken buraya bakar.
// Solda maç maç tablo (o hafta ne işaretlemişti, resmen ne çıktı, tuttu mu),
// sağda haftanın karnesi (15'te kaç), resmî ikramiye tablosu ve haftalar
// arası birikimli durum. Üstteki hafta şeridinden geçmiş haftalar arasında
// gezilir; seçimler cihazda saklı olduğu için kayıt haftadan haftaya durur.
//
// GÖRÜNÜM: Ana bülten ekranıyla AYNI resmî tablo düzeni (studioTheme).
//
// KESİN KURALLAR:
//  • Bu ekran HESAP YAPMAZ. Bütün sayılar studioKarne.js'ten hazır gelir.
//  • YALNIZ RESMÎ SPOR TOTO SONUCU KESİNDİR. Canlı/geçici skor ekranda
//    "geçici" etiketiyle yalnız BİLGİ olarak görünür; tuttu sayısına GİRMEZ.
//  • UYDURMA YOK: ikramiye gelmemişse sıfır yazılmaz, "bekleniyor" denir.
//    Seçim yoksa yanlış sayılmaz, "seçim yapılmadı" denir.
//  • Sayının neyi ölçtüğü saklanmaz: kapalı (1-0-2) işaretlenen maç sayısı
//    ayrıca yazılır, yüzdenin paydası her zaman görünür.
//  • Kupon bedeli / maliyet YOK — resmî birim bedel elimizde değil, uydurulmaz.
//  • KİŞİSEL VERİ YOK: bu ekran yayında görünür; yalnız hafta, maç ve işaret.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, useWindowDimensions,
} from 'react-native';

import { api } from '../api';
import { getPicks, getStudioRounds, subscribeStudio } from '../broadcastStudioStore';
import {
  buildKarneRows, karneSummaryOf, prizeRowsOf, hasPrize, cumulativeOf,
  KARNE_DURUM,
} from '../studioKarne';
import {
  S, R, SP, TABLE, T, NARROW_MAX, SIDEBAR_MIN, scaleFor,
} from '../studioTheme';
import { fontOf, useStudioFontReady, TABULAR } from '../studioFonts';
import {
  StudioHeader, HeaderButton, TeamCrest, Chip, Etiket,
  StudioState, LegalStrip,
} from './studioParts';

/** Durum → renk. Renk KESİNLİK anlamı taşımaz; yalnız satırı okunur kılar. */
const DURUM_TON = {
  [KARNE_DURUM.tuttu]: { ink: S.good, soft: S.goodSoft, im: '✓' },
  [KARNE_DURUM.tutmadi]: { ink: S.bad, soft: S.badSoft, im: '✕' },
  [KARNE_DURUM.bekliyor]: { ink: S.warn, soft: S.warnSoft, im: '…' },
  [KARNE_DURUM.secimYok]: { ink: S.inkDim, soft: S.panel3, im: '–' },
};
const tonOf = (durum) => DURUM_TON[durum] || DURUM_TON[KARNE_DURUM.secimYok];

export default function StudioKarneScreen({ navigation }) {
  const [haftalar, setHaftalar] = useState(null);   // [{roundId, rows, summary, prize, hata}]
  const [secili, setSecili] = useState(null);       // roundId
  const [error, setError] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const { width } = useWindowDimensions();
  const k = scaleFor(width);
  const t = T(k);
  const f = useStudioFontReady();
  const dar = width <= NARROW_MAX;
  const yanyana = width >= SIDEBAR_MIN;

  /* ————— veri ————— */
  // Hafta listesi CİHAZDAN gelir: yalnız gerçekten seçim yapılmış haftalar.
  // Seçim yapılmamış haftaya karne yazılmaz — boş hafta başarı gibi görünmesin.
  const yukle = useCallback(async () => {
    setYukleniyor(true);
    setError(null);
    try {
      const kayitli = getStudioRounds();
      if (!kayitli.length) { setHaftalar([]); setYukleniyor(false); return; }

      const sonuc = await Promise.all(kayitli.map(async (h) => {
        try {
          const hist = await api.history(h.roundId);
          const rows = buildKarneRows({ matches: hist?.matches, picks: getPicks(h.roundId) });
          return { roundId: h.roundId, rows, summary: karneSummaryOf(rows), prize: hist?.prize || null, hata: null };
        } catch (e) {
          // Bir hafta gelmezse diğerleri yine gösterilir; o hafta "alınamadı" der.
          return { roundId: h.roundId, rows: [], summary: karneSummaryOf([]), prize: null, hata: e?.message || 'Hafta alınamadı.' };
        }
      }));

      setHaftalar(sonuc);
      // Varsayılan: resmî sonucu gelmiş EN YENİ hafta. Yayıncı "Karne"ye
      // basınca çoğunlukla geçen haftayı görmek ister; henüz oynanmamış
      // haftayı açmak boş tablo gösterir.
      setSecili((onceki) => {
        if (onceki != null && sonuc.some((w) => w.roundId === onceki)) return onceki;
        const dolu = sonuc.find((w) => w.summary.resmiGelen > 0);
        return (dolu || sonuc[0])?.roundId ?? null;
      });
    } catch (e) {
      setError(e?.message || 'Karne hazırlanamadı.');
    }
    setYukleniyor(false);
  }, []);

  useEffect(() => { yukle(); }, [yukle]);
  // Başka ekranda seçim değişirse (maç detayı) karne de tazelenir.
  useEffect(() => subscribeStudio(() => { yukle(); }), [yukle]);

  const hafta = useMemo(
    () => (haftalar || []).find((w) => w.roundId === secili) || null,
    [haftalar, secili],
  );
  const birikim = useMemo(() => cumulativeOf(haftalar || []), [haftalar]);
  const ikramiye = useMemo(() => prizeRowsOf(hafta?.prize), [hafta]);

  /* ————— gezinme ————— */
  const cikis = useCallback(() => {
    if (navigation?.canGoBack?.()) navigation.goBack();
    else navigation?.navigate?.('Home');
  }, [navigation]);

  const ustDugmeler = (
    <>
      <HeaderButton k={k} text="Bülten" onPress={() => navigation?.navigate?.('StudioBulletin')} label="Bu haftanın bülteni" />
      <HeaderButton k={k} text="⟳" onPress={yukle} label="Yenile" testID="studio-karne-refresh" />
    </>
  );

  /* ————— durumlar ————— */
  if (error) {
    return (
      <View style={st.root}>
        <StudioHeader k={k} onExit={cikis} right={ustDugmeler} />
        <StudioState title="Karne alınamadı" text={error} actionLabel="Tekrar Dene" onAction={yukle} />
        <View style={st.bottom}><LegalStrip /></View>
      </View>
    );
  }
  if (yukleniyor && !haftalar) {
    return (
      <View style={st.root}>
        <StudioHeader k={k} onExit={cikis} />
        <StudioState title="Karne hazırlanıyor…" text="Geçmiş haftaların resmî sonuçları alınıyor." />
        <View style={st.bottom}><LegalStrip /></View>
      </View>
    );
  }
  if (haftalar && !haftalar.length) {
    return (
      <View style={st.root} testID="studio-karne-root">
        <StudioHeader k={k} onExit={cikis} right={ustDugmeler} />
        <StudioState
          title="Henüz karne yok"
          text={'Karne, stüdyoda işaretlediğin haftalardan oluşur. Bu cihazda seçim yapılmış '
            + 'bir hafta bulunmuyor; geçmişe dönük karne üretilmez. Bültende maçları işaretle, '
            + 'resmî sonuçlar geldiğinde bu ekranda maç maç görünür.'}
          actionLabel="Bültene Dön"
          onAction={() => navigation?.navigate?.('StudioBulletin')}
        />
        <View style={st.bottom}><LegalStrip /></View>
      </View>
    );
  }

  /* ————— HAFTA ŞERİDİ ————— */
  const seritler = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={st.serit}
      testID="studio-karne-weeks"
    >
      {(haftalar || []).map((w) => {
        const on = w.roundId === secili;
        return (
          <TouchableOpacity
            key={w.roundId}
            onPress={() => setSecili(w.roundId)}
            style={[st.seritBtn, on && st.seritBtnOn]}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`Hafta ${w.roundId} karnesi`}
            testID={`studio-karne-week-${w.roundId}`}
          >
            <Text style={[st.seritTxt, on && st.seritTxtOn, fontOf(700, f), TABULAR, { fontSize: t.metin }]}>
              {w.roundId}
            </Text>
            <Text style={[st.seritAlt, on && st.seritAltOn, fontOf(500, f), { fontSize: t.mikro }]}>
              {w.hata ? 'alınamadı' : w.summary.sayilan ? w.summary.skorText : 'bekliyor'}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  /* ————— MAÇ MAÇ TABLO ————— */
  const tablo = (
    <View style={st.tablo} testID="studio-karne-table">
      <View style={[st.thead, { height: Math.round(TABLE.headH * k) }]}>
        <Th text="SIRA" k={k} style={{ width: Math.round(42 * k) }} center />
        {!dar ? <Th text="TARİH" k={k} style={{ width: Math.round(70 * k) }} /> : null}
        <Th text="EV SAHİBİ - KONUK TAKIM" k={k} style={{ flex: 1, minWidth: 0 }} />
        {!dar ? <Th text="SKOR" k={k} style={{ width: Math.round(58 * k) }} center /> : null}
        {/* Telefonda başlıklar hücreye sığmıyordu ("SON…", "İŞARET…"). Kırpılmış
            başlık sütunun neyi gösterdiğini saklar; bu yüzden dar ekranda başlık
            kısaltılır ve tam adı ekran okuyucuya verilir. */}
        <Th text={dar ? 'RESMÎ' : 'SONUÇ'} tam="Resmî sonuç" k={k} style={{ width: Math.round((dar ? 46 : 54) * k) }} center />
        <Th text={dar ? 'İŞARET' : 'İŞARETİN'} tam="Senin işaretin" k={k} style={{ width: Math.round((dar ? 56 : 78) * k) }} center />
        <Th text={dar ? '' : 'DURUM'} tam="Durum" k={k} style={{ width: Math.round((dar ? 26 : 122) * k) }} center />
      </View>

      {hafta?.hata ? (
        <Text style={[st.bosSatir, fontOf(400, f), { fontSize: t.metin }]}>
          Bu haftanın resmî verisi alınamadı: {hafta.hata}
        </Text>
      ) : null}

      {!hafta?.hata && !hafta?.rows?.length ? (
        <Text style={[st.bosSatir, fontOf(400, f), { fontSize: t.metin }]}>
          Bu hafta için maç listesi bulunamadı. Veri olmadan satır üretilmez.
        </Text>
      ) : null}

      {(hafta?.rows || []).map((r, i) => (
        <Satir key={r.no} r={r} k={k} dar={dar} zebra={i % 2 === 1} />
      ))}

      <Text style={[st.tfoot, fontOf(400, f), { fontSize: t.kucuk }]}>
        İşaretler bu cihazda saklanır. Bir maç ancak resmî 1-0-2 sonucu ve skoru
        birlikte geldiğinde karneye girer; oynanmış ama resmî sonucu gelmemiş maç
        "resmî sonuç bekleniyor" sayılır ve geçici skor tuttu sayısına yazılmaz.
      </Text>
    </View>
  );

  /* ————— SAĞ PANEL ————— */
  const ozet = hafta ? (
    <View style={[st.yan, yanyana && { width: Math.round(288 * k) }]}>
      {/* 1) HAFTANIN KARNESİ — "15'te X" */}
      <View style={st.kutu} testID="studio-karne-summary">
        <View style={st.kutuBas}><Etiket k={k} text={`HAFTA ${hafta.roundId} KARNESİ`} color={S.headInk} /></View>
        <View style={st.kutuGovde}>
          <Text
            style={[st.buyukSayi, fontOf(700, f), TABULAR, { fontSize: Math.round(30 * k) }]}
            testID="studio-karne-score"
          >
            {hafta.summary.skorText}
          </Text>
          <Text style={[st.buyukAlt, fontOf(500, f), { fontSize: t.kucuk }]}>
            {hafta.summary.yuzde != null
              ? `${hafta.summary.yuzde}% · ${hafta.summary.sayilan} maç üzerinden`
              : 'Oran hesaplanmadı'}
          </Text>

          <View style={st.ayirici} />

          <Satirci k={k} label="Tuttu" value={String(hafta.summary.tuttu)} tone={S.good} />
          <Satirci k={k} label="Tutmadı" value={String(hafta.summary.tutmadi)} tone={S.bad} />
          <Satirci k={k} label="Resmî sonuç bekleniyor" value={String(hafta.summary.bekliyor)} tone={S.warn} />
          <Satirci k={k} label="Seçim yapılmadı" value={String(hafta.summary.secimYok)} tone={S.inkDim} />

          <View style={st.ayirici} />

          <Satirci k={k} label="Tek işaretli" value={kirilimText(hafta.summary.kindKirilim.tek)} tone={S.ink} />
          <Satirci k={k} label="Çift işaretli" value={kirilimText(hafta.summary.kindKirilim.cift)} tone={S.ink} />
          <Satirci k={k} label="Kapalı (1-0-2)" value={kirilimText(hafta.summary.kindKirilim.kapali)} tone={S.ink} />

          <Text style={[st.not, fontOf(400, f), { fontSize: t.mikro }]}>{hafta.summary.not}</Text>
          {hafta.summary.kapaliNot ? (
            <Text style={[st.notUyari, fontOf(500, f), { fontSize: t.mikro }]} testID="studio-karne-kapali-note">
              {hafta.summary.kapaliNot}
            </Text>
          ) : null}
        </View>
      </View>

      {/* 2) RESMÎ İKRAMİYE TABLOSU */}
      <View style={st.kutu} testID="studio-karne-prize">
        <View style={st.kutuBas}><Etiket k={k} text="RESMÎ İKRAMİYE" color={S.headInk} /></View>
        <View style={st.kutuGovde}>
          {hasPrize(hafta.prize) ? (
            <>
              {ikramiye.map((p) => (
                <View key={p.hitText} style={st.ikSatir}>
                  <Text style={[st.ikBil, fontOf(700, f), TABULAR, { fontSize: t.metin }]}>{p.hitText}</Text>
                  <Text style={[st.ikKisi, fontOf(500, f), TABULAR, { fontSize: t.kucuk }]}>{p.countText}</Text>
                  <View style={{ flex: 1 }} />
                  <Text
                    style={[
                      st.ikTutar, fontOf(700, f), TABULAR,
                      { fontSize: t.metin, color: p.devretti ? S.accent : S.ink },
                    ]}
                  >
                    {p.prizeText}
                  </Text>
                </View>
              ))}
              {hafta.prize?.description ? (
                <Text style={[st.not, fontOf(400, f), { fontSize: t.mikro }]}>{hafta.prize.description}</Text>
              ) : null}
              <Text style={[st.not, fontOf(400, f), { fontSize: t.mikro }]}>
                Tutarlar resmî Spor Toto verisinden gelir; burada hesaplanmaz.
                Kolon bedeli ve kupon maliyeti gösterilmez.
              </Text>
            </>
          ) : (
            <Text style={[st.not, fontOf(400, f), { fontSize: t.kucuk }]}>
              Bu haftanın resmî ikramiye bilgisi henüz gelmedi. Gelmeden tutar
              yazılmaz; sıfır da gösterilmez.
            </Text>
          )}
        </View>
      </View>

      {/* 3) HAFTALAR ARASI BİRİKİMLİ KARNE */}
      <View style={st.kutu} testID="studio-karne-cumulative">
        <View style={st.kutuBas}><Etiket k={k} text="BİRİKİMLİ KARNE" color={S.headInk} /></View>
        <View style={st.kutuGovde}>
          <Satirci k={k} label="Kayıtlı hafta" value={`${birikim.hafta}`} tone={S.ink} />
          <Satirci k={k} label="Tamamlanan hafta" value={`${birikim.tamHafta}`} tone={S.ink} />
          <Satirci
            k={k}
            label="Toplam tuttu"
            value={birikim.sayilan ? `${birikim.tuttu}/${birikim.sayilan}` : '—'}
            tone={S.good}
            guclu
          />
          <Satirci k={k} label="Oran" value={birikim.yuzde != null ? `%${birikim.yuzde}` : '—'} tone={S.ink} />
          <Satirci
            k={k}
            label="Hafta ortalaması"
            value={birikim.ortalama != null ? String(birikim.ortalama) : '—'}
            tone={S.ink}
          />
          {birikim.enIyi ? (
            <Satirci
              k={k}
              label="En iyi hafta"
              value={`${birikim.enIyi.roundId} · ${birikim.enIyi.skorText}`}
              tone={S.info}
            />
          ) : null}
          <Text style={[st.not, fontOf(400, f), { fontSize: t.mikro }]}>{birikim.not}</Text>
          {birikim.kapaliNot ? (
            <Text style={[st.notUyari, fontOf(500, f), { fontSize: t.mikro }]}>{birikim.kapaliNot}</Text>
          ) : null}
        </View>
      </View>
    </View>
  ) : null;

  return (
    <View style={st.root} testID="studio-karne-root">
      <StudioHeader
        k={k}
        onExit={cikis}
        line={`Geçmiş hafta karnesi · ${(haftalar || []).length} kayıtlı hafta`}
        right={ustDugmeler}
      />

      <View style={st.seritSarma}>{seritler}</View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[st.body, { paddingHorizontal: yanyana ? SP.lg : SP.sm }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[st.stage, { maxWidth: 1240 }, yanyana && st.stageRow]}>
          {yanyana ? null : ozet}
          <View style={{ flex: 1, minWidth: 0 }}>{tablo}</View>
          {yanyana ? ozet : null}
        </View>
      </ScrollView>

      <View style={st.bottom}>
        <LegalStrip extra="Yalnız resmî Spor Toto sonucu kesindir." />
      </View>
    </View>
  );
}

/* ————————————————————————— PARÇALAR ————————————————————————— */

/** "3/4" — kaç tanesi tuttu / kaç tanesi sayıldı. Sayılmayan varsa "—". */
function kirilimText(x) {
  if (!x || !x.sayilan) return '—';
  return `${x.tuttu}/${x.sayilan}`;
}

/** `tam`: dar ekranda kısaltılan başlığın ekran okuyucuya giden tam adı. */
function Th({ text, k, style, center = false, tam }) {
  const f = useStudioFontReady();
  return (
    <View style={[st.th, style, center && { alignItems: 'center' }]} accessibilityLabel={tam || text || undefined}>
      <Text style={[st.thTxt, fontOf(600, f), { fontSize: T(k).mikro }]} numberOfLines={1}>{text}</Text>
    </View>
  );
}

function Satirci({ label, value, tone = S.ink, k, guclu = false }) {
  const f = useStudioFontReady();
  const t = T(k);
  return (
    <View style={st.ozetSatir}>
      <Text style={[st.ozetLbl, fontOf(500, f), { fontSize: t.metin }]} numberOfLines={1}>{label}</Text>
      <View style={{ flex: 1 }} />
      <Text
        style={[st.ozetVal, fontOf(guclu ? 700 : 600, f), TABULAR, { color: tone, fontSize: guclu ? t.buyuk : t.orta }]}
      >
        {value}
      </Text>
    </View>
  );
}

/* ————————————————————————— SATIR ————————————————————————— */

function Satir({ r, k, dar, zebra }) {
  const f = useStudioFontReady();
  const t = T(k);
  const ton = tonOf(r.durum);
  const armaBoy = Math.round(17 * k);

  return (
    <View
      style={[st.tr, { minHeight: Math.round(TABLE.rowH * k) }, zebra && st.trZebra]}
      testID={`studio-karne-row-${r.no}`}
    >
      {/* SIRA */}
      <View style={[st.td, st.tdCenter, { width: Math.round(42 * k) }]}>
        <Text style={[st.sira, fontOf(700, f), TABULAR, { fontSize: t.orta }]}>{r.order}</Text>
      </View>

      {/* TARİH */}
      {!dar ? (
        <View style={[st.td, { width: Math.round(70 * k) }]}>
          <Text style={[st.zaman, fontOf(500, f), TABULAR, { fontSize: t.kucuk }]} numberOfLines={1}>
            {r.dateText || '—'}
          </Text>
          {r.dayText ? (
            <Text style={[st.zamanAlt, fontOf(400, f), { fontSize: t.mikro }]} numberOfLines={1}>{r.dayText}</Text>
          ) : null}
        </View>
      ) : null}

      {/* TAKIMLAR */}
      <View style={[st.td, st.tdMac]}>
        <View style={st.macSatir}>
          <TeamCrest uri={r.homeLogo} size={armaBoy} />
          <Text style={[st.takim, fontOf(600, f), { fontSize: t.orta }]} numberOfLines={1}>{r.home || '—'}</Text>
          <Text style={[st.tire, fontOf(400, f), { fontSize: t.kucuk }]}>-</Text>
          <Text style={[st.takim, fontOf(600, f), { fontSize: t.orta }]} numberOfLines={1}>{r.away || '—'}</Text>
          <TeamCrest uri={r.awayLogo} size={armaBoy} />
        </View>
        <View style={st.macAlt}>
          {dar && r.scoreText ? (
            <Text style={[st.altBilgi, fontOf(600, f), TABULAR, { color: S.ink, fontSize: t.mikro }]}>
              {r.scoreText}
            </Text>
          ) : null}
          {r.league ? (
            <Text style={[st.altBilgi, fontOf(400, f), { fontSize: t.mikro }]} numberOfLines={1}>{r.league}</Text>
          ) : null}
          {/* GEÇİCİ SKOR yalnız bilgi: resmî sonuç yokken oynanan maçın durumu.
              Karneye girmez, bu yüzden ayrı etiketle ve nötr renkle yazılır. */}
          {!r.official && r.provisional ? (
            <Text style={[st.altBilgi, fontOf(500, f), { color: S.warn, fontSize: t.mikro }]} numberOfLines={1}>
              {r.provisional.text} · {r.provisional.live ? 'canlı, resmî değil' : 'geçici, resmî değil'}
            </Text>
          ) : null}
          {dar ? (
            <Text style={[st.altBilgi, fontOf(500, f), { color: ton.ink, fontSize: t.mikro }]} numberOfLines={1}>
              {r.durumText}
            </Text>
          ) : null}
        </View>
      </View>

      {/* SKOR (resmî) */}
      {!dar ? (
        <View style={[st.td, st.tdCenter, { width: Math.round(58 * k) }]}>
          <Text style={[st.skor, fontOf(700, f), TABULAR, { fontSize: t.orta }]} numberOfLines={1}>
            {r.scoreText || '—'}
          </Text>
        </View>
      ) : null}

      {/* RESMÎ SONUÇ */}
      <View style={[st.td, st.tdCenter, { width: Math.round((dar ? 46 : 54) * k) }]}>
        <View style={[st.sonucKutu, r.officialText ? st.sonucVar : null]}>
          <Text style={[st.sonucTxt, fontOf(700, f), TABULAR, { fontSize: t.orta }]}>
            {r.officialText || '—'}
          </Text>
        </View>
      </View>

      {/* YAYINCININ İŞARETİ */}
      <View style={[st.td, st.tdCenter, { width: Math.round((dar ? 56 : 78) * k) }]}>
        <Text
          style={[st.isaret, fontOf(600, f), TABULAR, { fontSize: t.metin, color: r.pickText ? S.ink : S.inkDim }]}
          numberOfLines={1}
        >
          {r.pickText || '—'}
        </Text>
        {!dar && r.kindText ? (
          <Text style={[st.isaretAlt, fontOf(400, f), { fontSize: t.mikro }]}>{r.kindText}</Text>
        ) : null}
      </View>

      {/* DURUM */}
      <View style={[st.td, st.tdCenter, { width: Math.round((dar ? 26 : 122) * k) }]}>
        {dar ? (
          <Text
            style={[st.durumIm, fontOf(700, f), { color: ton.ink, fontSize: t.orta }]}
            accessibilityLabel={r.durumText}
          >
            {ton.im}
          </Text>
        ) : (
          // Hücrede KISA etiket yazar (uzunu kırpılıyordu); tam metni ekran
          // okuyucu okur. Kırpılmış "Resmî sonuç beklen…" yanlış anlaşılabilirdi.
          <View accessibilityLabel={r.durumText}>
            <Chip text={r.durumKisa} tone={ton.ink} soft={ton.soft} k={k} />
          </View>
        )}
      </View>
    </View>
  );
}

/* ————————————————————————— STİL ————————————————————————— */

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: S.bg },
  body: { paddingTop: SP.md, paddingBottom: SP.xl, alignItems: 'center' },
  stage: { width: '100%', gap: SP.md },
  stageRow: { flexDirection: 'row', alignItems: 'flex-start' },

  /* — hafta şeridi — */
  seritSarma: {
    backgroundColor: S.panel, borderBottomWidth: TABLE.hair, borderBottomColor: S.line,
  },
  serit: { gap: SP.xs, paddingHorizontal: SP.md, paddingVertical: SP.sm, alignItems: 'center' },
  seritBtn: {
    minWidth: 58, paddingHorizontal: SP.md, paddingVertical: 5, borderRadius: R.sm,
    borderWidth: TABLE.hair, borderColor: S.lineStrong, backgroundColor: S.panel2,
    alignItems: 'center',
  },
  seritBtnOn: { backgroundColor: S.head, borderColor: S.head },
  seritTxt: { color: S.ink },
  seritTxtOn: { color: S.headInk },
  seritAlt: { color: S.inkDim, marginTop: 1 },
  seritAltOn: { color: '#C9D4DE' },

  /* — tablo — */
  tablo: {
    backgroundColor: S.panel, borderWidth: TABLE.hair, borderColor: S.line, borderRadius: R.md,
    overflow: 'hidden',
  },
  thead: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: S.head,
    borderBottomWidth: TABLE.hair, borderBottomColor: S.head,
  },
  th: { paddingHorizontal: TABLE.cellPadX, justifyContent: 'center' },
  thTxt: { color: S.headInk, letterSpacing: 0.7, textTransform: 'uppercase' },

  tr: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: TABLE.hair, borderBottomColor: S.lineSoft,
  },
  trZebra: { backgroundColor: S.panel2 },
  td: { paddingHorizontal: TABLE.cellPadX, paddingVertical: SP.xs, justifyContent: 'center' },
  tdCenter: { alignItems: 'center' },
  tdMac: { flex: 1, minWidth: 0 },

  sira: { color: S.inkSoft },
  zaman: { color: S.ink },
  zamanAlt: { color: S.inkDim },
  skor: { color: S.ink },

  macSatir: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 0 },
  takim: { color: S.ink, flexShrink: 1 },
  tire: { color: S.inkDim, marginHorizontal: 1 },
  macAlt: { flexDirection: 'row', alignItems: 'center', gap: SP.sm, flexWrap: 'wrap' },
  altBilgi: { color: S.inkDim },

  sonucKutu: {
    minWidth: 26, paddingHorizontal: 5, paddingVertical: 1, borderRadius: R.sm,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: TABLE.hair, borderColor: S.lineSoft, backgroundColor: S.panel3,
  },
  sonucVar: { backgroundColor: S.infoSoft, borderColor: S.infoSoft },
  sonucTxt: { color: S.ink },

  isaret: {},
  isaretAlt: { color: S.inkDim },
  durumIm: {},

  bosSatir: {
    color: S.inkSoft, paddingHorizontal: TABLE.cellPadX, paddingVertical: SP.lg, lineHeight: 19,
  },
  tfoot: {
    color: S.inkDim, lineHeight: 16, paddingHorizontal: TABLE.cellPadX,
    paddingVertical: SP.sm, backgroundColor: S.panel2,
  },

  /* — sağ panel — */
  yan: { width: '100%', gap: SP.md },
  kutu: {
    backgroundColor: S.panel, borderWidth: TABLE.hair, borderColor: S.line, borderRadius: R.md,
    overflow: 'hidden',
  },
  kutuBas: {
    backgroundColor: S.head, paddingHorizontal: SP.md, paddingVertical: SP.sm, justifyContent: 'center',
  },
  kutuGovde: { padding: SP.md, gap: SP.sm },

  buyukSayi: { color: S.ink },
  buyukAlt: { color: S.inkSoft, marginTop: -2 },

  ayirici: { height: TABLE.hair, backgroundColor: S.lineSoft, marginVertical: 1 },
  ozetSatir: { flexDirection: 'row', alignItems: 'center' },
  ozetLbl: { color: S.inkSoft, flexShrink: 1 },
  ozetVal: {},

  ikSatir: { flexDirection: 'row', alignItems: 'baseline', gap: SP.sm },
  ikBil: { color: S.ink, minWidth: 64 },
  ikKisi: { color: S.inkDim },
  ikTutar: {},

  not: { color: S.inkDim, lineHeight: 14 },
  notUyari: { color: S.warn, lineHeight: 14 },

  bottom: {
    borderTopWidth: TABLE.hair, borderTopColor: S.line, backgroundColor: S.panel,
    paddingHorizontal: SP.md, paddingVertical: 7,
  },
});
