// ---------------------------------------------------------------------------
// GÜVENLİ BAĞLANTI AYARI — SUPABASE_DB_URL'i okur, ASLA loglamaz.
// ---------------------------------------------------------------------------
// KESİN KURAL (proje): "Supabase bağlantı bilgileri hiçbir zaman uygulama
// koduna, mobil pakete, repoya veya loglara yazılmamalı."
//
// Bu dosya o kuralın teknik karşılığıdır:
//   • Bağlantı dizesi YALNIZ ortam değişkeninden okunur (process.env).
//   • Değer hiçbir zaman döndürülen nesnede metin olarak taşınmaz; doğrudan
//     sürücüye verilir.
//   • `gizle()` her log ve HER HATA METNİ için son süzgeçtir: parola, bağlantı
//     dizesi ve sunucu adresi hata mesajlarından da temizlenir. (PostgreSQL
//     sürücüleri bağlantı hatalarında adresi mesaja koyar — bu yüzden şarttır.)

/** Bağlantı dizesi tanımlı mı? (Değeri OKUNMAZ, yalnız varlığı sorulur.) */
export function baglantiVarMi(env = process.env) {
  return typeof env.SUPABASE_DB_URL === 'string' && env.SUPABASE_DB_URL.trim().length > 0;
}

/**
 * libpq'nun `sslmode` anlamını uygular:
 *   disable      → şifreleme yok (yalnız yerel geliştirme)
 *   require      → ŞİFRELİ, sertifika zinciri doğrulanmaz  (Supabase'in verdiği
 *                  bağlantı dizelerinin varsayılanı; trafik gizlidir)
 *   verify-ca /
 *   verify-full  → ŞİFRELİ + sertifika zinciri doğrulanır (en katı)
 * Belirtilmemişse: yerelde `disable`, uzakta `require`.
 */
export function sslAyari(urlMetni) {
  let u;
  try { u = new URL(urlMetni); } catch { return { hata: 'bicim' }; }
  const yerel = ['localhost', '127.0.0.1', '::1'].includes(u.hostname);
  const mod = (u.searchParams.get('sslmode') || (yerel ? 'disable' : 'require')).toLowerCase();

  if (mod === 'disable') return { ssl: false, mod };
  if (mod === 'verify-ca' || mod === 'verify-full') {
    return { ssl: { rejectUnauthorized: true, servername: u.hostname }, mod };
  }
  // require / prefer / allow → şifreli, zincir doğrulaması yok.
  return { ssl: { rejectUnauthorized: false }, mod };
}

/**
 * Sürücüye verilecek bağlantı yapılandırması.
 * @returns {{ok:true, config:object, ozet:string}|{ok:false, sebep:string}}
 */
export function baglantiYapilandirmasi(env = process.env) {
  const ham = (env.SUPABASE_DB_URL || '').trim();
  if (!ham) return { ok: false, sebep: 'tanimsiz' };

  let u;
  try { u = new URL(ham); } catch { return { ok: false, sebep: 'bicim' }; }
  if (!/^postgres(ql)?:$/.test(u.protocol)) return { ok: false, sebep: 'protokol' };

  const { ssl } = sslAyari(ham);

  return {
    ok: true,
    config: {
      connectionString: ham,
      ssl,
      // Migration uzun sürebilir; ama sonsuza kadar asılı kalmamalı.
      connectionTimeoutMillis: Number(env.MIGRATION_CONNECT_TIMEOUT_MS) || 15_000,
      statement_timeout: Number(env.MIGRATION_STATEMENT_TIMEOUT_MS) || 120_000,
      application_name: 'sportoto-migrate',
    },
    // Loglanabilir ÖZET: adres, kullanıcı ve parola YOK.
    ozet: 'yapılandırılmış güvenli PostgreSQL bağlantısı',
  };
}

/**
 * Metinden gizli bilgileri siler. Log ve hata mesajlarında SON SÜZGEÇ.
 * Yalnız bağlantı dizesini değil, ortamdaki bütün gizli değerleri temizler.
 */
export function gizle(metin, env = process.env) {
  let s = typeof metin === 'string' ? metin : String(metin ?? '');

  // 1) Bağlantı dizesi biçimindeki her şey (parola dâhil).
  s = s.replace(/postgres(?:ql)?:\/\/[^\s"'`]+/gi, 'postgresql://<gizli>');

  // 2) Ortamdaki gizli değerlerin metinde birebir geçmesi.
  const gizliAnahtarlar = [
    'SUPABASE_DB_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_URL',
    'FOOTYSTATS_API_KEY', 'ANTHROPIC_API_KEY', 'APIFOOTBALL_API_KEY', 'INTERNAL_API_KEY',
  ];
  for (const anahtar of gizliAnahtarlar) {
    const deger = env[anahtar];
    if (typeof deger === 'string' && deger.length >= 8) {
      s = s.split(deger).join('<gizli>');
    }
  }

  // 3) Bağlantı dizesinin PARÇALARI — parola, sunucu ve (proje kimliği taşıyan)
  //    kullanıcı adı hata metinlerinde TEK BAŞINA da geçebilir. PostgreSQL
  //    sürücüsü bağlantı hatasında bunları ayrı ayrı yazar; tam URL'yi aramak
  //    yetmez. (Bu boşluk test/migrate-plan.test.mjs tarafından yakalandı.)
  for (const parca of baglantiParcalari(env.SUPABASE_DB_URL)) {
    s = s.split(parca).join('<gizli>');
  }

  // 4) Supabase proje adresleri ve pooler sunucuları (hata metinlerinde çıkar).
  s = s.replace(/\b[a-z0-9-]+\.supabase\.(co|com|net)\b/gi, '<gizli-sunucu>');
  s = s.replace(/\b[a-z0-9-]*\.?pooler\.supabase\.com\b/gi, '<gizli-sunucu>');

  return s;
}

/**
 * Bağlantı dizesinden, metinde tek başına geçtiğinde gizlenmesi gereken
 * parçaları çıkarır. Uzunluğa göre elenir: çok kısa parçaları maskelemek
 * (ör. "5432") hata mesajını okunamaz hâle getirirdi.
 */
function baglantiParcalari(urlMetni) {
  if (!urlMetni) return [];
  let u;
  try { u = new URL(urlMetni.trim()); } catch { return []; }
  const parcalar = new Set();

  const ekle = (deger, enAz) => {
    if (typeof deger === 'string' && deger.length >= enAz) parcalar.add(deger);
  };

  // Parola: her hâlükârda gizli. URL'de yüzde-kodlanmış olabilir; iki biçim de.
  ekle(u.password, 3);
  try { ekle(decodeURIComponent(u.password), 3); } catch { /* bozuk kodlama */ }

  // Sunucu adı: proje kimliğini taşır. Yerel adresler gizlenmez (teşhis için gerekli).
  if (!['localhost', '127.0.0.1', '::1', ''].includes(u.hostname)) ekle(u.hostname, 4);

  // Kullanıcı adı: yalnız proje kimliği taşıyan biçimde (`postgres.abcdefgh`).
  // Düz "postgres" maskelenmez — her yerde geçen genel bir sözcüktür.
  if (u.username.includes('.')) ekle(u.username, 6);

  // Uzun parçalar önce değişsin ki kısa olan uzunun içini bozmasın.
  return [...parcalar].sort((a, b) => b.length - a.length);
}

/** Hatayı, gizli bilgi taşımayan güvenli bir metne çevirir. */
export function guvenliHata(err, env = process.env) {
  const kod = err?.code ? ` [${err.code}]` : '';
  return gizle(`${err?.message || err}${kod}`, env);
}
