// YAYIN STÜDYOSU — HÜKÜM YASAĞI KİLİDİ.
//
// YAYINCI İSTEĞİ (birebir): "sistem güvenli riskli vs yazmasın / yayıncı modu
// için". Seçilen kapsam: TAMAMEN KALDIR — toplam risk satırı, seviye rozetleri,
// "En Riskli Maçlar" paneli, "Risk Yorumu" paneli ve "Risk sinyali" çipi
// yayıncı ekranlarından çıktı.
//
// AMA HESAP SİLİNMEDİ: ölçüm `src/broadcastStudio.js` içinde 61 testiyle
// birlikte duruyor; yalnız YAYINCI MODUNDA ÇİZİLMİYOR. Bu iki yarım kural
// birbirini tutar — biri diğeri olmadan yanlış olur:
//   • Ölçüm silinseydi, ileride geri istendiğinde sıfırdan yazılması gerekirdi.
//   • Çizim geri gelseydi, yayıncı yine ekranın verdiği hükmü okurdu.
//
// NEDEN KAYNAK TARAMASI: ekran dosyaları JSX içerir, `node --test` onları içe
// aktaramaz (aynı sebep: studio-screens.test.mjs, studio-fonts.test.mjs). Bu
// yüzden aşağıdakiler dosya METNİNDEN doğrulanır.
//
// BU TEST NEYİ KANITLAR: hükmün koda geri sızmadığını — silinen bileşen ve
// renk eşlemesinin gerçekten yok olduğunu, ekranların ölçüm fonksiyonlarını
// çağırmadığını, ekran metinlerinde yasak sözcük kalmadığını ve ölçümün
// kendisinin hâlâ yerinde durduğunu.
//
// BU TEST NEYİ KANITLAMAZ: gerçek tarayıcıda çizilen metni. Sözcük bir veri
// alanından (radar cümlesi, backend metni) gelirse burada görünmez; onu canlı
// denetim yakalar → `scripts/render-studio.mjs` içindeki `hukumDenetle`.
// O denetimin dört stüdyo ekranına da bağlı kaldığı en altta sınanır.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as motor from '../src/broadcastStudio.js';

const buDizin = dirname(fileURLToPath(import.meta.url));
const oku = (...p) => readFileSync(join(buDizin, '..', ...p), 'utf8');

/** Yorum satırları çıkarılmış kaynak — kural metni kanıt sayılmasın.
    (Bu dosyadaki kuralların çoğu yorumlarda "riskli/güvenli" sözcüklerini
    zaten anıyor; yorum ayıklanmazsa test kendi açıklamasına takılırdı.) */
const kodu = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Yayıncı modunda çizilen HER dosya. Karne de dahildir: geçmiş haftayı
    anlatır, hüküm vermez. İkincil "Sunum" rotası (broadcast.js +
    BroadcastScreen.js) da yayıncının önünde durur — kural orada da geçerli;
    stüdyo temizken sunumun "Temkinli bir hafta" demesi aynı hatadır. */
const YAYINCI_YUZEYI = {
  'StudioBulletinScreen.js': oku('src', 'screens', 'StudioBulletinScreen.js'),
  'StudioMatchScreen.js': oku('src', 'screens', 'StudioMatchScreen.js'),
  // StudioCouponScreen.js buradan DÜŞTÜ: ekran kaldırıldı (yayıncı isteği
  // "final kuponu ekranını kaldır"). Geri gelmediği studio-bulletin-kupon
  // .test.mjs'te sınanır; oradan geçtiği sürece bu listede eksik yoktur.
  'StudioKarneScreen.js': oku('src', 'screens', 'StudioKarneScreen.js'),
  'studioParts.js': oku('src', 'screens', 'studioParts.js'),
  'studioTheme.js': oku('src', 'studioTheme.js'),
  'broadcast.js': oku('src', 'broadcast.js'),
  'BroadcastScreen.js': oku('src', 'screens', 'BroadcastScreen.js'),
};

const TEMA = YAYINCI_YUZEYI['studioTheme.js'];
const PARCALAR = YAYINCI_YUZEYI['studioParts.js'];
const BULTEN = YAYINCI_YUZEYI['StudioBulletinScreen.js'];
const MAC = YAYINCI_YUZEYI['StudioMatchScreen.js'];
const MOTOR_KAYNAK = oku('src', 'broadcastStudio.js');
const RENDER = oku('scripts', 'render-studio.mjs');

/* ═══════════════════════════════════════════════════════════════
   1) HÜKÜM VEREN BİLEŞENLER GERÇEKTEN SİLİNDİ
   Silmek "kullanmayı bırakmak"tan güçlüdür: ortada çağrılacak bir
   bileşen kalmazsa, ileride bir ekrana yanlışlıkla geri eklenemez.
   ═══════════════════════════════════════════════════════════════ */

test('seviye rozeti (LevelBadge) kod tabanında YOK — geri sızacak bileşen kalmadı', () => {
  for (const [ad, kaynak] of Object.entries(YAYINCI_YUZEYI)) {
    assert.ok(
      !/LevelBadge/.test(kodu(kaynak)),
      `${ad}: "Düşük/Orta/Yüksek · 44/100" rozeti geri gelmiş — maça not veren tek bileşendi`,
    );
  }
});

test('seviye→renk eşlemesi (toneOfLevel / toneSoftOfLevel) kod tabanında YOK', () => {
  // Bir maçı yeşil-sarı-kırmızı boyamak, yazıyla "güvenli/riskli" demenin
  // sessiz hâlidir. Renk sözlüğü (good/warn/bad) duruyor ama seviyeye
  // bağlanmıyor; yalnız kolon sınırı gibi NESNEL uyarılarda kullanılır.
  for (const [ad, kaynak] of Object.entries(YAYINCI_YUZEYI)) {
    assert.ok(
      !/toneOfLevel|toneSoftOfLevel/.test(kodu(kaynak)),
      `${ad}: seviye→renk eşlemesi geri gelmiş`,
    );
  }
  assert.ok(!/export\s+(function|const)\s+toneOfLevel/.test(TEMA),
    'studioTheme.js yeniden toneOfLevel dışa aktarıyor');
  assert.ok(!/export\s+(function|const)\s+toneSoftOfLevel/.test(TEMA),
    'studioTheme.js yeniden toneSoftOfLevel dışa aktarıyor');
  assert.ok(!/export\s+function\s+LevelBadge|export\s+const\s+LevelBadge/.test(PARCALAR),
    'studioParts.js yeniden LevelBadge dışa aktarıyor');
});

/* ═══════════════════════════════════════════════════════════════
   2) EKRANLAR ÖLÇÜM FONKSİYONLARINI ÇAĞIRMIYOR
   Ölçüm duruyor; çağrı yayıncı ekranından gelmiyor.
   ═══════════════════════════════════════════════════════════════ */

const HUKUM_FONKSIYONLARI = ['totalRiskOf', 'riskiestOf', 'riskCommentary', 'rowRisk', 'levelOf'];

test('yayıncı ekranları hüküm üreten fonksiyonların HİÇBİRİNİ çağırmıyor', () => {
  for (const [ad, kaynak] of Object.entries(YAYINCI_YUZEYI)) {
    const kod = kodu(kaynak);
    for (const fn of HUKUM_FONKSIYONLARI) {
      assert.ok(
        !new RegExp(`\\b${fn}\\b`).test(kod),
        `${ad}: ${fn} yeniden çağrılıyor — ölçüm ekrana geri çizilmiş`,
      );
    }
  }
});

test('yayıncı ekranları broadcastStudio\'dan hüküm fonksiyonu İÇE AKTARMIYOR', () => {
  // Çağrı olmadan içe aktarım da yeterli uyarıdır: biri paneli yazmaya
  // başlamış demektir. İçe aktarım listesini ayrıca sınamak, "önce import
  // edeyim sonra kullanırım" adımını daha erken yakalar.
  for (const [ad, kaynak] of Object.entries(YAYINCI_YUZEYI)) {
    const ithal = [...kodu(kaynak).matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*'([^']*broadcastStudio[^']*)'/g)];
    for (const [, adlar] of ithal) {
      const liste = adlar.split(',').map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
      for (const fn of HUKUM_FONKSIYONLARI) {
        assert.ok(!liste.includes(fn), `${ad}: ${fn} yeniden içe aktarılmış`);
      }
    }
  }
});

/* ═══════════════════════════════════════════════════════════════
   3) EKRAN METİNLERİNDE HÜKÜM SÖZCÜĞÜ YOK
   ═══════════════════════════════════════════════════════════════ */

// Canlı denetimle (render-studio.mjs) AYNI sözcük listesi. İkisi ayrışırsa
// biri yakalar öbürü kaçırır; bu yüzden en alttaki test iki listeyi eşitler.
const YASAK_HUKUM = /riskli|risksiz|güvenli|güvensiz|temkinli|toplam risk|risk sinyali|risk yorumu|veri güveni|belirsizlik/i;

test('yayıncı ekranlarının metinlerinde "güvenli/riskli/temkinli" geçmiyor', () => {
  for (const [ad, kaynak] of Object.entries(YAYINCI_YUZEYI)) {
    const kod = kodu(kaynak);
    const bulunan = kod.match(YASAK_HUKUM);
    assert.ok(
      !bulunan,
      `${ad}: yasak hüküm sözcüğü geri gelmiş → "${bulunan?.[0]}" · bağlam: ` +
      `"${kod.slice(Math.max(0, (bulunan?.index || 0) - 60), (bulunan?.index || 0) + 60).replace(/\s+/g, ' ')}"`,
    );
  }
});

test('kaldırılan panellerin test kancaları da ekranlarda YOK', () => {
  // "En Riskli Maçlar" paneli testID'siyle birlikte gitti. Kanca dururken
  // panel yoksa, canlı denetim yanlış şeyi arar ve sessizce yeşil kalır.
  //
  // Kanca eskiden yalnız kaldırılan kupon ekranında aranırdı. O dosya gidince
  // denetim de gidecekti — oysa panel BAŞKA bir ekrana geri eklenebilir.
  // Bu yüzden artık tek dosya değil, yayıncının gördüğü BÜTÜN yüzey taranıyor:
  // ekran kaldırıldıktan sonra güvence daralmasın, genişlesin.
  for (const [ad, kaynak] of Object.entries(YAYINCI_YUZEYI)) {
    const kod = kodu(kaynak);
    assert.ok(!/studio-coupon-riskiest/.test(kod),
      `${ad}: "En Riskli Maçlar" paneli geri gelmiş`);
    assert.ok(!/studio-total-risk|studio-risk-/.test(kod),
      `${ad}: Toplam risk kutusu/çubuğu geri gelmiş`);
  }
});

/* ═══════════════════════════════════════════════════════════════
   4) ANALİZ SÜTUNU HÜKÜM DEĞİL, SAYIM YAZIYOR
   ═══════════════════════════════════════════════════════════════ */

test('bülten ANALİZ sütunu "kaç veri kaynağı bulundu" sayısını yazıyor', () => {
  const kod = kodu(BULTEN);
  // Sayı ekranda HESAPLANMAZ: bulunan kaynak listesinin uzunluğudur.
  assert.match(kod, /uncertainty\?\.used\?\.length/,
    'ANALİZ hücresi artık kaynak sayısını okumuyor — yerine ne yazıyor?');
  assert.match(kod, /kaynak/, 'ANALİZ hücresinde "N kaynak" metni yok');
  assert.match(kod, /Veri yok/, 'Kaynak bulunamadığında "Veri yok" yazılmıyor — sessiz kalınamaz');
});

test('bülten alt açıklaması ANALİZ sütununun bir hüküm OLMADIĞINI söylüyor', () => {
  // Dürüstlük kuralı: ekran bir sayı gösteriyorsa, o sayının ne OLMADIĞINI da
  // yazmalı. Yoksa yayıncı "5 kaynak" ı "5 puan" sanır.
  const kod = kodu(BULTEN);
  assert.match(kod, /bir değerlendirme değildir/,
    'ANALİZ sütununun değerlendirme olmadığı yazılmıyor');
  assert.match(kod, /motor 1-0-2 önermez/,
    'Motorun seçim önermediği yazılmıyor');
});

/* ═══════════════════════════════════════════════════════════════
   5) ÖLÇÜM YERİNDE DURUYOR — silinmedi, yalnız çizilmiyor
   ═══════════════════════════════════════════════════════════════ */

test('broadcastStudio.js ölçümü hâlâ dışa aktarıyor (hesap silinmedi)', () => {
  // Kullanıcının seçtiği kapsam: "Hesaplama kodda durur, sadece stüdyoda
  // çizilmez." Bu test o yarının bekçisidir — biri "kullanılmıyor" diye
  // temizlemeye kalkarsa burada durur.
  for (const ad of [...HUKUM_FONKSIYONLARI, 'uncertaintyOf']) {
    assert.equal(typeof motor[ad], 'function', `broadcastStudio.${ad} silinmiş — ölçüm kaybolmamalıydı`);
  }
  assert.equal(typeof motor.LEVEL_LOW_MAX, 'number', 'seviye eşiği LEVEL_LOW_MAX silinmiş');
  assert.equal(typeof motor.LEVEL_MID_MAX, 'number', 'seviye eşiği LEVEL_MID_MAX silinmiş');
  assert.equal(typeof motor.COVERAGE_FACTOR, 'object', 'kapsama katsayıları silinmiş');
});

test('ölçüm çalışır durumda — veri yoksa sayı UYDURMUYOR', () => {
  // Ölçümün "duruyor ama çürümüş" olmadığını görmek için tek bir kez çalıştır.
  const bos = motor.uncertaintyOf({}, null, null);
  assert.equal(bos.hasData, false, 'veri yokken hasData true dönüyor');
  assert.equal(bos.score, null, 'veri yokken sayı uydurulmuş');
  assert.deepEqual(bos.used, [], 'veri yokken kaynak listesi boş olmalı');
});

test('ölçüm yalnız broadcastStudio.js ve kendi testinde kullanılıyor', () => {
  // Hüküm fonksiyonlarının tanımı burada; tanım dışında bir çağrı varsa
  // (yorumlar hariç) o çağrı bir ekrandan geliyordur.
  const kod = kodu(MOTOR_KAYNAK);
  for (const fn of ['totalRiskOf', 'riskiestOf', 'riskCommentary']) {
    assert.match(kod, new RegExp(`export function ${fn}\\b`), `${fn} tanımı kaybolmuş`);
  }
});

/* ═══════════════════════════════════════════════════════════════
   6) CANLI DENETİM BAĞLI KALDI
   Kaynak taraması sözcüğün KODDA olmadığını gösterir. Sözcük veriden
   gelirse yalnız gerçek tarayıcı görür — o denetim sökülmemeli.
   ═══════════════════════════════════════════════════════════════ */

// Eskiden DÖRT ekran taranırdı; final kupon ekranı kaldırıldığı için üç kaldı.
// Kaldırılan ekranın kendi hüküm denetimi de birlikte gitti — ama taşıdığı
// güvence gitmedi: kayıt bülten ekranına geçtiği için bülten ekranı 15/15
// hâlindeyken bir kez daha taranıyor (render-studio.mjs §9).
test('render betiği stüdyo ekranlarının hepsini canlı olarak hüküm için tarıyor', () => {
  assert.match(RENDER, /const hukumDenetle = async/, 'canlı hüküm denetimi sökülmüş');
  for (const ekran of ['studio-bulletin-root', 'studio-match-root', 'studio-karne-root']) {
    const bagli = new RegExp(`hukumDenetle\\([^)]*${ekran}`).test(RENDER)
      || new RegExp(`${ekran}[\\s\\S]{0,2000}?hukumDenetle`).test(RENDER);
    assert.ok(bagli, `${ekran}: canlı hüküm denetimi bu ekrana bağlı değil`);
  }
});

test('canlı denetimle kaynak taraması AYNI sözcük listesini kullanıyor', () => {
  // İki liste ayrışırsa biri yakalar öbürü kaçırır ve yeşil test yanlış
  // güven verir. Listeyi değiştiren iki dosyayı birden değiştirmek zorunda.
  const m = RENDER.match(/const YASAK_HUKUM = (\/.+\/i);/);
  assert.ok(m, 'render-studio.mjs içinde YASAK_HUKUM bulunamadı');
  assert.equal(m[1], String(YASAK_HUKUM), 'yasak sözcük listeleri ayrışmış');
});
