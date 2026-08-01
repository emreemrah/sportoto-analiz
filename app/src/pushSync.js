// TELEFON BİLDİRİMİ — İZİN VE ZAMANLAMA DÜZENİ (SAF MODÜL)
//
// React Native / expo-notifications burada İMPORT EDİLMEZ. Cihazla konuşan her
// çağrı dışarıdan `nat` (yerli katman) olarak enjekte edilir; tercih deposu da
// `store` olarak. Böylece "izin reddedilirse ne olur", "izin geri alınırsa ne
// olur", "aynı maç iki kupondaysa kaç bildirim kurulur" gibi sorular node
// testlerinde CİHAZSIZ doğrulanabilir.
//
// Bölüşüm:
//   pushEnv.js     → "bu ortamda bildirim kurulabilir mi?" (ortam/yetenek)
//   pushPlanner.js → "hangi bildirim, ne zaman, hangi metinle?" (plan)
//   pushSync.js    → "izin/plan/cihaz durumu nasıl uzlaştırılır?" (bu dosya)
//   services/pushService.js → gerçek expo-notifications çağrıları (yerli katman)
//
// DÜRÜSTLÜK KURALLARI:
//  1) İzin verilmediyse tercih "açık" olarak YAZILMAZ. Aksi hâlde ekran "açık"
//     görünür ama telefona hiçbir şey düşmezdi.
//  2) İzin sonradan telefon ayarlarından geri alındıysa, uygulama öne geldiğinde
//     tercih dürüstçe kapanır (kendiliğinden "açık" görünmeye devam etmez).
//  3) "Kuruldu" demeden ÖNCE cihazdan geri okunur. İşletim sistemi zamanlamayı
//     kabul etmediyse kurulmuş sayılmaz.
//  4) Kimlikler maç kimliğiyle ilişkilidir (`mac:<hafta>:<no>`); aynı maç birden
//     çok kupon/tahminde geçse de tek bildirim kurulur, tekrar çalıştırmada
//     çoğalmaz.
//  5) Test bildirimi kişisel veri TAŞIMAZ: tahmin, seçim, skor, puan, e-posta
//     ya da kullanıcı bilgisi yoktur.

import { planMatchReminders, diffSchedule, VARSAYILAN_ONCE_DK } from './pushPlanner';
import { testMacIcerigi, TEST_MAC_ID, TEST_MAC_ONCE_SN } from './pushDevTest';

/** Bildirim türleri — cihazdaki kayıtları ayırt etmek için. */
export const MAC_KIND = 'match-starting';
export const TEST_KIND = 'test-notification';

/** Test bildiriminin sabit kimliği — tekrar basılınca çoğalmaz, üzerine yazılır. */
export const TEST_ID = 'test:bildirim';
/** Test bildirimi kaç saniye sonra düşsün (kullanıcıya "1 dakika" denir). */
export const TEST_ONCE_SN = 60;

export const VARSAYILAN_TERCIH = { enabled: false, onceDk: VARSAYILAN_ONCE_DK };

// ---------------------------------------------------------------------------
// Saf yardımcılar
// ---------------------------------------------------------------------------

/**
 * Test bildiriminin içeriği.
 * Metin tek bir şeyi söyler: bildirim kurulumu çalıştı. Maç, tahmin, skor,
 * puan, e-posta ya da kullanıcı adı GEÇMEZ.
 */
export function testIcerigi({ now = 0 } = {}) {
  return {
    id: TEST_ID,
    fireAt: Number(now) + TEST_ONCE_SN * 1000,
    title: 'Bildirim testi',
    body: 'Test bildirimi başarıyla çalıştı.',
    // Dokunulunca Bildirimler ekranı açılır. Hedefi `kind` belirler
    // (pushRoute.js); `tab`/`screen` yalnız insan okusun diye durur, gezinmeyi
    // serbest metin SÜRÜKLEYEMEZ.
    data: { tab: 'HomeTab', screen: 'Notifications', kind: TEST_KIND },
  };
}

/** Sistemden dönen izin nesnesini tek kelimeye indirger. */
export function izinSonucu(p) {
  if (p?.granted === true) return 'granted';
  if (p?.status === 'granted') return 'granted';
  // iOS'ta "provisional" (sessiz) izin de bildirim düşürür.
  const iosDurum = p?.ios?.status;
  if (iosDurum === 2 || iosDurum === 3 || iosDurum === 4) return 'granted';
  if (p?.canAskAgain === false) return 'blocked';
  return 'denied';
}

/** Yalnız BİZİM kurduğumuz maç hatırlatmaları. */
export function bizimMac(req) {
  const id = req?.identifier;
  return typeof id === 'string' && id.startsWith('mac:') && req?.content?.data?.kind === MAC_KIND;
}

/** Yalnız test bildirimi kaydı. */
export function bizimTest(req) {
  return req?.identifier === TEST_ID && req?.content?.data?.kind === TEST_KIND;
}

/**
 * Geliştirme kipindeki "maç hatırlatmasını test et" kaydı.
 * Türü üretimle AYNIDIR (`match-starting`) ama kimliği `mac:` ile başlamaz;
 * bu yüzden `bizimMac` onu yakalamaz ve eşitleme ona DOKUNMAZ.
 */
export function bizimTestMac(req) {
  return req?.identifier === TEST_MAC_ID && req?.content?.data?.kind === MAC_KIND;
}

/** Cihazdaki geliştirme testi kaydı (yoksa null). */
export function testMacKaydi(list) {
  const r = (Array.isArray(list) ? list : []).find(bizimTestMac);
  return r ? { id: r.identifier, fireAt: Number(r?.content?.data?.fireAt) || 0 } : null;
}

/** Cihazdan okunan kayıtlardan maç hatırlatmalarını çıkarır. */
export function ayikla(list) {
  return (Array.isArray(list) ? list : []).filter(bizimMac).map((r) => ({
    id: r.identifier,
    // fireAt'i tetikleyiciden geri okumak platforma göre değişir; kurarken
    // kendi alanımıza yazıp buradan okuyoruz (tek doğru kaynak).
    fireAt: Number(r?.content?.data?.fireAt) || 0,
  }));
}

/** Cihazdaki test kaydı (yoksa null). */
export function testKaydi(list) {
  const r = (Array.isArray(list) ? list : []).find(bizimTest);
  return r ? { id: r.identifier, fireAt: Number(r?.content?.data?.fireAt) || 0 } : null;
}

/**
 * Tercihle gerçek izni uzlaştırır.
 * İzin yoksa "açık" olamaz — kullanıcıya yalan söylenmez.
 * @returns {{enabled:boolean, degisti:boolean}}
 */
export function uzlastir({ enabled = false, izin = 'denied' } = {}) {
  const gercek = enabled === true && izin === 'granted';
  return { enabled: gercek, degisti: (enabled === true) !== gercek };
}

// ---------------------------------------------------------------------------
// Cihazla konuşan sarmalayıcılar (hepsi hata yutar, çünkü tek bir başarısız
// çağrı tüm eşitlemeyi düşürmemeli — sonuç zaten geri okunarak doğrulanır)
// ---------------------------------------------------------------------------
async function guvenliKurulular(nat) {
  try { return (await nat.kurulular()) || []; } catch { return []; }
}
async function guvenliIptal(nat, id) {
  try { await nat.iptal(id); return true; } catch { return false; }
}
async function guvenliZamanla(nat, p) {
  try { await nat.zamanla(p); return true; } catch { return false; }
}
async function guvenliKanal(nat) {
  try { if (typeof nat.kanalHazirla === 'function') await nat.kanalHazirla(); } catch { /* sistem varsayılan kanalı */ }
}

async function tercihOku(store) {
  try {
    const t = await store.oku();
    return {
      enabled: t?.enabled === true,
      onceDk: Number.isFinite(Number(t?.onceDk)) ? Number(t.onceDk) : VARSAYILAN_TERCIH.onceDk,
    };
  } catch { return { ...VARSAYILAN_TERCIH }; }
}

async function tercihYaz(store, next) {
  try { await store.yaz(next); } catch { /* depo yazamazsa oturum içinde kalır */ }
  return next;
}

// ---------------------------------------------------------------------------
// İzin
// ---------------------------------------------------------------------------
/**
 * @returns {Promise<'granted'|'denied'|'blocked'|'unsupported'|'hata'>}
 *   blocked = kullanıcı reddetti ve uygulama bir daha soramaz → ayarlara gidilir
 *   hata    = çağrı patladı; "desteklenmiyor" demek yanlış olurdu, ayrı tutulur
 */
export async function izinAl(nat, { sor = false } = {}) {
  if (!nat?.destek) return 'unsupported';
  try {
    const mevcut = await nat.izinOku();
    const d = izinSonucu(mevcut);
    if (d === 'granted') return 'granted';
    if (!sor) return d;
    const sonuc = await nat.izinIste();
    return izinSonucu(sonuc);
  } catch { return 'hata'; }
}

// ---------------------------------------------------------------------------
// İptal
// ---------------------------------------------------------------------------
/** Yalnız maç hatırlatmalarını siler (kullanıcının diğer bildirimlerine dokunulmaz). */
export async function macIptal(nat) {
  if (!nat?.destek) return { iptal: 0 };
  const kayitlar = ayikla(await guvenliKurulular(nat));
  let n = 0;
  for (const k of kayitlar) if (await guvenliIptal(nat, k.id)) n += 1;
  return { iptal: n };
}

/** Bizim kurduğumuz HER ŞEY (maç hatırlatmaları + test kayıtları). */
export async function hepsiniIptal(nat) {
  if (!nat?.destek) return { iptal: 0 };
  const hepsi = await guvenliKurulular(nat);
  const idler = [...ayikla(hepsi).map((k) => k.id)];
  const t = testKaydi(hepsi);
  if (t) idler.push(t.id);
  // Geliştirme testi kaydı da bizimdir: bildirim kapatılırken geride kalmamalı.
  const tm = testMacKaydi(hepsi);
  if (tm) idler.push(tm.id);
  let n = 0;
  for (const id of idler) if (await guvenliIptal(nat, id)) n += 1;
  return { iptal: n };
}

// ---------------------------------------------------------------------------
// Durum okuma (ekran bunu gösterir)
// ---------------------------------------------------------------------------
/**
 * Ekranın ihtiyaç duyduğu HER ŞEY tek yerden, hiçbiri varsayılmadan.
 * İzin geri alınmışsa tercih burada dürüstçe kapatılır.
 */
export async function durumOku({ nat, store } = {}) {
  const cevre = {
    destek: !!nat?.destek,
    durum: nat?.durum || '',
    platform: nat?.platform || '',
    teknik: nat?.teknik || '',
    uyari: nat?.uyari || '',
    kaynak: nat?.kaynak || '',
  };
  const tercih = await tercihOku(store);

  if (!cevre.destek) {
    return { ...cevre, izin: 'unsupported', acik: false, kurulu: 0, test: false, tercihDuzeltildi: false, onceDk: tercih.onceDk };
  }

  const izin = await izinAl(nat, { sor: false });
  const { enabled, degisti } = uzlastir({ enabled: tercih.enabled, izin });
  if (degisti) {
    // İzin telefon ayarlarından geri alınmış → hem tercih hem kurulu kayıtlar temizlenir.
    await tercihYaz(store, { ...tercih, enabled: false });
    await hepsiniIptal(nat);
  }

  const hepsi = degisti ? [] : await guvenliKurulular(nat);
  return {
    ...cevre,
    izin,
    acik: enabled,
    kurulu: ayikla(hepsi).length,
    test: !!testKaydi(hepsi),
    tercihDuzeltildi: degisti,
    onceDk: tercih.onceDk,
  };
}

// ---------------------------------------------------------------------------
// Zamanlama eşitlemesi
// ---------------------------------------------------------------------------
/**
 * Planı cihazdaki kayıtlarla eşitler ve SONUCU CİHAZDAN GERİ OKUYARAK doğrular.
 *
 * @returns {Promise<{durum:string, kuruldu:number, iptal:number, denenen:number,
 *                    dogrulanan:number, plan:number, atlanan?:object}>}
 *   durum: 'ok' | 'eksik' | 'kapali' | 'denied' | 'blocked' | 'unsupported' | 'hata'
 *   'eksik' = plan kuruldu sayılamadı; işletim sistemi hepsini kabul etmedi.
 */
export async function macSenkron({ nat, store } = {}, { now = 0, bulletin = null, coupons = [] } = {}) {
  const bos = { kuruldu: 0, iptal: 0, denenen: 0, dogrulanan: 0, plan: 0 };
  if (!nat?.destek) return { durum: 'unsupported', ...bos };

  const tercih = await tercihOku(store);
  if (!tercih.enabled) {
    const t = await macIptal(nat);
    return { durum: 'kapali', ...bos, iptal: t.iptal };
  }

  const izin = await izinAl(nat, { sor: false });
  if (izin !== 'granted') {
    // İzin yokken "açık" tercih tutmak yanıltıcı olur.
    await tercihYaz(store, { ...tercih, enabled: false });
    const t = await hepsiniIptal(nat);
    return { durum: izin, ...bos, iptal: t.iptal };
  }

  const { items, atlanan } = planMatchReminders({ now, bulletin, coupons, onceDk: tercih.onceDk });
  const oncekiler = ayikla(await guvenliKurulular(nat));
  const { kurulacak, iptal } = diffSchedule(items, oncekiler);

  let iptalSayisi = 0;
  for (const id of iptal) if (await guvenliIptal(nat, id)) iptalSayisi += 1;

  let denenen = 0;
  for (const p of kurulacak) { denenen += 1; await guvenliZamanla(nat, p); }

  // DÜRÜSTLÜK: kurduk demeden önce cihazdan geri oku.
  const sonrakiler = ayikla(await guvenliKurulular(nat));
  const varOlan = new Set(sonrakiler.map((k) => k.id));
  const dogrulanan = items.filter((p) => varOlan.has(p.id)).length;
  const kuruldu = kurulacak.filter((p) => varOlan.has(p.id)).length;

  return {
    durum: dogrulanan === items.length ? 'ok' : 'eksik',
    kuruldu,
    iptal: iptalSayisi,
    denenen,
    dogrulanan,
    plan: items.length,
    atlanan,
  };
}

/**
 * Ayardan aç/kapat. Açarken sistem izni SORULUR; izin verilmezse tercih AÇILMAZ.
 * @returns {Promise<{enabled:boolean, izin:string, senkron?:object, iptal?:number}>}
 */
export async function ayariDegistir({ nat, store } = {}, { ac = false, now = 0, bulletin = null, coupons = [] } = {}) {
  if (!nat?.destek) return { enabled: false, izin: 'unsupported' };

  const tercih = await tercihOku(store);

  if (!ac) {
    await tercihYaz(store, { ...tercih, enabled: false });
    const t = await hepsiniIptal(nat);
    return { enabled: false, izin: 'kapali', iptal: t.iptal };
  }

  const izin = await izinAl(nat, { sor: true });
  if (izin !== 'granted') {
    await tercihYaz(store, { ...tercih, enabled: false });
    return { enabled: false, izin };
  }

  await guvenliKanal(nat);
  await tercihYaz(store, { ...tercih, enabled: true });
  const senkron = await macSenkron({ nat, store }, { now, bulletin, coupons });
  return { enabled: true, izin: 'granted', senkron };
}

/**
 * "Test Bildirimi Gönder" — GERÇEK bildirim kanalı ve GERÇEK zamanlama yolu.
 * Ayrı/sahte bir yol kullanılmaz; amaç kullanıcının telefon ayarlarının
 * hatırlatmalara izin verdiğini kendi gözüyle doğrulaması.
 *
 * @returns {Promise<{ok:boolean, izin:string, saniye:number, fireAt:number, neden:string}>}
 */
export async function testKur({ nat, store } = {}, { now = 0 } = {}) {
  const bos = { saniye: TEST_ONCE_SN, fireAt: 0 };
  if (!nat?.destek) return { ok: false, izin: 'unsupported', ...bos, neden: 'destek-yok' };

  const izin = await izinAl(nat, { sor: false });
  if (izin !== 'granted') return { ok: false, izin, ...bos, neden: 'izin' };

  await guvenliKanal(nat);
  const icerik = testIcerigi({ now });

  // Tekrar basılınca çoğalmasın: önce eski test kaydı silinir.
  await guvenliIptal(nat, TEST_ID);
  await guvenliZamanla(nat, icerik);

  // İşletim sistemi kabul etmediyse "kuruldu" demiyoruz.
  const kayit = testKaydi(await guvenliKurulular(nat));
  if (!kayit) return { ok: false, izin: 'granted', ...bos, neden: 'zamanlanamadi' };
  return { ok: true, izin: 'granted', saniye: TEST_ONCE_SN, fireAt: icerik.fireAt, neden: '' };
}

/**
 * GELİŞTİRME TESTİ — "Maç hatırlatmasını test et".
 *
 * Güncel bültendeki gerçek ve başlamamış bir maç için, ÜRETİMDE KULLANILAN
 * `match-starting` bildiriminin aynısını 1 dakika sonrasına kurar. Amaç:
 * bildirime dokununca doğru maçın detay ekranının açıldığını gerçek cihazda,
 * 60 dakika beklemeden kanıtlamak.
 *
 * Üretim düzenine dokunmaz: ayrı kimlik (`test:mac`) kullanır, plan/eşitleme
 * (`macSenkron`) bu kaydı ne kurar ne siler, 60 dakika kuralı değişmez.
 * Uygun maç yoksa MAÇ UYDURULMAZ; neden dürüstçe döner.
 *
 * @returns {Promise<{ok:boolean, izin:string, saniye:number, fireAt:number,
 *                    mac:object|null, neden:string}>}
 *   neden: '' | 'destek-yok' | 'izin' | 'bulten-yok' | 'mac-yok' | 'zamanlanamadi'
 */
export async function testMacKur({ nat, store } = {}, { now = 0, bulletin = null } = {}) {
  const bos = { saniye: TEST_MAC_ONCE_SN, fireAt: 0, mac: null };
  if (!nat?.destek) return { ok: false, izin: 'unsupported', ...bos, neden: 'destek-yok' };

  const izin = await izinAl(nat, { sor: false });
  if (izin !== 'granted') return { ok: false, izin, ...bos, neden: 'izin' };

  // Önce maç seçilir: uygun maç yoksa cihaza hiç dokunulmaz.
  const secim = testMacIcerigi({ now, bulletin });
  if (!secim.ok) return { ok: false, izin: 'granted', ...bos, neden: secim.neden };

  await guvenliKanal(nat);

  // Tekrar basılınca çoğalmasın: önce eski geliştirme testi kaydı silinir.
  await guvenliIptal(nat, TEST_MAC_ID);
  await guvenliZamanla(nat, secim.kayit);

  // İşletim sistemi kabul etmediyse "kuruldu" demiyoruz.
  const kayit = testMacKaydi(await guvenliKurulular(nat));
  if (!kayit) return { ok: false, izin: 'granted', ...bos, neden: 'zamanlanamadi' };
  return {
    ok: true,
    izin: 'granted',
    saniye: TEST_MAC_ONCE_SN,
    fireAt: secim.kayit.fireAt,
    mac: secim.mac,
    neden: '',
  };
}
