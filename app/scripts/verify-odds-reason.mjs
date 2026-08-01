/**
 * GERÇEK ÇİZİM DENETİMİ — Radar 4 "Oran Takibi": EKSİK ORANIN SEBEBİ.
 *
 * NEDEN: test/radar-odds-reason.test.mjs dosyanın NE YAZDIĞINI korur; bu betik
 * tarayıcıyı gerçekten açar ve ekranın NE ÇİZDİĞİNE bakar. Bileşen mount olurken
 * patlarsa bundle yine 200 döner — orada yakalanmaz, burada yakalanır.
 *
 * BU BİR BİRİM TESTİ DEĞİLDİR: `npm test` test/ altını toplar, bu yüzden dosya
 * scripts/ altındadır. Elle çalıştırılır:
 *   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/verify-odds-reason.mjs
 * Gerekli: Expo web :8081 ve backend :4000 ayakta olmalı.
 *
 * DÜRÜSTLÜK NOTU: burada geçmesi GERÇEK ANDROID CİHAZDA geçtiği anlamına GELMEZ.
 * Yalnız web çiziminin ayakta olduğunu gösterir.
 */
import { mkdir } from 'node:fs/promises';

const PW = process.env.PLAYWRIGHT_PKG || '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const pw = await import(PW);
const { chromium } = pw.chromium ? pw : pw.default;

const WEB = 'http://localhost:8081';
const OUT = new URL('../.render/', import.meta.url).pathname;

const adimlar = [];
const not = (ok, ad, ek = '') => { adimlar.push({ ok, ad, ek }); console.log(`${ok ? 'OK  ' : 'HATA'} ${ad}${ek ? ' — ' + ek : ''}`); };

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 430, height: 1400 } });

const jsHatalar = [];
page.on('pageerror', (e) => jsHatalar.push(String(e)));

try {
  await page.goto(WEB, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(9000);

  await page.click('a[href="/AnalizTab"][role="tab"]');
  await page.waitForTimeout(5000);

  // Radar 4 sekmesi: "Oran Takibi".
  const sekme = page.getByText(/Oran Takibi/i).first();
  await sekme.click();
  await page.waitForTimeout(4000);

  await page.screenshot({ path: OUT + 'radar4-oran-sebep.png', fullPage: true });

  const metin = await page.evaluate(() => document.body.innerText);

  // 1) SAYAÇ çiziliyor mu?
  not(/maçın \d+'inde oran var/.test(metin), 'sayaç çiziliyor', (metin.match(/[^\n]*maçın \d+'inde oran var[^\n]*/) || [''])[0].trim());

  // 2) SEBEPLER çiziliyor mu — ve TEK cümle değil, FARKLI cümleler mi?
  const sebepler = [
    ['kapsam dışı', /kapsamı dışında/],
    ['henüz yayınlanmadı', /henüz yayınlanmadı/],
    ['hiç kayıt alınamadı', /hiç oran kaydı alınamadı/],
    ['mühür alınamadı', /mühür alınamadı/],
    ['gün gelmedi', /Bu gün henüz gelmedi/],
    ['kilit sonrası', /Kilit sonrası/],
  ];
  const gorulen = sebepler.filter(([, r]) => r.test(metin)).map(([ad]) => ad);
  not(gorulen.length >= 2, 'birden fazla FARKLI sebep çiziliyor (tek jenerik cümle değil)', gorulen.join(' · '));

  // 3) REGRESYON: eski tek jenerik cümle artık baskın olmamalı.
  const jenerikSayi = (metin.match(/Bu gün için oran kaydı yok/g) || []).length;
  not(jenerikSayi === 0, 'eski jenerik cümle ekranda yok', `bulunan: ${jenerikSayi}`);

  // 4) MARKA ADI yasağı (CLAUDE.md).
  not(!/footystats|bilyoner|nesine|misli/i.test(metin), 'ekranda marka adı yok');

  // 5) UYDURMA YASAĞI: sebep satırının olduğu yerde oran sayısı basılmamalı.
  //    Sebep cümlesi içeren satırlarda 1.85 gibi oran biçimi aranır.
  const sebepSatirlari = metin.split('\n').filter((s) => /kapsamı dışında|henüz yayınlanmadı|hiç oran kaydı|mühür alınamadı/.test(s));
  const uydurma = sebepSatirlari.filter((s) => /\b\d+\.\d{2}\b/.test(s));
  not(uydurma.length === 0, 'sebep satırında uydurma oran yok', uydurma.slice(0, 2).join(' | '));

  // 6) JS hatası yok.
  not(jsHatalar.length === 0, 'mount sırasında JS hatası yok', jsHatalar.slice(0, 2).join(' | '));

  console.log('\n--- ekranda görülen sebep satırları (ilk 8) ---');
  for (const s of sebepSatirlari.slice(0, 8)) console.log('   ' + s.trim());
} finally {
  await browser.close();
}

const dusen = adimlar.filter((a) => !a.ok);
console.log(`\n${adimlar.length - dusen.length}/${adimlar.length} geçti`);
process.exit(dusen.length ? 1 : 0);
