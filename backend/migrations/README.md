# Migration'lar — Bülten Arşivi + Değişmez Snapshot Motoru

Kalıcı arşiv **Supabase (PostgreSQL)** üzerinde çalışır. Supabase yapılandırılmamışsa
backend otomatik olarak dosya tabanlı depoya (`backend/data/archive/`) düşer — bu mod
geliştirme/test içindir; Render free planında `backend/data` **kalıcı değildir**.

## Çalıştırma — elle bir şey yapılmaz

Migration'lar **backend açılışında otomatik** uygulanır. SQL kopyalamak, dosya
seçmek veya her sürümde komut çalıştırmak gerekmez; müşteri bu süreçlerin
hiçbirini görmez.

Tek koşul: backend ortamında **`SUPABASE_DB_URL`** tanımlı olmalı (Supabase →
*Project Settings → Database → Connection string*, **session/direct** bağlantı —
6543 portundaki transaction pooler DEĞİL). PostgREST üzerinden konuşan
`SUPABASE_URL` + `SUPABASE_SECRET_KEY` bu iş için yeterli değildir: PostgREST
tablo/RPC sunar, `CREATE TABLE` / `CREATE TRIGGER` / `ALTER TABLE` gibi DDL
ifadeleri o protokolde ifade EDİLEMEZ. Bu bir yetki ayarı değil, protokol sınırıdır.

Bağlantı tanımlı değilse motor sessizce geçmez. Ne yaptığı ortama göre değişir ve
bu ayrım bilinçlidir:

| Ortam | Supabase | `SUPABASE_DB_URL` | Sonuç |
|---|---|---|---|
| `NODE_ENV=production` | var | **yok** | `ok:false` — worker/scheduler **BAŞLAMAZ** |
| geliştirme | var | yok | yüksek sesle uyarır, backend çalışmaya **devam eder** |
| geliştirme | yok | yok | dosya modu; migration gerekmiyor |
| her ortam | — | var | migration uygulanır + şema doğrulanır; hata → `ok:false` |

`MIGRATIONS_REQUIRED=1` geliştirmede de kapıyı kapatır. Üretimde kapının kapalı
olması ayar değil, varsayılandır: aşağıdaki servislerin hepsi veritabanına YAZAR
ve doğrulanmamış bir şemaya gerçek müşteri verisi yazılmamalıdır.

```bash
npm run migrate   # aynı motoru elle çalıştırmak istersen (CI/tanı için)
```

Motor: `backend/src/migrate/` — `plan.js` (karar), `sqlScan.js` (ifade ayırıcı),
`runner.js` (uygulayıcı), `verify.js` (doğrulayıcı), `dbUrl.js` (gizlilik süzgeci).

## Motorun garantileri

Hepsi gerçek PostgreSQL 16'ya karşı `test/migrate-live.test.mjs` içinde ölçülür
(12 test); açılış kapısının karar tablosu `test/migrate-gate.test.mjs` içinde
(7 test, veritabanı gerektirmez); statik denetimler `test/migration-safety.test.mjs`
+ `migrate-scan` + `migrate-plan` içinde (37 test).

1. **SIRA** — dosyalar numaraya göre 001 → 002 → … uygulanır; liste diskten
   okunur, hiçbir yerde elle sayılmaz.
2. **TEK KEZ** — başarıyla uygulanmış dosya bir daha çalışmaz. Defter:
   `public.schema_migrations` (ad, sıra, zaman, süre, uygulayan kopya, sha256 mührü).
3. **ÇİFTE YOK** — iki (ya da beş) backend aynı anda açılsa bile migration bir kez
   uygulanır. PostgreSQL advisory lock kullanılır; kilit veritabanında tutulduğu
   için kaç sunucuda kaç kopya olduğundan bağımsızdır ve süreç çökerse kendiliğinden
   serbest kalır.
4. **YARIM YOK** — her dosya ve onun defter kaydı TEK transaction'dadır. Hata
   hâlinde PostgreSQL tamamını geri alır; yarım tablo/trigger kalmaz. Sonraki
   çalıştırma kaldığı yerden devam eder, öncekileri tekrarlamaz.
5. **BÜTÜNLÜK** — uygulanmış bir dosya sonradan değiştirilir, adı değişir veya
   silinirse sistem DURUR ve hiçbir şey uygulamaz. Araya geriye dönük numara
   sokulması da reddedilir. Kurala uymayan bir dosya adı (ör. `005a_x.sql`)
   veritabanına bağlanılmadan önce yakalanır.
6. **GİZLİLİK** — bağlantı dizesi, parola ve sunucu adresi ne loga ne hata
   metnine yazılır; sürücü hatalarındaki adres/parola parçaları da temizlenir.
7. **FAIL-CLOSED** — hata hâlinde (ve üretimde bağlantı eksikse) `server.js`
   worker ve scheduler'ları BAŞLATMAZ. HTTP dinleyici bilerek ayakta kalır ki
   durum `/api/health` → `migration` alanından okunabilsin (bu alan gizli bilgi
   taşımaz). Kapının kendisi `test/migrate-gate.test.mjs` ile ölçülür — bu
   testler, dokümanın kodla çeliştiği bir kez fark edildiği için yazıldı.
8. **DOĞRULAMA** — uygulamadan sonra tablolar, RLS ve trigger'lar gerçekten
   var mı diye `pg_class`/`pg_trigger` okunur. Beklenti listesi migration
   dosyalarının kendisinden TÜRETİLİR, elle yazılmaz.

### Sıra ve transaction hakkında iki not

- 003 ve 004, `bulletin_snapshots` değişmezlik trigger'ını (`trg_snapshot_no_update`)
  yalnız kendi transaction'ları içinde geçici kapatır ve COMMIT'ten önce yeniden
  açar. DELETE trigger'ına hiç dokunulmaz; snapshot içeriği/hash'i değişmez.
- 001–005 dosyaları kendi `BEGIN;`/`COMMIT;` satırlarını taşır. Motor bu ÜST
  SEVİYE transaction ifadelerini kendi transaction'ına devralır — dosya baytları
  değişmez (mühürler geçerli kalır), PL/pgSQL gövdelerindeki `BEGIN ... END`
  bloklarına dokunulmaz. `005`'in içindeki `\set` gibi psql komutları da SQL
  olmadıkları için sürücüye gönderilmez; atlandıkları loga satır numarasıyla yazılır.

### Şema elle uygulanmışsa (bir kereye mahsus devralma)

Defter yokken şemada migration nesneleri zaten varsa — yani dosyalar daha önce
SQL Editor'a elle yapıştırılmışsa — motor altı dosyayı da "bekleyen" görür ve
yeniden çalıştırır. Bu güvenlidir: tablo/index/trigger tanımları `if not exists` /
`create or replace` ile korunur, veri güncelleyen iki ifade (003, 004)
`where provenance_type is null` ile sınırlıdır. Bu VARSAYILMAZ, ölçülür: canlı
testte üretimdeki sıra birebir kurulup kilitli `bulletin_snapshots` ve `bulletins`
satırlarının md5 parmak izi öncesi/sonrası karşılaştırılır — **tek bayt değişmez**.
Motor bu anı loga da yazar; sessizce yapmaz.

## Ne kurar?

| Tablo | Amaç |
|---|---|
| `bulletins` | Hafta üst kaydı: durum (draft/active/locked/completed/cancelled), `first_match_start_at`, `freeze_at` (ilk maç − 5 dk), kilit/tamamlanma zamanları |
| `bulletin_matches` | 15 maçın kimlikleri (sıra, takımlar, lig, resmî saat, dış kaynak id'leri) |
| `bulletin_data_observations` | Kilide kadar toplanan zaman serisi (oranlar, ihtimaller, veri kalitesi; oynanma yüzdesi kaynak sunmuyorsa NULL) |
| `bulletin_snapshots` | Kilit anındaki **tek** resmî snapshot: `snapshot_payload` (JSONB) + doğrulama hash'i. UPDATE/DELETE trigger'la yasak |
| `match_official_results` | Yalnız resmî **90 dk 1/X/2** + tam maç skoru (ilk yarı alanı yok). Düzeltmeler `correction_version` + tarihçeyle |
| `snapshot_evaluations` | Sonuçlar geldikten sonra kilitli tahmin karşılaştırması; `effective_from_round_id` = öğrenme sınırı (data leakage engeli) |
| `snapshot_audit_log` | Append-only denetim: her kilit, sonuç, düzeltme, reddedilen değişiklik |
| `sportoto_history_rounds` *(005)* | Resmî geçmiş bülten haftaları; `provenance_type='official_result_history'` CHECK ile zorlanır |
| `sportoto_history_matches` *(005)* | Geçmiş maçlar (sıra 1-15, resmî 90 dk 1/X/2). PK `(round_id, position)`, position/result CHECK, FK |
| `sportoto_history_audit` *(005)* | Geçmiş arşiv düzeltme/çakışma denetim izi |
| `sportoto_history_checkpoint` *(005)* | İçe aktarım checkpoint'i (kaldığı yerden devam) |
| `bulletin_data_observations` *(005 kolonları)* | + `kind` / `usable_for_prediction` / `first_observed_late` (oynanma gözlem semantiği) |

| `user_sessions`, `user_devices`, `user_points`, … *(006)* | Oturum/cihaz güvenliği + puan/başarı tabloları (8 tablo, hepsinde RLS) |

**005 doğrulaması (gerçek PostgreSQL 16'da yapıldı):** 001→005 sıralı temiz geçiş;
005 ikinci kez çalıştırıldığında hatasız (idempotent); yanlış provenance
(`legacy_backfill`), 16. sıra, ham `0` sonucu ve mükerrer `(round_id,position)`
INSERT'leri kısıtlarca REDDEDİLDİ; 005 SONRASI `bulletin_snapshots` UPDATE/DELETE
hâlâ `IMMUTABLE_SNAPSHOT` trigger'ına takılıyor. Yukarıdaki SALT-OKUNUR trigger
sorgusu 005 sonrası da iki satır ve `tgenabled='O'` döndürür (kanıtlandı).
Not: 005 yalnız EKLER — hiçbir `DELETE`/`DROP`/`TRUNCATE` içermez, kilitli
snapshot payload/hash'ine dokunmaz, 001-004 provenance/immutability kurallarını
değiştirmez. Supabase'e uygulanana dek geçmiş arşiv otomatik olarak dosya
deposunda (`backend/data/history/`) birikir; migration sonrası ilk yeniden
başlatmada Supabase'e geçilir ve arşiv idempotent biçimde yeniden doldurulur.

Tüm zamanlar **UTC** saklanır (Europe/Istanbul yalnız gösterim). RLS açık ve policy
tanımlanmadığı için tablolara yalnız backend'in `SUPABASE_SECRET_KEY` (service role)
istemcisi erişebilir.
