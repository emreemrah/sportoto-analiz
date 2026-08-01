// KULLANICIYA GÖRÜNEN DİL — "banko" ve diğer iddialı kelimeler ekrana düşmesin.
//
// Proje kuralı: "İddialı dil yok: kesin/garanti/banko/yanılmaz/net favori".
// Arayüz bunun için `humanizeVerdictText` güvenlik ağını yazmıştı — ama ağ
// HİÇBİR YERDE import EDİLMİYORDU, yani hiç çalışmıyordu. Sonuç dar ekran
// denetiminde ekran görüntüsüyle yakalandı: Maç Detayı → Analiz sekmesindeki
// "Master Analiz Özeti" kartında şu cümle görünüyordu:
//
//   "Ana tercih —, güvenli kapama 1X2; banko için uygun değil."
//
// İki yerde düzeltildi: (1) backend cümleyi artık "güçlü aday" diye kuruyor,
// (2) MasterAnalysisView backend'den gelen serbest metni güvenlik ağından
// geçiriyor. Bu testler ikisinin de yerinde kalmasını sağlar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { humanizeVerdictText, displayLabel } from '../src/labels.js';
import { userSelectedAnalysisEngine } from '../src/analysis/engine.js';
import { buildDecision } from '../src/decisionEngine.js';
import { getProfileTemplate } from '../src/analysisProfile.js';

const here = dirname(fileURLToPath(import.meta.url));
const oku = (...p) => readFileSync(join(here, '..', 'src', ...p), 'utf8');
const gorunum = oku('components', 'MasterAnalysisView.js');
const kararGorunum = oku('components', 'DecisionEngineView.js');

test('güvenlik ağı "banko" kökünü kullanıcı diline çevirir', () => {
  const gercekCumle = 'Ana tercih —, güvenli kapama 1X2; banko için uygun değil.';
  const cikti = humanizeVerdictText(gercekCumle);
  assert.ok(!/\bbanko\b/i.test(cikti), `"banko" temizlenmedi: ${cikti}`);
  assert.ok(cikti.includes('güçlü aday'), `beklenen karşılık yok: ${cikti}`);
});

test('güvenlik ağı çekimli hâlleri de çevirir', () => {
  for (const [girdi, beklenen] of [
    ['Güçlü banko adayı', 'Güçlü aday'],
    ['banko adayı seçildi', 'güçlü aday seçildi'],
    ['Banko için uygun', 'Güçlü Aday için uygun'],
    ['bankoyu değerlendirir', 'güçlü aday değerlendirmesini değerlendirir'],
    ['bankonun durumu', 'güçlü adayın durumu'],
  ]) {
    assert.equal(humanizeVerdictText(girdi), beklenen);
  }
});

test('güvenlik ağı boş/eksik girdiyle çökmez', () => {
  assert.equal(humanizeVerdictText(''), '');
  assert.equal(humanizeVerdictText(null), null);
  assert.equal(humanizeVerdictText(undefined), undefined);
});

test('güvenlik ağı temiz metni bozmaz', () => {
  const temiz = 'Ana tercih 1, güvenli kapama 1X; güçlü aday için uygun değil.';
  assert.equal(humanizeVerdictText(temiz), temiz);
});

test('MasterAnalysisView güvenlik ağını GERÇEKTEN import ediyor', () => {
  // Asıl kusur buydu: fonksiyon vardı ama kimse çağırmıyordu.
  assert.ok(
    /import\s*\{[^}]*humanizeVerdictText[^}]*\}\s*from\s*'\.\.\/labels'/.test(gorunum),
    'humanizeVerdictText import edilmemiş — güvenlik ağı yine ölü kod',
  );
});

// ——— MOTOR ÇIKTILARININ TAMAMI TARANIR ———
// Tek tek cümle aramak yetmez: bir cümle eklendiğinde test sessiz kalır. Bu
// yüzden motorun DÖNDÜRDÜĞÜ nesne baştan sona gezilir ve METİN DEĞERLERİNİN
// hepsi kontrol edilir. Alan ADLARI (bankoStatus gibi) iç isimdir, kullanıcı
// görmez — sadece DEĞERLER taranır.
//
// FERAGAT İSTİSNASI: "garanti değildir" gibi OLUMSUZ kalıplar YASAK DEĞİLDİR —
// bunlar iddia değil, kullanıcıyı koruyan uyarıdır ve silinirse uygulama daha
// az dürüst olur. Aynı ayrım projede zaten var (bkz. broadcast.test.mjs, orada
// "kesin sonuç veya kazanç vaadi değildir" ifadesi açıkça muaf tutulmuş).
// Buna karşılık "banko" ve "net favori" için istisna YOKTUR: ikisinin de nötr
// karşılığı mevcut ("güçlü aday", "belirgin üstünlük").
const OLUMSUZ = '(?:\\s*\\w*)?\\s*(?:değil|edilmez|vermez|verilmez|yoktur|sunmaz|taşımaz)';
const YASAK = [
  /\bbanko\w*/i,
  new RegExp(`\\bgaranti\\w*(?!${OLUMSUZ})`, 'i'),
  /\byanılmaz\w*/i,
  /net favori/i,
];

function metinleriTopla(dugum, yol = '', kova = []) {
  if (typeof dugum === 'string') { kova.push([yol, dugum]); return kova; }
  if (Array.isArray(dugum)) { dugum.forEach((d, i) => metinleriTopla(d, `${yol}[${i}]`, kova)); return kova; }
  if (dugum && typeof dugum === 'object') {
    for (const [k, v] of Object.entries(dugum)) metinleriTopla(v, yol ? `${yol}.${k}` : k, kova);
  }
  return kova;
}

function yasakAra(nesne, nereden) {
  for (const [yol, metin] of metinleriTopla(nesne)) {
    for (const kalip of YASAK) {
      assert.ok(!kalip.test(metin), `${nereden} → ${yol} yasak dil içeriyor: "${metin}"`);
    }
  }
}

const sifirSezon = { xgFor: 0, xgAgainst: 0, cleanSheetPct: 0, possessionPct: 0, avg: { shots: 0, corners: 0 } };
const durus = (p, ppg) => ({ position: p, points: 20, played: 15, wins: 6, draws: 4, losses: 5, ppg });

function macKur(ev, dep) {
  return {
    no: 1,
    home: { name: 'Aarhus' }, away: { name: 'Brondby' },
    stats: {
      home: { standing: durus(3, ev.ppg), season: { ...sifirSezon, ...ev.season } },
      away: { standing: durus(8, dep.ppg), season: { ...sifirSezon, ...dep.season } },
    },
  };
}

function profil(anahtarlar) {
  const criteria = getProfileTemplate().criteria;
  for (const k of anahtarlar) if (criteria[k]) criteria[k] = { on: true, impact: 'critical' };
  return { criteria, name: 'test', version: 1 };
}

test('kullanıcı seçimli motor: hiçbir çıktı metninde yasak dil yok', () => {
  const senaryolar = [
    // ezici ev favorisi → "güçlü aday" yolu açılır
    ['ezici favori', macKur({ ppg: 2.4, season: { xgFor: 2.3, xgAgainst: 0.7, possessionPct: 62, avg: { shots: 18, corners: 8 } } },
      { ppg: 0.6, season: { xgFor: 0.8, xgAgainst: 2.1, possessionPct: 38, avg: { shots: 7, corners: 3 } } })],
    // başa baş → "Freni" etiketi ve olumsuz gerekçeler devreye girer
    ['başa baş', macKur({ ppg: 1.5, season: { xgFor: 1.4, xgAgainst: 1.3, possessionPct: 50, avg: { shots: 12, corners: 5 } } },
      { ppg: 1.5, season: { xgFor: 1.4, xgAgainst: 1.3, possessionPct: 50, avg: { shots: 12, corners: 5 } } })],
    // veri yok → boş karar yolu
    ['veri yok', macKur({ ppg: 0, season: {} }, { ppg: 0, season: {} })],
  ];
  for (const [ad, mac] of senaryolar) {
    const cikti = userSelectedAnalysisEngine(mac, profil(['xgFor', 'xgAgainst', 'possession', 'shots', 'ppg', 'corners']));
    yasakAra(cikti, `userSelectedAnalysisEngine/${ad}`);
  }
});

test('karar motoru: hiçbir çıktı metninde yasak dil yok', () => {
  const senaryolar = [
    ['net üstünlük', { analysis: { probabilities: { 1: 68, X: 20, 2: 12 }, surpriseScore: 20, hasOdds: true }, coverage: { ok: true }, stats: {} }],
    ['yakın maç', { analysis: { probabilities: { 1: 38, X: 30, 2: 32 }, surpriseScore: 60, hasOdds: true }, coverage: { ok: true }, stats: {} }],
    ['analiz yok', { analysis: {}, coverage: { ok: false }, stats: {} }],
    // kaynak metin iddialı dil içeriyor → çelişki uyarısı üretilir; uyarı
    // cümlesi o dili TEKRARLAMAMALI.
    ['iddialı kaynak', { analysis: { probabilities: { 1: 44, X: 28, 2: 28 }, surpriseScore: 40, hasOdds: true }, coverage: { ok: true }, stats: {}, prediction: { meaning: 'net favori, banko oynanır' } }],
  ];
  for (const [ad, mac] of senaryolar) yasakAra(buildDecision(mac), `buildDecision/${ad}`);
});

// ——— HAM ETİKET EKRANA BASILMASIN ———
// Backend 'BANKO' etiketini VERİ ANAHTARI olarak üretmeye devam eder (arşiv
// uyumu için, bkz. labels.js başlığı) — ama ekrana basılmadan önce mutlaka
// displayLabel() sözlüğünden geçmesi gerekir. Bu kural bir kez delinmişti:
// CouponEditorScreen "Sistem: 1 (BANKO)" yazıyordu. Test, kuralın delindiği
// SATIRI bulur; böylece yeni bir ekran aynı hatayı sessizce tekrarlayamaz.
test('hiçbir ekran analiz/tahmin etiketini HAM basmıyor', () => {
  const kokler = ['screens', 'components'];
  const ihlaller = [];
  for (const kok of kokler) {
    for (const dosya of readdirSync(join(here, '..', 'src', kok)).filter((f) => f.endsWith('.js'))) {
      const metin = oku(kok, dosya);
      const satirlar = metin.split('\n');
      satirlar.forEach((satir, i) => {
        // JSX içinde geçen {...prediction.label} / {...analysis.label}
        if (!/\{[^}]*\b(?:prediction|analysis)\??\.label\b/.test(satir)) return;
        // PENCERE: etiket çoğu yerde koşulda geçer ("label ? <Rozet .../> : null")
        // ve asıl basım BİR SONRAKİ satırdadır. Bu yüzden satırın kendisi değil,
        // satır + sonraki 2 satır birlikte bakılır; sözlük ya da rozet bu
        // pencerede geçiyorsa etiket ham basılmıyor demektir.
        const pencere = satirlar.slice(i, i + 3).join('\n');
        if (/displayLabel\s*\(/.test(pencere) || /SurpriseBadge/.test(pencere)) return;
        ihlaller.push(`${kok}/${dosya}:${i + 1} → ${satir.trim().slice(0, 120)}`);
      });
    }
  }
  assert.deepEqual(ihlaller, [], `Ham etiket basan satır(lar):\n${ihlaller.join('\n')}`);
});

test('backend etiketlerinin TAMAMI sözlükte karşılığı olan anahtarlar', () => {
  // Sözlükte olmayan anahtar displayLabel'dan OLDUĞU GİBİ döner — yani yeni bir
  // backend etiketi eklenirse ekrana ham düşer. Backend'in ürettiği bütün
  // etiketler burada listelidir; biri sözlükten düşerse test uyarır.
  for (const anahtar of ['BANKO', 'DİKKAT', 'SÜRPRİZE AÇIK', 'NET', 'TEMKİNLİ', 'ÇİFTE', 'AÇIK', 'VERİ YOK']) {
    const cikti = displayLabel(anahtar);
    assert.notEqual(cikti, undefined);
    for (const kalip of YASAK) {
      assert.ok(!kalip.test(cikti), `displayLabel('${anahtar}') yasak dil döndürdü: "${cikti}"`);
    }
  }
});

// Motor çıktısını taramak yetmez: ÖRNEK (demo) veri de ekrana metin olarak
// düşer. Denetimde tam bu oldu — src/data içindeki hazır analiz metinleri
// "net favori" ve "gol garantiliydi" diyordu ve bunlar geliştirme derlemesinde
// Bülten Detayı ekranında görünüyordu (yayında yapılan bir yayın için bu, motor
// hiç konuşmasa bile kuralı delen bir cümledir). Artık fixture'lar da taranır.
test('örnek/demo veri metinlerinde yasak dil yok', () => {
  const klasor = join(here, '..', 'src', 'data');
  const ihlaller = [];
  for (const dosya of readdirSync(klasor).filter((f) => f.endsWith('.js'))) {
    const satirlar = readFileSync(join(klasor, dosya), 'utf8').split('\n');
    satirlar.forEach((satir, i) => {
      for (const kalip of YASAK) {
        if (kalip.test(satir)) ihlaller.push(`data/${dosya}:${i + 1} → ${satir.trim().slice(0, 120)}`);
      }
    });
  }
  assert.deepEqual(ihlaller, [], `Örnek veride yasak dil:\n${ihlaller.join('\n')}`);
});

test('DecisionEngineView de güvenlik ağını import ediyor', () => {
  assert.ok(
    /import\s*\{[^}]*humanizeVerdictText[^}]*\}\s*from\s*'\.\.\/labels'/.test(kararGorunum),
    'DecisionEngineView güvenlik ağını kullanmıyor',
  );
});

test('backend kaynaklı serbest metin alanları ağdan geçiriliyor', () => {
  // Bu alanların içeriğini backend üretir; doğrudan basılırsa kural delinir.
  for (const alan of ['ms.summary', 'ms.decisionNote', 'ms.bankoNote', 'ms.supportNote']) {
    const ciplak = new RegExp(`\\{\\s*${alan.replace('.', '\\.')}\\s*\\}`);
    assert.ok(
      !ciplak.test(gorunum),
      `${alan} güvenlik ağından geçmeden doğrudan basılıyor`,
    );
  }
});
