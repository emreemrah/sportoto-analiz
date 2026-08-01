// TEŞHİS — kupa yarışmaları kaynakta VAR MI?
// ---------------------------------------------------------------------------
// SORU: 52. haftanın 3 kupa maçı (Belçika Süper Kupası, Johan Cruijff Schaal,
// Porto–Torreense) için veri yok. Kaynak bu yarışmaları hiç tutmuyor mu, yoksa
// tutuyor da bizim hesapta SEÇİLİ olmadığı için mi gelmiyor?
//
// Mevcut kod kataloğu `chosen_leagues_only: true` ile ister — yani yalnız
// FootyStats panelinde seçili ligler. Bu betik TAM katalogu (seçilmemişler
// dahil) alır ve ilgili ülkelerin lig-dışı yarışmalarını listeler.
//
// SALT OKUR. Hiçbir ayar değiştirmez, hiçbir sezon eklemez.
// Çıktı: backend/cache/diagCupCoverage.json + konsol özeti.
import { fetchLeagueCatalog } from '../src/sources/footystats.js';
import { save } from '../src/cache.js';

// Bu haftanın kapsam dışı maçlarının ülkeleri.
const ULKELER = ['Belgium', 'Netherlands', 'Portugal'];

// Lig olmayan yarışmaya işaret eden kelimeler (ad üzerinden kaba ayıklama).
const KUPA_IZI = /cup|super|supercup|schaal|taca|taça|beker|copa|coupe|trophy|shield|kupa|playoff/i;

const yilOf = (lg) => {
  let best = null;
  for (const s of lg.season || []) {
    if (s?.id == null) continue;
    if (!best || Number(s.year || 0) > Number(best.year || 0)) best = s;
  }
  return best;
};

export async function runCupDiag() {
  const tumu = await fetchLeagueCatalog(false);   // SEÇİLMEMİŞLER DAHİL
  const secili = await fetchLeagueCatalog(true);
  const seciliAdlar = new Set((secili || []).map((l) => l.name));

  const sonuc = {
    calistirilma: new Date().toISOString(),
    katalogToplam: (tumu || []).length,
    seciliToplam: (secili || []).length,
    ornekAdlar: (tumu || []).slice(0, 15).map((l) => l.name),
    ornekKayit: (tumu || [])[0] ?? null,
    anahtarArama: {},
    ulkeler: {},
  };

  // DOĞRUDAN ANAHTAR ARAMASI — ülke/ad öneki tutmazsa bile yakalasın.
  for (const kelime of ['belgium', 'super cup', 'supercup', 'schaal', 'netherlands',
    'portugal', 'taca', 'taça', 'jupiler', 'eredivisie', 'beker', 'cup']) {
    const bulunan = (tumu || [])
      .filter((l) => String(l.name || '').toLowerCase().includes(kelime))
      .map((l) => ({ ad: l.name, secili: seciliAdlar.has(l.name), sezon: yilOf(l) }));
    sonuc.anahtarArama[kelime] = bulunan.slice(0, 12);
    if (bulunan.length) {
      console.log(`\n[ara] "${kelime}" → ${bulunan.length} sonuç`);
      for (const b of bulunan.slice(0, 12)) {
        console.log(`      ${b.secili ? '[SEÇİLİ]' : '[  -   ]'} ${b.ad} (sezonId=${b.sezon?.id} yıl=${b.sezon?.year})`);
      }
    }
  }

  console.log(`\nTAM katalog: ${sonuc.katalogToplam} yarışma · hesapta SEÇİLİ: ${sonuc.seciliToplam}`);

  for (const ulke of ULKELER) {
    // Ülke alanı seçilmemiş kayıtlarda boş gelebiliyor → ADA göre de bak.
    // FootyStats yarışmaları "Belgium Pro League" gibi ülke önekiyle adlandırır.
    const ulkeninkiler = (tumu || []).filter((lg) =>
      (lg.season || []).some((s) => s?.country === ulke)
      || String(lg.name || '').toLowerCase().startsWith(ulke.toLowerCase()));
    const satirlar = ulkeninkiler.map((lg) => {
      const b = yilOf(lg);
      return {
        ad: lg.name,
        secili: seciliAdlar.has(lg.name),
        kupaMi: KUPA_IZI.test(lg.name),
        guncelSezonId: b?.id ?? null,
        guncelYil: b?.year ?? null,
        sezonSayisi: (lg.season || []).length,
      };
    }).sort((a, b) => Number(b.kupaMi) - Number(a.kupaMi) || a.ad.localeCompare(b.ad));

    sonuc.ulkeler[ulke] = satirlar;
    console.log(`\n=== ${ulke} — ${satirlar.length} yarışma`);
    for (const r of satirlar) {
      console.log(`   ${r.kupaMi ? 'KUPA' : 'lig '} ${r.secili ? '[SEÇİLİ]  ' : '[seçili değil]'} ${String(r.ad).padEnd(38)} sezonId=${r.guncelSezonId} yıl=${r.guncelYil}`);
    }
  }

  save('diagCupCoverage', sonuc);
  console.log('\n[diag] backend/cache/diagCupCoverage.json yazıldı.');
  return sonuc;
}
