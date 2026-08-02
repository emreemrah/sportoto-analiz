// KAYAN ŞERİT — soldan sağa DURMADAN dönen yatay satır (ortak mekanizma).
// ---------------------------------------------------------------------------
// Hem lig şeridi hem yaklaşan maç şeridi bunu kullanır. Ayrı ayrı yazılsaydı
// aşağıdaki inceliklerden biri bir yerde düzeltilip diğerinde unutulurdu.
//
// 1) İKİ KOPYA: dikişsiz döngü için içerik iki kez çizilir. Birinci kopya tam
//    genişliği kadar sola kayınca ikinci kopya onun yerini almış olur; başa
//    dönüşte görüntüde sıçrama olmaz. Tek kopyayla her turda "zıplama" olur.
//
// 2) DOKUNMAYLA DURDURMA YOK — BİLEREK.
//    Bir zamanlar "parmak değince dursun" vardı. Kullanıcı sayfayı DİKEY
//    kaydırdığında dokunuş şeridin üstünde başlıyor, sonra hareketi üstteki
//    liste devralıyor ve "parmak kalktı" olayı şeride HİÇ gelmiyordu. Bayrak
//    kalkık kaldığı için şerit KALICI olarak duruyordu. Kullanıcının şikâyeti
//    tam buydu ve isteği net: durmasın. Buraya tekrar dokunma duraklatması
//    EKLENMEMELİ; eklenecekse duraklatma responder olaylarıyla (onResponder-
//    Terminate dahil) kurulmalı, ham onTouch* ile değil.
//
// 3) JS SÜRÜCÜSÜ — BİLEREK (useNativeDriver: false).
//    Yerel sürücü daha akıcıdır ama animasyon görünüm ağacından koptuğunda
//    SESSİZCE ölür ve JS tarafına hiçbir haber gelmez: ne geri çağrı, ne
//    değer güncellemesi. Yani "durdu mu?" sorusu YANITSIZDIR ve kendini
//    onaran bir mekanizma kurulamaz — önceki denemede tam bu yüzden çalışmadı.
//    JS sürücüsünde değer her karede JS'e ulaşır, böylece duruş ÖLÇÜLEBİLİR
//    (bkz. bekçi). Bedeli: JS iş parçacığı çok meşgulken hafif takılma.
//    Bilinçli takas — "arada bir takılan" şerit, "bir daha hiç dönmeyen"
//    şeritten iyidir.
//
// 4) BEKÇİ: değer belli bir süredir hiç kıpırdamadıysa döngü ölmüş demektir;
//    yeniden kurulur. Arka plandan dönüş, görünümden düşme ve Android'in
//    sarmalayıcıyı kaldırması dahil TÜM sebepleri tek yerden karşılar —
//    sebep sebep kovalamaya gerek kalmaz.
//
// 5) HAREKET AZALTMA: durdurulamayan otomatik hareket, vestibüler rahatsızlığı
//    olan kullanıcılar için gerçek bir sorundur (WCAG 2.2.2). Cihazda "hareketi
//    azalt" açıksa şerit KAYMAZ; parmakla kaydırılan normal bir satır olur.
//    Bilgi kaybı yoktur — aynı içerik, aynı sırada.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Animated, Easing, StyleSheet, ScrollView, AccessibilityInfo, AppState,
} from 'react-native';

// Varsayılan kayma hızı (piksel/saniye). Okunabilirlik sınırı: bundan hızlısında
// içerik gözle takip edilemiyor, yavaşında şerit donmuş gibi duruyor.
export const VARSAYILAN_HIZ = 34;

// Bekçi aralığı ve "ölmüş sayılma" eşiği. Eşik aralıktan büyük olmalı, yoksa
// normal bir kare gecikmesi bile duruş sanılıp gereksiz yeniden kurulur.
const BEKCI_ARALIK_MS = 2000;
const OLU_SAYILMA_MS = 3000;

export default function KayanSerit({
  children,
  hiz = VARSAYILAN_HIZ,
  accessibilityLabel,
  testID,
  style,
}) {
  const [genislik, setGenislik] = useState(0);
  const [azalt, setAzalt] = useState(false);
  const kaydir = useRef(new Animated.Value(0)).current;

  const anim = useRef(null);
  const sonDeger = useRef(0);
  const sonHareket = useRef(Date.now());

  // Cihazın hareket azaltma tercihi. Sorgu başarısız olursa varsayılan "kapalı"
  // kalır — tercih okunamadı diye şeridi kaldırmak, özelliği sessizce yok
  // etmek olurdu.
  useEffect(() => {
    let canli = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => { if (canli) setAzalt(!!v); })
      .catch(() => { /* tercih okunamadı — varsayılanla devam */ });
    const abone = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged', (v) => { if (canli) setAzalt(!!v); },
    );
    return () => { canli = false; abone?.remove?.(); };
  }, []);

  // İLERLEME ÖLÇÜMÜ: bekçinin tek bilgi kaynağı. JS sürücüsü olmadan bu
  // dinleyici hiç tetiklenmez (yerel sürücü JS'e değer göndermez).
  useEffect(() => {
    const kimlik = kaydir.addListener(({ value }) => {
      if (value !== sonDeger.current) {
        sonDeger.current = value;
        sonHareket.current = Date.now();
      }
    });
    return () => kaydir.removeListener(kimlik);
  }, [kaydir]);

  const donguyuBaslat = useCallback(() => {
    if (!genislik || azalt) return;
    anim.current?.stop();            // üst üste binen iki döngü hızı ikiye katlar
    kaydir.setValue(0);
    sonDeger.current = 0;
    sonHareket.current = Date.now();
    anim.current = Animated.loop(
      Animated.timing(kaydir, {
        toValue: -genislik,
        duration: (genislik / hiz) * 1000,
        easing: Easing.linear,
        useNativeDriver: false,      // gerekçe: dosya başlığı, madde 3
      }),
    );
    anim.current.start();
  }, [genislik, azalt, hiz, kaydir]);

  useEffect(() => {
    donguyuBaslat();
    return () => anim.current?.stop();
  }, [donguyuBaslat]);

  // BEKÇİ — duruşun SEBEBİNİ değil, KENDİSİNİ yakalar.
  useEffect(() => {
    if (!genislik || azalt) return undefined;
    const is = setInterval(() => {
      if (Date.now() - sonHareket.current > OLU_SAYILMA_MS) donguyuBaslat();
    }, BEKCI_ARALIK_MS);
    return () => clearInterval(is);
  }, [genislik, azalt, donguyuBaslat]);

  // Arka plandan dönüşte beklemeden başlat: bekçi zaten yakalar ama kullanıcı
  // ekrana baktığı anda duran bir şerit görmemeli.
  useEffect(() => {
    const abone = AppState.addEventListener?.('change', (durum) => {
      if (durum === 'active') donguyuBaslat();
    });
    return () => abone?.remove?.();
  }, [donguyuBaslat]);

  if (azalt) {
    return (
      <View style={[styles.sarmal, style]} testID={testID}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.satir}
          accessible={!!accessibilityLabel}
          accessibilityLabel={accessibilityLabel}
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View
      style={[styles.sarmal, style]}
      testID={testID}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
    >
      {/* collapsable={false}: Android yalnız çocuklarını saran bir görünümü
          yerel ağaçtan kaldırabiliyor; kaldırılan görünüme yazılan dönüşüm
          hiçbir yere gitmez. */}
      <Animated.View
        collapsable={false}
        style={[styles.satir, { transform: [{ translateX: kaydir }] }]}
      >
        {/* Genişlik BURADAN ölçülür: döngünün mesafesi ve süresi buna bağlı.
            testID, ölçümü testte tetikleyebilmek için (onLayout test ortamında
            kendiliğinden çalışmaz). */}
        <View
          style={styles.satir}
          testID={testID ? `${testID}-olcum` : undefined}
          onLayout={(e) => setGenislik(e.nativeEvent.layout.width)}
        >
          {children}
        </View>
        {/* İkinci kopya YALNIZ görsel süreklilik için; ekran okuyucuya içeriği
            iki kez okutmamak adına erişilebilirlik dışı bırakılır. */}
        <View style={styles.satir} importantForAccessibility="no-hide-descendants">
          {children}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sarmal: {
    overflow: 'hidden',          // kayan içerik kartın dışına taşmasın
  },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
