// KRİTER AKTARIMI — kullanıcının kriter setinden kupon seçimi üretimi.
//
// HANGİ ARIZA İÇİN YAZILDI (2026-08-06): "Geniş" seçeneği motorun kapsayıcı
// `closedPrediction` alanını kullanıyordu. Kullanıcının kriter seti beraberlik
// sinyali üretmiyorsa o alan HER maçta '12' olur; ekranda 15 maçın 14'ü
// "1-2" göründü ve kullanıcı haklı olarak "seçtiğim kritere göre yanlış
// seçimler" dedi. Artık geniş = tekli + GEREKİRSE ikinci (destek farkına göre).
import test from 'node:test';
import assert from 'node:assert/strict';
import { macSecimi, kriterAktarimi, ekranMotoruylaAktar, netFavoriMi, sembolAc, CEKISME_FARKI } from '../src/kriterAktarim.js';
import { userSelectedAnalysisEngine } from '../src/analysis/engine.js';

const mac = (no, master) => ({ no, master });
// Gerçek vakadan (1527, kullanıcının 14 kriterlik seti): X desteği hep 0.
const m = (ana, alt, s1, sX, s2) => ({
  mainPrediction: ana, alternativePrediction: alt, closedPrediction: '12',
  normalizedSupport1: s1, normalizedSupportX: sX, normalizedSupport2: s2,
});

test('tekli: yalnız ana tercih', () => {
  assert.deepEqual(macSecimi(m('1', '2', 89, 0, 11)), ['1']);
  assert.deepEqual(macSecimi(m('2', '1', 20, 0, 80)), ['2']);
});

test('geniş: açık ara favoride GENİŞLETMEZ — eski hata buydu', () => {
  // 89-11: ikinci işaret eklemek bilgi değil gürültü.
  assert.deepEqual(macSecimi(m('1', '2', 89, 0, 11), { genis: true }), ['1']);
  assert.deepEqual(macSecimi(m('2', '1', 18, 0, 82), { genis: true }), ['2']);
});

test('geniş: çekişmeli maçta ikinci işaret eklenir', () => {
  // 51-49 → çekişmeli
  assert.deepEqual(macSecimi(m('1', '2', 51, 0, 49), { genis: true }), ['1', '2']);
  // 56-44 (fark 12 < 25) → çekişmeli
  assert.deepEqual(macSecimi(m('1', '2', 56, 0, 44), { genis: true }), ['1', '2']);
  // Tam eşikte (fark = 25) genişletilmez — sınır dahil değil
  assert.deepEqual(macSecimi(m('1', '2', 62.5, 0, 37.5), { genis: true }), ['1']);
});

test('geniş: X ikinci sıradaysa X eklenir ve SIRA korunur', () => {
  assert.deepEqual(macSecimi({ ...m('1', 'X', 55, 45, 0) }, { genis: true }), ['1', 'X']);
  assert.deepEqual(macSecimi({ ...m('2', 'X', 0, 45, 55) }, { genis: true }), ['X', '2']);
});

test('destek bilinmiyorsa çekişmeli sayılır — olmayan kesinlik iddia edilmez', () => {
  const eksik = { mainPrediction: '1', alternativePrediction: '2' };
  assert.deepEqual(macSecimi(eksik, { genis: true }), ['1', '2']);
});

test('veri yoksa seçim üretilmez (uydurma yok)', () => {
  assert.equal(macSecimi(null), null);
  assert.equal(macSecimi({ mainPrediction: null }), null);
  assert.equal(macSecimi({ mainPrediction: null, closedPrediction: '1X2' }, { genis: true }), null);
});

test('bülten: kilitli maçlara dokunulmaz, veri yoksa boş bırakılır', () => {
  const maclar = [
    mac(1, m('1', '2', 80, 0, 20)),
    mac(2, m('2', '1', 30, 0, 70)),
    mac(3, { mainPrediction: null }),            // veri yok
    mac(4, m('1', '2', 52, 0, 48)),
  ];
  const r = kriterAktarimi(maclar, { genis: true, kilitliNolar: new Set([2]) });
  assert.deepEqual(Object.keys(r.secimler), ['1', '4']);
  assert.deepEqual(r.secimler[1], ['1'], 'açık ara favori genişletilmemeli');
  assert.deepEqual(r.secimler[4], ['1', '2'], 'çekişmeli maç genişletilmeli');
  assert.equal(r.istatistik.veriYok, 1);
  assert.ok(r.uyarilar.some((u) => /kriter verisi yok/.test(u)));
});

test('DÜRÜSTLÜK: kriter seti X üretemiyorsa kullanıcı UYARILIR', () => {
  const maclar = [mac(1, m('1', '2', 80, 0, 20)), mac(2, m('2', '1', 20, 0, 80))];
  const r = kriterAktarimi(maclar, { genis: true });
  assert.ok(
    r.uyarilar.some((u) => /beraberlik \(X\) sinyali üretmiyor/.test(u)),
    'X üretmeyen kriter setinde uyarı verilmiyor',
  );
});

test('X üreten set varsa gereksiz uyarı ÇIKMAZ', () => {
  const maclar = [mac(1, { ...m('1', 'X', 55, 45, 0) })];
  const r = kriterAktarimi(maclar, { genis: true });
  assert.ok(!r.uyarilar.some((u) => /beraberlik/.test(u)));
});

test('eşik sabiti makul aralıkta (regresyon bekçisi)', () => {
  assert.ok(CEKISME_FARKI > 10 && CEKISME_FARKI <= 40, 'çekişme eşiği anlamsız bir değere kaymış');
});


/* ═══════ EKRAN MOTORUYLA BİRLİK (2026-08-06 ikinci düzeltme) ═══════
   Maç Detayı → Analiz ekranındaki "Ana Seçim / Alternatif" ile kupondaki
   tekli/geniş AYNI olmalı. Ekran yerel kriter motorunu kullanıyor; kupon da. */

test('sembolAc: bileşik sembolü kanonik sıraya açar', () => {
  assert.deepEqual(sembolAc('1X'), ['1', 'X']);
  assert.deepEqual(sembolAc('12'), ['1', '2']);
  assert.deepEqual(sembolAc('1X2'), ['1', 'X', '2']);
  assert.deepEqual(sembolAc('102'), ['1', 'X', '2'], "'0' → X");
  assert.deepEqual(sembolAc(''), []);
  assert.deepEqual(sembolAc(null), []);
});

// Ekran motorunun beklediği en sade maç: iki takımın sezon istatistikleri.
const takim = (ppg, gf, ga) => ({
  standing: { ppg, played: 20, wins: 10, draws: 5, losses: 5, position: 3 },
  season: { goalsPerGame: gf, concededPerGame: ga },
  last5: ['G', 'G', 'B', 'M', 'G'],
});
const gercekMac = (no, evPpg, depPpg) => ({
  no,
  home: { name: 'Ev' }, away: { name: 'Dep' },
  stats: { home: takim(evPpg, 1.8, 0.9), away: takim(depPpg, 1.0, 1.4) },
});

const PROFIL = { criteria: { ppg: { on: true, impact: 'kritik' }, formGeneral: { on: true, impact: 'kritik' } } };

test('kupon aktarımı EKRANIN verdiği sonucun AYNISINI üretir', () => {
  const maclar = [gercekMac(1, 2.4, 0.6), gercekMac(2, 1.5, 1.4)];
  for (const genis of [false, true]) {
    const { secimler } = ekranMotoruylaAktar(maclar, PROFIL, { genis });
    for (const m of maclar) {
      const v = userSelectedAnalysisEngine(m, PROFIL)?.verdict;
      // Net favoride geniş de tekli kalır (kullanıcı kuralı) — bunun dışında birebir aynı.
      const net = genis && netFavoriMi(v);
      const beklenen = sembolAc((genis && !net) ? (v?.alt || v?.main) : v?.main);
      assert.deepEqual(secimler[m.no] ?? [], beklenen,
        `maç ${m.no} (${genis ? 'geniş' : 'tekli'}): kupon ekrandan farklı seçim yaptı`);
    }
  }
});

test('kilitli maça dokunulmaz, veri yoksa boş bırakılır', () => {
  const maclar = [gercekMac(1, 2.4, 0.6), gercekMac(2, 1.5, 1.4), { no: 3 }];
  const r = ekranMotoruylaAktar(maclar, PROFIL, { genis: true, kilitliNolar: new Set([2]) });
  assert.ok(!(2 in r.secimler), 'kilitli maça öneri yazılmış');
  assert.ok(!(3 in r.secimler), 'verisiz maça öneri uydurulmuş');
  assert.ok(r.uyarilar.some((u) => /kriter verisi yok/.test(u)));
});


/* ═══════ NET FAVORİDE ÇİFT YOK (kullanıcı kuralı, 2026-08-06) ═══════ */

test('netFavoriMi: ölçü motorun kendi lead değeri (0.55 = "açık ara önde")', () => {
  assert.equal(netFavoriMi({ main: '1', lead: 0.8 }), true);
  assert.equal(netFavoriMi({ main: '2', lead: 0.55 }), true, 'tam eşik net sayılır');
  assert.equal(netFavoriMi({ main: '1', lead: 0.54 }), false, 'eşiğin altı net değildir');
  assert.equal(netFavoriMi({ main: '1', lead: 0.2 }), false);
  // Açık maçta ana seçim ZATEN çifttir — ona dokunulmaz.
  assert.equal(netFavoriMi({ main: '12', lead: 0.9 }), false);
  // lead yoksa (eski önbellek) güvene düşülür.
  assert.equal(netFavoriMi({ main: '1', confidence: 'Yüksek' }), true);
  assert.equal(netFavoriMi({ main: '1', confidence: 'Orta' }), false);
  assert.equal(netFavoriMi(null), false);
});

test('motor lead değerini DIŞA AÇIYOR — kupon kuralı buna dayanıyor', () => {
  const v = userSelectedAnalysisEngine(gercekMac(1, 2.4, 0.6), PROFIL)?.verdict;
  assert.ok(Number.isFinite(v?.lead), 'verdict.lead yok — net favori kuralı yedek ölçüye düşer');
});

test('geniş: net favoride TEK işaret kalır, kullanıcı bilgilendirilir', () => {
  // Ev sahibi ezici → motorun lead değeri eşiği aşar.
  const maclar = [gercekMac(1, 2.9, 0.2)];
  const v = userSelectedAnalysisEngine(maclar[0], PROFIL)?.verdict;
  assert.equal(netFavoriMi(v), true, `ön koşul: bu maç net favori olmalı (lead=${v?.lead})`);
  assert.ok(sembolAc(v.alt).length > 1, 'ön koşul: motorun alternatifi çift olmalı');

  const r = ekranMotoruylaAktar(maclar, PROFIL, { genis: true });
  assert.deepEqual(r.secimler[1], sembolAc(v.main), 'net favoride çift yazılmış');
  assert.equal(r.istatistik.netFavori, 1);
  assert.ok(r.uyarilar.some((u) => /favori net olduğu için tek işaret/.test(u)));
});

test('geniş: net OLMAYAN maçta alternatif aynen gelir', () => {
  const denk = gercekMac(2, 1.5, 1.45);
  const v = userSelectedAnalysisEngine(denk, PROFIL)?.verdict;
  const r = ekranMotoruylaAktar([denk], PROFIL, { genis: true });
  if (netFavoriMi(v)) return;                       // bu maç net çıktıysa test konusu değil
  assert.deepEqual(r.secimler[2], sembolAc(v.alt || v.main));
});

test('tekli kip net favori kuralından ETKİLENMEZ', () => {
  const maclar = [gercekMac(1, 2.4, 0.6), gercekMac(2, 1.5, 1.45)];
  const r = ekranMotoruylaAktar(maclar, PROFIL, { genis: false });
  assert.equal(r.istatistik.netFavori, 0, 'tekli kipte net favori sayacı işlememeli');
  for (const m of maclar) {
    const v = userSelectedAnalysisEngine(m, PROFIL)?.verdict;
    assert.deepEqual(r.secimler[m.no], sembolAc(v.main));
  }
});
