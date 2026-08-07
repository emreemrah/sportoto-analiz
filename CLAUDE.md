# Spor Toto Analiz — Proje Rehberi

> **Derin bağlam / devir için `HANDOFF.md`'yi oku** (mimari, veri akışı, analiz
> motoru mantığı, deploy, mevcut durum). Bu dosya kısa; HANDOFF ayrıntılı.

## Amaç
Resmi Spor Toto bültenini (sportoto.gov.tr) + FootyStats/API-Football verisini
birleştirip her maça **kupon karar desteği** (analiz) sunan uygulama —
**bahis/ödeme değil, analiz.** Güncel + geçmiş bülten, canlı skor, kapsam kontrolü,
kupon oluşturma ve **iki ayrı analiz motoru** (aşağıda; hangisinin nerede
çalıştığı karıştırılmamalı).

## Yapı
- **backend/** — Node.js (ESM) + Express API, port **4000**.
  - Resmi Spor Toto webapi + FootyStats verisini çeker, analiz/tahmin hesaplar,
    mobil/web uygulamaya temiz JSON sunar. API anahtarları sadece backend'de.
- **app/** — Expo (SDK 56) React Native uygulaması; web için Metro, port **8081**.
  - Sadece kendi backend'ine bağlanır (FootyStats'e asla doğrudan değil).

## Önemli dosyalar
### Backend
- `backend/src/server.js` — Express uçları: `/api/bulletin` (güncel, analizli),
  `/api/rounds` (hafta listesi/navigasyon), `/api/history/:roundId` (geçmiş
  hafta: skor + resmi 1/X/2 + ikramiye), `/api/match/:no`, `/api/surprise-radar`.
  Üretimde `public/` varsa web build'ini de aynı sunucudan servis eder.
- `backend/src/sources/sportoto.js` — Resmi Spor Toto webapi istemcisi
  (haftalar, maçlar, skor/sonuç, ikramiye: `GetGameResultByGameRoundId`).
- `backend/src/sources/footystats.js` — FootyStats istemcisi (takım, lig
  tablosu, oyuncular, maç detayı, kulüp armaları).
- `backend/src/refresh.js` — Bülteni çeker, eşleştirir, analiz/tahmin ekler,
  cache'e yazar. `backend/src/enrich.js` — puan durumu/form/H2H/kadro zenginleştirme.
- `backend/src/analysis/` — `surprise.js` (sürpriz puanı), `prediction.js`
  (kupon kuralları), `aiComment.js` (opsiyonel Claude yorumu).
- `backend/src/cache.js` — dosya tabanlı JSON cache (`backend/cache/`).
- `backend/src/config.js` — `.env`'den ayarlar (FOOTYSTATS_API_KEY, PORT, ...).

### Frontend (app/src)
- `screens/BulletinScreen.js` — **Ana ekran.** Hafta seçici (‹ ›), güncel bülten
  (sade maç kartı: Tarih · Ev · VS · Deplasman) + geçmiş bülten (sonuç + ikramiye).
- `screens/MatchDetailScreen.js` — Maç detayı: kupon tahmini, 1/X/2 ihtimaller,
  analiz, puan durumu, lig tablosu, kadrolar.
- `components.js` — Ortak bileşenler: `FormStrip` (G/B/M form rozetleri),
  `RecordBadges` (O-G-B-M sayıları), `PickGrid`, `StatBar`, `ProbBar`, rozetler.
- `api.js` — backend istemcisi. `config.js` — API adresi (yerel/tünel/üretim).
- `theme.js` — renk/aralık/yarıçap. `utils.js` — tarih/ülke yardımcıları.

## Çalıştırma
- Backend: `cd backend && npm install && npm run dev` (nodemon, :4000)
- Web: `cd app && npm install && npm run web` (Metro, :8081)
- Cache yenile: `cd backend && npm run refresh`
- **Veritabanı migration'ları OTOMATİK**: backend açılışında `backend/migrations/`
  sırayla uygulanır (defter: `public.schema_migrations`, advisory lock, tam
  rollback, bütünlük mührü). Elle SQL çalıştırma. `SUPABASE_DB_URL` (session/direct)
  yoksa migration olmaz: **üretimde** worker/scheduler'lar BAŞLAMAZ, geliştirmede
  yüksek sesle uyarılır ve devam edilir (`MIGRATIONS_REQUIRED=1` orada da kapatır).
  Ayrıntı: `backend/migrations/README.md`, `HANDOFF.md` §9.3.
- Derleme kontrolü (web bundle): `curl -s -o /dev/null -w "%{http_code}" \
  "http://localhost:8081/index.bundle?platform=web&dev=true"` → 200 beklenir.

## Veri/sözleşmeler
- Takım adları **resmi listedeki gibi** gösterilir (çeviri kapalı: web'de
  `translate=no`). Kulüp armaları FootyStats CDN'den; geçmiş maçlarda yoksa ⚽.
- **Resmi sonuç (1/X/2) sadece resmi veriden** gelir; kupon **tahmini** ile
  karıştırılmaz. Başlamış/oynanmış maça analiz/tahmin üretilmez.
- Güncel bülten = analiz odaklı. Geçmiş bülten = sonuç + ikramiye odaklı.

## Çalışma kuralları (KESİN)
- **Bahis/ödeme/para sistemi kurma** — uygulama "analiz + kupon karar desteği".
- **Sahte/kesin sonuç üretme.** Veri yoksa "Bilinmiyor" / "Bu veri bulunamadı" yaz
  ve **risk/güven seviyesini düşür.** Olmayan veriyi varmış gibi gösterme.
- **Yalnız resmi Spor Toto sonucu kesindir.** Canlı/geçici skor kesin sayılmaz,
  başarıya yazılmaz (renk: 🟢 resmi · 🟡 henüz resmi değil · 🔴 canlı).
- **İddialı dil yok:** "kesin/garanti/banko/yanılmaz/net favori" (koşul sağlanmadan).
- Anahtarlar `backend/.env` içinde (gitignore'lu) — asla koda yazma/commit'leme.
- **Kullanıcı arayüzünde marka adı yok** (ör. "FootyStats" gösterme).
- Backend API mantığını gereksiz büyütme; mevcut akışı bozma. Takım adlarını/logoları
  koru. Minimum dosya değişikliği; iş sonunda değişenleri özetle; web bundle 200 doğrula.
- **Yeni paket kurma ve sormadan push/PR/deploy yapma.**
- **TEK MOTOR VAR** (7 Ağustos 2026'dan itibaren):
  `backend/src/analysis/masterEngine.js` — 40 kriterli Master Analiz;
  `analysisService.js` üzerinden `/api/analysis` ve karne uçlarını besler.
  Analiz ve Radar ekranlarında görünen budur.
  - Eskiden ikinci bir hafif motor vardı (`app/src/userMatchEngine.js`, sonra
    `app/src/analysis/engine.js`). İkisi de kaldırıldı; cihazda kriter hesabı
    YAPILMAZ. Yeni bir yerel motor EKLEME — iki motor iki farklı cevap verir
    ve bu sessiz bir hatadır.
- **KULLANICI KRİTER SEÇİMİ YOK** (kullanıcı kararı, 7 Ağustos 2026):
  Analiz her zaman **resmî profille** hesaplanır. Kriter seçme ekranı, profil
  sürümleme ve kullanıcı analizi kaydetme tamamen kaldırıldı. Kullanıcı
  kriterleri seçmez; kriterlerin GEÇMİŞ karnesine bakar (maç detayı → Analiz)
  ve kararı kendi verir. Bu ekran **hüküm vermez** — "bu kriter iyidir/kötüdür"
  cümlesi kurulmaz, ham maç listesi gösterilir.
- `node_modules/`, `.git/`, `dist/`, `build/`, `app/.expo/`, `backend/cache/`,
  `backend/data/`, `backend/public/` üretilen/çıktı — okuma/düzenleme gerekmez.

---

# Çalışma Yöntemi

> Buraya kadarki bölüm **bu projenin** kurallarıdır (ne yapılır, ne yapılmaz).
> Buradan sonrası **nasıl çalışılacağıdır** ve her göreve uygulanır.

## İş Akışı Orkestrasyonu

### 1. Plan Modu Varsayılanı

- Önemsiz olmayan HER görev için plan moduna gir (3+ adım veya mimari kararlar).
- Bir şeyler ters giderse DUR ve hemen yeniden planla — zorlamaya devam etme.
- Plan modunu yalnızca geliştirme için değil, doğrulama adımları için de kullan.
- Belirsizliği azaltmak için ayrıntılı gereksinimleri en baştan yaz.

### 2. Alt Ajan Stratejisi

- Ana bağlam penceresini temiz tutmak için alt ajanları bolca kullan.
- Araştırma, keşif ve paralel analiz işlerini alt ajanlara devret.
- Karmaşık problemler için alt ajanlar aracılığıyla daha fazla işlem gücü kullan.
- Odaklı yürütme için her alt ajana tek görev ver.

### 3. Öz Gelişim Döngüsü

- Kullanıcıdan gelen HER düzeltmeden sonra: kalıba göre `tasks/lessons.md`
  dosyasını güncelle.
- Aynı hatayı tekrarlamayı önleyecek kuralları kendin için yaz.
- Hata oranı düşene kadar bu dersler üzerinde kararlılıkla yineleme yap.
- İlgili projede oturuma başlarken dersleri gözden geçir.

### 4. Bitirmeden Önce Doğrulama

- Çalıştığını kanıtlamadan bir görevi asla tamamlandı olarak işaretleme.
- Gerektiğinde ana sürüm ile kendi değişikliklerin arasındaki davranış farkını
  karşılaştır.
- Kendine şunu sor: "Kıdemli bir mühendis bunu onaylar mı?"
- Testleri çalıştır, logları kontrol et, doğruluğu göster.

### 5. Zarif Çözüm Arayışı (Dengeli)

- Önemsiz olmayan değişikliklerde dur ve şunu sor: "Daha zarif bir yolu var mı?"
- Bir çözüm yamalı görünüyorsa: "Şimdi bildiğim her şeyi bilerek, zarif çözümü
  uygula."
- Basit ve açık düzeltmelerde bunu atla — gereğinden fazla mühendislik yapma.
- Sunmadan önce kendi işini eleştirel biçimde sorgula.

### 6. Otonom Hata Düzeltme

- Bir hata bildirimi verildiğinde: doğrudan düzelt. Adım adım yönlendirme isteme.
- Logları, hataları ve başarısız testleri işaret et — sonra bunları çöz.
- Kullanıcıdan sıfır bağlam değişimi gerektir.
- Nasıl yapılacağı söylenmeden başarısız CI testlerini git ve düzelt.
- Komutları kullanıcıya çalıştırma; sunucuyu yeniden başlatma, test koşturma,
  cache yenileme gibi işleri KENDİN yap.

## Görev Yönetimi

- **Önce Planla:** Planı kontrol edilebilir maddelerle `tasks/todo.md` dosyasına
  yaz.
- **Planı Doğrula:** Uygulamaya başlamadan önce planı kontrol et.
- **İlerlemeyi Takip Et:** İlerledikçe maddeleri tamamlandı olarak işaretle.
- **Değişiklikleri Açıkla:** Her adımda üst düzey bir özet ver.
- **Sonuçları Belgele:** `tasks/todo.md` dosyasına bir inceleme bölümü ekle.
- **Dersleri Kaydet:** Düzeltmelerden sonra `tasks/lessons.md` dosyasını
  güncelle.

## Temel İlkeler

- **Önce Sadelik:** Her değişikliği olabildiğince basit yap. Minimum kodu
  etkile.
- **Tembelliğe Yer Yok:** Kök nedenleri bul. Geçici düzeltme yapma. Kıdemli
  geliştirici standartlarını uygula.
- **Minimum Etki:** Değişiklikler yalnızca gerekli olan yerlere dokunmalı. Hata
  eklemekten kaçın.

## SINIR: otonomluk nerede biter

**Varsayılan: SOR MA, YAP.** Eski "başla demeden başlama" kuralı kullanıcı
kararıyla **İPTAL EDİLDİ** (2 Ağustos 2026). Ekran değişikliği, yeni bileşen,
düzen değişikliği, bölüm ekleme/kaldırma — hiçbiri onay beklemez. İş istendiği
anda başlanır, bitirilir ve sonuç kanıtıyla sunulur.

- **BİLDİRİLEN HATA → sorma, düzelt.** Bozuk davranış, başarısız test, yanlış
  sayı, çöken ekran. Teşhis et, düzelt, kanıtla.
- **EKRAN / TASARIM / YENİ ÖZELLİK → sorma, yap.** İş bitince ne yaptığını ve
  neyi doğruladığını anlat. Beğenilmezse geri alınır; kod geri alınabilir.
- **Adım adım yönlendirme İSTEME.** "Şunu mu yapayım, bunu mu?" diye bölme.
  Belirsizlik varsa makul olanı seç, seçimini tek satırla söyle ve devam et.
- **Komutları kullanıcıya çalıştırma.** Sunucu, test, cache, yeniden başlatma —
  kendin yap.

Tek istisna, geri alınamayan ve dışa dönük işler:

- **GERİ ALINAMAZ veya DIŞA DÖNÜK → yine de sor.** Push, PR, deploy, paket
  kurma, veri/dosya silme, dışarıya mesaj, para harcama. Bunlar "beğenmezsek
  geri alırız" kapsamına girmez.

Kural: *kod geri alınabilir, o yüzden sorma; yayına çıkan geri alınamaz, o
yüzden sor.*
