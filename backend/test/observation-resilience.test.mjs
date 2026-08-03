// GÖZLEM YAZMA DAYANIKLILIĞI (005 kolonları yoksa güvenli düşüş)
import test from 'node:test';
import assert from 'node:assert/strict';

// SupabaseStore'u sahte bir sb client ile test et (ağ yok).
const mod = await import('../src/archive/supabaseStore.js');
const SupabaseStore = mod.SupabaseArchiveStore;

function fakeSb({ failSemantics = false } = {}) {
  const inserted = [];
  return {
    inserted,
    from() {
      return {
        insert(payload) {
          const hasSemantics = Array.isArray(payload) && payload.some((p) => 'kind' in p);
          if (failSemantics && hasSemantics) {
            return Promise.resolve({ error: { message: "Could not find the 'kind' column of 'bulletin_data_observations' in the schema cache" } });
          }
          inserted.push(...payload);
          return Promise.resolve({ error: null });
        },
      };
    },
  };
}

test('1. 005 UYGULANMIŞ: semantik kolonlar (kind/usable/first_late) yazılır', async () => {
  const sb = fakeSb({ failSemantics: false });
  const store = new SupabaseStore(sb);
  await store.addObservations('1525', [{ matchId: 'm1', source: 'k3', playedPct: { '1': 50, X: 30, '2': 20 }, kind: 'opening', usableForPrediction: true, firstObservedLate: false, raw: { kind: 'opening' } }]);
  assert.equal(sb.inserted.length, 1);
  assert.equal(sb.inserted[0].kind, 'opening');
  assert.equal(sb.inserted[0].usable_for_prediction, true);
});

test('2. 005 ÖNCESİ: kolon yok hatası → semantiksiz tekrar yazılır (migration beklenmez)', async () => {
  const sb = fakeSb({ failSemantics: true });
  const store = new SupabaseStore(sb);
  const n = await store.addObservations('1525', [{ matchId: 'm1', source: 'k3', playedPct: { '1': 50, X: 30, '2': 20 }, kind: 'opening', usableForPrediction: true, firstObservedLate: false, raw: { kind: 'opening', usableForPrediction: true } }]);
  assert.equal(n, 1);
  assert.equal(sb.inserted.length, 1, 'ikinci (semantiksiz) yazma başarılı');
  assert.ok(!('kind' in sb.inserted[0]), 'semantik kolon düşürüldü');
  assert.ok(sb.inserted[0].raw?.kind === 'opening', 'semantik bilgi raw içinde korunur');
});

test('3. Gerçek DB hatası (kolon-yok değil) YUTULMAZ', async () => {
  const sb = {
    from() { return { insert() { return Promise.resolve({ error: { message: 'permission denied for table' } }); } }; },
  };
  const store = new SupabaseStore(sb);
  await assert.rejects(() => store.addObservations('1525', [{ matchId: 'm1', source: 'x', playedPct: { '1': 50, X: 30, '2': 20 }, kind: 'opening' }]));
});
