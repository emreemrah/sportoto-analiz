// GEÇMİŞ DEPOSU SAYFALAMA TESTİ — gerçek gerilemenin kilidi.
//
// OLAY: SupabaseHistoryStore.listAllMatches() .range() kullanmıyordu.
// PostgREST 1000 satırda sessizce kesiyor, 2250 satırlık arşivin yalnız
// 1000'i geliyordu. Radar 5 ekranında "2025/2026 · 44 hafta" yazıyordu
// (1000 / 15 ≈ 66 hafta, iki sezona bölünmüş), oysa o sezonda 52 hafta
// oynanmıştı. Hata mesajı yoktu — bu yüzden bir test ŞART.
import test from 'node:test';
import assert from 'node:assert/strict';

const { SupabaseHistoryStore } = await import('../src/history/historyStore.js');

// PostgREST'i taklit eden zincirlenebilir sahte istemci: .range() istenen
// aralığı döner ama en çok SINIR satır.
function sahteIstemci(satirlar, { sinir = 1000 } = {}) {
  const istekler = [];
  const kurucu = () => {
    const b = {
      select: () => b, eq: () => b, order: () => b,
      range: (bas, son) => {
        istekler.push([bas, son]);
        const istenen = son - bas + 1;
        return Promise.resolve({ data: satirlar.slice(bas, bas + Math.min(istenen, sinir)), error: null });
      },
    };
    return b;
  };
  return { sb: { from: kurucu }, istekler };
}

// 150 hafta × 15 sıra = 2250 satır — kullanıcının gerçek arşiv boyutu.
const HAFTA = 150;
const satirlariUret = () => {
  const out = [];
  for (let h = 0; h < HAFTA; h++) {
    const sezon = h < 6 ? '2022/2023' : h < 49 ? '2023/2024' : h < 99 ? '2024/2025' : '2025/2026';
    for (let p = 1; p <= 15; p++) {
      out.push({
        round_id: String(1000 + h), position: p, result: '1', result_valid: true,
        sportoto_history_rounds: {
          round_id: String(1000 + h), season_year: sezon,
          status: 'completed', round_close_at: `2026-01-${String((h % 28) + 1).padStart(2, '0')}`,
        },
      });
    }
  }
  return out;
};

test('listAllMatches 1000 satırda KESİLMEZ — 2250 satırın tamamı gelir', async () => {
  const { sb, istekler } = sahteIstemci(satirlariUret());
  const maclar = await new SupabaseHistoryStore(sb).listAllMatches();
  assert.equal(maclar.length, 2250, 'arşiv sessizce kırpılmamalı');
  assert.ok(istekler.length >= 3, `sayfalama yapılmalı (istek sayısı: ${istekler.length})`);
});

test('kırpılma olsaydı sezon hafta sayıları YANLIŞ çıkardı', async () => {
  const { sb } = sahteIstemci(satirlariUret());
  const maclar = await new SupabaseHistoryStore(sb).listAllMatches();

  const haftalar = {};
  for (const m of maclar) {
    (haftalar[m.seasonYear] ||= new Set()).add(String(m.roundId));
  }
  const say = Object.fromEntries(Object.entries(haftalar).map(([s, v]) => [s, v.size]));

  // Dört sezon da eksiksiz — ekrandaki "44 hafta" yerine gerçek sayılar.
  assert.deepEqual(say, {
    '2022/2023': 6, '2023/2024': 43, '2024/2025': 50, '2025/2026': 51,
  });
  assert.equal(Object.keys(say).length, 4, 'kırpılmış kümede yalnız iki sezon görünüyordu');
});

test('tamamlanmamış turlar yine hariç — sayfalama süzgeci bozmaz', async () => {
  // Sahte istemci .eq() süzgecini uygulamaz; bu yüzden burada süzgecin
  // ÇAĞRILDIĞINI değil, sayfalamanın satır şeklini bozmadığını doğruluyoruz:
  // her satır roundId/seasonYear/roundCloseAt taşımalı, yoksa DNA hesabı
  // sezonu "bilinmiyor" sayar ve sezon listesi boşalır.
  const { sb } = sahteIstemci(satirlariUret());
  const maclar = await new SupabaseHistoryStore(sb).listAllMatches();
  assert.ok(maclar.every((m) => m.roundId && m.seasonYear && m.roundCloseAt),
    'sayfalar birleştirilirken alan eşlemesi kaybolmamalı');
});
