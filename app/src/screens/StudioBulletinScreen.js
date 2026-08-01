// YAYIN STÜDYOSU · ANA BÜLTEN EKRANI — 15 maçlık haftanın maç maç anlatıldığı yer.
//
// NE YAPAR: Yayıncı canlı yayında bu tablodan ilerler. Her satırda sıra
// numarası, tarih, saat, kulüp armaları + maç adı, analiz kısayolu ve 1-0-2
// seçim kutuları vardır. Seçilen kutu renklenir ve KALICIDIR
// (broadcastStudioStore). Analiz alanına basınca maç detay ekranı açılır.
// 15 maç tamamlanınca kayıt düğmesi açılır — ekran başka yere ATLAMAZ.
//
// GÖRÜNÜM: Resmî bülten/sonuç tablosu düzeni — solda numaralı tablo, sağda
// özet paneli. Dar ekranda özet yukarı, tablo aşağı iner. Ölçüler ve renkler
// studioTheme.js'ten gelir; burada tema sabiti yazılmaz.
//
// KESİN KURALLAR:
//  • Bu ekran HESAP YAPMAZ. Bütün sayılar broadcastStudio.js'ten gelir.
//  • UYDURMA YOK: veri yoksa satır "analiz verisi yok" der; sahte oran/yüzde
//    veya sahte tarih gösterilmez. Arma yoksa nötr simge çizilir.
//  • Başlamış maç kilitlidir; kilit tek kaynaktan (couponConfig) gelir ve
//    kutular dokunulamaz olur.
//  • KİŞİSEL VERİ YOK: bu ekran yayında herkese görünür. Kullanıcı adı,
//    e-posta, belirteç, puan veya başka kullanıcının kuponu buraya girmez.
//  • Yalnız resmî Spor Toto sonucu kesindir; burada sonuç üretilmez.
//
// KUPON KAYDI ARTIK YALNIZ BURADA (yayıncı istekleri: "kuponu kaydet burada
// olsun" → sonra "final kuponu ekranını kaldır"). Ayrı bir final kupon ekranı
// vardı; kaydetme buraya taşınınca o ekranın yaptığı her şey burada toplandı
// (kupon adı, kaydetme, engel uyarıları, "Arşivi aç") ve ekran kaldırıldı.
// Kural src/studioCouponSave.js'te durur — engel sebepleri, kayıt verisi ve
// hata metinleri orada. Kayıt kapalıysa SEBEBİ hep ekranda yazılı.
//
// EKRAN GÖRSELİ PAYLAŞIMI (yayıncı isteği: "ekran görseli paylaşma olsun").
// Tablo, marka şeridi ve yasal not TEK KAREDE toplanır; o kare PNG olarak
// paylaşılır. Karede KİŞİSEL VERİ YOKTUR — sağ özet paneli, kupon adı kutusu
// ve arşiv bilgisi kadraja girmez. Paylaşım kararları src/studioShare.js'te.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Platform, StyleSheet, useWindowDimensions,
} from 'react-native';
import { uyari } from '../components/Uyari';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

import { api } from '../api';
import { APP_NAME_UPPER, NO_GUARANTEE_NOTICE } from '../brand';
import {
  buildStudioRows, readinessOf, distributionOf, columnsOf,
  nextUnpicked, KIND_LABEL,
} from '../broadcastStudio';
import {
  engelliNolarOf, saveBlockerOf, columnsNoteOf, couponPayloadOf, saveErrorOf,
} from '../studioCouponSave';
import {
  SHARE_MIME, shareFileNameOf, shareTitleOf, shareCaptionOf,
  sharePngOnWeb, isAbortError, shareDoneTextOf, shareErrorTextOf, tabularOff,
  inlineImagesForCapture, capturePngDataUri,
} from '../studioShare';
import { createCoupon } from '../coupon/store';
import {
  getPicks, getNotes, togglePick, publishLocks, subscribeStudio, rememberCoupon,
} from '../broadcastStudioStore';
import {
  S, R, SP, TABLE, T, ETIKET, NARROW_MAX, SIDEBAR_MIN,
  scaleFor, toneOfKind,
} from '../studioTheme';
import { fontOf, useStudioFontReady, TABULAR } from '../studioFonts';
import {
  StudioHeader, HeaderButton, PickBoxes, TeamCrest, Bar, Etiket,
  StudioState, LegalStrip,
} from './studioParts';

export default function StudioBulletinScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [radar, setRadar] = useState(null);
  const [error, setError] = useState(null);
  const [yenile, setYenile] = useState(0);        // depo değişince yeniden çiz
  const { width } = useWindowDimensions();
  const k = scaleFor(width);
  const t = T(k);
  const f = useStudioFontReady();
  const dar = width <= NARROW_MAX;
  const yanyana = width >= SIDEBAR_MIN;

  /* ————— veri ————— */
  const yukle = useCallback(async () => {
    try {
      setError(null);
      const b = await api.bulletin();
      // KİLİDİ ÖNCE BİLDİR: depo, başlamış maça yazmayı ancak kilit anlarını
      // bildiği zaman engelleyebilir. Satırlar çizilmeden önce yapılır.
      publishLocks(b?.roundId, b?.matches);
      setData(b);
      // Radar ayrı bir uçtan gelir ve HAZIR OLMAYABİLİR. Gelmezse satırlar yine
      // çalışır; belirsizlik hesabına radar bileşenleri "eksik" olarak yazılır.
      try {
        const rd = b?.roundId != null ? await api.radarRound(b.roundId) : null;
        setRadar(Array.isArray(rd?.matches) ? rd : null);
      } catch { setRadar(null); }
    } catch (e) {
      setError(e?.message || 'Bülten alınamadı.');
    }
  }, []);
  useEffect(() => { yukle(); }, [yukle]);

  // Seçimler başka ekranda (maç detayı) değişince liste anında tazelenir.
  useEffect(() => subscribeStudio(() => setYenile((v) => v + 1)), []);

  const roundId = data?.roundId ?? null;

  const radarByNo = useMemo(() => {
    const map = {};
    for (const m of radar?.matches || []) if (m?.no != null) map[m.no] = m;
    return map;
  }, [radar]);

  const rows = useMemo(
    () => buildStudioRows({
      matches: data?.matches,
      picks: getPicks(roundId),
      notes: getNotes(roundId),
      radarByNo,
    }),
    // yenile: depo değiştiğinde seçimleri yeniden okumak için bilerek bağımlılık.
    [data, radarByNo, roundId, yenile],
  );

  const hazir = useMemo(() => readinessOf(rows), [rows]);
  const dagilim = useMemo(() => distributionOf(rows), [rows]);
  const kolon = useMemo(() => (rows.length ? columnsOf(rows) : 0), [rows]);
  const sonraki = useMemo(() => nextUnpicked(rows), [rows]);

  /* ————— KUPON KAYDI ————— */
  const [ad, setAd] = useState('');
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [kayitli, setKayitli] = useState(null);   // { id, name } — kayıttan sonra
  const [mesaj, setMesaj] = useState('');         // ekranda GÖRÜNEN sonuç

  // Hafta değişirse kayıt durumu sıfırlanır; önceki haftanın kuponu yeni
  // haftada "kaydedildi" gibi görünmez.
  useEffect(() => { setKayitli(null); setMesaj(''); setAd(''); }, [roundId]);

  const engelliNolar = useMemo(() => engelliNolarOf(rows), [rows]);
  // TEK ENGEL DEĞİŞKENİ: kayıt kapalıysa sebebi de burada. Sebep nesnesi
  // olmadan düğme kapanamaz — yani "sebepsiz kapalı düğme" mümkün değil.
  // KOLON SAYISI ARTIK GEÇMİYOR: yayın stüdyosunda kolon sayısı kaydı
  // engellemiyor, yalnız bilgi olarak yazılıyor (bkz. kolonNotu / columnsNoteOf).
  const engel = useMemo(
    () => (rows.length ? saveBlockerOf({ hazir, engelliNolar }) : null),
    [rows.length, hazir, engelliNolar],
  );
  const kayitKapali = !!engel;

  const kaydet = useCallback(() => {
    if (kaydediliyor || kayitli) return;
    if (!rows.length || roundId == null) return;
    setMesaj('');
    // Engel varsa: ekrana yaz (web'de tek görünen kanal budur) + telefonda uyar.
    if (engel) { setMesaj(`${engel.title}: ${engel.text}`); uyari.alert(engel.title, engel.text); return; }
    setKaydediliyor(true);
    const { meta, govde } = couponPayloadOf({ data, roundId, rows });
    const res = createCoupon(meta, govde, ad);
    setKaydediliyor(false);
    const hata = saveErrorOf(res);
    if (hata) { setMesaj(`${hata.title}: ${hata.text}`); uyari.alert(hata.title, hata.text); return; }
    // Yayın deposu kuponu ikinci kez saklamaz — yalnız kimliğini hatırlar.
    rememberCoupon(roundId, res.coupon.id);
    setKayitli({ id: res.coupon.id, name: res.coupon.name });
  }, [kaydediliyor, kayitli, rows, roundId, engel, data, ad]);

  /* ————— EKRAN GÖRSELİ PAYLAŞIMI —————
     Kadraj: yalnız <ViewShot> içindeki kare. Sağ özet paneli (kupon adı,
     arşiv durumu) DIŞARIDA kalır — paylaşılan görselde kişisel iz olmaz. */
  const paylasRef = useRef(null);
  const [paylasiliyor, setPaylasiliyor] = useState(false);
  const [paylasimMesaj, setPaylasimMesaj] = useState('');

  const paylas = useCallback(async () => {
    if (paylasiliyor) return;
    setPaylasimMesaj('');
    setPaylasiliyor(true);
    try {
      const web = Platform.OS === 'web';
      // Web'de kare alan kitaplık eşit-genişlik rakamı yok sayıyor; saatler
      // kaymasın diye ayar kare boyunca kapatılır (ayrıntı: studioShare.js).
      const tabularGeri = web ? tabularOff() : null;
      // ARMALAR KAREYE GİRSİN DİYE ÖNCE GÖMÜLÜR (yalnız web). Dış kaynaktan
      // gelen bir görsel ekranda görünse bile kareye giremiyordu; gerekçenin
      // tamamı studioShare.js ve crestUrl.js başında. İnmeyen arma yerine
      // nötr ⚽ konur — yanlış/benzeri arma asla konmaz.
      const armaGeri = web ? await inlineImagesForCapture(paylasRef.current) : null;
      // Web'de dosya yolu yoktur; kare veri-URI olarak döner ve ikiliye
      // burada çevrilir. Telefonda geçici dosya yolu döner.
      let kare;
      try {
        // YÜKSEK ÇÖZÜNÜRLÜK: kare kitaplığının web sarmalayıcısı ölçek
        // seçeneğini iletmediği için kare hep 1× (yani ekran kadar yumuşak)
        // çıkıyordu. Web'de kare doğrudan alınır; olmazsa eski yola düşülür.
        if (web) kare = await capturePngDataUri(paylasRef.current, { backgroundColor: S.bg });
        if (!kare) {
          kare = await captureRef(
            paylasRef,
            web ? { format: 'png', quality: 1, result: 'data-uri' } : { format: 'png', quality: 1 },
          );
        }
      } finally {
        if (armaGeri) armaGeri();
        if (tabularGeri) tabularGeri();
      }
      const dosyaAdi = shareFileNameOf({ roundId, weekNumber: data?.weekNumber });
      const yazi = shareCaptionOf({ roundId, picked: hazir.picked, total: hazir.total });
      if (web) {
        setPaylasimMesaj(shareDoneTextOf(await sharePngOnWeb(kare, dosyaAdi, yazi)));
      } else if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(kare, { mimeType: SHARE_MIME, dialogTitle: shareTitleOf({ roundId }) });
        setPaylasimMesaj(shareDoneTextOf('shared'));
      } else {
        setPaylasimMesaj(shareDoneTextOf('unavailable'));
      }
    } catch (e) {
      // Kullanıcı menüyü kapattıysa bu bir hata değildir; ekran sessiz kalır.
      setPaylasimMesaj(isAbortError(e) ? '' : shareErrorTextOf(e));
    } finally {
      setPaylasiliyor(false);
    }
  }, [paylasiliyor, roundId, data, hazir.picked, hazir.total]);

  /* ————— gezinme ————— */
  const cikis = useCallback(() => {
    if (navigation?.canGoBack?.()) navigation.goBack();
    else navigation?.navigate?.('Home');
  }, [navigation]);

  const acDetay = useCallback((no) => {
    navigation?.navigate?.('StudioMatch', { roundId, no });
  }, [navigation, roundId]);

  const acKarne = useCallback(() => {
    navigation?.navigate?.('StudioKarne', { roundId });
  }, [navigation, roundId]);

  // ARŞİV BAŞKA SEKMEDE: 'CouponCenter' Ana Sayfa yığınında kayıtlı DEĞİL,
  // "Kuponlarım" sekmesinin kökünde durur. Doğrudan adıyla çağrılırsa
  // gezinme hata verir; sekme üzerinden gidilir.
  const acArsiv = useCallback(() => {
    navigation?.navigate?.('CouponsTab', { screen: 'CouponCenter' });
  }, [navigation]);

  // 15. MAÇ İŞARETLENİNCE EKRAN ARTIK ATLAMAZ. Eskiden burada Final Kupon
  // ekranına otomatik geçiş vardı; o ekran kaldırıldı (yayıncı isteği) ve
  // kaydetme bu ekrana taşındı. Yayıncı canlı yayında tablodan kopmaz;
  // tamamlandığını sağdaki "15/15 maç işaretlendi" satırından ve kayıt
  // düğmesinin açılmasından görür.

  // Kilitli satırda kutu zaten pasiftir; buradaki denetim ikinci settir.
  // Son söz depodadır (publishLocks) — ekran unutsa da kayıt değişmez.
  const kilitliNo = useMemo(() => new Set(hazir.lockedNos.map(String)), [hazir.lockedNos]);
  const dokun = useCallback((no, o) => {
    if (roundId == null || kilitliNo.has(String(no))) return;
    togglePick(roundId, no, o);
  }, [roundId, kilitliNo]);

  const ustDugmeler = (
    <>
      <HeaderButton k={k} text="Karne" onPress={acKarne} label="Geçmiş hafta karnesi" testID="studio-goto-karne" />
      <HeaderButton k={k} text="Sunum" onPress={() => navigation?.navigate?.('Broadcast')} label="Sunum modu" />
      <HeaderButton k={k} text="⟳" onPress={yukle} label="Yenile" />
    </>
  );

  /* ————— durumlar ————— */
  if (error) {
    return (
      <View style={st.root}>
        <StudioHeader k={k} onExit={cikis} right={<HeaderButton k={k} text="⟳" onPress={yukle} label="Yenile" />} />
        <StudioState title="Bülten alınamadı" text={error} actionLabel="Tekrar Dene" onAction={yukle} />
        <View style={st.bottom}><LegalStrip /></View>
      </View>
    );
  }
  if (!data) {
    return (
      <View style={st.root}>
        <StudioHeader k={k} onExit={cikis} />
        <StudioState title="Stüdyo hazırlanıyor…" text="Hafta verisi alınıyor." />
        <View style={st.bottom}><LegalStrip /></View>
      </View>
    );
  }
  if (!rows.length) {
    return (
      <View style={st.root}>
        <StudioHeader k={k} onExit={cikis} right={<HeaderButton k={k} text="⟳" onPress={yukle} label="Yenile" />} />
        <StudioState
          title="Gösterilecek maç yok"
          text="Bu hafta için bülten maçı bulunmuyor. Stüdyo veri olmadan satır üretmez; uydurma maç gösterilmez."
          actionLabel="Yenile"
          onAction={yukle}
        />
        <View style={st.bottom}><LegalStrip /></View>
      </View>
    );
  }

  const yuzde = hazir.total ? Math.round((hazir.picked / hazir.total) * 100) : 0;
  // Kolon sayısı resmî oyun sınırını aşarsa BİLGİ satırı çıkar — kaydı ENGELLEMEZ.
  // Metin studioCouponSave.js'te tek kaynakta durur (bkz. columnsNoteOf).
  const kolonNotu = columnsNoteOf(kolon);

  /* ————— TABLO ————— */
  const tablo = (
    <View style={st.tablo}>
      {/* Sütun başlıkları — resmî tablodaki koyu şerit. */}
      <View style={[st.thead, { height: Math.round(TABLE.headH * k) }]}>
        <Th text="SIRA" k={k} style={[{ width: Math.round(38 * k) }, st.tdDar]} center />
        {!dar ? <Th text="TARİH" k={k} style={{ width: Math.round(70 * k) }} /> : null}
        {!dar ? <Th text="SAAT" k={k} style={[{ width: Math.round(48 * k) }, st.tdDar]} /> : null}
        <Th text="EV SAHİBİ - KONUK TAKIM" k={k} style={{ flex: 1, minWidth: 0 }} />
        {!dar ? <Th text="ANALİZ" k={k} style={{ width: Math.round(96 * k) }} /> : null}
        <Th text="1 - 0 - 2" k={k} style={{ width: Math.round((dar ? 104 : 122) * k) }} center />
      </View>

      {rows.map((r, i) => (
        <Satir
          key={r.no}
          r={r}
          k={k}
          dar={dar}
          zebra={i % 2 === 1}
          onToggle={(o) => dokun(r.no, o)}
          onAnaliz={() => acDetay(r.no)}
        />
      ))}

      <Text style={[st.tfoot, fontOf(400, f), { fontSize: t.kucuk }]}>
        Seçimler bu cihazda saklanır ve sunucuya gönderilmez. Kolon sayısı seçim
        genişliklerinin çarpımıdır. ANALİZ sütunu o maç için KAÇ VERİ KAYNAĞI
        bulunduğunu söyler — bir değerlendirme değildir; motor 1-0-2 önermez.
        Yalnız resmî Spor Toto sonucu kesindir.
      </Text>
    </View>
  );

  /* ————— PAYLAŞILAN KARE —————
     Tablonun etrafına yalnız iki şerit eklenir: üstte marka + hafta, altta
     yaş ve dürüstlük bildirimi. Bildirim metni brand.js'ten gelir; görselden
     silinemez. LegalStrip ekranın en altında, kadrajın DIŞINDA kaldığı için
     aynı uyarı burada ayrıca çizilir — paylaşılan kare uyarısız çıkmaz. */
  const kare = (
    <ViewShot ref={paylasRef} style={st.kare}>
      <View style={st.kareBas}>
        <Text style={[st.kareMarka, fontOf(700, f), ETIKET, { fontSize: t.kucuk }]} numberOfLines={1}>
          {APP_NAME_UPPER}
        </Text>
        <View style={{ flex: 1, minWidth: 0 }} />
        <Text style={[st.kareHafta, fontOf(600, f), TABULAR, { fontSize: t.kucuk }]} numberOfLines={1}>
          Hafta {roundId ?? '—'} · {hazir.picked}/{hazir.total} işaretli
        </Text>
      </View>

      {tablo}

      <Text style={[st.kareNot, fontOf(400, f), { fontSize: t.mikro }]}>
        18+ · {NO_GUARANTEE_NOTICE} Yalnız resmî Spor Toto sonucu kesindir.
        Seçimler yayıncının kendi kararıdır.
      </Text>
    </ViewShot>
  );

  /* ————— SAĞ ÖZET PANELİ ————— */
  const ozet = (
    <View style={[st.yan, yanyana && { width: Math.round(268 * k) }]} testID="studio-progress">
      <View style={st.yanKutu}>
        <View style={st.yanBas}>
          <Etiket k={k} text="HAFTA ÖZETİ" color={S.headInk} />
        </View>

        <View style={st.yanGovde}>
          <View style={st.sayiSatir}>
            <Text
              style={[st.buyukSayi, fontOf(700, f), TABULAR, { fontSize: Math.round(30 * k) }]}
              testID="studio-progress-count"
            >
              {hazir.picked}<Text style={[st.buyukSayiSoft, fontOf(500, f)]}>/{hazir.total}</Text>
            </Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[st.sayiLbl, fontOf(500, f), { fontSize: t.kucuk }]}>maç işaretlendi</Text>
              <Bar value={yuzde} tone={hazir.complete ? S.good : S.accent} />
            </View>
          </View>

          <View style={st.ayirici} />

          <OzetSatir k={k} label="Tek" value={String(dagilim.tek)} tone={toneOfKind('tek')} />
          <OzetSatir k={k} label="Çift" value={String(dagilim.cift)} tone={toneOfKind('cift')} />
          <OzetSatir k={k} label="Kapalı (1X2)" value={String(dagilim.kapali)} tone={toneOfKind('kapali')} />
          <OzetSatir k={k} label="Boş" value={String(dagilim.bos)} tone={dagilim.bos ? S.inkSoft : S.inkDim} />

          <View style={st.ayirici} />

          {/* SAYI KIRMIZIYA BOYANMAZ: kolon sayısı bir hata değil, bir ölçüdür.
              Kırmızı "yanlış yaptın" demektir; burada yanlış bir şey yok. */}
          <OzetSatir k={k} label="Kolon sayısı" value={String(kolon)} tone={S.ink} guclu />

          {/* BURAYA RİSK/GÜVEN ÖZETİ EKLENMEZ. Yayıncı kararını kendi verir;
              ekran "güvenli/riskli/temkinli" gibi bir hüküm yazmaz. Ölçüm
              broadcastStudio.js'te durur ama yayıncı modunda ÇİZİLMEZ. */}

          {/* BİLGİ, ENGEL DEĞİL: sınır aşıldığında sayı ve resmî sınır yazılır
              ama kayıt düğmesine dokunulmaz. Gerçek kupon akışında (Kupon
              Düzenleyici) 2.500 sınırı DURUYOR — orası oynanacak kupondur. */}
          {kolonNotu ? (
            <Text
              style={[st.bilgi, fontOf(500, f), { fontSize: t.kucuk }]}
              testID="studio-bulletin-columns-note"
            >
              {kolonNotu}
            </Text>
          ) : null}

          {/* HAFTA KİLİDİ: tüm maçlar başladıysa düzenleme kapanır, ekran
              yalnız görüntüleme için açık kalır. Kısmî kilitte kaç maçın
              kapandığı yazılır — yayıncı hangi satıra dokunabileceğini bilsin. */}
          {hazir.allLocked ? (
            <View style={st.kilitKutu} testID="studio-week-locked">
              <Text style={[st.kilitBas, fontOf(700, f), { fontSize: t.metin }]}>🔒 Hafta kilitlendi</Text>
              <Text style={[st.kilitTxt, fontOf(400, f), { fontSize: t.kucuk }]}>
                Bültendeki maçların hepsi başladı. Seçimler ve notlar artık değiştirilemez;
                bu ekran yalnız görüntüleme için açık. Kayıtlı kuponlar arşivde durmaya devam eder.
              </Text>
            </View>
          ) : hazir.anyLocked ? (
            <Text style={[st.uyari, fontOf(600, f), { fontSize: t.kucuk }]} testID="studio-partial-locked">
              {hazir.lockedNos.length} maç başladı — o satırların seçimi kapandı. Başlamamış
              maçlarda seçim yapmaya devam edebilirsin.
            </Text>
          ) : null}

          {/* ——— KUPONU KAYDET ———
              Yayıncı isteği: kayıt bülten tablosunun yanında dursun. Engel
              varsa düğme KAPALI ve sebep tam üstünde YAZILI; boş kapalı düğme
              yayıncıya "bozuk" hissi verir. Web'de Alert boş bir işlev olduğu
              için basıldıktan sonraki sonuç da ekranda kalır. */}
          <View style={st.ayirici} />

          {kayitli ? (
            <View style={st.kayitKutu} testID="studio-bulletin-saved">
              <Text style={[st.kayitBas, fontOf(700, f), { fontSize: t.metin }]}>✓ Kupon kaydedildi</Text>
              <Text style={[st.kilitTxt, fontOf(400, f), { fontSize: t.kucuk }]}>
                “{kayitli.name}” arşive yazıldı. Seçimlerin ve notların ekranda durmaya devam ediyor.
              </Text>
              <TouchableOpacity
                onPress={acArsiv}
                style={[st.btn, st.btnGhost, { marginTop: SP.xs }]}
                activeOpacity={0.85}
                accessibilityLabel="Kupon arşivini aç"
                testID="studio-bulletin-archive"
              >
                <Text style={[st.btnGhostTxt, fontOf(600, f), { fontSize: t.metin }]}>Arşivi aç ›</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={st.kayitAlan} testID="studio-bulletin-save">
              <TextInput
                style={[st.ad, fontOf(400, f), { fontSize: t.metin }]}
                value={ad}
                onChangeText={setAd}
                placeholder="Kupon adı (boş bırakılırsa numara verilir)"
                placeholderTextColor={S.inkDim}
                maxLength={60}
                testID="studio-bulletin-name"
              />
              {engel ? (
                <Text style={[st.uyari, fontOf(600, f), { fontSize: t.kucuk }]} testID="studio-bulletin-blocked">
                  {engel.text}
                </Text>
              ) : null}
              <TouchableOpacity
                onPress={kaydet}
                style={[st.kaydet, kayitKapali && st.kaydetPasif]}
                activeOpacity={0.88}
                // Yerli taraf için accessibilityState, web için aria-disabled;
                // RNW accessibilityState'i DOM'a öznitelik olarak yazmıyor.
                disabled={kaydediliyor || kayitKapali}
                accessibilityRole="button"
                accessibilityLabel="Kuponu kaydet"
                accessibilityState={{ disabled: kayitKapali }}
                aria-disabled={kayitKapali}
                testID="studio-bulletin-save-btn"
              >
                <Text style={[st.kaydetTxt, fontOf(700, f), { fontSize: t.metin }]}>
                  {kaydediliyor ? 'Kaydediliyor…' : 'KUPONU KAYDET'}
                </Text>
              </TouchableOpacity>
              {mesaj ? (
                <Text style={[st.uyari, fontOf(600, f), { fontSize: t.kucuk }]} testID="studio-bulletin-message">
                  {mesaj}
                </Text>
              ) : null}
              <Text style={[st.kayitNot, fontOf(400, f), { fontSize: t.mikro }]}>
                Kupon bu cihazdaki arşive kaydedilir. Kaydedilen kupon bir tahmin değil,
                yayında yaptığın seçimlerin kaydıdır.
              </Text>
            </View>
          )}

          <View style={st.yanBtns}>
            {/* EKRAN GÖRSELİ — kadraj tablodur; bu düğme her durumda açıktır,
                kupon kaydedilemese de yayıncı tabloyu paylaşabilir. */}
            <TouchableOpacity
              onPress={paylas}
              style={[st.btn, st.btnGhost, paylasiliyor && st.btnMesgul]}
              activeOpacity={0.85}
              disabled={paylasiliyor}
              accessibilityRole="button"
              accessibilityLabel="Ekran görselini paylaş"
              testID="studio-bulletin-share-btn"
            >
              <Text style={[st.btnGhostTxt, fontOf(600, f), { fontSize: t.metin }]}>
                {paylasiliyor ? 'Görsel hazırlanıyor…' : '📸 Ekran görselini paylaş'}
              </Text>
            </TouchableOpacity>
            {paylasimMesaj ? (
              <Text
                style={[st.kayitNot, fontOf(500, f), { fontSize: t.mikro }]}
                testID="studio-bulletin-share-message"
              >
                {paylasimMesaj}
              </Text>
            ) : null}

            {sonraki && !hazir.allLocked ? (
              <TouchableOpacity
                onPress={() => acDetay(sonraki.no)}
                style={[st.btn, st.btnGhost]}
                activeOpacity={0.85}
                accessibilityLabel={`Sıradaki boş maç ${sonraki.order}`}
              >
                <Text style={[st.btnGhostTxt, fontOf(600, f), { fontSize: t.metin }]}>
                  Sıradaki boş maç · {sonraki.order} ›
                </Text>
              </TouchableOpacity>
            ) : null}
            {/* FİNAL KUPON EKRANI KALDIRILDI (yayıncı isteği). Oraya giden
                düğme buradaydı. Ekranın yaptığı her şey — kupon adı, kaydetme,
                engel uyarıları, "Arşivi aç" — bu ekranda zaten var; maç maç
                seçimler de tablonun kendisinde duruyor. İkinci bir ekran
                yayıncıyı tablodan koparmaktan başka bir şey yapmıyordu. */}
            <TouchableOpacity
              onPress={acKarne}
              style={[st.btn, st.btnGhost]}
              activeOpacity={0.85}
              accessibilityLabel="Geçmiş hafta karnesi"
            >
              <Text style={[st.btnGhostTxt, fontOf(600, f), { fontSize: t.metin }]}>Geçmiş Hafta Karnesi ›</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={st.root} testID="studio-bulletin-root">
      <StudioHeader
        k={k}
        onExit={cikis}
        line={`Hafta ${roundId ?? '—'} · ${hazir.total} maç · bülten sırasıyla`}
        right={ustDugmeler}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[st.body, { paddingHorizontal: yanyana ? SP.lg : SP.sm }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[st.stage, { maxWidth: 1240 }, yanyana && st.stageRow]}>
          {yanyana ? null : ozet}
          <View style={{ flex: 1, minWidth: 0 }}>{kare}</View>
          {yanyana ? ozet : null}
        </View>
      </ScrollView>

      <View style={st.bottom}>
        <LegalStrip extra="Yalnız resmî Spor Toto sonucu kesindir." />
      </View>
    </View>
  );
}

/* ————————————————————————— TABLO PARÇALARI ————————————————————————— */

function Th({ text, k, style, center = false }) {
  const f = useStudioFontReady();
  return (
    <View style={[st.th, style, center && { alignItems: 'center' }]}>
      <Text style={[st.thTxt, ETIKET, fontOf(600, f), { fontSize: T(k).mikro }]} numberOfLines={1}>{text}</Text>
    </View>
  );
}

function OzetSatir({ label, value, tone = S.ink, k, guclu = false }) {
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

function Satir({ r, k, dar, zebra, onToggle, onAnaliz }) {
  const f = useStudioFontReady();
  const t = T(k);
  const armaBoy = Math.round(17 * k);

  // Analiz hücresi yalnız ELDE NE VAR onu söyler: o maç için kaç veri kaynağı
  // bulunduğu. Hüküm yok — "risk/güven/temkinli" yazılmaz, seviye rozeti
  // çizilmez, 1-0-2 önerilmez. Sayı burada hesaplanmaz; uncertainty.used
  // listesinin uzunluğudur (broadcastStudio.js).
  const kaynakSayisi = r.uncertainty?.used?.length || 0;
  const analizUst = kaynakSayisi ? `${kaynakSayisi} kaynak` : 'Veri yok';
  const analizTon = kaynakSayisi ? S.inkSoft : S.inkDim;

  return (
    <View
      style={[
        st.tr,
        { minHeight: Math.round(TABLE.rowH * k) },
        zebra && st.trZebra,
        r.hasPick && st.trPicked,
        r.locked && st.trLocked,
      ]}
      testID={`studio-row-${r.no}`}
    >
      {/* SIRA */}
      <View style={[st.td, st.tdCenter, st.tdDar, { width: Math.round(38 * k) }]}>
        <Text style={[st.sira, fontOf(700, f), TABULAR, { fontSize: t.orta }]}>{r.order}</Text>
      </View>

      {/* TARİH · SAAT (geniş ekran) */}
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
      {!dar ? (
        <View style={[st.td, st.tdDar, { width: Math.round(48 * k) }]}>
          <Text style={[st.saat, fontOf(600, f), TABULAR, { fontSize: t.metin }]} numberOfLines={1}>
            {r.timeText || '—'}
          </Text>
        </View>
      ) : null}

      {/* EV SAHİBİ - KONUK TAKIM (armalarla) — dokununca analiz açılır */}
      <TouchableOpacity
        style={[st.td, st.tdMac]}
        onPress={onAnaliz}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${r.order}. maç analizini aç`}
        testID={`studio-analiz-${r.no}`}
      >
        <View style={st.macSatir}>
          <TeamCrest uri={r.homeLogo} size={armaBoy} />
          <Text style={[st.takim, fontOf(600, f), { fontSize: t.orta }]} numberOfLines={1}>
            {r.home || '—'}
          </Text>
          <Text style={[st.tire, fontOf(400, f), { fontSize: t.kucuk }]}>-</Text>
          <Text style={[st.takim, fontOf(600, f), { fontSize: t.orta }]} numberOfLines={1}>
            {r.away || '—'}
          </Text>
          <TeamCrest uri={r.awayLogo} size={armaBoy} />
          {r.locked ? <Text style={[st.kilitIm, { fontSize: t.kucuk }]}>🔒</Text> : null}
          {r.note ? <Text style={[st.notIm, { fontSize: t.kucuk }]}>📝</Text> : null}
        </View>
        <View style={st.macAlt}>
          {dar ? (
            <Text style={[st.altBilgi, fontOf(400, f), TABULAR, { fontSize: t.mikro }]} numberOfLines={1}>
              {r.dateText || '—'} {r.timeText || ''}
            </Text>
          ) : null}
          {r.league ? (
            <Text style={[st.altBilgi, fontOf(400, f), { fontSize: t.mikro }]} numberOfLines={1}>{r.league}</Text>
          ) : null}
          {dar ? (
            <Text style={[st.altBilgi, fontOf(500, f), { color: analizTon, fontSize: t.mikro }]} numberOfLines={1}>
              {analizUst} ›
            </Text>
          ) : null}
          {r.kind ? (
            <Text style={[st.altBilgi, fontOf(500, f), { color: toneOfKind(r.kind), fontSize: t.mikro }]}>
              {KIND_LABEL[r.kind]}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>

      {/* ANALİZ (geniş ekran) */}
      {!dar ? (
        <TouchableOpacity
          style={[st.td, { width: Math.round(96 * k) }]}
          onPress={onAnaliz}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${r.order}. maç analiz özeti`}
        >
          <View style={[st.analizRozet, { backgroundColor: S.panel3 }]}>
            <Text style={[st.analizTxt, fontOf(600, f), { color: analizTon, fontSize: t.kucuk }]} numberOfLines={1}>
              {analizUst}
            </Text>
            <Text style={[st.analizOk, { color: analizTon, fontSize: t.kucuk }]}>›</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {/* 1 - 0 - 2 */}
      <View style={[st.td, st.tdCenter, { width: Math.round((dar ? 104 : 122) * k) }]}>
        <PickBoxes outcomes={r.outcomes} onToggle={onToggle} disabled={r.locked} k={k} compact={dar} />
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
  thTxt: { color: S.headInk },

  tr: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: TABLE.hair, borderBottomColor: S.lineSoft,
  },
  trZebra: { backgroundColor: S.panel2 },
  trPicked: { backgroundColor: S.accentSoft },
  trLocked: { opacity: 0.78 },
  td: { paddingHorizontal: TABLE.cellPadX, paddingVertical: SP.xs, justifyContent: 'center' },
  tdCenter: { alignItems: 'center' },
  /* DAR SAYI SÜTUNLARI (SIRA · SAAT): standart hücre dolgusu bu genişlikte
     içeriği kırpıyordu — başlangıç saati "20:00" yerine "20:0" görünüyordu ve
     bu kırpık saat paylaşılan ekran görselinde de çıkıyordu. Dolgu daralır,
     sütun birkaç piksel genişler; saat ve sıra numarası tam yazılır. */
  tdDar: { paddingHorizontal: 5 },
  tdMac: { flex: 1, minWidth: 0 },

  sira: { color: S.inkSoft },
  zaman: { color: S.ink },
  zamanAlt: { color: S.inkDim },
  saat: { color: S.ink },

  macSatir: { flexDirection: 'row', alignItems: 'center', gap: Math.round(5), minWidth: 0 },
  takim: { color: S.ink, flexShrink: 1 },
  tire: { color: S.inkDim, marginHorizontal: 1 },
  kilitIm: { marginLeft: 2 },
  notIm: { marginLeft: 2 },
  macAlt: { flexDirection: 'row', alignItems: 'center', gap: SP.sm, flexWrap: 'wrap' },
  altBilgi: { color: S.inkDim },

  analizRozet: {
    flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: R.sm,
    paddingHorizontal: 5, paddingVertical: 2, alignSelf: 'flex-start',
  },
  analizTxt: {},
  analizOk: {},

  tfoot: {
    color: S.inkDim, lineHeight: 16, paddingHorizontal: TABLE.cellPadX,
    paddingVertical: SP.sm, backgroundColor: S.panel2,
  },

  /* — sağ özet — */
  yan: { width: '100%' },
  yanKutu: {
    backgroundColor: S.panel, borderWidth: TABLE.hair, borderColor: S.line, borderRadius: R.md,
    overflow: 'hidden',
  },
  yanBas: {
    backgroundColor: S.head, paddingHorizontal: SP.md, paddingVertical: SP.sm,
    justifyContent: 'center',
  },
  yanGovde: { padding: SP.md, gap: SP.sm },

  sayiSatir: { flexDirection: 'row', alignItems: 'center', gap: SP.md },
  buyukSayi: { color: S.ink },
  buyukSayiSoft: { color: S.inkDim },
  sayiLbl: { color: S.inkSoft, marginBottom: 4 },

  ayirici: { height: TABLE.hair, backgroundColor: S.lineSoft, marginVertical: 1 },
  ozetSatir: { flexDirection: 'row', alignItems: 'center' },
  ozetLbl: { color: S.inkSoft },
  ozetVal: {},

  uyari: { color: S.bad, lineHeight: 16 },
  // BİLGİ ≠ UYARI: kırmızı yalnız "bunu düzeltmen gerekiyor" derken kullanılır.
  // Kolon sayısı notu bir engel olmadığı için sakin renkte durur.
  bilgi: { color: S.inkSoft, lineHeight: 16 },
  kilitKutu: {
    borderRadius: R.sm, borderWidth: TABLE.hair, borderColor: S.line,
    backgroundColor: S.panel2, paddingVertical: SP.sm, paddingHorizontal: SP.md, gap: 2,
  },
  kilitBas: { color: S.ink },
  kilitTxt: { color: S.inkSoft, lineHeight: 16 },

  /* — kupon kaydı — */
  kayitAlan: { gap: SP.xs },
  ad: {
    backgroundColor: S.panel, borderWidth: TABLE.hair, borderColor: S.line, borderRadius: R.sm,
    color: S.ink, paddingHorizontal: SP.sm, paddingVertical: SP.sm,
  },
  kaydet: { backgroundColor: S.accent, borderRadius: R.sm, paddingVertical: SP.md, alignItems: 'center' },
  kaydetPasif: { opacity: 0.42 },
  kaydetTxt: { color: S.accentInk, letterSpacing: 0.6 },
  kayitNot: { color: S.inkDim, lineHeight: 14 },
  kayitKutu: {
    borderRadius: R.sm, borderWidth: TABLE.hair, borderColor: S.line,
    backgroundColor: S.panel2, paddingVertical: SP.sm, paddingHorizontal: SP.md, gap: 2,
  },
  kayitBas: { color: S.good },

  /* — paylaşılan kare — */
  kare: { backgroundColor: S.bg, gap: SP.xs },
  kareBas: { flexDirection: 'row', alignItems: 'center', gap: SP.sm, paddingHorizontal: 2 },
  kareMarka: { color: S.ink },
  // paddingRight: numberOfLines={1} bu metni "taşanı kes" kutusuna sokar ve kutu
  // genişliği tarayıcının ölçtüğü metin genişliğidir. Kare alınırken metin bir
  // tık farklı ölçülüp son harfin kenarı kutunun dışında kalabiliyor; birkaç
  // piksel pay, paylaşılan görselde son harfin kırpılmasını önler.
  kareHafta: { color: S.inkSoft, paddingRight: 3 },
  kareNot: { color: S.inkDim, lineHeight: 13, paddingHorizontal: 2 },

  yanBtns: { gap: SP.xs, marginTop: 2 },
  btn: { borderRadius: R.sm, paddingVertical: 9, paddingHorizontal: 12, alignItems: 'center' },
  btnMesgul: { opacity: 0.55 },
  btnMain: { backgroundColor: S.accent },
  btnMainTxt: { color: S.accentInk },
  btnGhost: { backgroundColor: S.panel2, borderWidth: TABLE.hair, borderColor: S.lineStrong },
  btnGhostTxt: { color: S.inkSoft },

  bottom: {
    borderTopWidth: TABLE.hair, borderTopColor: S.line, backgroundColor: S.panel,
    paddingHorizontal: SP.md, paddingVertical: 7,
  },
});
