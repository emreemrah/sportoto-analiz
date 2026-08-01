// CLI YENİLEME — geliştirici teşhis aracı (normal akış için GEREKMEZ; üretimde
// otomatik scheduler çalışır). Tek doğruluk kaynağı refreshCurrentBulletin'i
// kullanır: single-flight kilidi ve durum kaydı CLI'da da geçerlidir.
import { refreshCurrentBulletin } from '../src/autoRefresh.js';

const r = await refreshCurrentBulletin({ trigger: 'cli' });
if (!r.ok) {
  console.error('[refresh] HATA:', r.error);
  process.exit(1);
}
console.log(`[refresh] tamam — round ${r.data?.roundId ?? '?'} · eşleşen ${r.data?.matchedCount ?? '?'}/${r.data?.matchCount ?? r.data?.matches?.length ?? '?'}`);
