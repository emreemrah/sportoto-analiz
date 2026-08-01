// DAR EKRAN (TELEFON) DÜZEN DENETİMİ — kaynağı değil, GERÇEK ÇIKTIYI ölçer.
//
// Neden gerekli: uygulama masaüstü tarayıcıda geniş kadrajda geliştirildi.
// Yayın Modu çalışmasında 360px'te iki gerçek kusur çıktı (yayın puntosu
// taşıyordu, ana sayfa kartındaki tebeşir ✕ düğmelerin üstüne düşüyordu).
// Bunlar göz ile değil ÖLÇÜ ile bulundu. Bu betik aynı ölçüyü TÜM ana
// ekranlara uygular: her durakta kadraj dışına taşan görünür metni, gövdenin
// yatay kaymasını ve sessizce kırpılan yazıyı arar.
//
// Ne bulunur, ne bulunmaz:
//   • BULUNUR — sağa taşan yazı, yatay kayan sayfa, overflow:hidden altında
//     kesilen metin, kadrajdan taşan düğme.
//   • BULUNMAZ — renk/kontrast, hizalama zevki, üst üste binmeyen ama sıkışık
//     görünen düzen. Bunlar için ekran görüntüleri kaydedilir; göz ile bakılır.
//
// Meşru sayılan (kusur diye raporlanmayan) durumlar:
//   • Yatay kaydırılan şeritler (yatay ScrollView) — taşması tasarım gereği.
//   • numberOfLines ile bilerek kısaltılan metin (-webkit-line-clamp).
//
// Kullanım:
//   node scripts/verify-narrow.mjs                    # dist/ · 360px
//   node scripts/verify-narrow.mjs --genislik 320     # daha da dar
//   node scripts/verify-narrow.mjs --url http://localhost:8081
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
const CIKTI = path.join(APP, 'dar-ekran');

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

// Statik sunucu + /api vekili. Vekil şart: derlenmiş uygulama API'yi AYNI
// köke sorar; vekil olmadan her ekran "alınamadı" hatası gösterir ve dar
// ekran denetimi BOŞ ekranları ölçmüş olur — yani hiçbir şey ölçmez.
// Gerçek arka uç (:4000) dosya cache'inden GERÇEK bülteni sunar; ölçüm bu
// yüzden gerçek takım adları ve gerçek satır sayısıyla yapılır.
const VEKIL_HATALARI = [];

function sunucuBaslat(kok, apiKok) {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const yol = (req.url || '/');
      if (apiKok && yol.startsWith('/api/')) {
        const hedef = new URL(yol, apiKok);
        const istek = http.request(hedef, { method: req.method, headers: { ...req.headers, host: hedef.host } }, (y) => {
          res.writeHead(y.statusCode || 502, y.headers);
          y.pipe(res);
        });
        // Vekil hatası UYGULAMA hatası değildir; ayırt edilebilsin diye sebebi
        // hem gövdeye hem konsola yazılır. Aksi halde "vekil" yazan bir hata
        // ekranı, uygulamanın kusuru sanılır (bir kez öyle sanıldı).
        istek.on('error', (e) => {
          VEKIL_HATALARI.push(`${req.method} ${yol} → ${e.code || e.message}`);
          if (res.headersSent) { res.end(); return; }
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `vekil: ${e.code || e.message}` }));
        });
        req.pipe(istek);
        return;
      }
      const u = decodeURIComponent(yol.split('?')[0]);
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

// ——— GEZİLECEK DURAKLAR ———
// sekme: alt çubuktaki etiket. ac: sekmeye girdikten sonra tıklanacak yazı
// (yoksa sekmenin kökü ölçülür). Tıklanacak şey bulunamazsa durak ATLANIR —
// veri yokken açılmayan ekran kusur sayılmaz, "atlandı" diye raporlanır.
// ic: ekran açıldıktan sonra tıklanacak EKRAN İÇİ sekme (maç detayındaki
// Özet/Analiz/İstatistik/Yorumlar gibi). Bu sekmeler ayrı ekran değil ama
// içerikleri tamamen farklı; ölçülmezlerse ekranın çoğu ölçülmemiş olur.
const DURAKLAR = [
  { ad: 'ana-sayfa', sekme: 'Ana Sayfa' },
  { ad: 'haftanin-ozeti', sekme: 'Ana Sayfa', ac: 'Haftanın Özeti' },
  { ad: 'hafta-kapanisi', sekme: 'Ana Sayfa', ac: 'Geçen Haftanın Kapanışı' },
  // Bildirim merkezi: ana sayfadaki zil simgesinden açılır. Telefon
  // hatırlatması kartı (anahtar + açıklama satırı) dar ekranda taşabilecek
  // bir satır/yan-yana düzen içerdiği için ölçülmesi şart.
  { ad: 'bildirimler', sekme: 'Ana Sayfa', ac: '🔔' },
  { ad: 'bulten', sekme: 'Bülten' },
  // Maç detayı uygulamanın EN YOĞUN ekranı: uzun takım adları, oran pilleri,
  // puan durumu tablosu, kadro listesi. Dar ekranda kusur çıkacaksa burada çıkar.
  // Dört sekmesi de ayrı ayrı gezilir; biri temiz diye diğeri temiz sayılmaz.
  { ad: 'mac-detayi-ozet', sekme: 'Bülten', ac: 'Brondby' },
  { ad: 'mac-detayi-analiz', sekme: 'Bülten', ac: 'Brondby', ic: 'Analiz' },
  { ad: 'mac-detayi-istatistik', sekme: 'Bülten', ac: 'Brondby', ic: 'İstatistik' },
  { ad: 'mac-detayi-yorumlar', sekme: 'Bülten', ac: 'Brondby', ic: 'Yorumlar' },
  { ad: 'bulten-gecmisi', sekme: 'Bülten', ac: 'Bülten Geçmişi' },
  { ad: 'radar', sekme: 'Radar' },
  { ad: 'sistem-karnesi', sekme: 'Radar', ac: 'Sistem Karnesi' },
  { ad: 'kuponlarim', sekme: 'Kuponlarım' },
  { ad: 'kupon-hazirla', sekme: 'Kuponlarım', ac: 'Kupon Oluştur' },
  { ad: 'profil', sekme: 'Profil' },
  // Oturum kapalıyken Profil sekmesinden ulaşılan gerçek ekranlar. Form
  // alanları dar ekranda en çok bozulan yerlerdir; ölçülmeleri şart.
  { ad: 'giris-yap', sekme: 'Profil', ac: 'Giriş Yap' },
  { ad: 'sifremi-unuttum', sekme: 'Profil', ac: 'Giriş Yap', ic: 'Şifremi unuttum' },
  { ad: 'kayit-ol', sekme: 'Profil', ac: 'Kayıt Ol' },
  // NOT: Başarı Panelim ve Güvenlik Ayarları oturum AÇIKKEN görünür. Bu
  // denetim ortamında Supabase kimlik doğrulaması yok (anahtarlar yalnız
  // kullanıcının backend/.env dosyasında), o yüzden bu iki ekran "atlandı"
  // diye raporlanır — kusursuz oldukları anlamına GELMEZ.
  { ad: 'basari-panelim', sekme: 'Profil', ac: 'Başarı Panelim' },
  { ad: 'guvenlik-ayarlari', sekme: 'Profil', ac: 'Güvenlik Ayarları' },
  { ad: 'hakkinda', sekme: 'Profil', ac: 'Hakkında' },
];

// Tarayıcı içinde çalışır: bu sayfanın dar kadrajda düzen kusurlarını çıkarır.
function olcuAl(W) {
  const gorunurMu = (el) => {
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) !== 0;
  };

  // Yatay kaydırılabilen bir atanın içindeysek taşma TASARIM GEREĞİDİR
  // (yatay şeritler, sekme çubukları). Kusur sayılmaz.
  const yatayKaydiriciIcinde = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth + 2) return true;
    }
    return false;
  };

  const kisalt = (t) => (t || '').replace(/\s+/g, ' ').trim().slice(0, 48);

  // GERÇEKTEN GÖRÜNÜYOR MU? react-navigation, sekmeden çıkılınca eski ekranı
  // DOM'da tutar; ölçüsü sıfır olmadığı için "görünür" sanılır ve o ekranın
  // kusurları yanlış ekrana yazılır. Nokta testi bunu keser: öğenin kendi
  // alanındaki bir noktada en üstte duran şey kendisi (ya da yakını) değilse
  // öğe başka bir ekranın altında kalmıştır — ölçüme girmez.
  const ustteMi = (el, r) => {
    const x = Math.min(Math.max(r.left + 2, 1), window.innerWidth - 1);
    const y = Math.min(Math.max(r.top + r.height / 2, 1), window.innerHeight - 1);
    const ust = document.elementFromPoint(x, y);
    if (!ust) return false;
    return ust === el || el.contains(ust) || ust.contains(el);
  };

  const tasan = [];
  const kirpilan = [];
  const gorunenYazi = [];

  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    // Sıfır ölçü: gizli ekran (react-navigation pasif rotaları) ya da boş kap.
    if (r.width === 0 || r.height === 0) continue;
    // Kadrajın dışında kalan (yukarı/aşağı kaydırılmış) içerik bu adımda ölçülmez;
    // kaydırma adımlarında sırası gelince ölçülür.
    if (r.bottom < 0 || r.top > window.innerHeight) continue;
    if (!gorunurMu(el)) continue;

    // Yaprak metin: element çocuğu olmayan ve yazısı olan düğüm.
    const yaprakMetin = el.children.length === 0 && kisalt(el.textContent).length > 0;
    if (!yaprakMetin) continue;
    if (yatayKaydiriciIcinde(el)) continue;
    if (!ustteMi(el, r)) continue;
    if (gorunenYazi.length < 40) gorunenYazi.push(kisalt(el.textContent));

    // 1) Kadraj dışına taşan görünür yazı.
    if (r.right > W + 1 || r.left < -1) {
      tasan.push({ sol: Math.round(r.left), sag: Math.round(r.right), yazi: kisalt(el.textContent) });
      continue;
    }

    // 2) Sessizce kırpılan yazı: overflow gizli, içerik kutudan geniş ve
    //    numberOfLines (line-clamp) ile BİLEREK kısaltılmamış.
    const s = getComputedStyle(el);
    const clamp = s.webkitLineClamp && s.webkitLineClamp !== 'none';
    const elips = s.textOverflow === 'ellipsis';
    if (!clamp && !elips && s.overflow === 'hidden' && el.scrollWidth > el.clientWidth + 1) {
      kirpilan.push({
        genislik: el.clientWidth, gerek: el.scrollWidth, yazi: kisalt(el.textContent),
      });
    }
  }

  return {
    govdeTasmasi: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - W,
    tasan, kirpilan,
    // body.innerText KULLANILMAZ: pasif sekmelerin DOM'da kalan yazısını da
    // içerir ve hangi ekranda olduğumuzu yanlış gösterir. Yalnız nokta testini
    // geçen (gerçekten en üstte duran) yazılar özetlenir.
    metin: gorunenYazi.join(' · ').slice(0, 130),
  };
}

// Ekranın GÖRÜNEN kaydırma kabını bulur ve verilen adıma kaydırır.
// Neden gerekli: uygulama gövdesi kaymaz, içerik iç ScrollView'da akar. Yalnız
// ilk ekranı ölçmek "katlamanın altını" hiç denetlememek demektir; kusurların
// çoğu orada yaşar.
function kaydir(adim) {
  const adaylar = [];
  for (const el of document.querySelectorAll('*')) {
    const s = getComputedStyle(el);
    if (!/(auto|scroll)/.test(s.overflowY)) continue;
    if (el.scrollHeight <= el.clientHeight + 2) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (s.display === 'none' || s.visibility === 'hidden') continue;
    // Pasif sekmenin DOM'da kalan listesi ölçüsünü korur; onu kaydırmak
    // görünen ekranda hiçbir şeyi değiştirmez. Nokta testi görüneni ayırır.
    const x = Math.min(Math.max(r.left + r.width / 2, 1), window.innerWidth - 1);
    const y = Math.min(Math.max(r.top + 4, 1), window.innerHeight - 1);
    const ust = document.elementFromPoint(x, y);
    if (!ust || !(ust === el || el.contains(ust))) continue;
    adaylar.push(el);
  }
  if (!adaylar.length) return { kaydi: false, oran: 1 };
  // En içteki (başka adayı içermeyen) kap gerçek içerik listesidir.
  const kap = adaylar.find((a) => !adaylar.some((b) => b !== a && a.contains(b))) || adaylar[0];
  const enFazla = kap.scrollHeight - kap.clientHeight;
  const hedef = Math.min(adim * Math.round(kap.clientHeight * 0.8), enFazla);
  kap.scrollTop = hedef;
  return { kaydi: hedef > 0, oran: enFazla ? hedef / enFazla : 1, enFazla };
}

async function sekmeyeGit(page, ad, H) {
  // Alt sekme çubuğundaki etiket: yazısı TAM eşleşen ve ekranın alt şeridinde
  // duran öğe. Aynı yazı içerikte de geçebilir; konum şartı onu ayıklar.
  const nokta = await page.evaluate(({ ad, H }) => {
    for (const el of document.querySelectorAll('div,span,a,button')) {
      if ((el.innerText || '').trim() !== ad) continue;
      const r = el.getBoundingClientRect();
      if (r.height === 0 || r.top < H - 110) continue;
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    }
    return null;
  }, { ad, H });
  if (!nokta) return false;
  await page.mouse.click(nokta.x, nokta.y);
  await page.waitForTimeout(1600);
  return true;
}

async function yaziyaTikla(page, yazi, H) {
  // İçerikteki düğme: alt sekme çubuğu HARİÇ, yazıyı içeren ilk GERÇEKTEN
  // görünen öğe. Düğme katlamanın altındaysa ekran adım adım kaydırılarak
  // aranır — yoksa "düğme yok" denip ekran haksız yere atlanır.
  const bul = () => page.evaluate(({ yazi, H }) => {
    const adaylar = [];
    for (const el of document.querySelectorAll('div,span,a,button')) {
      const t = (el.innerText || '').trim();
      if (!t.includes(yazi) || t.length > yazi.length + 40) continue;
      const r = el.getBoundingClientRect();
      if (r.height === 0 || r.width === 0) continue;
      if (r.top > H - 110) continue;          // sekme çubuğunu atla
      if (r.top < 0 || r.bottom > H) continue; // kadraj dışını atla
      const x = Math.round(r.left + r.width / 2);
      const y = Math.round(r.top + r.height / 2);
      // Pasif sekmede kalmış aynı yazıya tıklanmasın: noktada en üstte duran
      // öğe bu öğe ile ilişkili olmalı.
      const ust = document.elementFromPoint(x, y);
      if (!ust || !(ust === el || el.contains(ust) || ust.contains(el))) continue;
      adaylar.push({ x, y, uzunluk: t.length, alan: r.width * r.height });
    }
    if (!adaylar.length) return null;
    // EN KÜÇÜK aday seçilir, ilk bulunan DEĞİL. Sebep: aynı yazıyı içeren
    // birden çok öğe eşleşir (düğmenin kendisi + onu saran satır). DOM
    // sırasında önce SARAN satır gelir; satırın merkezi iki düğmenin
    // ARASINDAKİ boşluğa denk gelirse tıklama hiçbir şeye çarpmaz ve ekran
    // değişmez (ana sayfada "Haftanın Özeti" böyle kaçırılmıştı). Yazısı en
    // kısa, alanı en küçük öğe gerçek düğmedir.
    adaylar.sort((a, b) => (a.uzunluk - b.uzunluk) || (a.alan - b.alan));
    return { x: adaylar[0].x, y: adaylar[0].y };
  }, { yazi, H });

  for (let adim = 0; adim < 8; adim += 1) {
    const durumu = await page.evaluate(kaydir, adim);
    await page.waitForTimeout(400);
    const nokta = await bul();
    if (nokta) {
      await page.mouse.click(nokta.x, nokta.y);
      await page.waitForTimeout(2400);
      return true;
    }
    if (durumu.oran >= 0.999) break;
  }
  return false;
}

(async () => {
  const disUrl = arg('url', '');
  const W = Number(arg('genislik', '360')) || 360;
  const H = Number(arg('yukseklik', '780')) || 780;

  const apiKok = arg('api', 'http://127.0.0.1:4000');

  let srv = null;
  let url = disUrl;
  if (!url) {
    if (!fs.existsSync(DIST)) {
      console.error('HATA: dist/ yok. Önce: npx expo export --platform web');
      process.exit(1);
    }
    const r = await sunucuBaslat(DIST, apiKok);
    srv = r.s; url = r.url;
  }

  fs.mkdirSync(CIKTI, { recursive: true });

  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: W, height: H } });

  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') hatalar.push(m.text()); });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);

  // --durak ile tek/az durak yeniden koşulabilir (hata ayıklarken tüm turu
  // baştan beklememek için). Boşsa hepsi gezilir.
  const suzgec = arg('durak', '').split(',').map((x) => x.trim()).filter(Boolean);
  const gezilecek = suzgec.length ? DURAKLAR.filter((d) => suzgec.includes(d.ad)) : DURAKLAR;

  const sonuclar = [];
  for (const durak of gezilecek) {
    const sekmeTamam = await sekmeyeGit(page, durak.sekme, H);
    if (!sekmeTamam) { sonuclar.push({ ...durak, durum: 'sekme bulunamadı' }); continue; }

    if (durak.ac) {
      const acildi = await yaziyaTikla(page, durak.ac, H);
      if (!acildi) { sonuclar.push({ ...durak, durum: 'atlandı (düğme yok)' }); continue; }
    }
    if (durak.ic) {
      const secildi = await yaziyaTikla(page, durak.ic, H);
      if (!secildi) { sonuclar.push({ ...durak, durum: `atlandı (ekran içi "${durak.ic}" yok)` }); continue; }
    }

    // Ekranı yukarıdan aşağıya adım adım gezerek ölç: her adımda kadrajda ne
    // varsa o ölçülür, sonra bir sonraki bölüme kaydırılır.
    const tasan = [];
    const kirpilan = [];
    let govdeTasmasi = 0;
    let metin = '';
    let adimSayisi = 0;
    const gorseller = [];
    for (let adim = 0; adim < 12; adim += 1) {
      const durumu = await page.evaluate(kaydir, adim);
      await page.waitForTimeout(450);
      const olcu = await page.evaluate(olcuAl, W);
      if (adim === 0) metin = olcu.metin;
      govdeTasmasi = Math.max(govdeTasmasi, olcu.govdeTasmasi);
      for (const t of olcu.tasan) if (!tasan.some((x) => x.yazi === t.yazi && x.sag === t.sag)) tasan.push(t);
      for (const k of olcu.kirpilan) if (!kirpilan.some((x) => x.yazi === k.yazi)) kirpilan.push(k);
      adimSayisi = adim + 1;
      if (adim < 3) {
        const g = path.join(CIKTI, `${durak.ad}-${W}${adim ? `-${adim + 1}` : ''}.png`);
        await page.screenshot({ path: g });
        gorseller.push(g);
      }
      if (durumu.oran >= 0.999) break;   // sona gelindi
    }

    sonuclar.push({
      ...durak, durum: 'ölçüldü', govdeTasmasi, tasan, kirpilan, metin,
      adimSayisi, dosya: gorseller[0], gorseller,
    });
  }

  console.log(`--- DAR EKRAN DÜZEN DENETİMİ (${W}x${H}) ---`);
  console.log('Adres            :', url);

  let kusurlu = 0;
  for (const s of sonuclar) {
    if (s.durum !== 'ölçüldü') {
      console.log(`\n[${s.ad}] ${s.durum}`);
      continue;
    }
    const kotu = s.govdeTasmasi > 1 || s.tasan.length > 0 || s.kirpilan.length > 0;
    if (kotu) kusurlu += 1;
    console.log(`\n[${s.ad}] ${kotu ? '⚠ KUSUR' : '✓ temiz'}  (${s.adimSayisi} kaydırma adımı)`);
    console.log('  ilk metin      :', s.metin);
    console.log('  gövde taşması  :', `${s.govdeTasmasi}px`);
    if (s.tasan.length) {
      console.log(`  kadraj dışı    : ${s.tasan.length} yazı`);
      for (const t of s.tasan.slice(0, 6)) {
        console.log(`     sol=${t.sol} sag=${t.sag} — "${t.yazi}"`);
      }
    }
    if (s.kirpilan.length) {
      console.log(`  kırpılan yazı  : ${s.kirpilan.length} yer`);
      for (const k of s.kirpilan.slice(0, 6)) {
        console.log(`     kutu=${k.genislik} gereken=${k.gerek} — "${k.yazi}"`);
      }
    }
    console.log('  görüntü        :', s.dosya);
  }

  const olculen = sonuclar.filter((s) => s.durum === 'ölçüldü').length;
  console.log(`\nÖzet: ${olculen} durak ölçüldü · ${kusurlu} durakta kusur · ${sonuclar.length - olculen} durak atlandı`);
  const kritikHata = hatalar.find((h) => /is not a function|undefined is not|Cannot read|Minified React error/i.test(h));
  if (kritikHata) console.log('Çalışma anı hatası:', kritikHata);
  if (VEKIL_HATALARI.length) {
    // Bunlar DENETİM ORTAMININ kusurudur, uygulamanınki değil. Ayrı yazılır ki
    // "hata ekranı ölçtük" ile "uygulamada hata var" birbirine karışmasın.
    console.log(`\nVekil (denetim ortamı) hataları — uygulama kusuru DEĞİL: ${VEKIL_HATALARI.length}`);
    for (const v of [...new Set(VEKIL_HATALARI)].slice(0, 8)) console.log('   ', v);
  }

  await browser.close();
  if (srv) srv.close();
  // Kusur bulmak bu betiğin İŞİdir; bulması "başarısızlık" değildir. Çıkış
  // kodu yalnız ölçüm hiç yapılamadıysa ya da uygulama çöktüyse 1 olur.
  process.exit(olculen === 0 || kritikHata ? 1 : 0);
})().catch((e) => { console.error('HATA:', e.message); process.exit(1); });
