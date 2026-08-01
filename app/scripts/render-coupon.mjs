/**
 * GERÇEK ÇİZİM DENETİMİ — kupon ekranları (4 ekran, stüdyo tablosu).
 *
 * NEDEN: kaynak-metin testleri (test/coupon-studio-look.test.mjs) dosyanın NE
 * YAZDIĞINI korur; bu betik tarayıcıyı gerçekten açar ve ekranın NE ÇİZDİĞİNE
 * bakar. Bileşen mount olurken patlarsa bundle yine 200 döner — orada yakalanmaz,
 * burada yakalanır.
 *
 * BU BİR BİRİM TESTİ DEĞİLDİR: `npm test` test/ altını toplar, bu yüzden dosya
 * scripts/ altındadır. Elle çalıştırılır:
 *   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/render-coupon.mjs
 * Gerekli: Expo web :8081 ve backend :4000 ayakta olmalı.
 *
 * DÜRÜSTLÜK NOTU: burada geçmesi GERÇEK ANDROID CİHAZDA geçtiği anlamına GELMEZ.
 * Yalnız web çiziminin ayakta olduğunu gösterir.
 *
 * ARMA (KULÜP LOGOSU) HAKKINDA — OKUNMADAN GEÇİLMESİN:
 * Bu kutuda dış ağ yok; önbellekteki bültende `logo` alanı BOŞ gelir (0/15).
 * Yani burada "armalar göründü" DENEMEZ. Bunun yerine iki ayrı şey ölçülür:
 *   1) Armasız hâl  — her satırda nötr ⚽ yuvası çiziliyor mu (takım karışmasın
 *      diye başka kulübün arması ASLA konmaz; boşluk da bırakılmaz).
 *   2) Armalı hâl   — /api/crest ucu yerel bir DENETİM GÖRSELİYLE karşılanır;
 *      böylece <Image> yolu, satır hizası ve kareye gömme gerçekten sınanır.
 *      Bu görsel bir kulüp arması DEĞİLDİR, uygulamaya/depoya yazılmaz, yalnız
 *      bu betiğin belleğinde yaşar. (render-studio.mjs'deki karne verisi de aynı
 *      mantıkla, aynı sınırlarla sahnelenir.)
 * Gerçek armalar ancak kullanıcının makinesinde, gerçek anahtarla doğrulanır.
 *
 * HAFTA LİSTESİ HAKKINDA:
 * `/api/rounds` bu kutuda 502 döner (dış ağ yok). O yüzden hafta zarfı
 * ÖNBELLEKTEKİ GERÇEK BÜLTENDEN türetilip sahnelenir — ayrıntı ve gerekçe için
 * aşağıdaki `haftaZarfi()` başlığına bak. Gerçek uç çalışıyorsa sahne devreye
 * GİRMEZ, gerçek cevap kullanılır.
 */
import { mkdir } from 'node:fs/promises';

// Playwright KÜRESEL kurulu (projeye paket eklenmedi — package.json'a dokunulmadı).
const PW = process.env.PLAYWRIGHT_PKG || '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const pw = await import(PW);
const { chromium } = pw.chromium ? pw : pw.default;

const WEB = 'http://localhost:8081';
const API = process.env.API_BASE || 'http://localhost:4000';
const OUT = new URL('../.render/', import.meta.url).pathname;
const T = (id) => `[data-testid="${id}"]`;

/* Hüküm yasağı: kupon ekranları da yayıncı ekranlarıyla aynı dili konuşur. */
const YASAK_HUKUM = /riskli|risksiz|güvenli|güvensiz|temkinli|toplam risk|risk sinyali|risk yorumu|veri güveni|belirsizlik/i;
/* İddialı dil yasağı (CLAUDE.md): ekrana yazılmaz. */
const YASAK_IDDIA = /kesin|garanti|banko|yanılmaz|net favori|kaçmaz|kazandırır/i;

const jsHatalar = [];
const agHatalar = [];
const ktpHatalar = [];
const adimlar = [];

const AG_IZI = /Failed to load resource|ERR_TUNNEL|ERR_CONNECTION|net::/i;
const KTP_IZI = /non-boolean attribute[\s\S]*collapsable|collapsable[\s\S]*non-boolean/i;

const not = (ok, ad, ek = '') => {
  adimlar.push({ ok, ad, ek });
  console.log(`${ok ? '  ok  ' : '  ✗ ! '}${String(adimlar.length).padStart(2)}) ${ad}${ek ? ` — ${ek}` : ''}`);
};

const izle = (p, etiket = '') => {
  p.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    (AG_IZI.test(t) ? agHatalar : KTP_IZI.test(t) ? ktpHatalar : jsHatalar).push(etiket + t);
  });
  p.on('pageerror', (e) => jsHatalar.push(`${etiket}pageerror: ${e.message}`));
  p.on('requestfailed', (r) => agHatalar.push(`${etiket}${r.url().slice(0, 90)} :: ${r.failure()?.errorText}`));
  p.on('response', (r) => { if (r.status() >= 400) agHatalar.push(`${etiket}HTTP ${r.status()} ${r.url().slice(0, 90)}`); });
};

/**
 * YALNIZ GÖRÜNEN EKRANIN METNİ.
 * Sekmeli gezinmede react-navigation önceki ekranları DOM'da tutar (gizler).
 * `body.innerText` okunursa ana sayfanın analiz cümleleri de taranır ve kupon
 * ekranına ait olmayan bir sözcük yüzünden yanlış alarm verir. Bu yüzden
 * gizlenmiş ağaçlar (display:none / visibility:hidden / aria-hidden) atılır.
 */
const gorunurMetin = (page) => page.evaluate(() => {
  const parca = [];
  const gez = (e) => {
    if (e.nodeType === 3) { parca.push(e.nodeValue); return; }
    if (e.nodeType !== 1) return;
    const s = getComputedStyle(e);
    if (s.display === 'none' || s.visibility === 'hidden' || e.getAttribute('aria-hidden') === 'true') return;
    for (const c of e.childNodes) gez(c);
  };
  gez(document.body);
  return parca.join(' ');
});

/**
 * İZİNLİ "kesin" — CLAUDE.md kuralı iddialı dili yasaklar AMA aynı kural
 * "Yalnız resmî Spor Toto sonucu kesindir" cümlesini ZORUNLU kılar. Tarama
 * bu cümleyi yasak sanmasın diye, denetimden ÖNCE metinden çıkarılır.
 * Çıkarılan tek şey bu dürüstlük cümlesidir; "kesin" başka bir yerde geçerse
 * yine yakalanır.
 */
const IZINLI_KESIN = [
  // brand.js · NO_GUARANTEE_NOTICE — her paylaşım görselinde ZORUNLU.
  /Kesin sonuç veya kazanç vaadi değildir\.?/gi,
  // "Yalnız resmî Spor Toto sonucu kesindir" / "Yalnız resmî 90 dakika sonucu kesindir"
  /(yalnız|sadece)\s+resm[îi][^.]*sonucu\s+kesindir/gi,
  // "…canlı ve geçici veriler kesin sayılmaz" — kesinliği REDDEDEN cümle.
  /kesin\s+sayılmaz/gi,
];

/** Ekranda çizilmiş metinde yasak sözcük var mı? */
const dilDenetle = async (kaynak, ekranAdi) => {
  const ham = (typeof kaynak === 'function' ? await kaynak() : await kaynak.innerText()).replace(/\s+/g, ' ');
  const metin = IZINLI_KESIN.reduce((s, kalip) => s.replace(kalip, '«zorunlu dürüstlük bildirimi»'), ham);
  const hukum = metin.match(YASAK_HUKUM);
  const iddia = metin.match(YASAK_IDDIA);
  not(!hukum && !iddia, `${ekranAdi}: hüküm/iddia sözcüğü YOK`,
    hukum || iddia ? `YASAK SÖZCÜK → "${(hukum || iddia)[0]}"` : `${metin.length} karakter tarandı`);
};

/**
 * Tablo satırının stüdyo biçiminde olup olmadığını ölçer.
 * Sıra numarası + iki arma yuvası + iki takım adı + 1-0-2 kutuları.
 */
const satirOlc = (page, onEk) => page.locator(onEk).evaluateAll((els) => els.map((e) => {
  const kutular = [...e.querySelectorAll('[data-testid^="studio-pick-"]')].map((x) => x.innerText.trim());
  return {
    id: e.getAttribute('data-testid'),
    metin: (e.innerText || '').replace(/\s+/g, ' ').trim(),
    // Arma yuvası: yüklenmiş <img> ya da nötr ⚽ kutusu. İkisi de yoksa yuva YOK demektir.
    img: e.querySelectorAll('img').length,
    top: (e.innerText || '').match(/⚽/g)?.length || 0,
    kutular,
    yukseklik: Math.round(e.getBoundingClientRect().height),
    zemin: getComputedStyle(e).backgroundColor,
  };
}));

/** Zebra: ardışık satırların zemini dönüşümlü olmalı. */
const zebraVar = (satirlar) => {
  const z = satirlar.map((s) => s.zemin);
  return new Set(z).size >= 2 && z.some((v, i) => i > 0 && v !== z[i - 1]);
};

/* DENETİM GÖRSELİ — 1×1 turkuaz PNG. Kulüp arması değildir; yalnız <Image>
   yolunun ve kareye gömmenin sınanması için /api/crest'e cevap olarak verilir. */
const DENETIM_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Bülteni bir kez oku (hem saat hem hafta zarfı bundan türer). */
let _bulten = null;
async function bulten() {
  if (_bulten) return _bulten;
  try { _bulten = await (await fetch(`${API}/api/bulletin`)).json(); }
  catch { _bulten = {}; }
  return _bulten;
}

/** Bültendeki EN ERKEN maçtan 2 saat öncesi: kuponun gerçek yazılma anı. */
async function yayinOncesiAn() {
  const j = await bulten();
  const anlar = (j.matches || [])
    .map((m) => new Date(m.date || m.matchDate || m.startsAt).getTime())
    .filter((n) => Number.isFinite(n));
  if (anlar.length) return Math.min(...anlar) - 2 * 3600_000;
  return Date.now() - 7 * 86_400_000;
}

/**
 * HAFTA LİSTESİ ZARFI — neden sahneleniyor?
 * `/api/rounds` resmi Spor Toto webapi'sine canlı gider; bu kutuda dış ağ yok,
 * uç 502 döner. O zaman Kupon Merkezi "Sezon bilgisi yok" der, `selectedId`
 * null kalır ve düzenleyiciye `roundId: null` gider — ekran tabloyu değil
 * "bu hafta güncel bülten değil" hatasını çizer. Yani ölçmek istediğimiz şey
 * hiç görünmez.
 *
 * SAHTE VERİ DEĞİL: hafta numarası, sezon ve kapanış tarihi ÖNBELLEKTEKİ
 * GERÇEK BÜLTENDEN okunur (roundId 1525 / "51. Hafta" / "2025/2026"). Yalnız
 * bu kutunun çekemediği "hafta listesi zarfı" tamamlanır. Uydurulan tek şey
 * yok; maçlar, takımlar ve tarihler zaten gerçek uçtan gelir.
 * Bu sahne YALNIZ bu betikte yaşar; uygulamaya, depoya ya da cihaza yazılmaz.
 * (render-studio.mjs'de karne verisi de aynı sınırla sahnelenir.)
 */
async function haftaZarfi() {
  const b = await bulten();
  if (b?.roundId == null) return null;
  return {
    currentRoundId: b.roundId,
    rounds: [{
      id: b.roundId,
      name: b.round || null,
      year: b.year || null,
      closeDate: b.closeDate || null,
      isPublished: true,
    }],
  };
}

/**
 * GEÇMİŞ HAFTA ZARFI — `/api/history/:id` de canlı resmî API'ye gider, bu kutuda
 * 502 döner. Paylaş ve Sonuç ekranları o uçtan dönmezse hata ekranı çizer, yani
 * ölçeceğimiz tablo hiç mount olmaz.
 *
 * SONUÇ UYDURULMAZ — burada verilen zarf, önbellekteki GERÇEK maçların kendisidir
 * ve resmî sonuç alanları OLDUĞU GİBİ (boş) bırakılır: `prize: null`,
 * `resolvedCount: 0`. Yani "bu haftanın resmî sonucu henüz yok" denir; bu doğru
 * olandır (bültenin kapanışı 2026-07-24, maçlar sonrasında). Hiçbir skor, hiçbir
 * 1/X/2, hiçbir ikramiye üretilmez. Sahne yalnız bu betikte yaşar.
 */
async function gecmisZarfi() {
  const b = await bulten();
  if (b?.roundId == null) return null;
  /* ARMA YOLU SINAMASI — okunmadan geçilmesin:
     Önbellekteki bültende `logo` alanı boş (0/15), çünkü bu kutuda arma
     sağlayıcısına erişim yok. Boş bırakılırsa ekran nötr ⚽ çizer ve <Image>
     yolu HİÇ çalışmaz; hizalama, kırpma ve kareye gömme sınanamaz.
     Bu yüzden YALNIZ bu sahnede her takıma bir DENETİM ADRESİ verilir; adres
     /api/crest'e gider ve orada 1×1 turkuaz PNG ile karşılanır.
     BU BİR KULÜP ARMASI DEĞİLDİR ve bir kulübe ait değildir — "başka kulübün
     arması ya da benzeri görsel konmaz" kuralı çiğnenmez, çünkü uygulamaya,
     depoya ya da cihaza hiçbir şey yazılmaz; görsel yalnız bu betiğin
     belleğinde yaşar. Düzenleyici ekranı (/api/bulletin) sahnelenmediği için
     nötr ⚽ hâli de aynı koşuda ölçülmeye devam eder. */
  const denetimArma = (t) => `${API}/api/crest?probe=${encodeURIComponent(t || 'x')}`;
  const matches = (b.matches || []).map((m) => ({
    no: m.no, date: m.date, league: m.league,
    home: { ...m.home, logo: m.home?.logo || denetimArma(m.home?.name) },
    away: { ...m.away, logo: m.away?.logo || denetimArma(m.away?.name) },
    score: m.score ?? null,       // önbellekte ne varsa o — uydurma yok
    result: m.result ?? null,
    status: m.status ?? null,
  }));
  return {
    roundId: b.roundId,
    matchCount: matches.length,
    matches,
    prize: null,                                   // ikramiye açıklanmadı
    source: 'Spor Toto',
    checkedAt: new Date(b.updatedAt || Date.now()).toISOString(),
    resolvedCount: matches.filter((m) => m.result && m.score).length,
  };
}

/**
 * Sahnelenen zarfları sayfaya bağla.
 * ÖNCE gerçek uç denenir; 2xx dönerse GERÇEK cevap kullanılır ve sahne hiç
 * devreye girmez. Yalnız uç düştüğünde (bu kutuda 502) zarf verilir.
 */
async function zarfiBagla(page, zarf, gecmis) {
  const vekil = (govde) => async (route) => {
    try {
      const y = await route.fetch();
      if (y.ok()) return route.fulfill({ response: y });
    } catch { /* uç yok */ }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(govde) });
  };
  if (zarf) await page.route('**/api/rounds**', vekil(zarf));
  if (gecmis) await page.route('**/api/history/**', vekil(gecmis));
  return !!zarf;
}

/**
 * Kupon kartındaki maç tablosunu istenen duruma getirir (aç/kapa).
 * Tek kupon varken tablo varsayılan olarak AÇIK gelir; düğmeye körlemesine
 * basmak onu kapatır. Düğmenin kendi yazısı ("maçları göster ▾" / "gizle ▴")
 * gerçek durumu söyler, karar ona bakılarak verilir.
 */
async function acKapaAyarla(page, acikOlsun) {
  const d = page.locator('[data-testid^="kupon-mac-ac-"]').first();
  if (!(await d.count())) return;
  const yazi = (await d.innerText()).toLowerCase();
  const suanAcik = yazi.includes('gizle');
  if (suanAcik !== acikOlsun) { await d.click(); await page.waitForTimeout(700); }
}

/**
 * PAYLAŞILAN KADRAJIN METNİ — gizlilik denetiminin taradığı tam bölge.
 *
 * Kadraj <ViewShot>'tır ama ona testID KONAMAZ: kitaplık yalnız bildiği
 * prop'ları geçirir, testID'yi düşürür. Sabit bir ata seviyesi (ancestor::*[3])
 * de kırılgandır — fazla yukarı çıkınca ekranın "görselde e-posta bulunmaz"
 * açıklaması taranan metne karışır ve kendi güvencesini ihlal sanan YANLIŞ
 * ALARM üretir.
 *
 * Bu yüzden kadraj DOM'dan bulunur: tablodan yukarı çıkılır, dürüstlük
 * bildirimini (18+ · "Kesin sonuç veya kazanç vaadi değildir.") İÇEREN İLK ata
 * kadrajdır — o bildirim <ViewShot> içindedir, ekranın alt açıklamaları dışında.
 */
const kadrajMetni = (page) => page.evaluate(() => {
  let e = document.querySelector('[data-testid="kupon-paylas-tablo"]');
  while (e && e !== document.body) {
    const m = e.innerText || '';
    if (/Kesin sonuç veya kazanç vaadi değildir/i.test(m) && /18\+/.test(m)) return m;
    e = e.parentElement;
  }
  return '';
});

/** Alt ekrandan (Paylaş/Sonuç) Kupon Merkezine dön: sekmeye basmak yığını tepeye alır. */
async function merkezeDon(page) {
  await page.click('a[href="/CouponsTab"][role="tab"]');
  await page.waitForSelector('[data-testid^="kupon-karti-"]', { timeout: 30_000 });
  await page.waitForTimeout(800);
}

/** Kupon kartı içindeki bir düğmeye bas (gizli sekmelerdeki aynı yazıya değil). */
const kartDugmesi = (page, yazi) => page
  .locator('[data-testid^="kupon-karti-"]').first()
  .getByText(yazi, { exact: true }).first();

/** Kuponlarım sekmesine geç. Sekme çubuğu react-navigation'da <a href="/CouponsTab">. */
async function kuponSekmesi(page) {
  await page.click('a[href="/CouponsTab"][role="tab"]');
  // Adres çubuğu DEĞİŞMEZ: uygulamada derin bağlantı (linking) yapılandırması yok.
  // Bu yüzden geçiş, ekranın kendi işaretiyle beklenir.
  await page.waitForSelector(
    '[data-testid^="kupon-karti-"], :text("Kupon Oluştur"), :text("Yeni Kupon"), :text("Bu hafta kuponun yok")',
    { timeout: 60_000 },
  );
  await page.waitForTimeout(1200);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  /* Saat yayın öncesine alınır: kupon ilk maç başlamadan yazılır, düzenleyici
     ancak o zaman açıktır. VERİ SAHTE DEĞİL — aynı bülten, aynı 15 maç. */
  const ONCE = await yayinOncesiAn();
  const ZARF = await haftaZarfi();
  const GECMIS = await gecmisZarfi();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  izle(page);
  await page.clock.setFixedTime(new Date(ONCE));
  console.log(`  ··  tarayıcı saati yayın öncesine alındı: ${new Date(ONCE).toISOString()}`);
  if (await zarfiBagla(page, ZARF, GECMIS)) {
    console.log(`  ··  hafta zarfı sahnelendi (gerçek uç 502 ise): ${ZARF.rounds[0].year} · ${ZARF.rounds[0].name} · id ${ZARF.currentRoundId}`);
  } else {
    console.log('  ··  UYARI: bülten okunamadı, hafta zarfı sahnelenemedi.');
  }

  /* ARMA SAHNESİ: /api/crest denetim görseliyle karşılanır (yukarıdaki nota bak). */
  let crestIstek = 0;
  await page.route('**/api/crest**', (route) => {
    crestIstek += 1;
    return route.fulfill({ status: 200, contentType: 'image/png', body: DENETIM_PNG });
  });

  /* 1) AÇILIŞ + KUPONLARIM */
  await page.goto(WEB, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForSelector('[aria-label="Yayın stüdyosu"]', { timeout: 90_000 });
  not(true, 'Uygulama açıldı');
  await kuponSekmesi(page);
  const merkezMetin = (await gorunurMetin(page)).replace(/\s+/g, ' ');
  not(/Kupon Oluştur|Yeni Kupon|Bu hafta kuponun yok/i.test(merkezMetin),
    'Kupon Merkezi ekranı çizildi', merkezMetin.slice(0, 90));
  await page.screenshot({ path: `${OUT}20-kupon-merkez-bos.png`, fullPage: true });

  /* 2) KUPON HAZIRLA — stüdyo tablosu */
  await page.getByText(/Kupon Oluştur|Yeni Kupon/i).first().click();
  await page.waitForSelector(T('kupon-tablo'), { timeout: 60_000 });
  not(true, 'Kupon Hazırla ekranı mount oldu (tablo çerçevesi var)');

  const satirlar = await satirOlc(page, '[data-testid^="kupon-satir-"]');
  not(satirlar.length === 15, 'Düzenleyicide 15 maç satırı çizildi', `${satirlar.length} satır`);
  not(zebraVar(satirlar), 'Zebra (dönüşümlü satır zemini) uygulanıyor',
    `${new Set(satirlar.map((s) => s.zemin)).size} farklı zemin`);
  const yuva = satirlar.filter((s) => s.img + s.top >= 2).length;
  not(yuva === satirlar.length, 'Her satırda İKİ arma yuvası var (görsel ya da nötr ⚽)',
    `${yuva}/${satirlar.length} satır · yüklenen görsel ${satirlar.reduce((a, s) => a + s.img, 0)} · nötr ⚽ ${satirlar.reduce((a, s) => a + s.top, 0)}`);
  const siraTam = satirlar.every((s, i) => new RegExp(`^${i + 1}\\b`).test(s.metin));
  not(siraTam, 'Sıra numarası her satırın başında ve bülten sırasında');
  const harfler = [...new Set(satirlar.flatMap((s) => s.kutular))].sort();
  not(harfler.includes('0') && !harfler.includes('X'),
    'Seçim kutuları resmî yazımı basıyor (1-0-2 · "X" yok)', `kutularda: ${harfler.join(' ')}`);
  const baslik = (await page.locator(T('kupon-tablo')).innerText()).replace(/\s+/g, ' ');
  not(/EV SAHİBİ\s*-\s*KONUK TAKIM/i.test(baslik) && /SIRA/i.test(baslik),
    'Tablo başlığı stüdyodakiyle aynı', baslik.slice(0, 70));
  await dilDenetle(() => gorunurMetin(page), 'Kupon Hazırla');
  await page.screenshot({ path: `${OUT}21-kupon-hazirla.png`, fullPage: true });

  /* 3) SEÇİM + KAYIT — düzenleyici gerçekten çalışıyor mu? */
  for (let i = 1; i <= 15; i += 1) {
    await page.locator(T(`kupon-satir-${i}`)).locator(T('studio-pick-1')).click();
  }
  await page.waitForTimeout(400);
  /* İşaret gerçekten basıldı mı? Kutu bir <button> değil, RN-web'de View olduğu
     için aria-checked yoktur; işaret RENKLE gösterilir. Bu yüzden seçili kutu,
     seçili OLMAYAN kutulardan zemin rengiyle ayrılır. */
  const isaret = await page.locator('[data-testid^="kupon-satir-"]').evaluateAll((satirlar) => {
    let secili = 0;
    for (const s of satirlar) {
      const bir = s.querySelector('[data-testid="studio-pick-1"]');
      const iki = s.querySelector('[data-testid="studio-pick-2"]');
      if (!bir || !iki) continue;
      if (getComputedStyle(bir).backgroundColor !== getComputedStyle(iki).backgroundColor) secili += 1;
    }
    return secili;
  });
  not(isaret === 15, 'On beş satıra da işaret basıldı (kutu zemini değişti)', `${isaret}/15 satır`);
  await page.getByText('Kaydet', { exact: true }).first().click();
  await page.waitForTimeout(1500);
  const arsiv = await page.evaluate(() => localStorage.getItem('sportoto.couponCenter.v1'));
  const kupon = await page.evaluate(() => {
    const l = JSON.parse(localStorage.getItem('sportoto.couponCenter.v1') || '[]');
    const s = Array.isArray(l) ? l[l.length - 1] : null;
    const v = s && s.versions && s.versions[s.versions.length - 1];
    return v ? { adet: (v.selections || []).length, kolon: v.columnCount } : null;
  });
  not(!!kupon && kupon.adet === 15, 'Kupon kaydedildi ve 15 maçın seçimi içinde',
    kupon ? `${kupon.adet} seçim · ${kupon.kolon} kolon` : `arşiv ${arsiv ? arsiv.length : 0} karakter`);

  /* 4) KUPON MERKEZİ — kaydedilen kupon stüdyo tablosuyla açılıyor mu? */
  await page.waitForTimeout(800);
  const kartId = await page.locator('[data-testid^="kupon-karti-"]').first().getAttribute('data-testid').catch(() => null);
  not(!!kartId, 'Kupon Merkezinde kupon kartı göründü', kartId || 'kart yok');
  /* DİKKAT: tek kupon varken tablo ZATEN AÇIK gelir (ekranın varsayılanı).
     Körlemesine tıklamak onu KAPATIR. Bu yüzden yalnız kapalıysa açılır. */
  await acKapaAyarla(page, true);
  const merkezSatir = await satirOlc(page, '[data-testid^="kupon-merkez-satir-"]');
  not(merkezSatir.length === 15, 'Merkezde maç listesi stüdyo tablosuyla açıldı', `${merkezSatir.length} satır`);
  const merkezYuva = merkezSatir.filter((s) => s.img + s.top >= 2).length;
  not(merkezSatir.length > 0 && merkezYuva === merkezSatir.length,
    'Merkez satırlarında da iki arma yuvası var', `${merkezYuva}/${merkezSatir.length}`);
  /* Kaydedilmiş kuponda her satır işaretlidir; hepsini vurgulamak zebrayı
     yutup listeyi tek renk soluk bir bloğa çeviriyordu. */
  not(zebraVar(merkezSatir), 'Merkezde zebra korunuyor (liste tek renk bloğa dönmemiş)',
    `${new Set(merkezSatir.map((s) => s.zemin)).size} farklı zemin`);
  const merkezPasif = await page.locator('[data-testid^="kupon-merkez-satir-"] [data-testid^="studio-pick-"]')
    .evaluateAll((els) => els.length && els.every((e) => e.disabled || e.getAttribute('aria-disabled') === 'true'));
  not(merkezPasif, 'Merkezdeki 1-0-2 kutuları SALT OKUNUR (ikinci bir düzenleme yüzeyi değil)');
  await dilDenetle(() => gorunurMetin(page), 'Kupon Merkezi');
  await page.screenshot({ path: `${OUT}22-kupon-merkez.png`, fullPage: true });

  /* 5) KUPONU PAYLAŞ — kare gerçekten üretiliyor mu? */
  /* Düğme KUPON KARTININ İÇİNDEN seçilir: gizli sekmelerde de "Paylaş" yazan
     ögeler var, ilk eşleşme yanlış ekrana götürebiliyor. */
  await kartDugmesi(page, 'Paylaş').click();
  await page.waitForSelector(T('kupon-paylas-tablo'), { timeout: 60_000 });
  not(true, 'Kuponu Paylaş ekranı mount oldu');
  const paySatir = await satirOlc(page, '[data-testid^="kupon-paylas-satir-"]');
  not(paySatir.length === 15, 'Paylaşım karesinde 15 maç satırı var', `${paySatir.length} satır`);
  const payYuva = paySatir.filter((s) => s.img + s.top >= 2).length;
  not(paySatir.length > 0 && payYuva === paySatir.length, 'Kare satırlarında iki arma yuvası var',
    `${payYuva}/${paySatir.length}`);

  /* SOLUK KARE DENETİMİ — yaşanan hata buydu: "paylaşım yapınca soluk duruyor
     kupon". Kutulara `disabled` verildiği için hepsi %42 saydamlıkla çiziliyor,
     işaretin turuncusu (#D2551F) beyaz üstünde açık somona dönüyordu. Salt
     okunur olmak SOLUK olmayı gerektirmez: karede hiçbir kutuya zaten
     dokunulamaz, soldurmak bilgi taşımaz, yalnız görseli silikleştirir. */
  const koyuluk = await page.locator('[data-testid^="kupon-paylas-satir-"]').evaluateAll((satirlar) => {
    const isaretli = [];
    for (const s of satirlar) {
      for (const k of s.querySelectorAll('[data-testid^="studio-pick-"]')) {
        const g = getComputedStyle(k);
        // İşaretli kutu = zemini beyaz/şeffaf olmayan kutu.
        const rgb = (g.backgroundColor.match(/[\d.]+/g) || []).map(Number);
        const dolu = rgb.length >= 3 && !(rgb[0] > 240 && rgb[1] > 240 && rgb[2] > 240) && (rgb[3] ?? 1) > 0;
        if (dolu) isaretli.push({ zemin: g.backgroundColor, saydam: Number(g.opacity) });
      }
    }
    return isaretli;
  });
  const solukKutu = koyuluk.filter((k) => k.saydam < 1);
  not(koyuluk.length === 15 && solukKutu.length === 0,
    'Karedeki işaretler TAM KOYULUKTA çiziliyor (soluk değil)',
    `${koyuluk.length} işaretli kutu · soluk ${solukKutu.length}`
    + (koyuluk[0] ? ` · zemin ${koyuluk[0].zemin} · saydamlık ${koyuluk[0].saydam}` : ''));
  /* Kupondaki HER satır işaretlidir; hepsini vurgu rengine boyamak zebrayı
     yutup tabloyu tek renk soluk bir bloğa çeviriyordu. */
  not(zebraVar(paySatir), 'Karede zebra korunuyor (satırlar tek renk bloğa dönmemiş)',
    `${new Set(paySatir.map((s) => s.zemin)).size} farklı zemin`);

  const kareMetin = (await kadrajMetni(page)).replace(/\s+/g, ' ');
  not(/Kesin sonuç veya kazanç vaadi değildir/i.test(kareMetin) && /18\+/.test(kareMetin),
    'Karede dürüstlük bildirimi ve 18+ yazılı');
  /* Kişisel veri izi: e-posta, telefon, oturum anahtarı. Yalın "@" aranmaz —
     takım/lig adında geçebilir; aranan şey GERÇEK bir e-posta biçimidir. */
  const kisisel = kareMetin.match(/[\w.+-]+@[\w-]+\.[\w.]+|\+90[\s-]?\d|\b(token|jeton|e-posta|oturum anahtarı)\b/i);
  not(!kisisel, 'Karede kişisel veri izi yok', kisisel ? `İZ BULUNDU → "${kisisel[0]}"` : `${kareMetin.length} karakter tarandı`);
  not(/Kolon:\s*\d+/.test(kareMetin), 'Karede kolon sayısı yazılı', (kareMetin.match(/Kolon:\s*\d+/) || [''])[0]);
  await dilDenetle(() => gorunurMetin(page), 'Kuponu Paylaş');
  await page.screenshot({ path: `${OUT}23-kupon-paylas.png`, fullPage: true });

  // KARE ÜRETİMİ: düğmeye gerçekten basılır. Bu kutuda navigator.share yok →
  // yol indirme dalına düşer; indirilen dosya yakalanıp ÖLÇÜLÜR (boyut, tür).
  const indirmeSozu = page.waitForEvent('download', { timeout: 45_000 }).catch(() => null);
  await page.click(T('kupon-paylas-btn'));
  const indirme = await indirmeSozu;
  const mesaj = (await page.locator(T('kupon-paylas-mesaj')).innerText().catch(() => '')).replace(/\s+/g, ' ');
  if (indirme) {
    const yol = `${OUT}24-kupon-kare.png`;
    await indirme.saveAs(yol);
    const { statSync, readFileSync } = await import('node:fs');
    const boyut = statSync(yol).size;
    const bas = readFileSync(yol).subarray(0, 8).toString('hex');
    const ad = indirme.suggestedFilename();
    not(boyut > 20_000 && bas === '89504e470d0a1a0a', 'Paylaşım karesi GERÇEKTEN üretildi (PNG)',
      `${ad} · ${(boyut / 1024).toFixed(0)} KB`);
    not(!/\d{3,}/.test(ad.replace(/hafta-\d+/, '')) && !/kupon-\d+|couponId/i.test(ad),
      'Dosya adında kupon kimliği YOK', ad);
  } else {
    not(false, 'Paylaşım karesi üretildi', `indirme yakalanamadı · ekran mesajı: "${mesaj}"`);
  }
  not(!/hata|başarısız/i.test(mesaj) || /iptal/i.test(mesaj), 'Paylaşım sonrası ekran mesajı hatasız',
    mesaj ? `"${mesaj.slice(0, 80)}"` : '(mesaj yok)');
  /* NE ÖLÇÜLDÜ: <Image> yolu (arma adresi VARKEN) gerçekten çağrılıyor mu?
     GERÇEK KULÜP ARMASI ÖLÇÜLMEDİ — bu kutuda arma sağlayıcısına erişim yok.
     Armaların doğru kulüple eşleşmesi ancak kullanıcının makinesinde görülür. */
  not(crestIstek > 0, 'Arma <Image> yolu gerçekten çağrıldı (/api/crest · denetim görseli)',
    `${crestIstek} istek — gerçek kulüp arması BURADA doğrulanmadı`);

  /* 6) KUPON SONUCU — geçmiş haftada resmî sonuç ekranı.
        Bu kutuda /api/history 502 döner; ekranın DÜRÜST hâli sınanır:
        ya tablo çizilir ya da "sonuç yok" der — sessiz beyaz ekran olmaz. */
  /* Merkeze dönüş TARAYICI GERİSİYLE yapılmaz: uygulamada linking yok, geri
     tuşu gezinme yığınını değil sayfayı etkiler. Sekmeye yeniden basmak
     react-navigation'da yığını tepeye alır — doğru yol budur. */
  await merkezeDon(page);
  const sonucDugme = kartDugmesi(page, 'Sonuç');
  if (await sonucDugme.count()) {
    await sonucDugme.click();
    await page.waitForTimeout(2500);
    const sMetin = (await gorunurMetin(page)).replace(/\s+/g, ' ');
    const sSatir = await page.locator('[data-testid^="kupon-sonuc-satir-"]').count();
    not(sSatir > 0 || /sonuç|bulunamadı|alınamadı|açıklan/i.test(sMetin),
      'Kupon Sonucu ekranı ya tabloyu çizdi ya da dürüstçe "yok" dedi',
      sSatir ? `${sSatir} satır` : sMetin.slice(0, 80));
    await dilDenetle(() => gorunurMetin(page), 'Kupon Sonucu');
    await page.screenshot({ path: `${OUT}25-kupon-sonuc.png`, fullPage: true });
  } else {
    console.log('  ··  "Sonuç" düğmesi yok (bu haftanın resmî sonucu henüz gelmemiş) — ekran atlandı.');
  }

  /* 7) DAR EKRAN (telefon genişliği) — tablo taşmamalı. */
  const dar = await browser.newPage({ viewport: { width: 390, height: 844 } });
  izle(dar, '[dar] ');
  await dar.clock.setFixedTime(new Date(ONCE));
  await dar.route('**/api/crest**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: DENETIM_PNG }));
  await zarfiBagla(dar, ZARF, GECMIS);
  await dar.goto(WEB, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await dar.waitForSelector('[aria-label="Yayın stüdyosu"]', { timeout: 90_000 });
  await kuponSekmesi(dar);
  await dar.waitForTimeout(1200);
  /* Bu SAYFANIN KENDİ deposu var (yeni bağlam) — geniş ekranda kaydedilen kupon
     burada YOK. Bu yüzden Merkez tablosu değil, kaydedilmiş kupon gerektirmeyen
     KUPON HAZIRLA tablosu ölçülür; sınanan şey aynı satır bileşenidir. */
  await dar.getByText(/Kupon Oluştur|Yeni Kupon/i).first().click();
  await dar.waitForSelector(T('kupon-tablo'), { timeout: 60_000 });
  await dar.waitForTimeout(800);
  const darSatir = await dar.locator('[data-testid^="kupon-satir-"]').count();
  not(darSatir === 15, 'Dar ekranda (390px) kupon tablosu çizildi', `${darSatir} satır`);
  const tasma = await dar.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  not(tasma <= 1, 'Dar ekranda sayfa yatay taşmıyor', `taşma ${tasma}px`);
  await dar.screenshot({ path: `${OUT}26-dar-kupon-merkez.png`, fullPage: true });
  await dar.close();

  await browser.close();

  /* ——— RAPOR ——— */
  const gecen = adimlar.filter((a) => a.ok).length;
  console.log(`\n———— ${gecen}/${adimlar.length} adım geçti ————`);
  const agOzet = new Map();
  for (const h of agHatalar) {
    const k = h.replace(/\d+/g, '#').slice(0, 70);
    agOzet.set(k, (agOzet.get(k) || 0) + 1);
  }
  console.log(`\nAğ/kaynak hatası (bu kutuda dış ağ ve veritabanı YOK — beklenir): ${agHatalar.length}`);
  for (const [k, n] of [...agOzet].slice(0, 8)) console.log(`  · ${n}× ${k.replace(/\s+/g, ' ')}`);
  if (ktpHatalar.length) {
    console.log(`\nKÜTÜPHANE UYARISI (${ktpHatalar.length}) — bizim kodumuz değil, yine de sayıldı.`);
  }
  const tek = [...new Set(jsHatalar)];
  if (tek.length) {
    console.log(`\nKOD HATASI (${tek.length}) — DÜZELTİLMELİ:`);
    for (const h of tek) console.log('  ✗', h.replace(/\s+/g, ' ').slice(0, 300));
  } else {
    console.log('\nKOD HATASI: yok.');
  }
  console.log(`Görüntüler: ${OUT}`);
  process.exitCode = (gecen === adimlar.length && tek.length === 0) ? 0 : 1;
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
