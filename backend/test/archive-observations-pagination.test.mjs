// ARŞİV OKUMA SAYFALAMASI — "sessiz 1000 satır kesintisi" regresyon testi.
// ---------------------------------------------------------------------------
// GERÇEK ARIZA (29 Temmuz 2026): PostgREST tek istekte en çok 1000 satır
// döndürür ve bunu HATA olarak bildirmez. Bir haftalık gözlem serisi bu sınırı
// aştığında listObservations yalnız EN ESKİ 1000 satırı okuyordu:
//   * Radar 3 (oynanma) ekranda pazartesi akşamından beri "hiç değişmemiş"
//     görünüyordu — oysa veritabanında yeni gözlemler vardı,
//   * gözlem döngüsündeki "değişti mi?" kontrolü de aynı kesik listeyi okuduğu
//     için hiç 'duplicate' bulamıyor, her turda yeni satır yazıyordu.
// Bu test, okumanın TÜM SAYFALARI çektiğini ve satır atlamadığını doğrular.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseArchiveStore } from '../src/archive/supabaseStore.js';

const PAGE_SIZE = 1000;

// PostgREST davranışını taklit eden sahte istemci: range verilmezse (veya
// 1000'den genişse) yine EN ÇOK 1000 satır döner — gerçek arızanın kaynağı.
function fakeClient(tables, { onQuery = () => {} } = {}) {
  return {
    from(table) {
      const q = {
        _table: table, _filters: [], _orders: [], _range: null,
        select() { return q; },
        eq(col, val) { q._filters.push([col, String(val)]); return q; },
        order(col, opts) { q._orders.push([col, opts?.ascending === false ? -1 : 1]); return q; },
        range(from, to) { q._range = [from, to]; return q; },
        then(resolve, reject) { return q._run().then(resolve, reject); },
        async _run() {
          onQuery({ table, filters: [...q._filters], orders: [...q._orders], range: q._range });
          const src = tables[table];
          if (src?.error) return { data: null, error: src.error };
          let rows = [...(src?.rows || [])];
          for (const [col, val] of q._filters) rows = rows.filter((r) => String(r[col]) === val);
          for (const [col, dir] of [...q._orders].reverse()) {
            rows.sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * dir);
          }
          const from = q._range ? q._range[0] : 0;
          const askedTo = q._range ? q._range[1] : Infinity;
          const to = Math.min(askedTo, from + PAGE_SIZE - 1);   // SUNUCU TAVANI
          return { data: rows.slice(from, to + 1), error: null };
        },
      };
      return q;
    },
  };
}

function makeObservations(count, { bulletinId = '1526', matchId = 'm1' } = {}) {
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    rows.push({
      id: i + 1,
      bulletin_id: bulletinId,
      match_id: matchId,
      source: i % 2 === 0 ? 'nesine' : 'misli',
      // Aynı saniyede çok satır: 30 satırda bir zaman ilerler (gerçek turlar gibi).
      observed_at: new Date(Date.UTC(2026, 6, 20) + Math.floor(i / 30) * 1800e3).toISOString(),
      played_pct: { 1: 50, X: 30, 2: 20 },
      odds: null, stats_summary: null, data_quality: null, raw: null,
      kind: 'regular', usable_for_prediction: true, first_observed_late: false,
    });
  }
  return rows;
}

test('1000 satırdan fazla gözlem TAMAMEN okunur (sessiz kesinti yok)', async () => {
  const rows = makeObservations(2350);
  const store = new SupabaseArchiveStore(fakeClient({ bulletin_data_observations: { rows } }));
  const out = await store.listObservations('1526');
  assert.equal(out.length, 2350, 'tüm satırlar dönmeli');
  assert.equal(out[0].observedAt, rows[0].observed_at);
  assert.equal(out[out.length - 1].observedAt, rows[rows.length - 1].observed_at, 'EN YENİ gözlem okunmalı');
});

test('sayfalama sunucu tavanına uyar: birden çok istek, her biri en çok 1000 satır', async () => {
  const calls = [];
  const store = new SupabaseArchiveStore(
    fakeClient({ bulletin_data_observations: { rows: makeObservations(2350) } },
      { onQuery: (c) => calls.push(c) }),
  );
  await store.listObservations('1526');
  assert.equal(calls.length, 3, '2350 satır → 3 sayfa (1000+1000+350)');
  for (const c of calls) {
    assert.ok(c.range, 'her istek range ile gönderilmeli');
    assert.ok(c.range[1] - c.range[0] + 1 <= PAGE_SIZE, 'sayfa 1000 satırı aşmamalı');
  }
  assert.deepEqual(calls.map((c) => c.range[0]), [0, 1000, 2000], 'sayfalar sırayla ilerlemeli');
});

test('tam 1000 satırda da kayıp/tekrar olmaz', async () => {
  const store = new SupabaseArchiveStore(
    fakeClient({ bulletin_data_observations: { rows: makeObservations(1000) } }),
  );
  const out = await store.listObservations('1526');
  assert.equal(out.length, 1000);
});

test('aynı zaman damgalı satırlar sayfa sınırında ne kaybolur ne tekrarlanır', async () => {
  // Tüm satırlar AYNI observed_at → sıra yalnız ikincil anahtarla (id) kesindir.
  const rows = makeObservations(2005).map((r) => ({ ...r, observed_at: '2026-07-27T20:52:13.622Z' }));
  const store = new SupabaseArchiveStore(fakeClient({ bulletin_data_observations: { rows } }));
  const out = await store.listObservations('1526');
  assert.equal(out.length, 2005);
  const seen = new Set(out.map((o) => `${o.source}|${o.observedAt}|${JSON.stringify(o.playedPct)}`));
  assert.ok(seen.size > 0);
  assert.equal(out.filter((o) => o.matchId === 'm1').length, 2005, 'hepsi aynı maça ait olmalı');
});

test('okuma sırasında sıralama ikincil anahtar (id) ile kesinleşir', async () => {
  const calls = [];
  const store = new SupabaseArchiveStore(
    fakeClient({ bulletin_data_observations: { rows: makeObservations(5) } },
      { onQuery: (c) => calls.push(c) }),
  );
  await store.listObservations('1526');
  assert.deepEqual(calls[0].orders.map((o) => o[0]), ['observed_at', 'id']);
});

test('maç filtresi sayfalamada korunur', async () => {
  const rows = [
    ...makeObservations(1200, { matchId: 'm1' }),
    ...makeObservations(1200, { matchId: 'm2' }).map((r) => ({ ...r, id: r.id + 10000 })),
  ];
  const store = new SupabaseArchiveStore(fakeClient({ bulletin_data_observations: { rows } }));
  const out = await store.listObservations('1526', 'm2');
  assert.equal(out.length, 1200);
  assert.ok(out.every((o) => o.matchId === 'm2'), 'yalnız istenen maçın gözlemleri');
});

test('bülten filtresi sayfalamada korunur', async () => {
  const rows = [
    ...makeObservations(1100, { bulletinId: '1526' }),
    ...makeObservations(1100, { bulletinId: '1525' }).map((r) => ({ ...r, id: r.id + 10000 })),
  ];
  const store = new SupabaseArchiveStore(fakeClient({ bulletin_data_observations: { rows } }));
  const out = await store.listObservations('1526');
  assert.equal(out.length, 1100);
  assert.ok(out.every((o) => o.bulletinId === '1526'));
});

test('sayfa hatası yutulmaz — sessizce eksik liste dönmez', async () => {
  const store = new SupabaseArchiveStore(
    fakeClient({ bulletin_data_observations: { error: { message: 'bağlantı koptu' } } }),
  );
  await assert.rejects(() => store.listObservations('1526'), /gözlemler okunamadı/);
});

test('audit listesi de sayfalanır', async () => {
  const rows = Array.from({ length: 1500 }, (_, i) => ({
    id: i + 1, bulletin_id: '1526', action: 'observe', actor: 'system',
    at: new Date(Date.UTC(2026, 6, 20) + i * 1000).toISOString(),
    old_value: null, new_value: null, rejected: false, reason: null,
  }));
  const store = new SupabaseArchiveStore(fakeClient({ snapshot_audit_log: { rows } }));
  const out = await store.listAudit('1526');
  assert.equal(out.length, 1500);
});
