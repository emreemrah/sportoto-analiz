// ASENKRON ROTA KORUMASI
//
// Neden var: Express 4, `async` bir rota işleyicisi HATA FIRLATIRSA bunu
// yakalamaz. Hata yakalanmamış promise reddine dönüşür ve Node 22 varsayılan
// davranışıyla SÜRECİ SONLANDIRIR. Yani tek bir kötü istek TÜM BACKEND'i
// düşürür — o an bağlı olan herkes için.
//
// Bu teorik değil, ölçüldü: Supabase yapılandırılmamışken
// `GET /api/comments?matchId=...` (giriş bile gerektirmiyor) sunucuyu
// komple çökertiyordu:
//   TypeError: Cannot read properties of null (reading 'from')
//
// Çözüm iki katmanlı:
//   1) sarmala(router) — her işleyicinin reddini `next(err)`e çevirir; istek
//      500 ile YANITLANIR, süreç yaşamaya devam eder.
//   2) hataKatmani — yanıtı tek biçimli JSON'a çevirir.
//
// GİZLİLİK: loga yalnız yöntem + yol + hata mesajı yazılır. İstek gövdesi,
// başlıklar, çerezler, token ve e-posta ASLA yazılmaz (proje kuralı:
// "şifre, token ve hassas bilgiler loglara yazılmasın").

// Express Layer'ının içindeki işleyiciyi, reddi next()'e ileten bir sürümle
// değiştirir. İşleyicinin uzunluğu (argüman sayısı) KORUNUR: Express, 4
// argümanlı işleyiciyi "hata katmanı" sayar; bu ayrım bozulursa yönlendirme
// sessizce yanlış çalışır.
function sarmalaIsleyici(fn) {
  if (typeof fn !== 'function' || fn.__sarmalandi) return fn;
  if (fn.length >= 4) {
    const sarmal = function (err, req, res, next) {
      try {
        const r = fn.call(this, err, req, res, next);
        if (r && typeof r.then === 'function') r.catch(next);
        return r;
      } catch (e) { return next(e); }
    };
    sarmal.__sarmalandi = true;
    return sarmal;
  }
  const sarmal = function (req, res, next) {
    try {
      const r = fn.call(this, req, res, next);
      if (r && typeof r.then === 'function') r.catch(next);
      return r;
    } catch (e) { return next(e); }
  };
  sarmal.__sarmalandi = true;
  return sarmal;
}

// Bir Express Router'ının (ya da app'in) tüm katmanlarını yerinde sarmalar.
// Alt router'lara özyinelemeli iner, böylece app.use('/api', router) ile
// bağlanan her şey kapsanır.
export function sarmala(katmanli) {
  const yigin = katmanli && (katmanli.stack || (katmanli._router && katmanli._router.stack));
  if (!Array.isArray(yigin)) return katmanli;
  for (const katman of yigin) {
    if (!katman) continue;
    if (katman.route && Array.isArray(katman.route.stack)) {
      for (const alt of katman.route.stack) {
        if (alt && typeof alt.handle === 'function') alt.handle = sarmalaIsleyici(alt.handle);
      }
      continue;
    }
    if (typeof katman.handle === 'function') {
      // Alt router ise önce içine in, sonra kendisini sarmalama (router'ın
      // kendi handle'ı zaten Express'in dispatcher'ıdır).
      if (Array.isArray(katman.handle.stack)) { sarmala(katman.handle); continue; }
      katman.handle = sarmalaIsleyici(katman.handle);
    }
  }
  return katmanli;
}

// Son katman: sarmala() tarafından iletilen hatayı tek biçimli JSON'a çevirir.
// İstemciye hata AYRINTISI verilmez (yığın izi/iç mesaj sızdırmamak için);
// ayrıntı yalnız sunucu logunda kalır.
export function hataKatmani(err, req, res, next) {
  const yol = `${req.method} ${String(req.originalUrl || req.url || '').split('?')[0]}`;
  console.error(`[hata] ${yol} — ${(err && (err.message || err.code)) || 'bilinmeyen hata'}`);
  if (res.headersSent) return next(err);
  return res.status(500).json({ error: 'Sunucuda beklenmeyen bir hata oluştu.' });
}

// Son çare ağı: sarmala()'nın ulaşamadığı yerlerde (zamanlayıcılar, arka plan
// işleri) oluşan hatalar süreci ÖLDÜRMESİN. Sunucunun ayakta kalması,
// sessizce ölmesinden her zaman iyidir; hata yine de loglanır.
export function surecAginiKur() {
  process.on('unhandledRejection', (sebep) => {
    console.error('[yakalanmamış-red]', (sebep && (sebep.message || sebep.code)) || String(sebep));
  });
  process.on('uncaughtException', (e) => {
    console.error('[yakalanmamış-hata]', (e && (e.message || e.code)) || String(e));
  });
}
