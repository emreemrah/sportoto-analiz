# Supabase Anahtar Yenileme — adım adım

**Neden:** Veritabanı parolası ve secret key bir süre korumasız bir yedekte
durdu. Sızmış olsun ya da olmasın, sızmış varsayılır — yenilemenin maliyeti
5 dakika, yenilememenin maliyeti veritabanının tamamı.

**Bu işlemi senden başkası yapamaz:** panele senin hesabınla girilir. Ben
işlemi yapamam; yapabildiğim, sonrasında "bozdum mu?" sorusunu cevaplayan
doğrulamayı hazırlamak — o hazır (`scripts/anahtar-dogrula.mjs`).

> **EN ÖNEMLİ KURAL:** Yeni anahtar doğrulanmadan **eski anahtarı silme /
> devre dışı bırakma.** Aşağıdaki sıra tam da bunun için: önce yeni anahtar
> alınır, denenir, sonra eski kapatılır.

---

## 0. Öncesi — 1 dakika

Mevcut `.env` dosyasının bir kopyasını al (geri dönmen gerekirse):

```bash
cd backend && cp .env .env.yedek-$(date +%Y%m%d)
```

⚠ Bu yedek **gizli** bir dosyadır. İş bitince sil:
`rm .env.yedek-*` — bu iş zaten bir yedek yüzünden başımıza geldi.

---

## 1. Secret key'i yenile

Supabase paneli → projeyi seç → **Settings** → **API Keys**

1. `secret` (service_role) anahtarının yanındaki **Rotate / Generate new**.
2. Panel yeni anahtarı **bir kez** gösterir — hemen kopyala.
3. `backend/.env` içinde `SUPABASE_SECRET_KEY=` satırını yenisiyle değiştir.

**Eski anahtarı henüz iptal etme** (panel "revoke old" soruyorsa: hayır/sonra).

---

## 2. Veritabanı parolasını yenile

Supabase paneli → **Settings** → **Database** → **Reset database password**

- Yeni parolayı bir parola yöneticisine kaydet.
- `.env` içinde `SUPABASE_DB_URL` **varsa** parolayı orada da güncelle
  (bu proje çoğunlukla REST kullanıyor; satır yoksa yapacak bir şey yok).

---

## 3. Doğrula — bu adımı ATLAMA

```bash
cd backend && node scripts/anahtar-dogrula.mjs
```

Betik hiçbir şey yazmaz, yalnız okur. Kontrol ettikleri:

| Kontrol | Ne anlama gelir |
|---|---|
| Anahtarlar dolu ve **birbirinden farklı** | En sık hata: iki alana aynı değeri yapıştırmak |
| 8 tablonun admin ile okunması | Yeni secret key gerçekten çalışıyor |
| **RLS koruyor** (admin görüyor, anon görmüyor) | Yenileme sırasında koruma kapanmamış |
| publishable anahtar ile giriş akışı | Kullanıcılar giriş yapabilir |
| secret anahtar ile kullanıcı yönetimi | Yönetim uçları çalışır |

**Hepsi ✅ ise** → 4. adıma geç.
**Bir tanesi bile ❌ ise** → `.env`'i yedekten geri al, hatayı çöz, tekrar dene.
Eski anahtar hâlâ geçerli olduğu için sistem bu sırada çalışmaya devam eder.

> RLS satırında *"Tablo boş — bu kontrol SONUÇSUZ"* yazarsa: o tabloda henüz
> veri yok demektir, koruma **kanıtlanamamıştır**. Veri geldikten sonra
> betiği bir kez daha çalıştır.

---

## 4. Sunucuyu yeniden başlat ve tek bir gerçek deneme yap

```bash
cd backend && npm start
```

Sonra uygulamadan **bir kez giriş yap** ve **bir kupon aç**. Betik ağ
seviyesini doğrular; bu adım gerçek akışı doğrular.

---

## 5. Eski anahtarı ŞİMDİ kapat

Panel → **Settings** → **API Keys** → eski secret key → **Revoke / Delete**.

Ve `.env.yedek-*` dosyasını sil.

---

## Sonrası: eksik iki değişken

Aynı dosyada boş duran ve **güvenlik/uyum açığı** olan iki alan var:

- `MODERATOR_EMAILS` — boşken **hiç kimse moderatör değil**, oysa topluluk
  kuralları "her bildirim elle incelenir" diyor. Kendi e-postanı yaz.
- `SUPPORT_EMAIL` — boşken KVKK başvuru kanalı **fiilen yok**.

İkisi de tek satır; anahtar yenilerken aynı dosyada oldukları için birlikte
halletmek en kolayı.
