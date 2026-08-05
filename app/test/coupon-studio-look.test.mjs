// KUPON EKRANLARI · YAYIN STÜDYOSU GÖRÜNÜMÜ
//
// NE İÇİN YAZILDI: Kupon ekranları (Hazırla · Merkez · Sonuç · Paylaş) kendi
// temalarıyla, armasız düz listeler olarak çiziliyordu. Kullanıcı isteği:
// "kuponlarım kısmını da yayıncı modundaki gibi görsellerden yapalım" — yani
// dördü de yayın stüdyosunun RESMÎ BÜLTEN TABLOSU olacak: sıra no · ev arması ·
// takım adları · konuk arması · 1-0-2 kutuları.
//
// NEDEN KAYNAK METNİ SINANIYOR: Ekran dosyaları JSX içerdiği için node:test
// onları import edemiyor. Bu yüzden "tablo gerçekten ortak modülden geliyor mu,
// arma gerçekten çiziliyor mu, ikinci bir tablo yazılmış mı" soruları kaynak
// metninden doğrulanır. Saf mantık (paylaşım dosya adı/altyazısı) ise doğrudan
// çalıştırılarak sınanır.
//
// NE SINANIR:
//   1) Dört ekran da ortak tablo modülünü kullanıyor, eski tema kalmadı.
//   2) Armalar gerçekten satıra veriliyor (m.home.logo / m.away.logo).
//   3) Kanca sırası: ölçek kancası koşullu return'lerden ÖNCE çağrılıyor.
//   4) Kupon Merkezi salt okunur — ikinci bir düzenleme yüzeyi doğmuyor.
//   5) Paylaşım: stüdyonun kare yolu kullanılıyor, elle çizilen tuval gitti,
//      dürüstlük bildirimi kadrajın İÇİNDE, kişisel veri ve kupon kimliği yok.
//   6) Paylaşım yardımcıları: dosya adı, başlık, altyazı.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  couponShareFileNameOf, couponShareTitleOf, couponShareCaptionOf,
} from '../src/studioShare.js';
import { APP_NAME, NO_GUARANTEE_NOTICE } from '../src/brand.js';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..');
const oku = (...p) => readFileSync(join(kok, ...p), 'utf8');
// Yorum satırları sayılmasın: kural yorumda değil, KODDA aranır.
const kodu = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const ekran = (ad) => kodu(oku('src', 'screens', `${ad}.js`));

const EKRANLAR = {
  CouponEditorScreen: ekran('CouponEditorScreen'),
  CouponCenterScreen: ekran('CouponCenterScreen'),
  CouponResultScreen: ekran('CouponResultScreen'),
  CouponShareScreen: ekran('CouponShareScreen'),
};
const PARCALAR = ekran('couponStudioParts');
const PAYLAS = kodu(oku('src', 'screens', 'CouponShareScreen.js'));

/* ═══════════════════ 1) ORTAK TABLO · ESKİ TEMA YOK ═══════════════════ */

test('dört kupon ekranı da ortak stüdyo tablosundan besleniyor', () => {
  for (const [ad, kod] of Object.entries(EKRANLAR)) {
    assert.match(kod, /from '\.\/couponStudioParts'/, `${ad}: ortak tablo modülü kullanılmıyor`);
    assert.match(kod, /\bMacSatiri\b/, `${ad}: stüdyo maç satırı çizilmiyor`);
    assert.match(kod, /\bTablo\b/, `${ad}: tablo çerçevesi yok`);
  }
});

test('kupon ekranlarında eski tema kalmadı — tek palet stüdyo paleti', () => {
  for (const [ad, kod] of Object.entries(EKRANLAR)) {
    assert.ok(!/from '\.\.\/theme'/.test(kod), `${ad}: eski tema hâlâ içe aktarılıyor`);
    assert.match(kod, /from '\.\.\/studioTheme'/, `${ad}: stüdyo paleti kullanılmıyor`);
  }
});

test('ikinci bir maç satırı elle yazılmamış — satır TEK yerde tanımlı', () => {
  // MacSatiri dışında arma çizen bir ekran, ortak satırın kopyası demektir;
  // biri düzeltilince diğeri geride kalır.
  for (const [ad, kod] of Object.entries(EKRANLAR)) {
    assert.ok(!/<TeamCrest\b/.test(kod), `${ad}: armayı kendi çiziyor — ortak satırı atlıyor`);
  }
  assert.match(PARCALAR, /<TeamCrest uri=\{homeLogo\}/, 'ortak satır ev armasını çizmiyor');
  assert.match(PARCALAR, /<TeamCrest uri=\{awayLogo\}/, 'ortak satır konuk armasını çizmiyor');
});

/* ═══════════════════ 2) ARMALAR GERÇEKTEN VERİLİYOR ═══════════════════ */

test('armalar satıra bağlanıyor — veri zaten geliyordu, yalnız çizilmiyordu', () => {
  for (const [ad, kod] of Object.entries(EKRANLAR)) {
    assert.match(kod, /homeLogo=\{[^}]*home\??\.logo\}/, `${ad}: ev arması satıra verilmiyor`);
    assert.match(kod, /awayLogo=\{[^}]*away\??\.logo\}/, `${ad}: konuk arması satıra verilmiyor`);
  }
});

test('arma yoksa satır yine çizilir — uydurma ad ya da "benzeri" arma yok', () => {
  // Ortak satır, ad boşsa tire koyar; arma boşsa nötr simgeye düşer (TeamCrest).
  assert.match(PARCALAR, /\{home \|\| '—'\}/, 'ev adı yoksa tire konmuyor');
  assert.match(PARCALAR, /\{away \|\| '—'\}/, 'konuk adı yoksa tire konmuyor');
});

/* ═══════════════════ 3) KANCA SIRASI ═══════════════════ */

test('ölçek kancası koşullu return\'lerden ÖNCE çağrılıyor', () => {
  // React kancaları her çizimde AYNI sırada çağrılmalı. Kanca bir erken
  // return'ün altında kalırsa "yükleniyor" hâlinden çıkarken sıra kayar ve
  // ekran çöker; bu, gözle fark edilmesi zor bir arızadır.
  for (const [ad, kod] of Object.entries(EKRANLAR)) {
    const kanca = kod.indexOf('useKuponOlcek(');
    assert.ok(kanca > 0, `${ad}: ölçek kancası hiç çağrılmıyor`);
    const erken = kod.search(/\n\s*if \([^\n]*\)\s*return\s</);
    if (erken > 0) {
      assert.ok(kanca < erken, `${ad}: ölçek kancası erken return'ün ALTINDA kalmış`);
    }
  }
});

/* ═══════════════════ 4) MERKEZ SALT OKUNUR ═══════════════════ */

test('Kupon Merkezi\'nde 1-0-2 kutuları salt okunur — düzenleme TEK ekranda', () => {
  // Stüdyo görünümü kutuları listeye de getiriyor; dokunulabilir olsalardı
  // ikinci bir düzenleme yüzeyi doğardı ve hangi kaydın geçerli olduğu
  // belirsizleşirdi.
  const kod = EKRANLAR.CouponCenterScreen;
  const kutu = kod.match(/<PickBoxes[^>]*\/>/g) || [];
  assert.ok(kutu.length > 0, 'listede işaret kutuları çizilmiyor');
  for (const b of kutu) {
    assert.match(b, /\bsalt\b/, `merkezdeki kutu düzenlenebilir: ${b}`);
    assert.ok(!/onToggle/.test(b), `merkezdeki kutuya düzenleme bağlanmış: ${b}`);
  }
  // Düzenleme yolu duruyor: kullanıcı değiştirmek isterse editöre gider.
  assert.match(kod, /'CouponEditor'/, 'düzenleme ekranına geçiş kaldırılmış');
});

test('Paylaş ekranındaki kutular da salt okunur — kare bir form değildir', () => {
  const kutu = PAYLAS.match(/<PickBoxes[^>]*\/>/g) || [];
  assert.ok(kutu.length > 0, 'paylaşılacak karede işaret kutuları yok');
  for (const b of kutu) assert.match(b, /\bsalt\b/, `karedeki kutu düzenlenebilir: ${b}`);
});

/* ═══════════════ 4b) SALT OKUNUR ≠ SOLUK ═══════════════ */

test('salt okunur yüzeylerde kutular SOLDURULMAZ — disabled geri gelmesin', () => {
  // Yaşanan hata: liste ve paylaşılan karede kutulara `disabled` veriliyordu.
  // `disabled` stili %42 saydamlık uyguluyor; kupon işaretleri açık somona
  // dönüp paylaşılan görsel silik çıkıyordu. Dokunulamazlık `salt` ile
  // anlatılır; `disabled` yalnız GERÇEK kilit (maç başladı) içindir.
  for (const [ad, kod] of [['Kupon Merkezi', EKRANLAR.CouponCenterScreen], ['Kuponu Paylaş', PAYLAS]]) {
    for (const b of kod.match(/<PickBoxes[^>]*\/>/g) || []) {
      assert.ok(!/\bdisabled\b/.test(b), `${ad}: salt okunur kutuya soldurucu disabled verilmiş: ${b}`);
    }
  }
  // Bileşen tarafı: solukluk YALNIZ disabled'a bağlı kalmalı.
  const parca = kodu(oku('src', 'screens', 'studioParts.js'));
  assert.match(parca, /salt\s*=\s*false/, 'PickBoxes salt okunur kipini tanımıyor');
  assert.match(parca, /disabled\s*&&\s*st\.pickOff/, 'solukluk disabled dışında bir şeye bağlanmış');
  assert.ok(!/pasif\s*&&\s*st\.pickOff/.test(parca), 'salt okunur kutular yine soldurulmuş');
});

test('kaydedilmiş kuponda satır zemini vurgulanmaz — zebra korunur', () => {
  // KURAL: vurgu ancak AYIRIYORSA anlamlıdır.
  //  • Kupon Hazırla'da işaretli ve işaretsiz satırlar yan yanadır → `secili`
  //    hangisine dokunulduğunu söyler, bilgi taşır, KALIR.
  //  • Kaydedilmiş kuponda (Merkez, paylaşılan kare) HER satır işaretlidir →
  //    hepsini boyamak zebrayı yutup tabloyu tek renk soluk bir bloğa çevirir,
  //    hiçbir satırı ayırmaz. Hangi işaretin basıldığını sağdaki kutular gösterir.
  for (const [ad, kod] of [['Kuponu Paylaş', PAYLAS], ['Kupon Merkezi', EKRANLAR.CouponCenterScreen]]) {
    const satir = kod.match(/<MacSatiri[\s\S]*?\/>/g) || [];
    assert.ok(satir.length > 0, `${ad}: maç satırı yok`);
    for (const s of satir) {
      assert.ok(!/\bsecili=/.test(s), `${ad}: satır zemini vurgulanmış: ${s.slice(0, 120)}…`);
      assert.match(s, /\bzebra=/, `${ad}: zebra satır düzeni yok`);
    }
  }
  // Karşı taraf: düzenleyicide vurgu KALMALI, yoksa işaretlediğin satır kaybolur.
  assert.match(EKRANLAR.CouponEditorScreen, /\bsecili=/,
    'Kupon Hazırla: işaretlenen satırın vurgusu kaldırılmış');
});

/* ═══════════════════ 5) PAYLAŞILAN KARE ═══════════════════ */

test('elle çizilen tuval gitti — kare artık ekranın kendisinden alınıyor', () => {
  // Tuvale kulüp armaları hiç giremiyordu; armaların paylaşılan görselde
  // çıkmasının tek yolu ekranın karesini almak.
  for (const iz of ['drawCouponCanvasWeb', 'roundRect', 'shareCanvasPng', 'getContext']) {
    assert.ok(!PAYLAS.includes(iz), `elle çizilen tuval kalıntısı: ${iz}`);
  }
  assert.match(PAYLAS, /<ViewShot/, 'kadraj tanımlı değil');
  // Kadrajın SINIRI: dürüstlük bildirimi ve 18+ uyarısı <ViewShot> İÇİNDE olmalı.
  // Dışına taşarsa paylaşılan görselde uyarı görünmez; ayrıca gizlilik denetimi
  // (scripts/render-coupon.mjs) kadrajı bu bildirime bakarak bulur.
  const kadraj = PAYLAS.match(/<ViewShot[\s\S]*?<\/ViewShot>/)[0];
  // LEGAL_FOOTER = "18+ · Kesin sonuç... · Destek: YEDAM 444 79 75" (brand.js
  // tek kaynak) — 18+ ve dürüstlük bildirimi bu sabitin İÇİNDEDİR (T7).
  assert.match(kadraj, /LEGAL_FOOTER/, 'birleşik yasal alt satır kadrajın dışında kalmış');
});

test('paylaşım stüdyonun kare yolunu kullanıyor: armalar gömülüyor, çözünürlük yüksek', () => {
  assert.match(PAYLAS, /inlineImagesForCapture\(paylasRef\.current\)/, 'armalar kare öncesi gömülmüyor');
  assert.match(PAYLAS, /capturePngDataUri\(paylasRef\.current/, 'yüksek çözünürlüklü kare alınmıyor');
  // Kitaplık yoksa paylaşım özelliği kaybolmamalı: eski yol duruyor.
  assert.match(PAYLAS, /if \(!goruntu\)[\s\S]{0,200}captureRef\(/, 'kare alınamazsa eski yola düşülmüyor');
  // GEÇİCİ DEĞİŞİKLİK GERİ ALINMALI: ekranda kalıcı iz bırakmaz.
  assert.match(PAYLAS, /finally\s*\{[\s\S]{0,200}armaGeri\(\)/, 'gömme finally içinde geri alınmıyor');
  assert.match(PAYLAS, /finally\s*\{[\s\S]{0,200}tabularGeri\(\)/, 'eşit-genişlik ayarı geri alınmıyor');
});

test('iptal edilen paylaşım ekrana hata yazmaz', () => {
  assert.match(PAYLAS, /isAbortError\(e\) \? '' : shareErrorTextOf\(e\)/, 'iptal ile hata ayrılmamış');
});

test('web ve telefon yolları ayrı — web\'de dosya yolu yoktur', () => {
  assert.match(PAYLAS, /Platform\.OS === 'web'/, 'platform ayrımı yok');
  assert.match(PAYLAS, /result: 'data-uri'/, "web'de veri-URI istenmiyor");
  assert.match(PAYLAS, /Sharing\.isAvailableAsync\(\)/, 'telefonda paylaşım varlığı sorgulanmıyor');
  assert.match(PAYLAS, /sharePngOnWeb\(/, 'web paylaşım yolu bağlanmamış');
});

test('kadrajda dürüstlük bildirimi VAR ve merkezden geliyor', () => {
  const kare = PAYLAS.match(/<ViewShot[\s\S]*?<\/ViewShot>/);
  assert.ok(kare, 'paylaşılan kare tanımlı değil');
  const ic = kare[0];
  assert.match(ic, /\{LEGAL_FOOTER\}/, 'birleşik yasal alt satır (18+ + vaat-yok + YEDAM) kadrajın içinde değil');
  assert.match(ic, /\{APP_NAME_UPPER\}/, 'marka şeridi yok ya da elle yazılmış');
  assert.match(PAYLAS, /from '\.\.\/brand'/, 'marka/bildirim merkezden okunmuyor');
});

test('kadrajda kişisel veri, kupon kimliği ve arayüz izi YOK', () => {
  const ic = PAYLAS.match(/<ViewShot[\s\S]*?<\/ViewShot>/)[0];
  for (const sizinti of ['coupon.name', 'coupon.couponNo', 'couponId', 'email', 'token']) {
    assert.ok(!ic.includes(sizinti), `karede kişisel/kimlik izi var: ${sizinti}`);
  }
  // Boyut anahtarları, tutar anahtarı ve paylaşım düğmesi kadrajın DIŞINDA.
  for (const arayuz of ['setFormat', 'setShowCost', 'onPress={paylas}']) {
    assert.ok(!ic.includes(arayuz), `arayüz denetimi kadraja girmiş: ${arayuz}`);
  }
});

test('karede kolon bilgisi ve kullanıcı beyanı açıkça yazılı', () => {
  const ic = PAYLAS.match(/<ViewShot[\s\S]*?<\/ViewShot>/)[0];
  assert.match(ic, /\{altSatirlar\.join/, 'kolon/beyan şeridi kadrajda değil');
  assert.match(PAYLAS, /Kolon: \$\{v\.columnCount\}/, 'kolon sayısı görselde yazmıyor');
  // Tutar YALNIZ gerçek fiyat kaydı varken ve kullanıcı açtığında yazılır.
  assert.match(PAYLAS, /showCost \? costOf\(v\.columnCount, pricing\) : null/, 'tutar koşulu değişmiş');
  assert.match(PAYLAS, /validPricing\(/, 'birim bedel doğrulanmadan kullanılıyor');
  assert.match(
    PAYLAS,
    /kullanıcı beyanı, bağımsız olarak doğrulanmamıştır/,
    'kilitli tahmin beyan olarak işaretlenmiyor',
  );
  assert.ok(!/doğrulandı|onaylandı/i.test(PAYLAS), 'beyan doğrulanmış gibi gösteriliyor');
});

test('ekranda gizlilik cümlesi duruyor', () => {
  assert.match(PAYLAS, /hesap bilgisi, e-posta veya kişisel veri BULUNMAZ/, 'gizlilik cümlesi silinmiş');
});

/* ═══════════════════ 6) PAYLAŞIM YARDIMCILARI ═══════════════════ */

test('kupon dosya adı: hafta yazılır, kupon kimliği YAZILMAZ', () => {
  assert.equal(couponShareFileNameOf({ roundId: 1526 }), 'sportoto-kupon-hafta-1526.png');
  assert.equal(couponShareFileNameOf({ roundId: 1526, weekNumber: 14 }), 'sportoto-kupon-hafta-14.png');
  // Hafta bilinmiyorsa uydurma numara yazılmaz.
  assert.equal(couponShareFileNameOf({}), 'sportoto-kupon.png');
  assert.equal(couponShareFileNameOf(), 'sportoto-kupon.png');
  // Yol ayracı içeren bir değer dosya adını bozamaz.
  assert.equal(couponShareFileNameOf({ roundId: '../../gizli' }), 'sportoto-kupon-hafta-gizli.png');
});

test('kupon paylaşım başlığı: resmî hafta adı > hafta no; iç kayıt no ASLA yazılmaz', () => {
  // HATA DÜZELTMESİ (2026-08-06): "Hafta 1527" diye iç kayıt numarası
  // gösteriliyordu; kullanıcı bunu hafta sanıp hatalı buldu. Artık resmî ad
  // ("53. Hafta") ya da hafta numarası yazılır; roundId hiçbir başlığa girmez.
  assert.equal(couponShareTitleOf({ roundName: '53. Hafta' }), '53. Hafta kuponu');
  assert.equal(couponShareTitleOf({ weekNumber: 53 }), '53. Hafta kuponu');
  assert.equal(couponShareTitleOf({ roundId: 1526 }), 'Kupon'); // iç no gösterilmez
  assert.equal(couponShareTitleOf({}), 'Kupon');
  assert.equal(couponShareTitleOf(), 'Kupon');
});

test('kupon altyazısı: marka ve dürüstlük bildirimi TEK KAYNAKTAN', () => {
  const y = couponShareCaptionOf({ roundName: '53. Hafta', columnCount: 24 });
  assert.match(y, /53\. Hafta/);
  assert.match(y, /24 kolon/);
  assert.ok(y.includes(APP_NAME), 'marka adı altyazıda yok');
  assert.ok(y.endsWith(NO_GUARANTEE_NOTICE), 'dürüstlük bildirimi altyazının sonunda değil');
  // İç kayıt numarası altyazıya SIZMAZ.
  assert.ok(!couponShareCaptionOf({ roundId: 1526, columnCount: 24 }).includes('1526'));
  // Kolon bilinmiyorsa sıfır yazılmaz.
  assert.ok(!couponShareCaptionOf({ roundName: '53. Hafta' }).includes('kolon'));
  assert.ok(!couponShareCaptionOf({ roundName: '53. Hafta', columnCount: 0 }).includes('kolon'));
  // Hafta yoksa da bildirim düşmez.
  assert.ok(couponShareCaptionOf().endsWith(NO_GUARANTEE_NOTICE));
});

test('kupon paylaşımında kişisel alan altyazıya sızmıyor', () => {
  const y = couponShareCaptionOf({ roundId: 1526, columnCount: 3, name: 'Emrah', couponNo: 7 });
  assert.ok(!/Emrah/.test(y), 'kupon adı altyazıya sızmış');
  assert.ok(!/\b7\b/.test(y.replace('1526', '')), 'kupon numarası altyazıya sızmış');
});
