// BİLDİRİME DOKUNUNCA DOĞRU EKRAN AÇILIYOR MU — YÖNLENDİRME TESTLERİ.
//
// NEDEN VAR: gerçek Android telefonda bildirim geliyordu, fakat DOKUNULUNCA ana
// sayfa açılıyordu. Kök neden: dokunma dinleyicisi `navRef.current` boşsa
// sessizce çıkıyordu; açılış ekranı (en az 1200 ms + oturum yükleme) ve
// biyometrik kilit boyunca NavigationContainer HENÜZ BAĞLI DEĞİLDİR, dolayısıyla
// bildirimle açılan her başlangıçta dokunma düşüyordu. Uygulama tamamen
// kapalıyken ise dokunma, JS dinleyicisi var olmadan önce yerli katmanda
// yakalanıyor ve dinleyici HİÇ çalışmıyordu.
//
// Bu dosya şunları KANITLAR (hepsi cihazsız, saf modüller üzerinden):
//   A. Test bildirimi → Bildirimler ekranı; gerçek maç hatırlatması → o maçın
//      detayı (gerçek gezinme adlarıyla).
//   B. Maç kaydı bulunamıyorsa yanlış maç ya da ana sayfa değil, Bildirimler.
//   C. Bize ait olmayan bildirim gezinmeyi sürükleyemez.
//   D. Gezinme hazır değilken gelen dokunma KAYBOLMAZ; hazır olunca TEK KEZ
//      uygulanır (uygulama açık / arka planda / tamamen kapalı — üç durum da).
//   E. Bildirim verisinde kişisel bilgi yok.
//   F. App.js ve pushService.js bu düzeni gerçekten bağlamış.
//
// UYARI: burası CİHAZSIZ bir testtir. Geçmesi, gerçek telefonda doğru ekranın
// açıldığını KANITLAMAZ; yalnız mantığın ve bağlantının doğru olduğunu gösterir.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  rotaCoz, macNo, rotaKuyrugu, gezinmeHazir, rotayiUygula, bizeAit,
  maclariBildir, macBilinen, maclariUnut,
  BILDIRIM_ROTASI, MAC_ROTASI,
} from '../src/pushRoute.js';
import { testIcerigi, MAC_KIND, TEST_KIND } from '../src/pushSync.js';
import { planMatchReminders } from '../src/pushPlanner.js';

const BURASI = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(BURASI, '..');
const oku = (p) => fs.readFileSync(path.join(KOK, p), 'utf8');

// ---------------------------------------------------------------------------
// Sahte gezinme
// ---------------------------------------------------------------------------
function sahteNav({ hazir = true, patlat = false } = {}) {
  const gidilen = [];
  return {
    gidilen,
    nav: {
      isReady: () => hazir,
      navigate(tab, opts) {
        if (patlat) throw new Error('ekran bulunamadı');
        gidilen.push({ tab, ...(opts || {}) });
      },
    },
    hazirla() { this.nav.isReady = () => true; },
  };
}

/** Gerçek plan çıktısından maç bildirimi verisi üretir (elle uydurmadan). */
function gercekMacVerisi({ no = 3 } = {}) {
  const now = 1000;
  const { items } = planMatchReminders({
    now,
    bulletin: {
      roundId: 77,
      matches: [{ no, date: new Date(now + 3 * 60 * 60 * 1000).toISOString(), home: 'A Takımı', away: 'B Takımı' }],
    },
    coupons: [{
      finalVersionId: 'v1',
      versions: [{ id: 'v1', selections: [{ no, selectedOutcomes: ['1'] }] }],
    }],
  });
  assert.equal(items.length, 1, 'plan tek maç bildirimi üretmeliydi');
  return items[0].data;
}

test.beforeEach(() => maclariUnut());

// ===========================================================================
// A. DOĞRU EKRAN
// ===========================================================================

test('A1 · test bildirimine dokunulunca Bildirimler ekranı açılır', () => {
  const rota = rotaCoz(testIcerigi({ now: 0 }).data);
  assert.deepEqual(rota, { tab: 'HomeTab', screen: 'Notifications' });
});

test('A2 · gerçek maç hatırlatması DOĞRUDAN o maçın detayını açar', () => {
  const rota = rotaCoz(gercekMacVerisi({ no: 7 }));
  assert.deepEqual(rota, { tab: 'BulletinTab', screen: 'LiveMatchDetail', params: { no: 7 } });
});

test('A3 · hedef ekran adları uygulamadaki GERÇEK adlarla birebir aynı', () => {
  const app = oku('App.js');
  // Sekmeler ve ekranlar App.js'te bu adlarla tanımlı; ad değişirse test düşer.
  assert.match(app, /name="HomeTab"/);
  assert.match(app, /name="BulletinTab"/);
  assert.match(app, /name="Notifications"/);
  assert.match(app, /name="LiveMatchDetail"/);
  assert.equal(BILDIRIM_ROTASI.tab, 'HomeTab');
  assert.equal(BILDIRIM_ROTASI.screen, 'Notifications');
  assert.equal(MAC_ROTASI.tab, 'BulletinTab');
  assert.equal(MAC_ROTASI.screen, 'LiveMatchDetail');
});

test('A4 · maç detayı ekranı params.no OLMADAN çalışamaz — bu yüzden no zorunlu', () => {
  const ekran = oku('src/screens/LiveMatchDetailScreen.js');
  assert.match(ekran, /route\.params/, 'ekran route.params okumuyorsa bu kural gözden geçirilmeli');
  const rota = rotaCoz(gercekMacVerisi({ no: 5 }));
  assert.equal(typeof rota.params.no, 'number');
});

// ===========================================================================
// B. MAÇ BULUNAMIYORSA — yanlış maç ya da ana sayfa YOK
// ===========================================================================

test('B1 · maç bültende YOKSA maç detayı değil, Bildirimler ekranı açılır', () => {
  const data = gercekMacVerisi({ no: 9 });
  maclariBildir({ roundId: 78, matches: [{ no: 1 }, { no: 2 }, { no: 3 }] });
  assert.equal(macBilinen(9), false);
  const rota = rotaCoz(data, { macVar: macBilinen(9) });
  assert.deepEqual(rota, { tab: 'HomeTab', screen: 'Notifications' });
  assert.notEqual(rota.tab, 'BulletinTab', 'bulunamayan maç için başka bir maç açılmamalı');
});

test('B2 · maç numarası geçersizse (yok / sayı değil / ≤0) Bildirimler ekranı açılır', () => {
  for (const params of [undefined, {}, { no: null }, { no: 'abc' }, { no: 0 }, { no: -3 }, { no: 2.5 }]) {
    const rota = rotaCoz({ kind: MAC_KIND, params });
    assert.deepEqual(rota, { tab: 'HomeTab', screen: 'Notifications' }, `params=${JSON.stringify(params)}`);
  }
});

test('B3 · bülten HENÜZ YÜKLENMEDİYSE maç detayına gidilir (bilinmiyor ≠ yok)', () => {
  const data = gercekMacVerisi({ no: 4 });
  assert.equal(macBilinen(4), null, 'bülten yüklenmeden "yok" denmemeli');
  const rota = rotaCoz(data, { macVar: macBilinen(4) });
  assert.deepEqual(rota, { tab: 'BulletinTab', screen: 'LiveMatchDetail', params: { no: 4 } });
});

test('B4 · boş/bozuk bülten bilgisi mevcut bilgiyi SİLMEZ', () => {
  maclariBildir({ roundId: 78, matches: [{ no: 1 }, { no: 2 }] });
  maclariBildir(null);
  maclariBildir({ matches: [] });
  maclariBildir(undefined);
  assert.equal(macBilinen(1), true, 'geçerli bülten bilgisi bozuk veriyle silinmemeli');
  assert.equal(macBilinen(5), false);
});

test('B5 · maç numarası metin gelse bile doğru çözülür (veri katmanı dizeye çevirebilir)', () => {
  assert.equal(macNo({ params: { no: '12' } }), 12);
  assert.equal(macNo({ params: { no: ' 12 ' } }), 12);
  assert.equal(macNo({ params: { no: '' } }), null);
  assert.equal(macNo(null), null);
});

// ===========================================================================
// C. GÜVENLİK — yabancı bildirim gezinmeyi sürükleyemez
// ===========================================================================

test('C1 · bize ait olmayan bildirim (tanınmayan kind) gezinme YAPTIRMAZ', () => {
  for (const data of [null, undefined, {}, { kind: 'promo' }, { kind: '' }, 'metin', 42]) {
    assert.equal(rotaCoz(data), null, `data=${JSON.stringify(data)}`);
  }
});

test('C2 · bildirimdeki serbest tab/screen metni hedefi BELİRLEMEZ (kind belirler)', () => {
  // Yabancı bir bildirim "beni şuraya götür" diyemez.
  const sahte = { tab: 'ProfileTab', screen: 'DeleteAccount', params: { no: 1 }, kind: 'promo' };
  assert.equal(rotaCoz(sahte), null);

  // Bizim bildirimimizde bile hedef kind'dan türetilir; metin yok sayılır.
  const bizim = { tab: 'ProfileTab', screen: 'DeleteAccount', kind: TEST_KIND };
  assert.deepEqual(rotaCoz(bizim), { tab: 'HomeTab', screen: 'Notifications' });
});

test('C3 · pushRoute.js gezinme hedefini data.tab/data.screen okuyarak KURMAZ', () => {
  const kod = oku('src/pushRoute.js');
  assert.ok(!/rota\s*=\s*\{[^}]*data\.tab/.test(kod), 'hedef doğrudan data.tab\'tan kurulmamalı');
  assert.match(kod, /kind === TEST_KIND/);
  assert.match(kod, /kind !== MAC_KIND/);
});

// ===========================================================================
// D. ZAMANLAMA — dokunma kaybolmuyor, iki kez uygulanmıyor
// ===========================================================================

test('D1 · gezinme HAZIR DEĞİLKEN gelen dokunma kaybolmaz, hazır olunca uygulanır', () => {
  const k = rotaKuyrugu();
  const g = sahteNav({ hazir: false });

  assert.equal(k.koy(testIcerigi({ now: 0 }).data), true);
  assert.equal(rotayiUygula(k, g.nav), false, 'hazır değilken gezinme yapılmamalı');
  assert.ok(k.bekleyen(), 'dokunma BEKLEMEYE devam etmeli — eski hatada burada düşüyordu');
  assert.equal(g.gidilen.length, 0);

  g.hazirla();                                   // NavigationContainer bağlandı
  assert.equal(rotayiUygula(k, g.nav), true);
  assert.deepEqual(g.gidilen, [{ tab: 'HomeTab', screen: 'Notifications', params: undefined }]);
});

test('D2 · bekleyen rota TEK KEZ uygulanır; sonraki hazır olma olayı tekrar götürmez', () => {
  const k = rotaKuyrugu();
  const g = sahteNav();
  k.koy(gercekMacVerisi({ no: 6 }));

  assert.equal(rotayiUygula(k, g.nav), true);
  assert.equal(rotayiUygula(k, g.nav), false, 'ikinci çağrı yeniden gezinmemeli');
  assert.equal(rotayiUygula(k, g.nav), false);
  assert.equal(g.gidilen.length, 1);
  assert.deepEqual(g.gidilen[0], { tab: 'BulletinTab', screen: 'LiveMatchDetail', params: { no: 6 } });
});

test('D3 · gezinme yokken (null) çökmez; nav gelince aynı hedefe gidilir', () => {
  const k = rotaKuyrugu();
  k.koy(gercekMacVerisi({ no: 2 }));
  assert.equal(rotayiUygula(k, null), false);
  assert.equal(rotayiUygula(k, undefined), false);

  const g = sahteNav();
  assert.equal(rotayiUygula(k, g.nav), true);
  assert.deepEqual(g.gidilen[0].params, { no: 2 });
});

test('D4 · gezinme hazırlık ölçütü isReady()\'e dayanır (ref dolu olması yetmez)', () => {
  assert.equal(gezinmeHazir(null), false);
  assert.equal(gezinmeHazir({ isReady: () => false, navigate() {} }), false);
  assert.equal(gezinmeHazir({ isReady: () => true, navigate() {} }), true);
  assert.equal(gezinmeHazir({ isReady() { throw new Error('erken'); } }), false);
  assert.equal(gezinmeHazir({ navigate() {} }), true, 'isReady yoksa navigate varlığı ölçüt olur');
});

test('D5 · gezinme patlarsa uygulama çökmez ve sonsuz tekrar denenmez', () => {
  const k = rotaKuyrugu();
  const g = sahteNav({ patlat: true });
  k.koy(testIcerigi({ now: 0 }).data);
  assert.equal(rotayiUygula(k, g.nav), false);
  assert.equal(k.bekleyen(), null, 'hatalı rota kuyrukta birikmemeli');
});

test('D6 · boş kuyruk gezinme yapmaz (bildirimsiz normal açılış ana sayfada kalır)', () => {
  const k = rotaKuyrugu();
  const g = sahteNav();
  assert.equal(rotayiUygula(k, g.nav), false);
  assert.equal(g.gidilen.length, 0);
});

test('D7 · sonraki dokunma öncekinin yerini alır (kullanıcı en son neye dokunduysa)', () => {
  const k = rotaKuyrugu();
  const g = sahteNav({ hazir: false });
  k.koy(testIcerigi({ now: 0 }).data);
  k.koy(gercekMacVerisi({ no: 8 }));
  g.hazirla();
  rotayiUygula(k, g.nav);
  assert.equal(g.gidilen.length, 1);
  assert.equal(g.gidilen[0].screen, 'LiveMatchDetail');
});

// ===========================================================================
// E. GİZLİLİK — bildirim verisinde kişisel bilgi yok
// ===========================================================================

test('E1 · taşınan tek şey maç NUMARASIDIR; tahmin/kupon/kullanıcı bilgisi geçmez', () => {
  const rota = rotaCoz(gercekMacVerisi({ no: 11 }));
  assert.deepEqual(Object.keys(rota.params), ['no']);
  const metin = JSON.stringify(rota).toLowerCase();
  for (const yasak of ['email', 'e-posta', 'token', 'user', 'kullanici', 'sifre', 'pick', 'tahmin', 'puan', 'session']) {
    assert.ok(!metin.includes(yasak), `rotada geçmemesi gereken alan: ${yasak}`);
  }
});

test('E2 · test bildirimi verisi maç/kupon bilgisi TAŞIMAZ', () => {
  const data = testIcerigi({ now: 0 }).data;
  assert.equal(data.kind, TEST_KIND);
  assert.equal(data.params, undefined);
  assert.equal(macNo(data), null);
});

// ===========================================================================
// F. BAĞLANTI — App.js ve pushService.js bu düzeni gerçekten kullanıyor mu?
// ===========================================================================

test('F1 · App.js bekleyen rotayı NavigationContainer onReady ile uyguluyor', () => {
  const app = oku('App.js');
  assert.match(app, /from '\.\/src\/pushRoute'/);
  assert.match(app, /rotaKuyrugu\(\)/);
  assert.match(app, /onReady=\{rotayiDene\}/, 'gezinme hazır olunca bekleyen rota uygulanmalı');
  assert.match(app, /rotayiUygula\(/);
});

test('F2 · App.js artık "navRef boşsa sessizce çık" davranışını içermiyor — kök neden', () => {
  const app = oku('App.js');
  assert.ok(
    !/if\s*\(!data\?\.tab\s*\|\|\s*!navRef\.current\)\s*return/.test(app),
    'eski erken çıkış hâlâ duruyor: bildirime dokunma yine sessizce düşer',
  );
  assert.ok(
    !/navRef\.current\.navigate\(data\.tab/.test(app),
    'hedef hâlâ bildirimin serbest metninden kuruluyor',
  );
});

test('F3 · App.js uygulama TAMAMEN KAPALIYKEN yapılan dokunmayı okuyor ve temizliyor', () => {
  const app = oku('App.js');
  assert.match(app, /sonYanitVerisi\(\)/, 'açılış yanıtı okunmazsa kapalı uygulamada dokunma düşer');
  assert.match(app, /sonYanitiTemizle\(\)/, 'temizlenmezse aynı dokunma her açılışta tekrar götürür');
});

test('F4 · App.js bülten yüklendiğinde maç numaralarını bildiriyor', () => {
  const app = oku('App.js');
  assert.match(app, /maclariBildir\(/);
});

test('F5 · pushService.js açılış yanıtı API\'lerini yedek yükleyiciye bağlamış', () => {
  const svc = oku('src/services/pushService.js');
  assert.match(svc, /getLastNotificationResponse: yayinci\?\.getLastNotificationResponse/);
  assert.match(svc, /clearLastNotificationResponse: yayinci\?\.clearLastNotificationResponse/);
  assert.match(svc, /export function sonYanitVerisi/);
  assert.match(svc, /export function sonYanitiTemizle/);
});

test('F6 · açılış yanıtı API\'leri kurulu pakette GERÇEKTEN var (yol uydurulmadı)', () => {
  const kod = fs.readFileSync(
    path.join(KOK, 'node_modules', 'expo-notifications', 'build', 'NotificationsEmitter.js'),
    'utf8',
  );
  assert.match(kod, /export function getLastNotificationResponse\(/);
  assert.match(kod, /export function clearLastNotificationResponse\(/);
});

test('F7 · mevcut izin/zamanlama/iptal düzeni korunmuş (bu iş onlara dokunmadı)', () => {
  const svc = oku('src/services/pushService.js');
  for (const ad of [
    'export async function initPush', 'export function syncMatchReminders',
    'export function cancelAllMatchReminders', 'export function cancelAllOurNotifications',
    'export function setPushEnabled', 'export function testBildirimiGonder',
    'export function addResponseListener', 'export function izinDurumu',
  ]) {
    assert.ok(svc.includes(ad), `korunması gereken dışa aktarım kaybolmuş: ${ad}`);
  }
  const sync = oku('src/pushSync.js');
  assert.match(sync, /VARSAYILAN_ONCE_DK/, '60 dakika önce hatırlatma düzeni korunmalı');
});

test('F8 · pushRoute.js react-native / expo-notifications İMPORT ETMEZ (saf modül)', () => {
  const kod = oku('src/pushRoute.js');
  assert.ok(!/from\s+'react-native'/.test(kod));
  assert.ok(!/from\s+'expo-notifications/.test(kod));
  assert.ok(!/from\s+'@react-navigation/.test(kod));
});

test('D8 · yabancı bildirim kuyruğa ALINMAZ (bekleyen dokunmayı da ezemez)', () => {
  const k = rotaKuyrugu();
  const g = sahteNav({ hazir: false });

  assert.equal(k.koy(testIcerigi({ now: 0 }).data), true);
  assert.equal(k.koy({ tab: 'ProfileTab', screen: 'DeleteAccount', kind: 'promo' }), false);
  assert.equal(k.koy(null), false);

  g.hazirla();
  rotayiUygula(k, g.nav);
  assert.deepEqual(g.gidilen, [{ tab: 'HomeTab', screen: 'Notifications', params: undefined }]);
  assert.ok(bizeAit({ kind: MAC_KIND }) && bizeAit({ kind: TEST_KIND }));
  assert.ok(!bizeAit({ kind: 'promo' }) && !bizeAit(null));
});

test('D9 · hedef EN GEÇ anda çözülür: beklerken bülten yüklenirse yeni bilgi kullanılır', () => {
  const k = rotaKuyrugu();
  const g = sahteNav({ hazir: false });

  // Uygulama kapalıyken dokunuldu; bülten henüz yüklenmemişti.
  k.koy(gercekMacVerisi({ no: 9 }));
  rotayiUygula(k, g.nav);                       // gezinme hazır değil → bekler

  // Açılış sürerken bülten geldi ve 9 numaralı maç ARTIK YOK.
  maclariBildir({ roundId: 78, matches: [{ no: 1 }, { no: 2 }] });

  g.hazirla();
  assert.equal(rotayiUygula(k, g.nav), true);
  assert.deepEqual(g.gidilen, [{ tab: 'HomeTab', screen: 'Notifications', params: undefined }],
    'bulunamayan maç için detay ekranı açılmamalı');
});
