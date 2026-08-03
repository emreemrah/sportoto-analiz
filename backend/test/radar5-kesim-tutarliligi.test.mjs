// RADAR 5 — LİSTE İLE YÜZDE AYNI KESİMİ KULLANIR.
//
// DOĞRULANMIŞ HATA (3 Ağustos 2026, kullanıcı bildirdi): /position-matches
// listeyi `eskiHaftalariAt` ile arşiv başlangıcından (1525) kesiyordu ama
// /position-dna kesmiyordu. Ekranda "2 maç" yazarken yüzdeler 768 maçtan
// hesaplanıyordu; dönem filtresi (Tüm Haftalar / Son 5 / Son 10 …) değiştikçe
// yüzde, ELDE OLMAYAN haftalara göre oynuyordu ve kullanıcı ekrandaki sayıyı
// doğrulayamıyordu.
//
// SÖZLEŞME: iki uç aynı kaynaktan, aynı kesimle beslenir. routes/radar.js
// içindeki yorum bunu zaten söylüyordu ("Kesim ve sezon kapsamı /position-dna
// İLE AYNI hesaplanır"); kod tutmuyordu. Bu dosya sözü koda bağlar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.CACHE_DIR = mkdtempSync(join(tmpdir(), 'sportoto-r5kesim-cache-'));
process.env.ARCHIVE_DIR = mkdtempSync(join(tmpdir(), 'sportoto-r5kesim-arsiv-'));
process.env.ARCHIVE_DRIVER = 'file';
process.env.HISTORY_DIR = mkdtempSync(join(tmpdir(), 'sportoto-r5kesim-hist-'));
process.env.HISTORY_DRIVER = 'file';
// Gerçek sınır: bu dosyanın konusu TAM OLARAK bu kesim, o yüzden varsayılan
// (1525) bilerek AÇIK bırakılır — env ile ezilmez.

const { _resetArchiveStoreForTests } = await import('../src/archive/store.js');
_resetArchiveStoreForTests();
const { _resetHistoryStoreForTests, getHistoryStore } = await import('../src/history/historyStore.js');
_resetHistoryStoreForTests();
const { LISTE_BASLANGIC_ROUND_ID } = await import('../src/radar/siraOynanma.js');

const SEZON = '2025-2026';

// Sonuç harfi sıraya göre sabit: 1. sıra hep 'X', diğerleri '1'. Böylece
// yüzdenin hangi maçlardan geldiği tek bakışta doğrulanabilir.
const mkRow = (position, result) => ({
  position,
  result,
  resultValid: true,
  scoreHome: result === 'X' ? 1 : 2,
  scoreAway: result === 'X' ? 1 : 0,
  sourceHash: `h${position}${result}`,
  provenanceType: 'official_result_history',
  correctionVersion: 1,
});

async function kur() {
  const hist = getHistoryStore();
  // 1510–1524: arşiv başlangıcından ESKİ 15 hafta. Hiçbir hesaba girmemeli.
  // NEDEN BU KADAR ÇOK: tek eski hafta yetmez — 3 haftalık bir kümede "Son 5"
  // penceresi zaten hepsini kapsar ve dönem filtresi hatalı kodda da sabit
  // görünürdü (ilk sürümde tam olarak bu oldu). Pencerelerin BİRBİRİNDEN
  // ayrışması için sınırın gerisinde last5'i dolduracak kadar hafta gerekir.
  // Sonuçları bilerek '2': sızarlarsa yüzdelerde '2' belirir ve test düşer.
  for (let r = 1510; r <= 1524; r += 1) {
    await hist.upsertRound({ roundId: String(r), seasonYear: SEZON, status: 'completed', roundCloseAt: `2026-0${r % 2 === 0 ? 5 : 6}-${String((r % 27) + 1).padStart(2, '0')}T00:00:00Z` });
    await hist.putMatches(String(r), Array.from({ length: 15 }, (_, i) => mkRow(i + 1, '2')));
  }
  // 1525 ve 1526 — sınırın içinde, sayılmalı.
  await hist.upsertRound({ roundId: '1525', seasonYear: SEZON, status: 'completed', roundCloseAt: '2026-07-20T00:00:00Z' });
  await hist.putMatches('1525', Array.from({ length: 15 }, (_, i) => mkRow(i + 1, i === 0 ? 'X' : '1')));
  await hist.upsertRound({ roundId: '1526', seasonYear: SEZON, status: 'completed', roundCloseAt: '2026-07-27T00:00:00Z' });
  await hist.putMatches('1526', Array.from({ length: 15 }, (_, i) => mkRow(i + 1, i === 0 ? 'X' : '1')));

  const { save } = await import('../src/cache.js');
  save('bulletin', { roundId: 1527, round: '53. Hafta', matches: [] });

  const express = (await import('express')).default;
  const router = (await import('../src/routes/radar.js')).default;
  const app = express();
  app.use('/api/radar', router);
  const server = await new Promise((res) => { const s = app.listen(0, '127.0.0.1', () => res(s)); });
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

test('sınır sabiti gerçekten 1525', () => {
  assert.equal(LISTE_BASLANGIC_ROUND_ID, 1525);
});

test('YÜZDE de listeyle aynı kesimi kullanır — 1525 öncesi haftalar sayılmaz', async () => {
  const { server, base } = await kur();
  try {
    const dna = await (await fetch(`${base}/api/radar/position-dna`)).json();
    assert.equal(dna.hasData, true, 'veri var');

    // 1525 (15) + 1526 (15) = 30. Kesim çalışmazsa 1510–1524 de girer → 255.
    assert.equal(dna.dna.totalMatches, 30,
      'yalnız 1525 ve sonrası sayılmalı — eski haftalar sızarsa bu sayı 255 olur');

    // 1. sıra: iki hafta da 'X'. Eski haftalar sızsaydı '2' de görünür ve
    // X %100 olmazdı.
    const p1 = dna.dna.positions.find((p) => p.position === 1);
    const allTime = p1.windows.allTime.pct;
    assert.equal(Number(allTime.X), 100, '1. sıra: iki maç da beraberlik → X %100');
    assert.equal(Number(allTime['2']), 0, 'eski haftanın "2" sonucu yüzdeye SIZMADI');
  } finally { server.close(); }
});

test('DÖNEM FİLTRESİ elde olmayan haftaya göre OYNAMAZ', async () => {
  // Kullanıcının bildirdiği belirti: "2 maç olmasına rağmen yüzdeler değişiyor".
  // Elde 2 hafta varken her pencere aynı 2 haftayı kapsar; yüzde sabit kalmalı.
  const { server, base } = await kur();
  try {
    const dna = await (await fetch(`${base}/api/radar/position-dna`)).json();
    const p1 = dna.dna.positions.find((p) => p.position === 1);
    const pencereler = Object.keys(p1.windows);
    assert.ok(pencereler.length >= 3, 'birden çok dönem penceresi var');

    const ilk = JSON.stringify(p1.windows[pencereler[0]].pct);
    for (const k of pencereler) {
      assert.equal(JSON.stringify(p1.windows[k].pct), ilk,
        `"${k}" penceresi farklı yüzde veriyor — elde yalnız 2 hafta varken dönem filtresi yüzdeyi değiştiremez`);
    }
  } finally { server.close(); }
});

test('LİSTE ile YÜZDE aynı maç sayısını görür', async () => {
  const { server, base } = await kur();
  try {
    const dna = await (await fetch(`${base}/api/radar/position-dna`)).json();
    let listeToplam = 0;
    for (let p = 1; p <= 15; p += 1) {
      const r = await (await fetch(`${base}/api/radar/position-matches?position=${p}`)).json();
      listeToplam += Number(r.count) || 0;
      for (const m of r.matches || []) {
        assert.ok(Number(m.roundId) >= LISTE_BASLANGIC_ROUND_ID,
          `listede sınırdan eski hafta var: ${m.roundId}`);
      }
    }
    // İki uç aynı kaynağı aynı kesimle okuduğu için toplamlar eşit olmalı.
    assert.equal(listeToplam, dna.dna.totalMatches,
      'listedeki toplam maç sayısı ile yüzdenin tabanı AYNI olmalı');
  } finally { server.close(); }
});
