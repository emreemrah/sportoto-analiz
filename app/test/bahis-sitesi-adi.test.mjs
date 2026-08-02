// BAHİS SİTESİ ADI UYGULAMADA GEÇMEZ — kalıcı koruma.
//
// NEDEN: Uygulama bahis sitesi tanıtımı yapamaz (yasal kısıt + mağaza
// politikası). Oynanma yüzdesi kaynakları RENK ADIYLA anılır ("Sarı kaynak")
// ve ekranda renkli noktayla gösterilir; site kimliği (nesine/misli/bilyoner)
// yalnız İÇERİDE, kaynakları birbirine karıştırmamak için kullanılır.
//
// Bu test bir kez ihlal edildi: kaynak adları maç satırından kaldırılırken
// "renk lejantı" diye başlığa AD olarak geri kondu. Tarama o yüzden var.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src');

// Marka adlarının GÖRÜNEN biçimi (baş harfi büyük). Arama BÜYÜK/KÜÇÜK HARFE
// DUYARLIDIR: küçük harfli 'nesine'/'misli' İÇ KİMLİKTİR (veri ayrımı için
// zorunlu, ekranda hiç görünmez); yasak olan kullanıcıya yazılabilecek
// biçimdir. Asıl koruma render testindedir — orada çizilen ağacın TÜM
// metinleri taranır; bu tarama yalnız erken uyarıdır.
const YASAK = ['Nesine', 'Bilyoner', 'Misli', 'Oley', 'İddaa', 'Iddaa'];

function dosyalar(dir) {
  const out = [];
  for (const ad of readdirSync(dir)) {
    const p = join(dir, ad);
    if (statSync(p).isDirectory()) out.push(...dosyalar(p));
    else if (['.js', '.jsx'].includes(extname(p))) out.push(p);
  }
  return out;
}

// Yorum satırlarını ayıklar: yasak kelime YORUMDA geçebilir (kararın gerekçesi
// yazılabilmeli), KODDA/METİNDE geçemez.
function yorumsuz(kaynak) {
  return kaynak
    .replace(/\/\*[\s\S]*?\*\//g, '')       // blok yorum (JSX {/* */} dahil)
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))     // satır yorumu
    .join('\n');
}

test('uygulama kaynağında bahis sitesi adı GEÇMEZ (yorumlar hariç)', () => {
  const ihlaller = [];
  for (const f of dosyalar(KOK)) {
    const kod = yorumsuz(readFileSync(f, 'utf8'));
    for (const ad of YASAK) {
      const re = new RegExp(ad);
      if (re.test(kod)) {
        const satir = kod.split('\n').findIndex((l) => re.test(l)) + 1;
        ihlaller.push(`${f.replace(KOK, 'src')}:${satir} → "${ad}"`);
      }
    }
  }
  assert.deepEqual(ihlaller, [],
    'Bahis sitesi adı uygulamada görünemez. Kaynaklar renk adıyla anılır (Sarı/Turuncu/Yeşil kaynak).');
});
