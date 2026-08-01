// YAYIN MODU DOĞRULAMASI — 📺 düğmesi gerçekten çalışıyor mu, ekran yayına
// çıkacak hâlde mi?
//
// Neden gerekli: bu ekranı canlı yayında on binlerce kişi görecek. Bu betik
// derlenmiş web çıktısını açar, Ana Sayfa'daki 📺 düğmesine basar ve şunları
// KANITLAR:
//   1) veri yokken UYDURMA slayt çıkmıyor (dürüst boş durum),
//   2) gerçek veri varken slaytlar doğru sayılarla çıkıyor (--sahne),
//   3) alt sekme çubuğu gizleniyor (OBS kadrajı temiz),
//   4) iddialı dil, ham etiket ve KİŞİSEL VERİ ekrana sızmıyor,
//   5) ileri/geri ve punto düğmeleri gerçekten çalışıyor.
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

const DURUSTLUK_IHLALI = [/kesin(likle)? (kazan|tut)/i, /garanti/i, /\bbanko\b/i, /yanılmaz/i, /net favori/i];

// ——— YALNIZ DOĞRULAMA İÇİN SAHNE VERİSİ (--sahne) ———
// UYARI: bu veri UYGULAMAYA GİRMEZ. Yalnız bu betik çalışırken ağ yanıtı
// taklit edilir ki slaytların DOLU hâli göz ile denetlenebilsin.
// Biçim gerçek /api/bulletin cevabıyla birebir aynı tutulmuştur.
const ILERI = () => new Date(Date.now() + 6 * 3600000).toISOString();
const GERI = () => new Date(Date.now() - 2 * 3600000).toISOString();

const analiz = (label, favSym, favPct, surprise, probs) => ({
  hasOdds: true, estimated: false, probabilities: probs, surpriseScore: surprise,
  label, labelColor: 'green', favorite: { symbol: favSym, percent: favPct },
  comment: 'Doğrulama sahnesi.', factors: [],
});

const SAHNE_BULLETIN = {
  roundId: 202,
  round: '32. Hafta',
  weekNumber: 32,
  season: '2025-2026',
  difficulty: { level: 'Zor', score: 68, text: 'Bu hafta çekişmeli maç sayısı yüksek.' },
  matches: [
    { no: 1, date: ILERI(), home: { name: 'Ev Bir' }, away: { name: 'Dep Bir' }, analysis: analiz('BANKO', '1', 74, 18, { 1: 74, X: 16, 2: 10 }) },
    { no: 2, date: ILERI(), home: { name: 'Ev İki' }, away: { name: 'Dep İki' }, analysis: analiz('BANKO', '2', 69, 22, { 1: 12, X: 19, 2: 69 }) },
    { no: 3, date: ILERI(), home: { name: 'Ev Üç' }, away: { name: 'Dep Üç' }, analysis: analiz('SÜRPRİZE AÇIK', '1', 37, 78, { 1: 37, X: 33, 2: 30 }) },
    { no: 4, date: ILERI(), home: { name: 'Ev Dört' }, away: { name: 'Dep Dört' }, analysis: analiz('SÜRPRİZE AÇIK', '2', 39, 71, { 1: 30, X: 31, 2: 39 }) },
    { no: 5, date: ILERI(), home: { name: 'Ev Beş' }, away: { name: 'Dep Beş' }, analysis: analiz('DİKKAT', '1', 41, 55, { 1: 41, X: 32, 2: 27 }) },
    // Başlamış maç: toplam sayıya girer ama ADAY listelerinde GÖRÜNMEMELİ.
    { no: 6, date: GERI(), home: { name: 'Ev Altı' }, away: { name: 'Dep Altı' }, analysis: analiz('BANKO', '1', 81, 12, { 1: 81, X: 11, 2: 8 }) },
  ],
};
const BOS_BULLETIN = { roundId: 202, round: '32. Hafta', weekNumber: 32, matches: [] };

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
  // Kadraj ölçüsü dışarıdan verilebilir: yayın 1280 genişlikte denetlenir ama
  // aynı ekranın dar telefonda (ör. 360px) da bozulmadığı görülmelidir.
  const GENISLIK = Number(arg('genislik', '1280')) || 1280;
  const YUKSEKLIK = Number(arg('yukseklik', '820')) || 820;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: GENISLIK, height: YUKSEKLIK } });

  await page.route('**/api/**', async (route) => {
    const u = route.request().url();
    if (/\/api\/bulletin/.test(u)) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(sahne ? SAHNE_BULLETIN : BOS_BULLETIN),
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') hatalar.push(m.text()); });

  const bitir = async (kod, mesaj) => {
    if (mesaj) console.log(mesaj);
    await browser.close();
    if (srv) srv.close();
    process.exit(kod);
  };
  const metin = () => page.evaluate(() => document.body.innerText || '');
  // Dar kadrajda alınan görüntüler geniş kadrajınkileri EZMESİN; yoksa iki ölçüyü
  // yan yana karşılaştırmak imkânsız olur.
  const EK = GENISLIK === 1280 ? '' : `-${GENISLIK}`;

  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  // 1) Ana Sayfa'da 📺 düğmesi var mı?
  const tv = page.getByText('📺', { exact: false }).first();
  if (!(await tv.count())) {
    await page.screenshot({ path: path.join(APP, 'broadcast-fail.png') });
    console.log('Sayfa metni :', (await metin()).replace(/\s+/g, ' ').slice(0, 500) || '(BOŞ)');
    if (hatalar.length) console.log('Konsol      :', hatalar.slice(0, 6).join(' | '));
    await bitir(1, 'BAŞARISIZ: Ana Sayfa\'da 📺 (Yayın Modu) düğmesi bulunamadı.');
  }
  await page.screenshot({ path: path.join(APP, `broadcast-home${EK}.png`) });

  // Sekme çubuğu ana sayfada GÖRÜNÜR olmalı (karşılaştırma için).
  const anaMetin = await metin();
  const sekmeAcik = /Kuponlarım/.test(anaMetin) && /Radar/.test(anaMetin);

  // 2) Yayın moduna gir.
  await tv.click();
  await page.waitForTimeout(2500);
  let ekran = await metin();
  if (!/YAYIN MODU/.test(ekran)) {
    await page.screenshot({ path: path.join(APP, 'broadcast-fail.png') });
    console.log('Ekran metni :', ekran.replace(/\s+/g, ' ').slice(0, 600));
    await bitir(1, 'BAŞARISIZ: 📺 tıklandı ama Yayın Modu açılmadı.');
  }

  // 3) Alt sekme çubuğu gizlendi mi? (OBS kadrajı temiz olmalı)
  const sekmeGizli = !/Kuponlarım/.test(ekran) && !/Ana Sayfa/.test(ekran);
  if (!sekmeGizli) {
    await page.screenshot({ path: path.join(APP, 'broadcast-fail.png') });
    await bitir(1, 'BAŞARISIZ: yayın modunda alt sekme çubuğu hâlâ görünüyor.');
  }

  // 3b) Ekran UÇTAN UCA mı? Yığın gövdesi web'de 1140px'te ortalanır; yayın
  //     modunda iki yanda açık renk şerit kalırsa OBS kadrajı bozulur.
  const kadraj = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="broadcast-root"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { sol: Math.round(r.left), genislik: Math.round(r.width), pencere: window.innerWidth };
  });
  if (!kadraj) await bitir(1, 'BAŞARISIZ: yayın ekranı kökü bulunamadı.');
  if (kadraj.sol > 2 || kadraj.genislik < kadraj.pencere - 2) {
    await page.screenshot({ path: path.join(APP, 'broadcast-fail.png') });
    await bitir(1, `BAŞARISIZ: ekran uçtan uca değil — yanlarda açık şerit kalıyor (sol ${kadraj.sol}px, genişlik ${kadraj.genislik}/${kadraj.pencere}).`);
  }

  // 4) Slaytları gez ve TÜM metni topla.
  const slaytlar = [];
  // Sayaç testID ile okunur: sayfada "68/100" (zorluk) gibi başka kesirler de
  // var, düz metin taraması yanlış slayt numarası okurdu.
  const sayacOku = async () => {
    const t = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="broadcast-counter"]');
      return el ? el.textContent : null;
    });
    const m = t && t.match(/^(\d+)\/(\d+)$/);
    return m ? { n: Number(m[1]), toplam: Number(m[2]) } : null;
  };

  if (sahne) {
    const ilk = await sayacOku();
    if (!ilk) await bitir(1, 'BAŞARISIZ: slayt sayacı bulunamadı.');
    if (ilk.n !== 1) await bitir(1, `BAŞARISIZ: yayın 1. slayttan başlamadı (${ilk.n}).`);

    for (let i = 0; i < ilk.toplam; i += 1) {
      slaytlar.push(await metin());
      await page.screenshot({ path: path.join(APP, `broadcast-slide-${i + 1}${EK}.png`) });
      if (i < ilk.toplam - 1) {
        await page.getByText('İleri ›', { exact: false }).first().click();
        await page.waitForTimeout(500);
      }
    }
    const son = await sayacOku();
    if (son.n !== ilk.toplam) await bitir(1, `BAŞARISIZ: "İleri" son slayta götürmedi (${son.n}/${ilk.toplam}).`);

    // Geri de çalışmalı.
    await page.getByText('‹ Geri', { exact: false }).first().click();
    await page.waitForTimeout(400);
    const geri = await sayacOku();
    if (geri.n !== ilk.toplam - 1) await bitir(1, 'BAŞARISIZ: "Geri" düğmesi slaytı geri almadı.');

    const hepsi = slaytlar.join('\n');

    // 4a) GERÇEK sayılar: 6 maç · 2 güçlü aday · 2 sürpriz (6 numara BAŞLAMIŞ).
    const beklenen = [
      [/6\s*\n?\s*Maç|6\s+Maç/, 'toplam maç sayısı (6)'],
      [/2 maç güçlü aday olarak işaretlendi/, 'güçlü aday slaytı'],
      [/2 maçta sürpriz ihtimali öne çıkıyor/, 'sürpriz slaytı'],
      [/1 maç başladığı için/, 'başlamış maç uyarısı'],
      [/Ev Bir - Dep Bir/, 'gerçek takım satırı'],
      [/32\. Hafta/, 'hafta başlığı'],
      [/2025-2026 Sezonu/, 'sezon'],
      [/18 yaş altı kullanamaz/, 'kapanış yasal metni'],
    ];
    const eksik = beklenen.filter(([r]) => !r.test(hepsi)).map(([, ad]) => ad);
    console.log('Sahne modu  : dolu slayt denetimi');
    console.log('Slayt sayısı:', ilk.toplam);
    console.log('Eksik parça :', eksik.length ? eksik.join(', ') : 'yok');
    if (eksik.length) {
      console.log('Toplu metin :', hepsi.replace(/\s+/g, ' ').slice(0, 1200));
      await bitir(1, 'BAŞARISIZ: slaytlar gerçek veriyle eksik render edildi.');
    }

    // 4b) BAŞLAMIŞ maç aday olarak GÖSTERİLMEMELİ.
    if (/Ev Altı - Dep Altı/.test(hepsi)) {
      await bitir(1, 'BAŞARISIZ: başlamış maç aday listesinde gösterildi.');
    }

    // 4c) Ham etiket sızmamalı.
    if (/BANKO/.test(hepsi)) await bitir(1, 'BAŞARISIZ: ham "BANKO" anahtarı ekrana çıktı.');
    if (!/GÜÇLÜ ADAY/.test(hepsi)) await bitir(1, 'BAŞARISIZ: sözlükten geçmiş etiket görünmüyor.');

    // 4d) Punto düğmesi GERÇEKTEN büyütüyor mu?
    const baslikPx = () => page.evaluate(() => {
      const el = document.querySelector('[data-testid="broadcast-title"]');
      return el ? parseFloat(getComputedStyle(el).fontSize) : 0;
    });
    const once = await baslikPx();
    await page.getByText('A+', { exact: false }).first().click();
    await page.waitForTimeout(350);
    const sonra = await baslikPx();
    if (!(sonra > once)) {
      await bitir(1, `BAŞARISIZ: A+ punto büyütmedi (${once} → ${sonra}).`);
    }
    console.log('Punto A+    :', `${once}px → ${sonra}px`);
  } else {
    // BOŞ MOD: uydurma slayt OLMAMALI.
    slaytlar.push(ekran);
    await page.screenshot({ path: path.join(APP, `broadcast-empty${EK}.png`), fullPage: true });
    if (!/Gösterilecek analiz yok/.test(ekran)) {
      console.log('Ekran metni :', ekran.replace(/\s+/g, ' ').slice(0, 600));
      await bitir(1, 'BAŞARISIZ: veri yokken dürüst boş durum gösterilmedi.');
    }
    if (/güçlü aday olarak işaretlendi|sürpriz ihtimali öne çıkıyor|Denk/.test(ekran)) {
      await bitir(1, 'BAŞARISIZ: veri yokken UYDURMA slayt gösterildi.');
    }
    if (await sayacOku()) {
      await bitir(1, 'BAŞARISIZ: slayt yokken sayaç gösterildi.');
    }
  }

  const toplu = slaytlar.join('\n');

  // 5) KİŞİSEL VERİ sızıntısı — bu ekranı on binlerce kişi görüyor.
  for (const sizinti of [/@[\w.-]+\.(com|net|org)/i, /eyJ[A-Za-z0-9_-]{6,}/, /\b0?5\d{9}\b/]) {
    if (sizinti.test(toplu)) await bitir(1, `BAŞARISIZ: yayın ekranında kişisel veri deseni bulundu (${sizinti}).`);
  }

  // 6) İddialı dil.
  const ihlal = DURUSTLUK_IHLALI.find((r) => r.test(toplu));
  if (ihlal) await bitir(1, `BAŞARISIZ: iddialı dil bulundu (${ihlal}).`);

  // 7) Çıkış GERÇEKTEN çalışıyor mu? (yayında kilitli kalmak felaket)
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1500);
  const cikisMetni = await metin();
  const cikti = !/YAYIN MODU/.test(cikisMetni);
  if (!cikti) {
    await page.getByText('✕', { exact: false }).first().click();
    await page.waitForTimeout(1200);
  }
  const sonMetin = await metin();
  if (/YAYIN MODU/.test(sonMetin)) await bitir(1, 'BAŞARISIZ: yayın modundan çıkılamadı.');
  const sekmeGeriGeldi = /Kuponlarım/.test(sonMetin);
  if (!sekmeGeriGeldi) await bitir(1, 'BAŞARISIZ: çıkışta alt sekme çubuğu geri gelmedi.');

  console.log('--- YAYIN MODU ---');
  console.log('Adres           :', url);
  console.log('📺 düğmesi      : bulundu ve tıklandı');
  console.log('Yayın modu      : açıldı');
  console.log('Ana sayfa sekme :', sekmeAcik ? 'görünür' : 'GÖRÜNMÜYOR');
  console.log('Yayında sekme   : gizli ✔');
  console.log('Kadraj          :', `uçtan uca ${kadraj.genislik}/${kadraj.pencere}px ✔`);
  console.log('Esc ile çıkış   :', cikti ? 'çalıştı' : '✕ ile çıkıldı');
  console.log('Sekme geri geldi: evet ✔');
  console.log('Ekran görüntüsü :', path.join(APP, sahne ? `broadcast-slide-1${EK}.png` : `broadcast-empty${EK}.png`));
  if (hatalar.length) console.log('Konsol hataları :', hatalar.slice(0, 4).join(' | '));

  const kritikHata = hatalar.find((h) => /is not a function|undefined is not|Cannot read|Minified React error/i.test(h));
  if (kritikHata) await bitir(1, `BAŞARISIZ: çalışma anı hatası — ${kritikHata}`);

  await bitir(0, sahne
    ? 'BAŞARILI: yayın modu gerçek veriyle çalışıyor, sekme gizleniyor, uydurma/sızıntı yok.'
    : 'BAŞARILI: veri yokken uydurma slayt üretilmiyor, dürüst boş durum gösteriliyor.');
})().catch((e) => { console.error('HATA:', e.message); process.exit(1); });
