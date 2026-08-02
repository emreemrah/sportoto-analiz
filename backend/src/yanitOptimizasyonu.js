// YANIT OPTİMİZASYONU — yayına çıkışta ölçek için iki temel kazanç.
// ---------------------------------------------------------------------------
// ÖLÇÜM (2 Ağustos 2026, /api/bulletin):
//   gövde 615 KB · sıkıştırılmamış · Cache-Control YOK
//   ölçülen tavan ~79 istek/sn (50 eşzamanlı)
//   istemci bülten ekranı açıkken 15 SANİYEDE BİR yokluyor
// Yani ekranı açık her kullanıcı dakikada 4 × 615 KB = 2,4 MB indiriyor.
// 1.500 eşzamanlı kullanıcı = saatte ~220 GB. Yayına bu hâliyle çıkılamaz.
//
// 1) SIKIŞTIRMA: JSON çok iyi sıkışır — 615 KB → 20 KB (gzip, %97 kazanç).
//    Harici paket KURULMADI (proje kuralı: sormadan paket kurma); Node'un
//    kendi zlib'i kullanılıyor.
//
// 2) Cache-Control: 'no-cache' — ADI YANILTICI: "önbellekleme" demek DEĞİL,
//    "her seferinde DOĞRULA" demektir. İstemci ETag ile gelir, içerik
//    değişmediyse sunucu 304 döner ve GÖVDE HİÇ GÖNDERİLMEZ (~200 bayt).
//    Başlık olmadan istemci tarafı önbellek devreye girmiyordu; 15 saniyelik
//    yoklamaların her biri tam gövde indiriyordu.
//    'max-age' KULLANILMADI: canlı skor 45 sn'de tazeleniyor, istemcinin eski
//    skoru "taze" sanıp göstermesi kabul edilemez. Doğrulama ucuz, yanlış
//    skor değil.
import zlib from 'node:zlib';

// Bu eşiğin altında sıkıştırmanın CPU maliyeti kazancından büyük.
export const SIKISTIRMA_ESIGI = 1024;

/** İstemcinin kabul ettiği en iyi kodlama. Hiçbiri yoksa null. */
export function kodlamaSec(acceptEncoding) {
  const a = String(acceptEncoding || '').toLowerCase();
  if (a.includes('br')) return 'br';
  if (a.includes('gzip')) return 'gzip';
  return null;
}

export function sikistir(buf, kodlama) {
  if (kodlama === 'br') {
    // Kalite 5: JSON'da 11'e çok yakın oran, kat kat düşük CPU.
    return zlib.brotliCompressSync(buf, {
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 },
    });
  }
  return zlib.gzipSync(buf, { level: 6 });
}

/**
 * GET yanıtlarını sıkıştıran ve doğrulanabilir kılan ara katman.
 *
 * Yalnız JSON ve yalnız GET: yükleme uçlarına (avatar) ve akışlara dokunmaz.
 * Zaten kodlanmış yanıtlar (bir üst katman sıkıştırdıysa) OLDUĞU GİBİ geçer —
 * iki kez sıkıştırmak gövdeyi bozar.
 */
export function yanitOptimizasyonu() {
  return function ara(req, res, next) {
    if (req.method !== 'GET') return next();

    const asilJson = res.json.bind(res);
    res.json = (govde) => {
      try {
        // Doğrulamaya izin ver: ETag ile gelen istemci 304 alabilsin.
        if (!res.getHeader('Cache-Control')) res.setHeader('Cache-Control', 'no-cache');

        const ham = Buffer.from(JSON.stringify(govde));
        const kodlama = kodlamaSec(req.headers['accept-encoding']);
        if (!kodlama || ham.length < SIKISTIRMA_ESIGI || res.getHeader('Content-Encoding')) {
          return asilJson(govde);
        }

        const kucuk = sikistir(ham, kodlama);
        res.setHeader('Content-Encoding', kodlama);
        res.setHeader('Vary', 'Accept-Encoding');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        // ETag HAM gövdeden üretilir: aynı içerik gzip ve brotli istemcilerde
        // AYNI etiketi almalı, yoksa kodlama değişince doğrulama kırılır.
        res.setHeader('ETag', `W/"${ham.length.toString(16)}-${zlib.crc32 ? zlib.crc32(ham).toString(16) : hashla(ham)}"`);
        if (req.headers['if-none-match'] === res.getHeader('ETag')) {
          res.removeHeader('Content-Encoding');
          return res.status(304).end();
        }
        res.setHeader('Content-Length', kucuk.length);
        return res.end(kucuk);
      } catch {
        // Optimizasyon ASLA yanıtı engellemez — hata olursa düz JSON döner.
        return asilJson(govde);
      }
    };
    next();
  };
}

/**
 * HAZIR PAKET — gövdeyi BİR KEZ dizip her kodlamada BİR KEZ sıkıştırır.
 * Sıcak uçlar (15 sn'de bir yoklanan /api/bulletin) bunu bellekte tutar;
 * böylece istek başına dizme/sıkıştırma maliyeti ortadan kalkar.
 */
export function paketHazirla(govde) {
  const ham = Buffer.from(JSON.stringify(govde));
  return {
    ham,
    gzip: ham.length >= SIKISTIRMA_ESIGI ? sikistir(ham, 'gzip') : null,
    br: ham.length >= SIKISTIRMA_ESIGI ? sikistir(ham, 'br') : null,
    etag: `W/"${ham.length.toString(16)}-${hashla(ham)}"`,
  };
}

/** Hazır paketi istemcinin kabul ettiği kodlamayla yollar (304 dahil). */
export function paketiYolla(req, res, paket) {
  res.setHeader('ETag', paket.etag);
  if (!res.getHeader('Cache-Control')) res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Vary', 'Accept-Encoding');
  if (req.headers['if-none-match'] === paket.etag) return res.status(304).end();

  const kodlama = kodlamaSec(req.headers['accept-encoding']);
  const govde = (kodlama && paket[kodlama]) || paket.ham;
  if (kodlama && paket[kodlama]) res.setHeader('Content-Encoding', kodlama);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', govde.length);
  return res.end(govde);
}

// zlib.crc32 yalnız yeni Node sürümlerinde var; yoksa hafif bir yedek.
function hashla(buf) {
  let h = 5381;
  for (let i = 0; i < buf.length; i += 64) h = ((h * 33) ^ buf[i]) >>> 0;
  return h.toString(16);
}
