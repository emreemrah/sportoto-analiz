# Güncel Çalışma Durumu

- Proje: sportoto-analiz-karar-motoru-test
- Proje kimliği: b8a31f25-5aed-40b4-ac7f-1fc81f1419ed
- Durum: IN_PROGRESS (olgun ürün — Flutter uygulaması + Node backend canlı)
- Son doğrulanmış commit: 5437c57 (yayın paketine INTERNET izni) —
  backend 1126/0 · Flutter 920/0 · analyze temiz.
- Bugün (19 Ağustos) bitenler — hepsi commit'li:
  1. Ertelenen maç senaryosu önlem paketi (a0f4382) — 4 yüzey: bildirim,
     hafta durumu sebebi, ikramiye açıklaması, /yonetim bekleyen iş kartı.
  2. Otomatik noter: resmî API'nin `noterWin` alanı keşfedildi ve bağlandı
     (3d11f6f). 1. Hafta kura=1 ile 15/15 kesinleşti; üretimde doğrulandı.
  3. Ana sayfa: noterle kesinleşen maç "Yaklaşan"dan düşüyor (5388d9b).
  4. Kupon gerçeği: 27 Ağustos'ta maç oynanınca gelen skor kurayı EZEMEZ —
     3 katman koruma (760aea7).
  5. Hafta Kapanışı 15/15 sayıyor + ikramiye devir satırı resmî yazımla:
     "OLMADIĞINDAN 30.149.380,57 ₺ önümüzdeki haftaya devretti" (216edf4).
  6. Release APK'da INTERNET izni yoktu → telefonda "veriler gelmiyor";
     manifest düzeltildi + bekçi test (5437c57). Masaüstündeki
     sportoto-analiz-19agu.apk İZİNLİ yeni derlemeyle güncellendi.
- Yayın durumu: 216edf4'e kadar origin/main'de ve Render'da doğrulandı.
  5437c57 (+bu kayıt commit'i) HENÜZ PUSH'LANMADI — kullanıcı onayı bekliyor
  (üretimi etkilemez, Flutter tarafı; depo eşitliği için gönderilmeli).

## YARIN İLK İŞ
1. Kullanıcı masaüstündeki YENİ sportoto-analiz-19agu.apk'yı telefona kurup
   veri geliyor mu doğrulayacak (dünkü kurulum izinsiz eski paketti).
   Veri gelmezse: ekrandaki hata metnini al; Render soğuk açılışını (ilk
   açılışta ~60 sn) hesaba kat.
2. Push onayı al → 5437c57 + kayıt commit'ini gönder.

## Takvimli işler
- 21 Ağustos ~18:25: 2. Hafta mührü — Radar 5 süzgeç kırılımları ilk kez
  gerçek veriyle dolacak (1. Hafta boş mühürlüydü, TÜREV görünümle çalışıyor).
- 27 Ağustos gecesi: Celta Vigo – Osasuna GERÇEKTEN oynanacak — kupon
  gerçeği korumasının saha sınavı. Beklenti: 1. Hafta kaydı ve ekranı
  KILINI KIPIRDATMAZ (skor kurayı ezemez; testli ama sahada da bakılmalı).
- Küçük/eski: /yonetim panelinin gözle doğrulaması (testler yeşil).

## Engel (Project Worker güvenilir doğrulama kapısı)
Başlangıç çizgisi kurulmadı — eksikler:
* FEATURES.json boş (özellik kataloğu: ID + kabul ölçütleri +
  verification_task_id), `requirements_locked` false, `ui_project` null.
* VERIFICATION_PLAN.json `commands` boş (gerçekler: backend `npm test` ·
  flutter `flutter analyze` + `flutter test`).
KESİN ADIM: katalog kullanıcı onayıyla doldurulup kilitlenecek — kilit geri
dönüşsüz olduğundan onaysız kilitlenmeyecek.

- Güncelleme: 2026-08-19 (gece kapanışı)
