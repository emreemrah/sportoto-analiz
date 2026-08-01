// TEŞHİS — belirli bir maç HANGİ yarışmanın fikstüründe?
// ---------------------------------------------------------------------------
// Kapsam dışı kalan bir maç için "hangi sezon id'sini eklemeliyiz?" sorusunu
// tahmine değil VERİYE dayandırır: verilen sezonların fikstürlerini tarar ve
// iki takımın birlikte geçtiği maçı arar.
//
// SALT OKUR. Sezon eklemez, ayar değiştirmez.
// Çıktı: backend/cache/diagFindFixture.json + konsol.
import { fetchMatches } from '../src/sources/footystats.js';
import { sideMatches } from '../src/matcher.js';
import { save } from '../src/cache.js';

// Aranan maç + bakılacak sezonlar (diag-cup-coverage çıktısından seçildi).
const ARANAN = { ev: 'Porto', dep: 'Uniao Torreense' };
const SEZONLAR = [
  { id: 17257, ad: 'Portugal Portuguese League Cup 26/27' },
  { id: 17220, ad: 'Portugal Portuguese Super Cup 26/27' },
  { id: 16147, ad: 'Portugal Taça de Portugal 25/26' },
  { id: 17366, ad: 'Portugal Liga 3 26/27' },
];

export async function runFindFixture() {
  const sonuc = { calistirilma: new Date().toISOString(), aranan: ARANAN, sezonlar: [] };

  for (const s of SEZONLAR) {
    const kayit = { ...s, macSayisi: 0, bulunan: [], hata: null };
    try {
      const maclar = await fetchMatches(s.id);
      kayit.macSayisi = (maclar || []).length;
      for (const m of maclar || []) {
        const evOk = sideMatches({ name: ARANAN.ev }, m.homeName, m.homeImage);
        const depOk = sideMatches({ name: ARANAN.dep }, m.awayName, m.awayImage);
        if (evOk && depOk) {
          kayit.bulunan.push({
            id: m.id, tarih: m.date ?? m.dateUnix ?? null,
            ev: m.homeName, dep: m.awayName, evKatman: evOk, depKatman: depOk,
          });
        }
      }
    } catch (e) { kayit.hata = e.message; }
    sonuc.sezonlar.push(kayit);
    const durum = kayit.hata ? `HATA: ${kayit.hata}`
      : kayit.bulunan.length ? `BULUNDU (${kayit.bulunan.length})` : 'yok';
    console.log(`   [${s.id}] ${s.ad.padEnd(40)} maç=${String(kayit.macSayisi).padEnd(5)} → ${durum}`);
    for (const b of kayit.bulunan) console.log(`         ${b.ev} - ${b.dep}  (id=${b.id}, tarih=${b.tarih})`);
  }

  save('diagFindFixture', sonuc);
  console.log('[diag] backend/cache/diagFindFixture.json yazıldı.');
  return sonuc;
}
