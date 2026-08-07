// ---------------------------------------------------------------------------
// BEKÇİ: radarDailyPlayed/radarDailyOdds'a matchId olarak SIRA geçilmesin
// ---------------------------------------------------------------------------
// GERÇEK HATA (2026-08-07): maç detayındaki Radar panelinde bu iki uç
// `(roundId, no)` ile çağrılmıştı. İkinci parametre `matchId` ve backend
// onunla gözlemleri süzüyor:
//     store.listObservations(rid, req.query.matchId ?? null)
// `matchId` bülten sırası DEĞİL, Spor Toto maç kimliğidir. Sıra numarası
// hiçbir gözlemle eşleşmedi → hücreler boş döndü → ekran "bu gün için kayıt
// yok" yazdı. Veri vardı, sorgu yanlıştı.
//
// NEDEN TEST: uç 200 döndü, konsola hata basılmadı, ekran dürüst bir "veri
// yok" cümlesi gösterdi. Yani hata KENDİNİ DOĞRU DAVRANIŞ GİBİ GÖSTERDİ.
// Bu sınıf ancak böyle bir bekçiyle yakalanır.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..');

function jsDosyalari(dizin) {
  const out = [];
  for (const e of readdirSync(dizin, { withFileTypes: true })) {
    const yol = join(dizin, e.name);
    if (e.isDirectory()) out.push(...jsDosyalari(yol));
    else if (e.name.endsWith('.js')) out.push(yol);
  }
  return out;
}

const UCLAR = ['radarDailyPlayed', 'radarDailyOdds'];

test('radarDailyPlayed/radarDailyOdds ikinci parametre olarak SIRA almaz', () => {
  const hatalar = [];
  for (const yol of jsDosyalari(join(kok, 'src'))) {
    const kod = readFileSync(yol, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const uc of UCLAR) {
      const re = new RegExp(`${uc}\\(([^)]*)\\)`, 'g');
      let m;
      while ((m = re.exec(kod))) {
        const args = m[1].split(',').map((x) => x.trim()).filter(Boolean);
        if (args.length < 2) continue;                    // tek parametre: doğru
        // İkinci parametre sıra/no benzeri bir şeyse HATADIR.
        if (/\bno\b|position|sira|sıra/i.test(args[1])) {
          hatalar.push(`${yol.replace(kok, '')}: ${uc}(${m[1]})`);
        }
      }
    }
  }
  assert.deepEqual(hatalar, [],
    `Bu çağrılarda matchId yerine sıra geçilmiş — hücreler sessizce boş döner:\n${hatalar.join('\n')}`);
});

test('bekçi gerçekten tarıyor — dosyaları okuyabiliyor', () => {
  const dosyalar = jsDosyalari(join(kok, 'src'));
  assert.ok(dosyalar.length > 20, `src taranamadı (${dosyalar.length} dosya)`);
  const kullanan = dosyalar.filter((y) => {
    const k = readFileSync(y, 'utf8');
    return UCLAR.some((u) => k.includes(u));
  });
  assert.ok(kullanan.length >= 1, 'bu uçları kullanan dosya bulunamadı — isim değişmiş olabilir');
});
