// BAŞLAMIŞ MAÇA GERİYE DÖNÜK TAHMİN ÜRETİLMEZ.
//
// DOĞRULANMIŞ AÇIK: yenileme akışında kilit koruması `prevSnap`e (donmuş
// snapshot) bağlıydı:
//
//     const prevSnap = (isLocked && sameBulletin) ? prevByMatchId.get(id) : null;
//     if (prevSnap) { ...donmuş hâli kullan...; continue; }
//     // snapshot yoksa AŞAĞIDA yeniden hesaplanıyordu
//
// Snapshot yoksa — önbellek temizlenmiş, sunucu boş cache ile açılmış, ya da
// kilitten sonraki İLK yenileme — akış aşağı düşüp BAŞLAMIŞ bir maç için yeni
// analiz + tahmin hesaplıyor ve sistem tahmini gibi saklıyordu.
//
// Bu, projenin temel kuralını deliyor: karneye YALNIZ maç öncesi mühürlenmiş
// tahmin girer. Sonradan üretilen bir tahmin, maç-öncesi veriden hesaplansa
// bile "önceden bilinmiş" sayılamaz; üretildiği an maçtan sonradır.
//
// Kaynak taraması yapıyoruz: bu akış canlı API + FootyStats + Supabase
// istiyor, testte uçtan uca koşturulamaz. Kilidin YERİNDE olduğunu ve
// yanlışlıkla kaldırılmadığını bağlıyoruz.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const ham = readFileSync(join(KOK, 'src', 'refresh.js'), 'utf8');
// Yorumlar çıkarılır: açıklamadaki örnek kod gerçek kod sanılmasın.
const kod = ham.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('snapshot yolundan SONRA, hesaplamadan ÖNCE "started" kapısı var', () => {
  const i = kod.indexOf('const prevSnap');
  assert.ok(i > 0, 'prevSnap bloğu bulunamadı');
  const j = kod.indexOf('let analysis, stats = null, preOdds = null;', i);
  assert.ok(j > i, 'analiz hesabı bulunamadı');
  const ara = kod.slice(i, j);
  assert.match(ara, /if \(started\)/, 'başlamış maç kapısı yok — geriye dönük tahmin üretilebilir');
  assert.match(ara, /continue;/, 'kapı akışı kesmiyor');
});

test('kapı analiz/tahmin alanlarını BOŞ bırakıyor (uydurma yok)', () => {
  const i = kod.indexOf('if (started)', kod.indexOf('const prevSnap'));
  const blok = kod.slice(i, kod.indexOf('let analysis, stats = null, preOdds = null;', i));
  assert.match(blok, /analysis: null/, 'analiz boş bırakılmıyor');
  assert.match(blok, /prediction: null/, 'tahmin boş bırakılmıyor');
  assert.match(blok, /stats: null/, 'istatistik boş bırakılmıyor');
});

test('boşluğun SEBEBİ yazılıyor (projenin "sebep yaz" kuralı)', () => {
  const i = kod.indexOf('if (started)', kod.indexOf('const prevSnap'));
  const blok = kod.slice(i, kod.indexOf('let analysis, stats = null, preOdds = null;', i));
  assert.match(blok, /analysisAbsence/, 'sebep alanı yok');
  assert.match(blok, /started_without_snapshot/, 'sebep kodu yok');
  assert.match(blok, /Maç başladıktan sonra tahmin üretilmez/, 'kullanıcı diliyle sebep yok');
});

test('maç listeden DÜŞMÜYOR — skor ve durum görünmeye devam ediyor', () => {
  // Maçı tümüyle atlamak da yanlış olurdu: kullanıcı bülteninde eksik maç görür.
  const i = kod.indexOf('if (started)', kod.indexOf('const prevSnap'));
  const blok = kod.slice(i, kod.indexOf('let analysis, stats = null, preOdds = null;', i));
  assert.match(blok, /analyzedMatches\.push/, 'maç listeye eklenmiyor');
  assert.match(blok, /\bscore,/, 'skor taşınmıyor');
  assert.match(blok, /resmiSkor,/, 'resmî skor taşınmıyor');
});

test('donmuş snapshot yolu KORUNUYOR (başlamış maç mühürlü hâlini kullanır)', () => {
  // Kapı, kilit yolunun ÖNÜNE geçmemeli: mühürlü analizi olan başlamış maç
  // eskisi gibi donmuş hâlinden okunmalı.
  const iPrev = kod.indexOf('const prevSnap');
  const iIf = kod.indexOf('if (prevSnap)', iPrev);
  const iStarted = kod.indexOf('if (started)', iPrev);
  assert.ok(iIf > 0 && iStarted > iIf, 'started kapısı prevSnap yolundan önce geliyor');
  assert.match(kod.slice(iIf, iStarted), /prediction: prevSnap\.prediction/, 'donmuş tahmin kullanılmıyor');
});
