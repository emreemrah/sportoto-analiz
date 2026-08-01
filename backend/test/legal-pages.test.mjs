// YASAL SAYFA + HESAP SİLME UCU testleri.
//
// Google Play, hesap oluşturmaya ve kullanıcı içeriği barındırmaya izin veren
// uygulamalardan şunları ister:
//   • Uygulamayı KURMADAN erişilebilen bir hesap silme sayfası
//   • Erişilebilir bir gizlilik politikası
//   • Yayımlanmış topluluk kuralları + bildirimlere karşılık veren bir süreç
// Bu testler sayfaların var olduğunu, doğru marka ve uyarı metinlerini
// taşıdığını ve yasaklı iddialı dili İÇERMEDİĞİNİ doğrular.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { BILDIRIM_SEBEPLERI, NOT_SINIRI } from '../src/moderation.js';

const here = dirname(fileURLToPath(import.meta.url));
const legalDir = join(here, '..', 'legal');

const gizlilik = readFileSync(join(legalDir, 'gizlilik.html'), 'utf8');
const hesapSilme = readFileSync(join(legalDir, 'hesap-silme.html'), 'utf8');
const kurallar = readFileSync(join(legalDir, 'topluluk-kurallari.html'), 'utf8');

const SAYFALAR = [
  ['gizlilik.html', gizlilik],
  ['hesap-silme.html', hesapSilme],
  ['topluluk-kurallari.html', kurallar],
];

test('her iki sayfa da doğru marka adını ve telif satırını taşır', () => {
  for (const [ad, html] of SAYFALAR) {
    assert.ok(html.includes('Sportoto Master Analiz'), `${ad}: marka adı yok`);
    assert.ok(html.includes('© 2026 Sportoto Master Analiz'), `${ad}: telif satırı yok`);
    assert.ok(/lang="tr"/.test(html), `${ad}: dil etiketi tr değil`);
  }
});

test('eski marka adı hiçbir sayfada kalmamıştır', () => {
  for (const [ad, html] of SAYFALAR) {
    assert.ok(!/Spor\s+Toto\s+Analiz/i.test(html), `${ad}: eski marka adı kalmış`);
    assert.ok(!/Spor Toto Master/i.test(html), `${ad}: ayrık yazım kalmış`);
  }
});

test('sayfalarda kesin kazanç/garanti dili yoktur', () => {
  const yasak = /\b(garanti|kesin kazan|banko|yanılmaz|mutlaka kazan)/i;
  for (const [ad, html] of SAYFALAR) {
    // "mutlak güvenlik garantisi verilemez" gibi OLUMSUZ kullanımlar hariç:
    const cumleler = html.split(/[.\n]/).filter((c) => yasak.test(c));
    for (const c of cumleler) {
      assert.ok(
        /verilemez|değildir|vaadi değil|garantisi verilemez/i.test(c),
        `${ad}: iddialı dil bulundu → ${c.trim()}`,
      );
    }
  }
});

test('sayfalarda operatör/bahis yönlendirmesi ve ödeme bağlantısı yoktur', () => {
  const yasak = /(iddaa|bilyoner|misli|nesine|tuttur|oyna|bahis oyna|para yatır|üye ol ve)/i;
  for (const [ad, html] of SAYFALAR) {
    const satirlar = html.split('\n').filter((s) => yasak.test(s));
    for (const s of satirlar) {
      assert.ok(
        /oynatmaz|oynanmaz|yapılmaz|yapmaz|değildir|kabul etmez/i.test(s),
        `${ad}: operatör/bahis yönlendirmesi → ${s.trim()}`,
      );
    }
  }
});

test('gizlilik politikası gerçek veri akışını anlatır', () => {
  // Toplanan veriler
  for (const alan of ['E-posta', 'Kullanıcı adı', 'Profil fotoğrafı', 'Yorumların']) {
    assert.ok(gizlilik.includes(alan), `gizlilik: "${alan}" anlatılmamış`);
  }
  // Toplanmayanlar açıkça yazılmalı (Data Safety formuyla birebir uyum için)
  for (const alan of ['Konum', 'rehber', 'kamera', 'reklam kimliği']) {
    assert.ok(new RegExp(alan, 'i').test(gizlilik), `gizlilik: "${alan}" toplanmadığı yazılmamış`);
  }
  // Silme, saklama ve haklar bölümleri
  assert.ok(/hesap-silme/.test(gizlilik), 'gizlilik: hesap silme bağlantısı yok');
  assert.ok(/KVKK|6698/.test(gizlilik), 'gizlilik: KVKK hakları bölümü yok');
  assert.ok(/18 yaş/.test(gizlilik), 'gizlilik: çocuklar bölümü yok');
  assert.ok(/satılmaz/.test(gizlilik), 'gizlilik: veri satışı reddi yok');
});

test('hesap silme sayfası kurulum gerektirmeden çalışır ve onay ister', () => {
  // Sayfa kendi başına çalışan bir formdur; uygulama kurulumu istemez.
  assert.ok(/<form/.test(hesapSilme), 'form yok');
  assert.ok(hesapSilme.includes('/api/auth/delete-account'), 'silme ucuna istek atmıyor');
  assert.ok(hesapSilme.includes('HESABIMI SIL'), 'onay ifadesi yok');
  // Neyin silindiği ve neyin silinmediği açıkça yazılmalı.
  assert.ok(/geri getirilemez/.test(hesapSilme), 'kalıcılık uyarısı yok');
  assert.ok(/Ne silinmez/.test(hesapSilme), 'silinmeyen veri açıklaması yok');
  // Kurum bağımsızlığı uyarısı.
  assert.ok(/hiçbir kurum, operatör veya veri sağlayıcı/.test(hesapSilme), 'bağımsızlık uyarısı yok');
});

test('sayfalarda uydurma iletişim adresi yoktur (yer tutucu sunucuda doldurulur)', () => {
  for (const [ad, html] of SAYFALAR) {
    const epostalar = html.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) || [];
    const uydurma = epostalar.filter((e) => !/ornek@eposta\.com/i.test(e));
    assert.deepEqual(uydurma, [], `${ad}: gerçekmiş gibi görünen e-posta gömülü → ${uydurma}`);
  }
  assert.ok(gizlilik.includes('{{DESTEK_EPOSTA}}'), 'gizlilik: destek adresi yer tutucusu yok');
  assert.ok(hesapSilme.includes('{{DESTEK_EPOSTA}}'), 'hesap-silme: destek adresi yer tutucusu yok');
  assert.ok(kurallar.includes('{{DESTEK_EPOSTA}}'), 'topluluk-kurallari: itiraz adresi yer tutucusu yok');
});

// ———————————————————————————————————————————————————————————————————
// TOPLULUK KURALLARI — Google Play'in üçüncü kullanıcı-içeriği şartı.
// ———————————————————————————————————————————————————————————————————

test('yayımlanan kural başlıkları bildirim sebepleriyle BİREBİR aynıdır', () => {
  // Sayfadaki kural listesi ile sunucunun kabul ettiği sebepler ayrı dosyalarda
  // yazılı. Biri değişip diğeri unutulursa kullanıcı sayfada olmayan bir sebeple
  // bildirim yapar ya da sayfada yazan bir kuralı hiç bildiremez. İkisi de sessiz
  // hatadır; bu yüzden ölçülür. (Arayüz ↔ sunucu eşleşmesini
  // app/test/moderation-reasons.test.mjs ölçer.)
  const sayfadaki = [...kurallar.matchAll(/data-sebep="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(
    sayfadaki,
    [...BILDIRIM_SEBEPLERI],
    'topluluk kuralları sayfası ile BILDIRIM_SEBEPLERI listesi ayrışmış',
  );
});

test('topluluk kuralları bildirme, engelleme ve inceleme sürecini anlatır', () => {
  // Google Play üç şeyi birden arar: bildirme yolu, engelleme yolu ve bildirimlere
  // karşılık veren bir süreç. Üçü de sayfada YAZILI olmalı.
  assert.ok(/>Bildir</.test(kurallar), 'bildirme yolu anlatılmamış');
  assert.ok(/>Engelle</.test(kurallar), 'engelleme yolu anlatılmamış');
  assert.ok(/Engeli Kaldır/.test(kurallar), 'engeli geri alma yolu anlatılmamış');
  assert.ok(/elle incelenir|insan incelemesi/i.test(kurallar), 'insan incelemesi anlatılmamış');
  // Süre taahhüdü SAYIYLA yazılmalı: "makul sürede" ölçülemez bir sözdür.
  assert.match(kurallar, /en geç \d+ gün/, 'inceleme süresi sayıyla yazılmamış');
  assert.ok(String(NOT_SINIRI).length > 0 && kurallar.includes(String(NOT_SINIRI)),
    `not sınırı (${NOT_SINIRI}) sayfada yazmıyor`);
});

test('topluluk kuralları otomatik gizlemeyi DOĞRU anlatır (üç FARKLI kişi)', () => {
  // 007'deki trigger `count(distinct reporter_id)` sayar ve eşik 3'tür. Sayfada
  // başka bir sayı ya da "üç bildirim" (aynı kişiden üç kez) yazsaydı, kullanıcıya
  // tutulmayan bir söz verilmiş olurdu.
  assert.match(kurallar, /birbirinden farklı üç kişi/i, 'otomatik gizleme eşiği yanlış/eksik anlatılmış');
});

test('topluluk kuralları bildiren kişiyi ifşa eden bir söz VERMEZ', () => {
  assert.ok(
    /kimin bildirdiği .{0,40}açıklanmaz/i.test(kurallar),
    'bildiren kimliğinin gizli kaldığı yazılmamış',
  );
  // Bildirene sonuç sözü verilmez: sonucu duyurmak bildireni ele verir.
  assert.ok(
    /sonucu.{0,60}bildirilmez/is.test(kurallar),
    'bildirim sonucunun iletilmeyeceği yazılmamış',
  );
});

test('topluluk kuralları diğer yasal sayfalara bağlanır', () => {
  assert.ok(/href="\/gizlilik"/.test(kurallar), 'gizlilik bağlantısı yok');
  assert.ok(/href="\/hesap-silme"/.test(kurallar), 'hesap silme bağlantısı yok');
  assert.ok(/hiçbir kurum, operatör veya veri sağlayıcı/.test(kurallar), 'bağımsızlık uyarısı yok');
});

test('topluluk kuralları rotası KAYITLIDIR ve HTML döner', async () => {
  // Sayfanın diskte olması yetmez; catch-all'dan önce kayıtlı olmalı ki mağaza
  // incelemesi adrese girdiğinde web uygulamasının içine düşmesin.
  const kaynak = readFileSync(join(here, '..', 'src', 'server.js'), 'utf8');
  const satir = kaynak.match(/app\.get\(\s*\[[^\]]*topluluk-kurallari[^\]]*\][\s\S]{0,120}?\)/);
  assert.ok(satir, 'server.js içinde /topluluk-kurallari rotası yok');
  assert.ok(/serveLegal\('topluluk-kurallari\.html'\)/.test(satir[0]), 'rota yanlış dosyayı sunuyor');

  const yasalIndex = kaynak.indexOf("serveLegal('topluluk-kurallari.html')");
  const catchAll = kaynak.indexOf("app.get('*'");
  assert.ok(catchAll === -1 || yasalIndex < catchAll, 'rota catch-all SONRASINDA kayıtlı — sayfa açılmaz');
});

test('hesap silme uçları rotada KAYITLIDIR (yapılandırma yoksa 404 değil 503 döner)', async () => {
  const router = (await import('../src/routes/auth.js')).default;
  const app = express();
  app.use(express.json());
  app.use('/api/auth', router);

  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const r1 = await fetch(`${base}/api/auth/me`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'HESABIMI SIL' }),
    });
    assert.notEqual(r1.status, 404, 'DELETE /api/auth/me rotası yok');

    const r2 = await fetch(`${base}/api/auth/delete-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: 'x', confirm: 'HESABIMI SIL' }),
    });
    assert.notEqual(r2.status, 404, 'POST /api/auth/delete-account rotası yok');
  } finally {
    server.close();
  }
});
