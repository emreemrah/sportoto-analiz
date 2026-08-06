// ÖRÜNTÜ TARAYICI — saf modül testleri.
// En önemli testler "örüntü buluyor mu" değil, "YOK OLAN örüntüyü
// bulmuyor mu" sorusuna bakar. Yanlış pozitif, bu araçtaki asıl tehlikedir.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MIN_ORNEKLEM, bant, dagilimHesapla, guvenDerecesi, oruntuTara, buHaftayaUyanlar,
  KURAL_SEKILLERI,
} from '../src/analysis/oruntuTarayici.js';

const M = (roundId, no, sonuc, oynanma, sinyal = null) => ({
  roundId, hafta: `${roundId}. Hafta`, no, sonuc, oynanma, sinyal,
  home: 'Ev', away: 'Dep', skor: null,
});

test('bant: yüzdeyi 5lik dilime çevirir, geçersizde null', () => {
  assert.equal(bant(44), '40-45');
  assert.equal(bant(45), '45-50');
  assert.equal(bant(0), '0-5');
  assert.equal(bant(null), null);
  assert.equal(bant('abc'), null);
  assert.equal(bant(63, 10), '60-70');
});

test('dagilimHesapla: baskın sonucu ve payını bulur', () => {
  const d = dagilimHesapla([
    M(1, 1, 'X'), M(2, 1, 'X'), M(3, 1, '1'), M(4, 1, '2'),
  ]);
  assert.equal(d.toplam, 4);
  assert.equal(d.baskin, 'X');
  assert.equal(d.baskinPay, 50);
  assert.equal(dagilimHesapla([]), null);
});

test('guvenDerecesi: küçük örneklemde büyük sapma bile GÜÇLÜ sayılmaz', () => {
  assert.equal(guvenDerecesi(3, 90), 'zayıf', 'tesadüf güçlü ilan edilmiş');
  assert.equal(guvenDerecesi(12, 20), 'orta');
  assert.equal(guvenDerecesi(25, 30), 'güçlü');
  assert.equal(guvenDerecesi(25, 10), 'zayıf', 'sapma yetersizken güçlü denmiş');
});

// ═══════════ YANLIŞ POZİTİF SAVUNMALARI ═══════════

test('AZ ÖRNEKLEM: 2 maçlık %100 örüntü olarak BİLDİRİLMEZ', () => {
  const kayitlar = [
    M(1, 1, 'X', { 1: 44, X: 30, 2: 26 }),
    M(2, 1, 'X', { 1: 44, X: 29, 2: 27 }),
  ];
  const r = oruntuTara(kayitlar);
  assert.equal(r.oruntuler.length, 0, '2 maçtan örüntü uydurulmuş');
  assert.ok(r.uyari, 'az veri uyarısı verilmemiş');
});

test('TABAN ORAN: genelde de aynı sonuç çıkıyorsa örüntü DEĞİLDİR', () => {
  // Her maç 1 bitiyor. "1. sırada %100 ev" bilgi değil, tabanın kendisi.
  const kayitlar = [];
  for (let i = 0; i < 30; i += 1) {
    kayitlar.push(M(1000 + i, (i % 15) + 1, '1', { 1: 50, X: 25, 2: 25 }));
  }
  const r = oruntuTara(kayitlar);
  assert.equal(r.oruntuler.length, 0, 'taban oranla aynı olan grup örüntü sayılmış');
  assert.equal(r.taban.dagilim['1'], 100);
});

test('GERÇEK ÖRÜNTÜ: tabandan belirgin sapan grup bulunur', () => {
  const kayitlar = [];
  // Taban: karışık sonuçlar (30 maç, dengeli)
  for (let i = 0; i < 30; i += 1) {
    const s = ['1', 'X', '2'][i % 3];
    kayitlar.push(M(1000 + i, (i % 15) + 2, s, { 1: 33, X: 33, 2: 34 }));
  }
  // Örüntü: 1. sırada ev oynanma %40-45 bandında 8 maçın 7'si X
  for (let i = 0; i < 8; i += 1) {
    kayitlar.push(M(2000 + i, 1, i === 7 ? '1' : 'X', { 1: 44, X: 30, 2: 26 }));
  }
  const r = oruntuTara(kayitlar);
  assert.ok(r.oruntuler.length > 0, 'bariz örüntü bulunamadı');
  const bulunan = r.oruntuler.find((o) => o.sekil === 'sira-ev-bandi');
  assert.ok(bulunan, 'sıra+bant örüntüsü bulunamadı');
  assert.equal(bulunan.sonuc, 'X');
  assert.equal(bulunan.mac, 8);
  assert.ok(bulunan.sapma > 12, 'sapma eşiğin üstünde olmalı');
  assert.ok(bulunan.maclar.length === 8, 'arkasındaki maçlar dönmeli');
});

test('EKSİK VERİ: oynanması olmayan maç bant kuralına GİRMEZ', () => {
  const kayitlar = [];
  for (let i = 0; i < 10; i += 1) kayitlar.push(M(1000 + i, 1, 'X', null));
  const r = oruntuTara(kayitlar, { minOrneklem: 3 });
  const bantli = r.oruntuler.filter((o) => o.sekil.includes('bandi'));
  assert.equal(bantli.length, 0, 'oynanma verisi olmadan bant örüntüsü üretilmiş');
});

test('ÇOKLU KARŞILAŞTIRMA: kaç kural denendiği raporlanır', () => {
  const kayitlar = [];
  for (let i = 0; i < 40; i += 1) {
    kayitlar.push(M(1000 + i, (i % 15) + 1, ['1', 'X', '2'][i % 3], { 1: 40 + (i % 10), X: 30, 2: 30 }));
  }
  const r = oruntuTara(kayitlar);
  assert.ok(r.taranan > 0, 'denenen kural sayısı raporlanmıyor');
  assert.ok(r.elenen >= 0);
  assert.ok(r.esikler.minOrneklem === MIN_ORNEKLEM);
});

test('sıralama: yüksek sapma üstte, eşitlikte çok örneklem üstte', () => {
  const kayitlar = [];
  for (let i = 0; i < 30; i += 1) kayitlar.push(M(1000 + i, (i % 15) + 3, ['1', 'X', '2'][i % 3], { 1: 33, X: 33, 2: 34 }));
  for (let i = 0; i < 10; i += 1) kayitlar.push(M(2000 + i, 1, 'X', { 1: 44, X: 30, 2: 26 }));
  for (let i = 0; i < 7; i += 1) kayitlar.push(M(3000 + i, 2, '2', { 1: 20, X: 25, 2: 55 }));
  const r = oruntuTara(kayitlar);
  for (let i = 1; i < r.oruntuler.length; i += 1) {
    assert.ok(r.oruntuler[i - 1].sapma >= r.oruntuler[i].sapma, 'sıralama bozuk');
  }
});

test('boş girdi: çökmez, açık uyarı döner', () => {
  const r = oruntuTara([]);
  assert.equal(r.oruntuler.length, 0);
  assert.equal(r.taban, null);
  assert.ok(r.uyari);
});

// ═══════════ BU HAFTAYA UYANLAR ═══════════

test('buHaftayaUyanlar: güncel maçı geçmiş örüntüyle eşler', () => {
  const kayitlar = [];
  for (let i = 0; i < 30; i += 1) kayitlar.push(M(1000 + i, (i % 15) + 2, ['1', 'X', '2'][i % 3], { 1: 33, X: 33, 2: 34 }));
  for (let i = 0; i < 8; i += 1) kayitlar.push(M(2000 + i, 1, 'X', { 1: 44, X: 30, 2: 26 }));
  const r = oruntuTara(kayitlar);

  const buHafta = [
    { no: 1, home: 'A', away: 'B', oynanma: { 1: 43, X: 31, 2: 26 } },  // aynı bant
    { no: 7, home: 'C', away: 'D', oynanma: { 1: 10, X: 10, 2: 80 } },  // eşleşmez
  ];
  const uyan = buHaftayaUyanlar(r.oruntuler, buHafta);
  assert.equal(uyan.length, 1, 'yalnız birinci maç eşleşmeliydi');
  assert.equal(uyan[0].no, 1);
  assert.ok(uyan[0].oruntuler.length > 0);
});

test('buHaftayaUyanlar: örüntü yoksa boş döner, uydurma eşleşme yapmaz', () => {
  assert.deepEqual(buHaftayaUyanlar([], [{ no: 1, oynanma: { 1: 44, X: 30, 2: 26 } }]), []);
  assert.deepEqual(buHaftayaUyanlar(null, null), []);
});

test('kural şekilleri: hepsi eksik veride null döner (sessiz 0 yok)', () => {
  for (const s of KURAL_SEKILLERI) {
    assert.equal(s.etiket({}), null, `${s.ad} boş maçtan etiket üretti`);
  }
});

// ═══════════ SİNYAL BAŞARISI TARAMASI (kullanıcının istediği cümle) ═══════════

test('sinyalBasariTara: "şu dilimde 18 maçta 15 doğru" cümlesini üretir', async () => {
  const { sinyalBasariTara } = await import('../src/analysis/oruntuTarayici.js');
  const kayitlar = [];
  // Taban: sinyal genelde %50 tutuyor (40 maç, 20 doğru)
  for (let i = 0; i < 40; i += 1) {
    kayitlar.push(M(1000 + i, (i % 15) + 2, i % 2 === 0 ? '1' : '2', { 1: 33, X: 33, 2: 34 }, '1'));
  }
  // Dilim: 1. sıra + ev bandı %40-45 → 18 maçın 15'i tutuyor
  for (let i = 0; i < 18; i += 1) {
    kayitlar.push(M(2000 + i, 1, i < 15 ? '1' : '2', { 1: 44, X: 30, 2: 26 }, '1'));
  }
  const r = sinyalBasariTara(kayitlar);
  const bulgu = r.bulgular.find((b) => b.sekil === 'sira-ev-bandi' && b.mac === 18);
  assert.ok(bulgu, 'dilim bulunamadı');
  assert.equal(bulgu.dogru, 15);
  assert.equal(bulgu.oran, 83.3);
  assert.equal(bulgu.yon, 'guclu');
  assert.ok(bulgu.sapma > 20, 'kendi ortalamasından sapma hesaplanmamış');
  assert.equal(bulgu.guven, 'orta', '18 maç + 33 sapma → orta olmalı');
});

test('sinyalBasariTara: ZAYIF dilim de bildirilir (yalnız iyi haber değil)', async () => {
  const { sinyalBasariTara } = await import('../src/analysis/oruntuTarayici.js');
  const kayitlar = [];
  for (let i = 0; i < 40; i += 1) {
    kayitlar.push(M(1000 + i, (i % 15) + 2, '1', { 1: 33, X: 33, 2: 34 }, '1'));
  }
  // 1. sırada sinyal hiç tutmuyor
  for (let i = 0; i < 10; i += 1) kayitlar.push(M(2000 + i, 1, '2', { 1: 33, X: 33, 2: 34 }, '1'));
  const r = sinyalBasariTara(kayitlar);
  const zayif = r.bulgular.find((b) => b.yon === 'zayif');
  assert.ok(zayif, 'zayıf dilim gizlenmiş — araç yanlı hale gelir');
  assert.ok(zayif.sapma < 0);
});

test('sinyalBasariTara: yön göstermeyen maç başarısızlık sayılmaz', async () => {
  const { sinyalBasariTara } = await import('../src/analysis/oruntuTarayici.js');
  const kayitlar = [];
  for (let i = 0; i < 20; i += 1) kayitlar.push(M(1000 + i, 1, '1', { 1: 44, X: 30, 2: 26 }, '1'));
  for (let i = 0; i < 20; i += 1) kayitlar.push(M(2000 + i, 1, '2', { 1: 44, X: 30, 2: 26 }, null));
  const r = sinyalBasariTara(kayitlar);
  assert.equal(r.taban.mac, 20, 'sinyalsiz maçlar tabana katılmış');
  assert.equal(r.taban.oran, 100);
});

test('sinyalBasariTara: az veride bulgu üretmez, açık uyarı verir', async () => {
  const { sinyalBasariTara } = await import('../src/analysis/oruntuTarayici.js');
  const r = sinyalBasariTara([M(1, 1, 'X', { 1: 44, X: 30, 2: 26 }, 'X')]);
  assert.equal(r.bulgular.length, 0);
  assert.ok(r.uyari);
});
