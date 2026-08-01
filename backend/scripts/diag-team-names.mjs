// TEŞHİS — kapsam dışı kalan takımların KAYNAKTAKİ gerçek adlarını okur.
// ---------------------------------------------------------------------------
// NEDEN: Bülten adı ile kaynak adı tutmadığında `matcher.js` "takım bulunamadı"
// der ama HANGİ ada karşı tutmadığını söylemez. Alias eklemeden önce kaynağın
// gerçek adı BİLİNMELİDİR — `matcher.js` kuralı tahmini alias'ı yasaklar.
//
// SALT OKUR. Hiçbir şey yazmaz, hiçbir alias önermez; yalnız aday listeler.
// Çıktı: backend/cache/diagTeamNames.json (ve konsola özet).
import { fetchTeams } from '../src/sources/footystats.js';
import { normalizeName } from '../src/matcher.js';
import { load, save } from '../src/cache.js';

// Aranan bülten adları ve bakılacak sezonlar (seasonDiscovery'den).
const HEDEFLER = [
  { bulten: 'Union St.Gilloise', seasons: [17171], not: 'Belgium Pro League' },
  { bulten: 'AZ Alkmaar', seasons: [17097, 17110], not: 'Netherlands Eredivisie + Eerste Divisie' },
  { bulten: 'Uniao Torreense', seasons: [17217, 17215], not: 'Portugal Liga NOS + LigaPro' },
];

// Kaba benzerlik: ortak harf dizisi payı (yalnız ADAY SIRALAMAK için —
// eşleştirme kararı vermez, insan gözü karar verir).
function benzerlik(a, b) {
  if (!a || !b) return 0;
  const kisa = a.length <= b.length ? a : b;
  const uzun = a.length <= b.length ? b : a;
  let ortak = 0;
  for (let n = Math.min(6, kisa.length); n >= 3; n -= 1) {
    for (let i = 0; i + n <= kisa.length; i += 1) {
      if (uzun.includes(kisa.slice(i, i + n))) { ortak = Math.max(ortak, n); break; }
    }
    if (ortak) break;
  }
  return ortak / uzun.length;
}

export async function runDiag() {
  const sonuc = { calistirilma: new Date().toISOString(), hedefler: [] };

  for (const h of HEDEFLER) {
    const hn = normalizeName(h.bulten);
    const kayit = { bulten: h.bulten, normalize: hn, not: h.not, sezonlar: [], adaylar: [], hata: null };
    const havuz = [];
    for (const sid of h.seasons) {
      try {
        const takimlar = await fetchTeams(sid);
        kayit.sezonlar.push({ seasonId: sid, takimSayisi: takimlar.length });
        for (const t of takimlar) {
          havuz.push({
            seasonId: sid, id: t.id,
            name: t.name, cleanName: t.cleanName, shortHand: t.shortHand,
            nName: normalizeName(t.name), nClean: normalizeName(t.cleanName),
          });
        }
      } catch (e) {
        kayit.sezonlar.push({ seasonId: sid, hata: e.message });
      }
    }

    // TAM eşleşme var mı? (mevcut eşleştiricinin aradığı şey)
    kayit.tamEslesme = havuz.filter((t) => t.nName === hn || t.nClean === hn)
      .map((t) => ({ id: t.id, name: t.name }));

    // En yakın 6 aday — karar için insan gözüne sunulur.
    kayit.adaylar = havuz
      .map((t) => ({ ...t, skor: Math.max(benzerlik(hn, t.nName), benzerlik(hn, t.nClean)) }))
      .sort((a, b) => b.skor - a.skor).slice(0, 6)
      .map((t) => ({
        id: t.id, seasonId: t.seasonId, name: t.name, cleanName: t.cleanName,
        shortHand: t.shortHand, normalize: t.nName,
        // Mevcut kural bu adı neden ıskalıyor?
        neden: t.nName === hn ? 'eşleşiyor'
          : (t.nName.length < 3 || hn.length < 3) ? 'uzunluk<3 guard atlıyor'
            : (hn.includes(t.nName) || t.nName.includes(hn)) ? 'içerme ile eşleşmeli (başka sebep)'
              : 'ne eşitlik ne içerme',
        skor: Number(t.skor.toFixed(2)),
      }));

    sonuc.hedefler.push(kayit);
    console.log(`\n=== ${h.bulten} (${hn}) — ${h.not}`);
    console.log('   tam eşleşme:', kayit.tamEslesme.length ? JSON.stringify(kayit.tamEslesme) : 'YOK');
    for (const a of kayit.adaylar) {
      console.log(`   ${String(a.skor).padEnd(5)} ${String(a.name).padEnd(30)} clean=${String(a.cleanName).padEnd(24)} short=${String(a.shortHand).padEnd(14)} → ${a.normalize.padEnd(24)} [${a.neden}]`);
    }
  }

  save('diagTeamNames', sonuc);
  console.log('\n[diag] backend/cache/diagTeamNames.json yazıldı.');
  return sonuc;
}
