// HESAP SİLME testleri.
//
// Bu testler üç şeyi güvence altına alır:
//   1. Silme GERÇEKTİR — kullanıcıya ait her tablo, avatar dosyaları ve
//      kuponlar silinir, en son auth kullanıcısı silinir.
//   2. Kullanıcının kendi verisi DIŞINDA hiçbir şeye dokunulmaz (bülten arşivi,
//      mühürlü analizler, resmî sonuçlar, Radar, Sistem Karnesi).
//   3. Bir adım başarısız olursa "silindi" DENMEZ ve auth kullanıcısı SİLİNMEZ.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  USER_OWNED_TABLES,
  AVATAR_BUCKET,
  makeCouponPurger,
  deleteUserAccount,
  purgeReportsOnOwnComments,
} from '../src/accountDeletion.js';

const UID = 'user-1111';

// Kullanıcıya ait OLMAYAN, asla silinmemesi gereken tablolar.
const KORUNAN_TABLOLAR = [
  'bulletins',
  'bulletin_snapshots',
  'bulletin_matches',
  'match_official_results',
  'sportoto_history_rounds',
  'sportoto_history_matches',
  'snapshot_master_analysis',
  'radar_records',
  'scorecards',
];

function makeFakeSb({
  failTable = null,
  failAvatarList = false,
  failAuth = false,
  avatarFiles = [],
  // Kullanıcının yorum kimlikleri — `comment_reports` temizliği bunlara bakar.
  commentIds = ['c1', 'c2'],
  // Henüz oluşturulmamış (migration bekleyen) tablolar: 42P01 döndürürler.
  eksikTablolar = [],
  failSelectTable = null,
} = {}) {
  const deleted = [];        // { table, column, value, kind }
  const removedPaths = [];
  const authDeleted = [];
  const yokHatasi = (t) => ({ message: `relation "public.${t}" does not exist` });
  return {
    deleted,
    removedPaths,
    authDeleted,
    from(table) {
      const sonuc = (islem) => Promise.resolve(
        eksikTablolar.includes(table) ? { error: yokHatasi(table) }
          : table === failTable ? { error: { message: `veritabanı hatası (${islem})` } }
            : { error: null },
      );
      return {
        // Gerçek istemcide `select` da zincire girer; sahte istemci bunu
        // taşımazsa silme akışındaki okuma adımı sessizce TypeError'a düşer ve
        // testler gerçekte olmayan bir başarısızlığı ölçer.
        select() {
          return {
            eq(column, value) {
              if (eksikTablolar.includes(table)) return Promise.resolve({ data: null, error: yokHatasi(table) });
              if (table === failSelectTable) return Promise.resolve({ data: null, error: { message: 'okuma hatası' } });
              return Promise.resolve({ data: commentIds.map((id) => ({ id, user_id: value, column })), error: null });
            },
          };
        },
        delete() {
          return {
            eq(column, value) {
              deleted.push({ table, column, value, kind: 'eq' });
              return sonuc('eq');
            },
            in(column, values) {
              deleted.push({ table, column, value: values, kind: 'in' });
              return sonuc('in');
            },
          };
        },
      };
    },
    storage: {
      from(bucket) {
        return {
          list(prefix) {
            if (failAvatarList) return Promise.resolve({ data: null, error: { message: 'depo hatası' } });
            return Promise.resolve({
              data: avatarFiles.map((name) => ({ name, bucket, prefix })),
              error: null,
            });
          },
          remove(paths) {
            removedPaths.push(...paths);
            return Promise.resolve({ error: null });
          },
        };
      },
    },
    auth: {
      admin: {
        deleteUser(id) {
          authDeleted.push(id);
          return Promise.resolve(failAuth ? { error: { message: 'auth hatası' } } : { error: null });
        },
      },
    },
  };
}

test('silme gerçektir: tüm kullanıcı tabloları, avatarlar, kuponlar ve auth kullanıcısı silinir', async () => {
  const sb = makeFakeSb({ avatarFiles: ['avatar_1.png', 'avatar_2.jpg'] });
  let purged = null;
  const r = await deleteUserAccount({
    sbAdmin: sb,
    userId: UID,
    purgeCoupons: (id) => {
      purged = id;
      return { removed: 3 };
    },
  });

  assert.equal(r.ok, true);
  assert.deepEqual(r.failed, []);

  // Listedeki HER (tablo, sütun) ÇİFTİ silinmiş olmalı. Çift üzerinden aramak
  // şart: aynı tablo iki farklı sahiplik sütunuyla listede olabilir (user_blocks
  // → blocker_id + blocked_id). Yalnız tablo adına bakan bir arama, ikinci
  // sütunu hiç silmesek de yeşil kalırdı.
  for (const { table, column } of USER_OWNED_TABLES) {
    const hit = sb.deleted.find((d) => d.table === table && d.column === column);
    assert.ok(hit, `silinmeyen kullanıcı verisi: ${table}.${column}`);
    assert.equal(hit.value, UID);
  }

  // Avatar dosyaları kullanıcının klasöründen silinmiş olmalı.
  assert.deepEqual(sb.removedPaths, [`${UID}/avatar_1.png`, `${UID}/avatar_2.jpg`]);
  assert.equal(AVATAR_BUCKET, 'avatars');

  // Kuponlar temizlenmiş, auth kullanıcısı silinmiş olmalı.
  assert.equal(purged, UID);
  assert.deepEqual(sb.authDeleted, [UID]);
});

test('kullanıcının kendi verisi dışında hiçbir tabloya dokunulmaz', async () => {
  const sb = makeFakeSb();
  await deleteUserAccount({ sbAdmin: sb, userId: UID, purgeCoupons: () => ({ removed: 0 }) });

  const izinli = new Set(USER_OWNED_TABLES.map((t) => t.table));
  for (const d of sb.deleted) {
    assert.ok(izinli.has(d.table), `izinsiz tabloya dokunuldu: ${d.table}`);
  }
  for (const korunan of KORUNAN_TABLOLAR) {
    assert.ok(
      !sb.deleted.some((d) => d.table === korunan),
      `korunan veri silinmiş: ${korunan}`,
    );
  }
});

test('profiles EN SON silinir (diğer tablolar ona bağlı olabilir)', () => {
  const son = USER_OWNED_TABLES[USER_OWNED_TABLES.length - 1];
  assert.equal(son.table, 'profiles');
  assert.equal(son.column, 'id');
});

test('bir tablo silinemezse auth kullanıcısı SİLİNMEZ ve "silindi" denmez', async () => {
  const sb = makeFakeSb({ failTable: 'comments' });
  const r = await deleteUserAccount({ sbAdmin: sb, userId: UID, purgeCoupons: () => ({ removed: 0 }) });

  assert.equal(r.ok, false);
  assert.ok(r.failed.includes('comments'));
  assert.deepEqual(sb.authDeleted, [], 'kısmi başarısızlıkta auth kullanıcısı silinmemeli');
});

test('avatar deposu okunamazsa auth kullanıcısı SİLİNMEZ', async () => {
  const sb = makeFakeSb({ failAvatarList: true });
  const r = await deleteUserAccount({ sbAdmin: sb, userId: UID, purgeCoupons: () => ({ removed: 0 }) });

  assert.equal(r.ok, false);
  assert.ok(r.failed.includes('avatar-dosyalari'));
  assert.deepEqual(sb.authDeleted, []);
});

test('kupon deposu temizlenemezse auth kullanıcısı SİLİNMEZ', async () => {
  const sb = makeFakeSb();
  const r = await deleteUserAccount({
    sbAdmin: sb,
    userId: UID,
    purgeCoupons: () => {
      throw new Error('dosya yazılamadı');
    },
  });

  assert.equal(r.ok, false);
  assert.ok(r.failed.includes('kuponlar'));
  assert.deepEqual(sb.authDeleted, []);
});

test('auth silme başarısız olursa dürüstçe ok:false döner', async () => {
  const sb = makeFakeSb({ failAuth: true });
  const r = await deleteUserAccount({ sbAdmin: sb, userId: UID, purgeCoupons: () => ({ removed: 0 }) });

  assert.equal(r.ok, false);
  assert.ok(r.failed.includes('auth-kullanicisi'));
});

test('kimlik yoksa hiçbir şey silinmez', async () => {
  const sb = makeFakeSb();
  const r = await deleteUserAccount({ sbAdmin: sb, userId: '', purgeCoupons: () => ({ removed: 0 }) });

  assert.equal(r.ok, false);
  assert.deepEqual(sb.deleted, []);
  assert.deepEqual(sb.authDeleted, []);
});

test('rapora e-posta, token veya şifre yazılmaz', async () => {
  const sb = makeFakeSb({ failTable: 'comments' });
  const r = await deleteUserAccount({ sbAdmin: sb, userId: UID, purgeCoupons: () => ({ removed: 0 }) });
  const metin = JSON.stringify(r);

  assert.ok(!metin.includes('@'), 'raporda e-posta izi var');
  assert.ok(!/token|şifre|password|Bearer/i.test(metin), 'raporda hassas alan adı var');
});

// ---------------------------------------------------------------------------
// YORUMA GELEN BİLDİRİMLER (migration 007) — sahibi başkası olan satırlar
// ---------------------------------------------------------------------------
// Bu satırların `reporter_id`'si BAŞKA biridir, o yüzden USER_OWNED_TABLES
// döngüsü onları yakalayamaz. Normalde yorum silinince yabancı anahtar temizler
// ama 007'de o kısıt KORUMALI ekleniyor; kurulamadığı bir veritabanında bu adım
// olmasa geride hiçbir yoruma bağlı olmayan bildirimler kalırdı.

test('kullanıcının yorumlarına gelen bildirimler de silinir', async () => {
  const sb = makeFakeSb({ commentIds: ['c1', 'c2', 'c3'] });
  const r = await deleteUserAccount({ sbAdmin: sb, userId: UID, purgeCoupons: () => ({ removed: 0 }) });

  assert.equal(r.ok, true);
  const temizlik = sb.deleted.find((d) => d.table === 'comment_reports' && d.kind === 'in');
  assert.ok(temizlik, 'yoruma gelen bildirimler silinmemiş');
  assert.equal(temizlik.column, 'comment_id');
  assert.deepEqual(temizlik.value, ['c1', 'c2', 'c3']);

  // Ve bu, yorumlar silinmeden ÖNCE olmalı: yorum gidince hangi bildirimin ona
  // ait olduğunu bulmanın yolu kalmaz.
  const iBildirim = sb.deleted.findIndex((d) => d.table === 'comment_reports' && d.kind === 'in');
  const iYorum = sb.deleted.findIndex((d) => d.table === 'comments');
  assert.ok(iBildirim < iYorum, 'bildirimler yorumlardan sonra silinmiş');
});

test('hiç yorumu yoksa bildirim temizliği boşuna sorgu yapmaz', async () => {
  const sb = makeFakeSb({ commentIds: [] });
  const r = await purgeReportsOnOwnComments(sb, UID);

  assert.deepEqual(r, { ok: true, removed: 0 });
  assert.equal(sb.deleted.length, 0, 'boş listeyle silme sorgusu gönderilmiş');
});

test('bildirim tablosu henüz yoksa silme akışı DURMAZ', async () => {
  const sb = makeFakeSb({ eksikTablolar: ['comment_reports', 'user_blocks'] });
  const r = await deleteUserAccount({ sbAdmin: sb, userId: UID, purgeCoupons: () => ({ removed: 0 }) });

  assert.equal(r.ok, true, 'migration bekleyen tablo silmeyi engellememeli');
  assert.deepEqual(sb.authDeleted, [UID]);
});

test('bildirimler silinemezse auth kullanıcısı SİLİNMEZ', async () => {
  const sb = makeFakeSb({ failTable: 'comment_reports' });
  const r = await deleteUserAccount({ sbAdmin: sb, userId: UID, purgeCoupons: () => ({ removed: 0 }) });

  assert.equal(r.ok, false);
  assert.ok(r.failed.includes('yoruma-gelen-bildirimler'));
  assert.deepEqual(sb.authDeleted, [], 'yetim bildirim kalabilecekken hesap silinmiş');
});

test('yorum listesi okunamazsa "silindi" DENMEZ', async () => {
  const sb = makeFakeSb({ failSelectTable: 'comments' });
  const r = await deleteUserAccount({ sbAdmin: sb, userId: UID, purgeCoupons: () => ({ removed: 0 }) });

  assert.equal(r.ok, false);
  assert.ok(r.failed.includes('yoruma-gelen-bildirimler'));
  assert.deepEqual(sb.authDeleted, []);
});

test('engeller İKİ YÖNDEN de silinir (kalan yetim engel olmaz)', () => {
  const engeller = USER_OWNED_TABLES.filter((t) => t.table === 'user_blocks').map((t) => t.column);
  assert.deepEqual(engeller.sort(), ['blocked_id', 'blocker_id']);
});

test('kupon temizleyici yalnız o kullanıcının kaydını siler', () => {
  let store = { 'user-1111': [{ id: 'a' }, { id: 'b' }], 'user-2222': [{ id: 'c' }] };
  const purge = makeCouponPurger(
    () => store,
    (m) => {
      store = m;
    },
  );

  const r = purge('user-1111');
  assert.equal(r.removed, 2);
  assert.equal(store['user-1111'], undefined);
  assert.deepEqual(store['user-2222'], [{ id: 'c' }], 'başka kullanıcının kuponu silinmiş');

  // Hiç kuponu olmayan kullanıcı hata vermez.
  assert.deepEqual(purge('user-9999'), { removed: 0 });
});
