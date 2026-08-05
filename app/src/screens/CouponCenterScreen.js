// KUPON MERKEZİ — kupon listesi/yönetim ekranı (sıfırdan; eski CouponsScreen'in
// yerini alır). Hafta hafta gezilir; her kuponun adı, oluşturma/güncelleme
// zamanı, kolon sayısı, (fiyat verisi varsa) maliyeti ve durumu görünür.
// Kuponlar birbirinden bağımsızdır (kopya dahil). Başarı YALNIZ resmi sonuçla,
// kilitli final versiyonla kesinleşir (couponEval).
//
// GÖRÜNÜM (kullanıcı isteği: "kuponlarım kısmını da yayıncı modundaki gibi
// görsellerden yapalım"): her kupon, yayın stüdyosunun RESMÎ BÜLTEN TABLOSU
// olarak açılır — sıra no · ev arması · takım adları · konuk arması · 1-0-2
// kutuları. Tablo parçaları couponStudioParts.js'ten gelir; burada ikinci bir
// tablo yazılmaz. Armalar zaten bülten/geçmiş hafta verisiyle geliyordu
// (m.home.logo / m.away.logo) — yalnız çizilmiyordu.
//
// KUTULAR SALT OKUNUR: kupon burada DÜZENLENMEZ. 1-0-2 kutuları yalnız kayıtlı
// seçimi gösterir (disabled); değiştirme tek yerden, Kupon Editörü'nden yapılır.
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { uyari } from '../components/Uyari';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { S, R, SP, TABLE } from '../studioTheme';
import { fontOf } from '../studioFonts';
import {
  Tablo, Thead, Th, MacSatiri, AltBilgi, SayiKutu, Dugme, Not, Chip, PickBoxes, useKuponOlcek,
} from './couponStudioParts';
import { isLockedNow, MAX_COUPONS_PER_WEEK, costOf, validPricing, lockMapOf, toOfficial } from '../couponConfig';
import {
  getWeekCoupons, finalVersion, setRanked, deleteCoupon, copyCoupon,
  syncFromServer, getSyncState, retrySync, subscribeCoupons, markPlayed,
} from '../coupon/store';
import { evalCoupon, normResult, buildShareText } from '../couponEval';
import LoadingState from '../components/LoadingState';
import TakimLogoZemin from '../components/TakimLogoZemin';

const fmtTL = (n) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} TL`;
const fmtDT = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
};
// Resmî bülten yazımı: 'X' → '0', çoklu seçim tire ile ayrılır ('1X' → '1-0').
const resmi = (sym) => (sym ? String(sym).split('').map(toOfficial).join('-') : null);

export default function CouponCenterScreen({ navigation }) {
  const [rounds, setRounds] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [hist, setHist] = useState(null);
  const [bulletin, setBulletin] = useState(null);
  const [histLoading, setHistLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);
  // Hangi kuponun maç tablosu açık? (kupon id → true/false)
  const [acikTablo, setAcikTablo] = useState({});

  const boot = useCallback(async () => {
    try {
      const [r, b] = await Promise.all([api.rounds(), api.bulletin().catch(() => null)]);
      setRounds(r); setBulletin(b);
      setSelectedId((prev) => prev ?? r?.currentRoundId ?? null);
    } catch {}
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => {
    let alive = true;
    boot();
    setTick((t) => t + 1);
    syncFromServer().then((r) => { if (alive && r?.synced) setTick((t) => t + 1); });
    const unsub = subscribeCoupons(() => { if (alive) setTick((t) => t + 1); });
    return () => { alive = false; unsub(); };
  }, [boot]));

  useEffect(() => {
    if (selectedId == null) return;
    let alive = true;
    setHistLoading(true);
    api.history(selectedId).then((h) => { if (alive) setHist({ ...h, roundId: selectedId }); }).catch(() => { if (alive) setHist(null); }).finally(() => { if (alive) setHistLoading(false); });
    return () => { alive = false; };
  }, [selectedId, tick]);

  // Ölçek/punto/font — koşullu return'lerden ÖNCE (kanca sırası bozulmasın).
  const { k, t, f, dar } = useKuponOlcek();

  const all = rounds?.rounds || [];
  const currentRoundId = rounds?.currentRoundId ?? null;
  const curIdx = all.findIndex((r) => r.id === currentRoundId);
  const navRounds = curIdx >= 0 ? all.slice(0, curIdx + 1) : all;
  const selIdx = navRounds.findIndex((r) => r.id === selectedId);
  const selMeta = navRounds[selIdx] || null;
  const canPrev = selIdx > 0, canNext = selIdx >= 0 && selIdx < navRounds.length - 1;

  const coupons = selectedId != null ? getWeekCoupons(selectedId) : [];
  const resultMap = new Map((hist?.matches || []).filter((m) => m.result && m.score).map((m) => [m.no, m.result]));
  const pricing = validPricing(bulletin?.couponPricing) ? bulletin.couponPricing : null;
  const lockAt = coupons[0]?.lockedAt ?? null;
  const locked = isLockedNow(lockAt); // dereceli kupon seçimi için (ilk maçta donar)
  const isCurrent = selectedId === currentRoundId;
  // KİLİT MAÇ BAZINDA: güncel haftada EN AZ BİR maç başlamadıysa kupon
  // açılabilir/düzenlenebilir; yalnız TÜM maçlar başlayınca hafta kapanır.
  const bulletinMatches = (isCurrent && bulletin?.roundId === selectedId) ? (bulletin.matches || []) : [];
  const lockMap = lockMapOf(bulletinMatches);
  const nowMs = Date.now();
  const openCount = bulletinMatches.filter((m) => lockMap[m.no] == null || nowMs < lockMap[m.no]).length;
  const canEdit = isCurrent && (bulletinMatches.length ? openCount > 0 : !locked);

  // Maç satırının GÖRSEL kaynağı: güncel haftada bülten, geçmişte hafta arşivi.
  // İkisi de yoksa satır çizilir ama takım adı yerine "—" durur (uydurulmaz).
  const macKaynak = bulletinMatches.length ? bulletinMatches : (hist?.matches || []);
  const macByNo = new Map(macKaynak.map((m) => [m.no, m]));

  // SİLME NEDEN KAPALI? — düğmeyi sessizce yok etmek yerine sebebini yazarız.
  // İlke: "SEBEPSİZ KAPALI DÜĞME, SESSİZ DÜĞMEDEN BETERDİR."
  // Kilitli/geçmiş hafta kuponu silinmez: silinirse tutturma karnesi geriye
  // dönük değişir; kaydın kendisi kullanıcının geçmiş beyanıdır.
  const silmeSebebi = canEdit
    ? null
    : (!isCurrent
      ? 'Geçmiş haftanın kuponu silinemez — karne kaydı geriye dönük değişmesin diye arşivde kalır.'
      : 'Maçlar başladı, hafta kilitlendi — kilitli kupon silinemez (geriye dönük karne değişmesin).');

  const statusOf = (c, ev) => {
    if (canEdit) return openCount && bulletinMatches.length && openCount < bulletinMatches.length
      ? `Açık · ${openCount} maç düzenlenebilir`
      : 'Açık · düzenlenebilir';
    if (!ev || ev.resolved === 0) return 'Kilitli · sonuçlar bekleniyor';
    if (!ev.allResolved) return `Resmî sonuçlar: ${ev.resolved}/${ev.total}`;
    return 'Sonuçlandı';
  };

  // KOPYALA = PANOYA METİN (kullanıcı kararı, 2026-08-04): maç listesi +
  // seçimler yazı olarak panoya gider. Eski "kuponu çoğalt" işlevi "Çoğalt"
  // adıyla duruyor — iki iş birbirine karışmaz.
  const doCopyText = async (c) => {
    const teamsByNo = Object.fromEntries(bulletinMatches.map((m) => [m.no, {
      home: m.home?.mediumName || m.home?.name || `Ev ${m.no}`,
      away: m.away?.mediumName || m.away?.name || `Dep ${m.no}`,
    }]));
    const metin = buildShareText({
      coupon: c, roundName: selMeta?.name, season: selMeta?.year ? `${selMeta.year} Sezonu` : null,
      teamsByNo: Object.keys(teamsByNo).length ? teamsByNo : null, cost: null,
    });
    if (!metin) { uyari.alert('Kopyalanamadı', 'Kuponun seçimleri okunamadı.'); return; }
    let ok = false;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(metin); ok = true;
      } else {
        // Telefonda RN'in panosu varsa kullanılır; yoksa dürüstçe söylenir.
        // eslint-disable-next-line global-require
        const rn = require('react-native');
        if (rn?.Clipboard?.setString) { rn.Clipboard.setString(metin); ok = true; }
      }
    } catch { ok = false; }
    uyari.alert(ok ? 'Panoya kopyalandı' : 'Kopyalanamadı',
      ok ? 'Maç listesi ve seçimlerin yazı olarak panoda — istediğin yere yapıştır.'
        : 'Bu cihazda panoya erişilemedi; Paylaş düğmesini kullanabilirsin.');
  };

  const doCopy = (c) => {
    const r = copyCoupon(c.id, bulletinMatches.length ? { lockMap } : {});
    if (r.error === 'locked') uyari.alert('Kilitli', 'Kilitli haftada kupon kopyalanamaz (yeni kupon açılamaz).');
    else if (r.error === 'locked-match') uyari.alert('Kilitli', 'Başlamış maç seçimleri yeni kupona taşınamaz.');
    else if (r.error === 'max') uyari.alert('Sınır', `Haftalık ${MAX_COUPONS_PER_WEEK} kupon hakkı doldu.`);
    else {
      if (r.strippedNos?.length) {
        uyari.alert('Kopyalandı', `Başlamış ${r.strippedNos.length} maçın seçimi kopyaya taşınmadı (${r.strippedNos.join(', ')}. maç) — geriye dönük isabet üretilmez.`);
      }
      setTick((t2) => t2 + 1);
    }
  };
  const doDelete = (c) => uyari.alert('Kupon sil', `"${c.name}" silinsin mi?`, [
    { text: 'Vazgeç' }, { text: 'Sil', style: 'destructive', onPress: () => { deleteCoupon(c.id); setTick((t2) => t2 + 1); } },
  ]);
  const doRanked = (c) => {
    const r = setRanked(selectedId, c.id);
    if (r.error === 'locked') uyari.alert('Değiştirilemez', 'Kilit sonrası dereceli kupon değiştirilemez.');
    setTick((t2) => t2 + 1);
  };
  const togglePlayed = (c) => {
    if (!c.playedMarkedAt) {
      uyari.alert('Tahminimi Kilitle', 'Bu işaret yalnızca senin beyanındır; bağımsız olarak DOĞRULANMAZ ve her yerde "kullanıcı beyanı" olarak görünür. Kilitlensin mi?', [
        { text: 'Vazgeç' }, { text: 'İşaretle', onPress: () => { markPlayed(c.id, true); setTick((t2) => t2 + 1); } },
      ]);
    } else { markPlayed(c.id, false); setTick((t2) => t2 + 1); }
  };

  const sync = getSyncState();
  if (loading && !rounds) return <LoadingState message="Kupon Merkezi yükleniyor…" />;

  const sagGenislik = dar ? 104 : 122;

  /* ————— BİR KUPONUN MAÇ TABLOSU ————— */
  const macTablosu = (v) => (
    <>
      <Thead k={k}>
        <Th text="SIRA" k={k} style={{ width: Math.round(32 * k), paddingHorizontal: 5 }} center />
        <Th text="EV SAHİBİ - KONUK TAKIM" k={k} style={{ flex: 1, minWidth: 0 }} />
        <Th text="1 - 0 - 2" tam="Senin işaretin" k={k} style={{ width: Math.round(sagGenislik * k) }} center />
      </Thead>

      {(v?.selections || []).map((sc, i) => {
        const m = macByNo.get(sc.no);
        const secimler = sc.selectedOutcomes || [];
        const sonuc = normResult(resultMap.get(sc.no));
        const tuttu = sonuc == null ? null : secimler.includes(sonuc);
        return (
          <MacSatiri
            key={sc.no}
            k={k}
            zebra={i % 2 === 1}
            // `secili` KASITLI OLARAK VERİLMEZ. Vurgu ancak AYIRIYORSA anlamlıdır:
            // Kupon Hazırla'da işaretli ve işaretsiz satırlar yan yana durur,
            // orada vurgu bilgi taşır. Kaydedilmiş kuponda ise HER satır zaten
            // işaretlidir; hepsini boyamak zebrayı yutup listeyi tek renk soluk
            // bir bloğa çeviriyordu. Hangi işaretin basıldığını sağdaki kutular
            // gösterir.
            sira={sc.no}
            home={m?.home?.mediumName || m?.home?.name}
            away={m?.away?.mediumName || m?.away?.name}
            homeLogo={m?.home?.logo}
            awayLogo={m?.away?.logo}
            testID={`kupon-merkez-satir-${sc.no}`}
            alt={(
              <>
                {m?.league ? <AltBilgi k={k} text={m.league} /> : null}
                {sonuc ? (
                  <AltBilgi
                    k={k}
                    text={`Resmî sonuç ${resmi(sonuc)} · ${tuttu ? 'tuttu ✅' : 'yattı ❌'}`}
                    color={tuttu ? S.good : S.bad}
                    sayi
                  />
                ) : null}
              </>
            )}
            // `salt` — `disabled` DEĞİL. Liste salt okunur; `disabled` bütün
            // işaretleri soldurup kaydedilmiş kuponu silik gösteriyordu.
            sag={<PickBoxes outcomes={secimler} salt k={k} compact={dar} />}
            sagGenislik={sagGenislik}
          />
        );
      })}
    </>
  );

  return (
    <View style={st.root}>
      {/* Favori takım arması zeminde soluk filigran (kullanıcı isteği). */}
      <TakimLogoZemin />
      {/* ————— ÜST ŞERİT: hafta gezinmesi ————— */}
      <View style={st.header}>
        <Text style={[st.sayfaBaslik, fontOf(700, f), { fontSize: t.baslik }]} numberOfLines={1}>
          🎟️ Kupon Merkezi
        </Text>
        <View style={st.haftaNav}>
          <TouchableOpacity
            onPress={() => canPrev && setSelectedId(navRounds[selIdx - 1].id)}
            disabled={!canPrev}
            style={[st.ok, !canPrev && st.okOff]}
            accessibilityRole="button"
            accessibilityLabel="Önceki hafta"
          >
            <Text style={[st.okTxt, fontOf(700, f)]}>‹</Text>
          </TouchableOpacity>
          <View style={st.haftaOrta}>
            <Text style={[st.haftaAd, fontOf(700, f), { fontSize: t.metin }]} numberOfLines={1}>{selMeta?.name || '—'}</Text>
            <Text style={[st.haftaSezon, fontOf(500, f), { fontSize: t.mikro }]} numberOfLines={1}>
              {selMeta?.year ? `${selMeta.year} Sezonu` : 'Sezon bilgisi yok'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => canNext && setSelectedId(navRounds[selIdx + 1].id)}
            disabled={!canNext}
            style={[st.ok, !canNext && st.okOff]}
            accessibilityRole="button"
            accessibilityLabel="Sonraki hafta"
          >
            <Text style={[st.okTxt, fontOf(700, f)]}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={st.body}>
        {sync.loggedIn && sync.error ? (
          <View style={st.uyariKutu}>
            <Text style={[st.uyariTxt, fontOf(600, f), { fontSize: t.kucuk }]}>
              ⚠️ Kupon sunucuya kaydedilemedi — yerelde güvende, kaybolmadı.
            </Text>
            <Dugme k={k} text="Tekrar Dene" onPress={() => retrySync().then(() => setTick((t2) => t2 + 1))} />
          </View>
        ) : null}

        {histLoading && !hist ? (
          <View style={st.yukleniyor}><ActivityIndicator color={S.accent} /></View>
        ) : null}

        {coupons.length === 0 ? (
          <View style={st.bosKutu}>
            <Text style={st.bosIkon}>🎟️</Text>
            <Text style={[st.bosBaslik, fontOf(700, f), { fontSize: t.buyuk }]}>Bu hafta kuponun yok</Text>
            {canEdit ? (
              <Dugme
                k={k} ana text="+ Kupon Oluştur" style={{ marginTop: SP.md }}
                onPress={() => navigation.navigate('CouponEditor', { roundId: selectedId })}
              />
            ) : (
              <Text style={[st.bosMetin, fontOf(400, f), { fontSize: t.metin }]}>
                {isCurrent ? 'Tüm maçlar başladı — bu haftaya artık kupon açılamaz.' : 'Geçmiş haftaya kupon oluşturulamaz (geriye dönük başarı üretilmez).'}
              </Text>
            )}
          </View>
        ) : (
          <>
            {coupons.map((c) => {
              const v = finalVersion(c);
              const ev = resultMap.size ? evalCoupon(c, resultMap) : null;
              const cost = costOf(v?.columnCount, pricing);
              const isaretli = (v?.selections || []).filter((sc) => sc.selectedOutcomes?.length).length;
              const toplam = (v?.selections || []).length;
              // Varsayılan: tek kupon varsa ya da dereceli kuponsa tablo açık gelir.
              const acik = acikTablo[c.id] ?? (coupons.length === 1 || !!c.isRankedCoupon);
              return (
                <Tablo key={c.id} style={[st.kupon, c.isRankedCoupon && st.kuponDereceli]} testID={`kupon-karti-${c.id}`}>
                  {/* koyu başlık şeridi — stüdyo tablosunun başlığıyla aynı */}
                  <View style={[st.kuponBas, { minHeight: Math.round(TABLE.headH * k) }]}>
                    <Text style={[st.kuponAd, fontOf(700, f), { fontSize: t.metin }]} numberOfLines={1}>{c.name}</Text>
                    <View style={{ flex: 1 }} />
                    {c.isRankedCoupon
                      ? <Chip text="⭐ DERECELİ" tone={S.accent} soft={S.accentSoft} k={k} />
                      : <Chip text="DERECESİZ" tone="#D6DDE5" k={k} />}
                  </View>

                  {/* ölçüler — hepsi HAZIR gelir, burada hesaplanmaz */}
                  <View style={st.olcuSatir}>
                    <SayiKutu k={k} etiket="KOLON" deger={String(v?.columnCount ?? '—')} />
                    <SayiKutu
                      k={k} etiket="MALİYET"
                      deger={cost != null ? fmtTL(cost) : '—'}
                      alt={cost != null ? null : 'fiyat verisi yok'}
                      tone={cost != null ? S.ink : S.inkDim}
                    />
                    <SayiKutu k={k} etiket="İŞARETLİ" deger={`${isaretli}/${toplam}`} />
                    {ev && ev.resolved > 0 ? (
                      <SayiKutu
                        k={k} etiket="DOĞRU" deger={`${ev.correct}/${ev.resolved}`} tone={S.good}
                        alt={ev.allResolved && ev.tier != null ? `🎯 ${ev.tier} bildin` : null}
                      />
                    ) : null}
                    <SayiKutu k={k} etiket="VERSİYON" deger={`V${v?.versionNo ?? '—'}`} tone={S.inkSoft} />
                  </View>

                  {/* durum + zamanlar */}
                  <View style={st.bilgiSatir}>
                    <AltBilgi k={k} text={statusOf(c, ev)} color={S.inkSoft} />
                    <AltBilgi k={k} text={`Oluşturma ${fmtDT(c.createdAt)}`} sayi />
                    <AltBilgi k={k} text={`Son güncelleme ${fmtDT(c.updatedAt)}`} sayi />
                  </View>
                  {c.playedMarkedAt ? (
                    <Not
                      k={k} style={st.beyan}
                      text="🎯 Tahmin kilitlendi — kullanıcı beyanı, bağımsız olarak doğrulanmamıştır"
                    />
                  ) : null}

                  {/* maç tablosu — armalı satırlar */}
                  <TouchableOpacity
                    onPress={() => setAcikTablo((p) => ({ ...p, [c.id]: !acik }))}
                    style={st.acKapa}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`${c.name} maç listesini ${acik ? 'gizle' : 'göster'}`}
                    testID={`kupon-mac-ac-${c.id}`}
                  >
                    <Text style={[st.acKapaTxt, fontOf(600, f), { fontSize: t.kucuk }]}>
                      {acik ? 'maçları gizle ▴' : `maçları göster ▾ (${toplam} maç)`}
                    </Text>
                  </TouchableOpacity>
                  {acik ? macTablosu(v) : null}

                  {/* işlemler */}
                  <View style={st.dugmeSatir}>
                    {canEdit ? <Dugme k={k} text="Düzenle" onPress={() => navigation.navigate('CouponEditor', { roundId: selectedId, couponId: c.id })} /> : null}
                    {/* "Çoğalt" (kuponu kopyalayıp yeni kupon açma) kullanıcı
                        isteğiyle kaldırıldı (2026-08-06); doCopy kodu duruyor. */}
                    <Dugme k={k} text="Kopyala" onPress={() => doCopyText(c)} testID={`kupon-kopyala-metin-${c.id}`} />
                    {canEdit && !c.isRankedCoupon ? <Dugme k={k} text="Dereceli Yap" onPress={() => doRanked(c)} /> : null}
                    {resultMap.size > 0 ? <Dugme k={k} ana text="Sonuç" onPress={() => navigation.navigate('CouponResult', { roundId: selectedId, couponId: c.id, roundName: selMeta?.name, season: selMeta?.year })} /> : null}
                    <Dugme k={k} text="Paylaş" onPress={() => navigation.navigate('CouponShare', { couponId: c.id, roundId: selectedId, roundName: selMeta?.name, season: selMeta?.year })} />
                    {locked || !isCurrent ? <Dugme k={k} text={c.playedMarkedAt ? 'Kilidi Kaldır' : 'Tahminimi Kilitle'} onPress={() => togglePlayed(c)} /> : null}
                    {canEdit ? <Dugme k={k} text="Sil" tone={S.bad} onPress={() => doDelete(c)} testID={`kupon-sil-${c.id}`} /> : null}
                  </View>
                  {silmeSebebi ? (
                    <Text
                      style={[st.silNot, fontOf(400, f), { fontSize: t.kucuk }]}
                      testID={`kupon-sil-sebep-${c.id}`}
                    >
                      Sil kapalı: {silmeSebebi}
                    </Text>
                  ) : null}
                </Tablo>
              );
            })}

            {canEdit ? (
              coupons.length >= MAX_COUPONS_PER_WEEK ? (
                <View style={st.uyariKutu}>
                  <Text style={[st.uyariTxt, fontOf(600, f), { fontSize: t.kucuk }]}>
                    Bu hafta için maksimum {MAX_COUPONS_PER_WEEK} kupona ulaştın.
                  </Text>
                </View>
              ) : (
                <Dugme
                  k={k} ana text={`+ Yeni Kupon (${coupons.length}/${MAX_COUPONS_PER_WEEK})`}
                  onPress={() => navigation.navigate('CouponEditor', { roundId: selectedId })}
                />
              )
            ) : null}
          </>
        )}

        <Not
          k={k} style={st.altNot}
          text={'Kuponlar bu cihazda saklanır ve yalnız sana görünür. 1-0-2 kutuları burada salt okunurdur; '
            + 'değiştirmek için Düzenle. Doğru sayısı yalnız resmî 90 dakika sonucuyla ve kilitli final '
            + 'versiyonla hesaplanır — geriye dönük başarı üretilmez.'}
        />
      </ScrollView>
    </View>
  );
}

/* STİL — yayın stüdyosunun paleti (studioTheme). Genel uygulama teması
   (theme.js) burada KULLANILMAZ; iki palet karışırsa aynı ekranda iki farklı
   gri, iki farklı köşe yarıçapı çıkıyor. */
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: S.bg },

  header: {
    backgroundColor: S.panel, borderBottomWidth: TABLE.hair, borderBottomColor: S.line,
    paddingHorizontal: SP.md, paddingVertical: SP.sm, gap: SP.sm,
  },
  sayfaBaslik: { color: S.ink },
  haftaNav: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: S.head,
    borderRadius: R.md, padding: SP.xs,
  },
  ok: {
    width: 30, height: 30, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#4E6076',
  },
  okOff: { opacity: 0.3 },
  okTxt: { color: S.headInk, fontSize: 20, lineHeight: 22 },
  haftaOrta: { flex: 1, alignItems: 'center', minWidth: 0 },
  haftaAd: { color: S.headInk },
  haftaSezon: { color: '#D6DDE5' },

  body: { padding: SP.md, paddingBottom: 40, gap: SP.md },
  yukleniyor: { padding: 24, alignItems: 'center' },

  uyariKutu: {
    flexDirection: 'row', alignItems: 'center', gap: SP.md,
    backgroundColor: S.warnSoft, borderWidth: TABLE.hair, borderColor: S.warn,
    borderRadius: R.md, padding: SP.md,
  },
  uyariTxt: { flex: 1, color: S.warn, lineHeight: 16 },

  bosKutu: {
    alignItems: 'center', backgroundColor: S.panel, borderWidth: TABLE.hair, borderColor: S.line,
    borderRadius: R.md, padding: SP.xl, gap: SP.sm,
  },
  bosIkon: { fontSize: 38 },
  bosBaslik: { color: S.ink },
  bosMetin: { color: S.inkSoft, textAlign: 'center', lineHeight: 18 },

  kupon: {},
  kuponDereceli: { borderColor: S.accent },
  kuponBas: {
    flexDirection: 'row', alignItems: 'center', gap: SP.sm, backgroundColor: S.head,
    paddingHorizontal: TABLE.cellPadX, paddingVertical: SP.xs,
  },
  kuponAd: { color: S.headInk, flexShrink: 1 },

  olcuSatir: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SP.lg,
    paddingHorizontal: TABLE.cellPadX, paddingVertical: SP.sm,
    borderBottomWidth: TABLE.hair, borderBottomColor: S.lineSoft,
  },
  bilgiSatir: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SP.md,
    paddingHorizontal: TABLE.cellPadX, paddingTop: SP.sm,
  },
  beyan: { paddingHorizontal: TABLE.cellPadX, paddingTop: 2 },

  acKapa: {
    paddingHorizontal: TABLE.cellPadX, paddingVertical: SP.sm,
    borderBottomWidth: TABLE.hair, borderBottomColor: S.lineSoft,
  },
  acKapaTxt: { color: S.accent },

  dugmeSatir: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm,
    padding: TABLE.cellPadX, backgroundColor: S.panel2,
    borderTopWidth: TABLE.hair, borderTopColor: S.lineSoft,
  },
  // "Sil" düğmesi çizilmediğinde SEBEBİ burada yazar (bkz. silmeSebebi).
  silNot: {
    paddingHorizontal: TABLE.cellPadX, paddingBottom: SP.sm,
    backgroundColor: S.panel2, color: S.inkSoft, lineHeight: 16,
  },

  altNot: { paddingHorizontal: SP.xs },
});
