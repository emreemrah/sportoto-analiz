// YÖNETİM PANELİ BEKÇİSİ
// ---------------------------------------------------------------------------
// Panelin tek koruması sunucudaki operatör kapısıdır. Bu testler, o kapının
// yerinde durduğunu ve panelin kapsam sınırını aşmadığını kaynak üzerinden
// doğrular. Kapı bir gün yanlışlıkla kaldırılırsa burası kırmızı yanar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const rota = readFileSync(join(KOK, 'src', 'routes', 'admin.js'), 'utf8');
const panel = readFileSync(join(KOK, 'admin', 'index.html'), 'utf8');
const sunucu = readFileSync(join(KOK, 'src', 'server.js'), 'utf8');

test('yönetim uçları operatör kapısının ARKASINDA', () => {
  assert.match(rota, /router\.use\(requireAuth, operatorKapisi\(process\.env\)\)/,
    'operatorKapisi yok — uçlar herkese açık kalmış olabilir');
  // Kapı, uçlardan ÖNCE gelmeli: sonra gelseydi önündeki uçlar korumasız kalırdı.
  const kapiIndex = rota.indexOf('operatorKapisi(process.env)');
  const ilkUc = Math.min(
    ...[rota.indexOf("router.get('/ozet'"), rota.indexOf("router.post('/bulten-yenile'")]
      .filter((i) => i >= 0),
  );
  assert.ok(kapiIndex < ilkUc, 'kapı uçlardan sonra tanımlanmış');
});

test('yönetim uçlarında /access gibi AÇIK uç yok', () => {
  // Moderasyonda `/access` bilerek açıktır (uygulama menüyü göstersin diye).
  // Yönetim panelinde böyle bir ihtiyaç yok; açık uç eklenirse fark edilsin.
  assert.doesNotMatch(rota, /router\.(get|post)\([^)]*requireAuth[^)]*\)\s*,/,
    'uçlara ayrı ayrı kimlik eklenmiş — tek kapı kuralı bozulmuş olabilir');
});

test('panel YIKICI işlem sunmuyor (kapsam sınırı)', () => {
  // v1 kapsamı: okuma + bülten yenileme + yorum gizle/geri al/yok say.
  // Kullanıcı silme, arşiv değiştirme, elle skor girme YOK.
  for (const yasak of ['/api/admin/kullanici-sil', 'deleteUser', 'archive', 'skor-gir']) {
    assert.ok(!panel.includes(yasak), `panelde beklenmeyen yıkıcı işlem: ${yasak}`);
  }
  assert.ok(!rota.includes('deleteUser'), 'yönetim ucu kullanıcı siliyor — kapsam dışı');
});

test('panel sayfası sunuluyor ve arama motoruna kapalı', () => {
  assert.match(sunucu, /app\.get\(\['\/yonetim'/, '/yonetim yolu bağlanmamış');
  assert.match(sunucu, /X-Robots-Tag/, 'panel arama motoruna kapatılmamış');
  assert.match(panel, /noindex/, 'panel sayfasında robots etiketi yok');
});

test('panelde gömülü sır veya sabit yönetici şifresi yok', () => {
  // Panel istemcide çalışır; içine yazılan her şey okunabilir.
  assert.doesNotMatch(panel, /SUPABASE|SERVICE_ROLE|secret|api[_-]?key/i,
    'panelde sır benzeri bir ifade var');
  assert.doesNotMatch(panel, /password\s*===|sifre\s*===\s*'/i,
    'panelde sabit şifre karşılaştırması var');
});

test('veri okunamayınca uydurma sayı üretilmiyor', () => {
  // sayimDene hata durumunda null döner; panel null için "bilinmiyor" yazar.
  assert.match(rota, /catch \{ return null; \}/, 'sayım hatası 0 gibi gösteriliyor olabilir');
  assert.match(panel, /bilinmiyor/, 'panelde "bilinmiyor" karşılığı yok');
});
