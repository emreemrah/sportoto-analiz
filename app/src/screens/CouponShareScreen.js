// KUPON PAYLAŞIMI — kaydedilen kupon PNG olarak paylaşılır
// (web: html2canvas → paylaş/indir · telefon: view-shot + expo-sharing).
//
// GÖRÜNÜM (kullanıcı isteği: "kuponlarım kısmını da yayıncı modundaki gibi
// görsellerden yapalım"): paylaşılan kare artık elle çizilen koyu lacivert bir
// tuval değil, yayın stüdyosunun RESMÎ BÜLTEN TABLOSUDUR — sıra no · ev arması ·
// takım adları · konuk arması · 1-0-2 kutuları. Tablo parçaları
// couponStudioParts.js'ten gelir; burada ikinci bir tablo yazılmaz.
//
// NEDEN TUVAL BIRAKILDI: elle çizilen tuvale kulüp armaları hiç giremiyordu
// (tuvale ancak okuma izni olan bir görsel çizilebilir ve armalar tek tek elle
// yüklenmiyordu). Ekranın kendisinin karesi alınınca armalar da kareye giriyor
// — gerekçesi ve çözümü studioShare.js ile crestUrl.js başında yazılı.
//
// GÜVENLİK/DÜRÜSTLÜK KURALLARI (kesin):
// • Görselde HESAP BİLGİSİ, telefon, e-posta, belirteç veya hassas veri YOKTUR —
//   yalnız uygulama adı, sezon/hafta, seçimler, kolon (+istenirse tutar).
//   Kupon adı ve kupon numarası da kareye GİRMEZ, dosya adına da yazılmaz.
// • "Kesin sonuç veya kazanç vaadi değildir." açıklaması her görselde vardır;
//   metin brand.js'ten gelir, elle yazılamaz ve silinemez.
// • Kilitli tahmin YALNIZ kullanıcı beyanıysa "kullanıcı beyanı, bağımsız
//   olarak doğrulanmamıştır" diye açık yazılır — hiçbir dış doğrulama
//   entegrasyonu yoktur, asla "doğrulandı" gibi gösterilmez.
// • İPTAL HATA DEĞİLDİR: kullanıcı paylaşım menüsünü kapatınca kırmızı hata
//   basılmaz.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, Share } from 'react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { api } from '../api';
import { APP_NAME_UPPER, LEGAL_FOOTER } from '../brand';
import { S, R, SP, TABLE, ETIKET } from '../studioTheme';
import { fontOf, TABULAR } from '../studioFonts';
import {
  Tablo, Thead, Th, Tfoot, MacSatiri, Dugme, Not, PickBoxes, useKuponOlcek,
} from './couponStudioParts';
import {
  SHARE_MIME, couponShareFileNameOf, couponShareTitleOf, couponShareCaptionOf,
  sharePngOnWeb, isAbortError, shareDoneTextOf, shareErrorTextOf, tabularOff,
  inlineImagesForCapture, capturePngDataUri,
} from '../studioShare';
import { getCoupon, finalVersion } from '../coupon/store';
import { costOf, validPricing } from '../couponConfig';
import { buildShareText } from '../couponEval';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { EmptyState } from '../ui';

// KART: içerik kadar yüksek, ekran genişliğine uyar (sohbet/mesaj paylaşımı).
// HİKÂYE: 9:16 — 540×960 ölçülen kare 2× alınınca tam 1080×1920 çıkar, yani
// Instagram/TikTok hikâye boyutu ölçek uydurmadan tutar.
const KART_MAX = 720;
const STORY_W = 540;
const STORY_H = 960;

export default function CouponShareScreen({ route }) {
  const { couponId, roundId, roundName, season } = route.params || {};
  const [hist, setHist] = useState(null);
  const [bulten, setBulten] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCost, setShowCost] = useState(false);
  const [format, setFormat] = useState('card'); // 'card' | 'story' (yalnız web)
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const paylasRef = useRef(null);

  const load = useCallback(async () => {
    try {
      setError(null); setLoading(true);
      setHist(await api.history(roundId));
      // Güncel bülten iki iş görür: birim bedel kaydı (uydurulmaz) ve hafta
      // arşive düşmemişse maç/arma kaynağı.
      try {
        const b = await api.bulletin();
        setBulten(b || null);
        setPricing(validPricing(b?.couponPricing) ? b.couponPricing : null);
      } catch { setBulten(null); setPricing(null); }
    }
    catch (e) { setError(e.message || 'Bülten bilgisi alınamadı.'); }
    finally { setLoading(false); }
  }, [roundId]);
  useEffect(() => { load(); }, [load]);

  // Ölçek/punto/font — koşullu return'lerden ÖNCE (kanca sırası bozulmasın).
  const { k, t, f, dar } = useKuponOlcek();

  const coupon = getCoupon(couponId);
  if (loading && !hist) return <LoadingState message="Kupon hazırlanıyor…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!coupon) return <EmptyState icon="🎟️" title="Kupon bulunamadı" message="Paylaşılacak kupon yok." />;
  const v = finalVersion(coupon);
  if (!v) return <EmptyState icon="🎟️" title="Kupon boş" message="Bu kuponun kayıtlı seçimi yok." />;

  // Maç satırının GÖRSEL kaynağı: hafta arşive düştüyse arşiv, düşmediyse
  // güncel bülten. İkisi de yoksa satır çizilir ama takım adı yerine "—" durur
  // (uydurma ad ya da "benzeri" arma ASLA konmaz).
  const macKaynak = (hist?.matches?.length ? hist.matches : (bulten?.matches || []));
  const macByNo = new Map(macKaynak.map((m) => [m.no, m]));
  const teamsByNo = {};
  for (const [no, m] of macByNo) {
    teamsByNo[no] = { home: m.home?.mediumName || m.home?.name || '?', away: m.away?.mediumName || m.away?.name || '?' };
  }

  const seasonTxt = season ? `${season} Sezonu` : '';
  const headSub = [seasonTxt, roundName].filter(Boolean).join(' · ')
    || (roundId != null ? `Hafta ${roundId}` : '');
  const playedLine = coupon.playedMarkedAt
    ? 'Tahmin kilitlendi — kullanıcı beyanı, bağımsız olarak doğrulanmamıştır'
    : null;
  const tutar = showCost ? costOf(v.columnCount, pricing) : null;

  // Hikâye karesi dar olduğu için kutular da dar çizilir; aksi hâlde sağ sütun
  // taşar ve işaretler kırpılır.
  const kompakt = dar || format === 'story';
  const sagGenislik = kompakt ? 104 : 122;

  const altSatirlar = [`Kolon: ${v.columnCount}${tutar != null ? ` · Tutar: ${tutar} TL` : ''}`];
  if (playedLine) altSatirlar.push(playedLine);

  /* ————— PAYLAŞILAN KARE —————
     Kadraj: yalnız <ViewShot> içi. Boyut seçenekleri, tutar anahtarı ve
     paylaşım düğmesi kadrajın DIŞINDA kalır — görselde arayüz izi olmaz. */
  const kare = (
    // NOT: <ViewShot> yalnız bildiği prop'ları geçirir, `testID`'yi DÜŞÜRÜR
    // (kitaplık kaynağı: props destructure edilir, spread yoktur). Bu yüzden
    // kadraja işaret konmaz; gizlilik denetimi kadrajı DOM'dan bulur
    // (scripts/render-coupon.mjs · `kadrajMetni`).
    <ViewShot ref={paylasRef} style={[st.kare, format === 'story' ? st.kareStory : st.kareKart]}>
      <View style={st.kareBas}>
        <Text style={[st.kareMarka, fontOf(700, f), ETIKET, { fontSize: t.kucuk }]} numberOfLines={1}>
          {APP_NAME_UPPER}
        </Text>
        <View style={{ flex: 1, minWidth: 0 }} />
        <Text style={[st.kareHafta, fontOf(600, f), TABULAR, { fontSize: t.kucuk }]} numberOfLines={1}>
          {headSub}
        </Text>
      </View>

      <Tablo testID="kupon-paylas-tablo">
        <Thead k={k}>
          <Th text="SIRA" k={k} style={{ width: Math.round(32 * k), paddingHorizontal: 5 }} center />
          <Th text="EV SAHİBİ - KONUK TAKIM" k={k} style={{ flex: 1, minWidth: 0 }} />
          <Th text="1 - 0 - 2" tam="Kupondaki işaret" k={k} style={{ width: Math.round(sagGenislik * k) }} center />
        </Thead>

        {(v.selections || []).map((sc, i) => {
          const m = macByNo.get(sc.no);
          const secimler = sc.selectedOutcomes || [];
          return (
            <MacSatiri
              key={sc.no}
              k={k}
              zebra={i % 2 === 1}
              // `secili` KASITLI OLARAK VERİLMEZ: kupondaki her satır zaten
              // işaretlidir, hepsini turuncuya boyamak hiçbir satırı ayırmaz —
              // yalnız zebrayı yutup tabloyu soluk somon bir bloğa çevirirdi.
              // Hangi işaretin basıldığını sağdaki kutular gösterir.
              sira={sc.no}
              home={m?.home?.mediumName || m?.home?.name}
              away={m?.away?.mediumName || m?.away?.name}
              homeLogo={m?.home?.logo}
              awayLogo={m?.away?.logo}
              testID={`kupon-paylas-satir-${sc.no}`}
              // `salt` — `disabled` DEĞİL. Kare zaten dokunulamaz; `disabled`
              // kutuları %42 saydam çizip paylaşılan görseli soluk yapıyordu.
              sag={<PickBoxes outcomes={secimler} salt k={k} compact={kompakt} />}
              sagGenislik={sagGenislik}
            />
          );
        })}

        <Tfoot k={k}>{altSatirlar.join('\n')}</Tfoot>
      </Tablo>

      <Text style={[st.kareNot, fontOf(400, f), { fontSize: t.mikro }]}>
        {LEGAL_FOOTER} · Yalnız resmî Spor Toto sonucu kesindir.
        Seçimler kullanıcının kendi kararıdır.
      </Text>
    </ViewShot>
  );

  const paylas = async () => {
    if (busy) return;
    setBusy(true); setDone('');
    try {
      const web = Platform.OS === 'web';
      // Web'de kare alan kitaplık eşit-genişlik rakamı yok sayıyor; sayılar
      // kaymasın diye ayar kare boyunca kapatılır (ayrıntı: studioShare.js).
      const tabularGeri = web ? tabularOff() : null;
      // ARMALAR KAREYE GİRSİN DİYE ÖNCE GÖMÜLÜR (yalnız web). İnmeyen arma
      // yerine nötr ⚽ konur — başka kulübün arması asla konmaz.
      const armaGeri = web ? await inlineImagesForCapture(paylasRef.current) : null;
      let goruntu;
      try {
        if (web) goruntu = await capturePngDataUri(paylasRef.current, { backgroundColor: S.bg });
        if (!goruntu) {
          goruntu = await captureRef(
            paylasRef,
            web ? { format: 'png', quality: 1, result: 'data-uri' } : { format: 'png', quality: 1 },
          );
        }
      } finally {
        if (armaGeri) armaGeri();
        if (tabularGeri) tabularGeri();
      }
      const dosyaAdi = couponShareFileNameOf({ roundId, weekNumber: hist?.weekNumber });
      const yazi = couponShareCaptionOf({ roundId, columnCount: v.columnCount });
      if (web) {
        setDone(shareDoneTextOf(await sharePngOnWeb(goruntu, dosyaAdi, yazi)));
      } else if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(goruntu, { mimeType: SHARE_MIME, dialogTitle: couponShareTitleOf({ roundId }) });
        setDone(shareDoneTextOf('shared'));
      } else {
        // Görsel paylaşımı açılamıyorsa kuponun METNİ yine gider; özellik
        // sessizce kaybolmaz.
        await Share.share({
          message: buildShareText({ coupon, roundName, season: seasonTxt, teamsByNo, cost: tutar }),
        });
        setDone('Bu cihazda görsel paylaşımı açılamadı; kupon metin olarak paylaşıldı.');
      }
    } catch (e) {
      // Kullanıcı menüyü kapattıysa bu bir hata değildir; ekran sessiz kalır.
      setDone(isAbortError(e) ? '' : shareErrorTextOf(e));
    } finally {
      setBusy(false);
    }
  };

  const anahtar = (acik, etiket, onPress, testID) => (
    <TouchableOpacity
      style={[st.anahtar, acik && st.anahtarAcik]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!acik }}
      testID={testID}
    >
      <Text style={[st.anahtarTxt, acik && st.anahtarTxtAcik, fontOf(600, f), ETIKET, { fontSize: t.mikro }]}>
        {etiket}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={st.root} contentContainerStyle={st.body}>
      {/* Önizleme = paylaşılacak görselin BİREBİR kendisi (aynı düğüm). */}
      {kare}

      {Platform.OS === 'web' ? (
        <View style={st.secimSatir}>
          <Text style={[st.secimEtiket, fontOf(600, f), { fontSize: t.kucuk }]}>Görsel boyutu</Text>
          {anahtar(format === 'card', 'KART', () => setFormat('card'), 'kupon-paylas-kart')}
          {anahtar(format === 'story', 'HİKÂYE 9:16', () => setFormat('story'), 'kupon-paylas-story')}
        </View>
      ) : null}

      <View style={st.secimSatir}>
        <Text style={[st.secimEtiket, fontOf(600, f), { fontSize: t.kucuk }]}>
          {pricing ? 'Tutarı görselde göster' : 'Tutar gösterilemez — birim bedel verisi yok'}
        </Text>
        {anahtar(showCost, showCost ? 'AÇIK' : 'KAPALI', () => pricing && setShowCost((x) => !x), 'kupon-paylas-tutar')}
      </View>

      <Dugme
        text={busy ? 'Görsel hazırlanıyor…' : '📸 Kupon görselini paylaş'}
        onPress={paylas}
        disabled={busy}
        ana
        k={k}
        testID="kupon-paylas-btn"
      />
      {done ? (
        <Text style={[st.sonuc, fontOf(600, f), { fontSize: t.kucuk }]} testID="kupon-paylas-mesaj">{done}</Text>
      ) : null}

      <Not
        k={k}
        text={'Görselde hesap bilgisi, e-posta veya kişisel veri BULUNMAZ — yalnız sezon/hafta, seçimler ve kolon bilgisi. '
          + 'İşaretler resmî yazımla gösterilir (1 - 0 - 2; "0" beraberlik). '
          + 'Kupon hatası olursa görsel yerelden yeniden üretilir; kupon kaybolmaz.'}
      />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: S.bg },
  body: { padding: SP.lg, paddingBottom: SP.xl * 2, alignItems: 'center', gap: SP.md },

  // Kare: tablonun etrafına yalnız iki şerit — üstte marka + hafta, altta yaş
  // ve dürüstlük bildirimi. Zemin stüdyonun zemini ki kare ekranla aynı çıksın.
  kare: { backgroundColor: S.bg, gap: SP.xs, padding: SP.sm, alignSelf: 'center' },
  kareKart: { width: '100%', maxWidth: KART_MAX },
  kareStory: { width: STORY_W, minHeight: STORY_H, justifyContent: 'center' },
  kareBas: { flexDirection: 'row', alignItems: 'center', gap: SP.sm, paddingHorizontal: 2 },
  kareMarka: { color: S.ink },
  // paddingRight: numberOfLines={1} bu metni "taşanı kes" kutusuna sokar; kare
  // alınırken metin bir tık farklı ölçülüp son harf kırpılabiliyor. Birkaç
  // piksel pay bunu önler (bülten karesinde de aynı sebeple var).
  kareHafta: { color: S.inkSoft, paddingRight: 3 },
  kareNot: { color: S.inkDim, lineHeight: 13, paddingHorizontal: 2 },

  secimSatir: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SP.sm, alignSelf: 'stretch' },
  secimEtiket: { color: S.inkSoft, flexShrink: 1 },
  anahtar: {
    borderWidth: TABLE.hair, borderColor: S.line, borderRadius: R.sm,
    paddingHorizontal: 10, paddingVertical: 5, backgroundColor: S.panel,
  },
  anahtarAcik: { backgroundColor: S.accentSoft, borderColor: S.accent },
  anahtarTxt: { color: S.inkSoft },
  anahtarTxtAcik: { color: S.accent },

  sonuc: { color: S.ink, textAlign: 'center' },
});
