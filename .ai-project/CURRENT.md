# Güncel Çalışma Durumu

- Proje: sportoto-analiz-karar-motoru-test
- Proje kimliği: b8a31f25-5aed-40b4-ac7f-1fc81f1419ed
- Durum: IN_PROGRESS (olgun ürün — Flutter uygulaması + Node backend canlı)
- Son doğrulanmış commit: a630634 — backend 1128 geçti/0 hata ·
  Flutter 926/0 · analyze temiz.
- Bugün (21 Ağustos, gece) bitenler — hepsi commit'li, PUSH BEKLİYOR:
  1. Soğuk açılış paketi (1630826): telefonda "sunucuya bir daha bağlanmadı"
     bildirimi. Ölçüldü: uyanış ~90 sn (ilk evre yanıtsız → Dio zaman aşımı,
     sonra 503, sonra 200). Dio taşıma hataları ApiException'a sarıldı
     (zamanAsimi/gecici), zaman aşımı da "Sunucu uyanıyor" sayılıyor,
     HazirlaniyorState kendi 15 sn zamanlayıcısını taşıyor — ana sayfada da
     otomatik yeniden deneme var artık.
  2. Radar 5 rozet hizası (278ca8d): '2' yüzdesi 360-400dp'de alt satıra
     kayıyordu (Wrap). Taşmaz düzen her genişlikte; 390px gerileme testi.
  3. Radar 5 sezon devri (1385498, BACKEND): "1. Hafta sonuçları yansımamış"
     bildirimi. Sezon statik depodan çözülünce GEÇEN sezona kayıyor, arşivdeki
     1528 (2026/2027) süzgece takılıyordu. Sezon artık önce arşiv bülteninden
     çözülüyor; /position-dna + /position-matches aynı çözüm. Üretimde ölçülen
     belirti: cut.season=2025/2026, archiveMatches=0 (arşivde 1528 15/15 dolu).
  4. İzin bekçisi hizası (a630634): 5437c57'nin INTERNET ekine rağmen eski
     bekçi "yalnız bildirim" bekliyordu — tam paketteki tek kırmızı kapandı.
- Masaüstünde YENİ APK: sportoto-analiz-21agu.apk (1+2 düzeltmelerini içerir,
  aapt ile INTERNET doğrulandı). 19agu paketi eski — kullanıcı 21agu'yu kurmalı.
- Yayın durumu: KULLANICI ONAYIYLA PUSH + DEPLOY YAPILDI (21 Ağu gece ~00:40,
  216edf4..62de166). Üretimde doğrulandı: /api/radar/position-dna →
  cut.season=2026/2027, archiveRounds=["1528"], totalMatches=15; 1. sıra =
  Galatasaray–Çorum FK 2-2 → X %100, n=1, "Yalnız bilgi" katmanı (dürüst).
  /position-matches?position=1 listesi de aynı kümeyi veriyor. Akşamki
  2. Hafta mührü artık DOĞRU sezon tabanıyla donacak.

## BUGÜN İLK İŞ (21 Ağustos)
1. Kullanıcı masaüstündeki sportoto-analiz-21agu.apk'yı telefona kursun:
   - Soğuk açılışta artık "Sunucu uyanıyor" + kendiliğinden toparlama beklenir
     (~1-1,5 dk içinde veri gelmeli, elle dokunmadan).
   - Radar 5'te '2' rozeti alta kaymamalı.
   - Radar 5'te 1. Hafta yüzdeleri ESKİ APK'da da görünür (sunucu düzeltmesi
     yayında) — ekran başına n=1 "yalnız bilgi" beklenir.

## Takvimli işler
- 21 Ağustos 18:25 UTC: 2. Hafta mührü — süzgeç kırılımları ilk kez gerçek
  veriyle dolacak. Sezon düzeltmesi yayındaysa taban = 2026/2027 (yalnız
  1. Hafta, n=1, "yalnız bilgi" katmanı — DÜRÜST davranış; sezonlar karışmaz).
- 27 Ağustos gecesi: Celta Vigo – Osasuna gerçekten oynanacak — kupon gerçeği
  korumasının saha sınavı (skor kurayı ezemez; 1. Hafta kaydı kıpırdamamalı).
- Küçük/eski: /yonetim panelinin gözle doğrulaması (testler yeşil).

## Engel (Project Worker güvenilir doğrulama kapısı)
Başlangıç çizgisi kurulmadı — eksikler:
* FEATURES.json boş (özellik kataloğu: ID + kabul ölçütleri +
  verification_task_id), `requirements_locked` false, `ui_project` null.
* VERIFICATION_PLAN.json `commands` boş (gerçekler: backend `npm test` ·
  flutter `flutter analyze` + `flutter test`).
KESİN ADIM: katalog kullanıcı onayıyla doldurulup kilitlenecek — kilit geri
dönüşsüz olduğundan onaysız kilitlenmeyecek.

- Güncelleme: 2026-08-21 (gece ~00:30)
