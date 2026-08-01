// ---------------------------------------------------------------------------
// OPERATÖR KİMLİĞİ — moderasyon yetkisi kimde?
// ---------------------------------------------------------------------------
// Topluluk kuralları sayfası "her bildirim elle incelenir" diye söz veriyor.
// O sözü tutacak birinin bildirimleri GÖREBİLMESİ gerekiyor. Bu dosya, o
// yetkinin kimde olduğunu belirler.
//
// TASARIM KARARLARI (ve sebepleri):
//
// 1. Yetki UYGULAMAYA GÖMÜLMEZ. Uygulama paketi herkesin telefonunda; içine
//    yazılan her şey okunabilir. Operatör listesi yalnız sunucudaki .env
//    dosyasında (MODERATOR_EMAILS) durur. İstemci "ben moderatörüm" diyemez;
//    sunucu, DOĞRULANMIŞ belirteçten gelen e-postaya bakar.
//
// 2. VERİTABANINDA rol tablosu YOK. Rol tablosu, RLS politikası olmayan bir
//    şemada yeni bir saldırı yüzeyi açardı ve yetkiyi yükseltmek için tek bir
//    satır yazmak yeterli olurdu. .env dosyasını değiştirmek sunucuya erişim
//    ister — bu daha yüksek bir eşiktir.
//
// 3. KAPI KAPALI BAŞLAR (fail-closed). Değişken tanımsızsa, boşsa ya da
//    bozuksa HİÇ KİMSE operatör değildir. Ters tasarım — "liste yoksa herkes
//    geçsin" — yapılandırma unutulduğunda tüm bildirimleri herkese açardı.
//
// 4. JOKER YOK. `*`, `@ornek.com` gibi girdiler kabul edilmez; her giriş tam
//    bir e-posta adresi olmalıdır. Alt-dize eşleşmesi de yapılmaz:
//    "ali@x.com" listedeyse "kotu-ali@x.com" giremez.
//
// 5. E-POSTA DOĞRULANMIŞ OLMALI. Doğrulanmamış adresle giriş mümkün olduğu
//    için, listedeki adresi başka biri kendine kaydedip yetki devralabilirdi.
//    Bu yüzden `email_confirmed_at` aranır.
//
// Bu dosya Supabase'i İÇERİ ALMAZ: yalnız `req.user` nesnesine ve ortam
// değişkenlerine bakar. Böylece bağlantı olmadan, gerçek kullanıcı
// şekilleriyle test edilebilir.

/** Kapı geçilemediğinde dönen sebepler (istemciye giden metin değil, anahtar). */
export const RET_SEBEPLERI = Object.freeze({
  TANIMSIZ: 'tanimsiz', // MODERATOR_EMAILS yok/boş/bozuk → kimse operatör değil
  GIRIS_YOK: 'giris-yok', // istek kimliksiz geldi
  LISTE_DISI: 'liste-disi', // giriş yapılmış ama bu adres listede değil
  DOGRULANMAMIS: 'eposta-dogrulanmamis', // adres listede ama e-posta doğrulanmamış
});

/**
 * .env'deki ham metni temiz bir adres listesine çevirir.
 *
 * Ayraç serbesttir (virgül, noktalı virgül, boşluk, satır sonu) çünkü .env
 * dosyasına elle yazılır ve tek bir yanlış ayraç yüzünden kilitlenmek
 * gereksizdir. Ama GEÇERLİLİK serbest değildir: `@` içermeyen ve joker içeren
 * her giriş sessizce ATILIR.
 *
 * @param {object} env  process.env benzeri nesne
 * @returns {string[]}  küçük harfe indirilmiş, benzersiz adresler
 */
export function operatorListesi(env = {}) {
  const ham = String(env?.MODERATOR_EMAILS ?? '');
  const parcalar = ham.split(/[,;\s]+/);
  const temiz = [];
  for (const p of parcalar) {
    const adres = p.trim().toLowerCase();
    if (!adres) continue;
    if (adres.includes('*')) continue; // joker asla
    // Tam bir adres olmalı: yerel kısım + @ + nokta içeren alan adı.
    if (!/^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/.test(adres)) continue;
    if (!temiz.includes(adres)) temiz.push(adres);
  }
  return temiz;
}

/**
 * Bir kullanıcının operatör olup olmadığını ve DEĞİLSE sebebini döndürür.
 *
 * Sebep, kilitlenme teşhisi için gereklidir: e-postası listede olan biri
 * "neden 403 alıyorum" sorusunu başka türlü yanıtlayamaz. Ama sebep, listede
 * OLMAYAN birine yapılandırma hakkında bilgi vermez (bkz. `operatorKapisi`).
 *
 * @param {object|null} user  Supabase kullanıcı nesnesi (mw.js'in doğruladığı)
 * @param {object} env
 * @returns {{operator: boolean, sebep: string, listeVar: boolean}}
 */
export function operatorDurumu(user, env = {}) {
  const liste = operatorListesi(env);
  const listeVar = liste.length > 0;
  if (!listeVar) return { operator: false, sebep: RET_SEBEPLERI.TANIMSIZ, listeVar };

  const eposta = String(user?.email ?? '').trim().toLowerCase();
  if (!eposta) return { operator: false, sebep: RET_SEBEPLERI.GIRIS_YOK, listeVar };
  if (!liste.includes(eposta)) return { operator: false, sebep: RET_SEBEPLERI.LISTE_DISI, listeVar };

  if (!user?.email_confirmed_at) {
    return { operator: false, sebep: RET_SEBEPLERI.DOGRULANMAMIS, listeVar };
  }
  return { operator: true, sebep: '', listeVar };
}

/** Kısa biçim. */
export function operatorMu(user, env = {}) {
  return operatorDurumu(user, env).operator;
}

/**
 * Express ara katmanı: operatör değilse 403.
 *
 * `requireAuth` SONRASINDA kullanılır — bu kapı kimlik doğrulamaz, yalnız
 * yetkiye bakar. 404 yerine 403 dönülür: uç zaten uygulamanın kaynağında
 * görünür, gizlemeye çalışmak yalnız teşhisi zorlaştırırdı.
 *
 * İstemciye giden metin, listede OLMAYAN birine yapılandırma hakkında bilgi
 * vermez. Yalnız listedeki bir hesaba "e-postan doğrulanmamış" denir; o kişi
 * zaten adresin listede olduğunu bilir ve tıkanmanın sebebini bilmeye ihtiyacı
 * vardır.
 */
export function operatorKapisi(env = process.env) {
  return (req, res, next) => {
    const durum = operatorDurumu(req.user, env);
    if (durum.operator) return next();
    if (durum.sebep === RET_SEBEPLERI.DOGRULANMAMIS) {
      return res.status(403).json({
        error: 'Bu bölüme girebilmek için önce e-posta adresini doğrulaman gerekiyor.',
        sebep: durum.sebep,
      });
    }
    return res.status(403).json({ error: 'Bu bölüm moderasyon yetkisi olan hesaba özeldir.' });
  };
}
