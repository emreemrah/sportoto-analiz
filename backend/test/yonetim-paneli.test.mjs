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
const betik = readFileSync(join(KOK, 'admin', 'panel.js'), 'utf8');
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

test('panelde SATIR İÇİ betik yok — CSP script-src \'self\' onu çalıştırmaz', () => {
  // YAŞANAN ARIZA (2026-08-06): betik HTML'in içindeydi; sunucunun CSP başlığı
  // satır içi script'i engelledi ve panel BOMBOŞ açıldı. CSP gevşetilmedi,
  // betik ayrı dosyaya alındı. Bu test o hatanın geri gelmesini engeller.
  assert.doesNotMatch(panel, /<script>(?!\s*<\/script>)/,
    'panelde satır içi <script> var — CSP yüzünden çalışmaz, ekran boş açılır');
  assert.match(panel, /<script src="\/yonetim\/panel\.js"><\/script>/,
    'panel betiği harici dosyadan yüklenmiyor');
  assert.match(sunucu, /app\.get\('\/yonetim\/panel\.js'/, 'betik yolu sunulmuyor');
});

test('panel YIKICI işlem sunmuyor (kapsam sınırı)', () => {
  // v1 kapsamı: okuma + bülten yenileme + yorum gizle/geri al/yok say.
  // Kullanıcı silme, arşiv değiştirme, elle skor girme YOK.
  for (const yasak of ['/api/admin/kullanici-sil', 'deleteUser', 'archive', 'skor-gir']) {
    assert.ok(!betik.includes(yasak), `panelde beklenmeyen yıkıcı işlem: ${yasak}`);
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
  // ARANAN: sırrın KENDİSİ, adı değil. Panel kullanıcıya "SUPABASE_DB_URL
  // tanımlanınca kurulur" diye yol gösteriyor; bir ortam değişkeninin ADI sır
  // değildir ve bunu yasaklamak testi gürültüye boğardı. Asıl tehlike
  // gömülü DEĞER: JWT (eyJ...), service_role anahtarı, sk_ ile başlayan
  // gizli anahtarlar ve sabit şifre karşılaştırmaları.
  for (const parca of [panel, betik]) {
    assert.doesNotMatch(parca, /eyJ[A-Za-z0-9_-]{20,}/, 'panelde JWT benzeri gömülü belirteç var');
    assert.doesNotMatch(parca, /service_role|SUPABASE_SECRET_KEY\s*[:=]\s*['"]/i,
      'panelde service-role anahtarı geçiyor');
    assert.doesNotMatch(parca, /\bsk_[A-Za-z0-9]{10,}/, 'panelde gizli anahtar (sk_) gömülü');
    assert.doesNotMatch(parca, /password\s*===|sifre\s*===\s*'/i,
      'panelde sabit şifre karşılaştırması var');
  }
});

test('panel oturum kimliğini (X-Session-Id) gönderiyor', () => {
  // YAŞANAN ARIZA (2026-08-06): giriş başarılı oluyor, ama ilk veri isteği
  // 401 dönüp "Oturum düştü" diyordu. Sebep: sunucu her istekte oturum
  // satırını doğruluyor (mw.js/checkSession) ve başlık gelmezse reddediyor.
  // Panel giriş yanıtındaki sessionId'yi yok sayıyordu.
  assert.match(betik, /bas\['X-Session-Id'\] = oturumId/, 'oturum başlığı gönderilmiyor');
  assert.match(betik, /oturumId = r\.sessionId/, 'giriş yanıtındaki sessionId saklanmıyor');
  // Çıkışta ve yetki hatasında ikisi de temizlenmeli, yoksa bayat kimlik kalır.
  const temizlik = betik.match(/sessionStorage\.removeItem\(OTURUM\)/g) || [];
  assert.ok(temizlik.length >= 2, 'oturum kimliği çıkışta/hata sonrası temizlenmiyor');
});

test('veri okunamayınca uydurma sayı üretilmiyor', () => {
  // sayimDene hata durumunda null döner; panel null için "bilinmiyor" yazar.
  assert.match(rota, /catch \{ return null; \}/, 'sayım hatası 0 gibi gösteriliyor olabilir');
  assert.match(betik, /bilinmiyor/, 'panelde "bilinmiyor" karşılığı yok');
});
