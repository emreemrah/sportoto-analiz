// ASENKRON HATA KORUMASI testleri.
//
// Neden bu testler var: dar ekran denetimi sırasında ölçülen GERÇEK bir kusur
// vardı — Supabase yapılandırılmamışken giriş bile gerektirmeyen
// `GET /api/comments?matchId=...` isteği TÜM BACKEND SÜRECİNİ çökertiyordu:
//
//   TypeError: Cannot read properties of null (reading 'from')
//   ...
//   Node.js v22.22.2      ← süreç sonlandı
//
// Sebep Supabase'e özel değil, YAPISALDI: Express 4, `async` bir işleyicinin
// fırlattığı hatayı yakalamaz; hata yakalanmamış promise reddine dönüşür ve
// Node varsayılan olarak süreci öldürür. Yani HERHANGİ bir rotadaki herhangi
// bir beklenmeyen hata, o an bağlı olan HERKES için sunucuyu düşürebilirdi.
//
// Bu testler iki şeyi kanıtlar:
//   1) async bir rota patlarsa istek 500 ile YANITLANIR (sunucu ayakta kalır),
//   2) senkron patlayan rota da aynı şekilde yakalanır,
//   3) hata gövdesinde iç ayrıntı (yığın izi, kütüphane mesajı) SIZMAZ,
//   4) sağlıklı rotalar aynen çalışmaya devam eder (koruma yolu bozmuyor).
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { sarmala, hataKatmani } from '../src/security/asyncGuard.js';
import { uyelikKapisi } from '../src/security/supabaseGuard.js';

// Test sunucusu: rastgele boş porta bağlanır, isteği atar, kapanır.
async function sunucuda(app, yol, secenek = {}) {
  const srv = await new Promise((c) => { const s = app.listen(0, '127.0.0.1', () => c(s)); });
  try {
    const y = await fetch(`http://127.0.0.1:${srv.address().port}${yol}`, secenek);
    const govde = await y.text();
    return { kod: y.status, govde };
  } finally {
    await new Promise((c) => srv.close(c));
  }
}

function uygulamaKur(kur) {
  const app = express();
  app.use(express.json());
  kur(app);
  sarmala(app);
  app.use(hataKatmani);
  return app;
}

test('async rota patlarsa istek 500 döner, süreç ölmez', async () => {
  const app = uygulamaKur((a) => {
    a.get('/patla', async () => {
      const yok = null;
      return yok.from('comments');   // gerçek kusurun birebir aynısı
    });
  });
  const { kod } = await sunucuda(app, '/patla');
  assert.equal(kod, 500);
});

test('senkron patlayan rota da yakalanır', async () => {
  const app = uygulamaKur((a) => {
    a.get('/patla', () => { throw new Error('senkron kusur'); });
  });
  const { kod } = await sunucuda(app, '/patla');
  assert.equal(kod, 500);
});

test('alt router içindeki hata da yakalanır', async () => {
  const app = uygulamaKur((a) => {
    const r = express.Router();
    r.get('/ic', async () => { throw new Error('alt router kusuru'); });
    a.use('/dis', r);
  });
  const { kod } = await sunucuda(app, '/dis/ic');
  assert.equal(kod, 500);
});

test('hata yanıtı iç ayrıntı sızdırmaz', async () => {
  const app = uygulamaKur((a) => {
    a.get('/patla', async () => { throw new Error('gizli-ic-ayrinti-12345'); });
  });
  const { govde } = await sunucuda(app, '/patla');
  assert.ok(!govde.includes('gizli-ic-ayrinti-12345'), 'iç hata mesajı istemciye sızdı');
  assert.ok(!/\bat\s+\w+\s+\(/.test(govde), 'yığın izi istemciye sızdı');
  assert.ok(govde.includes('beklenmeyen'), 'kullanıcıya dönük Türkçe mesaj yok');
});

test('sağlıklı rotalar korumadan sonra da normal çalışır', async () => {
  const app = uygulamaKur((a) => {
    a.get('/iyi', async (req, res) => { res.json({ ok: true, deger: 42 }); });
  });
  const { kod, govde } = await sunucuda(app, '/iyi');
  assert.equal(kod, 200);
  assert.deepEqual(JSON.parse(govde), { ok: true, deger: 42 });
});

test('rota parametreleri koruma sonrası korunur', async () => {
  const app = uygulamaKur((a) => {
    a.get('/mac/:no', async (req, res) => { res.json({ no: req.params.no }); });
  });
  const { kod, govde } = await sunucuda(app, '/mac/7');
  assert.equal(kod, 200);
  assert.deepEqual(JSON.parse(govde), { no: '7' });
});

test('üyelik kapısı: Supabase kapalıyken 503 döner, işleyici hiç çalışmaz', async () => {
  let calisti = false;
  const app = uygulamaKur((a) => {
    const r = express.Router();
    r.use(uyelikKapisi(false));
    r.get('/', async (req, res) => { calisti = true; res.json({ ok: true }); });
    a.use('/api/comments', r);
  });
  const { kod, govde } = await sunucuda(app, '/api/comments?matchId=deneme');
  assert.equal(kod, 503);
  assert.equal(calisti, false, 'kapı açık kalmış: işleyici çalıştı');
  assert.ok(JSON.parse(govde).error.includes('Üyelik'), 'açıklayıcı Türkçe mesaj yok');
});

test('üyelik kapısı: Supabase açıkken isteği geçirir', async () => {
  const app = uygulamaKur((a) => {
    const r = express.Router();
    r.use(uyelikKapisi(true));
    r.get('/', async (req, res) => { res.json({ ok: true }); });
    a.use('/api/comments', r);
  });
  const { kod } = await sunucuda(app, '/api/comments?matchId=deneme');
  assert.equal(kod, 200);
});

test('üyelik kapısı: muaf yol Supabase kapalıyken de çalışır', async () => {
  // /ms-summary bülten kartlarında 15 maç için çağrılır ve kendi zarif boş
  // yanıtını verir; kapatılırsa bülten ekranı hata gösterirdi.
  const app = uygulamaKur((a) => {
    const r = express.Router();
    r.use(uyelikKapisi(false, ['/ms-summary']));
    r.get('/ms-summary', async (req, res) => { res.json({ summary: {} }); });
    r.get('/poll', async (req, res) => { res.json({ ok: true }); });
    a.use('/api/predictions', r);
  });
  assert.equal((await sunucuda(app, '/api/predictions/ms-summary')).kod, 200);
  assert.equal((await sunucuda(app, '/api/predictions/poll')).kod, 503);
});

test('hata yanıtı JSON içerik tipiyle döner (istemci ayrıştırabilsin)', async () => {
  // İstemci her yanıtı JSON olarak ayrıştırır; HTML dönerse ekranda
  // "Unexpected token '<'" gibi anlamsız bir hata görünür.
  const app = uygulamaKur((a) => {
    a.get('/patla', async () => { throw new Error('kusur'); });
  });
  const { govde } = await sunucuda(app, '/patla');
  assert.doesNotThrow(() => JSON.parse(govde), 'hata gövdesi JSON değil');
});
