// ---------------------------------------------------------------------------
// OPERATÖR PANELİ TESTLERİ — kim inceleyebilir, inceleyince ne oluyor
// ---------------------------------------------------------------------------
// Topluluk Kuralları sayfası (backend/legal/topluluk-kurallari.html) kullanıcıya
// açık bir söz veriyor: "her bildirim elle incelenir, en geç 7 gün içinde".
// Google Play'in üçüncü şartı da tam olarak budur — bildirimlere karşılık veren
// bir SÜREÇ. Bu dosya, o sözü tutan mekanizmayı ölçer.
//
// Üç katman:
//
//   1. YETKİ (saf) — src/moderatorGate.js
//      Operatör listesi .env'den nasıl okunur, kim geçer, kim geçemez.
//      En kritik iddia: KAPI KAPALI BAŞLAR. Yapılandırma yoksa veya bozuksa
//      hiç kimse operatör değildir. Ters tasarım, unutulmuş bir .env satırında
//      tüm bildirimleri herkese açardı.
//
//   2. İŞLEM MANTIĞI (sahte istemci) — src/moderationOps.js
//      Gizle / geri al / yok say hangi tabloya HANGİ SIRAYLA yazıyor. Sıra
//      burada bir üslup tercihi değil; 007'deki trigger yüzünden doğruluk
//      şartıdır. Sahte istemcide trigger yok, o yüzden burada yalnız SIRA ve
//      YAZILAN DEĞERLER ölçülür.
//
//   3. GERÇEK DAVRANIŞ (gerçek PostgreSQL) — trigger ile birlikte
//      Asıl soru şu: operatörün kararı ile trigger BİRBİRİYLE KAVGA EDİYOR MU?
//      Elle gizlenmiş bir yorumu trigger sessizce açarsa, moderasyon süreci
//      kâğıt üzerinde kalır. Bu SQL okunarak kanıtlanamaz; çalıştırmak gerekir.
//
// ÇALIŞTIRMA: MIGRATION_TEST_DB_URL tanımlıysa 3. katman da çalışır, yoksa
// ATLANIR. "Atlandı" GEÇTİ demek DEĞİLDİR.

import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

import {
  RET_SEBEPLERI,
  operatorListesi,
  operatorDurumu,
  operatorMu,
  operatorKapisi,
} from '../src/moderatorGate.js';
import {
  ELLE_GIZLEME_SEBEBI,
  BILDIRIM_DURUMLARI,
  LISTE_SINIRI,
  bildirimleriGrupla,
  bekleyenBildirimler,
  yorumuGizle,
  yorumuGeriAl,
  bildirimiYokSay,
} from '../src/moderationOps.js';
import { OTOMATIK_GIZLEME_SEBEBI, BILDIRIM_SEBEPLERI } from '../src/moderation.js';
import { makeFakeSb } from './helpers/fakeSupabase.mjs';
import { pgSupabase } from './helpers/pgSupabase.mjs';
import {
  atla, atlamaUyarisi, veritabaniKur, baglan, kullanicilar, gizlilik,
} from './helpers/livePg.mjs';

if (atla) {
  console.warn(atlamaUyarisi(
    'Operatör kararı ile otomatik gizleme trigger\'ının çakışmadığı',
  ));
}

const KAYNAK = (yol) => readFileSync(fileURLToPath(new URL(yol, import.meta.url)), 'utf8');

/**
 * Kaynaktan yorum satırlarını atar.
 *
 * Kaynak taraması yaparken bunu YAPMAK ZORUNLU: bir dosyanın başlığında
 * "yetki MODERATOR_EMAILS'ten gelir" diye AÇIKLAMA yazması, o dosyanın değişkeni
 * OKUDUĞU anlamına gelmez. Açıklamayı ihlal saymak, doğru yazılmış belgeyi
 * cezalandırır ve testi güvenilmez kılar.
 */
const koduSoy = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');

/** Doğrulanmış, listede olan bir kullanıcı. */
const gecerliKullanici = (eposta) => ({
  id: 'op-1', email: eposta, email_confirmed_at: '2026-01-01T00:00:00Z',
});

// ═══════════════════════════════════════════════════════════════════════════
// 1) YETKİ — operatör listesi ve kapı
// ═══════════════════════════════════════════════════════════════════════════

test('MODERATOR_EMAILS yoksa, boşsa veya boşlukluysa liste BOŞTUR (kapı kapalı)', () => {
  assert.deepEqual(operatorListesi({}), []);
  assert.deepEqual(operatorListesi({ MODERATOR_EMAILS: '' }), []);
  assert.deepEqual(operatorListesi({ MODERATOR_EMAILS: '   \n\t ' }), []);
  assert.deepEqual(operatorListesi({ MODERATOR_EMAILS: null }), []);
  assert.deepEqual(operatorListesi(), []);
});

test('ayraç serbesttir: virgül, noktalı virgül, boşluk ve satır sonu', () => {
  // .env dosyasına elle yazılır; tek bir yanlış ayraç yüzünden kilitlenmek
  // gereksiz olurdu. Ayraç serbest, GEÇERLİLİK değil.
  const beklenen = ['a@x.com', 'b@x.com', 'c@x.com'];
  assert.deepEqual(operatorListesi({ MODERATOR_EMAILS: 'a@x.com,b@x.com,c@x.com' }), beklenen);
  assert.deepEqual(operatorListesi({ MODERATOR_EMAILS: 'a@x.com; b@x.com ;c@x.com' }), beklenen);
  assert.deepEqual(operatorListesi({ MODERATOR_EMAILS: 'a@x.com b@x.com\nc@x.com' }), beklenen);
  assert.deepEqual(operatorListesi({ MODERATOR_EMAILS: ' , a@x.com , , b@x.com , c@x.com , ' }), beklenen);
});

test('adresler küçük harfe indirilir ve tekrarlar atılır', () => {
  assert.deepEqual(
    operatorListesi({ MODERATOR_EMAILS: 'Ali@Ornek.COM, ali@ornek.com, ALI@ORNEK.COM' }),
    ['ali@ornek.com'],
  );
});

test('JOKER ve bozuk girdiler SESSİZCE atılır, listeyi zehirleyemez', () => {
  // Bir jokerin kabul edilmesi, o alan adındaki HERKESİ operatör yapardı.
  for (const bozuk of ['*', '*@ornek.com', 'ali@*', '@ornek.com', 'ali', 'ali@', 'ali@localhost', 'a@b', '@']) {
    assert.deepEqual(
      operatorListesi({ MODERATOR_EMAILS: bozuk }), [],
      `"${bozuk}" listeye girmemeliydi`,
    );
  }
  // Geçerli bir adresle karışık gelirse yalnız geçerli olan kalır.
  assert.deepEqual(
    operatorListesi({ MODERATOR_EMAILS: '*@ornek.com, ali@ornek.com, *' }),
    ['ali@ornek.com'],
  );
});

test('liste tanımsızken DOĞRULANMIŞ bir kullanıcı bile operatör DEĞİLDİR', () => {
  const durum = operatorDurumu(gecerliKullanici('ali@ornek.com'), {});
  assert.equal(durum.operator, false);
  assert.equal(durum.sebep, RET_SEBEPLERI.TANIMSIZ);
  assert.equal(durum.listeVar, false);
});

test('kimliksiz istek operatör değildir (giris-yok)', () => {
  const env = { MODERATOR_EMAILS: 'ali@ornek.com' };
  assert.equal(operatorDurumu(null, env).sebep, RET_SEBEPLERI.GIRIS_YOK);
  assert.equal(operatorDurumu(undefined, env).sebep, RET_SEBEPLERI.GIRIS_YOK);
  assert.equal(operatorDurumu({}, env).sebep, RET_SEBEPLERI.GIRIS_YOK);
  assert.equal(operatorDurumu({ email: '   ' }, env).sebep, RET_SEBEPLERI.GIRIS_YOK);
});

test('EŞLEŞME TAMDIR: alt-dize ile yetki alınamaz', () => {
  const env = { MODERATOR_EMAILS: 'ali@ornek.com' };
  // Bu üçü, "içeriyor" biçiminde bir kontrolde geçerdi.
  for (const sahte of ['kotu-ali@ornek.com', 'ali@ornek.com.tr', 'ali@ornek.co', 'xali@ornek.com']) {
    const durum = operatorDurumu(gecerliKullanici(sahte), env);
    assert.equal(durum.operator, false, `${sahte} operatör OLMAMALI`);
    assert.equal(durum.sebep, RET_SEBEPLERI.LISTE_DISI);
  }
});

test('büyük/küçük harf ve baştaki-sondaki boşluk eşleşmeyi bozmaz', () => {
  const env = { MODERATOR_EMAILS: 'Ali@Ornek.COM' };
  assert.equal(operatorMu({ email: ' ALI@ornek.com ', email_confirmed_at: 'x' }, env), true);
});

test('e-postası DOĞRULANMAMIŞ hesap, listede olsa bile operatör değildir', () => {
  // Doğrulanmamış adresle giriş mümkün olduğu için, aksi hâlde listedeki adresi
  // başkası kendine kaydedip yetkiyi devralabilirdi.
  const env = { MODERATOR_EMAILS: 'ali@ornek.com' };
  const durum = operatorDurumu({ id: 'u1', email: 'ali@ornek.com' }, env);
  assert.equal(durum.operator, false);
  assert.equal(durum.sebep, RET_SEBEPLERI.DOGRULANMAMIS);
  assert.equal(operatorDurumu({ id: 'u1', email: 'ali@ornek.com', email_confirmed_at: null }, env).operator, false);
});

test('listede + doğrulanmış = operatör', () => {
  const env = { MODERATOR_EMAILS: 'ali@ornek.com, veli@ornek.com' };
  const durum = operatorDurumu(gecerliKullanici('veli@ornek.com'), env);
  assert.deepEqual(durum, { operator: true, sebep: '', listeVar: true });
  assert.equal(operatorMu(gecerliKullanici('veli@ornek.com'), env), true);
});

test('İSTEMCİNİN "ben moderatörüm" demesi HİÇBİR ŞEY ifade etmez', () => {
  // Yetki yalnız sunucudaki listeden gelir. Belirteç içindeki alanlar, üst
  // bilgiler veya gövdeye eklenen bayraklar dikkate alınmaz.
  const env = { MODERATOR_EMAILS: 'ali@ornek.com' };
  const sahte = {
    id: 'u9',
    email: 'saldirgan@ornek.com',
    email_confirmed_at: '2026-01-01T00:00:00Z',
    role: 'admin',
    is_moderator: true,
    moderator: true,
    app_metadata: { role: 'service_role', moderator: true },
    user_metadata: { is_moderator: true },
  };
  assert.equal(operatorMu(sahte, env), false);
});

test('operatorKapisi: operatör geçer, next() TAM BİR KEZ çağrılır', () => {
  const env = { MODERATOR_EMAILS: 'ali@ornek.com' };
  let gecti = 0;
  let cevapVerildi = false;
  const res = { status() { cevapVerildi = true; return this; }, json() { cevapVerildi = true; return this; } };
  operatorKapisi(env)({ user: gecerliKullanici('ali@ornek.com') }, res, () => { gecti += 1; });
  assert.equal(gecti, 1);
  assert.equal(cevapVerildi, false, 'geçen istekte cevap yazılmamalı');
});

test('operatorKapisi: listede olmayana 403 döner ve YAPILANDIRMA SIZDIRMAZ', () => {
  const env = { MODERATOR_EMAILS: 'ali@ornek.com' };
  const { kod, govde, next } = kapiCalistir(env, { user: gecerliKullanici('baskasi@ornek.com') });
  assert.equal(kod, 403);
  assert.equal(next, 0, 'kapı geçilmemeliydi');
  assert.equal(govde.sebep, undefined, 'listede olmayana sebep anahtarı verilmez');
  // Listedeki adresler, listenin varlığı ya da yokluğu cevaptan okunamamalı.
  assert.ok(!/ali@ornek\.com|MODERATOR_EMAILS|\.env/i.test(JSON.stringify(govde)), govde.error);
});

test('operatorKapisi: listedeki ama doğrulanmamış hesaba SEBEP söylenir', () => {
  // Bu kişi adresin listede olduğunu zaten biliyor; tıkanmanın sebebini
  // öğrenemezse kilitlenir. Sebep YALNIZ ona açıklanır.
  const env = { MODERATOR_EMAILS: 'ali@ornek.com' };
  const { kod, govde } = kapiCalistir(env, { user: { id: 'u1', email: 'ali@ornek.com' } });
  assert.equal(kod, 403);
  assert.equal(govde.sebep, RET_SEBEPLERI.DOGRULANMAMIS);
  assert.match(govde.error, /doğrula/i);
});

test('operatorKapisi: liste tanımsızken HERKESE 403 (fail-closed)', () => {
  const { kod, next } = kapiCalistir({}, { user: gecerliKullanici('ali@ornek.com') });
  assert.equal(kod, 403);
  assert.equal(next, 0);
});

/** Kapıyı çalıştırıp yazılan durumu/gövdeyi toplar. */
function kapiCalistir(env, req) {
  let kod = 0;
  let govde = null;
  let next = 0;
  const res = {
    status(k) { kod = k; return this; },
    json(g) { govde = g; return this; },
  };
  operatorKapisi(env)(req, res, () => { next += 1; });
  return { kod, govde: govde || {}, next };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2) KAYNAK SÖZLEŞMELERİ — bozulması sessiz olurdu
// ═══════════════════════════════════════════════════════════════════════════

test('elle ve otomatik gizleme sebepleri FARKLIDIR (tüm tasarım buna dayanır)', () => {
  // Bu ikisi eşitlenirse trigger'ın geri alma dalı operatörün kararını siler.
  // moderationOps.js modül yüklenirken de patlar; burada niyet yazılı kalsın.
  assert.notEqual(ELLE_GIZLEME_SEBEBI, OTOMATIK_GIZLEME_SEBEBI);
  assert.ok(ELLE_GIZLEME_SEBEBI.length > 0);
});

test('bildirim durumları 007\'deki CHECK ile birebir aynıdır', () => {
  const sql = KAYNAK('../migrations/007_moderation_report_block.sql');
  const m = sql.match(/status\s+text\s+not null\s+default\s+'beklemede'\s*\n?\s*check \(status in \(([^)]*)\)\)/);
  assert.ok(m, '007 içinde status CHECK kısıtı bulunamadı');
  const sqldeki = [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]);
  assert.deepEqual([...BILDIRIM_DURUMLARI], sqldeki);
});

test('moderatorGate Supabase\'i İÇERİ ALMAZ (bağlantısız test edilebilsin)', () => {
  const src = KAYNAK('../src/moderatorGate.js');
  assert.ok(!/from\s+['"][^'"]*supabase/i.test(src), 'moderatorGate.js supabase import etmemeli');
});

test('YETKİ YALNIZ TEK YERDE okunur: MODERATOR_EMAILS\'i başka dosya OKUMAZ', () => {
  // Yetkinin ikinci bir okuma noktası, birinde unutulan bir kontrol demektir.
  // Ölçülen şey KOD; açıklama satırlarında değişkenin adının geçmesi serbest.
  assert.ok(koduSoy(KAYNAK('../src/moderatorGate.js')).includes('MODERATOR_EMAILS'));
  for (const yol of ['../src/routes/moderation.js', '../src/server.js', '../src/moderationOps.js']) {
    assert.ok(!koduSoy(KAYNAK(yol)).includes('MODERATOR_EMAILS'), `${yol} yetkiyi kendisi okumamalı`);
  }
});

test('GET /access operatör kapısının ÜSTÜNDEDİR (normal kullanıcı 403 almaz)', () => {
  // Uygulama, Profil ekranında girişi gösterip göstermeyeceğine bu uca bakarak
  // karar veriyor. Uç kapının ALTINA kayarsa her normal kullanıcı 403 alır ve
  // arayüzde sebepsiz bir hata belirir.
  const src = KAYNAK('../src/routes/moderation.js');
  const erisim = src.indexOf("router.get('/access'");
  const kapi = src.indexOf('operatorKapisi(process.env)');
  assert.ok(erisim > 0, '/access ucu bulunamadı');
  assert.ok(kapi > 0, 'operatör kapısı bulunamadı');
  assert.ok(erisim < kapi, '/access ucu operatör kapısından ÖNCE tanımlanmalı');
});

// ═══════════════════════════════════════════════════════════════════════════
// 3) GRUPLAMA — saf işlev, gizlilik dahil
// ═══════════════════════════════════════════════════════════════════════════

const bildirim = (id, comment_id, reporter_id, ek = {}) => ({
  id, comment_id, reporter_id, reason: 'spam', note: '', status: 'beklemede',
  created_at: '2026-07-01T00:00:00Z', ...ek,
});

test('bildirimler yoruma göre gruplanır; sayılar KİŞİ ve KAYIT olarak ayrılır', () => {
  const [g] = bildirimleriGrupla([
    bildirim(1, 10, 'a'),
    bildirim(2, 10, 'b', { reason: 'hakaret' }),
    bildirim(3, 10, 'b', { reason: 'hakaret' }), // aynı kişi (kısıt normalde engeller)
  ]);
  assert.equal(g.commentId, 10);
  assert.equal(g.reporterCount, 2, 'FARKLI kişi sayısı');
  assert.equal(g.reportCount, 3, 'kayıt sayısı');
  assert.deepEqual(g.reasons, { spam: 1, hakaret: 2 });
});

test('sıralama: çok kişi bildireni önce, eşitlikte ESKİ olanı önce', () => {
  const out = bildirimleriGrupla([
    bildirim(1, 10, 'a', { created_at: '2026-07-05T00:00:00Z' }),
    bildirim(2, 20, 'a', { created_at: '2026-07-01T00:00:00Z' }),
    bildirim(3, 20, 'b', { created_at: '2026-07-02T00:00:00Z' }),
    bildirim(4, 30, 'a', { created_at: '2026-07-03T00:00:00Z' }),
  ]);
  assert.deepEqual(out.map((g) => g.commentId), [20, 30, 10]);
  assert.equal(out[0].firstAt, '2026-07-01T00:00:00Z');
  assert.equal(out[0].lastAt, '2026-07-02T00:00:00Z');
});

test('GİZLİLİK: gruplama çıktısında BİLDİRENİN kimliği hiçbir yerde geçmez', () => {
  // Bildiren kimliği operatöre de gösterilmez; kararı vermek için gerekli olan
  // şey yorumun kendisi ve sebeplerdir. Sayı yeter, kimlik değil.
  const out = bildirimleriGrupla([
    bildirim(1, 10, 'gizli-kimlik-aaa'),
    bildirim(2, 10, 'gizli-kimlik-bbb'),
  ]);
  const metin = JSON.stringify(out);
  assert.ok(!metin.includes('gizli-kimlik'), 'bildiren kimliği çıktıya sızmış');
  assert.ok(!/reporter_id|reporterId/.test(metin), 'çıktıda reporter alanı olmamalı');
});

test('bozuk satırlar gruplamayı düşürmez', () => {
  const out = bildirimleriGrupla([
    null,
    { comment_id: null, reporter_id: 'a' },      // yorumu olmayan satır atlanır
    bildirim(1, 10, null, { reason: null }),      // kimliksiz bildiren, sebepsiz
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].reporterCount, 0);
  assert.deepEqual(out[0].reasons, { diger: 1 });
  assert.equal(out[0].reports[0].note, '');
});

test('bildirimleriGrupla boş/geçersiz girdiyle boş dizi döner', () => {
  assert.deepEqual(bildirimleriGrupla([]), []);
  assert.deepEqual(bildirimleriGrupla(null), []);
  assert.deepEqual(bildirimleriGrupla(undefined), []);
});

// ═══════════════════════════════════════════════════════════════════════════
// 4) İŞLEM MANTIĞI — sahte istemci (SIRA ve YAZILAN DEĞERLER)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sahte istemciyi izleyen ince sarmalayıcı: hangi tabloya hangi işlemin
 * HANGİ SIRAYLA gittiğini kaydeder. Kayıt, sorgu kurulurken değil ÇALIŞIRKEN
 * tutulur; ölçülen şey gerçek çalışma sırasıdır.
 */
function izle(sb) {
  const kayit = [];
  return {
    kayit,
    yazmalar: () => kayit.filter((k) => k.islem !== 'select'),
    from(ad) {
      const q = sb.from(ad);
      const asil = q.then.bind(q);
      q.then = (coz, red) => {
        kayit.push({ tablo: ad, islem: q.action, yama: q.patch ? { ...q.patch } : null });
        return asil(coz, red);
      };
      return q;
    },
  };
}

/** Yorum + bildirimleri hazır bir sahte veritabanı kurar. */
function kur({ yorumlar = [], bildirimler = [] } = {}) {
  const sb = makeFakeSb();
  sb._rowsOf('comments').push(...yorumlar);
  sb._rowsOf('comment_reports').push(...bildirimler);
  return sb;
}

const yorumSatiri = (id, ek = {}) => ({
  id, match_id: 'm1', user_id: 'yazar-1', text: 'deneme',
  created_at: '2026-07-01T00:00:00Z', hidden_at: null, hidden_reason: null, ...ek,
});

test('yorumuGizle: ÖNCE yorumu gizler, SONRA bildirimleri kapatır', () => {
  // Sıra şart: sebep ELLE yazıldıktan sonra bildirim hareketi olursa trigger
  // bu gizlemeye dokunamaz. Ters sırada, bildirimler kapanınca trigger yorumu
  // (henüz otomatik sebeple gizliyken) açar ve gizleme kaybolurdu.
  const sb = kur({
    yorumlar: [yorumSatiri(10)],
    bildirimler: [bildirim(1, 10, 'a'), bildirim(2, 10, 'b')],
  });
  const g = izle(sb);
  return yorumuGizle(g, { commentId: 10, operatorId: 'op-1', now: 'T1' }).then((s) => {
    assert.deepEqual(g.yazmalar().map((k) => k.tablo), ['comments', 'comment_reports']);
    assert.equal(s.ok, true);
    assert.equal(s.hiddenBy, 'elle');
  });
});

test('yorumuGizle: sebep ELLE yazılır, bekleyen bildirimler "kabul" olur', async () => {
  const sb = kur({
    yorumlar: [yorumSatiri(10)],
    bildirimler: [
      bildirim(1, 10, 'a'),
      bildirim(2, 10, 'b', { status: 'ret' }),      // kapatılmış — dokunulmamalı
      bildirim(3, 99, 'c'),                          // başka yorum — dokunulmamalı
    ],
  });
  const s = await yorumuGizle(sb, { commentId: 10, operatorId: 'op-1', now: 'T1' });

  assert.deepEqual(s, { ok: true, hidden: true, hiddenAt: 'T1', hiddenBy: 'elle' });
  const [y] = sb._rowsOf('comments');
  assert.equal(y.hidden_at, 'T1');
  assert.equal(y.hidden_reason, ELLE_GIZLEME_SEBEBI);
  assert.notEqual(y.hidden_reason, OTOMATIK_GIZLEME_SEBEBI);

  const b = sb._rowsOf('comment_reports');
  assert.equal(b[0].status, 'kabul');
  assert.equal(b[0].reviewed_by, 'op-1');
  assert.equal(b[0].reviewed_at, 'T1');
  assert.equal(b[1].status, 'ret', 'zaten reddedilmiş bildirim değişmemeli');
  assert.equal(b[2].status, 'beklemede', 'başka yorumun bildirimi değişmemeli');
});

test('yorumuGizle: OTOMATİK gizlenmişse gizlenme ANI korunur, sebep ELLE olur', async () => {
  // "Ne zamandır gizli" bilgisi ileri kaymamalı; operatör onayladı diye yorum
  // yeni gizlenmiş sayılmaz.
  const sb = kur({
    yorumlar: [yorumSatiri(10, { hidden_at: 'T0', hidden_reason: OTOMATIK_GIZLEME_SEBEBI })],
  });
  const s = await yorumuGizle(sb, { commentId: 10, operatorId: 'op-1', now: 'T9' });
  assert.equal(s.hiddenAt, 'T0');
  assert.equal(sb._rowsOf('comments')[0].hidden_at, 'T0');
  assert.equal(sb._rowsOf('comments')[0].hidden_reason, ELLE_GIZLEME_SEBEBI);
});

test('yorumuGizle: olmayan yorum ve geçersiz numara AYRI sebeplerle reddedilir', async () => {
  // Ayrım önemli: "yok" 404, "geçersiz" 400 döner. Bozuk bir isteğe 404 demek,
  // istemcinin hatasını sunucunun eksiği gibi gösterirdi.
  const sb = kur({ yorumlar: [yorumSatiri(10)] });
  assert.deepEqual(await yorumuGizle(sb, { commentId: 404 }), { ok: false, sebep: 'yorum-yok' });
  for (const bozuk of ['abc', '', null, undefined, 0, -1, 1.5, NaN, [], {}]) {
    assert.deepEqual(
      await yorumuGizle(sb, { commentId: bozuk }), { ok: false, sebep: 'gecersiz-yorum' },
      `${JSON.stringify(bozuk)} geçersiz sayılmalıydı`,
    );
  }
  assert.deepEqual(await yorumuGizle(sb, {}), { ok: false, sebep: 'gecersiz-yorum' });
});

test('yorumuGeriAl: ÖNCE bildirimleri kapatır, SONRA gizlemeyi temizler', () => {
  // Ters sırada geride geçerli bildirimler kalırdı; o yoruma yapılacak herhangi
  // bir bildirim hareketi yorumu sessizce yeniden gizlerdi. (5. bölümde gerçek
  // veritabanında da gösteriliyor.)
  const sb = kur({
    yorumlar: [yorumSatiri(10, { hidden_at: 'T0', hidden_reason: ELLE_GIZLEME_SEBEBI })],
    bildirimler: [bildirim(1, 10, 'a')],
  });
  const g = izle(sb);
  return yorumuGeriAl(g, { commentId: 10, operatorId: 'op-1', now: 'T1' }).then(() => {
    assert.deepEqual(g.yazmalar().map((k) => k.tablo), ['comment_reports', 'comments']);
  });
});

test('yorumuGeriAl: gizleme temizlenir, AÇIK bildirimlerin hepsi "ret" olur', async () => {
  const sb = kur({
    yorumlar: [yorumSatiri(10, { hidden_at: 'T0', hidden_reason: ELLE_GIZLEME_SEBEBI })],
    bildirimler: [
      bildirim(1, 10, 'a'),
      bildirim(2, 10, 'b', { status: 'kabul' }),   // önceki kararlar da kapanır
      bildirim(3, 10, 'c', { status: 'ret' }),
      bildirim(4, 99, 'd'),                         // başka yorum
    ],
  });
  const s = await yorumuGeriAl(sb, { commentId: 10, operatorId: 'op-1', now: 'T1' });

  assert.deepEqual(s, { ok: true, hidden: false });
  const y = sb._rowsOf('comments')[0];
  assert.equal(y.hidden_at, null);
  assert.equal(y.hidden_reason, null);

  const b = sb._rowsOf('comment_reports');
  assert.deepEqual(b.filter((r) => String(r.comment_id) === '10').map((r) => r.status), ['ret', 'ret', 'ret']);
  assert.equal(b[3].status, 'beklemede', 'başka yorumun bildirimi değişmemeli');
});

test('yorumuGeriAl: olmayan yorum ve geçersiz numara AYRI sebeplerle reddedilir', async () => {
  const sb = kur({ yorumlar: [yorumSatiri(10)] });
  assert.deepEqual(await yorumuGeriAl(sb, { commentId: 404 }), { ok: false, sebep: 'yorum-yok' });
  for (const bozuk of ['abc', '', null, undefined, 0, -1, 1.5]) {
    assert.deepEqual(
      await yorumuGeriAl(sb, { commentId: bozuk }), { ok: false, sebep: 'gecersiz-yorum' },
      `${JSON.stringify(bozuk)} geçersiz sayılmalıydı`,
    );
  }
});

test('bildirimiYokSay: bildirimi "ret" yapar ve yorumun numarasını döner', async () => {
  const sb = kur({ bildirimler: [bildirim(1, 10, 'a'), bildirim(2, 10, 'b')] });
  const s = await bildirimiYokSay(sb, { reportId: 1, operatorId: 'op-1', now: 'T1' });
  assert.deepEqual(s, { ok: true, commentId: 10 });
  const b = sb._rowsOf('comment_reports');
  assert.equal(b[0].status, 'ret');
  assert.equal(b[0].reviewed_by, 'op-1');
  assert.equal(b[1].status, 'beklemede', 'yalnız seçilen bildirim kapanmalı');
});

test('bildirimiYokSay: zaten reddedilmişse YAZMAZ (idempotent)', async () => {
  const sb = kur({ bildirimler: [bildirim(1, 10, 'a', { status: 'ret', reviewed_by: 'op-eski' })] });
  const g = izle(sb);
  const s = await bildirimiYokSay(g, { reportId: 1, operatorId: 'op-yeni', now: 'T2' });

  assert.deepEqual(s, { ok: true, already: true, commentId: 10 });
  assert.deepEqual(g.yazmalar(), [], 'gereksiz yazma yapılmamalı');
  assert.equal(sb._rowsOf('comment_reports')[0].reviewed_by, 'op-eski', 'ilk kararın izi korunmalı');
});

test('bildirimiYokSay: olmayan ve geçersiz numara AYRI sebeplerle reddedilir', async () => {
  // 'abc' gibi bir metin gerçek veritabanında tür hatası verirdi; kapıda
  // durdurulması, bozuk isteğin 500 olarak görünmesini engeller.
  const sb = kur({ bildirimler: [bildirim(1, 10, 'a')] });
  assert.deepEqual(await bildirimiYokSay(sb, { reportId: 404 }), { ok: false, sebep: 'bildirim-yok' });
  for (const bozuk of ['abc', '  ', '', null, undefined, 0, -1, 1.5]) {
    assert.deepEqual(
      await bildirimiYokSay(sb, { reportId: bozuk }), { ok: false, sebep: 'gecersiz-bildirim' },
      `${JSON.stringify(bozuk)} geçersiz sayılmalıydı`,
    );
  }
  assert.deepEqual(await bildirimiYokSay(sb, {}), { ok: false, sebep: 'gecersiz-bildirim' });
});

// --- bekleyenBildirimler ---------------------------------------------------

test('bekleyenBildirimler: bildirim yoksa boş liste döner', async () => {
  assert.deepEqual(await bekleyenBildirimler(kur()), { items: [], total: 0, orphanCount: 0 });
});

test('bekleyenBildirimler: yorumu birleştirir, gizlemenin ELLE mi OTOMATİK mi olduğunu söyler', async () => {
  const sb = kur({
    yorumlar: [
      yorumSatiri(10),
      yorumSatiri(20, { hidden_at: 'T0', hidden_reason: OTOMATIK_GIZLEME_SEBEBI, user_id: 'yazar-2' }),
      yorumSatiri(30, { hidden_at: 'T0', hidden_reason: ELLE_GIZLEME_SEBEBI }),
    ],
    bildirimler: [
      bildirim(1, 10, 'a'),
      bildirim(2, 20, 'b'), bildirim(3, 20, 'c'), bildirim(4, 20, 'd'),
      bildirim(5, 30, 'e'), bildirim(6, 30, 'f'),
    ],
  });
  const { items, total, orphanCount } = await bekleyenBildirimler(sb, {
    profilOku: async (ids) => Object.fromEntries(ids.map((id) => [id, { username: `ad-${id}` }])),
  });

  assert.equal(total, 3);
  assert.equal(orphanCount, 0);
  // 3 kişi bildiren önce, sonra 2, sonra 1.
  assert.deepEqual(items.map((i) => i.commentId), [20, 30, 10]);
  assert.deepEqual(items.map((i) => i.hiddenBy), ['otomatik', 'elle', null]);
  assert.deepEqual(items.map((i) => i.hidden), [true, true, false]);
  assert.equal(items[0].author.username, 'ad-yazar-2');
  assert.equal(items[0].text, 'deneme');
  assert.equal(items[0].matchId, 'm1');
});

test('bekleyenBildirimler: profili olmayan yazar için ad UYDURULMAZ', async () => {
  const sb = kur({ yorumlar: [yorumSatiri(10)], bildirimler: [bildirim(1, 10, 'a')] });
  const { items } = await bekleyenBildirimler(sb, { profilOku: async () => ({}) });
  assert.equal(items[0].author.username, 'Silinmiş kullanıcı');
  assert.equal(items[0].author.id, undefined, 'yazar kimliği dönmemeli');
});

test('bekleyenBildirimler: yalnız "beklemede" olanlar listelenir', async () => {
  const sb = kur({
    yorumlar: [yorumSatiri(10), yorumSatiri(20)],
    bildirimler: [bildirim(1, 10, 'a'), bildirim(2, 20, 'b', { status: 'ret' })],
  });
  const { items, total } = await bekleyenBildirimler(sb);
  assert.equal(total, 1);
  assert.deepEqual(items.map((i) => i.commentId), [10]);
});

test('bekleyenBildirimler: silinmiş yoruma ait bildirimler SESSİZCE ATILMAZ, sayılır', async () => {
  // Yabancı anahtar korumalı eklendiği için gerçekten öksüz satır kalabilir.
  // Operatör "listede 5 yazıyordu, 4 gördüm" durumuna düşmemeli.
  const sb = kur({
    yorumlar: [yorumSatiri(10)],
    bildirimler: [bildirim(1, 10, 'a'), bildirim(2, 77, 'b'), bildirim(3, 77, 'c')],
  });
  const { items, total, orphanCount } = await bekleyenBildirimler(sb);
  assert.deepEqual(items.map((i) => i.commentId), [10]);
  assert.equal(total, 2, 'öksüz grup toplamdan düşmez');
  assert.equal(orphanCount, 2, 'öksüz KAYIT sayısı bildirilmeli');
});

test('bekleyenBildirimler: limit listeyi kısar ama TOPLAM gerçeği söyler', async () => {
  const yorumlar = [];
  const bildirimler = [];
  for (let i = 1; i <= 5; i += 1) {
    yorumlar.push(yorumSatiri(i));
    bildirimler.push(bildirim(i, i, `k${i}`, { created_at: `2026-07-0${i}T00:00:00Z` }));
  }
  const sb = kur({ yorumlar, bildirimler });
  const { items, total } = await bekleyenBildirimler(sb, { limit: 2 });
  assert.equal(items.length, 2);
  assert.equal(total, 5);
  assert.deepEqual(items.map((i) => i.commentId), [1, 2], 'en eski ikisi');
});

test('bekleyenBildirimler: GİZLİLİK — çıktının hiçbir yerinde bildiren kimliği yok', async () => {
  const sb = kur({
    yorumlar: [yorumSatiri(10)],
    bildirimler: [bildirim(1, 10, 'gizli-kimlik-aaa', { note: 'çok kötü' })],
  });
  const sonuc = await bekleyenBildirimler(sb, { profilOku: async () => ({}) });
  const metin = JSON.stringify(sonuc);
  assert.ok(!metin.includes('gizli-kimlik'), 'bildiren kimliği sızmış');
  assert.ok(!/reporter_id|reporterId/.test(metin));
  assert.ok(metin.includes('çok kötü'), 'notun kendisi operatöre görünmeli');
});

test('LISTE_SINIRI makul bir üst sınırdır', () => {
  assert.ok(Number.isInteger(LISTE_SINIRI) && LISTE_SINIRI > 0 && LISTE_SINIRI <= 500);
});

// ═══════════════════════════════════════════════════════════════════════════
// 5) GERÇEK DAVRANIŞ — operatör kararı vs. otomatik gizleme trigger'ı
// ═══════════════════════════════════════════════════════════════════════════
// Buradan aşağısı GERÇEK PostgreSQL ister. Ölçülen şey artık "sahte istemciye
// ne yazıldı" değil, üretimde çalışacak kodun trigger'lı şema üstündeki sonucu.

/** Test için bir yorum ve n bildirim üretir. */
async function sahneKur(db, bildirenSayisi) {
  const kisiler = await kullanicilar(db, bildirenSayisi + 1);
  const yazar = kisiler[0];
  const bildirenler = kisiler.slice(1);
  const [y] = await db.q(
    `insert into public.comments (match_id, user_id, text) values ('m1', $1, 'deneme') returning id`,
    [yazar],
  );
  for (const k of bildirenler) {
    await db.q(
      `insert into public.comment_reports (comment_id, reporter_id, reason) values ($1, $2, 'spam')`,
      [y.id, k],
    );
  }
  return { yorumId: y.id, yazar, bildirenler };
}

const gecerliBildirimSayisi = (db, id) => db
  .q(`select count(distinct reporter_id)::int as n from public.comment_reports
      where comment_id = $1 and status <> 'ret'`, [id])
  .then((r) => r[0].n);

test('ELLE gizleme, tüm bildirimler reddedilse bile AYAKTA kalır', { skip: atla }, async () => {
  // Bu, tüm tasarımın dayandığı iddia. Trigger'ın geri alma dalı yalnız KENDİ
  // yazdığı sebebi temizler; operatörün kararı ona ait değildir.
  const db = await baglan(await veritabaniKur('modops'));
  try {
    const sb = pgSupabase(db);
    const { yorumId } = await sahneKur(db, 2); // eşiğin altında: henüz gizli değil
    assert.equal((await gizlilik(db, yorumId)).hidden_at, null);

    const s = await yorumuGizle(sb, { commentId: yorumId, operatorId: null });
    assert.equal(s.ok, true);
    let g = await gizlilik(db, yorumId);
    assert.equal(g.hidden_reason, ELLE_GIZLEME_SEBEBI);

    // Şimdi bildirimlerin HEPSİ reddedilsin — trigger geri alma dalına girer.
    await db.q(`update public.comment_reports set status = 'ret' where comment_id = $1`, [yorumId]);
    assert.equal(await gecerliBildirimSayisi(db, yorumId), 0);

    g = await gizlilik(db, yorumId);
    assert.notEqual(g.hidden_at, null, 'ELLE gizleme trigger tarafından silinmiş!');
    assert.equal(g.hidden_reason, ELLE_GIZLEME_SEBEBI);
  } finally { await db.kapat(); }
});

test('operatör onayı OTOMATİK gizlemeyi KİLİTLER (bildirim geri çekilse de açılmaz)', { skip: atla }, async () => {
  const db = await baglan(await veritabaniKur('modops'));
  try {
    const sb = pgSupabase(db);
    const { yorumId } = await sahneKur(db, 3); // eşik doldu → otomatik gizli
    let g = await gizlilik(db, yorumId);
    assert.equal(g.hidden_reason, OTOMATIK_GIZLEME_SEBEBI, 'otomatik gizleme çalışmadı');
    const otomatikAn = g.hidden_at;

    // Operatör bakar ve "evet, kural ihlali" der.
    await yorumuGizle(sb, { commentId: yorumId, operatorId: null });
    g = await gizlilik(db, yorumId);
    assert.equal(g.hidden_reason, ELLE_GIZLEME_SEBEBI);
    assert.deepEqual(g.hidden_at, otomatikAn, 'gizlenme anı ileri kaymamalı');

    // Bildirimler sonradan reddedilse bile karar durur.
    await db.q(`update public.comment_reports set status = 'ret' where comment_id = $1`, [yorumId]);
    g = await gizlilik(db, yorumId);
    assert.notEqual(g.hidden_at, null);
    assert.equal(g.hidden_reason, ELLE_GIZLEME_SEBEBI);
  } finally { await db.kapat(); }
});

test('yorumuGizle bekleyen bildirimleri gerçekten "kabul" olarak kapatır', { skip: atla }, async () => {
  const db = await baglan(await veritabaniKur('modops'));
  try {
    const sb = pgSupabase(db);
    const { yorumId } = await sahneKur(db, 2);
    await yorumuGizle(sb, { commentId: yorumId, operatorId: null });
    const durumlar = await db.q(
      `select status from public.comment_reports where comment_id = $1 order by id`, [yorumId],
    );
    assert.deepEqual(durumlar.map((r) => r.status), ['kabul', 'kabul']);
  } finally { await db.kapat(); }
});

test('yorumuGeriAl otomatik gizlenmiş yorumu açar ve geride AÇIK bildirim bırakmaz', { skip: atla }, async () => {
  const db = await baglan(await veritabaniKur('modops'));
  try {
    const sb = pgSupabase(db);
    const { yorumId } = await sahneKur(db, 3);
    assert.notEqual((await gizlilik(db, yorumId)).hidden_at, null);

    const s = await yorumuGeriAl(sb, { commentId: yorumId, operatorId: null });
    assert.deepEqual(s, { ok: true, hidden: false });

    const g = await gizlilik(db, yorumId);
    assert.equal(g.hidden_at, null);
    assert.equal(g.hidden_reason, null);
    assert.equal(await gecerliBildirimSayisi(db, yorumId), 0, 'geride geçerli bildirim kalmamalı');
  } finally { await db.kapat(); }
});

test('EKSİK geri alma yorumu SESSİZCE yeniden gizletir; yorumuGeriAl gizletmez', { skip: atla }, async () => {
  // Sıranın NEDEN önemli olduğunun kanıtı. Yalnız hidden_at temizlenip
  // bildirimler açık bırakılırsa, o yoruma yapılacak HERHANGİ bir bildirim
  // hareketi trigger'ı çalıştırır ve yorum kimse fark etmeden yeniden gizlenir.
  const db = await baglan(await veritabaniKur('modops'));
  try {
    const sb = pgSupabase(db);

    // (a) EKSİK yol — yalnız gizlemeyi temizle, bildirimlere dokunma.
    const a = await sahneKur(db, 3);
    await db.q(`update public.comments set hidden_at = null, hidden_reason = null where id = $1`, [a.yorumId]);
    assert.equal((await gizlilik(db, a.yorumId)).hidden_at, null, 'temizlik tutmadı');
    assert.equal(await gecerliBildirimSayisi(db, a.yorumId), 3, 'bildirimler hâlâ açık');

    // Sıradan bir dokunuş: bir bildirimin notu güncellensin.
    await db.q(
      `update public.comment_reports set note = 'ek not'
        where id = (select min(id) from public.comment_reports where comment_id = $1)`, [a.yorumId],
    );
    assert.notEqual(
      (await gizlilik(db, a.yorumId)).hidden_at, null,
      'eksik geri alma bu senaryoda güvenli görünüyor — testin dayanağı değişmiş olabilir',
    );

    // (b) DOĞRU yol — yorumuGeriAl.
    const b = await sahneKur(db, 3);
    await yorumuGeriAl(sb, { commentId: b.yorumId, operatorId: null });
    await db.q(
      `update public.comment_reports set note = 'ek not'
        where id = (select min(id) from public.comment_reports where comment_id = $1)`, [b.yorumId],
    );
    assert.equal(
      (await gizlilik(db, b.yorumId)).hidden_at, null,
      'doğru geri almadan sonra yorum yeniden gizlenmemeliydi',
    );
  } finally { await db.kapat(); }
});

test('bildirimiYokSay eşiğin altına düşürünce OTOMATİK gizleme kalkar', { skip: atla }, async () => {
  const db = await baglan(await veritabaniKur('modops'));
  try {
    const sb = pgSupabase(db);
    const { yorumId } = await sahneKur(db, 3);
    assert.notEqual((await gizlilik(db, yorumId)).hidden_at, null);

    const [ilk] = await db.q(
      `select id from public.comment_reports where comment_id = $1 order by id limit 1`, [yorumId],
    );
    const s = await bildirimiYokSay(sb, { reportId: ilk.id, operatorId: null });
    assert.equal(s.ok, true);
    assert.equal(String(s.commentId), String(yorumId));

    assert.equal(await gecerliBildirimSayisi(db, yorumId), 2);
    assert.equal((await gizlilik(db, yorumId)).hidden_at, null, 'eşik altına düşünce yorum açılmalıydı');
  } finally { await db.kapat(); }
});

test('bildirimiYokSay ELLE gizlenmiş yorumu AÇMAZ (operatörün kararı silinmez)', { skip: atla }, async () => {
  const db = await baglan(await veritabaniKur('modops'));
  try {
    const sb = pgSupabase(db);
    const { yorumId } = await sahneKur(db, 3);
    await yorumuGizle(sb, { commentId: yorumId, operatorId: null });

    const [ilk] = await db.q(
      `select id from public.comment_reports where comment_id = $1 order by id limit 1`, [yorumId],
    );
    await bildirimiYokSay(sb, { reportId: ilk.id, operatorId: null });

    const g = await gizlilik(db, yorumId);
    assert.notEqual(g.hidden_at, null, 'tek bir bildirimin reddi operatörün kararını silmemeli');
    assert.equal(g.hidden_reason, ELLE_GIZLEME_SEBEBI);
  } finally { await db.kapat(); }
});

test('bekleyenBildirimler gerçek şemadan doğru okur ve bildireni sızdırmaz', { skip: atla }, async () => {
  const db = await baglan(await veritabaniKur('modops'));
  try {
    const sb = pgSupabase(db);
    const az = await sahneKur(db, 1);
    const cok = await sahneKur(db, 3);

    const sonuc = await bekleyenBildirimler(sb, {
      profilOku: async (ids) => Object.fromEntries(ids.map((id) => [id, { username: 'kullanici' }])),
    });

    assert.equal(sonuc.total, 2);
    assert.equal(sonuc.orphanCount, 0);
    // Çok bildirilen önce gelir.
    assert.deepEqual(sonuc.items.map((i) => String(i.commentId)), [String(cok.yorumId), String(az.yorumId)]);
    assert.equal(sonuc.items[0].reporterCount, 3);
    assert.equal(sonuc.items[0].hiddenBy, 'otomatik');
    assert.equal(sonuc.items[1].reporterCount, 1);
    assert.equal(sonuc.items[1].hiddenBy, null);

    const metin = JSON.stringify(sonuc);
    for (const kimlik of [...az.bildirenler, ...cok.bildirenler]) {
      assert.ok(!metin.includes(kimlik), 'bildirenin kimliği çıktıya sızmış');
    }
  } finally { await db.kapat(); }
});

test('yayımlanan sebep listesi gerçek şemada KABUL EDİLİR (hepsi tek tek)', { skip: atla }, async () => {
  // Topluluk Kuralları sayfasındaki her sebebin veritabanınca kabul edilmesi
  // gerekir; biri reddedilirse kullanıcı "bilinmeyen bir sorun" görür.
  const db = await baglan(await veritabaniKur('modops'));
  try {
    const kisiler = await kullanicilar(db, BILDIRIM_SEBEPLERI.length + 1);
    const [y] = await db.q(
      `insert into public.comments (match_id, user_id, text) values ('m1', $1, 'deneme') returning id`,
      [kisiler[0]],
    );
    for (let i = 0; i < BILDIRIM_SEBEPLERI.length; i += 1) {
      await db.q(
        `insert into public.comment_reports (comment_id, reporter_id, reason) values ($1, $2, $3)`,
        [y.id, kisiler[i + 1], BILDIRIM_SEBEPLERI[i]],
      );
    }
    const [n] = await db.q(
      `select count(*)::int as n from public.comment_reports where comment_id = $1`, [y.id],
    );
    assert.equal(n.n, BILDIRIM_SEBEPLERI.length);
  } finally { await db.kapat(); }
});
