/**
 * GERÇEK ÇİZİM DENETİMİ — yayıncı stüdyosu (3 ekran).
 *
 * NEDEN: "bundle 200 döndü" yalnız DERLENDİ demektir. Bileşen mount olurken
 * patlarsa bundle yine 200'dür. Bu betik tarayıcıyı gerçekten açar, ekranları
 * gezer, konsol hatalarını toplar ve ekran görüntüsü alır.
 *
 * BU BİR BİRİM TESTİ DEĞİLDİR. Bu yüzden test/ altında DEĞİL scripts/ altındadır:
 * `npm test` betiği "node --test" ile test/ içindeki HER dosyayı toplar; burası
 * test/ içinde kalsaydı birim testi koşusu tarayıcıyı açmaya kalkardı (kalktı da).
 * Elle çalıştırılır:
 *   npm run verify:render      (ya da: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
 *                               node scripts/render-studio.mjs)
 * Gerekli: Expo web :8081 ve backend :4000 ayakta olmalı.
 *
 * DÜRÜSTLÜK NOTU: burada geçmesi, gerçek Android cihazda geçtiği anlamına
 * GELMEZ. Yalnız web çiziminin ayakta olduğunu gösterir.
 *
 * KONSOL HATALARI İKİYE AYRILIR:
 *  · Stüdyoya girmeden önce oluşanlar = ÇEVRE/ESKİ (kaba ağ yok, DB yok).
 *  · Stüdyoya girdikten sonra oluşanlar = BİZİM sorumluluğumuz; sıfır olmalı.
 */
import { mkdir } from 'node:fs/promises';

// Playwright KÜRESEL kurulu (projeye paket eklenmedi — package.json'a dokunulmadı).
// ESM, NODE_PATH'i yok sayar; bu yüzden mutlak yolla alıyoruz.
const PW = process.env.PLAYWRIGHT_PKG || '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const pw = await import(PW);
const { chromium } = pw.chromium ? pw : pw.default;   // CJS paket → default altında

const WEB = 'http://localhost:8081';
const API = process.env.API_BASE || 'http://localhost:4000';
const OUT = new URL('../.render/', import.meta.url).pathname;
const T = (id) => `[data-testid="${id}"]`;
const KEY = 'sportoto.broadcastStudio.v1';

// HATALAR İKİ CİNSTİR, KARIŞTIRILMAZ:
//  · jsHatalar  — kodun kendi hatası (pageerror / gerçek console.error).
//                 SIFIR olmalı. Bu iş bunun için yazıldı.
//  · agHatalar  — ağ/kaynak yüklenemedi. Bu kutuda dış ağ (kulüp arması CDN'i)
//                 ve veritabanı yok; burada çıkması BEKLENİR, kod hatası değil.
//                 Yine de basılır — sessizce yutulmaz.
//  · ktpHatalar — kütüphanenin kendi uyarısı. Aşağıya bak; yutulmaz, ayrı basılır.
const jsHatalar = [];
const agHatalar = [];
const ktpHatalar = [];
const adimlar = [];

const AG_IZI = /Failed to load resource|ERR_TUNNEL|ERR_CONNECTION|net::/i;

// KÜTÜPHANE UYARISI: React Navigation'ın kendi bileşenleri (ResourceSavingView,
// Screen) React'a `collapsable={false}` geçiyor. Bu uyarı stüdyoya GİRMEDEN,
// ana ekranda da çıkıyor ve bizim kaynağımızda "collapsable" hiç geçmiyor
// (birim testiyle sabitlendi). Kendi hatamız gibi saymıyoruz ama SAKLAMIYORUZ
// da: ayrı sayılıp raporda kaynağıyla birlikte basılır.
const KTP_IZI = /non-boolean attribute[\s\S]*collapsable|collapsable[\s\S]*non-boolean/i;

const not = (ok, ad, ek = '') => {
  adimlar.push({ ok, ad, ek });
  console.log(`${ok ? '  ok  ' : '  ✗ ! '}${String(adimlar.length).padStart(2)}) ${ad}${ek ? ` — ${ek}` : ''}`);
};

/* YAYINCI MODUNDA HÜKÜM YASAĞI — canlı ekranda kelime denetimi.
   Yayıncı isteği: "sistem güvenli riskli vs yazmasın". Kaynak taraması
   (test/studio-no-verdict.test.mjs) kodun kendisini korur; buradaki denetim
   ise GERÇEK TARAYICIDA ÇİZİLEN metne bakar — sözcük bir bileşenin içinden,
   bir veri alanından veya sonradan eklenen bir panelden gelirse burada yakalanır.
   "Belirsizlik/Risk sinyali" gibi eş anlamlılar da yasak; ölçüm kodda durur,
   ekrana yazılmaz. */
const YASAK_HUKUM = /riskli|risksiz|güvenli|güvensiz|temkinli|toplam risk|risk sinyali|risk yorumu|veri güveni|belirsizlik/i;

/** Ekranda çizilmiş metinde hüküm sözcüğü var mı? Varsa hangisi. */
const hukumDenetle = async (locator, ekranAdi) => {
  const metin = (await locator.innerText()).replace(/\s+/g, ' ');
  const bulunan = metin.match(YASAK_HUKUM);
  not(
    !bulunan,
    `${ekranAdi}: "güvenli/riskli" türü hüküm YOK`,
    bulunan ? `YASAK SÖZCÜK GÖRÜNDÜ → "${bulunan[0]}"` : `${metin.length} karakter tarandı`,
  );
};

const izle = (p, etiket = '') => {
  p.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    const kova = AG_IZI.test(t) ? agHatalar : KTP_IZI.test(t) ? ktpHatalar : jsHatalar;
    kova.push(etiket + t);
  });
  p.on('pageerror', (e) => jsHatalar.push(`${etiket}pageerror: ${e.message}`));
  p.on('requestfailed', (r) => agHatalar.push(`${etiket}${r.url().slice(0, 90)} :: ${r.failure()?.errorText}`));
  p.on('response', (r) => { if (r.status() >= 400) agHatalar.push(`${etiket}HTTP ${r.status()} ${r.url().slice(0, 90)}`); });
};

/**
 * "Yayın öncesi" an: bültendeki EN ERKEN maçtan 2 saat öncesi.
 * Elle sabit bir tarih yazmak hafta değişince betiği sessizce çürütürdü;
 * bu yüzden gerçek bültenden hesaplanır.
 */
async function yayinOncesiAn() {
  try {
    const j = await (await fetch(`${API}/api/bulletin`)).json();
    const list = j.matches || j.data?.matches || [];
    const anlar = list
      .map((m) => new Date(m.date || m.matchDate || m.startsAt).getTime())
      .filter((n) => Number.isFinite(n));
    if (anlar.length) return Math.min(...anlar) - 2 * 3600_000;
  } catch {}
  return Date.now() - 7 * 86_400_000;   // bülten okunamadıysa bir hafta geriye
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  izle(page);

  /* 1) AÇILIŞ */
  await page.goto(WEB, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForSelector('[aria-label="Yayın stüdyosu"]', { timeout: 90_000 });
  not(true, 'Ana ekran çizildi, 📺 stüdyo düğmesi bulundu');

  /* 2) BÜLTEN EKRANI */
  await page.click('[aria-label="Yayın stüdyosu"]');
  await page.waitForSelector(T('studio-bulletin-root'), { timeout: 60_000 });
  await page.waitForSelector(T('studio-progress-count'), { timeout: 60_000 });
  const satirlar = await page.locator('[data-testid^="studio-row-"]').evaluateAll((els) => els.map((e) => ({
    no: e.getAttribute('data-testid').replace('studio-row-', ''),
    kilitli: !!e.querySelector('[data-testid="studio-pick-1"][disabled]'),
  })));
  not(satirlar.length === 15, 'Bülten ekranı mount oldu', `${satirlar.length} maç satırı (15 beklenir)`);
  not((await page.locator(T('studio-header')).count()) === 1, 'Üst başlıkta stüdyo logosu var');

  /* 3) KİLİT — gerçek saat, gerçek bülten */
  const kilitli = satirlar.filter((r) => r.kilitli).map((r) => r.no);
  const acik = satirlar.filter((r) => !r.kilitli).map((r) => r.no);
  const kismi = await page.locator(T('studio-partial-locked')).count();
  const hafta = await page.locator(T('studio-week-locked')).count();
  if (kilitli.length && acik.length) {
    not(kismi === 1 && hafta === 0, 'Kısmî kilit uyarısı çıktı, hafta kilidi çıkmadı',
      `başlamış: ${kilitli.join(',')} · açık: ${acik.length} maç`);
  } else if (kilitli.length === 15) {
    not(hafta === 1, 'Hafta kilidi paneli çıktı (tüm maçlar başlamış)');
  } else {
    not(kismi === 0 && hafta === 0, 'Hiç maç başlamamış, kilit uyarısı yok');
  }
  await hukumDenetle(page.locator(T('studio-bulletin-root')), 'Bülten ekranı');
  await page.screenshot({ path: `${OUT}01-bulten.png` });

  if (!acik.length) { console.log('\nTüm maçlar kilitli — seçim akışı denenemiyor.'); await browser.close(); return; }
  const no = acik[0];

  /* 4) SEÇİM KALICILIĞI — açık satıra bas, depoya yazıldı mı? */
  await page.locator(T(`studio-row-${no}`)).locator(T('studio-pick-1')).click();
  await page.waitForTimeout(300);
  const depo1 = await page.evaluate((k) => localStorage.getItem(k), KEY);
  not(!!depo1 && depo1.includes(`"${no}"`), 'Açık satırda seçim depoya yazıldı', `maç ${no}`);
  const sayac = (await page.locator(T('studio-progress-count')).innerText()).replace(/\s+/g, ' ');
  not(/1\s*\/\s*15/.test(sayac), 'İlerleme sayacı güncellendi', sayac);

  /* 5) KİLİTLİ SATIRA YAZILAMIYOR — gerçek tarayıcıda */
  if (kilitli.length) {
    const kNo = kilitli[0];
    const kutu = page.locator(T(`studio-row-${kNo}`)).locator(T('studio-pick-1'));
    const pasif = await kutu.isDisabled();
    await kutu.click({ force: true }).catch(() => {});
    await page.waitForTimeout(250);
    const sonra = await page.evaluate(({ k, n }) => {
      const r = JSON.parse(localStorage.getItem(k) || '{}');
      const w = Object.values(r.rounds || {})[0] || {};
      return (w.picks || {})[n] || null;
    }, { k: KEY, n: kNo });
    not(pasif && sonra === null, 'Başlamış maça zorla dokunmak kaydı DEĞİŞTİRMEDİ',
      `maç ${kNo} · kutu pasif=${pasif} · kayıt=${sonra === null ? 'yok' : JSON.stringify(sonra)}`);
  }

  /* 6) MAÇ DETAYI + YATAY ŞERİT
        DİKKAT: yığın gezinmesinde bülten ekranı DOM'da asılı kalır (gizli).
        Bu yüzden detay ekranının her şeyi studio-match-root ALTINDAN aranır;
        yoksa gizli bültenin ilk satırı bulunur ve test yanlış şeyi ölçer. */
  await page.click(T(`studio-analiz-${no}`));
  await page.waitForSelector(T('studio-match-root'), { timeout: 60_000 });
  const detay = page.locator(T('studio-match-root'));
  const SEKME = '[data-testid^="studio-section-"]:not([data-testid="studio-section-strip"]):not([data-testid="studio-section-body"])';
  const sira = await detay.locator(SEKME).evaluateAll((els) =>
    els.map((e) => e.getAttribute('data-testid').replace('studio-section-', '')));
  const beklenen = ['liste', 'performance', 'expectation', 'publicBetting', 'market', 'bulletinMemory', 'istatistik'];
  not(JSON.stringify(sira) === JSON.stringify(beklenen), 'Yatay şerit çizildi ve sırası doğru', sira.join(' · '));

  // ŞERİT ÖLÇÜSÜ: sekmeler HER ZAMAN tek satırda ve kutu yatay kaydırmalı olmalı.
  // Geniş ekranda 7 sekme sığabilir — o zaman kaydırma gerekmez ve "sığmıyor"
  // beklemek yanlış olur. Doğru kural: alt satıra SARKMASIN, sığmadığında KAYSIN.
  const serit = await page.locator(T('studio-section-strip')).evaluate((el) => {
    const k = [...el.querySelectorAll('[data-testid^="studio-section-"]')];
    return {
      s: el.scrollWidth, g: el.clientWidth, tasma: getComputedStyle(el).overflowX,
      sekmeGen: Math.round(k.reduce((a, x) => a + x.getBoundingClientRect().width, 0)),
      satir: new Set(k.map((x) => Math.round(x.getBoundingClientRect().top))).size,
    };
  });
  not(serit.satir === 1 && /auto|scroll/.test(serit.tasma),
    'Sekmeler tek satırda ve şerit yatay kaydırma kutusu',
    `${serit.satir} satır · overflow-x:${serit.tasma} · sekmeler ${serit.sekmeGen}px`);
  not(serit.s > serit.g || serit.sekmeGen <= serit.g,
    'Sığmadığında kayar, sığdığında kaymaz (geniş ekran)',
    `içerik ${serit.s}px / görünen ${serit.g}px`);
  // Açılış sekmesi (radar) çizilmişken: hüküm sözcüğü ne panelden ne de
  // motordan gelen bir cümleden görünmemeli.
  await hukumDenetle(detay, 'Maç detayı (radar sekmesi)');
  await page.screenshot({ path: `${OUT}02-mac-detay.png` });

  const oncekiGovde = await page.locator(T('studio-section-body')).innerText();
  await page.click(T('studio-section-istatistik'));
  await page.waitForTimeout(400);
  const govde = await page.locator(T('studio-section-body')).innerText();
  not(govde.length > 40 && govde !== oncekiGovde, 'Sekme değişince gövde yeniden çizildi', `${govde.length} karakter`);
  // İkinci sekme de taranır: hüküm sözcüğü tek bir sekmenin içinde saklanamasın.
  await hukumDenetle(detay, 'Maç detayı (istatistik sekmesi)');
  await page.screenshot({ path: `${OUT}03-mac-detay-istatistik.png` });

  /* 7) YAYINCI NOTU + DETAYDAKİ SEÇİM ANA LİSTEYE YANSIYOR MU? */
  const notKutu = detay.locator(T('studio-note'));
  await notKutu.fill('Yayın denemesi: ev sahibi iç sahada üstün.');
  await page.waitForTimeout(400);
  const notDepo = await page.evaluate(({ k, n }) => {
    const r = JSON.parse(localStorage.getItem(k) || '{}');
    return ((Object.values(r.rounds || {})[0] || {}).notes || {})[n] || null;
  }, { k: KEY, n: no });
  not(!!notDepo, 'Yayıncı notu depoya yazıldı', notDepo ? `"${notDepo.slice(0, 30)}…"` : 'YAZILMADI');

  await detay.locator(T('studio-picks')).first().locator(T('studio-pick-2')).click();
  await page.waitForTimeout(250);
  await page.click(T('studio-back-list'));
  await page.waitForSelector(T('studio-bulletin-root'), { timeout: 30_000 });
  await page.waitForTimeout(400);
  const satirMetin = await page.locator(T(`studio-row-${no}`)).innerText();
  not(/📝/.test(satirMetin), 'Detayda yazılan not ana listede göründü');
  const sayac2 = (await page.locator(T('studio-progress-count')).innerText()).replace(/\s+/g, ' ');
  not(/1\s*\/\s*15/.test(sayac2), 'Detaydaki seçim ana listeye yansıdı (çift seçim, hâlâ 1 maç)', sayac2);

  /* 8) KİLİTLİ MAÇIN DETAYI: not salt okunur */
  if (kilitli.length) {
    await page.click(T(`studio-analiz-${kilitli[0]}`));
    await page.waitForSelector(T('studio-match-root'), { timeout: 30_000 });
    await page.waitForTimeout(600);
    const kDetay = page.locator(T('studio-match-root'));
    const okunur = await kDetay.locator(T('studio-note')).isEditable().catch(() => true);
    const kutuPasif = await kDetay.locator(T('studio-picks')).first().locator(T('studio-pick-1')).isDisabled();
    not(!okunur && kutuPasif, 'Başlamış maçın detayında not ve kutular kapalı',
      `not düzenlenebilir=${okunur} · kutu pasif=${kutuPasif}`);
    await page.screenshot({ path: `${OUT}04-kilitli-mac-detay.png` });
    await page.click(T('studio-back-list'));
    await page.waitForSelector(T('studio-bulletin-root'), { timeout: 30_000 });
  }

  /* 9) 15 MAÇ TAM → KAYIT AÇILIR, EKRAN ATLAMAZ
        Depoyu doğrudan tohumluyoruz: 15 satırı elle tıklamak çizimi değil
        tıklama hızını ölçer. (Kilitli maçların seçimi, kilitten ÖNCE
        yapılmış sayılır — depoya elle yazmak gerçek akışı taklit eder.)

        FİNAL KUPON EKRANI KALDIRILDI (yayıncı isteği: "final kuponu ekranını
        kaldır"). Eskiden burada "Final Kupon Ekranı ›" düğmesine basılır,
        ikinci bir ekran açılır, kupon orada kaydedilirdi. Bugün 15. maç
        işaretlenince ekran HİÇBİR YERE ATLAMAZ; kayıt bölümü aynı sayfada,
        sağ özet panelinde açılır. Bu yüzden artık düğmenin VARLIĞI değil
        YOKLUĞU sınanıyor — kaldırılan ekran sessizce geri gelmesin. */
  const roundId = await page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    return raw ? Object.keys(JSON.parse(raw).rounds || {})[0] : null;
  }, KEY);
  not(!!roundId, 'Depoda hafta kimliği var', `roundId ${roundId}`);

  await page.evaluate(({ k, noLar, rid }) => {
    const raw = JSON.parse(localStorage.getItem(k));
    const w = raw.rounds[rid];
    noLar.forEach((n, i) => { w.picks[n] = i % 3 === 0 ? ['1'] : i % 3 === 1 ? ['1', 'X'] : ['2']; });
    localStorage.setItem(k, JSON.stringify(raw));
  }, { k: KEY, noLar: satirlar.map((r) => r.no), rid: roundId });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[aria-label="Yayın stüdyosu"]', { timeout: 90_000 });
  await page.click('[aria-label="Yayın stüdyosu"]');
  // KÖR BEKLEME YAPMA: ekranın ÜÇ hâli var (yükleniyor / durum kartı / tablo).
  // Yalnız tablo kökünü beklemek, hata hâlinde 60 sn susup sonra "zaman aşımı"
  // diye çökmek demekti — sebebi de yutuluyordu. İki hâli birden bekliyoruz;
  // hata kazanırsa ekranın KENDİ YAZDIĞI metinle raporlanır.
  await page.waitForSelector(`${T('studio-bulletin-root')}, ${T('studio-state')}`, { timeout: 60_000 });
  const bultenHata = await page.locator(T('studio-state')).count();
  if (bultenHata) {
    const neden = (await page.locator(T('studio-state')).innerText()).replace(/\s+/g, ' ').slice(0, 200);
    await page.screenshot({ path: `${OUT}05-bulten-dolu-HATA.png`, fullPage: true });
    not(false, 'Bülten 15/15 hâlinde mount oldu', `ekran durum kartıyla açıldı → "${neden}"`);
    await browser.close();
    return;
  }
  await page.waitForSelector(T('studio-progress-count'), { timeout: 60_000 });
  const sayacTam = (await page.locator(T('studio-progress-count')).innerText()).replace(/\s+/g, ' ');
  not(/15\s*\/\s*15/.test(sayacTam), '15/15 maç işaretlendi (ekran aynı sayfada kaldı)', sayacTam);

  // KALDIRILAN EKRAN GERİ GELMESİN: ne düğmesi, ne rotası.
  const kuponDugmesi = await page.locator(T('studio-goto-coupon')).count();
  not(kuponDugmesi === 0, 'Final kupon ekranına giden düğme YOK (ekran kaldırıldı)',
    `${kuponDugmesi} adet bulundu (0 beklenir)`);
  const adres = await page.evaluate(() => location.pathname + location.hash);
  not(!/StudioCoupon/i.test(adres), '15. maç işaretlenince ekran başka rotaya ATLAMADI', adres);

  // Kaldırılan ekranın tek kendine ait paneli "Tüm Maç Seçimleri" idi; aynı
  // bilgiyi tablonun kendisi zaten taşıyor. Tablo hâlâ 15 satır mı, ona bak.
  const tamSatir = await page.locator('[data-testid^="studio-row-"]').count();
  not(tamSatir === 15, 'Bütün maç seçimleri tabloda görünmeye devam ediyor', `${tamSatir} satır`);

  const ozet = await page.locator(T('studio-progress')).innerText();
  // "En Riskli Maçlar" paneli KALDIRILDI — varlığı değil, YOKLUĞU sınanır.
  const riskliVar = await page.locator(T('studio-coupon-riskiest')).count();
  const kaydetVar = await page.locator(`${T('studio-bulletin-save')}, ${T('studio-bulletin-saved')}`).count();
  not(riskliVar === 0, '"En Riskli Maçlar" paneli ekranda YOK', `${riskliVar} adet bulundu (0 beklenir)`);
  not(kaydetVar === 1, '"Kuponu Kaydet" bölümü bülten ekranında yerinde');
  not(/tek/i.test(ozet) && /çift/i.test(ozet) && /kapalı/i.test(ozet),
    'Tek-çift-kapalı dağılımı gösteriliyor', ozet.replace(/\s+/g, ' ').slice(0, 110));
  await hukumDenetle(page.locator(T('studio-bulletin-root')), 'Bülten ekranı (15/15)');

  // RESMÎ YAZIM — beraberlik kutusu "0" basar, "X" basmaz.
  // DENETİM KUTULARA BAKAR, TÜM EKRANA DEĞİL: sağ özet panelinde "Kapalı (1X2)"
  // ETİKETİ geçer; o bir kolon yazımı değil, bir başlıktır. Eski denetim bütün
  // ekran metnini tarıyordu (kaldırılan kupon ekranında böyle bir etiket yoktu);
  // aynısını buraya taşımak yanlış alarm verirdi. Kutu metni daha da sıkı bir
  // ölçüdür — yazımın gerçekten çıktığı yere bakar.
  const kutuHarfleri = await page
    .locator('[data-testid^="studio-row-"] [data-testid^="studio-pick-"]')
    .evaluateAll((els) => [...new Set(els.map((e) => e.innerText.trim()))].sort());
  not(kutuHarfleri.includes('0') && !kutuHarfleri.includes('X'),
    'Seçim kutuları resmî yazımı basıyor (1-0-2 · "X" yok)', `kutularda: ${kutuHarfleri.join(' ')}`);
  await page.screenshot({ path: `${OUT}05-bulten-dolu.png`, fullPage: true });

  /* 10) KAYIT KAPISI — BAŞLAMIŞ MAÇ VARSA KUPON YAZILMAZ
        Kural: kupon, ilk maç başlamadan kaydedilir. Depo bunu zaten reddeder;
        sınanan şey ekranın bunu SÖYLEYİP söylemediği.
        GERÇEK HATADAN DOĞDU: eskiden düğmeye basılıyor, depo reddediyor,
        kullanıcıya hiçbir şey görünmüyordu — çünkü tek geri bildirim kanalı
        Alert.alert idi ve o, react-native-web'de BOŞ bir işlevdir. */
  const arsivOnce = (await page.evaluate(() => localStorage.getItem('sportoto.couponCenter.v1'))) || '';
  if (kilitli.length) {
    const uyariVar = await page.locator(T('studio-bulletin-blocked')).count();
    const uyariMetin = uyariVar ? await page.locator(T('studio-bulletin-blocked')).innerText() : '';
    const hepsiYazili = kilitli.every((n) => new RegExp(`(^|\\D)${n}(\\D|$)`).test(uyariMetin));
    not(uyariVar === 1 && hepsiYazili, 'Başlamış maç varken ekran BASMADAN ÖNCE uyarıyor',
      `başlamış ${kilitli.join(',')} · "${uyariMetin.replace(/\s+/g, ' ').slice(0, 90)}…"`);
    const dugme = page.locator(T('studio-bulletin-save-btn'));
    const aria = await dugme.getAttribute('aria-disabled');
    const gercektenPasif = await dugme.isDisabled();
    not(aria === 'true' && gercektenPasif,
      'Kaydet düğmesi hem ekran okuyucuya hem tarayıcıya kapalı',
      `aria-disabled=${aria} · tıklanabilir=${!gercektenPasif}`);

    // ZORLA BASMAK DA BİR ŞEY YAZMAMALI (kapalı düğme süs değil).
    await dugme.click({ force: true, timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(600);
    const arsivSonra = (await page.evaluate(() => localStorage.getItem('sportoto.couponCenter.v1'))) || '';
    const kaydedildiPaneli = await page.locator(T('studio-bulletin-saved')).count();
    not(arsivSonra === arsivOnce && kaydedildiPaneli === 0,
      'Reddedilen kupon arşive YAZILMADI (kayıt paneli de açılmadı)',
      `arşiv ${arsivOnce.length}→${arsivSonra.length} karakter`);
    await page.screenshot({ path: `${OUT}07-kayit-reddedildi.png` });
  }

  /* 10b) KAYIT YOLU — YAYIN ÖNCESİ SAATTE
        Bu haftanın 4 maçı GERÇEKTEN başladı; "başarılı kayıt" yukarıdaki
        sayfada denenemez, depo haklı olarak reddeder. Kuralı gevşetmeden
        sınamak için YENİ bir sekmede tarayıcı saati ilk maçtan öncesine
        alınır (clock.setFixedTime: yalnız Date sahtelenir, zamanlayıcılar
        gerçek kalır). VERİ SAHTE DEĞİL — aynı bülten, aynı 15 maç; yalnız
        "şu an" yayın öncesine çekilir. Yayıncının gerçek kullanım anı budur. */
  const ONCE_ZAMAN = await yayinOncesiAn();
  const once = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  izle(once, '[yayın öncesi] ');
  await once.clock.setFixedTime(new Date(ONCE_ZAMAN));
  console.log(`  ··  tarayıcı saati yayın öncesine alındı: ${new Date(ONCE_ZAMAN).toISOString()}`);
  await once.goto(WEB, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await once.waitForSelector('[aria-label="Yayın stüdyosu"]', { timeout: 90_000 });
  await once.click('[aria-label="Yayın stüdyosu"]');
  await once.waitForSelector(T('studio-bulletin-root'), { timeout: 60_000 });
  const oncePasif = await once.locator('[data-testid^="studio-row-"] [data-testid="studio-pick-1"][disabled]').count();
  not(oncePasif === 0, 'Yayın öncesi saatte hiçbir maç kilitli değil', `${oncePasif} kilitli kutu`);

  const onceRound = await once.evaluate((k) => {
    const raw = localStorage.getItem(k);
    return raw ? Object.keys(JSON.parse(raw).rounds || {})[0] : null;
  }, KEY);
  await once.evaluate(({ k, noLar, rid }) => {
    const raw = JSON.parse(localStorage.getItem(k) || '{"rounds":{}}');
    raw.rounds[rid] = raw.rounds[rid] || { roundId: rid, picks: {}, notes: {}, couponIds: [] };
    const w = raw.rounds[rid];
    noLar.forEach((n, i) => { w.picks[n] = i % 3 === 0 ? ['1'] : i % 3 === 1 ? ['1', 'X'] : ['2']; });
    localStorage.setItem(k, JSON.stringify(raw));
  }, { k: KEY, noLar: satirlar.map((r) => r.no), rid: onceRound || String(roundId) });
  await once.reload({ waitUntil: 'domcontentloaded' });
  await once.waitForSelector('[aria-label="Yayın stüdyosu"]', { timeout: 90_000 });
  await once.click('[aria-label="Yayın stüdyosu"]');
  // KAYIT ARTIK BU EKRANDA — ayrı bir kupon ekranına geçiş yok (o ekran kaldırıldı).
  await once.waitForSelector(T('studio-bulletin-save-btn'), { timeout: 60_000 });
  const engelVar = await once.locator(T('studio-bulletin-blocked')).count();
  not(engelVar === 0, 'Yayın öncesi saatte kayıt engeli yok');
  const kolonNotu = await once.locator(T('studio-bulletin-columns-note')).count();
  const dugmeKapali = await once.locator(T('studio-bulletin-save-btn')).isDisabled();
  // KOLON SINIRI BİLGİDİR, ENGEL DEĞİL (yayıncı isteği). Not çıksa bile düğme açık kalmalı.
  not(!dugmeKapali, 'Kolon sınırı aşılsa da kaydet düğmesi AÇIK', `sınır notu ${kolonNotu ? 'var' : 'yok'}`);

  await once.click(T('studio-bulletin-save-btn'));
  await once.waitForSelector(T('studio-bulletin-saved'), { timeout: 30_000 });
  not((await once.locator(T('studio-bulletin-archive')).count()) === 1, 'Kupon kaydedildi, arşiv düğmesi çıktı');
  const arsivDepo = await once.evaluate(() => localStorage.getItem('sportoto.couponCenter.v1'));
  not(!!arsivDepo && arsivDepo.length > 50, 'Kupon arşiv deposuna yazıldı',
    `${arsivDepo ? arsivDepo.length : 0} karakter`);

  // KAYDIN İÇİ — 15 maçın hepsi kupona yazıldı mı?
  // Kaldırılan final kupon ekranının "Tüm Maç Seçimleri" paneli bunu GÖZLE
  // gösteriyordu. Panel gittiği için aynı güvence artık VERİDE sınanıyor;
  // ekranın ne çizdiğine değil, arşive gerçekten ne yazıldığına bakmak daha sıkı.
  const kupon = await once.evaluate(() => {
    const list = JSON.parse(localStorage.getItem('sportoto.couponCenter.v1') || '[]');
    const son = Array.isArray(list) ? list[list.length - 1] : null;
    const v = son && son.versions && son.versions[son.versions.length - 1];
    return v ? { adet: (v.selections || []).length, kolon: v.columnCount } : null;
  });
  not(!!kupon && kupon.adet === 15, 'Kaydedilen kuponda 15 maçın seçimi de var',
    kupon ? `${kupon.adet} seçim · ${kupon.kolon} kolon` : 'kupon okunamadı');
  await once.screenshot({ path: `${OUT}07b-kupon-kaydedildi.png` });

  await once.click(T('studio-bulletin-archive'));
  await once.waitForTimeout(2000);
  await once.screenshot({ path: `${OUT}08-arsiv.png` });
  const arsivMetin = await once.locator('body').innerText();
  not(/kupon/i.test(arsivMetin), 'Arşiv (Kuponlarım) ekranı açıldı');
  await once.close();

  /* 11) KARNE — geçmiş hafta "kaç tuttu" ekranı.
     Bu kutuda resmî Spor Toto webapi'sine çıkış YOK (/api/history 502 döner),
     bu yüzden yanıt burada, DENETİM AMAÇLI, sahte bir haftayla karşılanır.
     Sahte veri YALNIZ bu betikte yaşar; uygulamaya, depoya ya da cihaza asla
     yazılmaz. Amacı tek: tablo/ikramiye/birikim panelleri gerçekten çiziliyor
     mu, sayı doğru mu. "Karne şu kadar tuttu" gibi bir iddia DEĞİLDİR. */
  const KARNE_RID = 1524;
  const karneMac = (no, ek = {}) => ({
    no, date: `2026-05-0${((no - 1) % 9) + 1}T18:00:00.000Z`, league: 'Deneme Ligi',
    home: { mediumName: `Ev ${no}`, logo: null }, away: { mediumName: `Deplasman ${no}`, logo: null }, ...ek,
  });
  const karneResmi = (no, result, h, a) => karneMac(no, { result, score: { home: h, away: a } });
  const KARNE_YANIT = {
    roundId: KARNE_RID,
    matches: [
      karneResmi(1, '1', 2, 0), karneResmi(2, '1', 1, 0), karneResmi(3, 'X', 1, 1),
      karneResmi(4, '2', 0, 2), karneResmi(5, '1', 3, 1), karneResmi(6, '2', 0, 1),
      karneResmi(7, 'X', 2, 2), karneMac(8), karneMac(9),
    ],
    prize: {
      tiers: [
        { hit: 15, count: 0, prize: 14_679_456.58 }, { hit: 14, count: 14, prize: 599_161.49 },
        { hit: 13, count: 231, prize: 36_312.81 }, { hit: 12, count: 2563, prize: 4_091.03 },
      ],
      description: 'Denetim verisi — resmî değil.', closeDate: null,
    },
    source: 'Spor Toto', checkedAt: '2026-05-10T00:00:00.000Z', resolvedCount: 7, fullyResolved: false,
  };

  const karne = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  izle(karne, '[karne] ');
  await karne.route(`${API}/api/history/**`, (route) => route.fulfill({
    status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(KARNE_YANIT),
  }));
  await karne.goto(WEB, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await karne.evaluate(({ k, rid }) => {
    const raw = JSON.parse(localStorage.getItem(k) || '{"rounds":{}}');
    raw.rounds[String(rid)] = {
      roundId: rid, notes: {}, couponIds: [], updatedAt: '2026-05-09T10:00:00.000Z',
      // 1,2,5 tek/doğru · 3 çift/doğru · 6 tek/yanlış · 4 kapalı (üçü de) · 8 seçim var ama maç bitmemiş
      picks: { 1: ['1'], 2: ['1'], 3: ['1', 'X'], 4: ['1', 'X', '2'], 5: ['1'], 6: ['1'], 8: ['2'] },
    };
    localStorage.setItem(k, JSON.stringify(raw));
  }, { k: KEY, rid: KARNE_RID });
  await karne.reload({ waitUntil: 'domcontentloaded' });
  await karne.waitForSelector('[aria-label="Yayın stüdyosu"]', { timeout: 90_000 });
  await karne.click('[aria-label="Yayın stüdyosu"]');
  await karne.waitForSelector(T('studio-goto-karne'), { timeout: 60_000 });
  await karne.click(T('studio-goto-karne'));
  await karne.waitForSelector(T('studio-karne-root'), { timeout: 60_000 });
  await karne.waitForSelector(T('studio-karne-table'), { timeout: 60_000 });
  const karneSatir = await karne.locator('[data-testid^="studio-karne-row-"]').count();
  not(karneSatir === 9, 'Karne ekranı mount oldu ve maç maç tablo çizildi', `${karneSatir} satır (9 beklenir)`);

  // SAYININ KENDİSİ: 9 maçın 7'si resmî; işaretlenen 6'sının 5'i tuttu (6. yanlış).
  // Payda HER ZAMAN bültenin tamamı olduğu için "9'te 5" beklenir — 6'da 5 değil.
  const karneSkor = (await karne.locator(T('studio-karne-score')).innerText()).trim();
  not(karneSkor === "9'te 5", 'Karne skoru resmî sonuçtan doğru sayıldı', `ekranda "${karneSkor}"`);

  const kapaliNot = await karne.locator(T('studio-karne-kapali-note')).innerText().catch(() => '');
  not(/üçü de işaretliydi/.test(kapaliNot), 'Kapalı (1-0-2) işaret sayıyı şişiriyor uyarısı yazılı',
    kapaliNot.replace(/\s+/g, ' ').slice(0, 80));

  const ikramiye = await karne.locator(T('studio-karne-prize')).innerText();
  not(/DEVRETTİ/.test(ikramiye) && /599\.161,49/.test(ikramiye),
    'Resmî ikramiye tablosu çizildi (tutar biçimlendi, hesaplanmadı)');
  not(!/kolon bedeli\s*:|maliyet\s*:/i.test(ikramiye), 'İkramiye panelinde uydurma kupon maliyeti yok');

  const birikim = await karne.locator(T('studio-karne-cumulative')).innerText();
  not(/hafta/i.test(birikim), 'Haftalar arası birikimli karne paneli çizildi');
  // Karne geçmişi anlatır, hüküm vermez: "tuttu/tutmadı" resmî sonuçtur,
  // "güvenliydi/riskliydi" ise bir değerlendirmedir ve yazılmaz.
  await hukumDenetle(karne.locator(T('studio-karne-root')), 'Karne ekranı');
  await karne.screenshot({ path: `${OUT}11-karne.png` });

  // Dar ekranda da açılmalı: yayıncı telefondan da bakıyor.
  await karne.setViewportSize({ width: 390, height: 844 });
  await karne.waitForTimeout(500);
  const karneTasma = await karne.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  not(karneTasma <= 1, 'Karne dar ekranda yatay taşmıyor', `taşma ${karneTasma}px`);
  // Telefonda tablo özet panelinin ALTINDA kalıyor; asıl sınav orası.
  await karne.locator(T('studio-karne-row-9')).scrollIntoViewIfNeeded();
  await karne.waitForTimeout(400);
  const darSatir = await karne.locator('[data-testid^="studio-karne-row-"]').count();
  not(darSatir === 9, 'Dar ekranda maç maç tablo da çizildi', `${darSatir} satır`);
  await karne.screenshot({ path: `${OUT}11b-karne-dar.png` });
  await karne.close();

  /* 12) DAR EKRAN (telefon genişliği) */
  const dar = await browser.newPage({ viewport: { width: 390, height: 844 } });
  izle(dar, '[dar] ');
  await dar.goto(WEB, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await dar.waitForSelector('[aria-label="Yayın stüdyosu"]', { timeout: 90_000 });
  await dar.click('[aria-label="Yayın stüdyosu"]');
  await dar.waitForSelector(T('studio-bulletin-root'), { timeout: 60_000 });
  not((await dar.locator('[data-testid^="studio-row-"]').count()) === 15,
    'Dar ekranda (390px) bülten çizildi');
  await dar.screenshot({ path: `${OUT}09-dar-bulten.png` });
  await dar.click(T(`studio-analiz-${no}`));
  await dar.waitForSelector(T('studio-match-root'), { timeout: 60_000 });
  await dar.waitForTimeout(600);
  // TELEFON GENİŞLİĞİ ASIL SINAV: 7 sekme buraya sığmaz, sola kaymak ZORUNDA.
  const darSerit = await dar.locator(T('studio-section-strip')).evaluate((el) => ({ s: el.scrollWidth, g: el.clientWidth }));
  not(darSerit.s > darSerit.g, 'Dar ekranda şerit gerçekten sola kaydırılabilir',
    `içerik ${darSerit.s}px / görünen ${darSerit.g}px`);
  await dar.locator(T('studio-section-strip')).evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  await dar.waitForTimeout(400);
  const kaydi = await dar.locator(T('studio-section-strip')).evaluate((el) => el.scrollLeft);
  not(kaydi > 0, 'Kaydırma hareketi uygulandı, son sekme görünür oldu', `scrollLeft=${Math.round(kaydi)}px`);
  await dar.screenshot({ path: `${OUT}10-dar-mac-detay.png` });

  // Taşma denetimi: yatay sayfa kaydırması OLMAMALI (şerit hariç).
  const tasma = await dar.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  not(tasma <= 1, 'Dar ekranda sayfa yatay taşmıyor', `taşma ${tasma}px`);

  await browser.close();

  /* ——— RAPOR ——— */
  const gecen = adimlar.filter((a) => a.ok).length;
  console.log(`\n———— ${gecen}/${adimlar.length} adım geçti ————`);
  const tek = (a) => [...new Set(a)];

  const agOzet = new Map();
  for (const h of agHatalar) {
    const k = h.replace(/\d+/g, '#').slice(0, 70);
    agOzet.set(k, (agOzet.get(k) || 0) + 1);
  }
  console.log(`\nAğ/kaynak hatası (bu kutuda dış ağ ve veritabanı YOK — beklenir): ${agHatalar.length}`);
  for (const [k, n] of [...agOzet].slice(0, 8)) console.log(`  · ${n}× ${k.replace(/\s+/g, ' ')}`);

  if (ktpHatalar.length) {
    console.log(`\nKÜTÜPHANE UYARISI (${ktpHatalar.length}) — bizim kodumuz değil, yine de sayıldı:`);
    console.log('  · @react-navigation/elements React\'a collapsable={false} geçiyor.');
    console.log('    Stüdyoya girmeden ana ekranda da çıkar; kendi kaynağımızda "collapsable" hiç geçmiyor.');
  }

  if (jsHatalar.length) {
    console.log(`\nKOD HATASI (${tek(jsHatalar).length}) — DÜZELTİLMELİ:`);
    for (const h of tek(jsHatalar)) console.log('  ✗', h.replace(/\s+/g, ' ').slice(0, 300));
  } else {
    console.log('\nKOD HATASI: yok.');
  }
  console.log(`Görüntüler: ${OUT}`);
  process.exitCode = (gecen === adimlar.length && jsHatalar.length === 0) ? 0 : 1;
}

main().catch((e) => {
  console.error('ÇİZİM DENETİMİ ÇÖKTÜ:', e?.message?.split('\n')[0] || e);
  console.error((e?.stack || '').split('\n').slice(1, 5).join('\n'));
  if (jsHatalar.length) {
    console.error(`\nO ANA KADARKİ KOD HATALARI (${jsHatalar.length}):`);
    for (const h of [...new Set(jsHatalar)].slice(0, 15)) console.error('  ✗', h.replace(/\s+/g, ' ').slice(0, 300));
  }
  process.exitCode = 1;
});
