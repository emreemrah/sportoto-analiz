// GÜVENCE DİLİ BEKÇİSİ — analiz metinlerinde "güvenli" sıfatı yasaktır.
//
// NEDEN: Bahis bağlamında "güvenli" bir GÜVENCE İDDİASIDIR. Kapalı/çift
// tercih daha güvenli değildir — daha GENİŞ kapsar ve kolon sayısını, yani
// maliyeti artırır. Olumsuz kullanımı da ("bu maç tek sonuç için güvenli
// değil") aynı sorunu taşır: tersini ima eder, yani BAŞKA maçların tek sonuç
// için güvenli olduğunu. Hiçbir maç güvenli değildir.
//
// "banko" için ayrı bir ağ var (labels.js + verdict-wording.test.mjs);
// bu dosya "güvenli/garanti/kesin" sıfatlarını kovalar.
//
// KAPSAM: yalnız KULLANICIYA GÖRÜNEN metin üreten dosyalar. Yorumlar ve
// "veri güvenliği" gibi teknik terimler denetlenmez.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const kok = join(here, '..', '..');

// Kullanıcıya cümle üreten dosyalar (iki motor + karar katmanı).
// (decisionEngine.js listeden çıktı — dosya ölü kod olarak kaldırıldı, 2026-08-06.)
const DOSYALAR = [
  ['app', 'src', 'analysis', 'engine.js'],
// (Yayın Stüdyosu 2026-08-06'da tamamen kaldırıldı — ilgili dosyalar listeden çıktı.)
  ['backend', 'src', 'analysis', 'masterEngine.js'],
];

// Yorum satırlarını at: kural YORUMDA anlatılabilir, METİNDE kullanılamaz.
const yorumsuz = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

// SATIR bazlı tarama. İlk sürüm dize sabitlerini regex'le ayıklamaya
// çalışıyordu; Türkçe kesme işareti (ör. `…%${sX}'i canlı sayar.`) tırnak
// eşleşmesini kaydırıyor ve bekçi KENDİ ayıklama hatasını "bulgu" diye
// raporluyordu. Satır taraması kaba ama dürüst: ne bulduğunu tam gösterir.
const satirlar = (s) => yorumsuz(s).split('\n');

// Kelimeyi ARAYAN kod (tespit regex'i, metin temizleyici) metin değildir.
const KOD_SATIRI = /\.test\(|\.replace\(|\.match\(|RegExp/;

// İzin verilenler:
//  * "…garanti değildir" gibi AÇIK REDDETME cümleleri — istenen yön budur.
//  * "veri güvenliği" teknik terimi (sonuç hakkında bir iddia değil).
// Kalıp olarak yazıldı, tek tek cümle listesi olarak DEĞİL: yeni bir
// reddetme cümlesi yazıldığında bekçiyi elle güncellemek gerekmesin.
// Reddetme = kelimeyi 30 karakter içinde bir olumsuzlama izliyor
// ("kesin bir yön VERİLEMEZ", "garanti DEĞİLDİR", "kesinlik ÜRETİLMEZ").
const IZINLI = [
  /\b(garanti|kesin\w*)\b[^.]{0,30}\b(değil\w*|verilemez|yok|üretilmez|sunulmaz|taşımaz)\b/i,
  /veri güvenliği/i,
];

// Ortak tarayıcı: hangi dosyada hangi satır kuralı çiğniyor?
function tara(desen) {
  const bulunan = [];
  for (const yol of DOSYALAR) {
    const kaynak = readFileSync(join(kok, ...yol), 'utf8');
    satirlar(kaynak).forEach((satir, i) => {
      if (!desen.test(satir)) return;
      if (KOD_SATIRI.test(satir)) return;
      if (IZINLI.some((re) => re.test(satir))) return;
      bulunan.push(`${yol.join('/')}:${i + 1} → ${satir.trim()}`);
    });
  }
  return bulunan;
}

test('analiz metinlerinde "güvenli" sıfatı KULLANILMAZ', () => {
  const bulunan = tara(/güvenli/i);
  assert.deepEqual(bulunan, [],
    'Güvence iddiası taşıyan satır(lar):\n' + bulunan.join('\n')
    + '\nKapalı tercih daha güvenli değil, daha GENİŞ kapsar (kolon sayısı artar).');
});

test('"garanti/kesin/yanılmaz/risksiz" yalnız REDDETME olarak geçebilir', () => {
  const bulunan = tara(/\b(garanti|kesin|yanılmaz|risksiz)\b/i);
  assert.deepEqual(bulunan, [], 'İddialı dil:\n' + bulunan.join('\n'));
});

test('bekçi GERÇEKTEN yakalıyor — yakalamadığı da kanıtlı', () => {
  // Boş listeye bakıp geçen bir bekçi hiçbir şey korumaz. Burada tarayıcı
  // GERÇEK dosyalar üzerinde çalıştırılıp yasak bir satır ENJEKTE edilmiş
  // gibi davranan yerel bir kopyayla sınanır.
  const kontrol = (satir) => !KOD_SATIRI.test(satir)
    && !IZINLI.some((re) => re.test(satir))
    && /güvenli|\b(garanti|kesin)\b/i.test(satir);

  assert.equal(kontrol("    risk = 'Bu maç tek sonuç için güvenli değil.';"), true,
    'yasak cümle yakalanmalı');
  assert.equal(kontrol("    p.push('Kriter uzlaşması yüksek — yine de garanti değildir.');"), false,
    'reddetme cümlesi geçmeli');
  assert.equal(kontrol("  if (/net favori|banko|kesin/.test(predMeaning)) {"), false,
    'tespit regex\'i metin sayılmamalı');

  // Ve tarayıcı gerçekten dosya okuyor: hiç satır göremiyorsa bir şey yanlıştır.
  const toplamSatir = DOSYALAR.reduce(
    (n, yol) => n + satirlar(readFileSync(join(kok, ...yol), 'utf8')).length, 0,
  );
  assert.ok(toplamSatir > 500, `bekçi dosyaları okuyamamış (${toplamSatir} satır)`);
});

test('kapalı tercih cümlesi MALİYETİ de söylüyor', () => {
  // Genişlik bedavaya gelmez; kolon sayısı artar. Bunu söylemeyen bir
  // "daha geniş kapsar" cümlesi eksik kalır.
  const m = readFileSync(join(kok, 'backend', 'src', 'analysis', 'masterEngine.js'), 'utf8');
  assert.match(m, /iki sonucu birden kapsar \(kolon sayısı iki katına çıkar\)/,
    'kapalı tercih cümlesi maliyeti bildirmeli');
});
