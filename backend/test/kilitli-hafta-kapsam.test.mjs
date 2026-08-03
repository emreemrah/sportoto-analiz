// KİLİTLİ HAFTADA YENİLEME YANLIŞ ALARM VERMEZ.
//
// DOĞRULANMIŞ HATA: `matched` sayacı yalnız "yeniden hesaplanan" dalda
// artıyordu (`matched++`). KİLİTLİ haftada her maç donmuş snapshot yolundan
// `continue` ettiği için sayaç 0 kalıyor, kapsam koruması da bunu
//
//     kapsamGerilemesi(oncekiEslesen > 0, matched = 0) → true
//
// diye okuyup "kapsam çöktü" hatası fırlatıyor ve yenilemeyi durduruyordu —
// veri gayet sağlamken. Aynı tuzak, "başlamış ama mührü yok" dalı eklendiğinde
// bir kez daha tekrarlanacaktı.
//
// ÇÖZÜM: sayaç akış dalından değil, ÜRETİLEN BÜLTENDEN hesaplanıyor
// (eslesenSayisi) — koruma neyi ölçüyorsa sayaç da onu ölçüyor.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { eslesenSayisi, kapsamGerilemesi } from '../src/kapsamKorumasi.js';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const kod = readFileSync(join(KOK, 'src', 'refresh.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('matched, kapsam korumasından ÖNCE bültenden yeniden hesaplanıyor', () => {
  const iHesap = kod.indexOf('matched = eslesenSayisi({ matches: analyzedMatches })');
  assert.ok(iHesap > 0, 'sayaç sonuçtan hesaplanmıyor — kilitli haftada 0 kalır');
  const iKoruma = kod.indexOf('kapsamGerilemesi(oncekiEslesen, matched)');
  assert.ok(iKoruma > iHesap, 'hesap korumadan SONRA yapılıyor — koruma eski sayacı görür');
});

test('donmuş (kilitli) maçlar eşleşmiş sayılıyor', () => {
  // Kilitli haftada bülten satırları snapshot'tan gelir ama coverage taşır.
  const kilitli = {
    matches: Array.from({ length: 15 }, (_, i) => ({
      no: i + 1, coverage: { ok: true }, footySeasonId: 100 + i,
    })),
  };
  assert.equal(eslesenSayisi(kilitli), 15);
});

test('coverage alanı olmayan ESKİ kayıtta sezon kimliği yeterli', () => {
  const eski = { matches: [{ no: 1, footySeasonId: 42 }, { no: 2, footySeasonId: null }] };
  assert.equal(eslesenSayisi(eski), 1);
});

test('kilitli hafta senaryosu artık yanlış alarm ÜRETMİYOR', () => {
  // Önceki hafta 14 eşleşme; bu tur kilitli ve hepsi donmuş hâlinden geldi.
  const onceki = 14;
  const simdi = eslesenSayisi({
    matches: Array.from({ length: 14 }, (_, i) => ({ no: i + 1, coverage: { ok: true } })),
  });
  assert.equal(simdi, 14);
  assert.equal(kapsamGerilemesi(onceki, simdi), false, 'kilitli haftada yanlış alarm');
});

test('GERÇEK çöküş hâlâ yakalanıyor (koruma zayıflatılmadı)', () => {
  // Kaynak erişilemezse hiçbir maç eşleşmez; koruma devrede kalmalı, yoksa
  // dolu bülten boşla ezilir (2 Ağustos 2026'da yaşandı).
  const simdi = eslesenSayisi({
    matches: Array.from({ length: 15 }, (_, i) => ({ no: i + 1, coverage: { ok: false } })),
  });
  assert.equal(simdi, 0);
  assert.equal(kapsamGerilemesi(14, simdi), true, 'gerçek çöküş kaçırılıyor');
});

test('başlamış-mührü yok dalı da sayıma dâhil (yeni dal tuzağı tekrarlanmasın)', () => {
  // Bu dal analiz üretmez ama maçı listeye ekler ve coverage taşır; eşleşme
  // sayısına girmesi gerekir, yoksa aynı yanlış alarm geri döner.
  const iDal = kod.indexOf('started_without_snapshot');
  assert.ok(iDal > 0, 'başlamış-mührü yok dalı bulunamadı');
  const blokBas = kod.lastIndexOf('analyzedMatches.push', iDal);
  const blok = kod.slice(blokBas, iDal);
  assert.match(blok, /coverage,/, 'dal coverage taşımıyor — eşleşme sayılmaz');
});
