// YAYIN STÜDYOSU · BÜLTEN EKRANI — KUPON KAYDI VE EKRAN GÖRSELİ PAYLAŞIMI
//
// NE SINANIR:
//   1) Kayıt engelleri (studioCouponSave.js): hangi durumda kayıt kapanır,
//      kapanınca SEBEP metni gerçekten üretilir mi, sıra doğru mu.
//   2) Bülten ekranı sebebi GÖRÜNÜR biçimde basıyor mu (kaynak metninden).
//   3) Kaldırılan final kupon ekranı geri gelmedi mi: dosya, rota, düğme ve
//      otomatik geçiş yok; kayıt bülten ekranında.
//   4) Paylaşım yardımcıları (studioShare.js): dosya adı, altyazı, veri-URI
//      çözümü, iptal ayıklama.
//   5) Paylaşılan karede kişisel veri ve hüküm sözcüğü yok; dürüstlük
//      bildirimi kadrajın İÇİNDE.
//
// NEDEN KAYNAK METNİ: Ekran dosyaları JSX içerdiği için node:test onları
// import edemiyor. Saf mantık ayrı modüllerde (studioCouponSave.js,
// studioShare.js) durduğu için ORASI doğrudan çalıştırılarak sınanır;
// ekranın o mantığı doğru bağladığı ise kaynak metninden doğrulanır.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  engelliNolarOf, saveBlockerOf, columnsNoteOf, couponPayloadOf, saveErrorOf,
} from '../src/studioCouponSave.js';
import {
  SHARE_MIME, shareFileNameOf, shareTitleOf, shareCaptionOf,
  base64OfCapture, dataUriToBlob, isAbortError,
  shareDoneTextOf, shareErrorTextOf, tabularOff,
} from '../src/studioShare.js';
import { COUPON_MAX_COLUMNS } from '../src/couponConfig.js';
import { NO_GUARANTEE_NOTICE, APP_NAME } from '../src/brand.js';

const buDizin = dirname(fileURLToPath(import.meta.url));
const oku = (...p) => readFileSync(join(buDizin, '..', ...p), 'utf8');
const kodu = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const BULTEN = oku('src', 'screens', 'StudioBulletinScreen.js');
const KAYIT = oku('src', 'studioCouponSave.js');
const PAYLASIM = oku('src', 'studioShare.js');
const RENDER = oku('scripts', 'render-studio.mjs');

/** src/ altındaki bütün js/jsx dosyaları — kaldırılan kancaları taramak için. */
const jsDosyalari = (kok) => readdirSync(kok, { withFileTypes: true }).flatMap((e) => {
  const tam = join(kok, e.name);
  return e.isDirectory() ? jsDosyalari(tam) : /\.jsx?$/.test(e.name) ? [tam] : [];
});

const hazirlik = (o = {}) => ({
  total: 15, picked: 15, missing: 0, missingNos: [],
  complete: true, allLocked: false, anyLocked: false, lockedNos: [], ...o,
});

/* ═══════════════════════════════════════════════════════════════
   1) KAYIT ENGELLERİ — SEBEPSİZ KAPALI DÜĞME OLAMAZ
   ═══════════════════════════════════════════════════════════════ */

test('engel yoksa null döner — tamamlanmış hafta kaydedilebilir', () => {
  assert.equal(saveBlockerOf({ hazir: hazirlik(), engelliNolar: [] }), null);
});

test('üç engelin hepsi sebep nesnesi üretir; metin BOŞ olamaz', () => {
  const durumlar = [
    ['week-locked', { hazir: hazirlik({ allLocked: true }), engelliNolar: [] }],
    ['started-match', { hazir: hazirlik(), engelliNolar: [3, 7] }],
    ['missing', { hazir: hazirlik({ picked: 13, missing: 2, missingNos: [4, 9], complete: false }), engelliNolar: [] }],
  ];
  for (const [beklenen, girdi] of durumlar) {
    const e = saveBlockerOf(girdi);
    assert.ok(e, `${beklenen}: engel üretilmedi`);
    assert.equal(e.code, beklenen);
    assert.ok(e.title && e.title.trim().length >= 3, `${beklenen}: başlık boş`);
    assert.ok(e.text && e.text.trim().length >= 20, `${beklenen}: sebep metni boş/kısa`);
  }
});

test('engel SIRASI doğru: hafta kilidi > başlamış maç > eksik seçim', () => {
  // Hepsi birden bozuksa en kapsayıcı sebep yazılır; yayıncı önce onu görmeli.
  const hepsi = {
    hazir: hazirlik({ allLocked: true, complete: false, missing: 5, missingNos: [1, 2, 3, 4, 5] }),
    engelliNolar: [1, 2],
  };
  assert.equal(saveBlockerOf(hepsi).code, 'week-locked');

  const kilitsiz = { ...hepsi, hazir: hazirlik({ complete: false, missing: 5, missingNos: [1, 2, 3, 4, 5] }) };
  assert.equal(saveBlockerOf(kilitsiz).code, 'started-match');

  assert.equal(saveBlockerOf({ ...kilitsiz, engelliNolar: [] }).code, 'missing');
});

/* ——— KOLON SAYISI: YAYIN STÜDYOSUNDA ENGEL DEĞİL, BİLGİ ———
   Yayıncı isteği (bilinçli kural değişikliği): "buradaki kupon kaydetme
   sınırını kaldıralım". Stüdyoda kaydedilen şey oynanacak bir kupon değil,
   o hafta ekranda yapılan seçimlerin kaydıdır. Sınır GERÇEK kupon akışında
   (CouponEditorScreen + coupon/smart.js) aynen duruyor — aşağıda ayrıca
   sınanıyor ki "stüdyoda kalktı" diye oradan da kalkmasın. */

test('kolon sayısı stüdyoda kaydı ENGELLEMEZ — sınırın çok üstünde bile', () => {
  // 15 maçın hepsi kapalı (1X2) = 3^15; yayıncının anlatabildiği en geniş hafta.
  for (const kolon of [COUPON_MAX_COLUMNS, COUPON_MAX_COLUMNS + 1, 19683, 3 ** 15]) {
    assert.equal(
      saveBlockerOf({ hazir: hazirlik(), kolon, engelliNolar: [] }), null,
      `kolon ${kolon} hâlâ kaydı engelliyor`,
    );
  }
  // 'columns' kodu artık HİÇBİR girdide üretilemez.
  const tumDurumlar = [
    { hazir: hazirlik({ allLocked: true }), kolon: 3 ** 15, engelliNolar: [1] },
    { hazir: hazirlik({ complete: false, missing: 1, missingNos: [7] }), kolon: 3 ** 15, engelliNolar: [] },
    { hazir: hazirlik(), kolon: 3 ** 15, engelliNolar: [2] },
  ];
  for (const girdi of tumDurumlar) {
    assert.notEqual(saveBlockerOf(girdi)?.code, 'columns', 'kolon engeli geri gelmiş');
  }
});

test('kolon notu BİLGİ olarak durur: sınırın altında sessiz, üstünde iki sayıyı da yazar', () => {
  // Sınırın altında/üstünde uyarı gürültüsü yapılmaz.
  assert.equal(columnsNoteOf(1), '');
  assert.equal(columnsNoteOf(COUPON_MAX_COLUMNS), '');
  assert.equal(columnsNoteOf(0), '');
  assert.equal(columnsNoteOf(null), '');
  assert.equal(columnsNoteOf(undefined), '');
  assert.equal(columnsNoteOf('abc'), '');

  const not = columnsNoteOf(19683);
  assert.match(not, /19683/, 'gerçek kolon sayısı yazılmıyor');
  assert.match(not, new RegExp(String(COUPON_MAX_COLUMNS)), 'resmî sınır yazılmıyor');
  // BİLGİ DİLİ: "kaydedilemez / azaltman gerekir" gibi engel cümlesi kurulmaz.
  assert.ok(
    !/kaydedilemez|azaltman|daralt|yapılmaz|gerekir/i.test(not),
    `bilgi satırı hâlâ engel dili kuruyor: ${not}`,
  );
});

test('SINIR GERÇEK KUPON AKIŞINDA DURUYOR — stüdyodan kalkması oraya sıçramadı', () => {
  // Bu, yayıncının isteğinin KAPSAMINI koruyan bekçidir: oynanacak kuponda
  // 2.500 resmî oyun kuralıdır ve orada kaldırılmadı.
  const duzenleyici = kodu(oku('src', 'screens', 'CouponEditorScreen.js'));
  assert.match(duzenleyici, /const overLimit = cols > COUPON_MAX_COLUMNS/, 'kupon düzenleyicide sınır ölçümü kalkmış');
  assert.match(duzenleyici, /if \(overLimit\)[\s\S]{0,160}return;/, 'kupon düzenleyicide sınır kapısı kalkmış');

  const akilli = kodu(oku('src', 'coupon', 'smart.js'));
  assert.match(akilli, /Math\.min\(COUPON_MAX_COLUMNS/, 'akıllı kuponda sınır tavanı kalkmış');

  // Sabitin kendisi de yerinde durmalı.
  assert.equal(COUPON_MAX_COLUMNS, 2500);
});

test('engelli maç numaraları: yalnız BAŞLAMIŞ ve SEÇİMİ OLAN satırlar', () => {
  const satirlar = [
    { no: 1, locked: true, hasPick: true },
    { no: 2, locked: true, hasPick: false },   // başlamış ama seçim yok → engel değil
    { no: 3, locked: false, hasPick: true },   // seçim var ama başlamamış → engel değil
    null,
  ];
  assert.deepEqual(engelliNolarOf(satirlar), [1]);
  assert.deepEqual(engelliNolarOf(), []);
});

test('sebep metinleri SAYIYI yazar — yayıncı hangi maç olduğunu görür', () => {
  const eksik = saveBlockerOf({
    hazir: hazirlik({ picked: 13, missing: 2, missingNos: [4, 9], complete: false }), engelliNolar: [],
  });
  assert.match(eksik.text, /4, 9/);
  const baslamis = saveBlockerOf({ hazir: hazirlik(), engelliNolar: [3, 7] });
  assert.match(baslamis.text, /3, 7/);
});

/* ═══════════════════════════════════════════════════════════════
   2) KAYIT VERİSİ VE STORE CEVABI
   ═══════════════════════════════════════════════════════════════ */

test('kayıt verisi mühür bilgisini taşır ve UYDURMAZ', () => {
  const { meta, govde } = couponPayloadOf({ data: { season: '2026', weekNumber: 1526, matches: [] }, roundId: 1526, rows: [] });
  assert.equal(meta.roundId, 1526);
  assert.equal(meta.weekNumber, 1526);
  assert.equal(meta.season, '2026');
  assert.ok('lockedAt' in meta && 'lockMap' in meta, 'mühür alanları eksik');
  assert.ok(govde && typeof govde === 'object', 'gövde üretilmedi');

  // Veri yoksa null yazılır; sahte sezon/hafta uydurulmaz.
  const bos = couponPayloadOf({ data: null, roundId: null, rows: [] });
  assert.equal(bos.meta.season, null);
  assert.equal(bos.meta.weekNumber, null);
});

test('store cevabı kullanıcı diline çevrilir; başarıda null döner', () => {
  assert.equal(saveErrorOf({ coupon: { id: 'x', name: 'Kupon 1' } }), null);
  assert.equal(saveErrorOf({ error: 'max' }).code, 'max');
  assert.equal(saveErrorOf({ error: 'locked' }).code, 'locked');
  assert.match(saveErrorOf({ error: 'locked-match', matches: [2, 5] }).text, /2, 5/);
  assert.equal(saveErrorOf(null).code, 'fail');
  assert.equal(saveErrorOf({}).code, 'fail');
});

/* ═══════════════════════════════════════════════════════════════
   3) BÜLTEN EKRANI KURALI DOĞRU BAĞLIYOR MU
   ═══════════════════════════════════════════════════════════════ */

test('bülten ekranı kayıt kuralını TEK KAYNAKTAN alıyor, kendi kopyasını yazmıyor', () => {
  const kod = kodu(BULTEN);
  assert.match(kod, /from '\.\.\/studioCouponSave'/, 'kayıt kuralı ortak dosyadan gelmiyor');
  assert.match(kod, /const kayitKapali = !!engel/, 'kapalılık sebep nesnesine bağlı değil');
  // Sebep olmadan düğme kapanamaz: kayitKapali TEK bir yerden türer.
  assert.ok(
    !/const kayitKapali = [^;]*\|\|/.test(kod),
    'kapalılık birden çok bayrağa dağılmış — sebepsiz kapalı düğme mümkün hâle gelmiş',
  );
});

test('kayıt kapalıysa SEBEP ekranda yazılı ve düğme erişilebilirlikte de kapalı', () => {
  const kod = kodu(BULTEN);
  assert.match(kod, /testID="studio-bulletin-blocked"/, 'sebep satırı yok');
  assert.match(kod, /engel \? \([\s\S]{0,400}engel\.text/, 'sebep metni basılmıyor');
  assert.match(kod, /accessibilityState=\{\{ disabled: kayitKapali/, 'ekran okuyucuya kapalı denmiyor');
  assert.match(kod, /aria-disabled=\{kayitKapali\}/, 'web tarafında kapalı bildirimi yok');
  assert.match(kod, /disabled=\{kaydediliyor \|\| kayitKapali\}/, 'düğme gerçekten kapanmıyor');
});

// GÜNCELLEME: Bu testin ilk hâli `Alert.alert(` arıyordu ve gerekçesi zaten
// "web'de Alert boş işlev" idi. Sebep doğruydu, çare eksikti: react-native-web
// Alert'i gerçekten boş gövdeli bir taslak olarak yayınlar
// (`class Alert { static alert() {} }`), yani pencere HİÇ açılmaz ve düğmelerin
// onPress'i çalışmaz. Artık uyarı yolu web'de gerçekten çizen ortak pencereden
// geçiyor (src/components/Uyari.js). Kural aynı kaldı: uyarı TEK BAŞINA yeterli
// sayılmaz, sonuç ekranda da yazılı olur.
test('uyarı tek başına bırakılmamış — sonuç ekranda da yazılı', () => {
  const kod = kodu(BULTEN);
  assert.ok(kod.includes('uyari.alert('), 'uyarı yolu kaldırılmış');
  assert.equal(/\bAlert\s*\.\s*alert\s*\(/.test(kod), false, "web'de boş taslak olan Alert geri gelmiş");
  assert.match(kod, /setMesaj\(/, 'sonuç ekrana yazılmıyor');
  assert.match(kod, /testID="studio-bulletin-message"/, 'sonuç satırının test kancası yok');
});

test('kolon sayısı bültende BİLGİ olarak yazılıyor, düğmeyi kapatmıyor', () => {
  const kod = kodu(BULTEN);
  // Metin TEK KAYNAKTAN gelir; ekran kendi cümlesini kurmaz.
  assert.match(kod, /columnsNoteOf/, 'kolon notu ortak dosyadan alınmıyor');
  assert.ok(kod.includes('testID="studio-bulletin-columns-note"'), 'kolon notunun test kancası yok');
  // Sayının kendisi HÂLÂ ekranda: sınırı kaldırmak, sayıyı gizlemek değildir.
  assert.match(kod, /\{kolon\}|String\(kolon\)/, 'kolon sayısı artık yazılmıyor');
  // Engel dili ve kırmızı vurgusu kalkmış olmalı.
  assert.ok(!/sinirAsimi|kolonAsti/.test(kod), 'eski sınır bayrağı duruyor');
  assert.ok(!/Kolon sayısı resmî sınırı|sınırını aşıyor/.test(kod), 'engel cümlesi hâlâ ekranda');
  assert.ok(!/COUPON_MAX_COLUMNS/.test(kod), 'ekran sınırı kendi eline almış');
});

test('bültenin kayıt kancaları eksiksiz ve kendi ad alanında', () => {
  for (const kanca of [
    'studio-bulletin-save', 'studio-bulletin-save-btn', 'studio-bulletin-name',
    'studio-bulletin-blocked', 'studio-bulletin-saved', 'studio-bulletin-archive',
    'studio-bulletin-message', 'studio-bulletin-share-btn',
  ]) {
    assert.match(kanca, /^studio-bulletin-/, 'bülten kancası ad alanının dışına çıkmış');
    assert.ok(BULTEN.includes(`testID="${kanca}"`), `bülten kancası eksik: ${kanca}`);
  }
});

/* ═══════════════════════════════════════════════════════════════
   3b) KALDIRILAN FİNAL KUPON EKRANI GERİ GELMESİN

   Yayıncı isteği: "final kuponu ekranını kaldır". Kaydetme zaten bülten
   ekranına taşınmıştı; ayrı ekranın kendine ait tek paneli "Tüm Maç
   Seçimleri" idi ve aynı bilgi tablonun kendisinde duruyor. Ekran silindi.

   NEDEN TEST: Silinen bir ekran, eski bir dalın geri alınmasıyla ya da
   kopyala-yapıştırla sessizce geri gelir. O zaman yayıncı yine tablodan
   kopar. Aşağıdakiler ekranı DEĞİL, YOKLUĞUNU çivi gibi tutar.
   ═══════════════════════════════════════════════════════════════ */

// Kaldırılan ekrana ait bütün test kancaları — hiçbiri kaynağa dönmemeli.
const KALDIRILAN_KANCALAR = [
  'studio-coupon-root', 'studio-coupon-error', 'studio-coupon-rows', 'studio-coupon-summary',
  'studio-coupon-riskiest', 'studio-coupon-save', 'studio-coupon-blocked', 'studio-coupon-saved',
  'studio-coupon-message', 'studio-coupon-columns-note', 'studio-save-coupon',
  'studio-goto-coupon', 'studio-goto-archive',
];

test('final kupon ekranının DOSYASI yok', () => {
  assert.ok(
    !existsSync(join(buDizin, '..', 'src', 'screens', 'StudioCouponScreen.js')),
    'StudioCouponScreen.js geri gelmiş',
  );
});

test('kaldırılan ekranın ROTASI hiçbir yerde tanımlı değil', () => {
  assert.ok(!/StudioCoupon/.test(kodu(oku('App.js'))), 'App.js hâlâ StudioCoupon rotasını tanıyor');
  assert.ok(
    !/StudioCoupon/.test(kodu(oku('src', 'studioTheme.js'))),
    'tam ekran rota listesinde StudioCoupon duruyor',
  );
  const kod = kodu(BULTEN);
  assert.ok(!/StudioCoupon/.test(kod), 'bülten ekranı hâlâ kupon ekranına atlıyor');
  assert.ok(!kod.includes('studio-goto-coupon'), 'kupon ekranına giden düğme duruyor');
});

test('15. maç işaretlenince ekran BAŞKA YERE ATLAMIYOR', () => {
  // Eskiden hazir.complete olunca otomatik geçiş vardı; yayıncıyı canlı
  // yayında tablodan koparıyordu. Geçiş kaldırıldı, kayıt aynı sayfada açılır.
  const kod = kodu(BULTEN);
  assert.ok(!/hazir\.complete[\s\S]{0,200}navigate/.test(kod), 'tamamlanınca otomatik geçiş geri gelmiş');
  assert.ok(!/acKupon/.test(kod), 'kupon ekranını açan yardımcı geri gelmiş');
  // Kaydetme gerçekten bu ekranda duruyor mu?
  assert.match(kod, /testID="studio-bulletin-save-btn"/, 'kaydetme bu ekranda değil');
});

test('kaldırılan ekranın test kancaları src/ içinde HİÇ geçmiyor', () => {
  for (const dosya of jsDosyalari(join(buDizin, '..', 'src'))) {
    const metin = readFileSync(dosya, 'utf8');
    for (const kanca of KALDIRILAN_KANCALAR) {
      assert.ok(
        !metin.includes(`testID="${kanca}"`),
        `${basename(dosya)}: kaldırılan ekranın kancası geri gelmiş → ${kanca}`,
      );
    }
  }
});

test('canlı çizim denetimi kaldırılan ekrana GİTMİYOR, yokluğunu sınıyor', () => {
  // Kayıt akışı artık bülten kancalarıyla sürülüyor.
  for (const kanca of [
    'studio-bulletin-save-btn', 'studio-bulletin-blocked',
    'studio-bulletin-saved', 'studio-bulletin-archive',
  ]) {
    assert.ok(RENDER.includes(kanca), `canlı denetim ${kanca} kancasını aramıyor — test yanlış şeyi koruyor`);
  }
  // Kaldırılan ekrana gitmeye çalışan hiçbir adım kalmamalı.
  assert.ok(!/\.click\((?:once\.)?T\('studio-goto-coupon'\)\)/.test(RENDER), 'canlı denetim hâlâ kaldırılan ekrana tıklıyor');
  assert.ok(!RENDER.includes("waitForSelector(T('studio-coupon-root')"), 'canlı denetim hâlâ kupon ekranını bekliyor');
  // Yokluk sınaması gerçekten yapılıyor mu?
  assert.match(RENDER, /studio-goto-coupon[\s\S]{0,200}=== 0/, 'kaldırılan düğmenin yokluğu sınanmıyor');
});

test('arşive sekme üzerinden gidilir (CouponCenter Ana Sayfa yığınında yok)', () => {
  const kod = kodu(BULTEN);
  assert.ok(!/navigate\??\.?\(\s*'CouponCenter'/.test(kod), 'CouponCenter doğrudan çağrılmış — gezinme çöker');
  assert.match(kod, /navigate\??\.?\(\s*'CouponsTab'[\s\S]{0,80}CouponCenter/, 'arşive sekme üzerinden gidilmiyor');
});

/* ═══════════════════════════════════════════════════════════════
   4) EKRAN GÖRSELİ PAYLAŞIMI — SAF YARDIMCILAR
   ═══════════════════════════════════════════════════════════════ */

test('dosya adı hafta numarasını taşır; hafta yoksa SAHTE numara yazılmaz', () => {
  assert.equal(shareFileNameOf({ roundId: 1526 }), 'sportoto-bulten-hafta-1526.png');
  assert.equal(shareFileNameOf({ roundId: 9, weekNumber: 1526 }), 'sportoto-bulten-hafta-1526.png');
  assert.equal(shareFileNameOf({}), 'sportoto-bulten.png');
  assert.equal(shareFileNameOf(), 'sportoto-bulten.png');
  // Yol ayracı içeren bir değer dosya adını bozamaz.
  assert.equal(shareFileNameOf({ roundId: '../../gizli' }), 'sportoto-bulten-hafta-gizli.png');
});

test('altyazı marka ve dürüstlük bildirimini TEK KAYNAKTAN taşır', () => {
  const y = shareCaptionOf({ roundId: 1526, picked: 15, total: 15 });
  assert.match(y, /Hafta 1526/);
  assert.match(y, /15\/15/);
  assert.ok(y.includes(APP_NAME), 'marka adı altyazıda yok');
  assert.ok(y.includes(NO_GUARANTEE_NOTICE), 'kazanç vaadi olmadığı bildirimi altyazıda yok');
  // Metinler elle yazılmamış: brand.js değişirse altyazı da değişir.
  assert.match(PAYLASIM, /from '\.\/brand'/);

  const bos = shareCaptionOf();
  assert.ok(bos.includes(NO_GUARANTEE_NOTICE), 'hafta bilinmese de bildirim düşmemeli');
  assert.ok(!/undefined|null|NaN/.test(bos), `boş girdide bozuk metin: ${bos}`);
});

test('altyazıda KİŞİSEL VERİ yok — yalnız hafta ve sayım', () => {
  const y = shareCaptionOf({ roundId: 1526, picked: 12, total: 15 });
  assert.ok(!/@|token|belirteç|kullanıcı|e-posta|telefon/i.test(y), `altyazıda kişisel iz: ${y}`);
});

test('paylaşım başlığı hafta yoksa da anlamlı', () => {
  assert.equal(shareTitleOf({ roundId: 1526 }), 'Hafta 1526 bülteni');
  assert.equal(shareTitleOf(), 'Haftalık bülten');
});

test('veri-URI ve çıplak base64 — ikisi de PNG ikilisine çevrilir', () => {
  // 1x1 saydam PNG.
  const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  assert.equal(base64OfCapture(`data:image/png;base64,${b64}`), b64);
  assert.equal(base64OfCapture(b64), b64);
  assert.equal(base64OfCapture(null), '');

  for (const girdi of [`data:image/png;base64,${b64}`, b64]) {
    const blob = dataUriToBlob(girdi);
    assert.equal(blob.type, SHARE_MIME);
    assert.ok(blob.size > 0, 'boş ikili üretildi');
  }
  assert.throws(() => dataUriToBlob(''), /Görsel üretilemedi/);
});

test('kullanıcı menüyü kapatınca HATA sayılmaz', () => {
  const iptal = new Error('Share canceled');
  iptal.name = 'AbortError';
  assert.equal(isAbortError(iptal), true);
  assert.equal(isAbortError({ message: 'AbortError: user aborted' }), true);
  assert.equal(isAbortError(new Error('Ağ hatası')), false);
  assert.equal(isAbortError(null), false);
});

test('sonuç ve hata metinleri sessiz kalmaz', () => {
  assert.match(shareDoneTextOf('shared'), /\S/);
  assert.match(shareDoneTextOf('downloaded'), /\S/);
  assert.match(shareDoneTextOf('unavailable'), /\S/);
  assert.equal(shareDoneTextOf('bilinmeyen'), '');
  assert.match(shareErrorTextOf(new Error('kota doldu')), /kota doldu/);
  assert.match(shareErrorTextOf(null), /tekrar deneyebilirsin/);
});

/* ═══════════════════════════════════════════════════════════════
   5) PAYLAŞILAN KARE — NE GİRER, NE GİRMEZ
   ═══════════════════════════════════════════════════════════════ */

test('kadraj tablodur; kupon adı kutusu ve arşiv durumu kareye GİRMEZ', () => {
  const kod = kodu(BULTEN);
  const kare = kod.match(/<ViewShot[\s\S]*?<\/ViewShot>/);
  assert.ok(kare, 'paylaşılan kare tanımlı değil');
  const ic = kare[0];
  assert.match(ic, /\{tablo\}/, 'kareye tablo alınmamış');
  for (const sizinti of ['studio-bulletin-name', 'studio-bulletin-saved', 'studio-bulletin-save-btn', 'kayitli']) {
    assert.ok(!ic.includes(sizinti), `karede kişisel/kayıt izi var: ${sizinti}`);
  }
  // Kare, sağ özet panelinin DIŞINDA çizilir.
  assert.ok(!ic.includes('{ozet}'), 'özet paneli kadraja girmiş');
});

test('paylaşılan karede dürüstlük bildirimi VAR ve merkezden geliyor', () => {
  const kod = kodu(BULTEN);
  const kare = kod.match(/<ViewShot[\s\S]*?<\/ViewShot>/)[0];
  assert.match(kare, /\{NO_GUARANTEE_NOTICE\}/, 'kazanç vaadi olmadığı bildirimi kadrajın içinde değil');
  assert.match(kare, /18\+/, 'yaş uyarısı kadrajın içinde değil');
  assert.match(kare, /\{APP_NAME_UPPER\}/, 'marka şeridi yok ya da elle yazılmış');
  assert.match(kod, /from '\.\.\/brand'/, 'marka/bildirim merkezden okunmuyor');
  // LegalStrip kadrajın DIŞINDA kalıyor; bu yüzden kare kendi uyarısını taşır.
  assert.ok(!kare.includes('LegalStrip'), 'yasal şerit kadraja alınmış — ekranın altındaki şeritle çakışır');
});

test('paylaşım düğmesi ve sonuç satırı ekranda; kancalar bülten ad alanında', () => {
  const kod = kodu(BULTEN);
  assert.match(kod, /testID="studio-bulletin-share-btn"/);
  assert.match(kod, /testID="studio-bulletin-share-message"/);
  assert.match(kod, /accessibilityLabel="Ekran görselini paylaş"/);
  assert.match(kod, /disabled=\{paylasiliyor\}/, 'çift dokunuş engellenmemiş');
});

test('iptal edilen paylaşım ekrana hata yazmaz', () => {
  const kod = kodu(BULTEN);
  assert.match(kod, /isAbortError\(e\) \? '' : shareErrorTextOf\(e\)/, 'iptal ile hata ayrılmamış');
});

test('web ve telefon yolları ayrı — web\'de dosya yolu yoktur', () => {
  const kod = kodu(BULTEN);
  assert.match(kod, /Platform\.OS === 'web'/, 'platform ayrımı yok');
  assert.match(kod, /result: 'data-uri'/, "web'de veri-URI istenmiyor");
  assert.match(kod, /Sharing\.isAvailableAsync\(\)/, 'telefonda paylaşım varlığı sorgulanmıyor');
  assert.match(kod, /sharePngOnWeb\(/, "web paylaşım yolu bağlanmamış");
});

test('paylaşım modülü tarayıcı nesnelerine yalnız ÇAĞRILDIĞINDA dokunur', () => {
  // Bu dosya zaten import edildi (yukarıda) — Node'da navigator/document
  // olmadan içe aktarım patlamadıysa kural tutuyor demektir. Yine de üst
  // düzeyde erişim olmadığını metinden de doğrula: (1) ilk işlevden ÖNCEKİ
  // bölge (içe aktarımlar, sabitler) tarayıcıya dokunmamalı, (2) tarayıcıya
  // dokunan her satır bir blok içinde (girintili) olmalı. İkinci kural,
  // dosyaya yeni tarayıcı yardımcısı eklendiğinde de geçerli kalır.
  const metin = kodu(PAYLASIM);
  const ilkIslev = metin.search(/\bfunction\s/);
  assert.ok(ilkIslev > 0, 'dosya beklenen biçimde okunmadı');
  assert.ok(
    !/\bdocument\.|\bnavigator\./.test(metin.slice(0, ilkIslev)),
    'modül yüklenirken tarayıcı nesnesine dokunuyor',
  );
  const satirlar = metin.split('\n').filter((s) => /\bdocument\.|\bnavigator\./.test(s));
  assert.ok(satirlar.length > 0, 'tarayıcı erişimi hiç bulunamadı — dosya yanlış okunmuş olabilir');
  for (const s of satirlar) {
    assert.match(s, /^\s+\S/, `tarayıcı nesnesine üst düzeyde dokunuluyor: ${s.trim()}`);
  }
});

/* ═══════════════════════════════════════════════════════════════
   5b) EŞİT-GENİŞLİK RAKAMI — KARE ALIRKEN GEÇİCİ KAPANIR

   Web'de kareyi alan kitaplık (html2canvas) metni ekrandaki eşit-genişlik
   ölçüsüyle ölçüp tuvale orantılı genişlikle çiziyordu; paylaşılan görselde
   "19:00" → "19 :00" gibi kaymalar çıkıyordu. Çözüm ayarı SİLMEK değil,
   yalnız kare süresince kapatmaktır — ekranda sütunlar hizalı kalmalı.
   ═══════════════════════════════════════════════════════════════ */

test('tabularOff tarayıcı yokken patlamaz; her hâlde çağrılabilir geri-alma döner', () => {
  // Node'da document yoktur; telefonda da bu yol hiç çalışmaz. Sessizce
  // etkisiz kalmalı, çünkü çağıran dönen değeri finally'de KOŞULSUZ çağırır.
  assert.equal(typeof globalThis.document, 'undefined', 'bu test DOM olmayan ortam varsayar');
  const geri = tabularOff();
  assert.equal(typeof geri, 'function', 'geri-alma işlevi dönmedi');
  assert.doesNotThrow(() => geri(), 'geri-alma patlıyor');
  assert.doesNotThrow(() => geri(), 'ikinci kez çağrılınca patlıyor');
});

test('tabularOff kalıcı değil — açtığı ayarı kendi geri alır', () => {
  const kod = kodu(PAYLASIM);
  const govde = kod.match(/export function tabularOff\(\)[\s\S]*?\n\}/);
  assert.ok(govde, 'tabularOff bulunamadı');
  assert.match(govde[0], /document\.head\.appendChild/, 'stil eklenmiyor');
  assert.match(govde[0], /return \(\) =>[\s\S]*?\.remove\(\)/, 'geri-alma stili kaldırmıyor');
});

test('ekran ayarı yalnız WEB\'de ve yalnız kare boyunca kapatır', () => {
  const kod = kodu(BULTEN);
  assert.match(kod, /tabularOff/, 'ekran çözümü bağlamamış');
  assert.match(kod, /web \? tabularOff\(\) : null/, 'ayar telefonda da kapatılıyor ya da koşulsuz');
  // Kare alma patlasa bile ayar geri konmalı: finally şart.
  // (finally içinde başka geri-almalar da olabilir — sıra değil, VARLIK aranır.)
  assert.match(
    kod,
    /captureRef\([\s\S]*?\n\s*\} finally \{[^}]*?if \(tabularGeri\) tabularGeri\(\);/,
    'kare alma finally ile sarılmamış — hata olursa ayar kapalı kalır',
  );
});

test('eşit-genişlik ayarı ekrandan SİLİNMEDİ — sütunlar hizalı kalır', () => {
  // Barlow rakamları öntanımlı olarak orantılıdır (tarayıcıda ölçüldü:
  // "111" 12px / "000" 21px). TABULAR gerçek iş yapıyor; kaldırılamaz.
  const kod = kodu(BULTEN);
  assert.match(kod, /TABULAR/, 'eşit-genişlik ayarı ekrandan kaldırılmış');
  assert.ok(
    (kod.match(/TABULAR/g) || []).length >= 5,
    'sayı sütunlarının bir kısmı eşit-genişlik ayarını kaybetmiş',
  );
});

/* ═══════════════════════════════════════════════════════════════
   6) YENİ METİNLER DE HÜKÜM VERMİYOR
   ═══════════════════════════════════════════════════════════════ */

test('kayıt ve paylaşım metinlerinde yasak hüküm sözcüğü yok', () => {
  // studio-no-verdict.test.mjs ile AYNI liste; oradaki tarama ekranları
  // kapsıyor, bu iki yardımcı dosya listede olmadığı için burada sınanır.
  const YASAK = /riskli|risksiz|güvenli|güvensiz|temkinli|toplam risk|risk sinyali|risk yorumu|veri güveni|belirsizlik/i;
  for (const [ad, kaynak] of Object.entries({ 'studioCouponSave.js': KAYIT, 'studioShare.js': PAYLASIM })) {
    const bulunan = kodu(kaynak).match(YASAK);
    assert.ok(!bulunan, `${ad}: yasak hüküm sözcüğü → "${bulunan?.[0]}"`);
  }
});

test('kayıt ve paylaşım metinlerinde iddialı dil yok', () => {
  const IDDIALI = /(kesin|garanti|banko|yanılmaz|net favori|kaçmaz|kazandırır)/i;
  for (const [ad, kaynak] of Object.entries({ 'studioCouponSave.js': KAYIT, 'studioShare.js': PAYLASIM })) {
    const metinler = [...kodu(kaynak).matchAll(/'([^'\n]{8,})'|"([^"\n]{8,})"|`([^`]{8,})`/g)]
      .map((m) => m[1] || m[2] || m[3])
      .filter((s) => /[çğıöşüÇĞİÖŞÜ ]/.test(s));
    const kotu = metinler.filter((s) => IDDIALI.test(s));
    assert.deepEqual(kotu, [], `${ad} içinde iddialı dil:\n${kotu.join('\n')}`);
  }
});
