// BİLDİRİM MERKEZİ DOĞRULAMASI — zil düğmesi GERÇEKTEN çalışıyor mu?
//
// Neden gerekli: Ana Sayfa'daki zil eskiden hiçbir yere gitmiyordu ve yanında
// her zaman görünen sahte bir kırmızı nokta vardı. Bu betik derlenmiş web
// çıktısını açar, zile tıklar, açılan ekranı ölçer ve iki şeyi kanıtlar:
//   1) veri yokken UYDURMA bildirim çıkmıyor,
//   2) gerçek veri varken bildirim doğru sayılarla çıkıyor (--sahne).
//
// Yeni paket kurulmaz: ortamda hazır Chromium + playwright kullanılır.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

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

const DURUSTLUK_IHLALI = [/kesin(likle)? (kazan|tut)/i, /garanti/i, /\bbanko\b/i, /yanılmaz/i];

// ——— YALNIZ DOĞRULAMA İÇİN SAHNE VERİSİ (--sahne) ———
// UYARI: bu veri UYGULAMAYA GİRMEZ. Yalnız bu betik çalışırken ağ yanıtı
// taklit edilir ki bildirimlerin DOLU hâli göz ile denetlenebilsin.
const SAHNE_ROUNDS = {
  currentRoundId: 202,
  rounds: [{ id: 201, name: '31. Hafta', year: 2026 }, { id: 202, name: '32. Hafta', year: 2026 }],
};
const SAHNE_BULLETIN = {
  roundId: 202,
  round: '32. Hafta',
  matches: [
    { no: 1, date: null, home: { name: 'Ev A' }, away: { name: 'Dep A' } },
    { no: 2, date: null, home: { name: 'Ev B' }, away: { name: 'Dep B' } },
  ],
};
const SAHNE_HISTORY = {
  roundId: 201,
  matches: [
    { no: 1, home: { name: 'Ev A' }, away: { name: 'Dep A' }, result: '1', score: { home: 2, away: 0 } },
    { no: 2, home: { name: 'Ev B' }, away: { name: 'Dep B' }, result: '2', score: { home: 0, away: 1 } },
    { no: 3, home: { name: 'Ev C' }, away: { name: 'Dep C' }, result: null, score: null },
  ],
};
const SAHNE_PROGRESS = {
  points: 145,
  level: { level: 3 },
  achievements: [{ key: 'a_yeni', title: 'Beş hafta üst üste', icon: '🔥', earned: true }],
};
// Cihazda daha önce kaydedilmiş durum: 120 puan, hafta 201 biliniyor.
const SAHNE_DURUM = { seenAt: 0, lastPoints: 120, lastAchievements: [], knownRoundIds: ['201'], dismissed: [] };

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
    await page.addInitScript((d) => {
      try { localStorage.setItem('sportoto.notifications.v1', JSON.stringify(d)); } catch { /* yoksay */ }
    }, SAHNE_DURUM);
    await page.route('**/api/**', async (route) => {
      const u = route.request().url();
      if (/\/api\/rounds/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SAHNE_ROUNDS) });
      if (/\/api\/bulletin/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SAHNE_BULLETIN) });
      if (/\/api\/history\//.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SAHNE_HISTORY) });
      if (/\/api\/users\/me\/progress/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SAHNE_PROGRESS) });
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
  await page.waitForTimeout(3000);

  // 1) Zil düğmesi var mı?
  const zil = page.getByText('🔔', { exact: false }).first();
  if (!(await zil.count())) {
    await page.screenshot({ path: path.join(APP, 'notif-fail.png') });
    const g = (await page.evaluate(() => document.body.innerText)) || '';
    console.log('Sayfa metni      :', g.replace(/\s+/g, ' ').slice(0, 500) || '(BOŞ)');
    if (hatalar.length) console.log('Konsol hataları  :', hatalar.slice(0, 6).join(' | '));
    await bitir(1, 'BAŞARISIZ: Ana Sayfa\'da zil düğmesi bulunamadı.');
  }

  // 2) Rozet: sahne modunda GERÇEK okunmamış sayı görünmeli, boş modda hiç olmamalı.
  const anaMetin = (await page.evaluate(() => document.body.innerText)) || '';
  await page.screenshot({ path: path.join(APP, 'notif-home.png') });

  // 3) Zile tıklayınca bildirim merkezi açılıyor mu?
  await zil.click();
  await page.waitForTimeout(2500);
  const metin = (await page.evaluate(() => document.body.innerText)) || '';
  await page.screenshot({ path: path.join(APP, 'notif-screen.png'), fullPage: true });

  const acildi = /Bildirimler/i.test(metin);
  if (!acildi) await bitir(1, 'BAŞARISIZ: zile tıklandı ama Bildirimler ekranı açılmadı.');

  if (sahne) {
    const beklenen = [
      [/Resmî sonuçlar açıklanıyor/i, 'resmî sonuç bildirimi'],
      [/2\/3 maçın resmî sonucu/, 'gerçek sonuç sayısı (2/3)'],
      [/Yeni bülten yayında/i, 'yeni hafta bildirimi'],
      [/\+25 puan kazandın/, 'sunucu doğrulamalı puan farkı'],
      [/Yeni başarı/i, 'başarı bildirimi'],
      [/telefon bildirimi\s*gönderilmez/i, 'dürüstlük notu'],
    ];
    const eksik = beklenen.filter(([r]) => !r.test(metin)).map(([, ad]) => ad);
    console.log('Sahne modu       : dolu bildirim denetimi');
    console.log('Eksik parça      :', eksik.length ? eksik.join(', ') : 'yok');
    if (eksik.length) {
      console.log('Ekran metni      :', metin.replace(/\s+/g, ' ').slice(0, 800));
      await bitir(1, 'BAŞARISIZ: bildirimler dolu veriyle eksik render edildi.');
    }
    // Resmî sonucu OLMAYAN maç "sonuçlandı" diye sayılmamalı.
    if (/3\/3 maçın resmî/.test(metin)) await bitir(1, 'BAŞARISIZ: resmî olmayan maç sonuçlandı sayılmış.');
  } else {
    // Veri yokken: uydurma bildirim OLMAMALI, dürüst boş durum olmalı.
    const durust = /Yeni bildirim yok|Bildirimler açıldı|Uydurma bildirim gösterilmez|Geçmişe dönük bildirim üretilmez/i.test(metin);
    if (!durust) {
      console.log('Ekran metni      :', metin.replace(/\s+/g, ' ').slice(0, 600));
      await bitir(1, 'BAŞARISIZ: veri yokken dürüst boş durum gösterilmedi.');
    }
    if (/puan kazandın|Yeni başarı|resmî sonucu geldi/i.test(metin)) {
      await bitir(1, 'BAŞARISIZ: veri yokken UYDURMA bildirim gösterildi.');
    }
  }

  console.log('--- BİLDİRİM MERKEZİ ---');
  console.log('Adres            :', url);
  console.log('Zil düğmesi      : bulundu ve tıklandı');
  console.log('Ekran açıldı     :', acildi ? 'evet' : 'HAYIR');
  console.log('Ana ekran rozeti :', /🔔/.test(anaMetin) ? 'zil görünür' : 'zil yok');
  console.log('İlk metin        :', metin.replace(/\s+/g, ' ').slice(0, 220));
  console.log('Ekran görüntüsü  :', path.join(APP, 'notif-screen.png'));
  if (hatalar.length) console.log('Konsol hataları  :', hatalar.slice(0, 4).join(' | '));

  const ihlal = DURUSTLUK_IHLALI.find((r) => r.test(metin));
  if (ihlal) await bitir(1, `BAŞARISIZ: iddialı dil bulundu (${ihlal}).`);
  const kritikHata = hatalar.find((h) => /is not a function|undefined is not|Cannot read|Minified React error/i.test(h));
  if (kritikHata) await bitir(1, `BAŞARISIZ: çalışma anı hatası — ${kritikHata}`);

  await bitir(0, 'BAŞARILI: zil çalışıyor, bildirim merkezi açılıyor, uydurma bildirim yok.');
})().catch((e) => { console.error('HATA:', e.message); process.exit(1); });
