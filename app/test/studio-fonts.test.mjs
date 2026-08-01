// YAYIN STÜDYOSU — YAZI TİPİ MODÜLÜ DENETİMİ.
//
// NEDEN KAYNAK TARAMASI: `src/studioFonts.js` hem `expo-font` hem de `.ttf`
// dosyalarını içe aktarır; `node --test` bunların hiçbirini yükleyemez
// (aynı sebeple ekran testleri de metin tarar, bkz. studio-screens.test.mjs).
// Bu yüzden aşağıdakiler dosya METNİNDEN doğrulanır.
//
// BU TEST NEYİ KANITLAR: kaynaktaki sözleşmelerin bozulmadığını —
//   • Font kesimleri paket KÖKÜNDEN alınmıyor (paket boyutu koruması).
//   • Yalnız kullandığımız 4 kesim gömülüyor, italik yok.
//   • İçe aktarılan her kesim expo-font haritasında, haritadaki her ad da
//     ağırlık tablosunda karşılığını buluyor (biri şaşarsa font SESSİZCE hiç
//     uygulanmaz — ekran çalışır ama hep sistem fontuyla çizilir).
//   • Font bir ÖNKOŞUL değil: hazır değilken boş stil dönüyor.
//
// BU TEST NEYİ KANITLAMAZ: fontun gerçek cihazda göründüğünü. Onu ancak
// telefon denemesi gösterir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const buDizin = dirname(fileURLToPath(import.meta.url));
const KAYNAK = readFileSync(join(buDizin, '..', 'src', 'studioFonts.js'), 'utf8');

const PAKET = '@expo-google-fonts/barlow-semi-condensed';
/** Stüdyonun kullandığı ağırlıklar → paket içindeki kesim klasörü. */
const KESIMLER = {
  400: '400Regular',
  500: '500Medium',
  600: '600SemiBold',
  700: '700Bold',
};

/** Dosyadaki tüm `import { X } from 'Y';` satırları. */
const ithal = [...KAYNAK.matchAll(/import\s*\{\s*([A-Za-z0-9_,\s]+?)\s*\}\s*from\s*'([^']+)'/g)]
  .map(([, adlar, yol]) => ({ adlar: adlar.split(',').map((s) => s.trim()).filter(Boolean), yol }));

const fontIthali = ithal.filter((i) => i.yol.startsWith(PAKET));

test('font kesimleri paket KÖKÜNDEN alınmıyor — 18 kesim birden gömülmesin', () => {
  // Paketin kökündeki index.js ailenin 18 kesimini de modül düzeyinde require
  // eder. Kökten TEK bir kesim istesen bile paketleyici 18 .ttf dosyasını
  // gömer (~1,8 MB). Kesim başına alt yolda yalnız 4 dosya girer (~400 KB).
  // Ölçüm: `expo export --platform android` → 18/18 varlık vs 4/4 varlık.
  const kokten = fontIthali.filter((i) => i.yol === PAKET);
  assert.deepEqual(
    kokten,
    [],
    `Font paketin kökünden içe aktarılmış (${kokten.map((k) => k.yol).join(', ')}). ` +
      `Kullanılmayan 14 kesim uygulamaya gömülür. Bunun yerine kesim alt yolunu kullan: '${PAKET}/700Bold'.`,
  );
});

test('tam olarak kullandığımız 4 kesim, kendi alt yolundan içe aktarılıyor', () => {
  const beklenen = Object.values(KESIMLER).map((k) => `${PAKET}/${k}`).sort();
  assert.deepEqual(fontIthali.map((i) => i.yol).sort(), beklenen);
});

test('italik kesim içe aktarılmıyor — ailede italik kullanılmıyor', () => {
  // Karar kaydı: stüdyo hiçbir yerde italik yazmaz. İtalik bir kesim buraya
  // sızarsa hem gereksiz ~100 KB gömülür hem de karar kaydıyla çelişir.
  const italik = fontIthali.filter((i) => /Italic/i.test(i.yol));
  assert.deepEqual(italik, [], 'İtalik kesim içe aktarılmış.');
});

test('içe aktarılan her kesim expo-font haritasında (STUDIO_FONT_MAP) var', () => {
  // Harita eksikse o kesim expo-font'a hiç verilmez; stilde adı yazsak bile
  // font YÜKLENMEZ ve ekran sessizce sistem fontuyla çizilir.
  const harita = KAYNAK.match(/export const STUDIO_FONT_MAP\s*=\s*\{([\s\S]*?)\}/);
  assert.ok(harita, 'STUDIO_FONT_MAP bulunamadı.');
  const haritaAnahtarlari = harita[1]
    .split(',')
    .map((s) => s.split(':')[0].trim())
    .filter(Boolean);

  const ithalEdilenler = fontIthali.flatMap((i) => i.adlar);
  assert.equal(ithalEdilenler.length, 4, 'Beklenen 4 kesim içe aktarılmadı.');
  for (const ad of ithalEdilenler) {
    assert.ok(haritaAnahtarlari.includes(ad), `${ad} STUDIO_FONT_MAP'e eklenmemiş.`);
  }
  assert.equal(haritaAnahtarlari.length, ithalEdilenler.length, 'Haritada fazladan/eksik ad var.');
});

test('ağırlık tablosundaki (AILE) her ad, yüklenen bir font adına eşit', () => {
  // AILE değeri STUDIO_FONT_MAP anahtarıyla harfi harfine aynı olmalı;
  // tek harflik fark = fontFamily hiçbir zaman tutmaz, hata da vermez.
  const tablo = KAYNAK.match(/const AILE\s*=\s*\{([\s\S]*?)\}/);
  assert.ok(tablo, 'AILE tablosu bulunamadı.');
  const satirlar = [...tablo[1].matchAll(/(\d{3})\s*:\s*'([^']+)'/g)].map((m) => [m[1], m[2]]);

  assert.deepEqual(
    satirlar.map(([a]) => a),
    Object.keys(KESIMLER),
    'AILE tablosunda beklenen ağırlıklar yok.',
  );
  const ithalEdilenler = new Set(fontIthali.flatMap((i) => i.adlar));
  for (const [agirlik, ad] of satirlar) {
    assert.ok(ithalEdilenler.has(ad), `AILE[${agirlik}] = "${ad}" yüklenen fontlar arasında yok.`);
    assert.ok(ad.endsWith(KESIMLER[agirlik]), `AILE[${agirlik}] yanlış kesime bakıyor: ${ad}`);
  }
});

test('font ÖNKOŞUL değil: hazır değilken boş stil dönüyor', () => {
  // Kural: uygulama fontu beklemez. `fontOf` hazır değilken {} döndürmeli ki
  // ekran sistem fontuyla hemen çizilsin, font gelince yeniden çizilsin.
  assert.match(
    KAYNAK,
    /export function fontOf\([^)]*\)\s*\{\s*\n\s*if \(!ready\) return \{\};/,
    'fontOf, font hazır değilken boş stil döndürmüyor.',
  );
  assert.match(KAYNAK, /useSyncExternalStore/, 'Font hazır olunca yeniden çizim aboneliği yok.');
});

test('font uygulanınca fontWeight sıfırlanıyor — sahte kalınlık olmasın', () => {
  // Aile zaten o ağırlıkta. Üstüne fontWeight bırakılırsa tarayıcı/işletim
  // sistemi sahte-kalın çizer, dar font bozulur.
  assert.match(KAYNAK, /fontFamily:\s*AILE\[weight\][^\n]*fontWeight:\s*'normal'/);
});

test('yeni paket eklenmemiş — yalnız onaylı iki bağımlılık', () => {
  const disaridan = ithal.map((i) => i.yol).filter((y) => !y.startsWith('.'));
  const izinli = new Set(['react', 'expo-font', ...Object.values(KESIMLER).map((k) => `${PAKET}/${k}`)]);
  for (const y of disaridan) {
    assert.ok(izinli.has(y), `Onaysız paket içe aktarılmış: ${y}`);
  }
});
