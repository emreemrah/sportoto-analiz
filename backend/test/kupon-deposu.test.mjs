// KUPON DEPOSU TESTLERİ (T12) — sürücülü depo + tek seferlik dosya→DB göçü.
//
// ÖNEMLİ: COUPONS_FILE env'i import'tan ÖNCE geçici dizine çekilir — testler
// gerçek backend/data/coupons.json dosyasına ASLA dokunmaz.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'sportoto-kupon-'));
process.env.COUPONS_FILE = join(tmp, 'coupons.json');
process.env.COUPON_DRIVER = 'file';

const {
  getCoupons, setCoupons, deleteCoupons, countCoupons,
  couponDriverName, COUPONS_FILE,
  _setSupabaseClientForTests, _resetCouponMigrationForTests,
} = await import('../src/couponStore.js');

// ——— Sahte Supabase istemcisi (zincir: from().select().eq().maybeSingle() vb.) ———
function sahteSupabase(baslangic = {}) {
  const tablo = new Map(Object.entries(baslangic)); // userId -> coupons[]
  const istekler = [];
  const api = {
    tablo,
    istekler,
    from(ad) {
      assert.equal(ad, 'user_coupons');
      return {
        select() {
          return { eq: (k, v) => ({ maybeSingle: async () => ({ data: tablo.has(v) ? { user_id: v, coupons: tablo.get(v) } : null, error: null }) }) };
        },
        insert: async (row) => { istekler.push(['insert', row.user_id]); tablo.set(row.user_id, row.coupons); return { error: null }; },
        upsert: async (row) => { istekler.push(['upsert', row.user_id]); tablo.set(row.user_id, row.coupons); return { error: null }; },
        delete() {
          return { eq: async (k, v) => { istekler.push(['delete', v]); tablo.delete(v); return { error: null }; } };
        },
      };
    },
  };
  return api;
}

// ——— DOSYA MODU (API sözleşmesi eski davranışla birebir) ———
test('dosya modu: yaz/oku/say/sil döngüsü ve kullanıcı izolasyonu', async () => {
  assert.equal(couponDriverName(), 'file');
  await setCoupons('u1', [{ id: 'a' }, { id: 'b' }]);
  await setCoupons('u2', [{ id: 'c' }]);
  assert.deepEqual(await getCoupons('u1'), [{ id: 'a' }, { id: 'b' }]);
  assert.equal(await countCoupons('u1'), 2);
  assert.deepEqual(await getCoupons('yok'), [], 'kaydı olmayan kullanıcı boş liste alır');
  assert.deepEqual(await deleteCoupons('u1'), { removed: 2 });
  assert.deepEqual(await getCoupons('u1'), []);
  assert.deepEqual(await getCoupons('u2'), [{ id: 'c' }], 'başka kullanıcı etkilenmez');
});

// ——— SUPABASE MODU ———
test('supabase modu: upsert/select/delete doğru tabloya, kullanıcı bazlı gider', async () => {
  process.env.COUPON_DRIVER = 'supabase';
  const sahte = sahteSupabase();
  _setSupabaseClientForTests(sahte);
  _resetCouponMigrationForTests();
  try {
    await setCoupons('u9', [{ id: 'x' }]);
    assert.deepEqual(await getCoupons('u9'), [{ id: 'x' }]);
    assert.deepEqual(await deleteCoupons('u9'), { removed: 1 });
    assert.deepEqual(await getCoupons('u9'), []);
    assert.ok(sahte.istekler.some(([op, id]) => op === 'upsert' && id === 'u9'));
    assert.ok(sahte.istekler.some(([op, id]) => op === 'delete' && id === 'u9'));
  } finally {
    process.env.COUPON_DRIVER = 'file';
    _setSupabaseClientForTests(null);
  }
});

test('tek seferlik göç: dosyadaki kullanıcılar içe aktarılır, DB satırı olan EZİLMEZ, dosya .migrated olur', async () => {
  // Dosyada iki kullanıcı; DB'de u-eski zaten var (daha yeni sayılır — ezilmez).
  writeFileSync(COUPONS_FILE, JSON.stringify({
    'u-eski': [{ id: 'dosyadaki-bayat' }],
    'u-yeni': [{ id: 'tasinacak' }],
    'u-bos': [],
  }));
  process.env.COUPON_DRIVER = 'supabase';
  const sahte = sahteSupabase({ 'u-eski': [{ id: 'dbdeki-guncel' }] });
  _setSupabaseClientForTests(sahte);
  _resetCouponMigrationForTests();
  try {
    // Herhangi bir okuma göçü tetikler.
    const yeni = await getCoupons('u-yeni');
    assert.deepEqual(yeni, [{ id: 'tasinacak' }], 'dosyadaki kupon DB üzerinden okunur');
    assert.deepEqual(sahte.tablo.get('u-eski'), [{ id: 'dbdeki-guncel' }], 'DB satırı dosyayla EZİLMEZ');
    assert.equal(sahte.tablo.has('u-bos'), false, 'boş liste taşınmaz (gürültü yok)');
    assert.equal(existsSync(COUPONS_FILE), false, 'kaynak dosya kalmaz');
    assert.ok(existsSync(`${COUPONS_FILE}.migrated`), 'dosya .migrated olarak saklanır (veri kaybı yok)');
    const yedek = JSON.parse(readFileSync(`${COUPONS_FILE}.migrated`, 'utf8'));
    assert.ok(yedek['u-eski'], 'içe aktarılmayan veri .migrated içinde incelenebilir kalır');
  } finally {
    process.env.COUPON_DRIVER = 'file';
    _setSupabaseClientForTests(null);
    _resetCouponMigrationForTests();
  }
});

test('rota sözleşmesi değişmedi: GET {coupons}, PUT {ok,count} — kaynak dosya denetimi', () => {
  const kaynak = readFileSync(new URL('../src/routes/coupons.js', import.meta.url), 'utf8');
  assert.match(kaynak, /getCoupons\(req\.user\.id\)/, 'GET depodan kullanıcı bazlı okumalı');
  assert.match(kaynak, /setCoupons\(req\.user\.id, list\)/, 'PUT depoya kullanıcı bazlı yazmalı');
  assert.match(kaynak, /res\.json\(\{ coupons \}\)/, 'GET cevabı {coupons} kalmalı');
  assert.match(kaynak, /res\.json\(\{ ok: true, count: list\.length \}\)/, 'PUT cevabı {ok,count} kalmalı');
  assert.ok(!/readMap|writeMap/.test(kaynak), 'rota artık dosya katmanına doğrudan dokunmaz');
});
