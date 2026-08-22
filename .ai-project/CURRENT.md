# Güncel Çalışma Durumu

## 22 AĞUSTOS — ACİL: üretimde bülten üretilemiyordu (düzeltildi, YAYINDA DEĞİL)
Kullanıcı bildirimi: "uygulamaya veri gelmiyor". Sebep uygulamada değil, canlı
sunucuda: refresh her soğuk açılışta çöküyor, bülten hiç kaydedilmiyordu.
- Belirti (ölçüldü): /api/health hasData=false · updatedAt=null (15+ dk sabit),
  /api/bulletin 503. /api/rounds 200 (currentRoundId=1529) — sunucu ayaktaydı,
  çöken şey bültenin kendisiydi.
- Kök neden: refresh.js buildRadar süzgeci `m.analysis.surpriseScore` okuyordu.
  Başlamış ama mührü olmayan maç dalı (geriye dönük tahmin kapısı) bilerek
  `analysis: null` yazar → TypeError → refreshAll `save('bulletin')` satırına
  HİÇ ULAŞMIYORDU. Yerelde dolu önbellek yüzünden görünmüyordu (her başlamış
  maç donmuş snapshot yolundan geçiyor); Render diski geçici olduğu için
  üretimde haftanın ilk maçından sonraki HER uyanışta çöküyordu.
- Düzeltme: `m.analysis?.surpriseScore` — backend/src/refresh.js, tek satır.
- Kanıt: CACHE_DIR ile boş önbellekte önce exit 1 (birebir üretim), yamadan
  sonra exit 0 · bulletin.json 1,03 MB · round 1529 · eşleşen 14/15 · radar
  11 maç (3 başlamış-mühürsüz maç doğru şekilde dışarıda).
  Yeni gerileme testi: backend/test/radar-bos-analiz.test.mjs (3 test).
  Tam paket: 1163 test · 1131 geçti · 0 hata · 32 atlandı.
- SONRAKİ KESİN ADIM: kullanıcı onayıyla push + Render deploy. Onaya kadar
  uygulama BOŞ KALIR — düzeltme yalnız yerelde duruyor.


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
- Yayın durumu: iki tur kullanıcı onaylı push + deploy (21 Ağu gece).
  Tur 1 (62de166): sezon devri düzeltmesi — 1. Hafta arşivden hesaba girdi.
  Tur 2 (acb7fc9+e0e5635): KULLANICI KARARI "tüm sezonlar olacak" — sezon
  süzgeci kaldırıldı (1 Ağu kararının yerine geçer; DECISIONS.md'de).
  Üretimde doğrulandı: position-dna totalMatches=59, totalBulletins=4;
  1. sıra n=4 → X %75 · 1 %25; /position-matches?position=1 listesi
  1. Hafta (GS–Çorum 2-2 X) + 53. + 52. + 51. Hafta'yı birlikte veriyor.
  Akşamki 2. Hafta mührü 4 haftalık tabanla donacak.

## BUGÜN İLK İŞ (21 Ağustos)
1. Kullanıcı masaüstündeki sportoto-analiz-21agu.apk'yı telefona kursun:
   - Soğuk açılışta artık "Sunucu uyanıyor" + kendiliğinden toparlama beklenir
     (~1-1,5 dk içinde veri gelmeli, elle dokunmadan).
   - Radar 5'te '2' rozeti alta kaymamalı.
   - Radar 5'te 1. Hafta + 51-53. Hafta yüzdeleri ESKİ APK'da da görünür
     (sunucu düzeltmesi yayında) — sıra başına n=4 beklenir.

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
