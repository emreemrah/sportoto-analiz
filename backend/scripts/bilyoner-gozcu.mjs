// BİLYONER GÖZCÜSÜ — yeşil kaynaktan veri gelip gelmediğini İZLER.
// ---------------------------------------------------------------------------
// ÖNEMLİ: bu betik Bilyoner'e HİÇ istek atmaz. Yalnız KENDİ arşivimize bakar.
// Gerekçe: kaynak IP başına hız sınırlıyor ve her ek sonda engeli uzatıyor
// (2 Ağustos 2026'da tam bu yüzden saatlerce kapalı kaldık). Denemeyi
// zamanlanmış gözlem döngüsü yapar (saatlik tempo, bkz. saglayiciTempo.js);
// bu betik sadece sonucu bildirir.
import 'dotenv/config';
import { SupabaseArchiveStore } from '../src/archive/supabaseStore.js';
import { load } from '../src/cache.js';

const ARALIK_MS = 10 * 60e3;       // 10 dk — yalnız yerel okuma, maliyetsiz
const EN_COK_TUR = 30;             // ~5 saat

const damga = () => new Date().toISOString().slice(11, 19);
const store = new SupabaseArchiveStore();

const bultenId = String(load('bulletin')?.data?.roundId ?? '');
if (!bultenId) {
  console.error('[gözcü] bülten yok — çıkılıyor.');
  process.exit(1);
}

let baslangic = null;

for (let tur = 1; tur <= EN_COK_TUR; tur++) {
  let sayi = 0;
  try {
    const obs = await store.listObservations(bultenId);
    sayi = obs.filter((o) => o.source === 'bilyoner' && o.playedPct).length;
  } catch (e) {
    console.log(`[gözcü ${damga()}] arşiv okunamadı: ${e.message.slice(0, 60)}`);
  }
  if (baslangic === null) baslangic = sayi;

  const tempo = load('saglayiciTempo')?.data?.bilyoner || null;
  const durum = tempo
    ? `hata serisi ${tempo.ardisikHata ?? 0}${tempo.sonBasari ? ` · son başarı ${new Date(tempo.sonBasari).toISOString().slice(11, 16)}` : ''}`
    : 'henüz deneme yok';

  if (sayi > baslangic) {
    console.log(`[gözcü ${damga()}] ✅ YEŞİL KAYNAK GELDİ — ${sayi - baslangic} yeni gözlem (toplam ${sayi}). ${durum}`);
    process.exit(0);
  }
  console.log(`[gözcü ${damga()}] tur ${tur}/${EN_COK_TUR} · bilyoner gözlemi ${sayi} · ${durum}`);
  await new Promise((r) => setTimeout(r, ARALIK_MS));
}

console.log(`[gözcü ${damga()}] süre doldu — yeşil kaynaktan veri gelmedi.`);
process.exit(2);
