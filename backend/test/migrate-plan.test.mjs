// ---------------------------------------------------------------------------
// PLAN + GİZLİLİK TESTLERİ — veritabanı GEREKTİRMEZ (saf mantık).
// ---------------------------------------------------------------------------
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readdirSync } from 'node:fs';
import { ozetle, planCikar, dosyalariOku } from '../src/migrate/plan.js';
import { baglantiVarMi, sslAyari, baglantiYapilandirmasi, gizle, guvenliHata } from '../src/migrate/dbUrl.js';

const d = (surum, dosya, icerik) => ({ surum, sira: Number(surum), dosya, icerik, ozet: ozetle(icerik) });
const kayit = (surum, dosya, checksum) => ({ version: surum, filename: dosya, checksum });

// ——— TEK KEZ ÇALIŞMA ———
test('uygulanmış dosya tekrar çalışmaz, yenisi bekler', () => {
  const dosyalar = [d('001', '001_a.sql', 'select 1'), d('002', '002_b.sql', 'select 2')];
  const defter = [kayit('001', '001_a.sql', ozetle('select 1'))];
  const { bekleyen, uygulanmis, sorunlar } = planCikar(dosyalar, defter);
  assert.deepEqual(bekleyen.map((x) => x.surum), ['002']);
  assert.deepEqual(uygulanmis.map((x) => x.surum), ['001']);
  assert.equal(sorunlar.length, 0);
});

test('hiçbir şey bekliyor değilse plan boştur', () => {
  const dosyalar = [d('001', '001_a.sql', 'select 1')];
  const { bekleyen } = planCikar(dosyalar, [kayit('001', '001_a.sql', ozetle('select 1'))]);
  assert.equal(bekleyen.length, 0);
});

// ——— BÜTÜNLÜK: sessizce kabul YOK ———
test('uygulanmış dosya sonradan DEĞİŞTİRİLMİŞSE sessizce kabul edilmez', () => {
  const dosyalar = [d('001', '001_a.sql', 'select 1 -- sonradan eklendi')];
  const defter = [kayit('001', '001_a.sql', ozetle('select 1'))];
  const { sorunlar, bekleyen } = planCikar(dosyalar, defter);
  assert.equal(sorunlar.length, 1);
  assert.equal(sorunlar[0].tur, 'icerik-degismis');
  assert.match(sorunlar[0].mesaj, /DEĞİŞMİŞ/);
  assert.equal(bekleyen.length, 0, 'değişmiş dosya "bekleyen" sayılıp yeniden çalıştırılmaz');
});

test('uygulanmış dosyanın ADI değiştirilemez', () => {
  const dosyalar = [d('001', '001_yeni_ad.sql', 'select 1')];
  const defter = [kayit('001', '001_eski_ad.sql', ozetle('select 1'))];
  const { sorunlar } = planCikar(dosyalar, defter);
  assert.equal(sorunlar[0].tur, 'dosya-adi-degismis');
});

test('uygulanmış dosya SİLİNMİŞSE fark edilir', () => {
  const { sorunlar } = planCikar([], [kayit('001', '001_a.sql', 'x')]);
  assert.equal(sorunlar[0].tur, 'dosya-silinmis');
});

test('araya geriye dönük migration sokulamaz', () => {
  const dosyalar = [d('001', '001_a.sql', 'a'), d('002', '002_yeni.sql', 'b'), d('003', '003_c.sql', 'c')];
  const defter = [kayit('001', '001_a.sql', ozetle('a')), kayit('003', '003_c.sql', ozetle('c'))];
  const { sorunlar } = planCikar(dosyalar, defter);
  assert.equal(sorunlar.length, 1);
  assert.equal(sorunlar[0].tur, 'sirasiz');
  assert.equal(sorunlar[0].surum, '002');
});

// ——— DOSYA DÜZENİ ———
test('kurala uymayan dosya adı sessizce ATLANMAZ, hata olur', () => {
  // Sessiz atlama, bir migration'ın hiç çalışmaması demek olurdu.
  assert.throws(() => dosyalariOku(fileURLToPath(new URL('./fixtures/bozuk-migration/', import.meta.url))), /dosya adı/i);
});

// Beklenen sürüm listesi ELLE yazılmaz. Elle yazılınca her yeni migration bu
// testi kırıyordu (007 eklenince kırıldı) — ve "yeni dosya ekleyince kırılan"
// bir test, insanı beklentiyi düşünmeden güncellemeye alıştırır; böyle bir test
// artık hiçbir şey ölçmez. Bunun yerine ÜÇ değişmez ölçülür:
//   1. ÇEKİRDEK dosyalar hâlâ orada ve aynı sırada (silinen migration yakalanır),
//   2. sürümler 001'den başlayıp BOŞLUKSUZ artıyor (atlanan dosya yakalanır),
//   3. klasördeki her .sql okunmuş (sessizce atlanan dosya yakalanır).
const CEKIRDEK = ['001', '002', '003', '004', '005', '006', '007'];

test('gerçek migrations klasörü sırayla ve eksiksiz okunur', () => {
  const klasor = fileURLToPath(new URL('../migrations/', import.meta.url));
  const dosyalar = dosyalariOku(klasor);
  const surumler = dosyalar.map((x) => x.surum);

  assert.deepEqual(
    surumler.slice(0, CEKIRDEK.length), CEKIRDEK,
    'çekirdek migration dosyaları eksik ya da sırası değişmiş',
  );
  assert.ok(surumler.length >= CEKIRDEK.length, 'klasörde çekirdekten az dosya var');

  // Boşluksuz artış: 001, 002, ... — bir sürüm atlanırsa o dosya hiç çalışmaz.
  surumler.forEach((s, i) => {
    assert.equal(s, String(i + 1).padStart(3, '0'), `sürüm sırası bozuk: ${s}`);
  });

  // Klasörde durup da okunmayan .sql kalmamalı.
  const klasordeki = readdirSync(klasor).filter((f) => f.endsWith('.sql')).sort();
  assert.deepEqual(
    dosyalar.map((x) => x.dosya).sort(), klasordeki,
    'klasördeki bir .sql dosyası okunmadan atlanmış',
  );

  assert.ok(dosyalar.every((x) => /^[0-9a-f]{64}$/.test(x.ozet)), 'her dosyanın sha256 mührü var');
});

test('aynı içerik aynı mührü verir, tek bayt fark mührü değiştirir', () => {
  assert.equal(ozetle('abc'), ozetle('abc'));
  assert.notEqual(ozetle('abc'), ozetle('abc '));
});

// ——— GİZLİLİK: bağlantı bilgisi hiçbir yere sızmaz ———
test('bağlantı dizesi log/hata metninden temizlenir', () => {
  const env = { SUPABASE_DB_URL: 'postgresql://postgres:GizliParola123@db.abcdefgh.supabase.co:5432/postgres' };
  const metin = `bağlanılamadı: ${env.SUPABASE_DB_URL} (getaddrinfo db.abcdefgh.supabase.co)`;
  const temiz = gizle(metin, env);
  assert.ok(!temiz.includes('GizliParola123'), 'parola sızmaz');
  assert.ok(!temiz.includes('postgres:'), 'kullanıcı adı sızmaz');
  assert.ok(!temiz.includes('abcdefgh.supabase.co'), 'sunucu adresi sızmaz');
});

test('ortamdaki DİĞER gizli değerler de temizlenir', () => {
  const env = { FOOTYSTATS_API_KEY: 'anahtar-cok-gizli-123', ANTHROPIC_API_KEY: 'sk-ant-gizli-98765' };
  const temiz = gizle('istek başarısız: key=anahtar-cok-gizli-123 & sk-ant-gizli-98765', env);
  assert.ok(!temiz.includes('anahtar-cok-gizli-123'));
  assert.ok(!temiz.includes('sk-ant-gizli-98765'));
});

test('pooler adresi de gizlenir', () => {
  const temiz = gizle('host aws-0-eu-central-1.pooler.supabase.com timeout', {});
  assert.ok(!temiz.includes('pooler.supabase.com'));
});

test('guvenliHata sürücü hatasını gizli bilgi olmadan döndürür', () => {
  const env = { SUPABASE_DB_URL: 'postgresql://u:ParolamBuydu@db.xyz.supabase.co:5432/postgres' };
  const err = Object.assign(new Error('connect ETIMEDOUT db.xyz.supabase.co:5432 (ParolamBuydu)'), { code: 'ETIMEDOUT' });
  const metin = guvenliHata(err, env);
  assert.ok(metin.includes('[ETIMEDOUT]'), 'hata kodu korunur (teşhis için gerekli)');
  assert.ok(!metin.includes('ParolamBuydu'));
  assert.ok(!metin.includes('xyz.supabase.co'));
});

test('gizle() kısa/boş değerleri yanlışlıkla maskelemez', () => {
  // 8 karakterden kısa değerler metinde yaygın olabilir; hepsini maskelemek
  // hata mesajını okunamaz hâle getirirdi.
  const temiz = gizle('port 5432 hatası', { INTERNAL_API_KEY: '5432' });
  assert.equal(temiz, 'port 5432 hatası');
});

// ——— BAĞLANTI YAPILANDIRMASI ———
test('bağlantı yoksa açıkça "tanimsiz" döner', () => {
  assert.equal(baglantiVarMi({}), false);
  assert.equal(baglantiVarMi({ SUPABASE_DB_URL: '   ' }), false);
  assert.equal(baglantiVarMi({ SUPABASE_DB_URL: 'postgresql://x' }), true);
  assert.equal(baglantiYapilandirmasi({}).sebep, 'tanimsiz');
});

test('PostgreSQL olmayan adres reddedilir', () => {
  assert.equal(baglantiYapilandirmasi({ SUPABASE_DB_URL: 'https://ornek.com' }).sebep, 'protokol');
  assert.equal(baglantiYapilandirmasi({ SUPABASE_DB_URL: 'bu bir url değil' }).sebep, 'bicim');
});

test('sslmode libpq anlamına uygun uygulanır', () => {
  assert.equal(sslAyari('postgresql://u:p@localhost:5432/db').ssl, false, 'yerelde şifreleme gerekmez');
  const uzak = sslAyari('postgresql://u:p@db.abc.supabase.co:5432/postgres');
  assert.equal(uzak.mod, 'require', 'uzakta varsayılan ŞİFRELİ');
  assert.equal(uzak.ssl.rejectUnauthorized, false);
  const katı = sslAyari('postgresql://u:p@db.abc.supabase.co:5432/postgres?sslmode=verify-full');
  assert.equal(katı.ssl.rejectUnauthorized, true, 'verify-full zinciri doğrular');
  assert.equal(sslAyari('postgresql://u:p@db.abc.supabase.co/postgres?sslmode=disable').ssl, false);
});

test('yapılandırma özeti gizli bilgi TAŞIMAZ', () => {
  const env = { SUPABASE_DB_URL: 'postgresql://postgres:Parola@db.abc.supabase.co:5432/postgres' };
  const y = baglantiYapilandirmasi(env);
  assert.ok(y.ok);
  assert.ok(!y.ozet.includes('Parola'), 'özet loglanabilir olmalı');
  assert.ok(!y.ozet.includes('supabase.co'));
  assert.equal(y.config.application_name, 'sportoto-migrate');
  assert.ok(y.config.connectionTimeoutMillis > 0, 'sonsuza kadar asılı kalmaz');
});
