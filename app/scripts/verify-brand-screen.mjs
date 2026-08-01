// ÇALIŞAN EKRAN DOĞRULAMASI — kaynak kodu değil, GERÇEK ÇIKTIYI denetler.
//
// Neden gerekli: kaynakta doğru olan bir marka metni, eski paket (bundle),
// önbellek veya çalışma anında ezilen bir başlık yüzünden ekranda yanlış
// görünebilir. Bu betik derlenmiş web çıktısını gerçek bir tarayıcıda açar ve
// iki şeyi ölçer:
//
//   1) Tarayıcı sekmesi başlığı  (document.title)
//   2) Ana Sayfa sol üst başlığı (ekrandaki ilk marka metni)
//
// Kullanım:
//   node scripts/verify-brand-screen.mjs                 # dist/ klasörünü açar
//   node scripts/verify-brand-screen.mjs --url http://localhost:8081
//
// Yeni paket kurulmaz: yalnız Node'un kendi modülleri ve ortamda hazır bulunan
// Chromium ikili dosyası kullanılır.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');

const BEKLENEN = 'Sportoto Master Analiz';
const YASAK = [
  /Spor[\s\-_]+Toto[\s\-_]+(Master[\s\-_]+)?Analiz/i,
  /Spor[\s\-_]+Toto[\s\-_]+Master/i,
  /Sportoto[\s\-_]+Analiz/i,
  /\bAnalizTab\b/,
];

function arg(ad, varsayilan = '') {
  const i = process.argv.indexOf(`--${ad}`);
  return i > -1 ? process.argv[i + 1] : varsayilan;
}

function chromiumBul() {
  const adaylar = [
    process.env.CHROMIUM_PATH,
    // headless_shell, --dump-dom çıktısını güvenilir biçimde stdout'a verir.
    '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ].filter(Boolean);
  for (const a of adaylar) if (fs.existsSync(a)) return a;
  const g = spawnSync(
    'bash',
    ['-lc', 'ls /opt/pw-browsers/*/chrome-linux/headless_shell /opt/pw-browsers/*/chrome-linux/chrome 2>/dev/null | head -1'],
    { encoding: 'utf8' },
  );
  const bulunan = (g.stdout || '').trim();
  if (bulunan && fs.existsSync(bulunan)) return bulunan;
  return null;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

function sunucuBaslat(kok) {
  return new Promise((res) => {
    const s = http.createServer((req, r) => {
      const temiz = decodeURIComponent((req.url || '/').split('?')[0]);
      let dosya = path.join(kok, temiz);
      if (!dosya.startsWith(kok)) return r.writeHead(403).end();
      if (!fs.existsSync(dosya) || fs.statSync(dosya).isDirectory()) {
        const idx = path.join(dosya, 'index.html');
        dosya = fs.existsSync(idx) ? idx : path.join(kok, 'index.html'); // SPA geri dönüşü
      }
      if (!fs.existsSync(dosya)) return r.writeHead(404).end('yok');
      r.writeHead(200, {
        'Content-Type': MIME[path.extname(dosya).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store', // eski paket asla servis edilmesin
      });
      fs.createReadStream(dosya).pipe(r);
    });
    s.listen(0, '127.0.0.1', () => res(s));
  });
}

function metneCevir(dom) {
  return dom
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const chrome = chromiumBul();
  if (!chrome) {
    console.error('HATA: Chromium bulunamadı. CHROMIUM_PATH ile yol verilebilir.');
    process.exit(2);
  }

  let url = arg('url', '');
  let sunucu = null;
  if (!url) {
    const dist = path.resolve(APP, arg('dist', 'dist'));
    if (!fs.existsSync(path.join(dist, 'index.html'))) {
      console.error(`HATA: ${dist}/index.html yok. Önce: npx expo export --platform web`);
      process.exit(2);
    }
    sunucu = await sunucuBaslat(dist);
    url = `http://127.0.0.1:${sunucu.address().port}/`;
  }

  const gecici = fs.mkdtempSync(path.join(os.tmpdir(), 'marka-'));
  const ekran = path.join(APP, 'brand-screen.png');

  const headlessShell = /headless_shell$/.test(chrome);
  // ÖNEMLİ: spawnSync kullanılamaz — Node'un olay döngüsünü bloklar ve yukarıda
  // açılan statik sunucu isteklere cevap veremez (tarayıcı boş sayfa görür).
  const r = await new Promise((res) => {
    const ps = spawn(
      chrome,
      [
        ...(headlessShell ? [] : ['--headless=old']),
        '--no-sandbox',
        '--disable-gpu',
        '--hide-scrollbars',
        '--window-size=1280,900',
        `--user-data-dir=${gecici}`,
        '--virtual-time-budget=25000',
        `--screenshot=${ekran}`,
        '--dump-dom',
        url,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let out = '';
    let err = '';
    ps.stdout.on('data', (d) => (out += d));
    ps.stderr.on('data', (d) => (err += d));
    const zamanAsimi = setTimeout(() => ps.kill('SIGKILL'), 120000);
    ps.on('close', () => {
      clearTimeout(zamanAsimi);
      res({ stdout: out, stderr: err });
    });
  });

  if (sunucu) sunucu.close();

  const dom = r.stdout || '';
  if (!dom.trim()) {
    console.error('HATA: tarayıcı boş DOM döndürdü.');
    console.error((r.stderr || '').slice(0, 2000));
    process.exit(2);
  }

  const sekme = (dom.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
  const govde = metneCevir(dom.match(/<body[\s\S]*<\/body>/i)?.[0] || dom);
  const ilk = govde.slice(0, 400);

  const hatalar = [];
  if (sekme !== BEKLENEN) hatalar.push(`Tarayıcı sekmesi: "${sekme}" (beklenen "${BEKLENEN}")`);
  if (!ilk.includes(BEKLENEN)) {
    hatalar.push(`Ekranın üst bölümünde marka adı yok. İlk metin: "${ilk.slice(0, 160)}"`);
  }
  for (const y of YASAK) {
    const m = govde.match(y);
    if (m) hatalar.push(`Ekranda eski marka/route adı görünüyor: "${m[0]}"`);
  }

  console.log('--- ÇALIŞAN EKRAN ---');
  console.log('Adres          :', url);
  console.log('Sekme başlığı  :', JSON.stringify(sekme));
  console.log('Ekran ilk metin:', JSON.stringify(ilk.slice(0, 120)));
  console.log('Ekran görüntüsü:', fs.existsSync(ekran) ? ekran : '(alınamadı)');

  if (hatalar.length) {
    console.error('\nBAŞARISIZ:');
    for (const h of hatalar) console.error('  •', h);
    process.exit(1);
  }
  console.log('\nBAŞARILI: sekme başlığı ve ekran başlığı tek marka kaynağıyla uyumlu.');
}

main().catch((e) => {
  console.error('HATA:', e?.message || e);
  process.exit(2);
});
