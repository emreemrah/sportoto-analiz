# Otomatik Migration — Eksik Olan Tek Ayar

**Durum tarihi:** 25 Temmuz 2026
**İlgili madde:** Yayın kontrol listesi B12 / E5

---

## Kısaca

Otomatik migration düzeni kuruldu, senin makinende çalıştırıldı ve ölçüldü.
Artık SQL kopyalamıyorsun, dosya seçmiyorsun, her sürümde komut çalıştırmıyorsun;
müşteri de bu süreçlerin hiçbirini görmüyor.

Geriye **tek bir ayar** kaldı ve bu ayar bende değil, sende: backend ortamına
**`SUPABASE_DB_URL`** yazılması. Bu bir SQL kopyalama işi değil, ömründe bir kez
yapılan bir bağlantı tanımı. Tanımlandığı andan sonra bekleyen bütün migration'lar
backend her açıldığında kendiliğinden uygulanır.

Bu satırı senin yapıştırman gerekiyor çünkü dizenin içinde veritabanı parolan var.
Ben senin parolanı okumam, taşımam ve hiçbir yere yazmam — bu bilinçli bir sınır,
teknik bir engel değil. Yapıştırma yerini önceden hazırladım: `backend/.env`
dosyasının sonunda açıklamalı, yorumlanmış bir satır seni bekliyor.

---

## Ne kopyalanacak, nereden

Supabase panelinde: **Project Settings → Database → Connection string**. Orada
iki tür bağlantı sunulur ve doğru olanı seçmek önemli:

| Bağlantı türü | Port | Otomatik migration için |
|---|---|---|
| **Session / Direct connection** | **5432** | ✅ **Bunu al** |
| Transaction pooler | 6543 | ❌ Olmaz — DDL bu modda çalışmaz |

Transaction pooler, her ifadeyi ayrı bir bağlantıya dağıtır. Migration motorunun
çalışması için tek bir oturumun hem advisory lock'u tutması hem transaction'ı
açık tutması gerekir; pooler bunu yapamaz. Yanlış olanı seçersen motor sessizce
bozuk çalışmaz — bağlanır, işe yaramaz ve durumu bildirir.

Kopyaladığın dizeyi `backend/.env` dosyasının en sonundaki

```
# SUPABASE_DB_URL=
```

satırının başındaki `#` işaretini kaldırıp `=` işaretinden sonra yapıştıracaksın.
Dosyanın geri kalanına dokunmana gerek yok.

---

## Neden mevcut Supabase anahtarı yetmiyor

Bu bir yetki sorunu değil; iki farklı protokolden söz ediyoruz.

Uygulamanın şu an kullandığı `SUPABASE_URL` + `SUPABASE_SECRET_KEY` ikilisi
**PostgREST** ile konuşur. PostgREST, veritabanının üzerine kurulmuş bir HTTP
katmanıdır: tabloları okur, satır ekler, hazır fonksiyon (RPC) çağırır. Yaptığı
iş budur ve bunu iyi yapar.

Ama migration'ın ihtiyacı olan şey `CREATE TABLE`, `CREATE TRIGGER`,
`ALTER TABLE`, `ENABLE ROW LEVEL SECURITY` gibi **şema değiştiren** ifadelerdir.
Bu ifadeler PostgREST protokolünde **ifade edilemez** — anahtarı "yetkilendirsen"
bile gönderecek bir kanal yok. Bu yüzden doğrudan PostgreSQL bağlantısı şart.
Panelde açıp kapatabileceğin bir ayar değil, protokolün sınırı.

---

## Tanımlanana kadar ne oluyor

Motor bu durumu sessizce geçmiyor; ortama göre farklı davranıyor ve bu ayrım
bilinçli:

| Ortam | Sonuç |
|---|---|
| **Üretim** (`NODE_ENV=production`) | Backend **iş yapmaz**: worker ve scheduler'lar başlamaz. HTTP dinleyici bilerek ayakta kalır ki durum `/api/health` üzerinden okunabilsin |
| Geliştirme (senin makinen) | Yüksek sesle uyarır, çalışmaya devam eder. Katı davranış istersen `MIGRATIONS_REQUIRED=1` |

Üretimde kapının kapalı olması bir ayar değil, varsayılan. Sebebi şu: arka plan
servislerinin hepsi veritabanına **yazar**. Şemanın güncel olduğu doğrulanmadan
yazmak, doğrulanmamış bir şemaya gerçek müşteri verisi yazmak demektir.

Bu kural senin makinende ölçüldü — varsayılmadı. Üretim modunda backend açıldı ve
log şunu yazdı: `Veritabanı şeması hazır değil — arka plan servisleri
BAŞLATILMADI.` Aynı çalıştırmada `/api/health` uç noktası `migration.ok = false`
döndürdü ve bu cevapta hiçbir gizli bilgi yoktu.

---

## Tanımlandıktan sonra ne olacak

Backend'in bir sonraki açılışında motor sırayla 001'den başlayıp bekleyen bütün
dosyaları uygular, sonra tabloların, trigger'ların ve RLS kurallarının gerçekten
oluştuğunu `pg_class` / `pg_trigger` okuyarak doğrular. Sonrasında her sürümde
aynı şey kendiliğinden olur; senin yapman gereken bir şey kalmaz.

**006 hakkında:** 006'yı 25.07.2026'da SQL Editor'da elle çalıştırmıştın, yani
tablolar veritabanında zaten var. Motor defterini (`public.schema_migrations`)
boş göreceği için altı dosyayı da "bekleyen" sayıp yeniden çalıştıracak. Bu
güvenli: tablo, index ve trigger tanımları `if not exists` / `create or replace`
ile korunuyor, veri güncelleyen iki ifade `where provenance_type is null` ile
sınırlı. Bu varsayım değil, ölçüm: canlı testte üretimdeki sıra birebir kurulup
kilitli `bulletin_snapshots` ve `bulletins` satırlarının md5 parmak izi öncesi ve
sonrası karşılaştırılıyor — **tek bayt değişmiyor**. Motor bu devralma anını loga
da yazıyor, sessizce yapmıyor.

---

## Bağlantının kendisi nasıl korunuyor

Dize yalnız `backend/.env` içinde durur. Koda, mobil pakete, git deposuna ve
loglara yazılmaz. Motor hata mesajlarını da süzgeçten geçirir: sürücüden gelen
hatalardaki sunucu adresi ve parola parçaları temizlenir. `/api/health` yalnız
durum bilgisi döndürür — bağlantı dizesi, proje adresi veya anahtar taşımaz.
Bunların hepsi testle sabitlenmiştir; doğru davrandığına güvenilmiyor, ölçülüyor.
