// TEK SEFERLİK KURTARMA — hız sınırı (HTTP 429) açılınca bülteni geri getirir.
// ---------------------------------------------------------------------------
// 2 Ağustos 2026: arka arkaya çalıştırılan yenilemeler FootyStats kotasını
// tüketti, tüm sezonlar 429 aldı ve bülten 14/15 → 0/15'e düştü.
// Bu betik kaynağı SEYREK yoklar (kotayı daha da yakmamak için), açıldığında
// bir kez tam yenileme çalıştırır ve çıkar.
//
// Elle çalıştırma: node scripts/kurtarma-yenileme.mjs
import 'dotenv/config';
import { fetchSeason } from '../src/sources/footystats.js';
// Tek doğruluk kaynağı: single-flight kilidi ve durum kaydı burada.
import { refreshCurrentBulletin } from '../src/autoRefresh.js';

const YOKLAMA_MS = 5 * 60e3;      // 5 dakika — sınır açılmadan istek yığmamak için
const EN_COK_DENEME = 36;         // ~3 saat
const SONDA_SEZON = 17091;        // ucuz tek sezon sondası

const damga = () => new Date().toISOString().slice(11, 19);

for (let deneme = 1; deneme <= EN_COK_DENEME; deneme++) {
  try {
    const s = await fetchSeason(SONDA_SEZON);
    console.log(`[kurtarma ${damga()}] kaynak açıldı (${s.matches.length} maç) — tam yenileme başlıyor.`);
    const r = await refreshCurrentBulletin({ trigger: 'kurtarma' });
    if (!r.ok) throw new Error(r.error || 'yenileme başarısız');
    console.log(`[kurtarma ${damga()}] TAMAM — eşleşen ${r.data?.matchedCount ?? '?'}/${r.data?.matchCount ?? '?'}`);
    process.exit(0);
  } catch (e) {
    console.log(`[kurtarma ${damga()}] deneme ${deneme}/${EN_COK_DENEME}: ${e.message.slice(0, 70)}`);
    await new Promise((r) => setTimeout(r, YOKLAMA_MS));
  }
}

console.error(`[kurtarma ${damga()}] süre doldu — kaynak hâlâ erişilemiyor.`);
process.exit(1);
