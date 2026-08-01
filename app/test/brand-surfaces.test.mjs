// MARKA YÜZEYİ TESTİ — kullanıcıya görünen her yüzeyin tek marka kaynağından
// beslendiğini kanıtlar.
//
// NEDEN AYRI BİR TEST DOSYASI:
// Önceki marka taraması düz metin araması yapıyordu ("Spor Toto Analiz" gibi
// tam dizgeyi arıyordu). Ekranda görünen metin JSX içinde PARÇALI üretildiğinde
// bu arama kördür:
//
//     Spor Toto <Text style={styles.brandAccent}>Analiz</Text>
//
// Burada "Spor Toto " ile "Analiz" arasında ~38 karakter JSX işaretlemesi var;
// hiçbir tam-dizge araması bunu bulamaz. Bu test, kaynağı önce DÜZLEŞTİRİR
// (yorumları ve JSX etiketlerini boşluğa çevirir), sonra arar. Böylece parçalı
// metin de yakalanır.
//
// Test ayrıca web'de tarayıcı sekmesi başlığını (document.title) üreten
// mekanizmayı da denetler: React Navigation, documentTitle verilmezse odaktaki
// route'un ADINI ("Home", "AnalizTab") sekmeye yazar ve app.json'daki web.name
// ayarını ezer.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');

const oku = (p) => readFileSync(path.join(APP, p), 'utf8');

// ---------------------------------------------------------------------------
// Düzleştirici: kaynağı "ekranda ne okunur" hâline yaklaştırır.
// ---------------------------------------------------------------------------
export function duzlestir(kaynak) {
  return String(kaynak)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')       // blok yorum
    .replace(/^\s*\/\/.*$/gm, ' ')            // satır yorum
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ')      // JSX etiketleri
    .replace(/[{}]/g, ' ')                    // JSX ifade parantezleri
    .replace(/\s+/g, ' ');
}

// Kullanıcıya asla görünmemesi gereken marka kalıpları.
// DİKKAT: Tek başına "Spor Toto" YASAK DEĞİLDİR — resmî bültene/sonuca atıf
// yapan dürüst cümlelerde geçer ("resmî Spor Toto 90 dk sonucu"). Yasak olan,
// bu ifadenin UYGULAMA ADI gibi kullanılmasıdır.
const YASAK_MARKA = [
  { ad: 'Spor Toto Analiz', re: /Spor[\s\-_]+Toto[\s\-_]+(Master[\s\-_]+)?Analiz/i },
  { ad: 'Spor Toto Master', re: /Spor[\s\-_]+Toto[\s\-_]+Master/i },
  { ad: 'Sportoto Analiz (Master yok)', re: /Sportoto[\s\-_]+Analiz/i },
];

function kaynakDosyalari(kok) {
  const cikan = [];
  const gez = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.expo' || e.name === 'dist') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) gez(p);
      else if (/\.(js|jsx|mjs|json)$/.test(e.name)) cikan.push(p);
    }
  };
  gez(path.join(APP, kok));
  return cikan;
}

// Kullanıcıya görünen yüzeyler: src/ + giriş dosyaları + expo yapılandırması.
// test/ taranmaz (kullanıcıya görünmez ve kalıpların kendisini içerir).
const YUZEYLER = [
  ...kaynakDosyalari('src'),
  path.join(APP, 'App.js'),
  path.join(APP, 'index.js'),
  path.join(APP, 'app.json'),
].filter((p) => existsSync(p));

// ---------------------------------------------------------------------------

test('marka kaynağı: satır kırımları tam addan türetilir ve ayrışamaz', async () => {
  const b = await import('../src/brand.js');
  assert.equal(b.APP_NAME, 'Sportoto Master Analiz');
  assert.equal(
    `${b.BRAND_LINE_1} ${b.BRAND_LINE_2}`,
    b.APP_NAME,
    'BRAND_LINE_1 + BRAND_LINE_2 tam marka adını vermiyor — parçalı gösterim tam addan ayrışmış',
  );
  assert.equal(b.brandLinesJoin(), b.APP_NAME);
  assert.equal(b.APP_NAME_UPPER, b.APP_NAME.toLocaleUpperCase('tr-TR'));

  // Satırlar elle yazılmamalı; APP_NAME'den türetilmeli.
  const kaynak = oku('src/brand.js');
  assert.ok(
    /BRAND_LINE_1\s*=\s*_BRAND_PARTS\[0\]/.test(kaynak),
    'BRAND_LINE_1 elle yazılmış — ad değişince sessizce eskir',
  );
  assert.ok(
    /BRAND_LINE_2\s*=\s*_BRAND_PARTS\.slice\(1\)/.test(kaynak),
    'BRAND_LINE_2 elle yazılmış — ad değişince sessizce eskir',
  );
});

test('dedektör kendi kendini sınar: parçalı JSX metni gerçekten yakalanıyor', () => {
  // Cihazda gerçekten bulunan hatalı satırın birebir kopyası.
  const hataliSatir = 'Spor Toto <Text style={styles.brandAccent}>Analiz</Text>';

  // 1) Düz metin araması KÖR: eski taramanın neden kaçırdığının kanıtı.
  assert.equal(
    hataliSatir.includes('Spor Toto Analiz'),
    false,
    'düz metin araması bu satırı bulamaz — testin varsayımı bu',
  );

  // 2) Düzleştirilmiş arama YAKALAR.
  const duz = duzlestir(hataliSatir);
  assert.ok(
    YASAK_MARKA.some((y) => y.re.test(duz)),
    'düzleştirici parçalı marka metnini yakalayamıyor — dedektör işlevsiz',
  );

  // 3) Doğru kullanım temiz kalmalı (yanlış alarm olmamalı).
  const dogruSatir = '{BRAND_LINE_1} <Text style={styles.brandAccent}>{BRAND_LINE_2}</Text>';
  assert.ok(
    !YASAK_MARKA.some((y) => y.re.test(duzlestir(dogruSatir))),
    'merkezî kaynaktan beslenen satır yanlışlıkla yasak sayılıyor',
  );

  // 4) Resmî bültene atıf serbest kalmalı.
  const dogruAtif = "<Text>resmî Spor Toto 90 dk sonucu kesindir</Text>";
  assert.ok(
    !YASAK_MARKA.some((y) => y.re.test(duzlestir(dogruAtif))),
    'resmî kaynağa dürüst atıf yanlışlıkla yasak sayılıyor',
  );
});

test('parçalı JSX dahil: hiçbir kullanıcı yüzeyinde eski marka adı yok', () => {
  const bulgular = [];
  for (const dosya of YUZEYLER) {
    const duz = duzlestir(readFileSync(dosya, 'utf8'));
    for (const y of YASAK_MARKA) {
      const m = duz.match(y.re);
      if (m) {
        bulgular.push(
          `${path.relative(APP, dosya)} → "${m[0]}" (${y.ad})\n    …${duz
            .slice(Math.max(0, m.index - 60), m.index + 80)
            .trim()}…`,
        );
      }
    }
  }
  assert.deepEqual(bulgular, [], `Eski marka adı bulundu:\n  ${bulgular.join('\n  ')}`);
});

test('Ana Sayfa başlığı merkezî kaynaktan gelir, sabit metin veya görsel değildir', () => {
  const kaynak = oku('src/screens/HomeScreen.js');

  assert.ok(
    /import\s*\{[^}]*BRAND_LINE_1[^}]*BRAND_LINE_2[^}]*\}\s*from\s*'\.\.\/brand'/.test(kaynak),
    "HomeScreen marka satırlarını '../brand' dosyasından almıyor",
  );

  // Başlık bloğu: styles.brand kullanan Text öğesi.
  const i = kaynak.indexOf('styles.brand}');
  assert.ok(i > -1, 'Ana Sayfa başlık bloğu (styles.brand) bulunamadı');
  const blok = kaynak.slice(i, i + 400);

  assert.ok(blok.includes('{BRAND_LINE_1}'), 'başlıkta BRAND_LINE_1 kullanılmıyor');
  assert.ok(blok.includes('{BRAND_LINE_2}'), 'başlıkta BRAND_LINE_2 kullanılmıyor');

  // Marka metni görsele/SVG'ye gömülmemeli — gömülürse hiçbir metin taraması
  // onu bir daha göremez.
  assert.ok(!/<Image/.test(blok), 'marka başlığı görsele gömülmüş — metin taraması kör kalır');
  assert.ok(!/<Svg/.test(blok), 'marka başlığı SVG içine gömülmüş — metin taraması kör kalır');

  // Başlıkta elle yazılmış marka dizgesi olmamalı.
  assert.ok(
    !/['"][^'"]*Analiz[^'"]*['"]/.test(blok),
    'Ana Sayfa başlığında elle yazılmış marka metni var',
  );
});

test('tarayıcı sekmesi: NavigationContainer başlığı merkezî kaynaktan yazar', () => {
  const kaynak = oku('App.js');

  assert.ok(
    /import\s*\{[^}]*\bAPP_NAME\b[^}]*\}\s*from\s*'\.\/src\/brand'/.test(kaynak),
    "App.js, APP_NAME'i merkezî marka kaynağından almıyor",
  );

  // DİKKAT: `[^>]*` kullanılamaz — `() => APP_NAME` içindeki `>` erken keser.
  const i = kaynak.indexOf('<NavigationContainer');
  assert.ok(i > -1, 'NavigationContainer bulunamadı');
  const m = [kaynak.slice(i, i + 300).split('\n').slice(0, 3).join('\n')];
  assert.ok(
    /documentTitle=\{\{\s*formatter:\s*\(\s*\)\s*=>\s*APP_NAME\s*\}\}/.test(m[0]),
    'NavigationContainer documentTitle vermiyor — React Navigation route ADINI ' +
      '(ör. "Home") tarayıcı sekmesine yazar ve app.json web.name ayarını ezer',
  );

  // Biçimlendirici PARAMETRE ALMAMALI: parametre alırsa route adı/başlığı
  // sekmeye sızabilir.
  const bicim = m[0].match(/formatter:\s*\(([^)]*)\)/);
  assert.equal((bicim?.[1] || '').trim(), '', 'documentTitle biçimlendiricisi route bilgisi alıyor — ad sızabilir');
});

test('route ve sekme adları kullanıcıya sızmıyor', () => {
  const kaynak = oku('App.js');

  // Statik web başlığı da doğru olmalı (ilk yüklemede kısa süre görünür).
  const appJson = JSON.parse(oku('app.json'));
  assert.equal(appJson.expo.name, 'Sportoto Master Analiz');
  assert.equal(appJson.expo.web.name, 'Sportoto Master Analiz');

  // Route adları İngilizce/teknik olabilir; ama hiçbiri kullanıcıya gösterilen
  // bir başlık/etiket DEĞERİ olarak kullanılmamalı.
  const routeAdlari = [...kaynak.matchAll(/Screen\s+name="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(routeAdlari.length > 10, 'route adları okunamadı');

  const gorunenler = [
    ...kaynak.matchAll(/\btitle:\s*'([^']*)'/g),
    ...kaynak.matchAll(/\btabBarLabel:\s*'([^']*)'/g),
  ].map((m) => m[1]);

  for (const metin of gorunenler) {
    assert.ok(
      !routeAdlari.includes(metin),
      `kullanıcıya görünen başlık route adıyla aynı: "${metin}"`,
    );
    assert.ok(
      !/^[A-Za-z]+Tab$/.test(metin),
      `kullanıcıya görünen başlık teknik sekme adı: "${metin}"`,
    );
    assert.ok(
      !/^(Home|Bulletin|Profile|Login|Register|Forum|Leaderboard)$/.test(metin),
      `kullanıcıya görünen başlık İngilizce route adı: "${metin}"`,
    );
  }
});

test('marka metni görsel/SVG dosyalarına gömülmemiş', () => {
  // Metin içeren varlık dosyaları (svg) taranır.
  const varliklar = [];
  const gez = (d) => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) gez(p);
      else if (/\.svg$/i.test(e.name)) varliklar.push(p);
    }
  };
  gez(path.join(APP, 'assets'));

  for (const v of varliklar) {
    const metin = readFileSync(v, 'utf8');
    for (const y of YASAK_MARKA) {
      assert.ok(!y.re.test(metin), `${path.relative(APP, v)} içinde eski marka metni var (${y.ad})`);
    }
  }

  // Kod içindeki react-native-svg <Text>/<TSpan> öğelerinde de elle marka
  // yazılmamalı.
  for (const dosya of YUZEYLER) {
    if (!/\.jsx?$/.test(dosya)) continue;
    const metin = readFileSync(dosya, 'utf8');
    if (!/react-native-svg/.test(metin)) continue;
    const duz = duzlestir(metin);
    for (const y of YASAK_MARKA) {
      assert.ok(
        !y.re.test(duz),
        `${path.relative(APP, dosya)} — SVG bileşeninde eski marka metni (${y.ad})`,
      );
    }
  }
});

// Atlama koşulu `dist` klasörüne değil OKUNAN DOSYAYA bakar: yarım kalmış bir
// export'ta (dist var, index.html yok) klasör kontrolü testi ENOENT ile kırıyordu
// — marka hatası olmadığı hâlde. `npx expo export` sonrası test kendiliğinden
// tekrar çalışır.
test('derlenmiş web çıktısı: sekme başlığı ve paket temiz', { skip: !existsSync(path.join(APP, 'dist', 'index.html')) }, () => {
  const html = oku('dist/index.html');
  const baslik = html.match(/<title>([^<]*)<\/title>/)?.[1];
  assert.equal(baslik, 'Sportoto Master Analiz', 'derlenmiş index.html sekme başlığı yanlış');

  const jsDir = path.join(APP, 'dist', '_expo', 'static', 'js', 'web');
  if (!existsSync(jsDir)) return;
  const paketler = readdirSync(jsDir).filter((f) => f.endsWith('.js'));
  assert.ok(paketler.length > 0, 'web paketi bulunamadı');

  let markaVar = false;
  for (const p of paketler) {
    const icerik = readFileSync(path.join(jsDir, p), 'utf8');
    if (icerik.includes('Sportoto Master Analiz')) markaVar = true;
    for (const y of YASAK_MARKA) {
      const m = duzlestir(icerik).match(y.re);
      assert.ok(!m, `web paketinde eski marka metni: "${m?.[0]}" (${y.ad})`);
    }
  }
  assert.ok(markaVar, 'web paketinde marka adı hiç geçmiyor — derleme eski olabilir');
});
