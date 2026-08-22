// RADAR, ANALİZİ OLMAYAN MAÇTA ÇÖKMEZ.
//
// DOĞRULANMIŞ ARIZA (22 Ağustos 2026 — "uygulamaya veri gelmiyor"):
// gecmise-donuk-tahmin.test.mjs'in bağladığı kapı, başlamış ama mührü olmayan
// maça bilerek `analysis: null` yazar. Radar listesi ise şu satırla süzülüyordu:
//
//     .filter((m) => (includeStarted || !m.started) && m.analysis.surpriseScore != null)
//
// İki koruma birlikte tuzağa dönüştü: kapı çalıştığı anda radar TypeError
// atıyor ("Cannot read properties of null"), refreshAll `save('bulletin')`
// satırına HİÇ ULAŞMIYOR ve /api/bulletin kalıcı 503 veriyor.
//
// Geliştirmede görünmüyordu: yerel önbellek dolu olduğu için her başlamış maç
// donmuş snapshot yolundan geçiyor, kapı hiç çalışmıyordu. Üretimde (Render)
// disk geçici — her uyanışta önbellek boş; haftanın ilk maçı başladıktan
// sonraki HER soğuk açılış çöküyordu. Ölçülen belirti: /api/health
// hasData=false · updatedAt=null, kesintisiz.
//
// Kaynak taraması yapıyoruz: buildRadar refreshAll içinde yereldir ve akış
// canlı Spor Toto + FootyStats istediği için testte uçtan uca koşturulamaz.
// Bağladığımız şey, süzgecin boş analize dayanıklı kalmasıdır.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const ham = readFileSync(join(KOK, 'src', 'refresh.js'), 'utf8');
// Yorumlar çıkarılır: açıklamadaki örnek kod gerçek kod sanılmasın.
const kod = ham.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function radarBlogu() {
  const i = kod.indexOf('const buildRadar');
  assert.ok(i > 0, 'buildRadar bulunamadı');
  const j = kod.indexOf('.filter((m) =>', i);
  assert.ok(j > i, 'radar süzgeci bulunamadı');
  const son = kod.indexOf('\n  };', j);
  return { sizgec: kod.slice(j, kod.indexOf('\n', j)), tum: kod.slice(i, son > 0 ? son : i + 4000) };
}

test('radar süzgeci boş analizi güvenli okur (m.analysis?.)', () => {
  const { sizgec } = radarBlogu();
  assert.match(sizgec, /m\.analysis\?\.surpriseScore/,
    'süzgeç m.analysis.surpriseScore diyor — analysis null olduğunda refresh çöker ve bülten hiç kaydedilmez');
});

test('süzgeçten önce korumasız analysis okuması yok', () => {
  const { sizgec } = radarBlogu();
  const korumasiz = sizgec.replace(/m\.analysis\?\./g, '');
  assert.doesNotMatch(korumasiz, /\.analysis\./,
    'süzgeç satırında korumasız .analysis. okuması var');
});

test('başlamış-mühürsüz maçın analizi hâlâ null bırakılıyor (kapı sökülmedi)', () => {
  // Bu düzeltme "boşluğu doldurarak" yapılmış olsaydı geriye dönük tahmin
  // üretilirdi. Radar dayanıklılığı, o kuralın yerine geçmez.
  const i = kod.indexOf('if (started)', kod.indexOf('const prevSnap'));
  assert.ok(i > 0, 'başlamış maç kapısı bulunamadı');
  const blok = kod.slice(i, kod.indexOf('let analysis, stats = null, preOdds = null;', i));
  assert.match(blok, /analysis: null/, 'kapı analizi boş bırakmıyor');
});
