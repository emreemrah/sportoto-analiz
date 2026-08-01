#!/usr/bin/env node
// ---------------------------------------------------------------------------
// ELLE ÇALIŞTIRMA KAPISI — `npm run migrate`
// ---------------------------------------------------------------------------
// NORMALDE GEREKMEZ: migration'lar backend açılışında kendiliğinden uygulanır
// (src/server.js → acilistaMigrationCalistir). Bu betik yalnız bir operatörün
// yayından ÖNCE durumu görmek istediği durumlar için vardır.
//
// ÖNEMLİ: Bu betik migration'ları KENDİ BAŞINA uygulamaz; backend'in açılışta
// kullandığı MOTORUN TA KENDİSİNİ çağırır. Böylece "elle çalıştırınca farklı,
// açılışta farklı davranıyor" durumu imkânsızdır — tek doğruluk kaynağı.
//
// Önceki sürüm burada `psql -f ...` ile elle sayılmış bir dosya listesi
// kullanıyordu. O liste 004'te kalmıştı: 005 ve 006 hiç çalışmıyordu ve bunu
// kimse fark etmiyordu. Artık dosya listesi diskten OKUNUR, elle tutulmaz.

import { acilistaMigrationCalistir } from '../src/migrate/index.js';

// NODE_ENV=test iken motor kendini atlar; elle çağrıldığında bu istenmez.
const env = { ...process.env };
if (env.NODE_ENV === 'test') delete env.NODE_ENV;

const sonuc = await acilistaMigrationCalistir({ env });

if (!sonuc.ok) {
  console.error(`\n⛔ Migration başarısız: ${sonuc.hata || sonuc.durum}`);
  process.exit(1);
}
console.log(`\n✅ Durum: ${sonuc.durum}${sonuc.uygulanan.length ? ` · uygulanan: ${sonuc.uygulanan.join(', ')}` : ''}`);
