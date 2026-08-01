// YAYIN STÜDYOSU — EKRAN BAĞLANTILARI VE YAZIM DENETİMİ.
//
// NEDEN KAYNAK TARAMASI: Ekran dosyaları JSX içerir, `node --test` bunları
// içe aktaramaz. Ama yayında en pahalı hata "çalışmayan düğme"dir; bu yüzden
// aşağıdakiler dosya metninden doğrulanır:
//   • Stüdyo rotalarının hepsi App.js'te KAYITLI (kayıtsız rotaya gitmek çöker).
//   • Ekranların gittiği HER rota adı gerçekten kayıtlı bir ekran.
//   • Ekranların hepsi tam ekran listesinde (alt sekme çubuğu yayına girmez).
//   • Ekranlar HESAP YAPMAZ: analiz motorunu doğrudan çağırmaz.
//   • Stüdyo yazımı tutarlı: beraberlik her yerde "0" görünür, 1-X-2 dizisi
//     ekranda ikinci kez yazılmaz.
//   • Maçtan maça geçişte not taslağı sıfırlanır (önceki maçın notu taşınmaz).
//   • Ekran metinlerinde iddialı dil yok.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FULLSCREEN_ROUTES } from '../src/studioTheme.js';

const buDizin = dirname(fileURLToPath(import.meta.url));
const oku = (...p) => readFileSync(join(buDizin, '..', ...p), 'utf8');

const APP = oku('App.js');
// ÜÇ EKRAN: tablo, maç detayı, geçmiş hafta karnesi. Dördüncü bir "Final
// Kupon" ekranı vardı; kaydetme tabloya taşındığı için kaldırıldı (yayıncı
// isteği). Geri gelmediği studio-bulletin-kupon.test.mjs'te sınanır.
const EKRANLAR = {
  StudioBulletin: oku('src', 'screens', 'StudioBulletinScreen.js'),
  StudioMatch: oku('src', 'screens', 'StudioMatchScreen.js'),
  StudioKarne: oku('src', 'screens', 'StudioKarneScreen.js'),
  parts: oku('src', 'screens', 'studioParts.js'),
};

const STUDIO_ROTALARI = ['StudioBulletin', 'StudioMatch', 'StudioKarne'];

/** App.js'te kayıtlı TÜM ekran/sekme adları. */
const kayitliRotalar = new Set(
  [...APP.matchAll(/<(?:Stack|Tab)\.Screen\s+name="([A-Za-z0-9_]+)"/g)].map((m) => m[1]),
);

/** Yorum satırları çıkarılmış kaynak — kural metni kanıt sayılmasın. */
const kodu = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* ═══════════════════════════════════════════════════════════════
   1) ROTALAR — yazılan ekran GERÇEKTEN açılabiliyor mu?
   ═══════════════════════════════════════════════════════════════ */

test('stüdyo ekranlarının hepsi App.js\'te kayıtlı (kayıtsız rota yayında çöker)', () => {
  for (const r of STUDIO_ROTALARI) {
    assert.ok(kayitliRotalar.has(r), `rota App.js'e eklenmemiş: ${r}`);
  }
});

test('stüdyo rotaları başlık çubuğu OLMADAN ve stüdyo zemininde açılır', () => {
  for (const r of STUDIO_ROTALARI) {
    const i = APP.indexOf(`name="${r}"`);
    assert.ok(i > 0, `rota bulunamadı: ${r}`);
    const blok = APP.slice(i, i + 400);
    const son = blok.indexOf('/>');
    const tanim = son > 0 ? blok.slice(0, son) : blok;
    assert.match(tanim, /headerShown:\s*false/, `${r}: yayın ekranında başlık çubuğu açık kalmış`);
    assert.match(tanim, /STUDIO_CONTENT_STYLE/, `${r}: stüdyo zemini uygulanmamış`);
  }
});

test('stüdyo ekranlarının gittiği HER rota adı kayıtlı bir ekrandır', () => {
  // Bu testin yakaladığı hata sınıfı: "CouponCenter" Ana Sayfa yığınında
  // kayıtlı olmadığı hâlde doğrudan adıyla çağrılırsa gezinme hata verir.
  for (const [ad, kaynak] of Object.entries(EKRANLAR)) {
    const hedefler = [...kodu(kaynak).matchAll(/navigate\??\.?\(\s*'([A-Za-z0-9_]+)'/g)].map((m) => m[1]);
    for (const h of hedefler) {
      assert.ok(kayitliRotalar.has(h), `${ad} kayıtlı olmayan rotaya gidiyor: ${h}`);
    }
  }
});

// Arşiv düğmesi eskiden kaldırılan final kupon ekranındaydı; kayıt bülten
// ekranına taşınınca düğme de oraya geçti. Kural aynı kaldı, adres değişti.
test('arşiv düğmesi doğru sekmeden gider (CouponCenter Ana Sayfa yığınında yok)', () => {
  const kod = kodu(EKRANLAR.StudioBulletin);
  assert.ok(
    !/navigate\??\.?\(\s*'CouponCenter'/.test(kod),
    'CouponCenter doğrudan çağrılmış — Ana Sayfa yığınında kayıtlı değil, gezinme çöker',
  );
  // İsteğe bağlı zincir (navigation?.navigate?.(…)) de geçerli yazımdır.
  assert.match(kod, /navigate\??\.?\(\s*'CouponsTab'[\s\S]{0,80}CouponCenter/, 'arşive sekme üzerinden gidilmiyor');
});

test('stüdyo ekranlarının hepsi tam ekran listesinde (alt sekme çubuğu yayına girmez)', () => {
  for (const r of STUDIO_ROTALARI) {
    assert.ok(FULLSCREEN_ROUTES.includes(r), `tam ekran listesinde eksik: ${r}`);
  }
  assert.ok(FULLSCREEN_ROUTES.includes('Broadcast'), 'eski sunum ekranı listeden düşmüş');
  // Liste TEK yerde durur: App.js rota adlarını kendi içinde saymaz.
  assert.ok(
    !/getFocusedRouteNameFromRoute\(route\)\s*===\s*'Studio/.test(APP),
    'rota adı App.js içinde ikinci kez yazılmış — liste studioTheme.js\'te tek kalmalı',
  );
});

// GERÇEK HATADAN DOĞDU: iki stüdyo ekranı `import api from '../api'` yazmıştı.
// api.js'te DEFAULT dışa aktarım YOK; bu yüzden `api` undefined oluyordu ve
// ekran "Maç açılamadı — Cannot read properties of undefined" ile açılmıyordu.
// Metro bunu derler (bundle 200 döner) ve ekranlar JSX içerdiği için birim
// testi de içeri alamaz — yani hatayı YALNIZ bu tür bir kaynak taraması ya da
// gerçek tarayıcı yakalar. Ucuz olanı burada tutuyoruz.
test('ekranlar api\'yi adlı alır — default alım undefined verir', () => {
  for (const [ad, kaynak] of Object.entries(EKRANLAR)) {
    const kotu = /^\s*import\s+([A-Za-z_$][\w$]*)\s*(?:,\s*\{[^}]*\})?\s*from\s+['"][^'"]*\/api['"]/m.exec(kaynak);
    assert.equal(kotu, null, `${ad}: api default olarak alınmış (${kotu?.[1]}) — { api } yazılmalı`);
  }
  // En az bir ekran gerçekten kullanıyor olmalı; kural boşa dönmesin.
  assert.ok(/import\s*\{[^}]*\bapi\b[^}]*\}\s*from\s+'\.\.\/api'/.test(EKRANLAR.StudioBulletin));
});

// GERÇEK HATADAN DOĞDU (2): react-native-web'de `Alert.alert()` BOŞ bir
// işlevdir — hiçbir şey yapmaz. Kupon kaydı reddedildiğinde tek geri bildirim
// Alert olduğu için web'de düğmeye basan yayıncı sebebi öğrenemiyordu; ekran
// sessiz kalıyordu. Kural: Alert kullanılıyorsa ekranda GÖRÜNEN bir karşılığı
// da olmalı (mesaj durumu). Alert telefonda ek kolaylıktır, tek kanal değildir.
test('Alert kullanan ekran, mesajı ekrana da yazar (web\'de Alert boştur)', () => {
  for (const [ad, kaynak] of Object.entries(EKRANLAR)) {
    const kod = kodu(kaynak);
    if (!/\bAlert\.alert\(/.test(kod)) continue;
    assert.ok(
      /setMesaj\(/.test(kod),
      `${ad}: Alert.alert var ama ekrana yazan bir mesaj durumu yok — web'de sessiz kalır`,
    );
    assert.ok(
      /testID=\{?['"][\w-]*message/.test(kod),
      `${ad}: mesaj ekranda gösterilmiyor`,
    );
  }
});

// Bu güvence kaldırılan final kupon ekranından bülten ekranına TAŞINDI —
// kayıt oraya taşındığı için. Kuralın kendisi (hangi sebep, hangi sıra) artık
// studioCouponSave.js'te ve saf hâliyle sınanıyor; burada sınanan şey ekranın
// o kuralı gerçekten KULLANIP kullanmadığı ve sebebi GÖSTERİP göstermediği.
test('kupon kaydı, başlamış maç varsa ÖNCEDEN uyarır ve düğmeyi kapatır', () => {
  const kod = kodu(EKRANLAR.StudioBulletin);
  assert.match(kod, /engelliNolarOf\(rows\)/, 'başlamış+seçili maçlar hesaplanmıyor');
  // Ölçüt (r.locked && r.hasPick) ortak dosyada durur; ekran onu KENDİ ELİNE
  // ALMAMALI — iki yerde duran kural er geç ayrışır.
  assert.ok(!/r\.locked\s*&&\s*r\.hasPick/.test(kod), 'engel ölçütü ekranda tekrar yazılmış');
  assert.match(kod, /studio-bulletin-blocked/, 'engel uyarısı ekranda gösterilmiyor');
  assert.match(kod, /kayitKapali/, 'düğmenin kapalı durumu tek yerden gelmiyor');
  // Kayıt engeli düğmenin görünümüne DE yansımalı; yalnız dokunuşta reddetmek
  // yayıncıya "bozuk" hissi verir.
  assert.match(kod, /st\.kaydet,\s*kayitKapali/, 'pasif görünüm kayitKapali\'ya bağlı değil');
  // GERÇEK TARAYICIDA YAKALANDI: accessibilityState={{disabled}} react-native-web'de
  // DOM'a YAZILMIYOR (aria-disabled boş çıkıyor) — ekran okuyucu düğmeyi
  // "kullanılabilir" sanıyordu. Yerli taraf için accessibilityState, web için
  // aria-disabled; ikisi de aynı değere bağlı olmalı.
  assert.match(kod, /accessibilityState=\{\{\s*disabled:\s*kayitKapali/, 'accessibilityState kayitKapali\'ya bağlı değil');
  assert.match(kod, /aria-disabled=\{kayitKapali\}/, 'web tarafında aria-disabled yazılmıyor');
  assert.match(kod, /disabled=\{kaydediliyor \|\| kayitKapali\}/, 'düğme gerçekten kapatılmıyor');
  // SEBEPSİZ KAPALI DÜĞME, SESSİZ DÜĞMEDEN BETERDİR. Düğme kapalıysa sebebi
  // ekranda YAZILI olmalı. Sebep listesi tek yerde (saveBlockerOf) durduğu için
  // ekranın işi tektir: engel varsa metnini basmak, düğmeyi de aynı değere
  // bağlamak. Yeni bir sebep eklenirse metni kendiliğinden çıkar.
  assert.match(
    kod,
    /const engel\s*=[\s\S]{0,160}saveBlockerOf\(/,
    'engel sebebi ortak kuraldan (saveBlockerOf) gelmiyor',
  );
  assert.match(kod, /const kayitKapali\s*=\s*!!engel;/,
    'düğmenin kapalılığı engelin ta kendisine bağlı değil — sebepsiz kapanabilir');
  assert.match(
    kod,
    /testID="studio-bulletin-blocked"[\s\S]{0,120}\{engel\.text\}/,
    'engel metni ekrana basılmıyor — düğme sebepsiz kapanır',
  );
  // Ekran sebepleri KENDİ ELİNE ALMASIN: cümleler saveBlockerOf'ta tek kaynakta.
  assert.ok(!/Kupon .{0,20}maç tamamlanınca kaydedilir/.test(kod),
    'engel cümlesi ekranda ikinci kez yazılmış — iki kaynak er geç ayrışır');
  // Kolon sayısı GİZLENMEDİ: engel olmaktan çıktı, bilgi olarak duruyor.
  assert.match(kod, /columnsNoteOf/, 'kolon notu ortak dosyadan alınmıyor');
  assert.match(kod, /studio-bulletin-columns-note/, 'kolon bilgisi ekranda gösterilmiyor');
});

// ÇİZİM DENETİMİ, tarayıcı konsolundaki `collapsable` uyarısını "kütüphane
// uyarısı" diye ayırıyor. O ayrım ancak biz collapsable geçmiyorsak dürüsttür;
// biri bir gün geçerse uyarı bizim olur ve sessizce doğru kutuya düşmemeli.
test('kendi kaynağımız collapsable geçmiyor (çizim denetimindeki ayrımın dayanağı)', () => {
  for (const [ad, kaynak] of Object.entries(EKRANLAR)) {
    assert.equal(/collapsable/.test(kodu(kaynak)), false, `${ad}: collapsable geçiyor`);
  }
  assert.equal(/collapsable/.test(kodu(APP)), false, 'App.js: collapsable geçiyor');
});

/* ═══════════════════════════════════════════════════════════════
   2) EKRANLAR HESAP YAPMAZ
   ═══════════════════════════════════════════════════════════════ */

test('stüdyo ekranları analiz motorunu doğrudan çağırmaz (sayı tek yerden gelir)', () => {
  for (const [ad, kaynak] of Object.entries(EKRANLAR)) {
    const kod = kodu(kaynak);
    assert.ok(!kod.includes('userMatchEngine'), `${ad} analiz motorunu doğrudan çağırıyor`);
    assert.ok(!kod.includes('analyzeUserMatch'), `${ad} analiz motorunu doğrudan çağırıyor`);
  }
});

test('ekranlar kilit kuralını kendi yazmaz — depodan gelen değeri kullanır', () => {
  for (const [ad, kaynak] of Object.entries(EKRANLAR)) {
    const kod = kodu(kaynak);
    assert.ok(!/LOCK_BEFORE_MS/.test(kod), `${ad} kilit eşiğini kendi hesaplıyor`);
    assert.ok(!/Date\.now\(\)\s*[+-]/.test(kod), `${ad} ekranda zaman aritmetiği yapıyor`);
  }
});

/* ═══════════════════════════════════════════════════════════════
   3) STÜDYO YAZIMI — 1-0-2 her yerde aynı
   ═══════════════════════════════════════════════════════════════ */

test('1-X-2 dizisi ekranda ikinci kez yazılmaz (sıra couponConfig\'ten gelir)', () => {
  for (const [ad, kaynak] of Object.entries(EKRANLAR)) {
    assert.ok(
      !/\[\s*'1'\s*,\s*'X'\s*,\s*'2'\s*\]/.test(kodu(kaynak)),
      `${ad} kanonik sırayı yeniden yazmış — OUTCOMES kullanılmalı`,
    );
  }
});

test('X→0 eşlemesi ekranların içinde yeniden yazılmamış', () => {
  for (const [ad, kaynak] of Object.entries(EKRANLAR)) {
    assert.ok(
      !/===\s*['"]X['"]\s*\?\s*['"]0['"]/.test(kodu(kaynak)),
      `${ad} resmî yazımı kendi eşlemesiyle üretiyor — ikisi ayrışabilir`,
    );
  }
});

test('maç detayında işaretler stüdyo yazımıyla basılır (beraberlik "0")', () => {
  const kod = kodu(EKRANLAR.StudioMatch);
  assert.ok(kod.includes('officialText'), 'stüdyo yazımı kullanılmıyor');
  assert.ok(
    !/symbolText\(/.test(kod),
    'ham yazım (X) stüdyoda kalmış — seçim kutuları 0 derken radar X diyor',
  );
});

/* ═══════════════════════════════════════════════════════════════
   4) MAÇTAN MAÇA GEÇİŞ — ekran yeniden kurulmaz, durum elle sıfırlanır
   ═══════════════════════════════════════════════════════════════ */

test('sıradaki maça geçince not taslağı sıfırlanır (önceki maçın notu taşınmaz)', () => {
  const kod = kodu(EKRANLAR.StudioMatch);
  // "Sıradaki boş maç" aynı rotayı yeni parametreyle çağırır; bileşen ayakta
  // kalır. Taslak sıfırlanmazsa yayıncı bir harf yazınca YANLIŞ maça kaydedilir.
  assert.match(
    kod,
    /setNotTaslak\(null\)[\s\S]{0,200}\},\s*\[no\]\)/,
    'not taslağı maç değişince sıfırlanmıyor',
  );
});

/* ═══════════════════════════════════════════════════════════════
   4b) HAFTA KİLİDİ — kilitten sonra yalnız görüntüleme
   ═══════════════════════════════════════════════════════════════ */

test('bülteni yükleyen her ekran kilit anlarını depoya bildirir', () => {
  // Depo, kilit anlarını bilmeden başlamış maça yazmayı engelleyemez. Stüdyoya
  // hangi ekrandan girilirse girilsin kapı kurulu olmalıdır.
  for (const r of STUDIO_ROTALARI) {
    const kod = kodu(EKRANLAR[r]);
    if (!/api\.bulletin\(/.test(kod)) continue;
    assert.match(kod, /publishLocks\(/, `${r}: bülten yükleniyor ama kilit anları depoya bildirilmiyor`);
  }
});

test('seçim/not yazan her çağrıdan önce kilit denetlenir', () => {
  // Ekran denetimi İKİNCİ settir (son söz depoda), ama kutuya dokunulur dokunulmaz
  // görünen davranışın doğru olması için burada da durur.
  for (const [ad, kaynak] of Object.entries(EKRANLAR)) {
    const kod = kodu(kaynak);
    for (const yazan of ['togglePick', 'setNote']) {
      const i = kod.indexOf(`${yazan}(`);
      if (i < 0) continue;
      const once = kod.slice(Math.max(0, i - 320), i);
      assert.match(
        once,
        /locked|kilitli/i,
        `${ad}: ${yazan} çağrısından önce kilit denetimi yok`,
      );
    }
  }
});

test('kilitli maçta yayıncı notu salt okunurdur', () => {
  assert.match(
    kodu(EKRANLAR.StudioMatch),
    /editable=\{!\s*row\.locked\s*\}/,
    'not kutusu kilitli maçta hâlâ yazılabilir — söylenen cümle geriye dönük düzeltilebilir',
  );
});

test('hafta tamamen kilitlendiğinde ana ekran "yalnız görüntüleme" der', () => {
  const kod = kodu(EKRANLAR.StudioBulletin);
  assert.match(kod, /allLocked/, 'hafta kilidi ana ekranda hiç ele alınmamış');
  assert.match(kod, /studio-week-locked/, 'hafta kilidi bildirimi yok');
  assert.match(kod, /yalnız görüntüleme/i, 'kilitten sonra ne olduğu kullanıcıya yazılmıyor');
});

/* ═══════════════════════════════════════════════════════════════
   4c) KARNE — geçmiş hafta sayısı olduğundan iyi görünemez
   ═══════════════════════════════════════════════════════════════ */

test('karne sayıyı kendi hesaplamaz — studioKarne.js\'ten alır', () => {
  const kod = kodu(EKRANLAR.StudioKarne);
  assert.match(kod, /from '\.\.\/studioKarne'/, 'karne hesabı ekrana taşınmış');
  // Ekranda yüzde/oran aritmetiği olursa iki yerde iki farklı sayı çıkar.
  assert.ok(!/\*\s*100\b/.test(kod), 'karne ekranı yüzde hesaplıyor — hesap tek yerde kalmalı');
});

test('karne yalnız RESMÎ sonucu sayar ve geçici skoru açıkça ayırır', () => {
  const kod = kodu(EKRANLAR.StudioKarne);
  // Geçici/canlı skor ekranda görünebilir ama "resmî değil" etiketi zorunludur.
  assert.match(kod, /provisional/, 'geçici skor hiç ele alınmamış');
  assert.match(kod, /resmî değil/, 'geçici skor resmîden ayrılmıyor — başarı gibi okunur');
  assert.match(kod, /studio-karne-score/, 'haftanın "15\'te X" karnesi ekranda yok');
});

test('karne, kapalı (1-0-2) işaretlerin sayıyı şişirdiğini yazar', () => {
  // 1-0-2'nin üçü de işaretliyse maç sonuç ne olursa olsun "tuttu" sayılır.
  // Bu söylenmezse karne olduğundan iyi görünür — kural burada kilitlenir.
  const kod = kodu(EKRANLAR.StudioKarne);
  assert.match(kod, /kapaliNot/, 'kapalı işaret uyarısı ekrana bağlanmamış');
  assert.match(kod, /studio-karne-kapali-note/, 'kapalı işaret uyarısı görünmüyor');
});

test('karne ekranında kupon bedeli/maliyet yok (resmî birim bedel elimizde değil)', () => {
  const kod = kodu(EKRANLAR.StudioKarne);
  for (const yasak of [/birimBedel/i, /kolonBedeli/i, /maliyet\s*[:=]/i]) {
    assert.ok(!yasak.test(kod), `karne ekranında uydurulmuş bedel hesabı var: ${yasak}`);
  }
});

/* ═══════════════════════════════════════════════════════════════
   5) DİL VE MARKA
   ═══════════════════════════════════════════════════════════════ */

test('ekran metinlerinde iddialı dil yok', () => {
  const IDDIALI = /(kesin|garanti|banko|yanılmaz|net favori|kaçmaz|kazandırır)/i;
  // TEK İSTİSNA — projenin dürüstlük cümlesi. "kesin" kelimesini içerir ama
  // iddia DEĞİL, iddianın sınırıdır: yalnız resmî sonucun kesin olduğunu söyler.
  // Kalıp dar tutulur; "kesin" kelimesine genel af çıkarılmaz.
  const DURUSTLUK = /^Yalnız resmî .{0,40}sonucu kesindir[.;]?$/i;
  for (const [ad, kaynak] of Object.entries(EKRANLAR)) {
    const metinler = [...kodu(kaynak).matchAll(/'([^'\n]{8,})'|"([^"\n]{8,})"/g)]
      .map((m) => m[1] || m[2])
      .filter((s) => /[çğıöşüÇĞİÖŞÜ ]/.test(s));
    const kotu = metinler.filter((s) => IDDIALI.test(s) && !DURUSTLUK.test(s.trim()));
    assert.deepEqual(kotu, [], `${ad} içinde iddialı dil:\n${kotu.join('\n')}`);
  }
});

test('stüdyo marka adını kendi yazmaz — brand.js\'ten okur', () => {
  assert.match(EKRANLAR.parts, /from '\.\.\/brand'/, 'logo marka adını merkezden almıyor');
  for (const [ad, kaynak] of Object.entries(EKRANLAR)) {
    if (ad === 'parts') continue;
    assert.ok(
      !/Spor\s*Toto\s*Master/i.test(kodu(kaynak)),
      `${ad} marka adını elle yazmış — ad tek kaynaktan gelmeli`,
    );
  }
});

test('yayın yüzeyinde yasal şerit ve 18+ uyarısı var', () => {
  for (const r of STUDIO_ROTALARI) {
    assert.ok(EKRANLAR[r].includes('LegalStrip'), `${r}: yasal şerit yok`);
  }
  assert.match(EKRANLAR.parts, /18\+/, 'yaş uyarısı kaldırılmış');
});
