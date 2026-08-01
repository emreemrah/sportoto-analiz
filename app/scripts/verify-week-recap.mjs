// HAFTA KAPANIŞI EKRAN DOĞRULAMASI — kaynağı değil, GERÇEK ÇIKTIYI denetler.
//
// Neden gerekli: bir ekranın rotaya bağlı olması, düğmesinin gerçekten oraya
// gitmesi ve VERİ YOKKEN sayı uydurmayıp dürüst mesaj vermesi ancak çalışan
// uygulamada ölçülebilir. Bu betik derlenmiş web çıktısını açar, Ana Sayfa'daki
// "Geçen Haftanın Kapanışı" düğmesine tıklar ve ekranda ne çıktığını raporlar.
//
// Kullanım:
//   node scripts/verify-week-recap.mjs                 # dist/ klasörünü açar
//   node scripts/verify-week-recap.mjs --url http://localhost:8081
//
// Yeni paket kurulmaz: ortamda hazır bulunan Chromium + playwright kullanılır.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// playwright ortamda GENEL kurulu (yeni paket kurulmaz) — ESM çözümlemesi
// bulamadığı için CJS require ile alınır.
const require_ = createRequire(import.meta.url);
const { chromium } = require_('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const DIST = path.join(APP, 'dist');

function arg(ad, varsayilan = '') {
  const i = process.argv.indexOf(`--${ad}`);
  return i > -1 ? process.argv[i + 1] : varsayilan;
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2',
};

function sunucuBaslat(kok) {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const u = decodeURIComponent((req.url || '/').split('?')[0]);
      let p = path.join(kok, u);
      if (!p.startsWith(kok)) { res.writeHead(403).end(); return; }
      if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(kok, 'index.html');
      if (!fs.existsSync(p)) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(res);
    });
    s.listen(0, '127.0.0.1', () => resolve({ s, url: `http://127.0.0.1:${s.address().port}/` }));
  });
}

const DURUSTLUK_IHLALI = [
  /kesin(likle)? (kazan|tut)/i, /garanti/i, /\bbanko\b/i, /yanılmaz/i,
];

// ——— YALNIZ DOĞRULAMA İÇİN SAHNE VERİSİ (--sahne) ———
// UYARI: bu veri UYGULAMAYA GİRMEZ. Yalnız bu betik çalışırken tarayıcıda
// ağ yanıtı taklit edilir ki ekranın DOLU hâli göz ile denetlenebilsin.
// Uygulamanın kendisi hiçbir zaman örnek kupon/sonuç üretmez.
const SAHNE_ROUNDS = {
  currentRoundId: 202, rounds: [{ id: 201, name: 'Test Hafta A', year: 2026 }, { id: 202, name: 'Test Hafta B', year: 2026 }],
};
const SAHNE_HISTORY = {
  roundId: 201,
  matches: [
    { no: 1, home: { name: 'Ev A' }, away: { name: 'Dep A' }, result: '1', score: { home: 2, away: 0 }, prediction: { symbol: '1' } },
    { no: 2, home: { name: 'Ev B' }, away: { name: 'Dep B' }, result: '2', score: { home: 0, away: 1 }, prediction: { symbol: '1' } },
    { no: 3, home: { name: 'Ev C' }, away: { name: 'Dep C' }, result: 'X', score: { home: 1, away: 1 }, prediction: { symbol: '10' } },
    { no: 4, home: { name: 'Ev D' }, away: { name: 'Dep D' }, result: '2', score: { home: 0, away: 3 }, prediction: { symbol: '1' } },
    { no: 5, home: { name: 'Ev E' }, away: { name: 'Dep E' }, result: null, score: null, prediction: { symbol: '1' } },
  ],
};
const SAHNE_KUPON = [{
  id: 'k_test_1', roundId: 201, couponNo: 1, schema: 2, isRankedCoupon: true,
  name: 'Test', createdAt: '2026-07-20T10:00:00.000Z', updatedAt: '2026-07-20T10:00:00.000Z',
  finalVersionId: 'v1',
  versions: [{
    id: 'v1', versionNo: 1, createdAt: '2026-07-20T10:00:00.000Z', columnCount: 2,
    selections: [
      { no: 1, selectedOutcomes: ['1'] }, { no: 2, selectedOutcomes: ['2'] },
      { no: 3, selectedOutcomes: ['1'] }, { no: 4, selectedOutcomes: ['1', 'X'] },
      { no: 5, selectedOutcomes: ['1'] },
    ],
  }],
}];

(async () => {
  const disUrl = arg('url', '');
  let srv = null;
  let url = disUrl;
  if (!url) {
    if (!fs.existsSync(DIST)) {
      console.error('HATA: dist/ yok. Önce: npx expo export --platform web');
      process.exit(1);
    }
    const r = await sunucuBaslat(DIST);
    srv = r.s; url = r.url;
  }

  const sahne = process.argv.includes('--sahne');
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });

  if (sahne) {
    // Kupon deposu localStorage'da — ekranın "SEN" sütunu ancak gerçek kupon
    // varsa dolar (uydurmaz). Doğrulama için depoya tek kupon konur.
    await page.addInitScript((k) => {
      try { localStorage.setItem('sportoto.couponCenter.v1', JSON.stringify(k)); } catch { /* yoksay */ }
    }, SAHNE_KUPON);
    await page.route('**/api/**', async (route) => {
      const u = route.request().url();
      if (/\/api\/rounds/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SAHNE_ROUNDS) });
      if (/\/api\/history\//.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SAHNE_HISTORY) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
  }

  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') hatalar.push(m.text()); });

  const bitir = async (kod, mesaj) => {
    if (mesaj) console.log(mesaj);
    await browser.close();
    if (srv) srv.close();
    process.exit(kod);
  };

  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);

  // 1) Ana Sayfa'da giriş düğmesi GERÇEKTEN var mı?
  const btn = page.getByText('Geçen Haftanın Kapanışı', { exact: false }).first();
  if (!(await btn.count())) {
    await page.screenshot({ path: path.join(APP, 'week-recap-fail.png') });
    await bitir(1, 'BAŞARISIZ: Ana Sayfa\'da "Geçen Haftanın Kapanışı" düğmesi bulunamadı.');
  }

  // 2) Düğme gerçekten Hafta Kapanışı ekranına götürüyor mu?
  await btn.click();
  await page.waitForTimeout(3000);
  const metin = (await page.evaluate(() => document.body.innerText)) || '';
  await page.screenshot({ path: path.join(APP, 'week-recap-screen.png'), fullPage: true });

  const acildi = /HAFTA KAPANIŞI|Hafta Kapanışı|hafta kapanışı/i.test(metin);

  // Sahne modunda ekranın DOLU hâli beklenir: karne + adil karşılaştırma +
  // öne çıkanlar. Beklenen sayı testlerdeki mantıkla aynı olmalı (2/4 · 2/4).
  if (sahne) {
    const beklenen = [
      [/SEN/, 'SEN sütunu'], [/SİSTEM/, 'SİSTEM sütunu'],
      [/Adil karşılaştırma/i, 'adil karşılaştırma kartı'],
      [/Haftanın Anları/i, 'öne çıkanlar bölümü'],
      [/4\/5 resmî sonuç/, 'resmî ilerleme sayacı'],
      [/berabere: ikiniz de 2\/4/i, 'dürüst başlık (2/4 · 2/4)'],
      [/Tüm Resmî Sonuçlar/i, 'resmî sonuç tablosu'],
      [/18 yaş altı/i, '18+ uyarısı'],
    ];
    const eksik = beklenen.filter(([r]) => !r.test(metin)).map(([, ad]) => ad);
    console.log('Sahne modu       : dolu ekran denetimi');
    console.log('Eksik parça      :', eksik.length ? eksik.join(', ') : 'yok');
    if (eksik.length) {
      console.log('İlk metin (tam)  :', metin.replace(/\s+/g, ' ').slice(0, 700));
      await bitir(1, 'BAŞARISIZ: hafta kapanışı ekranı dolu veriyle eksik render edildi.');
    }
    // Bekleyen maç (5 numaralı) tabloya YAZILMAMALI — resmî sonucu yok.
    if (/Ev E/.test(metin)) await bitir(1, 'BAŞARISIZ: resmî sonucu olmayan maç karneye girmiş.');
  }
  // Veri yokken bile ekran DÜRÜST bir şey söylemeli (hata ya da "sonuç yok").
  const durustBos = /resmî sonuç yok|açıklandıkça|alınamadı|Tekrar dene|bağlanılamadı|yüklenemedi/i.test(metin);

  console.log('--- HAFTA KAPANIŞI EKRANI ---');
  console.log('Adres            :', url);
  console.log('Ekran açıldı     :', acildi ? 'evet' : 'HAYIR');
  console.log('İlk metin        :', metin.replace(/\s+/g, ' ').slice(0, 220));
  console.log('Ekran görüntüsü  :', path.join(APP, 'week-recap-screen.png'));
  if (hatalar.length) console.log('Konsol hataları  :', hatalar.slice(0, 4).join(' | '));

  const ihlal = DURUSTLUK_IHLALI.find((r) => r.test(metin));
  if (ihlal) await bitir(1, `BAŞARISIZ: iddialı dil bulundu (${ihlal}).`);
  if (!acildi && !durustBos) {
    await bitir(1, 'BAŞARISIZ: ekran ne açıldı ne de dürüst bir boş/hata mesajı verdi.');
  }
  const kritikHata = hatalar.find((h) => /is not a function|undefined is not|Cannot read|Minified React error/i.test(h));
  if (kritikHata) await bitir(1, `BAŞARISIZ: çalışma anı hatası — ${kritikHata}`);

  await bitir(0, acildi
    ? 'BAŞARILI: düğme çalışıyor, Hafta Kapanışı ekranı açılıyor ve çalışma anı hatası yok.'
    : 'BAŞARILI (veri yok): ekran uydurma sayı üretmedi, dürüst mesaj gösterdi.');
})().catch((e) => { console.error('HATA:', e.message); process.exit(1); });
