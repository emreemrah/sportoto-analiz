// BİLDİRİM MERKEZİ EKRANI — kaçırdığın gerçek olaylar tek listede.
//
// Bu ekran hiçbir zaman örnek/sahte bildirim göstermez. Veri yoksa bunu
// açıkça söyler. Her satır dokunulabilir ve GERÇEK hedefe gider.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Switch, AppState } from 'react-native';

import { colors, spacing, radius } from '../theme';
import { EmptyState } from '../ui';
import { loadNotifications, markSeen, loadPushInputs } from '../services/notificationsService';
import {
  isDesteklenir, getPushPrefs, setPushEnabled, pushDurumu, ortamMesaji,
  syncMatchReminders, testBildirimiGonder, macTestiGonder, ayarlariAc,
  gelistirmeKipi, TEST_ONCE_SN, TEST_MAC_ONCE_SN,
} from '../services/pushService';
import { VARSAYILAN_ONCE_DK } from '../pushPlanner';

// YAYIN KAPISI — İKİ KATMANLI:
//  1) `__DEV__` DOĞRUDAN okunur. Metro yayın derlemesinde bu değeri `false`
//     olarak gömer; küçültücü de `false && …` ifadesini ve tek kullanımlık
//     sabiti katlayarak aşağıdaki geliştirme bölümünü paketten TAMAMEN atar.
//     Böylece seçenek yalnız "çizilmiyor" olmaz — müşterinin paketinde metni
//     bile BULUNMAZ.
//  2) `gelistirmeKipi()` aynı kararı ortak yerden verir; ikisi ayrışırsa test
//     kırılır. Geliştirme derlemesinde `__DEV__` true'dur ve bu çağrı çalışır.
const GELISTIRME = (typeof __DEV__ !== 'undefined' && __DEV__ === true) && gelistirmeKipi();

/** Geliştirme testinin sonucunu DÜRÜSTÇE anlatır — "kuruldu" demeden önce cihazdan okunmuştur. */
function macTestMesaji(r, dk) {
  if (r?.ok && r.mac) {
    return `${r.mac.no}. ${r.mac.ev} – ${r.mac.dep} maçı için hatırlatma ${dk} dakika sonrasına kuruldu. `
      + 'Bildirim gelince dokun: bu maçın detay ekranı açılmalı.';
  }
  switch (r?.neden) {
    case 'bulten-yok':
      return 'Güncel bülten okunamadı; test için gerçek maç bulunamadı. Uydurma maç oluşturulmaz.';
    case 'mac-yok':
      return 'Güncel bültende başlamamış maç kalmadı; test için uydurma maç oluşturulmaz.';
    case 'izin':
      return 'Bildirim izni olmadığı için test hatırlatması kurulamadı.';
    case 'zamanlanamadi':
      return 'İşletim sistemi zamanlamayı kabul etmedi; test hatırlatması kurulamadı.';
    case 'destek-yok':
      return 'Bu ortamda telefon bildirimi kurulamıyor.';
    default:
      return 'Test hatırlatması kurulamadı.';
  }
}

function zamanMetni(ms) {
  if (!Number.isFinite(ms)) return '';
  const fark = Date.now() - ms;
  if (fark < 0) {
    const dk = Math.round(-fark / 60000);
    return dk <= 90 ? `${dk} dk sonra` : new Date(ms).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  const dk = Math.round(fark / 60000);
  if (dk < 1) return 'az önce';
  if (dk < 60) return `${dk} dk önce`;
  const sa = Math.round(dk / 60);
  if (sa < 24) return `${sa} saat önce`;
  return new Date(ms).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
}

const TON = {
  'match-starting': { bg: colors.warningSoft, br: colors.warning },
  'result-official': { bg: colors.successSoft, br: colors.success },
  'new-round': { bg: colors.infoSoft, br: colors.info },
  achievement: { bg: colors.primarySoft, br: colors.primary },
  points: { bg: colors.primarySoft, br: colors.primary },
};

export default function NotificationsScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [firstRun, setFirstRun] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Telefon hatırlatması durumu — hiçbiri varsayılmaz, hepsi cihazdan okunur.
  // `mesaj` ortam açıklamasıdır (web/modül hatası vb.), `bilgi` son işlemin
  // dürüst sonucudur (kuruldu/kurulamadı). İkisi de uydurulmaz.
  const [push, setPush] = useState({
    destek: false, durum: '', platform: '', teknik: '', mesaj: '',
    acik: false, izin: 'unsupported', kurulu: 0, test: false,
    mesgul: false, ayarOner: false, bilgi: '',
  });
  const testMesgul = useRef(false);
  const [testDurum, setTestDurum] = useState({ mesgul: false, bilgi: '' });
  // Geliştirme testi (gerçek maç hatırlatması, 1 dakika sonrası).
  const macTestMesgul = useRef(false);
  const [macTest, setMacTest] = useState({ mesgul: false, bilgi: '' });

  const pushDurumOku = useCallback(async () => {
    const d = await pushDurumu();
    setPush((p) => ({
      ...p,
      destek: !!d.destek,
      durum: d.durum || '',
      platform: d.platform || '',
      teknik: d.teknik || '',
      mesaj: ortamMesaji(),
      acik: !!d.acik,
      izin: d.izin,
      kurulu: d.kurulu || 0,
      test: !!d.test,
      mesgul: false,
      // İzin ayarlardan geri alındıysa kullanıcıya dürüstçe söylenir.
      bilgi: d.tercihDuzeltildi
        ? 'Telefon ayarlarından bildirim izni kaldırılmış; hatırlatmalar kapatıldı.'
        : p.bilgi,
      ayarOner: p.ayarOner || d.izin === 'blocked' || d.tercihDuzeltildi,
    }));
  }, []);

  const pushDegistir = useCallback(async (istenen) => {
    setPush((p) => ({ ...p, mesgul: true, bilgi: '' }));
    let sonuc = null;
    try {
      const girdi = istenen ? await loadPushInputs() : {};
      sonuc = await setPushEnabled(istenen, { now: Date.now(), ...girdi });
    } catch { /* durum aşağıda yeniden okunur */ }
    await pushDurumOku();

    // Sonuç DÜRÜSTÇE raporlanır: izin verilmediyse "açıldı" denmez.
    let bilgi = '';
    let ayarOner = false;
    if (istenen && sonuc && !sonuc.enabled) {
      ayarOner = true;
      bilgi = sonuc.izin === 'blocked'
        ? 'Bildirim izni kapalı olduğu için hatırlatma kurulamadı. Telefon ayarlarından izin vermen gerekiyor.'
        : sonuc.izin === 'hata'
          ? 'Bildirim izni sorulamadı; hatırlatma açılmadı.'
          : 'Bildirim izni verilmediği için hatırlatma açılmadı.';
    } else if (istenen && sonuc?.enabled) {
      const s = sonuc.senkron || {};
      if (!s.plan) {
        bilgi = 'Hatırlatma açıldı. Kuponunda başlama saati bilinen maç olduğunda hatırlatma kurulur.';
      } else if (s.durum === 'ok') {
        bilgi = `Hatırlatma açıldı ve ${s.dogrulanan} maç için kurulumu cihazda doğrulandı.`;
      } else {
        bilgi = `Hatırlatma açıldı ancak ${s.plan} maçın ${s.dogrulanan} tanesi cihazda doğrulanabildi; kalanı işletim sistemi kabul etmedi.`;
      }
    }
    if (bilgi || ayarOner) setPush((p) => ({ ...p, bilgi: bilgi || p.bilgi, ayarOner: p.ayarOner || ayarOner }));
    if (!istenen) setTestDurum({ mesgul: false, bilgi: '' });
  }, [pushDurumOku]);

  const testGonder = useCallback(async () => {
    if (testMesgul.current) return;
    testMesgul.current = true;
    setTestDurum({ mesgul: true, bilgi: '' });
    let r = null;
    try { r = await testBildirimiGonder({ now: Date.now() }); } catch { r = null; }
    testMesgul.current = false;
    const dk = Math.max(1, Math.round((TEST_ONCE_SN || 60) / 60));
    setTestDurum({
      mesgul: false,
      bilgi: r?.ok
        ? `Test bildirimi kuruldu; ${dk} dakika sonra telefonunda görünecek. Görmezsen telefon ayarlarından bu uygulamanın bildirimlerini kontrol et.`
        : r?.neden === 'izin'
          ? 'Bildirim izni olmadığı için test kurulamadı.'
          : 'Test bildirimi kurulamadı: işletim sistemi zamanlamayı kabul etmedi.',
    });
    pushDurumOku();
  }, [pushDurumOku]);

  // GELİŞTİRME TESTİ: güncel bültendeki gerçek bir maç için, üretimdeki maç
  // hatırlatmasının aynısını 1 dakika sonrasına kurar. Kupon verisi kullanılmaz
  // (yalnız `bulletin` gönderilir), üretimin 60 dakikalık düzenine dokunulmaz.
  const macTestiKur = useCallback(async () => {
    if (macTestMesgul.current) return;
    macTestMesgul.current = true;
    setMacTest({ mesgul: true, bilgi: '' });
    let r = null;
    try {
      const girdi = await loadPushInputs();
      r = await macTestiGonder({ now: Date.now(), bulletin: girdi?.bulletin || null });
    } catch { r = null; }
    macTestMesgul.current = false;
    const dk = Math.max(1, Math.round((TEST_MAC_ONCE_SN || 60) / 60));
    setMacTest({ mesgul: false, bilgi: macTestMesaji(r, dk) });
    pushDurumOku();
  }, [pushDurumOku]);

  const ayarlaraGit = useCallback(async () => {
    const oldu = await ayarlariAc();
    if (!oldu) {
      setPush((p) => ({ ...p, bilgi: 'Ayarlar ekranı açılamadı. Telefon ayarları → Uygulamalar → bu uygulama → Bildirimler yolunu izleyebilirsin.' }));
    }
  }, []);

  const yukle = useCallback(async () => {
    const r = await loadNotifications({ now: Date.now() });
    setItems(r.items || []);
    setFirstRun(!!r.firstRun);
    // Ekran açıldığı an okunmuş sayılır; aynı bildirim bir daha çıkmaz.
    if (!r.firstRun) markSeen({ now: Date.now(), items: r.items || [], ctx: r.ctx || {} });
    setLoading(false);
    setRefreshing(false);

    // Kupon değişmiş olabilir → açıksa zamanlama güncellenir. Sessiz "tamam"
    // yok: işletim sistemi kabul etmediyse bu ekranda yazılır.
    try {
      const prefs = await getPushPrefs();
      if (isDesteklenir() && prefs.enabled) {
        const girdi = await loadPushInputs();
        const s = await syncMatchReminders({ now: Date.now(), ...girdi });
        if (s?.durum === 'eksik') {
          setPush((p) => ({
            ...p,
            bilgi: `Planlanan ${s.plan} hatırlatmanın ${s.dogrulanan} tanesi cihazda doğrulanabildi; kalanı işletim sistemi kabul etmedi.`,
          }));
        }
      }
    } catch { /* hatırlatma kurulamazsa liste yine de gösterilir */ }
    pushDurumOku();
  }, [pushDurumOku]);

  useEffect(() => { yukle(); }, [yukle]);

  // İzin telefon ayarlarından değiştirilmiş olabilir: uygulama öne geldiğinde
  // ve ekrana her dönüşte durum CİHAZDAN yeniden okunur (varsayım yok).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') pushDurumOku(); });
    return () => { try { sub.remove(); } catch { /* eski RN sürümü */ } };
  }, [pushDurumOku]);

  useEffect(() => {
    if (typeof navigation?.addListener !== 'function') return undefined;
    return navigation.addListener('focus', () => { pushDurumOku(); });
  }, [navigation, pushDurumOku]);

  const git = (t) => {
    if (!t?.tab) return;
    if (t.screen) navigation.navigate(t.tab, { screen: t.screen, params: t.params });
    else navigation.navigate(t.tab);
  };

  return (
    <ScrollView
      style={st.wrap}
      contentContainerStyle={st.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); yukle(); }} />}
    >
      <View style={st.hero}>
        <Text style={st.heroTitle}>🔔 Bildirimler</Text>
        <Text style={st.heroSub}>
          Yalnız gerçekleşmiş olaylar listelenir: yeni bülten, kuponundaki maçın
          başlaması, resmî sonuçların açıklanması ve sunucunun doğruladığı puan.
        </Text>
      </View>

      <View style={st.push}>
        <View style={st.pushHead}>
          <View style={{ flex: 1 }}>
            <Text style={st.pushTitle}>📱 Telefon hatırlatması</Text>
            <Text style={st.pushSub}>
              Kuponundaki maç başlamadan {VARSAYILAN_ONCE_DK} dk önce telefonuna hatırlatma düşer.
              Uygulama kapalıyken de çalışır.
            </Text>
          </View>
          {/* Anahtar GERÇEK platformda görünür; izin durumu onu gizlemez —
              izin yoksa açılmaz ve bu aşağıda dürüstçe yazılır. */}
          {push.destek ? (
            <Switch
              value={push.acik}
              disabled={push.mesgul}
              onValueChange={pushDegistir}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          ) : null}
        </View>

        {!push.destek ? (
          // Metin duruma göre değişir: tarayıcı gerçekten tarayıcıysa "tarayıcı",
          // modül yüklenemediyse GERÇEK teknik durum yazılır.
          <Text style={st.pushNot}>{push.mesaj}</Text>
        ) : push.izin === 'blocked' ? (
          <Text style={st.pushNot}>
            Bildirim izni telefon ayarlarından kapatılmış. Uygulama içinden tekrar
            sorulamıyor; izni ayarlardan açtıktan sonra bu ekrana dönmen yeterli.
          </Text>
        ) : push.acik ? (
          <Text style={st.pushNot}>
            {push.kurulu > 0
              ? `Kurulu hatırlatma: ${push.kurulu}. Kuponunu değiştirdiğinde liste kendini günceller.`
              : 'Şu an kurulu hatırlatma yok. Kuponuna maç ekledikçe hatırlatmalar kurulur; başlama saati bilinmeyen maç için hatırlatma kurulmaz.'}
          </Text>
        ) : (
          <Text style={st.pushNot}>
            Kapalı. Açtığında yalnız KENDİ kuponundaki maçlar için hatırlatma kurulur;
            tahmin, sonuç veya "kesin" iddiası içeren bildirim gönderilmez.
          </Text>
        )}

        {push.bilgi ? <Text style={st.pushBilgi}>{push.bilgi}</Text> : null}

        {push.destek && !push.acik && push.ayarOner ? (
          <TouchableOpacity style={st.pushBtnAlt} activeOpacity={0.85} onPress={ayarlaraGit}>
            <Text style={st.pushBtnAltTxt}>⚙️ Telefon bildirim ayarlarını aç</Text>
          </TouchableOpacity>
        ) : null}

        {/* TEST BİLDİRİMİ — gerçek kanal, gerçek zamanlama, 1 dakika sonrası.
            İçinde tahmin, seçim, skor, puan veya hesap bilgisi YOKTUR. */}
        {push.destek && push.acik ? (
          <>
            <TouchableOpacity
              style={[st.pushBtn, testDurum.mesgul && st.pushBtnPasif]}
              activeOpacity={0.85}
              disabled={testDurum.mesgul}
              onPress={testGonder}
            >
              <Text style={st.pushBtnTxt}>
                {testDurum.mesgul ? 'Kuruluyor…' : '🔔 Test bildirimi gönder'}
              </Text>
            </TouchableOpacity>
            <Text style={st.pushNot}>
              Telefonunun bu uygulamaya bildirim izni verdiğini kendi gözünle
              doğrulaman için 1 dakika sonrasına tek bir deneme bildirimi kurulur.
              İçinde maç, tahmin, skor veya hesap bilgisi bulunmaz.
            </Text>
            {testDurum.bilgi ? <Text style={st.pushBilgi}>{testDurum.bilgi}</Text> : null}
          </>
        ) : null}

        {/* GELİŞTİRME TESTİ — yayın sürümünde HİÇ çizilmez (GELISTIRME kapısı).
            Güncel bültendeki gerçek ve başlamamış bir maç için, üretimdeki maç
            hatırlatmasının aynısı 1 dakika sonrasına kurulur. İçinde yalnız maç
            numarası, takım adları ve saat vardır. */}
        {GELISTIRME && push.destek && push.acik ? (
          <View style={st.dev}>
            <Text style={st.devEtiket}>🧪 GELİŞTİRME — yayın sürümünde görünmez</Text>
            <TouchableOpacity
              style={[st.pushBtnAlt, macTest.mesgul && st.pushBtnPasif]}
              activeOpacity={0.85}
              disabled={macTest.mesgul}
              onPress={macTestiKur}
            >
              <Text style={st.pushBtnAltTxt}>
                {macTest.mesgul ? 'Kuruluyor…' : '⚽ Maç hatırlatmasını test et'}
              </Text>
            </TouchableOpacity>
            <Text style={st.pushNot}>
              Güncel bültendeki başlamamış gerçek bir maç için, üretimde kullanılan
              maç hatırlatmasının aynısı 1 dakika sonrasına kurulur. Bildirime
              dokunduğunda o maçın detay ekranı açılmalı. Uygun maç yoksa uydurma
              maç oluşturulmaz. Kuponundaki gerçek hatırlatmalar bundan etkilenmez;
              onlar maçtan {VARSAYILAN_ONCE_DK} dk önce kurulmaya devam eder.
            </Text>
            {macTest.bilgi ? <Text style={st.pushBilgi}>{macTest.bilgi}</Text> : null}
          </View>
        ) : null}
      </View>

      {loading ? (
        <Text style={st.info}>Yükleniyor…</Text>
      ) : items.length === 0 ? (
        <EmptyState
          icon="🔕"
          title={firstRun ? 'Bildirimler açıldı' : 'Yeni bildirim yok'}
          message={firstRun
            ? 'Bundan sonra olan biteni burada göreceksin. Geçmişe dönük bildirim üretilmez.'
            : 'Yeni bir olay olduğunda burada görünecek. Uydurma bildirim gösterilmez.'}
        />
      ) : (
        items.map((n) => {
          const ton = TON[n.kind] || { bg: colors.surfaceSoft, br: colors.border };
          return (
            <TouchableOpacity
              key={n.id}
              style={[st.row, { backgroundColor: ton.bg, borderLeftColor: ton.br }]}
              activeOpacity={0.85}
              onPress={() => git(n.target)}
            >
              <Text style={st.icon}>{n.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={st.title}>{n.title}</Text>
                <Text style={st.body}>{n.body}</Text>
                <Text style={st.time}>{zamanMetni(n.at)}</Text>
              </View>
              <Text style={st.chev}>›</Text>
            </TouchableOpacity>
          );
        })
      )}

      <Text style={st.note}>
        Yukarıdaki liste uygulama açıldığında hesaplanır. Telefona düşen
        hatırlatma yalnız maç başlangıcı içindir ve cihazın kendi saatiyle
        çalışır — sunucudan bildirim gönderilmez. Resmî sonuç dışındaki hiçbir
        veri kesin sayılmaz.
      </Text>
      {/* Destek hattı cümlesi kaldırıldı (kullanıcı kararı, 2 Ağustos 2026). */}
      <Text style={st.age}>18 yaş altı kullanamaz. Bu uygulama analiz ve karar desteği sunar.</Text>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  hero: { backgroundColor: '#132244', borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  heroTitle: { color: '#fff', fontSize: 18, fontWeight: '900', marginBottom: 6 },
  heroSub: { color: 'rgba(255,255,255,0.82)', fontSize: 12, lineHeight: 17 },
  info: { color: colors.textSoft, fontSize: 13, textAlign: 'center', paddingVertical: spacing.lg },
  push: {
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md,
  },
  pushHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pushTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  pushSub: { color: colors.textSoft, fontSize: 12, lineHeight: 17, marginTop: 3 },
  pushNot: { color: colors.muted, fontSize: 11.5, lineHeight: 16, marginTop: 8 },
  pushBilgi: {
    color: colors.text, fontSize: 11.5, lineHeight: 16, marginTop: 8,
    backgroundColor: colors.primarySoft, borderRadius: radius.sm,
    paddingVertical: 7, paddingHorizontal: 9, fontWeight: '700',
  },
  pushBtn: {
    marginTop: 10, backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 11, alignItems: 'center',
  },
  pushBtnPasif: { opacity: 0.6 },
  pushBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '900' },
  pushBtnAlt: {
    marginTop: 10, backgroundColor: colors.surfaceSoft, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, paddingVertical: 10, alignItems: 'center',
  },
  pushBtnAltTxt: { color: colors.text, fontSize: 12.5, fontWeight: '900' },
  dev: {
    marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1,
    borderTopColor: colors.border, borderStyle: 'dashed',
  },
  devEtiket: { color: colors.muted, fontSize: 10.5, fontWeight: '900', letterSpacing: 0.4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: radius.md, borderLeftWidth: 4, padding: spacing.md, marginBottom: 10,
  },
  icon: { fontSize: 20 },
  title: { color: colors.text, fontSize: 14, fontWeight: '900' },
  body: { color: colors.textSoft, fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  time: { color: colors.muted, fontSize: 11, marginTop: 4, fontWeight: '700' },
  chev: { color: colors.muted, fontSize: 20, fontWeight: '900' },
  note: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: spacing.md, textAlign: 'center' },
  age: { color: colors.muted, fontSize: 10.5, marginTop: 6, textAlign: 'center' },
});
