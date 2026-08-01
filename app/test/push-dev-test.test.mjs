// GELİŞTİRME TESTİ — "MAÇ HATIRLATMASINI TEST ET" TESTLERİ.
//
// NEDEN VAR: üretimdeki maç hatırlatması maçtan 60 dakika önce düşer. Bildirime
// dokununca DOĞRU MAÇIN detay ekranının açıldığını gerçek telefonda görmek için
// saatlerce beklemek gerekirdi. Geliştirme kipindeki bu seçenek, ÜRETİMDE
// KULLANILAN `match-starting` bildiriminin aynısını 1 dakika sonrasına kurar.
//
// Bu dosya şunları KANITLAR (hepsi cihazsız, saf modüller üzerinden):
//   A. Seçilen maç GERÇEKTİR: güncel bültendeki, başlamamış, en yakın maç.
//   B. Uygun maç yoksa MAÇ UYDURULMAZ; neden dürüstçe döner.
//   C. Bildirimin içeriği üretimdekiyle AYNI yoldan üretilir (tek kaynak).
//   D. Kimlik yalıtımı: bu kayıt `mac:` ailesine girmez; eşitleme onu ne kurar
//      ne siler, "kurulu hatırlatma" sayısına karışmaz — ama bildirim tamamen
//      kapatılınca geride de kalmaz.
//   E. Bildirimde kişisel veri yoktur; kupon verisi bu yolda HİÇ okunmaz.
//   F. Üretimdeki 60 dakika düzeni DEĞİŞMEZ.
//   G. Yayın kapısı: seçenek yalnız geliştirme kipinde çizilir.
//   H. Cihaz katmanı: izin yoksa / işletim sistemi kabul etmediyse "kuruldu"
//      denmez; iki kez basınca bildirim çoğalmaz.
//
// UYARI: burası CİHAZSIZ bir testtir. Geçmesi, gerçek telefonda doğru maçın
// açıldığını KANITLAMAZ; yalnız mantığın ve bağlantının doğru olduğunu gösterir.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  testMacSec, testMacIcerigi, gelistirmeKipi,
  TEST_MAC_ID, TEST_MAC_ONCE_SN, TEST_MAC_BASLIK,
} from '../src/pushDevTest.js';
import {
  planMatchReminders, macBildirimIcerigi, MAC_BASLIK, VARSAYILAN_ONCE_DK,
} from '../src/pushPlanner.js';
import {
  testMacKur, bizimMac, bizimTestMac, testMacKaydi, ayikla, macSenkron,
  macIptal, hepsiniIptal, MAC_KIND,
} from '../src/pushSync.js';
import { rotaCoz, MAC_ROTASI } from '../src/pushRoute.js';

const BURASI = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(BURASI, '..');
const oku = (p) => fs.readFileSync(path.join(KOK, p), 'utf8');

const NOW = Date.parse('2026-07-25T12:00:00.000Z');
const sonra = (dk) => new Date(NOW + dk * 60000).toISOString();

const mac = (no, dk, ek = {}) => ({
  no, date: sonra(dk), home: { name: `Ev ${no}` }, away: { name: `Dep ${no}` }, ...ek,
});

const kupon = (roundId, nolar) => ([{
  id: 'k1', roundId, couponNo: 1, finalVersionId: 'v1',
  versions: [{ id: 'v1', versionNo: 1, selections: nolar.map((no) => ({ no, selectedOutcomes: ['1'] })) }],
}]);

// ---------------------------------------------------------------------------
// Sahte cihaz katmanı (pushService.nat ile AYNI sözleşme)
// ---------------------------------------------------------------------------
function sahteNat({ destek = true, izin = 'granted', kabul = true } = {}) {
  const kayitlar = new Map();
  const gunluk = [];
  const nat = {
    destek,
    izinOku: async () => ({ status: izin, granted: izin === 'granted' }),
    izinIste: async () => ({ status: izin, granted: izin === 'granted' }),
    async kanalHazirla() { gunluk.push('kanal'); },
    // Gerçek `pushService.nat.zamanla` ile aynı eşleme: fireAt veriye yazılır.
    async zamanla(p) {
      gunluk.push(`zamanla:${p.id}`);
      if (!kabul) return;                        // işletim sistemi sessizce reddetti
      kayitlar.set(p.id, {
        identifier: p.id,
        content: { title: p.title, body: p.body, data: { ...p.data, fireAt: p.fireAt } },
      });
    },
    async iptal(id) { gunluk.push(`iptal:${id}`); kayitlar.delete(id); },
    async kurulular() { return [...kayitlar.values()]; },
  };
  return { nat, kayitlar, gunluk };
}

const sahteStore = (t = { enabled: true, onceDk: VARSAYILAN_ONCE_DK }) => {
  let cur = { ...t };
  return { oku: async () => ({ ...cur }), yaz: async (n) => { cur = { ...n }; } };
};

// ===========================================================================
// A. GERÇEK MAÇ SEÇİMİ
// ===========================================================================

test('A1 · güncel bültendeki EN YAKIN başlamamış maç seçilir', () => {
  const b = { roundId: 10, matches: [mac(3, 300), mac(1, 120), mac(2, 200)] };
  const s = testMacSec({ now: NOW, bulletin: b });
  assert.equal(s.ok, true);
  assert.equal(s.mac.no, 1, 'en yakın maç seçilmeli (test hep "sırada olan" maçla yapılsın)');
  assert.equal(s.mac.ev, 'Ev 1');
  assert.equal(s.mac.dep, 'Dep 1');
  assert.equal(s.mac.baslama, Date.parse(sonra(120)));
});

test('A2 · başlamış / canlı / resmî sonuçlu maç seçilmez', () => {
  const b = {
    roundId: 10,
    matches: [
      mac(1, 60, { status: 'live' }),
      mac(2, 70, { status: 'finished' }),
      mac(3, 80, { result: '1', score: '2-0' }),   // isOfficial → resmîleşmiş
      mac(4, 400),
    ],
  };
  const s = testMacSec({ now: NOW, bulletin: b });
  assert.equal(s.ok, true);
  assert.equal(s.mac.no, 4, 'yalnız başlamamış maç kullanılmalı');
});

test('A3 · saati/takımı/numarası eksik maç seçilmez (uydurma yok)', () => {
  const b = {
    roundId: 10,
    matches: [
      { no: 1, date: null, home: { name: 'Ev 1' }, away: { name: 'Dep 1' } },
      { no: 2, date: sonra(90), home: { name: '' }, away: { name: 'Dep 2' } },
      { no: 0, date: sonra(95), home: { name: 'Ev 0' }, away: { name: 'Dep 0' } },
      mac(5, 500),
    ],
  };
  const s = testMacSec({ now: NOW, bulletin: b });
  assert.equal(s.mac.no, 5);
});

test('A4 · başlama saati geçmiş maç seçilmez', () => {
  const b = { roundId: 10, matches: [mac(1, -30), mac(2, 45)] };
  const s = testMacSec({ now: NOW, bulletin: b });
  assert.equal(s.mac.no, 2);
});

test('A5 · maç 60 dakikadan yakın olsa bile test yapılabilir (60 dk kuralı burada geçerli DEĞİL)', () => {
  // Üretimde 5 dakika kalan maça hatırlatma KURULMAZ (fireAt geçmişte kalır).
  // Testin amacı ise beklemeden kanıtlamak; bu yüzden burada maç yakın olabilir.
  const b = { roundId: 10, matches: [mac(1, 5)] };
  const s = testMacSec({ now: NOW, bulletin: b });
  assert.equal(s.ok, true);
  assert.equal(s.mac.no, 1);
});

// ===========================================================================
// B. DÜRÜST NEDENLER — MAÇ UYDURULMAZ
// ===========================================================================

test('B1 · bülten okunamadıysa "bulten-yok" döner, maç uydurulmaz', () => {
  for (const b of [null, undefined, {}, { matches: [] }, { matches: 'x' }]) {
    const s = testMacSec({ now: NOW, bulletin: b });
    assert.equal(s.ok, false);
    assert.equal(s.neden, 'bulten-yok');
    assert.equal(s.mac, null);
  }
});

test('B2 · bültende başlamamış maç kalmadıysa "mac-yok" döner', () => {
  const b = { roundId: 10, matches: [mac(1, -60), mac(2, 30, { status: 'finished' })] };
  const s = testMacSec({ now: NOW, bulletin: b });
  assert.equal(s.ok, false);
  assert.equal(s.neden, 'mac-yok');
  assert.equal(s.mac, null);
});

test('B3 · uygun maç yoksa KAYIT üretilmez (telefona hiçbir şey gitmez)', () => {
  const r = testMacIcerigi({ now: NOW, bulletin: null });
  assert.equal(r.ok, false);
  assert.equal(r.kayit, undefined, 'kayıt üretilirse uydurma bildirim kurulurdu');
});

test('B4 · ekran her neden için DÜRÜST bir açıklama gösterir (sessiz başarısızlık yok)', () => {
  const src = oku('src/screens/NotificationsScreen.js');
  for (const neden of ['bulten-yok', 'mac-yok', 'izin', 'zamanlanamadi', 'destek-yok']) {
    assert.ok(src.includes(`'${neden}'`), `ekranda "${neden}" nedeni karşılanmıyor`);
  }
  assert.match(src, /[Uu]ydurma maç oluşturulmaz/, 'uygun maç yokken dürüst açıklama olmalı');
});

// ===========================================================================
// C. İÇERİK ÜRETİMDEKİYLE AYNI YOLDAN GELİR
// ===========================================================================

test('C1 · yönlendirme verisi üretimdeki hatırlatmayla BİREBİR aynıdır', () => {
  const b = { roundId: 10, matches: [mac(7, 300)] };

  const uretim = planMatchReminders({ now: NOW, bulletin: b, coupons: kupon(10, [7]) });
  const testi = testMacIcerigi({ now: NOW, bulletin: b });

  assert.equal(uretim.items.length, 1);
  assert.equal(testi.ok, true);
  assert.deepEqual(testi.kayit.data, uretim.items[0].data,
    'veri farklıysa test, üretimdeki yönlendirmeyi KANITLAMAZ');
  assert.equal(testi.kayit.data.kind, MAC_KIND, 'tür üretimle aynı olmalı');
});

test('C2 · gövde üretimdekiyle AYNIDIR; yalnız başlık geliştirme olduğunu söyler', () => {
  const b = { roundId: 10, matches: [mac(4, 300)] };
  const uretim = planMatchReminders({ now: NOW, bulletin: b, coupons: kupon(10, [4]) }).items[0];
  const testi = testMacIcerigi({ now: NOW, bulletin: b }).kayit;

  assert.equal(testi.body, uretim.body, 'gövde birebir aynı olmalı');
  assert.equal(uretim.title, MAC_BASLIK);
  assert.equal(testi.title, TEST_MAC_BASLIK);
  assert.notEqual(testi.title, uretim.title, 'test bildirimi gerçek hatırlatmayla karıştırılmamalı');
  assert.match(testi.title, /[Gg]eliştirme/, 'başlık dürüstçe geliştirme testi demeli');
});

test('C3 · içerik TEK KAYNAKTAN üretilir (macBildirimIcerigi)', () => {
  const b = { roundId: 10, matches: [mac(9, 240)] };
  const testi = testMacIcerigi({ now: NOW, bulletin: b });
  const beklenen = macBildirimIcerigi({ ...testi.mac, baslik: TEST_MAC_BASLIK });

  assert.equal(testi.kayit.title, beklenen.title);
  assert.equal(testi.kayit.body, beklenen.body);
  assert.deepEqual(testi.kayit.data, beklenen.data);

  // Kaynak düzeyinde de ayrı bir içerik yolu olmamalı.
  const src = oku('src/pushDevTest.js');
  assert.ok(src.includes('macBildirimIcerigi'), 'içerik planlayıcıdan gelmeli');
  assert.doesNotMatch(src, /kind:\s*'/, 'tür elle yazılırsa üretimden sapabilir');
  assert.doesNotMatch(src, /LiveMatchDetail/, 'ekran adı elle yazılırsa üretimden sapabilir');
});

test('C4 · metin biçimi sabittir: yalnız maç no · takımlar · saat', () => {
  const b = { roundId: 10, matches: [mac(12, 300)] };
  const k = testMacIcerigi({ now: NOW, bulletin: b }).kayit;
  assert.match(k.body, /^\d+\. [^·]+ – [^·]+ · \d{2}:\d{2}$/, `beklenmedik metin biçimi: ${k.body}`);
  assert.match(k.body, /^12\. Ev 12 – Dep 12 · /);
});

test('C5 · metinde İDDİALI DİL ya da tahmin yoktur', () => {
  const YASAK = /kesin|garanti|banko|yanılmaz|net favori|kazan|oyna|bahis|iddaa|tahminimiz/i;
  const b = { roundId: 10, matches: [mac(2, 300)] };
  const k = testMacIcerigi({ now: NOW, bulletin: b }).kayit;
  assert.doesNotMatch(k.title, YASAK, `başlıkta yasak dil: ${k.title}`);
  assert.doesNotMatch(k.body, YASAK, `metinde yasak dil: ${k.body}`);
});

test('C6 · 1 dakika sonrasına kurulur (kullanıcıya söylenen süreyle aynı)', () => {
  const b = { roundId: 10, matches: [mac(1, 300)] };
  const k = testMacIcerigi({ now: NOW, bulletin: b }).kayit;
  assert.equal(TEST_MAC_ONCE_SN, 60);
  assert.equal(k.fireAt, NOW + 60000);
  assert.ok(k.fireAt > NOW, 'geçmişe kurulan bildirim telefonu anında çaldırır');
});

test('C7 · dokunulunca ÇÖZÜLEN ROTA seçilen maçın detayıdır', () => {
  const b = { roundId: 10, matches: [mac(6, 300)] };
  const k = testMacIcerigi({ now: NOW, bulletin: b }).kayit;
  // Bülten biliniyor ve maç orada → doğrudan o maçın detayı açılmalı.
  assert.deepEqual(rotaCoz(k.data, { macVar: true }), { ...MAC_ROTASI, params: { no: 6 } });
  // Bülten henüz yüklenmediyse de maç detayına gidilir (ekran kendi hatasını gösterir).
  assert.deepEqual(rotaCoz(k.data, { macVar: null }), { ...MAC_ROTASI, params: { no: 6 } });
});

// ===========================================================================
// D. KİMLİK YALITIMI — ÜRETİM DÜZENİ BOZULMAZ
// ===========================================================================

test('D1 · test kaydının kimliği `mac:` ailesine GİRMEZ', () => {
  assert.equal(TEST_MAC_ID, 'test:mac');
  assert.ok(!TEST_MAC_ID.startsWith('mac:'), 'kimlik `mac:` ile başlarsa eşitleme onu siler');
});

test('D2 · `bizimMac` test kaydını yakalamaz, `bizimTestMac` yakalar', () => {
  const b = { roundId: 10, matches: [mac(3, 300)] };
  const k = testMacIcerigi({ now: NOW, bulletin: b }).kayit;
  const istek = { identifier: k.id, content: { data: { ...k.data, fireAt: k.fireAt } } };

  assert.equal(bizimMac(istek), false, 'yakalanırsa "kurulu hatırlatma" sayısı yanlış olur');
  assert.equal(bizimTestMac(istek), true);
  assert.equal(ayikla([istek]).length, 0, 'sayıma karışmamalı');
  assert.deepEqual(testMacKaydi([istek]), { id: TEST_MAC_ID, fireAt: k.fireAt });
});

test('D3 · eşitleme (macSenkron) test kaydına DOKUNMAZ ve onu saymaz', async () => {
  const b = { roundId: 10, matches: [mac(1, 300), mac(2, 400)] };
  const { nat, kayitlar, gunluk } = sahteNat();
  const store = sahteStore();

  // Önce geliştirme testi kurulur…
  const t = await testMacKur({ nat, store }, { now: NOW, bulletin: b });
  assert.equal(t.ok, true);
  assert.ok(kayitlar.has(TEST_MAC_ID));

  // …sonra normal eşitleme çalışır (ekran her açılışta bunu yapar).
  gunluk.length = 0;
  const s = await macSenkron({ nat, store }, { now: NOW, bulletin: b, coupons: kupon(10, [1, 2]) });

  assert.equal(s.durum, 'ok');
  assert.equal(s.plan, 2, 'yalnız kupondaki 2 maç planlanmalı');
  assert.ok(kayitlar.has(TEST_MAC_ID), 'eşitleme geliştirme testini SİLMEMELİ');
  assert.ok(!gunluk.includes(`iptal:${TEST_MAC_ID}`), 'test kaydı iptal edilmemeli');

  // "Kurulu hatırlatma: N" sayısı dürüst kalmalı: 3 kayıt var ama 2'si hatırlatma.
  assert.equal(kayitlar.size, 3);
  assert.equal(ayikla([...kayitlar.values()]).length, 2, 'sayım yalnız gerçek hatırlatmaları saymalı');
});

test('D4 · "yalnız hatırlatmaları sil" test kaydını silmez; "hepsini sil" siler', async () => {
  const b = { roundId: 10, matches: [mac(1, 300)] };
  const { nat, kayitlar } = sahteNat();
  const store = sahteStore();

  await macSenkron({ nat, store }, { now: NOW, bulletin: b, coupons: kupon(10, [1]) });
  await testMacKur({ nat, store }, { now: NOW, bulletin: b });
  assert.equal(kayitlar.size, 2);

  await macIptal(nat);
  assert.ok(kayitlar.has(TEST_MAC_ID), 'macIptal yalnız maç hatırlatmalarını siler');
  assert.equal(kayitlar.size, 1);

  await testMacKur({ nat, store }, { now: NOW, bulletin: b });
  await hepsiniIptal(nat);
  assert.equal(kayitlar.size, 0, 'bildirim kapatılınca geliştirme testi geride kalmamalı');
});

test('D5 · üretimdeki hatırlatma kimlikleri değişmedi (`mac:<hafta>:<no>`)', () => {
  const b = { roundId: 10, matches: [mac(1, 300)] };
  const { items } = planMatchReminders({ now: NOW, bulletin: b, coupons: kupon(10, [1]) });
  assert.equal(items[0].id, 'mac:10:1');
});

// ===========================================================================
// E. GİZLİLİK — KUPON / KULLANICI VERİSİ TAŞINMAZ
// ===========================================================================

test('E1 · kayıtta yalnız maç no, takım adı, saat ve yönlendirme bulunur', () => {
  const b = { roundId: 10, matches: [mac(8, 300)] };
  const k = testMacIcerigi({ now: NOW, bulletin: b }).kayit;
  assert.deepEqual(Object.keys(k).sort(), ['body', 'data', 'fireAt', 'id', 'title']);
  assert.deepEqual(Object.keys(k.data).sort(), ['kind', 'params', 'screen', 'tab']);
  assert.deepEqual(k.data.params, { no: 8 });
});

test('E2 · bültendeki kişisel/ek alanlar bildirime SIZMAZ', () => {
  const kirli = {
    roundId: 10,
    userEmail: 'gizli@ornek.com',
    token: 'BELIRTEC-123',
    matches: [{
      ...mac(1, 300),
      tahmin: '1', kuponSecimi: 'X', oran: 2.35,
      username: 'emrah41', points: 4820, sessionId: 'OTURUM-9',
    }],
  };
  const k = testMacIcerigi({ now: NOW, bulletin: kirli }).kayit;
  const metin = JSON.stringify(k);
  for (const s of ['gizli@ornek.com', 'BELIRTEC-123', 'emrah41', '4820', 'OTURUM-9', '2.35', 'kuponSecimi']) {
    assert.ok(!metin.includes(s), `kişisel/ek veri sızdı: ${s}`);
  }
});

test('E3 · kupon verisi bu yolda HİÇ okunmaz', () => {
  const src = oku('src/pushDevTest.js');
  assert.ok(!/coupons/.test(src), 'geliştirme testi kupon okumamalı');
  assert.ok(!/seciliMacNolari/.test(src), 'kupon seçimi bu yolda kullanılmamalı');

  // Sözleşme düzeyinde de kupon kabul edilmiyor: fazladan alan sonucu değiştirmez.
  const b = { roundId: 10, matches: [mac(1, 300), mac(2, 400)] };
  const a = testMacIcerigi({ now: NOW, bulletin: b });
  const c = testMacIcerigi({ now: NOW, bulletin: b, coupons: kupon(10, [2]) });
  assert.deepEqual(c.kayit, a.kayit, 'kupon verisi seçimi etkilememeli');
  assert.equal(a.mac.no, 1, 'kupondan bağımsız olarak en yakın maç seçilmeli');

  // Ekran da servise kupon göndermiyor.
  const ekran = oku('src/screens/NotificationsScreen.js');
  const cagri = ekran.slice(ekran.indexOf('macTestiGonder({'));
  assert.ok(!cagri.slice(0, 120).includes('coupons'), 'ekran teste kupon göndermemeli');
});

// ===========================================================================
// F. ÜRETİMDEKİ 60 DAKİKA DÜZENİ DEĞİŞMEDİ
// ===========================================================================

test('F1 · varsayılan hatırlatma penceresi hâlâ 60 dakika', () => {
  assert.equal(VARSAYILAN_ONCE_DK, 60);
});

test('F2 · gerçek hatırlatma maçtan tam 60 dakika önce kurulur', () => {
  const b = { roundId: 10, matches: [mac(1, 300)] };
  const { items } = planMatchReminders({ now: NOW, bulletin: b, coupons: kupon(10, [1]) });
  assert.equal(items[0].fireAt, Date.parse(sonra(300)) - 60 * 60000);
});

test('F3 · geliştirme testi kurulduktan sonra da 60 dakika düzeni aynıdır', async () => {
  const b = { roundId: 10, matches: [mac(1, 300)] };
  const { nat, kayitlar } = sahteNat();
  const store = sahteStore();

  await testMacKur({ nat, store }, { now: NOW, bulletin: b });
  await macSenkron({ nat, store }, { now: NOW, bulletin: b, coupons: kupon(10, [1]) });

  const gercek = kayitlar.get('mac:10:1');
  assert.ok(gercek, 'gerçek hatırlatma kurulmalı');
  assert.equal(gercek.content.data.fireAt, Date.parse(sonra(300)) - 60 * 60000);
});

// ===========================================================================
// G. YAYIN KAPISI — MÜŞTERİYE GÖRÜNMEZ
// ===========================================================================

test('G1 · `gelistirmeKipi` __DEV__ değerini ÇAĞRI ANINDA okur', () => {
  const vardi = Object.prototype.hasOwnProperty.call(globalThis, '__DEV__');
  const eski = globalThis.__DEV__;
  try {
    delete globalThis.__DEV__;
    assert.equal(gelistirmeKipi(), false, '__DEV__ tanımsızsa kapı KAPALI olmalı');
    globalThis.__DEV__ = false;
    assert.equal(gelistirmeKipi(), false, 'yayın derlemesinde kapı KAPALI olmalı');
    globalThis.__DEV__ = true;
    assert.equal(gelistirmeKipi(), true);
  } finally {
    if (vardi) globalThis.__DEV__ = eski; else delete globalThis.__DEV__;
  }
});

test('G2 · ekran seçeneği KAPIYA bağlar (koşulsuz çizilmez)', () => {
  const src = oku('src/screens/NotificationsScreen.js');
  // `__DEV__` DOĞRUDAN okunmalı: Metro yayın derlemesinde onu `false` olarak
  // gömer ve küçültücü bölümü paketten tamamen atar. Yalnız `gelistirmeKipi()`
  // çağrısı olsaydı küçültücü içeriyi göremez, metinler pakette KALIRDI.
  assert.match(
    src,
    /const GELISTIRME = \(typeof __DEV__ !== 'undefined' && __DEV__ === true\) && gelistirmeKipi\(\);/,
    'kapı hem doğrudan __DEV__ hem ortak gelistirmeKipi() ile kurulmalı',
  );
  assert.match(src, /\{GELISTIRME && /, 'seçenek yalnız kapı açıkken çizilmeli');

  // "Maç hatırlatmasını test et" düğmesi kapının İÇİNDE olmalı.
  const kapi = src.indexOf('{GELISTIRME && ');
  const dugme = src.indexOf('Maç hatırlatmasını test et');
  assert.ok(kapi > 0 && dugme > kapi, 'düğme kapının içinde kalmalı');
});

test('G3 · geliştirme etiketi kullanıcıya dürüstçe görünür', () => {
  const src = oku('src/screens/NotificationsScreen.js');
  assert.match(src, /GELİŞTİRME — yayın sürümünde görünmez/);
});

test('G4 · saf modül: pushDevTest react-native / expo-notifications İMPORT ETMEZ', () => {
  const src = oku('src/pushDevTest.js');
  assert.doesNotMatch(src, /from 'react-native'/);
  assert.doesNotMatch(src, /from 'expo-notifications'/);
  assert.doesNotMatch(src, /require\(/);
});

test('G5 · servis katmanı bağlandı (ekran gerçek yolu çağırıyor)', () => {
  const svc = oku('src/services/pushService.js');
  assert.match(svc, /export function macTestiGonder\(/);
  assert.match(svc, /return testMacKur\(ctx, \{ now, bulletin \}\);/);
  const ekran = oku('src/screens/NotificationsScreen.js');
  assert.ok(ekran.includes('macTestiGonder'), 'ekran servisi çağırmalı');
});

// ===========================================================================
// H. CİHAZ KATMANI — DÜRÜST DURUM
// ===========================================================================

test('H1 · başarılı kurulumda seçilen maç geri döner ve kayıt cihazdadır', async () => {
  const b = { roundId: 10, matches: [mac(5, 300)] };
  const { nat, kayitlar, gunluk } = sahteNat();
  const r = await testMacKur({ nat, store: sahteStore() }, { now: NOW, bulletin: b });

  assert.equal(r.ok, true);
  assert.equal(r.izin, 'granted');
  assert.equal(r.neden, '');
  assert.equal(r.saniye, 60);
  assert.equal(r.fireAt, NOW + 60000);
  assert.equal(r.mac.no, 5);
  assert.ok(kayitlar.has(TEST_MAC_ID));
  assert.ok(gunluk.includes('kanal'), 'Android kanalı hazırlanmalı');
  assert.equal(kayitlar.get(TEST_MAC_ID).content.data.kind, MAC_KIND);
});

test('H2 · bildirim desteklenmiyorsa cihaza dokunulmaz', async () => {
  const b = { roundId: 10, matches: [mac(1, 300)] };
  const { nat, gunluk } = sahteNat({ destek: false });
  const r = await testMacKur({ nat, store: sahteStore() }, { now: NOW, bulletin: b });
  assert.deepEqual(
    { ok: r.ok, izin: r.izin, neden: r.neden, mac: r.mac },
    { ok: false, izin: 'unsupported', neden: 'destek-yok', mac: null },
  );
  assert.equal(gunluk.length, 0);
});

test('H3 · izin yoksa "kuruldu" denmez', async () => {
  const b = { roundId: 10, matches: [mac(1, 300)] };
  const { nat, kayitlar } = sahteNat({ izin: 'denied' });
  const r = await testMacKur({ nat, store: sahteStore() }, { now: NOW, bulletin: b });
  assert.equal(r.ok, false);
  assert.equal(r.izin, 'denied');
  assert.equal(r.neden, 'izin');
  assert.equal(kayitlar.size, 0);
});

test('H4 · uygun maç yoksa cihaza HİÇ dokunulmaz (kanal bile kurulmaz)', async () => {
  const { nat, gunluk, kayitlar } = sahteNat();
  const r = await testMacKur({ nat, store: sahteStore() }, { now: NOW, bulletin: null });
  assert.equal(r.ok, false);
  assert.equal(r.neden, 'bulten-yok');
  assert.equal(r.mac, null);
  assert.equal(kayitlar.size, 0);
  assert.equal(gunluk.length, 0, 'maç yokken cihaz çağrısı yapılmamalı');
});

test('H5 · işletim sistemi kabul etmediyse "kuruldu" DENMEZ', async () => {
  const b = { roundId: 10, matches: [mac(1, 300)] };
  const { nat, kayitlar } = sahteNat({ kabul: false });
  const r = await testMacKur({ nat, store: sahteStore() }, { now: NOW, bulletin: b });
  assert.equal(r.ok, false);
  assert.equal(r.neden, 'zamanlanamadi');
  assert.equal(r.fireAt, 0);
  assert.equal(kayitlar.size, 0);
});

test('H6 · zamanlama patlarsa çökme olmaz, dürüst neden döner', async () => {
  const b = { roundId: 10, matches: [mac(1, 300)] };
  const { nat } = sahteNat();
  nat.zamanla = async () => { throw new Error('yerli katman hatası'); };
  const r = await testMacKur({ nat, store: sahteStore() }, { now: NOW, bulletin: b });
  assert.equal(r.ok, false);
  assert.equal(r.neden, 'zamanlanamadi');
});

test('H7 · iki kez basınca bildirim ÇOĞALMAZ (üzerine yazılır)', async () => {
  const b = { roundId: 10, matches: [mac(1, 300)] };
  const { nat, kayitlar, gunluk } = sahteNat();
  const store = sahteStore();

  await testMacKur({ nat, store }, { now: NOW, bulletin: b });
  const r2 = await testMacKur({ nat, store }, { now: NOW + 5000, bulletin: b });

  assert.equal(r2.ok, true);
  assert.equal(kayitlar.size, 1, 'aynı kimlik kullanıldığı için tek kayıt kalmalı');
  assert.equal(kayitlar.get(TEST_MAC_ID).content.data.fireAt, NOW + 5000 + 60000);
  assert.equal(gunluk.filter((x) => x === `iptal:${TEST_MAC_ID}`).length, 2, 'her denemede önce eski kayıt silinmeli');
});

test('H8 · ekranın gösterdiği bilgi telefondaki kayıtla aynı maçı söyler', async () => {
  const b = { roundId: 10, matches: [mac(11, 300), mac(12, 200)] };
  const { nat, kayitlar } = sahteNat();
  const r = await testMacKur({ nat, store: sahteStore() }, { now: NOW, bulletin: b });
  const kayit = kayitlar.get(TEST_MAC_ID);

  assert.equal(r.mac.no, 12, 'en yakın maç');
  assert.equal(kayit.content.data.params.no, 12, 'dokununca açılacak maç aynı olmalı');
  assert.match(kayit.content.body, /^12\. Ev 12 – Dep 12 · /);
});
