// ---------------------------------------------------------------------------
// BEKÇİ: navigate edilen her rota, o yığında KAYITLI mı? (2026-08-07)
// ---------------------------------------------------------------------------
// NEDEN VAR: kriter satırına dokunulduğunda hiçbir şey olmuyordu. Sebep basit
// ve sessizdi: `KriterKirilim` ekranı YALNIZ Profil yığınına kayıtlıydı, oysa
// ondan açılan MatchDetail dört ayrı yığında duruyor. Kayıtlı olmayan bir
// rotaya navigate etmek hata basmaz — HİÇBİR ŞEY OLMAZ. Kullanıcı "tıklanmıyor"
// der, geliştirici ekranı arar. Bu test o sınıfı yakalar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = readFileSync(join(kok, 'App.js'), 'utf8');

/** App.js'te tanımlı yığın (Stack.Navigator) gövdelerini çıkarır. */
function yiginlar(kod) {
  const out = [];
  const re = /function (\w*Stack)\(\)\s*\{([\s\S]*?)\n\}/g;
  let m;
  while ((m = re.exec(kod))) out.push({ ad: m[1], govde: m[2] });
  return out;
}

/** Bir gövdedeki doğrudan + paylaşılan öğe adlarını toplar. */
function rotalar(govde, kod) {
  const set = new Set();
  for (const m of govde.matchAll(/name="([A-Za-z0-9_]+)"/g)) set.add(m[1]);
  // {paylasilanOge} biçiminde eklenen ekranlar: tanımına bakıp adını al.
  for (const m of govde.matchAll(/\{(\w+)\}/g)) {
    const tanim = new RegExp(`const ${m[1]} = \\(([\\s\\S]*?)\\n\\);`).exec(kod);
    if (!tanim) continue;
    for (const n of tanim[1].matchAll(/name="([A-Za-z0-9_]+)"/g)) set.add(n[1]);
  }
  return set;
}

test('MatchDetail’in olduğu her yığında KriterKirilim de kayıtlı', () => {
  const eksik = [];
  for (const y of yiginlar(app)) {
    const r = rotalar(y.govde, app);
    if (r.has('MatchDetail') && !r.has('KriterKirilim')) eksik.push(y.ad);
  }
  assert.deepEqual(eksik, [],
    `Bu yığınlarda kriter satırına dokunmak İŞE YARAMAZ: ${eksik.join(', ')}`);
});

test('bekçi gerçekten çalışıyor — yığınları okuyabiliyor', () => {
  const y = yiginlar(app);
  assert.ok(y.length >= 3, `App.js'te yığın bulunamadı (${y.length}) — desen değişmiş olabilir`);
  assert.ok(y.some((x) => rotalar(x.govde, app).has('MatchDetail')), 'MatchDetail hiçbir yığında yok');
});
