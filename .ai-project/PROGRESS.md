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
- 2026-08-21 (gece): Üç telefon bildirimi kapatıldı. (1) "Sunucuya bir daha
  bağlanmadı" = Render soğuk açılışı; ölçüldü: uyanış ~90 sn (önce yanıtsız
  evre → Dio zaman aşımı ham hata basılıyordu, sonra 503; ana sayfada
  otomatik yenileme yoktu). Düzeltme: taşıma hataları ApiException'a sarıldı,
  zaman aşımı "Sunucu uyanıyor" sayılıyor, HazirlaniyorState 15 sn'de bir
  kendiliğinden deniyor (1630826). (2) Radar 5'te '2' rozeti 360-400dp'de
  alta kayıyordu — taşmaz düzen her genişlikte (278ca8d). (3) "Radar 5'e
  1. Hafta yansımamış" = sezon devri hatası: sezon statik depodan çözülüp
  GEÇEN sezona kayıyor, arşivdeki 1528 süzgece takılıyordu (üretimde ölçüldü:
  archiveMatches=0). Sezon artık önce arşiv bülteninden çözülüyor (1385498,
  gerileme testi radar5-sezon-devri.test.mjs). Ek: eski izin bekçisi INTERNET
  gerçeğine hizalandı (a630634). Backend 1128/0 · Flutter 926/0 · analyze
  temiz. Yeni APK masaüstünde: sportoto-analiz-21agu.apk (aapt doğrulamalı).
  KRİTİK: sezon düzeltmesi 21 Ağustos 18:25 UTC'deki 2. Hafta mühründen ÖNCE
  deploy edilmeli — mühür yanlış sezon tabanıyla donmasın. Push onayı bekliyor.
- 2026-08-21 (gece 2): Kullanıcı onayıyla push + Render deploy
  (216edf4..62de166). Üretimde doğrulandı: position-dna cut.season=2026/2027,
  archiveRounds=["1528"], totalMatches=15; 1. sıra GS–Çorum 2-2 → X %100 n=1
  "yalnız bilgi"; position-matches listesi aynı küme. 2. Hafta mührü (bu akşam
  18:25 UTC) doğru sezon tabanıyla donacak. Kalan: kullanıcı 21agu APK'yı
  kurup soğuk açılış toparlamasını ve rozet hizasını telefonda doğrulayacak.
- 2026-08-21 (gece 3): Kullanıcı kararı — "tüm sezonlar olacak": Radar 5
  sezon süzgeci kaldırıldı (1 Ağu kararının yerine geçer; 1525 kesimi
  seyrelmeyi zaten engelliyor). season alanı artık yalnız üst veri. Bekçi
  iki yönlü korur: 1. Hafta da geçen sezon da kaybolamaz. Backend 1128/0.
  Commit: acb7fc9 — push/deploy onayı bekliyor (mühür 18:25 UTC'den önce
  yayında olmalı ki kırılımlar 4 haftalık tabanla donsun).
- 2026-08-21 (gece 4): Kullanıcı onayıyla tur-2 push + deploy (acb7fc9,
  e0e5635). Üretimde doğrulandı (ısınma sonrası, cut.roundId=1529):
  totalMatches=59, totalBulletins=4; 1. sıra n=4 → X %75 · 1 %25; liste
  1528+1527+1526+1525'i yeniden→eskiye veriyor. Radar 5 artık tüm sezonları
  sayıyor; akşamki mühür 4 haftalık tabanla donacak. Kalan: kullanıcı 21agu
  APK'yı kurup soğuk açılış + rozet hizasını telefonda doğrulayacak.
- 2026-08-22: Kullanıcı bildirimi "uygulamaya veri gelmiyor" — ÜRETİM ARIZASI
  bulundu ve düzeltildi. Belirti: https://sportoto-analiz.onrender.com
  /api/health hasData=false · updatedAt=null (kesintisiz 15+ dk),
  /api/bulletin HTTP 503. /api/rounds sağlamdı (currentRoundId=1529), yani
  sunucu ayakta ve resmî kaynak erişilebilirdi — çöken şey bültenin kendisiydi.
  KÖK NEDEN: refresh.js buildRadar süzgeci `m.analysis.surpriseScore` diyordu.
  Başlamış ama mührü olmayan maç dalı (gecmise-donuk-tahmin kapısı) bilerek
  `analysis: null` yazar; süzgeç bunu okuyunca TypeError atıyor ve refreshAll
  `save('bulletin')` satırına HİÇ ULAŞMIYORDU. Yerelde görünmüyordu: dolu
  önbellekte her başlamış maç donmuş snapshot yolundan geçiyor, kapı hiç
  çalışmıyor. Üretimde Render diski geçici — her uyanışta önbellek boş, bu
  yüzden haftanın ilk maçı başladıktan sonraki HER soğuk açılış çöküyordu.
  ÜRETİM: CACHE_DIR ile boş önbellekte birebir üretildi
  ("[refresh] HATA: Cannot read properties of null (reading 'surpriseScore')",
  exit 1, bulletin.json yazılmadı).
  DÜZELTME: süzgeç `m.analysis?.surpriseScore` (tek satır + gerekçe yorumu).
  KANIT: aynı boş önbellek koşusu exit 0, bulletin.json 1,03 MB yazıldı,
  round 1529 · eşleşen 14/15 · radar 11 maç (3 başlamış-mühürsüz maç doğru
  şekilde radar dışı). Yeni gerileme testi test/radar-bos-analiz.test.mjs (3
  test). Tam paket: 1163 test · 1131 geçti · 0 hata · 32 atlandı.
  DURUM: IMPLEMENTED_UNVERIFIED (üretimde) — düzeltme YAYINDA DEĞİL; push +
  deploy kullanıcı onayı bekliyor. Onay gelene dek uygulama boş kalmaya
  devam eder.
- 2026-08-22 (16:04 UTC): Radar düzeltmesi YAYINDA ve ÜRETİMDE DOĞRULANDI.
  Push: ec14bcd (GitHub GH007 e-posta gizliliği engeli — kullanıcı kararıyla
  commit yazarı noreply adresine çevrildi; depo-yerel user.email artık
  216948603+emreemrah@users.noreply.github.com). Render otomatik deploy
  16:03:17'de yeni instance açtı, refresh 75 sn'de tamamlandı.
  Kanıt: /api/health durum=saglikli · hasData=true ·
  updatedAt=2026-08-22T16:04:32Z. /api/bulletin 200 · 838 KB · round 1529
  2026/2027 2. Hafta · matchCount=15 · matched=14 · upcoming=12 · radar=11.
  Başlamış-mühürsüz 3 maçın analizi BOŞ kaldı → geriye dönük tahmin kuralı
  delinmedi; #1 Erzurumspor FK–Galatasaray gerçek skoruyla (0-4) görünüyor.
  /api/surprise-radar · /api/rounds · /api/match/1 = 200. Durum: VERIFIED.
- 2026-08-22 (16:1x UTC): KULLANICI KABULÜ — telefonda kontrol edildi,
  "veri geldi, çalışıyor". Radar/bülten arızası kapandı. Durum: ACCEPTED.
- 2026-08-22 (16:43 UTC): Mühür kalıcılığı YAYINDA ve üretimde doğrulandı.
  Push f98eff5 (3a61a79 Flutter sebep-notu ile birlikte), deploy 16:41:45.
  MADDE 3 (geç mühür karne dışı): kod YAZILMADI — zaten kuruluydu.
  provenance.js `late` kaydını `late_lock` ile official_forward dışında
  tutuyor. Üretim kanıtı (deploy sonrası da aynı): karne haftaları
  [1528,1527,1526], exclusionBreakdown {"late_unverified":3,"unknown":1},
  1529 karnede YOK. Geri yükleme bu kapıyı DEĞİŞTİRMEDİ.
  MADDE 2 (mühür kalıcı): üretimde /api/bulletin → 3 maç arşivden geri
  yüklendi (#1 "2", #11 "1", #13 "10" — hepsi mühürdeki değerin birebir
  aynısı, gözlem anı 2026-08-21T16:42:30Z, yani maç öncesi). Analizi boş
  maç kalmadı (#10 hariç: fikstür eşleşmiyor, ayrı ve dürüst boşluk).
  Yerelde 5, üretimde 3 geri yüklendi — fark, aşağıdaki saat dilimi
  bulgusundan kaynaklanıyor (sunucu TZ'sine göre "başlamış" tanımı kayıyor).
- 2026-08-22: AÇIK BULGU (düzeltilmedi, kullanıcı kararı bekliyor) —
  `refresh.js:439` "başlamış maç" tanımı ham `new Date(bm.date)` kullanıyor;
  aynı şekilde `isLocked` (satır ~263) ham `new Date(bulletin.closeDate)`.
  Resmî saatler saat dilimi EKSİZ gelir ve Türkiye duvar saatidir. Üretim
  UTC olduğu için 21:30 TSİ maç, sunucuda 21:30Z sanılıyor: "başlamış" ve
  "kilitli" durumları ÜRETİMDE 3 SAAT GEÇ tetikleniyor. Doğru okuyucu
  (`macAniMs`) dosyada zaten var ve başka yerlerde kullanılıyor.
  Etki sınırlı ama gerçek: maç fiilen başladıktan sonraki ~3 saat boyunca
  bülten kilitsiz sayılıyor ve analiz yeniden hesaplanabiliyor. Bu, projenin
  "maç başladıktan sonra tahmin üretilmez" kuralını yumuşatıyor.
  NOT: gözlem yazımı (`recordObservationsFromData` → `computeFreezeAt`)
  macAniMs kullandığı için DOĞRU anda duruyor; bu yüzden geri yükleme
  sınırı sağlam, etkilenmiyor.
