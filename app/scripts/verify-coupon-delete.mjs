/**
 * GERÇEK SİLME DENETİMİ — "Kuponlarım" ekranında Sil düğmesi.
 *
 * NEDEN: Kullanıcı bildirimi "kuponlardaki kuponları silemiyorum". Sebep şuydu:
 * react-native-web, React Native'in Alert'ini BOŞ GÖVDELİ bir taslak olarak
 * yayınlar (`class Alert { static alert() {} }`). Onay penceresi web'de HİÇ
 * açılmıyordu, dolayısıyla "Sil" düğmesinin onPress'i çağrılmıyor ve
 * deleteCoupon hiç çalışmıyordu. Düğmeye basılıyor, hiçbir şey olmuyordu.
 *
 * test/coupon-delete.test.mjs kaynağın NE YAZDIĞINI korur. Bu betik tarayıcıyı
 * gerçekten açar ve şunu sorar: düğmeye basınca pencere ÇİZİLİYOR mu, "Sil"e
 * basınca kupon GERÇEKTEN gidiyor mu, "Vazgeç" deyince KALIYOR mu.
 *
 * BU BİR BİRİM TESTİ DEĞİLDİR: `npm test` test/ altını toplar, bu yüzden dosya
 * scripts/ altındadır. Elle çalıştırılır:
 *   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/verify-coupon-delete.mjs
 * Gerekli: Expo web :8081 ayakta olmalı. Backend'e gerek YOKTUR — hafta/bülten
 * uçları burada sahte veriyle karşılanır (aşağıya bak).
 *
 * SAHTE VERİ NEREDE, NEREDE DEĞİL: Yalnız BU BETİK, yalnız TARAYICI OTURUMU
 * içinde /api/rounds · /api/bulletin · /api/history yanıtlarını taklit eder ve
 * depoya tek bir deneme kuponu yazar. Uygulama koduna, backend'e ya da gerçek
 * kullanıcı verisine hiçbir sahte kayıt girmez; amaç silme davranışını gerçek
 * veriye dokunmadan koşturmaktır.
 *
 * DÜRÜSTLÜK NOTU: burada geçmesi GERÇEK ANDROID/iOS CİHAZDA geçtiği anlamına
 * GELMEZ. Yalnız web çiziminin ve silme akışının ayakta olduğunu gösterir.
 */
import { mkdir } from 'node:fs/promises';

const PW = process.env.PLAYWRIGHT_PKG || '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const pw = await import(PW);
const { chromium } = pw.chromium ? pw : pw.default;

const WEB = 'http://localhost:8081';
const OUT = new URL('../.render/', import.meta.url).pathname;

const KEY = 'sportoto.couponCenter.v1';
const ROUND = 9001;                 // yalnız bu oturumda geçerli deneme haftası
const GECMIS_ROUND = 9000;          // silinemeyen (arşiv) hafta — sebep yazılmalı
const KUPON_ID = 'k_denetim_1';
const GECMIS_KUPON_ID = 'k_denetim_gecmis';

const adimlar = [];
const not = (ok, ad, ek = '') => {
  adimlar.push({ ok, ad, ek });
  console.log(`${ok ? 'OK  ' : 'HATA'} ${ad}${ek ? ' — ' + ek : ''}`);
};

// İlk maç 3 gün sonra: hafta AÇIK olsun (kilitli haftada Sil düğmesi zaten
// bilerek çizilmez; o durumun kendi sebebi ekranda yazar).
const ilkMac = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
const macTarihi = (i) => new Date(ilkMac.getTime() + i * 60 * 60 * 1000).toISOString();
const MACLAR = Array.from({ length: 15 }, (_, i) => ({
  no: i + 1,
  date: macTarihi(i),
  home: { name: `Ev ${i + 1}`, logo: null },
  away: { name: `Konuk ${i + 1}`, logo: null },
}));

const ROUNDS = {
  currentRoundId: ROUND,
  rounds: [
    { id: GECMIS_ROUND, name: `Hafta ${GECMIS_ROUND}`, year: '2026-2027' },
    { id: ROUND, name: `Hafta ${ROUND}`, year: '2026-2027' },
  ],
};
const BULLETIN = { roundId: ROUND, matches: MACLAR, couponPricing: null };
const HISTORY = { roundId: ROUND, matches: [] };

const simdi = new Date().toISOString();
const KUPON = {
  schema: 2,
  id: KUPON_ID,
  name: 'Denetim Kuponu',
  season: '2026-2027', weekNumber: ROUND, roundId: ROUND,
  couponNo: 1,
  isRankedCoupon: true,
  status: 'saved',
  createdAt: simdi, updatedAt: simdi,
  lockedAt: ilkMac.getTime() - 5 * 60 * 1000,
  playedMarkedAt: null,
  finalVersionId: 'v_denetim_1',
  versions: [{
    id: 'v_denetim_1',
    versionNo: 1,
    createdAt: simdi,
    selections: MACLAR.map((m) => ({ no: m.no, selectedOutcomes: ['1'] })),
    columnCount: 1,
  }],
};

// Geçmiş hafta kuponu: SİLİNEMEZ (karne kaydı geriye dönük değişmesin) —
// ama düğme sessizce yok olmaz, sebebi ekranda yazar.
const GECMIS_KUPON = {
  ...KUPON,
  id: GECMIS_KUPON_ID,
  name: 'Arşiv Kuponu',
  roundId: GECMIS_ROUND, weekNumber: GECMIS_ROUND,
  lockedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
  finalVersionId: 'v_denetim_gecmis',
  versions: [{ ...KUPON.versions[0], id: 'v_denetim_gecmis' }],
};

const json = (route, body) => route.fulfill({
  status: 200, contentType: 'application/json', body: JSON.stringify(body),
});

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 430, height: 1600 } });

const jsHatalar = [];
page.on('pageerror', (e) => jsHatalar.push(String(e)));

const depoyuOku = () => page.evaluate((k) => localStorage.getItem(k), KEY);

try {
  await page.route('**/api/rounds*', (r) => json(r, ROUNDS));
  await page.route('**/api/bulletin*', (r) => json(r, BULLETIN));
  await page.route('**/api/history/**', (r) => json(r, HISTORY));

  // Tohum YALNIZ İLK AÇILIŞTA atılır. Yenileme adımı ancak böyle dürüst olur:
  // her gezinmede yeniden yazılsaydı "silinen kupon geri geldi mi" sorusu
  // sınanmış olmaz, tohum kendi cevabını üretirdi.
  await page.addInitScript(([k, liste, isaret]) => {
    if (sessionStorage.getItem(isaret)) return;
    sessionStorage.setItem(isaret, '1');
    localStorage.setItem(k, JSON.stringify(liste));
  }, [KEY, [KUPON, GECMIS_KUPON], 'denetim.tohum']);

  await page.goto(WEB, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(9000);

  await page.click('a[href="/CouponsTab"][role="tab"]');
  await page.waitForTimeout(5000);

  const silDugme = page.locator(`[data-testid="kupon-sil-${KUPON_ID}"]`);
  await silDugme.waitFor({ state: 'visible', timeout: 20_000 });
  not(true, 'Sil düğmesi açık haftada çiziliyor');
  await page.screenshot({ path: OUT + 'kupon-sil-1-liste.png', fullPage: true });

  const baslangic = await depoyuOku();
  not(!!baslangic && baslangic.includes(KUPON_ID), 'deneme kuponu depoda duruyor');

  /* ————— 1) PENCERE GERÇEKTEN AÇILIYOR MU (asıl hata buradaydı) ————— */
  await silDugme.click();
  await page.waitForTimeout(700);
  const kutu = page.locator('[data-testid="uyari-kutu"]');
  const acildi = await kutu.isVisible().catch(() => false);
  not(acildi, 'onay penceresi ÇİZİLİYOR (eski Alert web\'de hiç açılmıyordu)');
  await page.screenshot({ path: OUT + 'kupon-sil-2-pencere.png', fullPage: true });

  const pencereMetni = acildi ? (await kutu.innerText()).replace(/\s+/g, ' ').trim() : '';
  not(/silinsin mi/i.test(pencereMetni), 'pencere neyin silineceğini soruyor', pencereMetni.slice(0, 90));

  /* ————— 2) VAZGEÇ: KUPON KALMALI ————— */
  await page.click('[data-testid="uyari-dugme-0"]');
  await page.waitForTimeout(700);
  const pencereKapandi = !(await kutu.isVisible().catch(() => false));
  not(pencereKapandi, 'Vazgeç penceresi kapatıyor');
  const vazgecSonrasi = await depoyuOku();
  not(!!vazgecSonrasi && vazgecSonrasi.includes(KUPON_ID), 'Vazgeç sonrası kupon SİLİNMEDİ (onaysız yıkıcı işlem yok)');
  not(await silDugme.isVisible().catch(() => false), 'Vazgeç sonrası kupon satırı ekranda duruyor');

  /* ————— 3) SİL: KUPON GERÇEKTEN GİTMELİ ————— */
  await silDugme.click();
  await page.waitForTimeout(700);
  await page.click('[data-testid="uyari-dugme-1"]');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT + 'kupon-sil-3-silindi.png', fullPage: true });

  const satirGitti = !(await silDugme.isVisible().catch(() => false));
  not(satirGitti, 'silme sonrası kupon satırı EKRANDAN kalktı');

  const sonDepo = await depoyuOku();
  not(!sonDepo || !sonDepo.includes(KUPON_ID), 'silme KALICI yazıldı (depoda kimlik kalmadı)');

  /* ————— 4) YENİLEYİNCE GERİ GELMİYOR MU ————— */
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(9000);
  await page.click('a[href="/CouponsTab"][role="tab"]');
  await page.waitForTimeout(5000);
  const geriGeldi = await silDugme.isVisible().catch(() => false);
  not(!geriGeldi, 'sayfa yenilendiğinde silinen kupon GERİ GELMİYOR');
  await page.screenshot({ path: OUT + 'kupon-sil-4-yenileme.png', fullPage: true });

  /* ————— 5) SİLİNEMEYEN HAFTA: DÜĞME YOK AMA SEBEP VAR ————— */
  // İlke: "SEBEPSİZ KAPALI DÜĞME, SESSİZ DÜĞMEDEN BETERDİR."
  await page.click('[aria-label="Önceki hafta"]');
  await page.waitForTimeout(3500);
  await page.screenshot({ path: OUT + 'kupon-sil-5-gecmis-hafta.png', fullPage: true });

  const gecmisSil = page.locator(`[data-testid="kupon-sil-${GECMIS_KUPON_ID}"]`);
  const sebep = page.locator(`[data-testid="kupon-sil-sebep-${GECMIS_KUPON_ID}"]`);
  await sebep.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
  not(!(await gecmisSil.isVisible().catch(() => false)), 'geçmiş haftada Sil düğmesi çizilmiyor');
  const sebepVar = await sebep.isVisible().catch(() => false);
  const sebepMetni = sebepVar ? (await sebep.innerText()).replace(/\s+/g, ' ').trim() : '';
  not(sebepVar, 'düğme yerine SEBEP yazıyor (sessizce kaybolmuyor)', sebepMetni.slice(0, 110));

  not(jsHatalar.length === 0, 'sayfada JavaScript hatası yok', jsHatalar.slice(0, 3).join(' | '));
} catch (e) {
  not(false, 'betik çalışırken hata', String(e && e.message ? e.message : e));
} finally {
  await browser.close();
}

const kalan = adimlar.filter((a) => !a.ok);
console.log(`\nSONUÇ: ${adimlar.length - kalan.length}/${adimlar.length} adım geçti`);
console.log(`Ekran görüntüleri: ${OUT}`);
if (kalan.length) {
  console.log('GEÇMEYENLER:');
  for (const a of kalan) console.log(` - ${a.ad}${a.ek ? ' — ' + a.ek : ''}`);
  process.exit(1);
}
