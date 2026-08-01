# RAPOR — Kupon Merkezi (sıfırdan, uçtan uca)

Tarih: 2026-07-24 · Testler: uygulama **54/54** ✅ · backend **276/276** ✅ · web export ✅

## 1. Yapılanlar

**Kupon Merkezi (alt bar → Kuponlarım):** hafta gezmeli kupon listesi; her kuponda ad,
oluşturma/son güncelleme zamanı, kolon, maliyet (yalnız gerçek fiyat verisiyle), durum,
dereceli rozeti; Düzenle · Kopyala · Dereceli Yap · Sonuç · Paylaş · Oynadım (beyan) · Sil.
Kuponlar birbirinden tamamen bağımsız (kopya dahil — derin kopya, yeni kimlik).

**Kupon Editörü:** resmi bültendeki 15 maç, bülten SIRASI bozulmadan; her maçta 1/X/2
tekli-çifte-üçlü; kolon + maliyet ANLIK; maç satırında açılır "analiz detayı"
(Sistem tahmini, Radar favorisi, ihtimaller, sürpriz puanı) — teknik ayrıntı ana ekranda değil.
Kupon adı verilebilir. 2500 kolon sınırı aşılırsa kırmızı uyarı + kayıt engeli.

**Analizden aktarım (Sistemden / Radardan):** mevcut seçim ASLA sessizce silinmez/değişmez —
önce fark listesi ("5. maç: X → 1-X, mevcut değişecek / boş dolduruluyor") gösterilir,
son karar kullanıcının. Radar aktarımı favori + (ihtimaller yakınsa) alternatifle çifte önerir.

**Akıllı Kupon:** bütçe (fiyat verisi varsa TL, yoksa kolon cinsinden) + hedef 12/13/14/15.
Sadece "en zor maça çifte" değil; birlikte değerlendirilen sinyaller: ihtimal yakınlığı,
sürpriz riski, Master↔Radar çatışması, veri yeterliliği (dataQuality), güçlü aday, her
işaretin kolon çarpanı maliyeti. Hedef düştükçe kupon daralır (testli). Her maç için sade
Türkçe gerekçe ("çifte yapıldı — ihtimaller çok yakın · Master ile Radar farklı yönde").
Kapsama puanı gösterilir ama her yerde "kesin kazanma ihtimali DEĞİLDİR" notuyla.
2500 sınırı hiçbir durumda aşılmaz (testli). Önce taslak+açıklama, onayla uygulanır.

**Kalıcılık:** web localStorage + telefon AsyncStorage (kapat-aç → geri yükleme);
girişli kullanıcıda mevcut hesap altyapısı (/api/coupons — Supabase hesabına bağlı,
yalnız sahibi görür). Kayıt hatasında kupon yerelde güvende + sarı banner + Tekrar Dene.

**Değerlendirme:** kilit (ilk maç −5 dk) sonrası final versiyon DONAR; kilitli/geçmiş
haftaya kupon AÇILAMAZ → geriye dönük başarı üretilemez. Yalnız resmi 90 dk 1/X/2
(ilk yarı hiçbir hesapta yok). ✅/❌/⏳, 15-14-13-12 barajı (tüm sonuçlar gelmeden
kesinleşmez), "Nereden Yattım?": yanlış maçta senin tercihin + Sistem'in kilit anı kaydı
(tutmuş mu/yatmış mı) + Radar kaydı + skor.

**Canlı Bülten bağı:** satırda Sen/Sistem; canlıda geçici, bitende kesin işaret; filtreler
Tümü · Canlı · Biten · Kuponum · Kupon Riskte · Sistem Riskte; Kuponum kupon yokken de
görünür ve boş listede "+ Kupon Oluştur" butonu editöre götürür.

**Paylaşım:** "SPOR TOTO MASTER ANALİZ" başlıklı görsel kart; sezon, hafta, 15 seçim,
kolon, istenirse tutar (yalnız gerçek fiyatla); telefonda PNG (view-shot+paylaşım menüsü),
web'de canvas PNG (paylaş/indir). Hassas veri (telefon/e-posta/token/bakiye) asla girmez
(testli). "Kesin sonuç veya kazanç vaadi değildir." her görselde. "Oynandı" yalnız
kullanıcı beyanı olarak, "operatör doğrulaması yok" etiketiyle. UI metinlerinde
"bahis/bahis sitesi/bookmaker" ifadesi yok.

**Fiyat dürüstlüğü:** birim kolon bedeli koddan tamamen çıkarıldı. Bedel yalnız
`backend/data/coupon-pricing.json` → `{ "unitPrice": 10, "source": "…", "updatedAt": "…" }`
kaydından gelir ve ekranda kaynağı+tarihiyle gösterilir. Dosya yoksa "birim bedel verisi
yok — maliyet gösterilmiyor" denir; bütçe kolon cinsinden çalışır.

## 2. Kaldırılan eski Kupon parçaları
`CouponsScreen` · `CouponBuilderScreen` · `CouponCreateScreen` · `CouponScreen` (zaten
bağlantısızdı) · eski `couponStore.js` · `hooks/useCoupon.js` · `services/couponService.js`
(BulletinDetail'deki tek kullanım yerinde yönlendirme kartıyla değiştirildi) — dosyalar
cihazda `_to_delete/` klasörüne taşındı. Eski yerel kayıtlar (eski anahtar) ve sunucudaki
eski kayıtlar SİLİNMEDİ ama yeni sistem onları HİÇ okumaz (schema:2 filtresi) — eski
kuponlar yeni başarı sistemine karışamaz.

## 3. Korunanlar (dokunulmadı)
Bülten + bülten arşivi, Master Analiz, Radar (1-5 + Master), mühürlü analizler/arşiv,
Sistem Karnesi, resmi sonuç sistemi, profil/giriş, İstatistik sekmesi.
`SystemDashboardScreen` ("Analiz Detayı (Demo)") etiketli demo ekranı ve verisi ayrı
durur — gerçek kupon sistemine bağlı değildir.

## 4. Bilinen gerçek veri eksikleri (dürüstçe)
- **Birim kolon bedeli:** resmi API'de bulunamadı → coupon-pricing.json'ı resmi bedelle
  sen doldurana kadar maliyet gösterilmez.
- **Radar kaydı geçmiş haftalarda yok:** Radar sütunu yalnız güncel bültende dolu;
  geçmişte "Radar kaydı yok" denir (mühürlü arşive radar tahmini yazılmıyor — istenirse
  ayrı iş olarak eklenir).
- **Oynanma yüzdeleri / oran hareketi:** Akıllı Kupon'a sinyal olarak bağlanmadı (bu
  veriler radar iç katmanında; maç objesinde sade alan yok). Mevcut sinyaller: ihtimaller,
  sürpriz, Master↔Radar çatışması, veri kalitesi. İstenirse sonraki adım.
- **Operatör doğrulaması:** entegrasyon yok → "oynandı" yalnız kullanıcı beyanı.
