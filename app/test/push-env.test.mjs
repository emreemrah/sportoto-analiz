// TELEFON BİLDİRİMİ — ORTAM, İZİN, ZAMANLAMA VE TEST BİLDİRİMİ TESTLERİ.
//
// NEDEN VAR: gerçek Android telefonda uygulama, yerel bildirim kurabildiği hâlde
// ekranda "Tarayıcıda telefon bildirimi kurulamaz." yazıyordu; aç/kapa anahtarı
// görünmüyor, izin hiç istenmiyordu. Kök neden `!isWeb && !!Notifications`
// biçimindeki tek satırlık yetenek kontrolü ve `require('expo-notifications')`
// hatasının sessizce yutulmasıydı.
//
// Bu dosya şunları KANITLAR (hepsi cihazsız, saf modüller üzerinden):
//   A. Gerçek Android ortamı web sayılmaz; modül hatası "tarayıcı" diye
//      gösterilmez; karar Expo Go / appOwnership / geliştirme moduna bakmaz.
//   B. İzin reddedilirse anahtar açık görünmez; izin sonradan geri alınırsa
//      ekran dürüst durumu gösterir.
//   C. Aynı maç için tek bildirim kurulur, tekrar çalıştırmada çoğalmaz; maç
//      kupondan çıkınca iptal edilir, saati değişince yeniden zamanlanır;
//      işletim sistemi kabul etmediyse "kuruldu" denmez.
//   D. Test bildirimi kişisel veri taşımaz, bir dakika sonrasına kurulur,
//      tekrar basılınca çoğalmaz, gerçek zamanlama yolunu kullanır.
//   E. Çıkış / hesap silme temizliği bildirimleri de kapsar.
//   F. Yedek yükleme yolları pakette gerçekten var ve UZAK-PUSH yerli modülü
//      istemiyor (Expo Go'da patlayan modüller).
//   G. Bildirimler ekranı artık sabit "Tarayıcıda…" metnini içermiyor.
//
// UYARI: burası CİHAZSIZ bir testtir. Geçmesi, gerçek telefonda bildirimin
// çaldığını KANITLAMAZ; yalnız mantığın doğru olduğunu gösterir.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ortamiSinifla, ortamAciklamasi, ortamOzeti, DURUM, GEREKLI_API,
} from '../src/pushEnv.js';
import {
  durumOku, macSenkron, ayariDegistir, testKur, hepsiniIptal, macIptal,
  izinAl, izinSonucu, testIcerigi, uzlastir, ayikla, testKaydi,
  TEST_ID, TEST_KIND, TEST_ONCE_SN, MAC_KIND,
} from '../src/pushSync.js';

const BURASI = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(BURASI, '..');
const oku = (p) => fs.readFileSync(path.join(KOK, p), 'utf8');

// Gerçek cihazda ASLA görünmemesi gereken cümle — hatanın kendisi buydu.
const WEB_METNI = 'Tarayıcıda telefon bildirimi kurulamaz';

// ---------------------------------------------------------------------------
// Sahte cihaz ve sahte tercih deposu
// ---------------------------------------------------------------------------
function izinNesnesi(d) {
  if (d === 'granted') return { granted: true, canAskAgain: true, status: 'granted' };
  if (d === 'blocked') return { granted: false, canAskAgain: false, status: 'denied' };
  return { granted: false, canAskAgain: true, status: 'denied' };
}

/**
 * @param {object} o
 * @param {string} [o.izin]     başlangıç izin durumu
 * @param {string} [o.sorunca]  izin istendiğinde sistemin verdiği yanıt
 * @param {Function} [o.kabulEt] işletim sistemi bu kaydı kabul etsin mi?
 */
function sahteCihaz({ izin = 'granted', sorunca = null, kabulEt = () => true } = {}) {
  const kayitlar = new Map();
  const gunluk = [];
  let izinDurum = izin;
  return {
    kayitlar,
    gunluk,
    izinAyarla(v) { izinDurum = v; },
    nat: {
      destek: true,
      durum: DURUM.HAZIR,
      platform: 'android',
      teknik: '',
      uyari: '',
      kaynak: 'parcali',
      async izinOku() { gunluk.push('izinOku'); return izinNesnesi(izinDurum); },
      async izinIste() {
        gunluk.push('izinIste');
        if (sorunca) izinDurum = sorunca;
        return izinNesnesi(izinDurum);
      },
      async kanalHazirla() { gunluk.push('kanal'); },
      async zamanla(p) {
        gunluk.push(`zamanla:${p.id}`);
        if (!kabulEt(p)) return;                       // işletim sistemi reddetti
        kayitlar.set(p.id, {
          identifier: p.id,
          content: { title: p.title, body: p.body, data: { ...p.data, fireAt: p.fireAt } },
        });
      },
      async iptal(id) { gunluk.push(`iptal:${id}`); kayitlar.delete(id); },
      async kurulular() { return [...kayitlar.values()]; },
    },
  };
}

function sahteDepo(baslangic = { enabled: false, onceDk: 60 }) {
  let t = { ...baslangic };
  return {
    oku: async () => ({ ...t }),
    yaz: async (n) => { t = { ...n }; return { ...t }; },
    gor: () => ({ ...t }),
  };
}

const NOW = Date.parse('2026-07-25T12:00:00.000Z');
const sonra = (dk) => new Date(NOW + dk * 60000).toISOString();
const mac = (no, dk, ek = {}) => ({
  no, date: sonra(dk), home: { name: `Ev ${no}` }, away: { name: `Dep ${no}` }, ...ek,
});
const kuponlar = (roundId, ...gruplar) => gruplar.map((nolar, i) => ({
  id: `k${i + 1}`,
  roundId,
  couponNo: i + 1,
  finalVersionId: `v${i + 1}`,
  versions: [{
    id: `v${i + 1}`,
    versionNo: 1,
    selections: nolar.map((no) => ({ no, selectedOutcomes: ['1'] })),
  }],
}));

// ===========================================================================
// A. ORTAM — gerçek Android web sayılmamalı
// ===========================================================================

test('A1 · gerçek Android + çalışan modül → HAZIR; "web" DEĞİL', () => {
  const modul = {};
  for (const ad of GEREKLI_API) modul[ad] = () => {};
  const o = ortamiSinifla({ platformOS: 'android', modul, kaynak: 'paket' });

  assert.equal(o.durum, DURUM.HAZIR);
  assert.equal(o.destek, true, 'gerçek Android telefonda bildirim desteklenmeli');
  assert.notEqual(o.durum, DURUM.WEB);
  assert.equal(o.platform, 'android');
  assert.equal(ortamAciklamasi(o), '', 'destek varsa kullanıcıya engel mesajı yazılmaz');
});

test('A1b · iOS de aynı biçimde destekli sayılır', () => {
  const modul = {};
  for (const ad of GEREKLI_API) modul[ad] = () => {};
  const o = ortamiSinifla({ platformOS: 'ios', modul, kaynak: 'paket' });
  assert.equal(o.destek, true);
  assert.equal(o.durum, DURUM.HAZIR);
});

test('A2 · barrel patlasa da parçalı yükleme başardıysa durum HAZIR (hata yalnız uyarı)', () => {
  const modul = {};
  for (const ad of GEREKLI_API) modul[ad] = () => {};
  const o = ortamiSinifla({
    platformOS: 'android',
    modul,
    yuklemeHatasi: new Error("Cannot find native module 'ExpoPushTokenManager'"),
    kaynak: 'parcali',
  });

  assert.equal(o.durum, DURUM.HAZIR);
  assert.equal(o.destek, true, 'uzak-push modülü eksik diye YEREL bildirim kapatılmamalı');
  assert.match(o.uyari, /ExpoPushTokenManager/, 'gerçek hata metni kaybolmamalı');
  assert.equal(o.kaynak, 'parcali');
  assert.equal(ortamAciklamasi(o), '');
});

test('A3 · modül hiç yüklenemediyse "tarayıcı" DENMEZ; gerçek teknik durum yazılır', () => {
  const o = ortamiSinifla({
    platformOS: 'android',
    modul: null,
    yuklemeHatasi: new Error("Cannot find native module 'ExpoNotificationScheduler'"),
  });

  assert.equal(o.durum, DURUM.MODUL_HATA);
  assert.equal(o.destek, false);
  assert.match(o.teknik, /ExpoNotificationScheduler/);

  const mesaj = ortamAciklamasi(o);
  assert.ok(!mesaj.includes(WEB_METNI), `gerçek cihazda tarayıcı teşhisi konmamalı: ${mesaj}`);
  assert.match(mesaj, /tarayıcı sınırı değil/, 'yanlış teşhis açıkça reddedilmeli');
  assert.match(mesaj, /ExpoNotificationScheduler/, 'gerçek teknik durum kullanıcıya ayrıştırılmalı');
  assert.match(mesaj, /android/, 'hangi platformda olduğu yazılmalı');
});

test('A4 · web GERÇEKTEN web sayılır (modül çalışsa bile)', () => {
  const modul = {};
  for (const ad of GEREKLI_API) modul[ad] = () => {};
  const o = ortamiSinifla({ platformOS: 'web', modul, kaynak: 'paket' });

  assert.equal(o.durum, DURUM.WEB);
  assert.equal(o.destek, false);
  assert.match(ortamAciklamasi(o), /Tarayıcıda telefon bildirimi kurulamaz/);
});

test('A5 · gereken işlev eksikse HAZIR denmez, eksik olan adıyla söylenir', () => {
  const modul = {};
  for (const ad of GEREKLI_API) modul[ad] = () => {};
  delete modul.scheduleNotificationAsync;

  const o = ortamiSinifla({ platformOS: 'android', modul });
  assert.equal(o.durum, DURUM.API_EKSIK);
  assert.equal(o.destek, false);
  assert.deepEqual(o.eksik, ['scheduleNotificationAsync']);
  assert.match(ortamAciklamasi(o), /scheduleNotificationAsync/);
  assert.ok(!ortamAciklamasi(o).includes(WEB_METNI));
});

test('A6 · paket hiç kurulu değilse MODUL_YOK (yine "tarayıcı" değil)', () => {
  const o = ortamiSinifla({ platformOS: 'android', modul: null, yuklemeHatasi: null });
  assert.equal(o.durum, DURUM.MODUL_YOK);
  assert.ok(!ortamAciklamasi(o).includes(WEB_METNI));
});

test('A6b · tarayıcı cümlesi YALNIZ gerçek web ortamında üretilir', () => {
  const modul = {};
  for (const ad of GEREKLI_API) modul[ad] = () => {};
  const durumlar = [
    ortamiSinifla({ platformOS: 'android', modul }),
    ortamiSinifla({ platformOS: 'ios', modul }),
    ortamiSinifla({ platformOS: 'android', modul: null, yuklemeHatasi: 'x' }),
    ortamiSinifla({ platformOS: 'android', modul: null }),
    ortamiSinifla({ platformOS: 'ios', modul: { getPermissionsAsync: () => {} } }),
  ];
  for (const o of durumlar) {
    assert.ok(
      !ortamAciklamasi(o).includes(WEB_METNI),
      `${o.durum} durumunda tarayıcı cümlesi çıkmamalı`,
    );
  }
  assert.ok(ortamAciklamasi(ortamiSinifla({ platformOS: 'web' })).includes(WEB_METNI));
});

test('A7 · karar Expo Go / appOwnership / geliştirme moduna BAKMAZ', () => {
  const env = oku('src/pushEnv.js');
  const svc = oku('src/services/pushService.js');
  for (const yasak of ['appOwnership', 'executionEnvironment', 'isRunningInExpoGo', 'isDevice']) {
    assert.ok(
      !new RegExp(`${yasak}\\s*[.(\\[]|\\.${yasak}\\b`).test(env.replace(/^\s*\/\/.*$/gm, '')),
      `pushEnv.js karar verirken ${yasak} kullanmamalı`,
    );
    // pushService'te yalnız açıklama satırlarında geçebilir; kodda geçmemeli.
    const svcKod = svc.replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!svcKod.includes(yasak), `pushService.js kodunda ${yasak} geçmemeli`);
  }
  assert.ok(!oku('src/pushEnv.js').includes('react-native'), 'pushEnv saf kalmalı');
});

test('A8 · tanı satırı kişisel veri içermez', () => {
  const o = ortamiSinifla({ platformOS: 'android', modul: null, yuklemeHatasi: 'x' });
  const s = ortamOzeti(o);
  assert.match(s, /durum:/);
  assert.match(s, /platform: android/);
  assert.ok(!/@/.test(s), 'tanı satırında e-posta olmamalı');
});

// ===========================================================================
// B. İZİN — reddedilirse açık görünmez, geri alınırsa dürüstçe kapanır
// ===========================================================================

test('B1 · izin REDDEDİLİRSE anahtar açık görünmez ve hiçbir şey kurulmaz', async () => {
  const c = sahteCihaz({ izin: 'denied' });
  const store = sahteDepo();
  const b = { roundId: 10, matches: [mac(1, 180)] };

  const r = await ayariDegistir({ nat: c.nat, store }, {
    ac: true, now: NOW, bulletin: b, coupons: kuponlar(10, [1]),
  });

  assert.equal(r.enabled, false, 'izin yokken tercih AÇILMAMALI');
  assert.equal(r.izin, 'denied');
  assert.equal(store.gor().enabled, false, 'depoya "açık" yazılmamalı');
  assert.equal(c.kayitlar.size, 0, 'izin yokken bildirim kurulmamalı');
  assert.ok(c.gunluk.includes('izinIste'), 'kullanıcıya sistem izni SORULMALI');
});

test('B2 · izin kalıcı reddedildiyse (blocked) durum ayrıştırılır', async () => {
  const c = sahteCihaz({ izin: 'blocked' });
  const store = sahteDepo();
  const r = await ayariDegistir({ nat: c.nat, store }, { ac: true, now: NOW });

  assert.equal(r.enabled, false);
  assert.equal(r.izin, 'blocked', 'ayarlara yönlendirme bu duruma bakar');
  assert.equal(store.gor().enabled, false);
});

test('B3 · izin verilirse tercih yazılır, kanal hazırlanır ve hatırlatma kurulur', async () => {
  const c = sahteCihaz({ izin: 'denied', sorunca: 'granted' });
  const store = sahteDepo();
  const b = { roundId: 10, matches: [mac(1, 180), mac(2, 240)] };

  const r = await ayariDegistir({ nat: c.nat, store }, {
    ac: true, now: NOW, bulletin: b, coupons: kuponlar(10, [1, 2]),
  });

  assert.equal(r.enabled, true);
  assert.equal(r.izin, 'granted');
  assert.equal(store.gor().enabled, true);
  assert.ok(c.gunluk.includes('kanal'), 'Android bildirim kanalı hazırlanmalı');
  assert.equal(c.kayitlar.size, 2);
  assert.equal(r.senkron.durum, 'ok');
  assert.equal(r.senkron.kuruldu, 2);
});

test('B4 · izin telefon ayarlarından GERİ ALINIRSA ekran dürüst durumu gösterir', async () => {
  const c = sahteCihaz({ izin: 'granted' });
  const store = sahteDepo();
  const b = { roundId: 10, matches: [mac(1, 180)] };

  await ayariDegistir({ nat: c.nat, store }, {
    ac: true, now: NOW, bulletin: b, coupons: kuponlar(10, [1]),
  });
  await testKur({ nat: c.nat, store }, { now: NOW });
  assert.equal(c.kayitlar.size, 2, 'başlangıçta maç + test kaydı var');

  // Kullanıcı telefon ayarlarından izni kapattı; uygulama öne geliyor.
  c.izinAyarla('denied');
  const d = await durumOku({ nat: c.nat, store });

  assert.equal(d.acik, false, 'izin yokken "açık" gösterilmemeli');
  assert.equal(d.izin, 'denied');
  assert.equal(d.tercihDuzeltildi, true, 'ekran bu düzeltmeyi kullanıcıya söyleyebilmeli');
  assert.equal(store.gor().enabled, false, 'depo da dürüstçe kapanmalı');
  assert.equal(c.kayitlar.size, 0, 'çalmayacak kayıtlar cihazda bırakılmamalı');
  assert.equal(d.kurulu, 0);
});

test('B5 · durum okuma İZİN SORMAZ (ekran açılınca kullanıcıya sistem penceresi çıkmaz)', async () => {
  const c = sahteCihaz({ izin: 'denied' });
  const store = sahteDepo();
  await durumOku({ nat: c.nat, store });
  assert.ok(!c.gunluk.includes('izinIste'), 'ekranı açmak izin istemez');
});

test('B6 · destek yoksa izin "unsupported" döner ve hata ile karıştırılmaz', async () => {
  const yok = { destek: false, durum: DURUM.WEB, platform: 'web' };
  assert.equal(await izinAl(yok), 'unsupported');

  const patlak = {
    destek: true,
    async izinOku() { throw new Error('native yok'); },
    async izinIste() { throw new Error('native yok'); },
  };
  assert.equal(await izinAl(patlak), 'hata', 'çağrı patlarsa "desteklenmiyor" denmez');
});

test('B7 · izinSonucu / uzlastir dürüstlük kuralı', () => {
  assert.equal(izinSonucu({ granted: true }), 'granted');
  assert.equal(izinSonucu({ granted: false, canAskAgain: false }), 'blocked');
  assert.equal(izinSonucu({ granted: false, canAskAgain: true }), 'denied');
  assert.equal(izinSonucu({ ios: { status: 3 } }), 'granted', 'iOS provisional izin de çalar');

  assert.deepEqual(uzlastir({ enabled: true, izin: 'granted' }), { enabled: true, degisti: false });
  assert.deepEqual(uzlastir({ enabled: true, izin: 'denied' }), { enabled: false, degisti: true });
  assert.deepEqual(uzlastir({ enabled: false, izin: 'granted' }), { enabled: false, degisti: false });
});

// ===========================================================================
// C. ZAMANLAMA — tek bildirim, çoğalmama, iptal, yeniden zamanlama
// ===========================================================================

async function acik(cihazAyar = {}) {
  const c = sahteCihaz({ izin: 'granted', ...cihazAyar });
  const store = sahteDepo({ enabled: true, onceDk: 60 });
  return { c, store, ctx: { nat: c.nat, store } };
}

test('C1 · aynı maç birden çok kuponda olsa da TEK bildirim kurulur', async () => {
  const { c, ctx } = await acik();
  const b = { roundId: 10, matches: [mac(1, 180), mac(2, 240)] };
  // 1 numaralı maç iki ayrı kuponda da işaretli.
  const r = await macSenkron(ctx, { now: NOW, bulletin: b, coupons: kuponlar(10, [1, 2], [1]) });

  assert.equal(r.durum, 'ok');
  assert.equal(c.kayitlar.size, 2, 'iki farklı maç → iki kayıt (kopya yok)');
  assert.deepEqual([...c.kayitlar.keys()].sort(), ['mac:10:1', 'mac:10:2']);
});

test('C2 · tekrar çalıştırmada bildirimler ÇOĞALMAZ ve gereksiz kurulum yapılmaz', async () => {
  const { c, ctx } = await acik();
  const b = { roundId: 10, matches: [mac(1, 180), mac(2, 240)] };
  const girdi = { now: NOW, bulletin: b, coupons: kuponlar(10, [1, 2]) };

  await macSenkron(ctx, girdi);
  c.gunluk.length = 0;
  const r2 = await macSenkron(ctx, girdi);

  assert.equal(c.kayitlar.size, 2, 'ikinci çalıştırmada kayıt sayısı artmamalı');
  assert.equal(r2.denenen, 0, 'değişmeyen kayıt yeniden kurulmamalı');
  assert.equal(r2.iptal, 0);
  assert.equal(r2.durum, 'ok');
  assert.ok(!c.gunluk.some((x) => x.startsWith('zamanla:')), 'boşuna zamanlama çağrısı yok');
});

test('C3 · maç kupondan ÇIKARILINCA bildirimi iptal edilir', async () => {
  const { c, ctx } = await acik();
  const b = { roundId: 10, matches: [mac(1, 180), mac(2, 240)] };

  await macSenkron(ctx, { now: NOW, bulletin: b, coupons: kuponlar(10, [1, 2]) });
  assert.equal(c.kayitlar.size, 2);

  const r = await macSenkron(ctx, { now: NOW, bulletin: b, coupons: kuponlar(10, [1]) });

  assert.equal(r.iptal, 1);
  assert.deepEqual([...c.kayitlar.keys()], ['mac:10:1']);
  assert.ok(c.gunluk.includes('iptal:mac:10:2'));
});

test('C4 · maç SAATİ DEĞİŞİNCE eski kayıt silinir, yenisi kurulur', async () => {
  const { c, ctx } = await acik();
  const kupon = kuponlar(10, [1]);

  await macSenkron(ctx, { now: NOW, bulletin: { roundId: 10, matches: [mac(1, 180)] }, coupons: kupon });
  const ilk = c.kayitlar.get('mac:10:1').content.data.fireAt;

  // Maç 2 saat ertelendi.
  const r = await macSenkron(ctx, { now: NOW, bulletin: { roundId: 10, matches: [mac(1, 300)] }, coupons: kupon });

  assert.equal(c.kayitlar.size, 1, 'aynı maç için hâlâ tek kayıt');
  const yeni = c.kayitlar.get('mac:10:1').content.data.fireAt;
  assert.notEqual(yeni, ilk, 'yeni saate göre yeniden zamanlanmalı');
  assert.equal(yeni, Date.parse(sonra(300)) - 60 * 60000);
  assert.equal(r.iptal, 1);
  assert.equal(r.kuruldu, 1);
  assert.equal(r.durum, 'ok');
});

test('C5 · işletim sistemi kabul etmediyse "kuruldu" DENMEZ', async () => {
  const { c, ctx } = await acik({ kabulEt: () => false });
  const b = { roundId: 10, matches: [mac(1, 180)] };

  const r = await macSenkron(ctx, { now: NOW, bulletin: b, coupons: kuponlar(10, [1]) });

  assert.equal(r.durum, 'eksik', 'zamanlama kabul edilmediyse durum "ok" olamaz');
  assert.equal(r.kuruldu, 0);
  assert.equal(r.dogrulanan, 0);
  assert.equal(r.plan, 1);
  assert.equal(r.denenen, 1, 'denendiği dürüstçe raporlanır');
  assert.equal(c.kayitlar.size, 0);
});

test('C6 · başlama saati YOKSA bildirim UYDURULMAZ', async () => {
  const { c, ctx } = await acik();
  const b = { roundId: 10, matches: [{ no: 1, date: null, home: { name: 'Ev' }, away: { name: 'Dep' } }] };

  const r = await macSenkron(ctx, { now: NOW, bulletin: b, coupons: kuponlar(10, [1]) });

  assert.equal(c.kayitlar.size, 0);
  assert.equal(r.plan, 0);
  assert.equal(r.atlanan.saatYok, 1);
  assert.equal(r.durum, 'ok', 'plan boşsa da yalan söylenmez; kurulacak bir şey yoktu');
});

test('C7 · tercih kapalıyken hiçbir şey kurulmaz, varsa temizlenir', async () => {
  const c = sahteCihaz({ izin: 'granted' });
  const store = sahteDepo({ enabled: true, onceDk: 60 });
  const ctx = { nat: c.nat, store };
  const b = { roundId: 10, matches: [mac(1, 180)] };

  await macSenkron(ctx, { now: NOW, bulletin: b, coupons: kuponlar(10, [1]) });
  assert.equal(c.kayitlar.size, 1);

  await store.yaz({ enabled: false, onceDk: 60 });
  const r = await macSenkron(ctx, { now: NOW, bulletin: b, coupons: kuponlar(10, [1]) });

  assert.equal(r.durum, 'kapali');
  assert.equal(r.iptal, 1);
  assert.equal(c.kayitlar.size, 0);
});

test('C8 · kurulu kayıtlar maç kimliğiyle ilişkilendirilir', async () => {
  const { c, ctx } = await acik();
  const b = { roundId: 42, matches: [mac(7, 180)] };
  await macSenkron(ctx, { now: NOW, bulletin: b, coupons: kuponlar(42, [7]) });

  const [kayit] = [...c.kayitlar.values()];
  assert.equal(kayit.identifier, 'mac:42:7', 'kimlik hafta + maç no ile kararlı olmalı');
  assert.equal(kayit.content.data.kind, MAC_KIND);
  assert.equal(kayit.content.data.params.no, 7);
  assert.deepEqual(ayikla([kayit]), [{ id: 'mac:42:7', fireAt: kayit.content.data.fireAt }]);
});

// ===========================================================================
// D. TEST BİLDİRİMİ
// ===========================================================================

const YASAK_ALANLAR = [
  'email', 'e-posta', 'eposta', 'mail', 'token', 'şifre', 'sifre', 'password',
  'puan', 'point', 'skor', 'score', 'tahmin', 'kupon', 'coupon', 'selection',
  'seçim', 'user', 'kullanıcı', 'username', 'rozet', 'seviye',
];

test('D1 · test bildirimi KİŞİSEL VERİ taşımaz', async () => {
  const c = sahteCihaz({ izin: 'granted' });
  const store = sahteDepo({ enabled: true, onceDk: 60 });

  const r = await testKur({ nat: c.nat, store }, { now: NOW });
  assert.equal(r.ok, true);

  const kayit = c.kayitlar.get(TEST_ID);
  assert.equal(kayit.content.body, 'Test bildirimi başarıyla çalıştı.');
  assert.equal(kayit.content.title, 'Bildirim testi');

  // Veri alanı: yalnız yönlendirme + tür + zaman. Maç, kullanıcı, tahmin yok.
  assert.deepEqual(
    Object.keys(testIcerigi({ now: NOW }).data).sort(),
    ['kind', 'screen', 'tab'],
  );
  assert.deepEqual(
    Object.keys(kayit.content.data).sort(),
    ['fireAt', 'kind', 'screen', 'tab'],
  );

  const metin = JSON.stringify(kayit).toLowerCase();
  for (const yasak of YASAK_ALANLAR) {
    assert.ok(!metin.includes(yasak), `test bildiriminde "${yasak}" geçmemeli: ${metin}`);
  }
  assert.ok(!metin.includes('@'), 'e-posta biçimi geçmemeli');
  assert.ok(!metin.includes('mac:'), 'test bildirimi bir maça bağlanmamalı');
});

test('D2 · test bildirimi BİR DAKİKA sonrasına kurulur', async () => {
  const c = sahteCihaz({ izin: 'granted' });
  const store = sahteDepo({ enabled: true, onceDk: 60 });

  const r = await testKur({ nat: c.nat, store }, { now: NOW });

  assert.equal(TEST_ONCE_SN, 60);
  assert.equal(r.saniye, 60);
  assert.equal(r.fireAt, NOW + 60000);
  assert.equal(c.kayitlar.get(TEST_ID).content.data.fireAt, NOW + 60000);
});

test('D3 · test bildirimi GERÇEK kanal ve GERÇEK zamanlama yolunu kullanır', async () => {
  const c = sahteCihaz({ izin: 'granted' });
  const store = sahteDepo({ enabled: true, onceDk: 60 });

  await testKur({ nat: c.nat, store }, { now: NOW });

  assert.ok(c.gunluk.includes('kanal'), 'maç hatırlatmasıyla aynı kanal hazırlanmalı');
  assert.ok(c.gunluk.includes(`zamanla:${TEST_ID}`), 'ayrı/sahte bir yol kullanılmamalı');
});

test('D4 · tekrar basılınca test bildirimi ÇOĞALMAZ', async () => {
  const c = sahteCihaz({ izin: 'granted' });
  const store = sahteDepo({ enabled: true, onceDk: 60 });

  await testKur({ nat: c.nat, store }, { now: NOW });
  await testKur({ nat: c.nat, store }, { now: NOW + 5000 });

  const testler = [...c.kayitlar.keys()].filter((k) => k.startsWith('test:'));
  assert.equal(testler.length, 1, 'tek test kaydı kalmalı');
  assert.equal(c.gunluk.filter((x) => x === `iptal:${TEST_ID}`).length, 2, 'önce eski kayıt silinir');
  assert.equal(c.kayitlar.get(TEST_ID).content.data.fireAt, NOW + 5000 + 60000);
});

test('D5 · izin yoksa test bildirimi KURULMAZ ve "kuruldu" denmez', async () => {
  const c = sahteCihaz({ izin: 'denied' });
  const store = sahteDepo({ enabled: true, onceDk: 60 });

  const r = await testKur({ nat: c.nat, store }, { now: NOW });

  assert.equal(r.ok, false);
  assert.equal(r.izin, 'denied');
  assert.equal(r.neden, 'izin');
  assert.equal(c.kayitlar.size, 0);
});

test('D6 · işletim sistemi test bildirimini kabul etmediyse dürüstçe raporlanır', async () => {
  const c = sahteCihaz({ izin: 'granted', kabulEt: () => false });
  const store = sahteDepo({ enabled: true, onceDk: 60 });

  const r = await testKur({ nat: c.nat, store }, { now: NOW });

  assert.equal(r.ok, false);
  assert.equal(r.neden, 'zamanlanamadi');
  assert.equal(r.izin, 'granted', 'sorun izinde değil, zamanlamada');
});

test('D7 · maç eşitlemesi test kaydını SİLMEZ (ve tersi)', async () => {
  const { c, ctx } = await acik();
  const b = { roundId: 10, matches: [mac(1, 180)] };

  await testKur(ctx, { now: NOW });
  await macSenkron(ctx, { now: NOW, bulletin: b, coupons: kuponlar(10, [1]) });

  assert.ok(c.kayitlar.has(TEST_ID), 'maç eşitlemesi test bildirimini iptal etmemeli');
  assert.ok(c.kayitlar.has('mac:10:1'));

  // Kupon boşalırsa maç kaydı gider ama test kaydı durur.
  await macSenkron(ctx, { now: NOW, bulletin: b, coupons: [] });
  assert.ok(c.kayitlar.has(TEST_ID));
  assert.ok(!c.kayitlar.has('mac:10:1'));
});

test('D8 · test kaydı yalnız kendi türüyle tanınır', () => {
  assert.equal(testKaydi([{ identifier: TEST_ID, content: { data: { kind: TEST_KIND } } }]).id, TEST_ID);
  assert.equal(testKaydi([{ identifier: TEST_ID, content: { data: { kind: 'baska' } } }]), null);
  assert.equal(testKaydi([{ identifier: 'baska', content: { data: { kind: TEST_KIND } } }]), null);
  // Kullanıcının BAŞKA uygulamalardan/bizim olmayan kayıtlarına dokunulmaz.
  assert.deepEqual(ayikla([{ identifier: 'mac:10:1', content: { data: { kind: 'baska' } } }]), []);
});

test('D9 · destek yoksa test bildirimi denenmez', async () => {
  const r = await testKur({ nat: { destek: false }, store: sahteDepo() }, { now: NOW });
  assert.equal(r.ok, false);
  assert.equal(r.neden, 'destek-yok');
  assert.equal(r.izin, 'unsupported');
});

// ===========================================================================
// E. TEMİZLİK — çıkış ve hesap silme
// ===========================================================================

test('E1 · hepsiniIptal maç hatırlatmalarını VE test kaydını siler', async () => {
  const { c, ctx } = await acik();
  const b = { roundId: 10, matches: [mac(1, 180), mac(2, 240)] };

  await macSenkron(ctx, { now: NOW, bulletin: b, coupons: kuponlar(10, [1, 2]) });
  await testKur(ctx, { now: NOW });
  // Bize ait OLMAYAN bir kayıt: silinmemeli.
  c.kayitlar.set('baska:1', { identifier: 'baska:1', content: { data: { kind: 'x' } } });

  const r = await hepsiniIptal(c.nat);

  assert.equal(r.iptal, 3);
  assert.deepEqual([...c.kayitlar.keys()], ['baska:1'], 'yalnız bizim kayıtlarımız silinir');
});

test('E2 · macIptal test kaydına dokunmaz', async () => {
  const { c, ctx } = await acik();
  await macSenkron(ctx, {
    now: NOW, bulletin: { roundId: 10, matches: [mac(1, 180)] }, coupons: kuponlar(10, [1]),
  });
  await testKur(ctx, { now: NOW });

  const r = await macIptal(c.nat);
  assert.equal(r.iptal, 1);
  assert.deepEqual([...c.kayitlar.keys()], [TEST_ID]);
});

test('E3 · hesap silme ve çıkış bildirim temizliğini ÇAĞIRIR', () => {
  const sil = oku('src/screens/DeleteAccountScreen.js');
  assert.match(sil, /cancelAllOurNotifications/, 'hesap silmede bildirimler iptal edilmeli');
  assert.match(sil, /import\s*\{\s*cancelAllOurNotifications\s*\}\s*from\s*'\.\.\/services\/pushService'/);

  const auth = oku('src/auth.js');
  assert.match(auth, /cancelAllOurNotifications/, 'çıkışta bildirimler iptal edilmeli');
  const cikis = auth.slice(auth.indexOf('export async function logout'));
  assert.match(cikis.slice(0, 600), /cancelAllOurNotifications\(\)/);
  assert.match(auth, /handleSessionRevoked[\s\S]{0,300}cancelAllOurNotifications/);
});

// ===========================================================================
// F. PAKET BÜTÜNLÜĞÜ — yedek yükleme yolları gerçekten var ve güvenli mi?
// ===========================================================================

const PAKET = path.join(KOK, 'node_modules', 'expo-notifications');

// Yalnız YEREL bildirim için gereken yerli modüller (Expo Go'da mevcut).
const IZINLI_YERLI = new Set([
  'ExpoNotificationPermissionsModule',
  'ExpoNotificationScheduler',
  'ExpoNotificationChannelManager',
  'ExpoNotificationsHandlerModule',
  'ExpoNotificationsEmitter',
]);

// Expo Go'da (SDK 53+) Android'de KAYITLI OLMAYAN uzak-push modülleri.
const YASAKLI_YERLI = [
  'ExpoPushTokenManager',
  'ExpoTopicSubscriptionModule',
  'NotificationsServerRegistrationModule',
  'ExpoBackgroundNotificationTasksModule',
];

function cozumle(dosyaDizin, spec, platform) {
  const temel = path.resolve(dosyaDizin, spec);
  for (const ek of [`.${platform}.js`, '.native.js', '.js', '/index.js']) {
    const aday = temel + ek;
    if (fs.existsSync(aday)) return aday;
  }
  return null;
}

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*['"](\.[^'"]+)['"]/g;
const YAN_ETKI_RE = /(?:^|\n)\s*import\s*['"](\.[^'"]+)['"]/g;
const YERLI_RE = /require(?:Optional)?NativeModule(?:<[^>]*>)?\(\s*['"]([^'"]+)['"]\s*\)/g;

/** Bir giriş dosyasından ulaşılan TÜM yerli modül adları (paket içi yürüyüş). */
function yerliModulleri(giris, platform) {
  const gorulen = new Set();
  const bulunan = new Set();
  const kuyruk = [giris];
  while (kuyruk.length) {
    const dosya = kuyruk.pop();
    if (!dosya || gorulen.has(dosya)) continue;
    gorulen.add(dosya);
    const kod = fs.readFileSync(dosya, 'utf8');
    for (const m of kod.matchAll(YERLI_RE)) bulunan.add(m[1]);
    const dizin = path.dirname(dosya);
    for (const re of [IMPORT_RE, YAN_ETKI_RE]) {
      re.lastIndex = 0;
      for (const m of kod.matchAll(re)) {
        const hedef = cozumle(dizin, m[1], platform);
        if (hedef) kuyruk.push(hedef);
      }
    }
  }
  return bulunan;
}

test('F1 · pushService.js\'teki yedek yükleme yolları pakette GERÇEKTEN var', () => {
  const svc = oku('src/services/pushService.js');
  const yollar = [...svc.matchAll(/require\('expo-notifications\/build\/([A-Za-z.]+)'\)/g)]
    .map((m) => m[1]);

  assert.ok(yollar.length >= 9, `yedek yol sayısı beklenenden az: ${yollar.length}`);
  for (const ad of yollar) {
    const hedef = cozumle(path.join(PAKET, 'build'), `./${ad}`, 'android');
    assert.ok(hedef, `expo-notifications/build/${ad} pakette bulunamadı (paket yeniden düzenlenmiş olabilir)`);
  }
});

test('F2 · yedek yollar UZAK-PUSH yerli modülü İSTEMEZ (Expo Go\'da patlayan modüller)', () => {
  const svc = oku('src/services/pushService.js');
  const yollar = [...svc.matchAll(/require\('expo-notifications\/build\/([A-Za-z.]+)'\)/g)]
    .map((m) => m[1]);

  const hepsi = new Set();
  for (const ad of yollar) {
    const giris = cozumle(path.join(PAKET, 'build'), `./${ad}`, 'android');
    for (const y of yerliModulleri(giris, 'android')) hepsi.add(y);
  }

  for (const yasak of YASAKLI_YERLI) {
    assert.ok(!hepsi.has(yasak), `yedek yol ${yasak} istiyor — Expo Go'da yine patlar`);
  }
  for (const y of hepsi) {
    assert.ok(IZINLI_YERLI.has(y), `beklenmeyen yerli modül: ${y}`);
  }
  assert.ok(hepsi.size > 0, 'yürüyüş hiçbir yerli modül bulmadıysa test anlamını yitirir');
});

test('F3 · paketin giriş dosyası (barrel) uzak-push modüllerini GERÇEKTEN yüklüyor — kök neden', () => {
  const giris = cozumle(path.join(PAKET, 'build'), './index', 'android');
  assert.ok(giris, 'expo-notifications giriş dosyası bulunamadı');
  const hepsi = yerliModulleri(giris, 'android');

  const uzak = YASAKLI_YERLI.filter((y) => hepsi.has(y));
  assert.ok(
    uzak.length > 0,
    'barrel artık uzak-push modülü yüklemiyorsa iki aşamalı yükleme gözden geçirilmeli',
  );
});

// ===========================================================================
// G. EKRAN — dürüst metin ve görünürlük kuralları
// ===========================================================================

test('G1 · Bildirimler ekranı SABİT "Tarayıcıda…" metnini artık içermiyor', () => {
  const ekran = oku('src/screens/NotificationsScreen.js');
  assert.ok(
    !/Tarayıcıda/.test(ekran),
    'ekran metni ortama göre pushEnv.ortamAciklamasi() ile üretilmeli, sabit yazılmamalı',
  );
  assert.match(ekran, /ortamMesaji/, 'açıklama ortam sınıflandırmasından gelmeli');
});

test('G2 · aç/kapa anahtarı DESTEK varsa gösterilir (izin durumuna göre gizlenmez)', () => {
  const ekran = oku('src/screens/NotificationsScreen.js');
  assert.match(ekran, /\{push\.destek \?\s*\(/, 'anahtar yalnız destek koşuluna bağlı olmalı');
  assert.ok(
    !/izin\s*!==\s*'blocked'/.test(ekran),
    'anahtarın görünürlüğü izin durumuna bağlanmamalı — kullanıcı izni açamaz hâle gelir',
  );
});

test('G3 · test bildirimi düğmesi yalnız telefon hatırlatması AÇIKKEN görünür', () => {
  const ekran = oku('src/screens/NotificationsScreen.js');
  assert.match(ekran, /\{push\.destek && push\.acik \?\s*\(/);
  assert.match(ekran, /testBildirimiGonder/);
});

test('G4 · izin kapalıyken telefon ayarlarına gitme seçeneği sunulur', () => {
  const ekran = oku('src/screens/NotificationsScreen.js');
  assert.match(ekran, /ayarlariAc/);
  assert.match(ekran, /push\.destek && !push\.acik && push\.ayarOner/);
});

test('G5 · uygulama öne geldiğinde durum yeniden okunur (izin geri alınmışsa)', () => {
  const ekran = oku('src/screens/NotificationsScreen.js');
  assert.match(ekran, /AppState\.addEventListener/);
  assert.match(ekran, /'active'/);
  assert.match(ekran, /addListener\('focus'/);
});

test('G6 · ekran kendi başına ortam tahmini yapmaz', () => {
  const ekran = oku('src/screens/NotificationsScreen.js');
  assert.match(ekran, /pushDurumu/, 'gösterilen durum cihazdan okunmalı');
  assert.ok(
    !/Platform\.OS/.test(ekran),
    'ekran platform sınamasını kendisi yapmamalı — karar pushEnv.js\'te tek yerde',
  );
  for (const yasak of ['appOwnership', 'executionEnvironment', 'isRunningInExpoGo']) {
    assert.ok(!ekran.includes(yasak), `ekran ${yasak} bilgisine göre karar vermemeli`);
  }
});
