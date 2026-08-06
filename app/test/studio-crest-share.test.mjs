// YAYIN STÜDYOSU · PAYLAŞILAN GÖRSELDE ARMALAR VE ÇÖZÜNÜRLÜK
//
// HANGİ ARIZA İÇİN YAZILDI: Yayıncı "📸 Ekran görselini paylaş" ile bülteni
// paylaştığında kulüp armaları görselde ÇIKMIYORDU — ekranda görünmelerine
// rağmen. Sebep: kareyi çıkaran kitaplık tuvale ancak okuma izni (CORS) veren
// bir görseli çizebiliyor; dış kaynak bu izni vermeyince görseli HATA VERMEDEN
// düşürüyor. Nötr ⚽ bir YAZI karakteri olduğu için kareye giriyordu; gerçek
// armalar (gerçek <img>) giremiyordu. Paylaşılan görselde tek bir ⚽ görünüp
// diğer 29 armanın boş çıkması tam olarak bu ayrımın izidir.
//
// İKİNCİ ARIZA: kare hep 1× çiziliyordu (kitaplığın web sarmalayıcısı çağıranın
// ölçek seçeneğini İLETMİYOR), yani paylaşılan görsel büyütülünce dağılıyordu.
//
// NE SINANIR:
//   1) crestUrl.js — adres kendi sunucumuza çevriliyor mu, ÇEVİRMEMESİ gereken
//      durumlarda (gömülü/göreli/kendi sunucumuz/taban yok) dokunmuyor mu,
//      ve istemci koduna sağlayıcı adı sızmıyor mu.
//   2) studioShare.js — ölçek hesabı: en az 2×, tuval sınırları aşılmıyor,
//      1'in altına düşmüyor.
//   3) studioShare.js — armaların gömülmesi: adres yerine veri-URI konuyor,
//      inmeyen arma yerine NÖTR simge konuyor (başka kulübün arması ASLA),
//      ve iş bitince ESKİ adres geri konuyor.
//   4) Tarayıcı yokken (telefon / test koşucusu) hiçbiri patlamıyor.
//   5) Ekranlar bu yolu gerçekten kullanıyor mu (kaynak metninden).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { crestUrlOf } from '../src/crestUrl.js';
import {
  captureScaleOf, CAPTURE_MIN_SCALE, CAPTURE_MAX_SCALE,
  neutralCrestDataUri, inlineImagesForCapture, capturePngDataUri,
} from '../src/studioShare.js';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..');
const oku = (...p) => readFileSync(join(kok, ...p), 'utf8');
// Yorum satırları sayılmasın: kural yorumda değil, KODDA aranır.
const kodu = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const TABAN = 'http://192.168.1.20:4000';
const ARMA = 'https://ornek-dagitim.example/img/teams/a-kulubu.png';

/* ————————————————— 1) ADRES VEKİLDEN GEÇİYOR MU ————————————————— */

test('dış arma adresi kendi sunucumuzun üstünden geçirilir', () => {
  const c = crestUrlOf(ARMA, TABAN);
  assert.ok(c.startsWith(`${TABAN}/api/crest?u=`), `vekile çevrilmedi: ${c}`);
  // Adres KAÇIŞLANMIŞ olmalı; ham hâlde eklenirse sorgu dizesi bozulur.
  assert.match(c, /u=https%3A%2F%2F/, 'adres kaçışlanmadan eklenmiş');
  assert.equal(decodeURIComponent(c.split('u=')[1]), ARMA, 'adres yolda bozulmuş');
});

test('taban adresin sonundaki eğik çizgi çift çizgiye dönüşmez', () => {
  const c = crestUrlOf(ARMA, `${TABAN}/`);
  assert.ok(c.startsWith(`${TABAN}/api/crest?`), `çift çizgi oluşmuş: ${c}`);
});

test('dokunulmaması gereken adresler olduğu gibi kalır', () => {
  // Gömülü görsel zaten tuvale girer; vekile sokmak gereksiz ve bozucudur.
  assert.equal(crestUrlOf('data:image/png;base64,AAA', TABAN), 'data:image/png;base64,AAA');
  assert.equal(crestUrlOf('blob:http://x/y', TABAN), 'blob:http://x/y');
  // Göreli adres zaten kendi kaynağımızda.
  assert.equal(crestUrlOf('/varlik/arma.png', TABAN), '/varlik/arma.png');
  // Kendi sunucumuz — vekilin vekili olmaz.
  assert.equal(crestUrlOf(`${TABAN}/api/crest?u=x`, TABAN), `${TABAN}/api/crest?u=x`);
  assert.equal(crestUrlOf(`${TABAN}/statik/a.png`, TABAN), `${TABAN}/statik/a.png`);
  // Aynı sunucu, farklı büyük/küçük harf yazımı.
  assert.equal(crestUrlOf(`${TABAN.toUpperCase()}/a.png`, TABAN), `${TABAN.toUpperCase()}/a.png`);
});

test('boş adres boş kalır — uydurma adres üretilmez', () => {
  for (const bos of ['', '   ', null, undefined]) {
    assert.equal(crestUrlOf(bos, TABAN), '', `boş girdi bozuldu: ${String(bos)}`);
  }
});

test('taban adres bilinmiyorsa ÇALIŞAN adres bozulmaz', () => {
  // Yanlış yapılandırmada "hiç arma" yerine "eskisi gibi arma" doğrudur.
  for (const t of ['', null, undefined, '   ']) {
    assert.equal(crestUrlOf(ARMA, t), ARMA, `taban yokken adres bozuldu: ${String(t)}`);
  }
});

test('istemci tarafında sağlayıcı adı geçmez (marka gizliliği)', () => {
  // İzinli konak listesi SUNUCUDA durur; istemci "kendi sunucum değilse
  // vekilden geçir" der. Buraya bir sağlayıcı adı yazılırsa marka sızar.
  const kod = kodu(oku('src', 'crestUrl.js'));
  assert.ok(!/footystats/i.test(kod), 'crestUrl.js içinde sağlayıcı adı geçiyor');
  assert.ok(!/cdn\./i.test(kod), 'crestUrl.js içinde dış konak adı geçiyor');
});

/* ————————————————— 2) ÇÖZÜNÜRLÜK ————————————————— */

test('kare en az MIN ölçekte çizilir — düşük ölçek yumuşak çıkıyordu (2026-08-04: taban 3, tavan 4)', () => {
  assert.equal(captureScaleOf({ dpr: 1, width: 1200, height: 800 }), CAPTURE_MIN_SCALE);
  // Ekran yoğunluğu taban ile tavan arasındaysa yoğunluk kullanılır.
  assert.equal(captureScaleOf({ dpr: 3.5, width: 1200, height: 800 }), 3.5);
  // Üst sınır aşılmaz (bellek).
  assert.equal(captureScaleOf({ dpr: 8, width: 800, height: 600 }), CAPTURE_MAX_SCALE);
});

test('tuval sınırları aşılmaz — aşılırsa tarayıcı SESSİZCE boş kare döndürür', () => {
  // Çok geniş kare: kenar sınırı ölçeği kırpmalı. Sınır TAM olarak tutmalı —
  // ölçek aşağı yuvarlandığı için pay bırakmaya gerek yok.
  const genis = captureScaleOf({ dpr: 2, width: 6000, height: 400 });
  assert.ok(genis * 6000 <= 8192, `kenar sınırı aşıldı: ${genis * 6000}`);
  // Çok uzun kare (15 satır + paneller): yükseklik sınırı kırpmalı.
  const uzun = captureScaleOf({ dpr: 2, width: 1200, height: 7000 });
  assert.ok(uzun * 7000 <= 8192, `kenar sınırı aşıldı: ${uzun * 7000}`);
  // Toplam piksel sınırı.
  const buyuk = captureScaleOf({ dpr: 3, width: 3000, height: 3000 });
  assert.ok(buyuk * 3000 * buyuk * 3000 <= 24e6, 'piksel sınırı aşıldı');
  // Sınıra yakın onlarca boyutta da hiçbir zaman aşılmamalı.
  for (let g = 2000; g <= 9000; g += 137) {
    const k = captureScaleOf({ dpr: 3, width: g, height: 1000 });
    assert.ok(k * g <= 8192 || k === 1, `kenar sınırı aşıldı: ${g} → ${k * g}`);
  }
});

test('ölçek asla 1 altına inmez — ekrandakinden kötü kare üretilmez', () => {
  assert.ok(captureScaleOf({ dpr: 1, width: 20000, height: 20000 }) >= 1);
  assert.ok(captureScaleOf({ dpr: 0, width: 0, height: 0 }) >= 1);
  assert.ok(captureScaleOf({}) >= 1);
  assert.ok(captureScaleOf() >= 1);
  assert.ok(captureScaleOf({ dpr: NaN, width: -5, height: -5 }) >= 1);
});

/* ————————————————— 3) ARMALARIN GÖMÜLMESİ ————————————————— */

// Küçük sahte <img> — gerçek tarayıcı yok, sadece getAttribute/setAttribute.
function sahteImg(src) {
  let deger = src;
  return {
    getAttribute: () => deger,
    setAttribute: (_ad, v) => { deger = v; },
    get src() { return deger; },
  };
}
const sahteKok = (imgler) => ({ querySelectorAll: () => imgler });

test('gömme: adres yerine veri-URI konur, sonra ESKİ adres geri konur', async () => {
  const a = sahteImg('http://sunucu/api/crest?u=1');
  const b = sahteImg('http://sunucu/api/crest?u=2');
  const eskiFetch = globalThis.fetch;
  const eskiReader = globalThis.FileReader;
  globalThis.fetch = async () => ({ ok: true, blob: async () => ({ type: 'image/png' }) });
  globalThis.FileReader = class {
    readAsDataURL() { this.result = 'data:image/png;base64,GOMULU'; this.onload(); }
  };
  try {
    const geri = await inlineImagesForCapture(sahteKok([a, b]));
    assert.equal(a.src, 'data:image/png;base64,GOMULU', 'arma gömülmedi');
    assert.equal(b.src, 'data:image/png;base64,GOMULU', 'ikinci arma gömülmedi');
    geri();
    assert.equal(a.src, 'http://sunucu/api/crest?u=1', 'eski adres geri konmadı');
    assert.equal(b.src, 'http://sunucu/api/crest?u=2', 'eski adres geri konmadı');
  } finally {
    globalThis.fetch = eskiFetch;
    globalThis.FileReader = eskiReader;
  }
});

test('inmeyen arma yerine NÖTR simge konur — başka kulübün arması ASLA', async () => {
  const a = sahteImg('http://sunucu/api/crest?u=yok');
  const eskiFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, blob: async () => null });
  try {
    const geri = await inlineImagesForCapture(sahteKok([a]));
    // Kutu boş kalmaz ama başka bir adrese de bağlanmaz: yerine konan şey
    // GÖMÜLÜ (data:) ve nötr olmalıdır.
    assert.match(a.src, /^data:image\//, `inmeyen arma dış adrese bağlı kaldı: ${a.src}`);
    assert.ok(!/crest\?u=/.test(a.src), 'inmeyen arma hâlâ dış adresi gösteriyor');
    geri();
    assert.equal(a.src, 'http://sunucu/api/crest?u=yok', 'eski adres geri konmadı');
  } finally {
    globalThis.fetch = eskiFetch;
  }
});

test('zaten gömülü görsele dokunulmaz', async () => {
  const a = sahteImg('data:image/png;base64,ZATEN');
  const eskiFetch = globalThis.fetch;
  let cagrildi = false;
  globalThis.fetch = async () => { cagrildi = true; return { ok: false }; };
  try {
    const geri = await inlineImagesForCapture(sahteKok([a]));
    assert.equal(cagrildi, false, 'gömülü görsel için ağa çıkıldı');
    assert.equal(a.src, 'data:image/png;base64,ZATEN');
    geri();
    assert.equal(a.src, 'data:image/png;base64,ZATEN');
  } finally {
    globalThis.fetch = eskiFetch;
  }
});

/* ————————————————— 4) TARAYICI YOKKEN PATLAMAZ ————————————————— */

test('tarayıcı yokken (telefon / test) hiçbiri patlamaz', async () => {
  assert.equal(typeof (await inlineImagesForCapture(null)), 'function');
  assert.equal(typeof (await inlineImagesForCapture({})), 'function');
  // Geri alma işlevi çağrılabilir olmalı — çağıran finally'de koşulsuz çağırıyor.
  (await inlineImagesForCapture(null))();
  // document yoksa kare alınamaz; ÇÖKMEZ, null döner ve çağıran eski yola düşer.
  assert.equal(await capturePngDataUri({}), null);
  assert.equal(await capturePngDataUri(null), null);
  // Nötr simge de tuval isteyemez; boş yerine saydam PNG döner.
  assert.match(neutralCrestDataUri(), /^data:image\/png;base64,/);
});

// Kare kitaplığı fırlatabilir (tuval sınırı, izinsiz görselle "kirlenmiş" tuval).
// Fırlatma ÇAĞIRANA ULAŞIRSA paylaşım hata verir ve eski yol hiç denenmez —
// yani iyileştirme, çalışan özelliği bozar. Bu yüzden içeride yakalanmalı.
test('kare kitaplığı patlarsa hata yukarı sızmaz — eski yol denenebilir', () => {
  const govde = kodu(oku('src', 'studioShare.js'))
    .match(/export async function capturePngDataUri[\s\S]*?\n\}/);
  assert.ok(govde, 'capturePngDataUri bulunamadı');
  const kod = govde[0];
  assert.match(kod, /try\s*\{[\s\S]*?await h2c\(/, 'kitaplık çağrısı try içinde değil');
  assert.match(kod, /toDataURL[\s\S]{0,80}\}\s*catch/, 'toDataURL kirlenmiş tuvalde patlayabilir');
  assert.ok(
    (kod.match(/catch\s*\{\s*\n?\s*return null;/g) || []).length >= 2,
    'yakalanan hata null yerine yeniden fırlatılıyor',
  );
});

/* ————————————————— 5) EKRANLAR BU YOLU KULLANIYOR MU ————————————————— */

test('arma bileşeni adresi vekilden geçiriyor', () => {
  // (Yayın Stüdyosu kaldırıldı 2026-08-06; TeamCrest ortak parçalarda yaşıyor.)
  const kod = kodu(oku('src', 'screens', 'studioParts.js'));
  assert.match(kod, /crestUrlOf\(\s*uri\s*,\s*API_BASE\s*\)/, 'TeamCrest adresi vekilden geçirmiyor');
  // Ham adres doğrudan kullanılırsa arma yine kareye giremez.
  assert.ok(!/source=\{\{\s*uri\s*\}\}/.test(kod), 'TeamCrest hâlâ ham adresi kullanıyor');
  // Arma inmezse NÖTR simge kalmalı — kural ekranda da duruyor.
  assert.match(kod, /onError=\{\(\)\s*=>\s*setHata\(true\)\}/, 'arma hatası yakalanmıyor');
  assert.match(kod, /⚽/, 'nötr simge kaldırılmış');
});

// (Stüdyo bülten ekranının kare testi kaldırıldı — Yayın Stüdyosu silindi,
//  2026-08-06. Kupon paylaşımının kare/arma testleri aşağıda aynen duruyor.)

