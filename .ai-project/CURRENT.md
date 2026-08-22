# Güncel Çalışma Durumu

## 22 AĞUSTOS (gece) — GÜNÜN SONU DURUMU

Gün "uygulamaya veri gelmiyor" bildirimiyle başladı; kök neden zinciri açıldı
ve altı iş kapandı. Hepsi yayında ve doğrulandı.

| İş | Durum | Kanıt |
|---|---|---|
| Bülten hiç üretilmiyordu (radar null çökmesi) | KAPANDI | üretim /api/bulletin 200 |
| Mühürlü tahminler kayboluyordu | KAPANDI | 5 maç arşivden geri yüklendi |
| Tahmin yokken sebep yazılmıyordu | KAPANDI | APK v1.0.1 |
| Kilit/başlama 3 saat geç tetikleniyordu | KAPANDI | başlamış maç 3 → 5 |
| Mühür anında sunucu uyuyordu | BEKÇİ KURULDU | cron koştu, doğrulandı |
| Geç mühür karneye giriyor mu | ZATEN KORUNUYORDU | 1529 karnede yok |

- Backend 1189 test · Flutter 930 test · ikisi de 0 hata.
- Son commit: 3b62870. main yerel = uzak.
- APK: masaüstünde sportoto-analiz-v1.0.1-arm64.apk (+arm32).

### KULLANICININ YAPACAKLARI
1. Telefondaki eski uygulamayı KALDIR, v1.0.1'i kur (imza değişti — bu son
   kaldır-kur; sonrakiler üzerine kurulur).
2. `flutter/android/masteranaliz.jks` + key.properties'i depo DIŞINA yedekle.
   Kaybolursa aynı sorun tekrarlanır.

### AÇIK TEK DOĞRULAMA (takvimli)
Bekçinin "pencere AÇIK" yolu gerçek mühür anında sınanmadı. Önümüzdeki
haftanın mühür anında GitHub Actions log'unda aranacak satır:
    [bekçi] ✅ mühür ZAMANINDA atıldı — hafta karneye girebilir.
Görülürse 3 haftadır süren karne kaybı durur (late_unverified=3).
Görülmezse bekçi işe yaramamış demektir; pencere/zamanlama yeniden ele alınır.
Ölçülen cron gecikmesi 19 dk, pencere 40 dk — pay ~21 dk. Gecikme 40 dk'yı
aşarsa pencere büyütülmeli.


## 22 AĞUSTOS (akşam) — mühür kalıcılığı YAYINDA
Kullanıcı kararı "2 ve 3'ü birlikte yap" → sonuç:
- MADDE 3 zaten kuruluydu, KOD YAZILMADI (provenance.js `late_lock`).
  Üretim kanıtı: karne [1528,1527,1526], 1529 YOK, late_unverified=3.
- MADDE 2 yapıldı ve yayında: maç öncesi mühür kalıcı arşivden (Supabase
  gözlemleri) geri yükleniyor. Üretimde 3 maç geri geldi (#1 "2", #11 "1",
  #13 "10"), hepsi mühürdeki değerin birebir aynısı; gözlem anı
  2026-08-21T16:42:30Z (maç öncesi). Yeni modül: archive/gozlemGeriYukleme.js.
  Yol boyunca çıkan tuzak: radar koruması geri yüklenen mührü genişletiyordu
  ("2" → "X2"); mühürlü kayıtlar korumanın DIŞINA alındı (radarGuards.js).
- Backend 1178 test · 0 hata. Flutter 930 test · analyze temiz.
- Commit'ler: 3a61a79 (Flutter sebep notu), f98eff5 (arşiv geri yükleme).
  Deploy 16:41:45 UTC, üretimde doğrulandı 16:43.

### SIRADAKİ İŞ (kullanıcıya soruldu, karar bekliyor)
1. Mühür anında sunucuyu dışarıdan uyandırma (cron ping). Tahminler artık
   kaybolmuyor AMA karne hâlâ hafta kaybediyor: 3 hafta late_unverified.
2. AÇIK BULGU: refresh.js:439 `started` ve ~263 `isLocked` ham `new Date`
   kullanıyor → üretimde (UTC) 3 saat GEÇ tetikleniyor; `macAniMs` dosyada
   zaten var ve başka yerlerde kullanılıyor. Etki ve sınırı PROGRESS.md'de.
   (Gözlem yazımı macAniMs kullandığı için geri yükleme sınırı SAĞLAM.)


## 22 AĞUSTOS — üretimde bülten üretilemiyordu → DÜZELTİLDİ, YAYINDA, KABUL EDİLDİ (ACCEPTED)
Kullanıcı bildirimi: "uygulamaya veri gelmiyor". Sebep uygulamada veya
kullanıcının bilgisayarında değildi (format sonrası yerel kurulum sağlamdı);
canlı sunucuda refresh her soğuk açılışta çöküyor, bülten hiç kaydedilmiyordu.
- Belirti (ölçüldü): /api/health hasData=false · updatedAt=null (15+ dk sabit),
  /api/bulletin 503. /api/rounds 200 (currentRoundId=1529) — sunucu ayaktaydı,
  çöken şey bültenin üretimiydi.
- Kök neden: refresh.js buildRadar süzgeci `m.analysis.surpriseScore` okuyordu.
  Başlamış ama mührü olmayan maç dalı (geriye dönük tahmin kapısı) bilerek
  `analysis: null` yazar → TypeError → refreshAll `save('bulletin')` satırına
  HİÇ ULAŞMIYORDU. İki koruma birbirini vurdu. Yerelde dolu önbellek yüzünden
  görünmüyordu (her başlamış maç donmuş snapshot yolundan geçiyor); Render
  diski geçici olduğu için üretimde haftanın ilk maçından (21 Ağu akşamı)
  sonraki HER uyanışta çöküyor, backoff ile tekrar deneyip yalnız FootyStats
  kotasını yakıyordu.
- Düzeltme: `m.analysis?.surpriseScore` — backend/src/refresh.js, tek satır.
- Yerel kanıt: CACHE_DIR ile boş önbellekte önce exit 1 (birebir üretim),
  yamadan sonra exit 0 · bulletin.json 1,03 MB · round 1529 · eşleşen 14/15.
  Yeni gerileme testi: backend/test/radar-bos-analiz.test.mjs (3 test).
  Tam paket: 1163 test · 1131 geçti · 0 hata · 32 atlandı.
- YAYIN: kullanıcı onayıyla push + Render deploy (commit ec14bcd).
  NOT: GitHub push'u önce GH007 (e-posta gizliliği) ile reddetti — kullanıcı
  kararıyla commit yazarı noreply adresine çevrildi ve depo-yerel
  `user.email` = 216948603+emreemrah@users.noreply.github.com yapıldı.
  Bundan sonraki commit'ler bu adresle görünür.
- ÜRETİM DOĞRULAMASI (16:04 UTC, deploy 16:03:17 · refresh 75 sn):
  /api/health durum=saglikli · hasData=true · updatedAt=2026-08-22T16:04:32Z.
  /api/bulletin 200 · 838 KB · round 1529 2026/2027 2. Hafta ·
  matchCount=15 · matched=14 · upcoming=12 · radar=11 maç ·
  analizi boş (başlamış-mühürsüz) = 3 → geriye dönük tahmin kuralı DELİNMEDİ.
  #1 Erzurumspor FK–Galatasaray başlamış, skor 0-4 görünüyor (gerçek skor var,
  uydurma tahmin yok). /api/surprise-radar · /api/rounds · /api/match/1 = 200.

- KULLANICI KABULÜ: telefonda kontrol edildi — "veri geldi, çalışıyor".
  Durum ACCEPTED. Bu iş kapandı.

## Önceki durum (21 Ağustos gecesi)
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
