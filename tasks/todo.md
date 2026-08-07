# Görev: Yönetim (admin) paneli — v1

**Karar (tek satır):** Panel, backend'in kendisi tarafından `/yonetim` adresinde
sunulan **tek dosyalık web sayfası** olacak; yetki için YENİ bir rol sistemi
KURULMAYACAK, mevcut `MODERATOR_EMAILS` operatör kimliği kullanılacak.

## Neden web paneli, neden uygulama içi ekran değil
- Yönetim işleri (bülteni yenile, kota bak, bildirim incele) masaüstünde
  yapılır; telefonda küçük ekranda yapılması zor ve gereksiz.
- Uygulama içinde zaten `ModerationScreen` var; panel onu değiştirmez,
  masaüstünden aynı işi yapmayı ekler.
- Mağaza politikası açısından da yönetim arayüzünün uygulama paketinde
  olmaması daha temiz.

## Yetki
- Mevcut `operatorKapisi` (src/moderatorGate.js) aynen kullanılacak:
  `.env` içindeki `MODERATOR_EMAILS`, doğrulanmış e-posta şartı, fail-closed.
- Panel, uygulamanın kendi giriş ucunu (`POST /api/auth/login`) kullanır;
  ayrı bir şifre/anahtar YOK (ikinci bir sır = ikinci bir sızıntı yüzeyi).

## Yapılacaklar
- [x] Mevcut moderasyon/yetki altyapısını incele
- [x] `backend/src/routes/admin.js` — operatöre kapalı iki uç:
      `GET /api/admin/ozet`, `POST /api/admin/bulten-yenile`
- [x] `backend/admin/index.html` — tek dosya panel (giriş + Durum + Bülten + Moderasyon)
- [x] `server.js` — `/yonetim` yolundan paneli sun, `/api/admin` rotasını bağla
- [x] Bekçi testleri: uçlar operatör olmadan 403, panel yolu var
- [x] Yerelde çalıştırıp doğrula

## Kapsam dışı (v1)
- Kullanıcı silme/askıya alma (tehlikeli, geri alınamaz — ayrı karar)
- İçerik düzenleme, elle skor girme (arşiv dokunulmazlığı kuralı)
- Rol tablosu / çoklu yetki seviyesi (gereksiz saldırı yüzeyi)

## İnceleme
- Panel yalnız OKUR ve iki güvenli işlem yapar: bülteni yenile, yorum gizle/geri al.
- Hiçbir uydurma sayı yok: veri yoksa "bilinmiyor" yazılır.
- Yeni paket kurulmadı (saf HTML + JS).
- Doğrulama: `/api/admin/ozet` giriş olmadan **401** döndü (tarayıcıda ölçüldü).
- Testler: backend 950 geçti / 0 kaldı (32 atlandı — canlı veritabanı isteyenler).

## Operatör ayarı — GEÇİCİ olarak yapıldı (2026-08-06)
Kullanıcı kararı: şimdilik kendi adresi kullanılacak. `backend/.env` içine
`MODERATOR_EMAILS=emrahanlar.41@hotmail.com` yazıldı ve backend yeniden
başlatıldı. Ayrı bir "admin@" adresi açmaya gerek yok: panel, uygulamanın
kendi hesabıyla çalışır.

- Bu dosya `.gitignore`'lu → değer GitHub'a gitmez, yalnız bu bilgisayarda.
- Gerçek sunucuya geçince aynı değişkeni orada da tanımlaman gerekecek.
- İleride ayrı bir yönetim adresi açarsan tek satırı değiştirmek yeterli
  (virgülle birden fazla adres de yazılabilir).

**Şart:** bu adresle uygulamada bir hesap OLMALI ve e-postası
DOĞRULANMIŞ olmalı (kapı `email_confirmed_at` arar). Hesap yoksa önce
uygulamadan kayıt olup doğrulama bağlantısına tıklamak gerekir.

## İpucu Bandı — YAPILDI ve GERİ ALINDI (2026-08-07)
Kullanıcı kararı: istenen bu değildi (web sitesi isteniyordu). Banner ile
ilgili tüm değişiklikler geri alındı: App.js ve prefs.js eski hâline döndü,
tipConfig.js / TipBanner.js / tip-banner-mantik.test.mjs silindi. Çalışma
ağacı bu iş öncesiyle birebir aynı (git ile doğrulandı).

## Kanıt Altyapısı — 3 iş (2026-08-07)

Ortak sorun: başarı karnesine sayılan **tek** hafta var (12 maç). Bu boyutta
"örüntü bulduk" demek istatistiksel olarak boştur. Üç iş, bu sorunun üç ayrı
yüzüne bakar ve **hiçbiri karne kurallarını gevşetmez.**

### 1. Keşif havuzu — `backend/src/analysis/sinyalToplama.js`
`sinyalKayitlariniTopla({ kesif: true })` artık mührü **geç atılmış**
(`late_unverified`) haftaları da toplar. Örüntü taraması bunu kullanır.

- Başarı karnesi uçlarına **dokunulmadı**; oradaki kapı aynen kapalı.
- Beyaz liste: yalnız `late_unverified`. Demo, `legacy_backfill`,
  `retrospective_backtest` ve `unknown` **girmez** — ilk üçü üretilmiş veridir,
  sonuncusunda tahminin maçtan önce üretildiğine dair hiçbir kanıt yoktur.
- Her kayıt `kesif` ve `muhurTuru` etiketi taşır; panelde "Kaynak" sütununda
  `resmî` / `n/m keşif` / `tamamı keşif` olarak görünür. Karıştırılamaz.
- Test: `backend/test/kesif-havuzu.test.mjs` (4) — en kritiği, uydurma verinin
  havuza **sızmadığını** kanıtlayan test.

### 2. Mühürleme alarmı — `backend/src/archive/muhurDurumu.js` (yeni)
51. hafta, mührü ilk maçtan sonra atıldığı için karneye giremedi ve bu
**sessizce** oldu. Mühür kaçtıktan sonra geri dönüş yok; tek savunma önceden
uyarmak. Yeni uç: `GET /api/admin/muhur-durumu` (salt okur, mühür atmaz).

- Durumlar: `saglam` / `gec` / `kayip` / `bekliyor` / `eksik` / `bilinmiyor`.
- İlk maça 6 saat kala mühür yoksa **kritik**, 24 saat kala uyarı.
- Panelde Genel sekmesinin **en üstünde** alarm bandı + hafta hafta tablo.
- Test: `backend/test/muhur-alarmi.test.mjs` (9) — "iyi haber kötü haberi
  gizlemez" testi dahil.

### 3. İleri-doğrulama — `backend/src/analysis/oruntuTarayici.js`
Bir örüntüyü bulduğu verinin üzerinde ölçmek kendini doğrulamaktır.
`ileriDogrula()` örüntüyü **eski** haftalarda arar, **en son haftayı** sınav
olarak ayırır ve örüntünün hiç görmediği veride ne olduğunu yazar.

- Veri yetmiyorsa (< 3 hafta) sayı **uydurulmaz**: `yeterli:false` ve sebep
  döner. Bugünkü veriyle panelde görünecek şey büyük ihtimalle budur — ve
  doğrusu da odur.
- Panelde ayrı kart: Eğitimde / Sınavda / tuttu·kısmen·tutmadı.
- Test: `backend/test/ileri-dogrulama.test.mjs` (5) — en önemlisi, eğitimde
  %100 olup sınavda çöken örüntünün **ifşa edildiğini** kanıtlayan test.

### Bekçi testi
`yonetim-paneli.test.mjs`: panel.js'in aradığı her `$('id')` index.html'de var
mı? Eksik id, script'i o satırda öldürür ve ekran "boş ama hatasız" görünür.

**Doğrulama:** backend süitleri parça parça çalıştırıldı, **0 başarısız**.
Panelin tarayıcıda görsel doğrulaması **yapılamadı** (Chrome eklentisi oturum
sırasında bağlantıyı kesti) — bu adım açık kaldı.

## Kriter Seçimi Kaldırıldı → Kriter Başarıları Maç İçine (2026-08-07)

Kullanıcı kararı ve gerekçesi: "Yorum katmayacaksın, olanı göstereceksin. Bu
kriter burada başarılı demeyecek — bunu ben tutan maçlardan kendim bakarak
anlamam lazım." Kriter seçme paneli kaldırıldı; yerine kriterlerin GEÇMİŞ
karnesi ve ham maç tablosu kondu.

### Eklenen
- `app/src/components/KriterBasariListesi.js` — maç detayı → Analiz sekmesinde
  kriter karnesi (dönem seçici + satır: "12 maçta 7 başarı · %58 ›").
- `KriterKirilimScreen` sadeleşti: yorum, bant adı ve hüküm YOK; tek ham tablo
  (sıra · maç · oran 1/X/2 · oynanma % 1/X/2 · kriter · sonuç · skor · hafta ·
  ✓/✗) + Hepsi/Tuttu/Tutmadı süzgeci + Hafta/Sıra/Oran/Oynanma sıralaması.

### Kaldırılan (kullanıcı onayıyla)
- `app/src/screens/AnalysisSettingsScreen.js` — "Analiz Kriterlerim" ekranı
- `app/src/analysisProfile.js` — profil deposu (seçim, etki, Manuel/Akıllı)
- `app/src/components/UserAnalysisView.js` — kullanıcı seçimli analiz görünümü
- `app/src/analysis/engine.js` + `thresholds.js` — cihazdaki hafif kriter motoru
- `app/src/kriterAktarim.js` — kupona kriterle aktarım
- Kupon editöründeki "🎛 Kriter" düğmesi ve penceresi
- Sistem Karnesi'ndeki "Kriter" sekmesi (artık maç içinde)
- Backend: `/api/analysis/profiles*` (7 uç), `save-user-analysis`,
  `/bulletins/:id/user`; `resolveProfile()` artık HER ZAMAN resmî profil döner
  (istek gövdesindeki profil YOK SAYILIR — eski istemci arka kapı açamaz).
- Testler: `analysis-profile`, `kriter-aktarim`, `analysis-honesty`,
  `esik-birligi` (kaldırılan kodu test ediyorlardı).

### Davranış değişikliği
- "⚙ Sistemden al" artık bültenin **resmî tahminine** (`m.prediction`) bağlı;
  tahmin yoksa seçim yapılmaz (uydurma sembol yazılmaz).
- Master Analiz kutusundaki "Profil: … · Mod: …" satırı kalktı (tek profil var).

### Korundu (bilerek)
- `backend/src/analysis/analysisStore.js` profil/kullanıcı-analizi metotları ve
  `analysis_profiles` tablosu: **hesap silme akışı** o tabloyu temizliyor
  (`accountDeletion.js`). Eski kullanıcı verisi silinebilir kalmalı.
- `localData.js` içindeki eski profil anahtarları: çıkış/hesap silmede temizlik.

### Doğrulama
- app: 501 test, 500 geçti (`simple-test.mjs` bu işten ÖNCE de kırıktı).
- backend: tüm süitler parça parça çalıştırıldı, **0 başarısız**.
- Kalıntı taraması: `analysisProfile|AnalysisSettings|UserAnalysisView|
  kriterAktarim|analysis/engine` → yalnız localData anahtarları (kasıtlı).
- Belgeler güncellendi: CLAUDE.md "İKİ MOTOR" → "TEK MOTOR" + kriter seçimi yok;
  HANDOFF.md §6 ve frontend dosya listesi.
- **Yapılamadı:** tarayıcıda görsel doğrulama (Chrome eklentisi bağlı değil).
