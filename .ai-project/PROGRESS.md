# İlerleme Günlüğü

- 2026-08-19T16:24:19.8619753Z: Proje süreklilik sistemi otomatik oluşturuldu. Uygulama özelliği henüz doğrulanmadı.
- 2026-08-19T16:24:20.0932474Z: Normal etkileşimli Claude oturumunda proje kaydedildi.
- 2026-08-19: Oturum açılışında durum tespiti yapıldı. Süreklilik sistemi bugün
  kurulduğu için boş geliyordu; CURRENT.md depo geçmişinden (git log, tasks/
  todo.md, tasks/denetim-raporu.md) gerçek duruma çekildi. Ürün kodunda
  değişiklik yapılmadı. Açık iki iş takvime bağlı: 1. Hafta 15. maçın noter
  kararı ve 21 Ağustos'taki 2. Hafta mührü.
- 2026-08-19: Ertelenen maç senaryosu için kalıcı önlem paketi bitirildi ve
  doğrulandı (bildirim + hafta durumu sebebi + panel bekleyen iş kartı +
  isOfficial/viaNotary düzeltmesi). Backend 1117/0, Flutter 914/0, analyze
  temiz. Ayrıntı: tasks/todo.md inceleme bölümü.
- 2026-08-19 (gece): Noter kararı gerçek hayatta açıklandı (kura: 1). Resmî
  webapi'nin `noterWin` alanı keşfedildi ve bağlandı: sportoto.js artık
  skorsuz maçta kararı okuyor (viaNotary), worker arşive otomatik işliyor
  (notary_decision, idempotent, operatör kaydını ezmez). 1. Hafta 15/15
  kesinleşti; emülatörde "Sonuçlar açıklandı" + ikramiye tablosu görüldü.
  Commit: 3d11f6f. Backend 1124/0, yeni 7 test.
- 2026-08-19 (gece): Project Worker başlangıç çizgisi eksikleri CURRENT.md'ye
  kaydedildi (FEATURES kataloğu boş, requirements_locked=false, ui_project
  null, VERIFICATION_PLAN komutsuz). Kesin sonraki adım: katalog kullanıcı
  onayıyla doldurulup kilitlenecek; kilit geri dönüşsüz olduğundan onaysız
  kilitlenmeyecek.
- 2026-08-19 (gece 2): Kullanıcı bulgusu — noterle kesinleşen 1. Hafta maçı
  ana sayfada "yaklaşan" duruyordu. yaklasanMaclar'a "resmî sonucu olan maç
  yaklaşan değildir" kuralı eklendi (isOfficial, viaNotary dahil). Emülatörde
  doğrulandı; 916 Flutter testi yeşil. Commit: (fix anasayfa).
- 2026-08-19 (gece 3): Kupon gerçeği sabitlendi — kura kararlı maç 27
  Ağustos'ta oynandığında skor kurayı EZEMEZ (3 katman: sportoto.js eşleme,
  arşiv ingest koruması, /api/history koşulsuz noter katmanı). noterWin alan
  davranışı 30 satırla ölçüldü (null/0-dolgu/karar ayrımı). Backend 1126/0.
- 2026-08-19 (gece 4): Kullanıcı onayıyla push + Render deploy. Üretimde
  doğrulandı: /api/history/1528 → 15/15, fullyResolved, 15. maç result=1
  viaNotary, ikramiye tablosu dolu. 27 Ağustos koruması (kupon gerçeği)
  artık yayında.
- 2026-08-19 (gece 5): Emülatör turunda iki bulgu kapatıldı — Hafta Kapanışı
  noter haftasını 14/15 sayıyordu (son resmî-tanım da viaNotary'ye hizalandı)
  ve ikramiye devir satırı tutarsızdı (resmî yazımla "OLMADIĞINDAN … ₺
  önümüzdeki haftaya devretti"). Flutter 919/0. Push bekliyor.
- 2026-08-19 (gece 6, kapanış): Kullanıcı release APK'yı telefona kurdu, veri
  gelmedi. aapt ile ölçüldü: pakette INTERNET izni YOKTU (yalnız debug
  manifest'indeydi — emülatörde bu yüzden görünmedi). Manifest düzeltildi,
  bekçi test eklendi (manifest_izin_test), APK yeniden derlendi ve
  masaüstündeki kopya İZİNLİ paketle güncellendi (aapt doğrulamalı).
  Commit: 5437c57 (push onayı yarına). YARIN İLK İŞ: kullanıcı yeni APK'yı
  kurup telefonda veri akışını doğrulayacak. Flutter 920/0.
