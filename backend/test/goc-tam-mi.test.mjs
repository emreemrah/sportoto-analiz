// GÖÇ DOSYALARI EKSİKSİZ Mİ — sıfırdan kurulum çalışır mı?
//
// DOĞRULANMIŞ HATA: kodun kullandığı 5 tablo hiçbir göç dosyasında
// oluşturulmuyordu (`profiles`, `score_predictions`, `player_votes`,
// `lineup_predictions`, `community_poll_votes`). Mevcut kurulumda bu tablolar
// ELLE açılmış olduğu için hata görünmüyordu; sıfırdan kurulan bir
// veritabanında kayıt (register) `profiles` insert'inde patlıyor, dört tahmin
// ucu tümüyle ölü kalıyordu.
//
// Bu test kaynak ile şemayı KARŞILAŞTIRIR: kodda `from('x')` ile okunan her
// tablo, göç dosyalarında `create table ... x` ile açılmış olmalı. Yeni bir
// tablo kullanıldığında göç yazmayı unutmak artık testte yakalanır.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');

function dosyalar(dizin, uzanti, out = []) {
  for (const f of readdirSync(dizin, { withFileTypes: true })) {
    const p = join(dizin, f.name);
    if (f.isDirectory()) dosyalar(p, uzanti, out);
    else if (f.name.endsWith(uzanti)) out.push(p);
  }
  return out;
}

const kod = dosyalar(join(KOK, 'src'), '.js').map((f) => readFileSync(f, 'utf8')).join('\n');
const sql = readdirSync(join(KOK, 'migrations'))
  .filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(join(KOK, 'migrations', f), 'utf8'))
  .join('\n');

// `storage.from('avatars')` bir DEPOLAMA KOVASIDIR, tablo değil — ayıklanır.
// (İlk taramada tam olarak bu yanlış pozitifi verdi.)
const kullanilanTablolar = new Set(
  [...kod.matchAll(/(?<!storage)\.from\('([a-z0-9_]+)'\)/g)].map((m) => m[1]),
);
const olusturulanTablolar = new Set(
  [...sql.matchAll(/create table (?:if not exists )?(?:public\.)?([a-z0-9_]+)/gi)]
    .map((m) => m[1].toLowerCase()),
);

test('kodda kullanılan HER tablo göç dosyalarında oluşturuluyor', () => {
  const eksik = [...kullanilanTablolar].filter((t) => !olusturulanTablolar.has(t)).sort();
  assert.deepEqual(eksik, [], `göç dosyalarında eksik tablo(lar): ${eksik.join(', ')}`);
});

test('tahmin tabloları ve profil şemada VAR', () => {
  // Bu beşi ayrıca ada göre bağlıyoruz: regex bir gün bozulursa test sessizce
  // "eksik yok" demesin.
  for (const t of ['profiles', 'score_predictions', 'player_votes',
    'lineup_predictions', 'community_poll_votes']) {
    assert.ok(olusturulanTablolar.has(t), `${t} göçte yok`);
  }
});

test('yeni göç, mevcut kurulumu BOZMUYOR (if not exists)', () => {
  // Bu tablolar üretimde elle açılmış durumda; göç onları yeniden kurmaya
  // çalışırsa dağıtım patlar.
  const yeni = readFileSync(join(KOK, 'migrations', '009_profiles_predictions.sql'), 'utf8');
  const tabloSatirlari = [...yeni.matchAll(/create table[^(]*/gi)].map((m) => m[0]);
  assert.ok(tabloSatirlari.length >= 5, 'beklenen tablolar yok');
  for (const s of tabloSatirlari) {
    assert.match(s, /if not exists/i, `"if not exists" yok: ${s.trim()}`);
  }
});

test('yeni tabloların hepsinde satır güvenliği açık', () => {
  // Ev stili: erişim yalnız service-role ile. RLS açılmazsa anon rol tabloyu
  // doğrudan okuyabilir.
  const yeni = readFileSync(join(KOK, 'migrations', '009_profiles_predictions.sql'), 'utf8');
  for (const t of ['profiles', 'score_predictions', 'player_votes',
    'lineup_predictions', 'community_poll_votes']) {
    assert.match(
      yeni,
      new RegExp(`alter table public\\.${t} enable row level security`, 'i'),
      `${t} için RLS açılmamış`,
    );
  }
});

test('hesap silinince tahmin ve profil kayıtları da gidiyor', () => {
  // Hesap silme sözü: kullanıcıya ait veri kalmaz.
  const yeni = readFileSync(join(KOK, 'migrations', '009_profiles_predictions.sql'), 'utf8');
  const cascade = [...yeni.matchAll(/references auth\.users\(id\) on delete cascade/gi)];
  assert.ok(cascade.length >= 5, `cascade eksik (bulunan: ${cascade.length})`);
});
