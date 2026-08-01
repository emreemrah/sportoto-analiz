// ---------------------------------------------------------------------------
// MODERASYON TESTLERİ — yorum bildirme + kullanıcı engelleme (E9)
// ---------------------------------------------------------------------------
// Üç katman ölçülür:
//
//   1. SAF KARAR MANTIĞI (veritabanı gerekmez)
//      Görünürlük süzgeci: kim neyi görür, düşen ebeveynin cevabına ne olur.
//
//   2. SÖZLEŞME — kod ile SQL aynı şeyi mi söylüyor?
//      `moderation.js` içindeki sebep listesi, not sınırı ve otomatik gizleme
//      sebebi, migration 007'deki CHECK kısıtlarıyla BİREBİR aynı olmalıdır.
//      Bu iki yer elle eşleştirilirse biri değişir, öteki unutulur: kullanıcı
//      arayüzde sebebi seçer, veritabanı kaydı reddeder ve hata "bilinmeyen bir
//      sorun" olarak görünür. Sözleşme testi bunu ilk çalıştırmada yakalar.
//
//   3. GERÇEK DAVRANIŞ (gerçek PostgreSQL gerektirir)
//      Eşik gerçekten 3 FARKLI kişide mi çalışıyor, geri alınabiliyor mu, aynı
//      kişi eşiği tek başına dolduramıyor mu, kendini engelleme gerçekten
//      reddediliyor mu. Bunlar SQL'i okuyarak kanıtlanamaz; çalıştırmak gerekir.
//
// ÇALIŞTIRMA: MIGRATION_TEST_DB_URL tanımlıysa 3. katman da çalışır, yoksa
// ATLANIR. "Atlandı" GEÇTİ demek DEĞİLDİR.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BILDIRIM_SEBEPLERI,
  OTOMATIK_GIZLEME_SEBEBI,
  GIZLI_YORUM_NOTU,
  NOT_SINIRI,
  engelSeti,
  gorunurYorumlar,
  zatenVarMi,
  gecersizHedefMi,
} from '../src/moderation.js';
import { makeFakeSb } from './helpers/fakeSupabase.mjs';
import {
  atla, atlamaUyarisi, veritabaniKur, baglan, kullanicilar, gizlilik,
} from './helpers/livePg.mjs';

if (atla) {
  console.warn(atlamaUyarisi(
    'Otomatik gizleme eşiği, geri alınabilirlik ve tekillik kısıtları',
  ));
}

const SQL_007 = readFileSync(new URL('../migrations/007_moderation_report_block.sql', import.meta.url), 'utf8');

// Kimlikler okunur olsun diye kısa; süzgeç için uuid olmaları gerekmiyor.
const BEN = 'u-ben';
const O = 'u-o';
const BASKASI = 'u-baskasi';

const yorum = (id, user_id, ek = {}) => ({
  id, user_id, parent_id: null, hidden_at: null, text: 't', ...ek,
});

// ═══════════════════════════════════════════════════════════════════════════
// 1) GÖRÜNÜRLÜK SÜZGECİ — saf karar mantığı
// ═══════════════════════════════════════════════════════════════════════════

test('engel yokken hiçbir yorum düşmez ve SIRA korunur', () => {
  const satirlar = [yorum(1, BEN), yorum(2, O), yorum(3, BASKASI)];
  const out = gorunurYorumlar(satirlar, { userId: BEN, engelli: new Set() });
  assert.deepEqual(out.map((r) => r.id), [1, 2, 3]);
});

test('engellenen kişinin yorumları düşer', () => {
  const satirlar = [yorum(1, BEN), yorum(2, O), yorum(3, BASKASI)];
  const out = gorunurYorumlar(satirlar, { userId: BEN, engelli: new Set([O]) });
  assert.deepEqual(out.map((r) => r.id), [1, 3]);
});

test('gizlenmiş yorum başkasına GÖRÜNMEZ ama YAZARINA görünür', () => {
  const satirlar = [yorum(1, O, { hidden_at: '2026-07-25T10:00:00Z' })];

  const baskasinaGore = gorunurYorumlar(satirlar, { userId: BEN, engelli: new Set() });
  assert.deepEqual(baskasinaGore, [], 'gizli yorum başkasına görünmemeli');

  const yazarinaGore = gorunurYorumlar(satirlar, { userId: O, engelli: new Set() });
  assert.deepEqual(yazarinaGore.map((r) => r.id), [1], 'yazar kendi gizli yorumunu görmeli');
});

test('giriş yapmamış ziyaretçi gizli yorumu göremez', () => {
  // userId null iken hiçbir satır "benim" sayılmamalı; yoksa yazarı null olan
  // (imkânsız ama) bir satır herkese açılırdı.
  const satirlar = [yorum(1, O, { hidden_at: 'x' }), yorum(2, O)];
  const out = gorunurYorumlar(satirlar, { userId: null, engelli: new Set() });
  assert.deepEqual(out.map((r) => r.id), [2]);
});

test('ebeveyni düşen cevap da düşer (sayaç ile ekran birbirini tutsun)', () => {
  const satirlar = [
    yorum(1, O),                          // engellenen kişinin yorumu
    yorum(2, BEN, { parent_id: 1 }),      // ona benim cevabım
    yorum(3, BASKASI),                    // ilgisiz
  ];
  const out = gorunurYorumlar(satirlar, { userId: BEN, engelli: new Set([O]) });
  assert.deepEqual(out.map((r) => r.id), [3], 'yetim cevap listede kalmamalı');
});

test('cevap ZİNCİRİ boyunca eleme yapılır (torun da düşer)', () => {
  const satirlar = [
    yorum(1, O),
    yorum(2, BEN, { parent_id: 1 }),
    yorum(3, BASKASI, { parent_id: 2 }),
    yorum(4, BASKASI, { parent_id: 3 }),
  ];
  const out = gorunurYorumlar(satirlar, { userId: BEN, engelli: new Set([O]) });
  assert.deepEqual(out, [], 'zincirin tamamı düşmeli');
});

test('ebeveyni duran cevap AYAKTA kalır', () => {
  const satirlar = [yorum(1, BASKASI), yorum(2, O, { parent_id: 1 })];
  const out = gorunurYorumlar(satirlar, { userId: BEN, engelli: new Set() });
  assert.deepEqual(out.map((r) => r.id), [1, 2]);
});

test('kendi gizli yorumunun altındaki cevaplar yazarına görünmeye devam eder', () => {
  const satirlar = [
    yorum(1, BEN, { hidden_at: 'x' }),
    yorum(2, BASKASI, { parent_id: 1 }),
  ];
  const bana = gorunurYorumlar(satirlar, { userId: BEN, engelli: new Set() });
  assert.deepEqual(bana.map((r) => r.id), [1, 2]);

  const baskasina = gorunurYorumlar(satirlar, { userId: BASKASI, engelli: new Set() });
  assert.deepEqual(baskasina, [], 'gizli ebeveynle birlikte cevap da düşmeli');
});

test('kimliklerin metin/sayı farkı süzgeci yanıltmaz', () => {
  // Veritabanı bigint döner, istemci bazen metin gönderir. parent_id eşleşmesi
  // tür farkı yüzünden kaçarsa BÜTÜN cevaplar yetim sayılıp sessizce silinirdi.
  const satirlar = [yorum(10, BASKASI), yorum(11, BEN, { parent_id: '10' })];
  const out = gorunurYorumlar(satirlar, { userId: BEN, engelli: new Set() });
  assert.deepEqual(out.map((r) => r.id), [10, 11]);
});

test('boş liste boş döner (çökmez)', () => {
  assert.deepEqual(gorunurYorumlar([], { userId: BEN, engelli: new Set() }), []);
  assert.deepEqual(gorunurYorumlar([]), []);
});

// ═══════════════════════════════════════════════════════════════════════════
// 2) ENGEL LİSTESİ — iki yönlü okuma, hata yutulmaz
// ═══════════════════════════════════════════════════════════════════════════

test('engel kaydı tek yönlü tutulur ama görünürlükte ÇİFT yönlü uygulanır', async () => {
  const sb = makeFakeSb();
  // BEN, O'yu engelledim. BASKASI da BENİ engellemiş.
  sb._rowsOf('user_blocks').push(
    { blocker_id: BEN, blocked_id: O },
    { blocker_id: BASKASI, blocked_id: BEN },
  );

  const benim = await engelSeti(sb, BEN);
  assert.deepEqual([...benim].sort(), [BASKASI, O].sort(),
    'hem engellediğim hem beni engelleyen görünmez olmalı');

  // O tarafında: kendisini engelleyen BEN görünmez olmalı.
  const onun = await engelSeti(sb, O);
  assert.deepEqual([...onun], [BEN]);
});

test('giriş yapmamış ziyaretçi için engel sorgusu HİÇ yapılmaz', async () => {
  let sorguSayisi = 0;
  const sb = { from() { sorguSayisi += 1; throw new Error('sorgulanmamalıydı'); } };
  const s = await engelSeti(sb, null);
  assert.equal(s.size, 0);
  assert.equal(sorguSayisi, 0);
});

test('engel listesi okunamazsa hata YUTULMAZ (sessizce boş küme dönmez)', async () => {
  // Sessizce boş küme dönmek, engellenen kişinin yorumlarını engelleyene
  // göstermek demektir — yani özelliğin var olma sebebini ortadan kaldırır.
  const sb = makeFakeSb({ missing: ['user_blocks'] });
  await assert.rejects(() => engelSeti(sb, BEN), /does not exist/);
});

// ═══════════════════════════════════════════════════════════════════════════
// 3) HATA TANIMA — idempotent uçların dayandığı ayrım
// ═══════════════════════════════════════════════════════════════════════════

test('"zaten var" hatası tanınır, başka hata tanınmaz', () => {
  assert.ok(zatenVarMi('duplicate key value violates unique constraint "user_blocks_pkey"'));
  assert.ok(zatenVarMi('23505'));
  assert.ok(!zatenVarMi('connection refused'));
  assert.ok(!zatenVarMi(''));
  assert.ok(!zatenVarMi(null));
});

test('geçersiz hedef hatası tanınır', () => {
  assert.ok(gecersizHedefMi('insert violates foreign key constraint'));
  assert.ok(gecersizHedefMi('invalid input syntax for type uuid: "abc"'));
  assert.ok(!gecersizHedefMi('duplicate key'));
  assert.ok(!gecersizHedefMi(null));
});

// ═══════════════════════════════════════════════════════════════════════════
// 4) SÖZLEŞME — kod ile migration 007 aynı şeyi söylüyor mu?
// ═══════════════════════════════════════════════════════════════════════════

test('sebep listesi kod ile SQL arasında BİREBİR aynı', () => {
  const m = SQL_007.match(/reason\s+text not null check \(reason in \(([\s\S]*?)\)\)/);
  assert.ok(m, '007 içinde sebep CHECK kısıtı bulunamadı');
  const sqldeki = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  assert.deepEqual(
    [...BILDIRIM_SEBEPLERI].sort(), sqldeki.sort(),
    'sebep listesi kodda ve veritabanında AYNI olmalı',
  );
});

test('not sınırı kod ile SQL arasında aynı', () => {
  const m = SQL_007.match(/char_length\(note\)\s*<=\s*(\d+)/);
  assert.ok(m, '007 içinde not uzunluk kısıtı bulunamadı');
  assert.equal(Number(m[1]), NOT_SINIRI);
});

test('otomatik gizleme sebebi kod ile SQL arasında aynı', () => {
  assert.ok(
    SQL_007.includes(`'${OTOMATIK_GIZLEME_SEBEBI}'`),
    'trigger\'ın yazdığı sebep metni ile koddaki sabit ayrışmış',
  );
});

test('kullanıcıya gösterilen not, bildiren kişiyi ele vermez', () => {
  // Sayı sızarsa yorumun ne zaman gizlendiğine bakılarak bildiren kişi tahmin
  // edilebilir. Not, sayı ve isim İÇERMEMELİ.
  assert.ok(!/\d/.test(GIZLI_YORUM_NOTU), 'notta sayı olmamalı');
  assert.ok(!/kişi|kullanıcı adı|bildiren/i.test(GIZLI_YORUM_NOTU), 'notta bildiren bilgisi olmamalı');
});

test('sebep listesi kapalıdır: serbest metin kabul edilmez', () => {
  assert.ok(Object.isFrozen(BILDIRIM_SEBEPLERI));
  assert.ok(!BILDIRIM_SEBEPLERI.includes(''));
  assert.equal(new Set(BILDIRIM_SEBEPLERI).size, BILDIRIM_SEBEPLERI.length, 'listede tekrar var');
});

// ═══════════════════════════════════════════════════════════════════════════
// 5) GERÇEK DAVRANIŞ — gerçek PostgreSQL
// ═══════════════════════════════════════════════════════════════════════════

// Kurulum yardımcıları (veritabaniKur / baglan / kullanicilar / gizlilik)
// helpers/livePg.mjs içinde; moderation-ops.test.mjs ile ORTAK kullanılır.

test('otomatik gizleme tam olarak 3 FARKLI kişide çalışır (2 kişi yetmez)', { skip: atla }, async () => {
  const db = await baglan(await veritabaniKur());
  try {
    const [yazar, a, b, c] = await kullanicilar(db, 4);
    const [y] = await db.q(
      `insert into public.comments (match_id, user_id, text) values ('m1', $1, 'deneme') returning id`, [yazar]);

    const bildir = (kim) => db.q(
      `insert into public.comment_reports (comment_id, reporter_id, reason) values ($1, $2, 'spam')`, [y.id, kim]);

    await bildir(a);
    assert.equal((await gizlilik(db, y.id)).hidden_at, null, '1 bildirim gizlememeli');
    await bildir(b);
    assert.equal((await gizlilik(db, y.id)).hidden_at, null, '2 bildirim gizlememeli');
    await bildir(c);

    const son = await gizlilik(db, y.id);
    assert.ok(son.hidden_at, '3 farklı kişide gizlenmeliydi');
    assert.equal(son.hidden_reason, OTOMATIK_GIZLEME_SEBEBI);
  } finally { await db.kapat(); }
});

test('aynı kişi eşiği TEK BAŞINA dolduramaz', { skip: atla }, async () => {
  const db = await baglan(await veritabaniKur());
  try {
    const [yazar, a] = await kullanicilar(db, 2);
    const [y] = await db.q(
      `insert into public.comments (match_id, user_id, text) values ('m1', $1, 'deneme') returning id`, [yazar]);

    await db.q(`insert into public.comment_reports (comment_id, reporter_id, reason) values ($1,$2,'spam')`, [y.id, a]);
    await assert.rejects(
      () => db.q(`insert into public.comment_reports (comment_id, reporter_id, reason) values ($1,$2,'hakaret')`, [y.id, a]),
      /duplicate key|unique/i,
      'aynı kişi aynı yorumu ikinci kez bildirememeli',
    );
    assert.equal((await gizlilik(db, y.id)).hidden_at, null);
  } finally { await db.kapat(); }
});

test('gizleme GERİ ALINABİLİR: bildirimler reddedilince yorum geri gelir', { skip: atla }, async () => {
  const db = await baglan(await veritabaniKur());
  try {
    const [yazar, a, b, c] = await kullanicilar(db, 4);
    const [y] = await db.q(
      `insert into public.comments (match_id, user_id, text) values ('m1', $1, 'deneme') returning id`, [yazar]);
    for (const kim of [a, b, c]) {
      await db.q(`insert into public.comment_reports (comment_id, reporter_id, reason) values ($1,$2,'spam')`, [y.id, kim]);
    }
    assert.ok((await gizlilik(db, y.id)).hidden_at, 'önce gizlenmeliydi');

    // Bir bildirim haksız bulundu → eşiğin altına düşüldü.
    await db.q(`update public.comment_reports set status = 'ret' where comment_id = $1 and reporter_id = $2`, [y.id, a]);
    const geri = await gizlilik(db, y.id);
    assert.equal(geri.hidden_at, null, 'eşik altına düşünce gizleme kalkmalı');
    assert.equal(geri.hidden_reason, null);

    // Yeniden eşiğe çıkarsa tekrar gizlenir.
    await db.q(`update public.comment_reports set status = 'beklemede' where comment_id = $1 and reporter_id = $2`, [y.id, a]);
    assert.ok((await gizlilik(db, y.id)).hidden_at, 'eşiğe dönünce tekrar gizlenmeliydi');
  } finally { await db.kapat(); }
});

test('ELLE gizlenmiş yoruma otomatik geri alma DOKUNMAZ', { skip: atla }, async () => {
  const db = await baglan(await veritabaniKur());
  try {
    const [yazar, a] = await kullanicilar(db, 2);
    const [y] = await db.q(
      `insert into public.comments (match_id, user_id, text, hidden_at, hidden_reason)
       values ('m1', $1, 'deneme', now(), 'elle: yonetici karari') returning id`, [yazar]);

    // Tek bildirim → eşik altı → geri alma yolu çalışır ama elle gizlemeye
    // dokunmamalı. Aksi hâlde bir bildirim, yönetici kararını iptal ederdi.
    await db.q(`insert into public.comment_reports (comment_id, reporter_id, reason) values ($1,$2,'spam')`, [y.id, a]);
    const son = await gizlilik(db, y.id);
    assert.ok(son.hidden_at, 'elle gizleme kaldırılmamalı');
    assert.equal(son.hidden_reason, 'elle: yonetici karari');
  } finally { await db.kapat(); }
});

test('bildirim silinince eşik yeniden hesaplanır', { skip: atla }, async () => {
  const db = await baglan(await veritabaniKur());
  try {
    const [yazar, a, b, c] = await kullanicilar(db, 4);
    const [y] = await db.q(
      `insert into public.comments (match_id, user_id, text) values ('m1', $1, 'deneme') returning id`, [yazar]);
    for (const kim of [a, b, c]) {
      await db.q(`insert into public.comment_reports (comment_id, reporter_id, reason) values ($1,$2,'spam')`, [y.id, kim]);
    }
    assert.ok((await gizlilik(db, y.id)).hidden_at);

    await db.q(`delete from public.comment_reports where comment_id = $1 and reporter_id = $2`, [y.id, a]);
    assert.equal((await gizlilik(db, y.id)).hidden_at, null, 'silme sonrası eşik altına düşmeliydi');
  } finally { await db.kapat(); }
});

test('liste dışı sebep veritabanı tarafından REDDEDİLİR', { skip: atla }, async () => {
  const db = await baglan(await veritabaniKur());
  try {
    const [yazar, a] = await kullanicilar(db, 2);
    const [y] = await db.q(
      `insert into public.comments (match_id, user_id, text) values ('m1', $1, 'deneme') returning id`, [yazar]);
    await assert.rejects(
      () => db.q(`insert into public.comment_reports (comment_id, reporter_id, reason) values ($1,$2,'kafama-gore')`, [y.id, a]),
      /check constraint/i,
    );
    // Koddaki listenin HER ÜYESİ veritabanınca kabul edilmeli.
    for (const sebep of BILDIRIM_SEBEPLERI) {
      const [k] = await kullanicilar(db, 1);
      await db.q(`insert into public.comment_reports (comment_id, reporter_id, reason) values ($1,$2,$3)`, [y.id, k, sebep]);
    }
  } finally { await db.kapat(); }
});

test('sınırı aşan açıklama REDDEDİLİR, sınırdaki kabul edilir', { skip: atla }, async () => {
  const db = await baglan(await veritabaniKur());
  try {
    const [yazar, a, b] = await kullanicilar(db, 3);
    const [y] = await db.q(
      `insert into public.comments (match_id, user_id, text) values ('m1', $1, 'deneme') returning id`, [yazar]);

    await db.q(`insert into public.comment_reports (comment_id, reporter_id, reason, note) values ($1,$2,'spam',$3)`,
      [y.id, a, 'x'.repeat(NOT_SINIRI)]);
    await assert.rejects(
      () => db.q(`insert into public.comment_reports (comment_id, reporter_id, reason, note) values ($1,$2,'spam',$3)`,
        [y.id, b, 'x'.repeat(NOT_SINIRI + 1)]),
      /check constraint/i,
    );
  } finally { await db.kapat(); }
});

test('kimse kendini engelleyemez; aynı engel iki kez kurulamaz', { skip: atla }, async () => {
  const db = await baglan(await veritabaniKur());
  try {
    const [a, b] = await kullanicilar(db, 2);
    await assert.rejects(
      () => db.q(`insert into public.user_blocks (blocker_id, blocked_id) values ($1,$1)`, [a]),
      /check constraint/i,
    );
    await db.q(`insert into public.user_blocks (blocker_id, blocked_id) values ($1,$2)`, [a, b]);
    await assert.rejects(
      () => db.q(`insert into public.user_blocks (blocker_id, blocked_id) values ($1,$2)`, [a, b]),
      /duplicate key|unique/i,
    );
    // Ters yön AYRI bir kayıttır: b de a'yı engelleyebilir.
    await db.q(`insert into public.user_blocks (blocker_id, blocked_id) values ($1,$2)`, [b, a]);
  } finally { await db.kapat(); }
});

test('yorum silinince bildirimleri de gider (yetim bildirim kalmaz)', { skip: atla }, async () => {
  const db = await baglan(await veritabaniKur());
  try {
    const [yazar, a] = await kullanicilar(db, 2);
    const [y] = await db.q(
      `insert into public.comments (match_id, user_id, text) values ('m1', $1, 'deneme') returning id`, [yazar]);
    await db.q(`insert into public.comment_reports (comment_id, reporter_id, reason) values ($1,$2,'spam')`, [y.id, a]);

    await db.q(`delete from public.comments where id = $1`, [y.id]);
    const kalan = await db.q(`select count(*)::int as n from public.comment_reports where comment_id = $1`, [y.id]);
    assert.equal(kalan[0].n, 0, 'yorumu olmayan bildirim kaldı');
  } finally { await db.kapat(); }
});

test('hesap silinince o kişinin engelleri ve bildirimleri gider', { skip: atla }, async () => {
  const db = await baglan(await veritabaniKur());
  try {
    const [a, b, yazar] = await kullanicilar(db, 3);
    const [y] = await db.q(
      `insert into public.comments (match_id, user_id, text) values ('m1', $1, 'deneme') returning id`, [yazar]);
    await db.q(`insert into public.comment_reports (comment_id, reporter_id, reason) values ($1,$2,'spam')`, [y.id, a]);
    await db.q(`insert into public.user_blocks (blocker_id, blocked_id) values ($1,$2)`, [a, b]);
    await db.q(`insert into public.user_blocks (blocker_id, blocked_id) values ($1,$2)`, [b, a]);

    await db.q(`delete from auth.users where id = $1`, [a]);

    const [r] = await db.q(`select count(*)::int as n from public.comment_reports where reporter_id = $1`, [a]);
    assert.equal(r.n, 0, 'silinen kullanıcının bildirimleri kaldı');
    const [e] = await db.q(
      `select count(*)::int as n from public.user_blocks where blocker_id = $1 or blocked_id = $1`, [a]);
    assert.equal(e.n, 0, 'silinen kullanıcıyla ilgili engeller kaldı');
  } finally { await db.kapat(); }
});

test('dört moderasyon tablosunda da RLS AÇIK (publishable anahtar okuyamaz)', { skip: atla }, async () => {
  const db = await baglan(await veritabaniKur());
  try {
    const rows = await db.q(`
      select relname, relrowsecurity from pg_class
      where relname in ('comments','comment_likes','comment_reports','user_blocks')
        and relnamespace = 'public'::regnamespace
      order by relname`);
    assert.equal(rows.length, 4, 'dört tablo da oluşmalı');
    for (const r of rows) assert.equal(r.relrowsecurity, true, `${r.relname}: RLS kapalı`);

    // Ve HİÇBİR policy yok → varsayılan ret.
    const [p] = await db.q(`
      select count(*)::int as n from pg_policies
      where schemaname = 'public'
        and tablename in ('comments','comment_likes','comment_reports','user_blocks')`);
    assert.equal(p.n, 0, 'bilerek policy tanımlanmamalı (yalnız service role erişir)');
  } finally { await db.kapat(); }
});
