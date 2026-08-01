// YAYIN STÜDYOSU — MAÇ DETAYI (canlı yayında tek maçın anlatıldığı ekran).
//
// SIRA (yayıncının istediği düzen):
//   1) YATAY ŞERİT — sola kaydırmalı bölümler:
//      Sportoto Liste · Rakip Gücü · xG · Oynanma Oranı · Oran · Bülten Sırası DNA · İstatistik
//      (önce radarlar, en sonda detaylı istatistik)
//   2) Motor okuması (tahminsiz — yalnız ölçülen gözlemler)
//   3) Yayıncı notu
//   1-0-2 seçimi hem üstte hem altta yapılabilir ve ANA LİSTEYE yansır.
//
// KURALLAR:
//  • Bu ekran HESAP YAPMAZ. Bütün sayılar broadcastStudio.js'ten gelir.
//  • Veri yoksa "bulunamadı" yazılır; sahte sayı/renk üretilmez.
//  • Kilitli maçta seçim kutuları pasiftir (kilit tek kaynaktan gelir).
//  • Kişisel veri yoktur: ekran yalnız bülteni ve yayıncının kendi seçimini bilir.
//  • HÜKÜM YOK: "Risk Yorumu" paneli, risk/belirsizlik seviye rozetleri ve
//    "Risk sinyali" çipi KALDIRILDI (yayıncı isteği). Ölçüm broadcastStudio.js'te
//    durur ama yayıncı modunda çizilmez — maçı yayıncı yorumlar, ekran değil.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, useWindowDimensions,
} from 'react-native';

import { api } from '../api';   // api.js'te DEFAULT dışa aktarım yok — adlı alınır.
import {
  STUDIO_SECTIONS, buildStudioRows,
  radarViewOf, listViewOf, statsViewOf, sectionStates,
  officialText, KIND_LABEL, nextUnpicked,
} from '../broadcastStudio';
import { OUTCOMES } from '../couponConfig';
import {
  getPicks, getNotes, togglePick, setNote, publishLocks, subscribeStudio, NOTE_MAX,
} from '../broadcastStudioStore';
import { S, R, SP, T, ETIKET, scaleFor, NARROW_MAX } from '../studioTheme';
import { fontOf, useStudioFontReady, TABULAR } from '../studioFonts';
import {
  StudioHeader, PickBoxes, Chip, Bar, Panel, StudioState, LegalStrip,
} from './studioParts';

/* ————————————————————— küçük yardımcılar (yalnız GÖRSEL) ————————————————————— */

const FORM_TONE = { G: S.good, B: S.warn, M: S.bad };

function FormStrip({ form, k }) {
  const hazir = useStudioFontReady();
  if (!form?.length) return null;
  const d = Math.round(18 * k);
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {form.slice(0, 5).map((s, i) => (
        <View key={i} style={[st.formBox, { backgroundColor: FORM_TONE[s] || S.line, width: d, height: d }]}>
          <Text style={[st.formTxt, fontOf(700, hazir), { fontSize: T(k).kucuk }]}>{s}</Text>
        </View>
      ))}
    </View>
  );
}

/** İki taraflı ölçü satırı: solda ev, sağda deplasman. Sayı yoksa satır çizilmez. */
function DuoRow({ label, home, away, suffix = '', k }) {
  const f = useStudioFontReady();
  const t = T(k);
  const h = typeof home === 'number' && Number.isFinite(home) ? home : null;
  const a = typeof away === 'number' && Number.isFinite(away) ? away : null;
  if (h == null && a == null) return null;
  const top = Math.max(h ?? 0, a ?? 0) || 1;
  return (
    <View style={st.duo}>
      {/* Sayılar eşit genişlikli rakamla: iki satır alt alta gelince sütun kaymaz. */}
      <Text style={[st.duoVal, fontOf(700, f), TABULAR, { fontSize: t.metin }]}>{h != null ? `${h}${suffix}` : '—'}</Text>
      <View style={st.duoMid}>
        <Text style={[st.duoLbl, fontOf(500, f), { fontSize: t.kucuk }]} numberOfLines={1}>{label}</Text>
        <View style={st.duoBars}>
          <View style={st.duoBarL}>
            <View style={{ width: `${((h ?? 0) / top) * 100}%`, height: 5, backgroundColor: S.info, borderRadius: 3 }} />
          </View>
          <View style={st.duoBarR}>
            <View style={{ width: `${((a ?? 0) / top) * 100}%`, height: 5, backgroundColor: S.accent, borderRadius: 3 }} />
          </View>
        </View>
      </View>
      <Text style={[st.duoVal, fontOf(700, f), TABULAR, { fontSize: t.metin, textAlign: 'right' }]}>{a != null ? `${a}${suffix}` : '—'}</Text>
    </View>
  );
}

/** Bölümde veri yoksa: sebebiyle birlikte yazılır. Boş kutu bırakılmaz. */
function Bos({ text, k }) {
  const f = useStudioFontReady();
  return <Text style={[st.bos, fontOf(400, f), { fontSize: T(k).metin }]}>{text}</Text>;
}

/* ————————————————————— BÖLÜM İÇERİKLERİ ————————————————————— */

function ListeBolumu({ row, radarMatch, k }) {
  const f = useStudioFontReady();
  const t = T(k);
  const v = listViewOf(row, radarMatch);
  const d = Math.round(38 * k);
  return (
    <View style={{ gap: SP.sm }}>
      <View style={st.listeHead}>
        <View style={[st.noBox, { width: d, height: d }]}>
          <Text style={[st.noTxt, fontOf(700, f), TABULAR, { fontSize: t.buyuk }]}>{v.no ?? '—'}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 180 }}>
          <Text style={[st.listeTitle, fontOf(700, f), { fontSize: t.orta }]}>{v.title || 'Maç adı bulunamadı'}</Text>
          <Text style={[st.listeSub, fontOf(400, f), { fontSize: t.kucuk }]}>
            {v.dateText || 'Tarih bulunamadı'}
            {v.dayText ? ` ${v.dayText}` : ''} · {v.timeText || '—'}
            {v.league ? ` · ${v.league}` : ''}
          </Text>
        </View>
      </View>
      {/* NOT: Burada eskiden "Bülten sırası / DİKKAT / Temkinli / 🔒 Kilitli"
          rozet sırası vardı. Üçü de ekranda ZATEN başka yerde yazıyor: sıra
          başlıkta ("MAÇ 5 / 15"), kilit yine başlıkta ("· 🔒 seçim kapalı").
          Aynı bilgiyi ikinci kez, üstelik büyük harfli uyarı gibi göstermek
          yayıncıyı yanıltıyordu — kaldırıldı. */}
      {v.positionNote
        ? <Text style={[st.p, fontOf(400, f), { fontSize: t.metin }]}>• {v.positionNote}</Text>
        : <Bos text={v.positionReason} k={k} />}
    </View>
  );
}

function RadarBolumu({ radarMatch, radarId, k }) {
  const f = useStudioFontReady();
  const t = T(k);
  const v = radarViewOf(radarMatch, radarId);
  if (!v.hasData) return <Bos text={v.reason} k={k} />;
  // SIRA TEK KAYNAKTAN: 1-X-2 dizisi burada ikinci kez yazılmaz; couponConfig'teki
  // kanonik OUTCOMES kullanılır. Yazım ise stüdyonun resmî kolon yazımıdır
  // (beraberlik "0") — üstteki seçim kutularıyla aynı harfler görünür.
  return (
    <View style={{ gap: SP.sm }}>
      {v.scores ? (
        <View style={st.scoreRow}>
          {OUTCOMES.map((o) => (
            <View key={o} style={st.scoreCell}>
              <Text style={[st.scoreSym, fontOf(600, f), ETIKET, { fontSize: t.mikro }]}>{officialText(o)}</Text>
              <Text style={[st.scoreVal, fontOf(700, f), TABULAR, { fontSize: t.buyuk }]}>%{v.scores[o] ?? '—'}</Text>
              <Bar value={v.scores[o]} tone={o === '1' ? S.info : o === 'X' ? S.inkSoft : S.accent} height={5} />
            </View>
          ))}
        </View>
      ) : (
        <Text style={[st.p, fontOf(400, f), { fontSize: t.metin }]}>Bu radar yön puanı üretmez — yardımcı sinyaldir.</Text>
      )}

      {/* "Risk sinyali" ÇİPİ KALDIRILDI (yayıncı isteği): tek bir sayıyla
          maça not veriyordu. Radarın kendi cümleleri aşağıda olduğu gibi
          kalır — yayıncı okur, hükmü kendi verir. */}
      <View style={st.chipRow}>
        {v.dataQuality != null ? <Chip text={`Veri kalitesi %${v.dataQuality}`} tone={S.inkSoft} k={k} /> : null}
        {v.direction ? <Chip text={`Yön: ${officialText(v.direction)}`} tone={S.info} k={k} /> : null}
      </View>

      {v.lines.map((satir, i) => (
        <Text key={i} style={[st.p, fontOf(400, f), { fontSize: t.metin }]}>• {satir}</Text>
      ))}

      {v.publicDna ? (
        <View style={st.dna}>
          <Text style={[st.dnaTxt, fontOf(500, f), { fontSize: t.metin }]}>{v.publicDna.userSentence}</Text>
          {v.publicDna.similarDna?.hasData
            ? <Text style={[st.dnaTxt, fontOf(500, f), { fontSize: t.metin }]}>{v.publicDna.similarDna.sentence}</Text>
            : <Text style={[st.bos, fontOf(400, f), { fontSize: t.kucuk }]}>{v.publicDna.similarDna?.note || 'Benzer sonuç için sistem öğreniyor.'}</Text>}
          {v.publicDna.note ? <Text style={[st.bos, fontOf(400, f), { fontSize: t.kucuk }]}>{v.publicDna.note}</Text> : null}
        </View>
      ) : null}

      {v.missing.length ? (
        <Text style={[st.bos, fontOf(400, f), { fontSize: t.kucuk }]}>Hesaba girmeyen veriler: {v.missing.join(', ')}</Text>
      ) : null}
      {v.note ? <Text style={[st.bos, fontOf(400, f), { fontSize: t.kucuk }]}>{v.note}</Text> : null}
    </View>
  );
}

function IstatistikBolumu({ m, row, k }) {
  const f = useStudioFontReady();
  const t = T(k);
  const v = statsViewOf(m);
  if (!v.hasData) return <Bos text={v.reason} k={k} />;
  const evAd = row?.home || 'Ev sahibi';
  const depAd = row?.away || 'Deplasman';
  const sh = v.standing?.home;
  const sa = v.standing?.away;
  return (
    <View style={{ gap: SP.md }}>
      <View style={st.teamHead}>
        <Text style={[st.teamName, fontOf(700, f), { fontSize: t.orta }]} numberOfLines={1}>{evAd}</Text>
        <Text style={[st.teamVs, fontOf(500, f), { fontSize: t.kucuk }]}>karşı</Text>
        <Text style={[st.teamName, fontOf(700, f), { fontSize: t.orta, textAlign: 'right' }]} numberOfLines={1}>{depAd}</Text>
      </View>

      {v.form ? (
        <View style={st.formRow}>
          <View style={{ flex: 1, gap: SP.xs }}>
            <Text style={[st.miniLbl, fontOf(600, f), { fontSize: t.mikro }]}>Son 5 (genel)</Text>
            <FormStrip form={v.form.home} k={k} />
            {v.form.homeVenue?.length ? (
              <>
                <Text style={[st.miniLbl, fontOf(600, f), { fontSize: t.mikro }]}>Son 5 (iç saha)</Text>
                <FormStrip form={v.form.homeVenue} k={k} />
              </>
            ) : null}
          </View>
          <View style={{ flex: 1, gap: SP.xs, alignItems: 'flex-end' }}>
            <Text style={[st.miniLbl, fontOf(600, f), { fontSize: t.mikro }]}>Son 5 (genel)</Text>
            <FormStrip form={v.form.away} k={k} />
            {v.form.awayVenue?.length ? (
              <>
                <Text style={[st.miniLbl, fontOf(600, f), { fontSize: t.mikro }]}>Son 5 (deplasman)</Text>
                <FormStrip form={v.form.awayVenue} k={k} />
              </>
            ) : null}
          </View>
        </View>
      ) : null}

      {sh || sa ? (
        <View style={{ gap: 2 }}>
          <Text style={[st.miniLbl, fontOf(600, f), { fontSize: t.mikro }]}>Puan durumu</Text>
          <DuoRow label="Sıra" home={sh?.position} away={sa?.position} k={k} />
          <DuoRow label="Puan" home={sh?.points} away={sa?.points} k={k} />
          <DuoRow label="Oynadığı" home={sh?.played} away={sa?.played} k={k} />
          <DuoRow label="Attığı gol" home={sh?.goalsFor} away={sa?.goalsFor} k={k} />
          <DuoRow label="Yediği gol" home={sh?.goalsAgainst} away={sa?.goalsAgainst} k={k} />
          <DuoRow label="Averaj" home={sh?.goalDiff} away={sa?.goalDiff} k={k} />
        </View>
      ) : null}

      {v.xg ? (
        <View style={{ gap: 2 }}>
          <Text style={[st.miniLbl, fontOf(600, f), { fontSize: t.mikro }]}>Beklenen gol (xG)</Text>
          <DuoRow label="xG (attığı)" home={v.xg.homeFor} away={v.xg.awayFor} k={k} />
          <DuoRow label="xGA (yediği)" home={v.xg.homeAgainst} away={v.xg.awayAgainst} k={k} />
        </View>
      ) : null}

      {v.compare.length ? (
        <View style={{ gap: 2 }}>
          <Text style={[st.miniLbl, fontOf(600, f), { fontSize: t.mikro }]}>Maç başına ortalamalar</Text>
          {v.compare.map((r, i) => (
            <DuoRow key={`${r.label}-${i}`} label={r.label} home={r.home} away={r.away} suffix={r.suffix || ''} k={k} />
          ))}
        </View>
      ) : null}

      {v.h2h ? (
        <View style={{ gap: 2 }}>
          <Text style={[st.miniLbl, fontOf(600, f), { fontSize: t.mikro }]}>Karşılıklı geçmiş · {v.h2h.played} maç</Text>
          <DuoRow label="Galibiyet" home={v.h2h.homeWins} away={v.h2h.awayWins} k={k} />
          <Text style={[st.p, fontOf(400, f), { fontSize: t.metin }]}>Beraberlik: {v.h2h.draws ?? '—'}</Text>
        </View>
      ) : null}
    </View>
  );
}

/* ————————————————————————— EKRAN ————————————————————————— */

export default function StudioMatchScreen({ navigation, route }) {
  const roundId = route?.params?.roundId ?? null;
  const no = route?.params?.no ?? null;

  const { width } = useWindowDimensions();
  const k = scaleFor(width);
  const t = T(k);
  const f = useStudioFontReady();
  const dar = width <= NARROW_MAX;

  const [data, setData] = useState(null);
  const [radar, setRadar] = useState(null);
  const [hata, setHata] = useState('');
  const [yukleniyor, setYukleniyor] = useState(true);
  const [aktif, setAktif] = useState(STUDIO_SECTIONS[0].key);
  const [yenile, setYenileme] = useState(0);
  const [notTaslak, setNotTaslak] = useState(null);   // null = depodaki not gösterilir

  const seritRef = useRef(null);
  const seritX = useRef({});           // bölüm anahtarı → yatay konum
  const sayfaRef = useRef(null);       // ana dikey kaydırma

  useEffect(() => subscribeStudio(() => setYenileme((v) => v + 1)), []);

  // MAÇTAN MAÇA GEÇİŞ: "Sıradaki boş maç" aynı ekranın parametresini değiştirir,
  // ekran yeniden KURULMAZ. O yüzden maça özel geçici durum elle sıfırlanır:
  //  • not taslağı — yoksa önceki maçın cümlesi yeni maçın kutusunda görünür ve
  //    yayıncı bir harf yazınca yanlış maça kaydedilirdi.
  //  • kaydırma — yayıncı düğmeye sayfanın altında basar; yeni maç baştan açılır.
  // Seçili bölüm KORUNUR: yayıncı çoğu zaman aynı sekmeyi maç maç izler.
  useEffect(() => {
    setNotTaslak(null);
    sayfaRef.current?.scrollTo({ y: 0, animated: false });
  }, [no]);

  const yukle = useCallback(async () => {
    setYukleniyor(true); setHata('');
    try {
      const b = await api.bulletin();
      // KİLİDİ ÖNCE BİLDİR: bu ekrana doğrudan (bildirimden) da girilebilir;
      // depo kilit anlarını bilmeden başlamış maça yazmayı engelleyemez.
      publishLocks(b?.roundId, b?.matches);
      setData(b);
      // Radar ayrı bir uçtur; hazır değilse ekran YİNE açılır, bölümler
      // "radar kaydı yok" der. Sahte radar üretilmez.
      try {
        const rr = await api.radarRound(b?.roundId);
        setRadar(rr);
      } catch { setRadar(null); }
    } catch (e) {
      setHata(e?.message || 'Bülten alınamadı.');
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => { yukle(); }, [yukle]);

  const radarByNo = useMemo(() => {
    const map = {};
    for (const rm of radar?.matches || []) if (rm?.no != null) map[rm.no] = rm;
    return map;
  }, [radar]);

  const aktifRound = data?.roundId ?? roundId;

  const rows = useMemo(
    () => buildStudioRows({
      matches: data?.matches,
      picks: getPicks(aktifRound),
      notes: getNotes(aktifRound),
      radarByNo,
    }),
    [data, radarByNo, aktifRound, yenile],
  );

  const idx = useMemo(() => rows.findIndex((r) => String(r.no) === String(no)), [rows, no]);
  const row = idx >= 0 ? rows[idx] : null;
  const ham = useMemo(
    () => (data?.matches || []).find((m) => String(m?.no) === String(no)) || null,
    [data, no],
  );
  const radarMatch = row ? radarByNo[row.no] || null : null;

  const bolumler = useMemo(
    () => (row ? sectionStates(row, ham, radarMatch) : STUDIO_SECTIONS.map((s) => ({ ...s, hasData: false }))),
    [row, ham, radarMatch],
  );

  const sonraki = useMemo(() => (row ? nextUnpicked(rows, row.no) : null), [rows, row]);

  const dokun = useCallback((o) => {
    if (!row || row.locked || aktifRound == null) return;
    togglePick(aktifRound, row.no, o);
  }, [row, aktifRound]);

  const gitBolum = useCallback((key) => {
    setAktif(key);
    const x = seritX.current[key];
    if (x != null) seritRef.current?.scrollTo({ x: Math.max(0, x - 12), animated: true });
  }, []);

  // NOT DA KİLİTLENİR: maç başladıktan sonra yayın notunu düzeltmek, söylenmiş
  // cümleyi geriye dönük değiştirmek olur. Kutu salt okunur olur; son söz depoda.
  const notKaydet = useCallback((t) => {
    if (!row || row.locked || aktifRound == null) return;
    setNotTaslak(t);
    setNote(aktifRound, row.no, t);
  }, [aktifRound, row]);

  /* ————————————————— durumlar ————————————————— */

  if (yukleniyor) {
    return (
      <View style={st.root}>
        <StudioHeader k={k} onExit={() => navigation.goBack()} exitLabel="Listeye dön" line="MAÇ ANALİZİ" />
        <View style={st.center}><ActivityIndicator color={S.accent} size="large" /></View>
      </View>
    );
  }
  if (hata) {
    return (
      <View style={st.root}>
        <StudioHeader k={k} onExit={() => navigation.goBack()} exitLabel="Listeye dön" line="MAÇ ANALİZİ" />
        <StudioState title="Maç açılamadı" text={hata} actionLabel="Yeniden dene" onAction={yukle} testID="studio-match-error" />
      </View>
    );
  }
  if (!row) {
    return (
      <View style={st.root}>
        <StudioHeader k={k} onExit={() => navigation.goBack()} exitLabel="Listeye dön" line="MAÇ ANALİZİ" />
        <StudioState
          title="Maç bulunamadı"
          text={`Bültende ${no ?? '—'} numaralı maç yok. Uydurma maç gösterilmez.`}
          actionLabel="Listeye dön"
          onAction={() => navigation.goBack()}
          testID="studio-match-missing"
        />
      </View>
    );
  }

  const aktifBolum = bolumler.find((b) => b.key === aktif) || bolumler[0];

  return (
    <View style={st.root} testID="studio-match-root">
      <StudioHeader
        k={k}
        onExit={() => navigation.goBack()}
        exitLabel="Listeye dön"
        line={`MAÇ ${row.no} / ${rows.length}${row.league ? ` · ${row.league}` : ''}`}
      />

      {/* ——— MAÇ BAŞLIĞI + 1-0-2 (üstte, yayında hep görünür) ——— */}
      <View style={[st.sabit, dar && { flexDirection: 'column', alignItems: 'stretch', gap: SP.sm }]}>
        <View style={{ flex: 1, minWidth: 160 }}>
          <Text style={[st.baslik, fontOf(700, f), { fontSize: t.baslik }]} numberOfLines={2}>{row.title}</Text>
          {/* Seçimin TÜRÜ burada yazar (tek/çift/kapalı). Bu bir değerlendirme
              değil, yayıncının kendi işaretinin adıdır. */}
          <Text style={[st.altBaslik, fontOf(400, f), { fontSize: t.kucuk }]} numberOfLines={1}>
            {row.dateText || 'Tarih bulunamadı'}{row.dayText ? ` ${row.dayText}` : ''} · {row.timeText || '—'}
            {row.kind ? ` · ${KIND_LABEL[row.kind]}` : ''}
            {row.locked ? ' · 🔒 seçim kapalı' : ''}
          </Text>
        </View>
        <PickBoxes outcomes={row.outcomes} onToggle={dokun} disabled={row.locked} k={k} />
      </View>

      {/* ——— YATAY ŞERİT: sola kaydırmalı bölüm sekmeleri ——— */}
      <View style={st.seritSarmal}>
        <ScrollView
          ref={seritRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={st.seritIc}
          testID="studio-section-strip"
        >
          {bolumler.map((b) => {
            const on = b.key === aktif;
            return (
              <TouchableOpacity
                key={b.key}
                onLayout={(e) => { seritX.current[b.key] = e.nativeEvent.layout.x; }}
                onPress={() => gitBolum(b.key)}
                activeOpacity={0.8}
                style={[st.sekme, on && st.sekmeOn]}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                testID={`studio-section-${b.key}`}
              >
                <Text style={[st.sekmeTxt, fontOf(on ? 700 : 500, f), { fontSize: t.metin }, on && st.sekmeTxtOn]} numberOfLines={1}>
                  {b.short}
                </Text>
                {/* Veri yoksa sekmede sessizce belli olur — yayıncı boşa dokunmaz. */}
                <View style={[st.sekmeNokta, { backgroundColor: b.hasData ? S.good : S.inkDim }]} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView ref={sayfaRef} style={{ flex: 1 }} contentContainerStyle={st.icerik}>
        {/* 1) SEÇİLİ BÖLÜM */}
        <Panel title={aktifBolum.title} k={k} testID="studio-section-body">
          {aktifBolum.key === 'liste' ? <ListeBolumu row={row} radarMatch={radarMatch} k={k} /> : null}
          {aktifBolum.key === 'istatistik' ? <IstatistikBolumu m={ham} row={row} k={k} /> : null}
          {aktifBolum.radarId ? <RadarBolumu radarMatch={radarMatch} radarId={aktifBolum.radarId} k={k} /> : null}
        </Panel>

        {/* 2) MOTOR OKUMASI — burada 1-0-2 YOKTUR, karar yayıncınındır. */}
        <Panel
          title="Motor Okuması"
          hint="Motorun ölçtüğü gözlemler. Tahmin vermez, taraf tutmaz — seçimi yayıncı yapar."
          k={k}
        >
          {/* "Veri güveni: Düşük/Orta" ÇİPİ KALDIRILDI: veriye not veriyordu.
              Aşağıdaki maddeler zaten yalnız BULUNAN gözlemlerdir; hiçbiri
              bulunamadıysa gerekçesiyle "veri yok" yazılır. */}
          {row.reading?.hasData ? (
            <>
              {row.reading.lines.map((c, i) => (
                <Text key={i} style={[st.p, fontOf(400, f), { fontSize: t.metin }]}>• {c}</Text>
              ))}
            </>
          ) : (
            <Bos text={row.reading?.reason || 'Motor okuması yok — puan, form veya ortak rakip verisi bulunamadı.'} k={k} />
          )}
        </Panel>

        {/* "RİSK YORUMU" PANELİ KALDIRILDI (yayıncı isteği): maça risk/belirsizlik
            seviyesi veriyordu. Seçimin türü (tek/çift/kapalı) üstteki başlık
            satırında yazar; maçın yorumu yayıncınındır. */}

        {/* 3) YAYINCI NOTU */}
        <Panel
          title="Yayıncı Notu"
          hint={row.locked
            ? 'Maç başladı — not kapandı, yazdığın cümle olduğu gibi kalır.'
            : 'Yayında söyleyeceğin cümle. Yalnız bu cihazda saklanır; sunucuya gönderilmez.'}
          k={k}
        >
          <TextInput
            style={[st.not, fontOf(400, f), { fontSize: t.orta }, row.locked && st.notKilitli]}
            value={notTaslak != null ? notTaslak : row.note}
            onChangeText={notKaydet}
            editable={!row.locked}
            placeholder={row.locked ? 'Bu maça not yazılmadı.' : 'Örn: Ev sahibi iç sahada 6 maçtır kaybetmiyor…'}
            placeholderTextColor={S.inkDim}
            multiline
            maxLength={NOTE_MAX}
            testID="studio-note"
          />
          <Text style={[st.bos, fontOf(400, f), TABULAR, { fontSize: t.kucuk }]}>
            {row.locked
              ? 'Kilitli — yalnız görüntüleme.'
              : `${(notTaslak != null ? notTaslak : row.note).length}/${NOTE_MAX}`}
          </Text>
        </Panel>

        {/* ALT SEÇİM — kaydırdıktan sonra yukarı çıkmadan işaretle */}
        <Panel title="Bu Maçtaki Seçimin" k={k}>
          <PickBoxes outcomes={row.outcomes} onToggle={dokun} disabled={row.locked} k={k} />
          <Text style={[st.bos, fontOf(400, f), { fontSize: t.kucuk }]}>
            {row.locked
              ? 'Maç başladı — seçim kapalı, yalnız görüntüleme açık.'
              : 'Seçim anında ana listeye yansır ve cihazda saklanır.'}
          </Text>
        </Panel>

        <View style={st.gezinti}>
          <TouchableOpacity style={st.gBtn} onPress={() => navigation.goBack()} activeOpacity={0.85} testID="studio-back-list">
            <Text style={[st.gBtnTxt, fontOf(600, f), { fontSize: t.metin }]}>‹ Bülten listesi</Text>
          </TouchableOpacity>
          {sonraki ? (
            <TouchableOpacity
              style={[st.gBtn, st.gBtnAna]}
              onPress={() => navigation.navigate('StudioMatch', { roundId: aktifRound, no: sonraki.no })}
              activeOpacity={0.85}
              testID="studio-next-match"
            >
              <Text style={[st.gBtnTxt, fontOf(600, f), { fontSize: t.metin, color: S.accentInk }]}>Sıradaki boş maç · {sonraki.no} ›</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <LegalStrip extra="Yalnız resmî Spor Toto sonucu kesindir." />
      </ScrollView>
    </View>
  );
}

/* ————————————————————————— STİL ————————————————————————— */

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: S.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  sabit: {
    flexDirection: 'row', alignItems: 'center', gap: SP.md, flexWrap: 'wrap',
    paddingHorizontal: SP.md, paddingVertical: SP.sm,
    backgroundColor: S.panel, borderBottomWidth: 1, borderBottomColor: S.line,
  },
  baslik: { color: S.ink, fontWeight: '700', letterSpacing: -0.2 },
  altBaslik: { color: S.inkSoft, fontWeight: '400', marginTop: 2 },

  seritSarmal: { borderBottomWidth: 1, borderBottomColor: S.line, backgroundColor: S.panel },
  seritIc: { flexDirection: 'row', gap: SP.xs, paddingHorizontal: SP.md, paddingTop: SP.sm },
  // SEKME: eskiden turuncu dolgu hap (pill) idi — her arayüzde görülen kalıp.
  // Resmî bülten görünümünde sekme köşeli, zemini kağıt beyazı; seçili olan
  // ALTINDAN turuncu çizgiyle belli olur. Dolgu yerine çizgi, yayın kadrajında
  // daha az yer kaplar ve tablo ile aynı dili konuşur.
  sekme: {
    flexDirection: 'row', alignItems: 'center', gap: SP.sm,
    paddingHorizontal: SP.md, paddingVertical: SP.sm,
    borderTopLeftRadius: R.sm, borderTopRightRadius: R.sm,
    backgroundColor: S.panel2, borderWidth: 1, borderColor: S.line,
    borderBottomWidth: 2, borderBottomColor: S.line,
  },
  sekmeOn: { backgroundColor: S.panel, borderColor: S.lineStrong, borderBottomColor: S.accent },
  sekmeTxt: { color: S.inkSoft, fontWeight: '600' },
  sekmeTxtOn: { color: S.accent, fontWeight: '700' },
  sekmeNokta: { width: 5, height: 5, borderRadius: 3 },

  icerik: { padding: SP.md, gap: SP.md, paddingBottom: SP.xl },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SP.xs, alignItems: 'center' },
  p: { color: S.inkSoft, fontWeight: '400', lineHeight: 18 },
  // İTALİK KALDIRILDI: gömülü ailenin eğik kesimi yok; tarayıcı harfleri
  // yamultarak sahte-italik çizerdi. "Veri yok" bilgisi zaten soluk renkle ayrılıyor.
  bos: { color: S.inkDim, fontWeight: '400', lineHeight: 16 },

  listeHead: { flexDirection: 'row', alignItems: 'center', gap: SP.sm, flexWrap: 'wrap' },
  noBox: {
    backgroundColor: S.panel3, borderRadius: R.sm, borderWidth: 1, borderColor: S.line,
    alignItems: 'center', justifyContent: 'center',
  },
  noTxt: { color: S.accent, fontWeight: '700' },
  listeTitle: { color: S.ink, fontWeight: '700' },
  listeSub: { color: S.inkSoft, fontWeight: '400', marginTop: 2 },

  scoreRow: { flexDirection: 'row', gap: SP.xs },
  scoreCell: {
    flex: 1, gap: 3, backgroundColor: S.panel2, borderRadius: R.sm,
    borderWidth: 1, borderColor: S.lineSoft, paddingHorizontal: SP.sm, paddingVertical: SP.sm,
  },
  scoreSym: { color: S.inkDim, fontWeight: '600' },
  scoreVal: { color: S.ink, fontWeight: '700' },

  dna: {
    backgroundColor: S.panel2, borderRadius: R.sm, borderLeftWidth: 2, borderLeftColor: S.line,
    paddingHorizontal: SP.md, paddingVertical: SP.sm, gap: 3,
  },
  dnaTxt: { color: S.inkSoft, fontWeight: '500', lineHeight: 17 },

  teamHead: { flexDirection: 'row', alignItems: 'center', gap: SP.sm },
  teamName: { color: S.ink, fontWeight: '700', flex: 1 },
  teamVs: { color: S.inkDim, fontWeight: '500' },

  formRow: { flexDirection: 'row', gap: SP.md },
  formBox: { borderRadius: R.sm, alignItems: 'center', justifyContent: 'center' },
  formTxt: { color: S.panel, fontWeight: '700' },
  miniLbl: { color: S.inkDim, fontWeight: '600', ...ETIKET },

  duo: { flexDirection: 'row', alignItems: 'center', gap: SP.sm, paddingVertical: 2 },
  duoVal: { color: S.ink, fontWeight: '700', minWidth: 38 },
  duoMid: { flex: 1, gap: 2 },
  duoLbl: { color: S.inkSoft, fontWeight: '500', textAlign: 'center' },
  duoBars: { flexDirection: 'row', gap: 3 },
  duoBarL: { flex: 1, height: 4, backgroundColor: S.lineSoft, borderRadius: 2, alignItems: 'flex-end', overflow: 'hidden' },
  duoBarR: { flex: 1, height: 4, backgroundColor: S.lineSoft, borderRadius: 2, overflow: 'hidden' },

  not: {
    backgroundColor: S.panel, borderWidth: 1, borderColor: S.line, borderRadius: R.sm,
    color: S.ink, padding: SP.sm, minHeight: 60, textAlignVertical: 'top', fontWeight: '400',
  },
  // Kilitli not: okunur ama "yazılabilir" görünmez — kenarlık söner, yazı solar.
  notKilitli: { backgroundColor: S.panel3, borderColor: S.lineSoft, color: S.inkSoft },

  gezinti: { flexDirection: 'row', gap: SP.sm, flexWrap: 'wrap' },
  gBtn: {
    flex: 1, minWidth: 130, backgroundColor: S.panel, borderWidth: 1, borderColor: S.lineStrong,
    borderRadius: R.sm, paddingVertical: SP.md, alignItems: 'center',
  },
  gBtnAna: { backgroundColor: S.accent, borderColor: S.accent },
  gBtnTxt: { color: S.ink, fontWeight: '600' },
});
