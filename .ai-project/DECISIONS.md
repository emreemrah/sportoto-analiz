# Karar Günlüğü

- 2026-08-19T16:24:19.8619753Z: Konuşma geçmişi yerine `.ai-project` kayıtları ve Git kalıcı gerçek kaynağı olarak seçildi.
- 2026-08-21 (kullanıcı kararı): Radar 5 "Tüm Haftalar" TÜM sezonları kapsar
  ("tüm sezonlar olacak"). 1 Ağustos 2026'daki "sabit pencereler aktif sezona
  bağlı" kararının yerine geçer — o günkü kaygı (4 sezon/150 haftanın tek
  ortalamada seyrelmesi) eskiHaftalariAt'ın 1525 başlangıç kesimiyle yapısal
  olarak engellidir. `season` alanı yalnız bakılan haftanın üst verisidir,
  süzgeç değildir. Uygulandığı yer: backend/src/routes/radar.js
  (siraDnaTabani + /position-matches), bekçi: radar5-sezon-devri.test.mjs.
- 2026-08-22 (kullanıcı kararı): Mühür kalıcılığı için "2 ve 3 birlikte".
  MADDE 3 (geç mühür karneye girmesin) DENETLENDİ ve ZATEN KURULU çıktı —
  `scorecards/provenance.js` `late` kaydını `late_lock` ile official_forward
  dışında tutuyor. YENİ KOD YAZILMADI; çalışan korumayı yeniden yazmak ikinci
  bir doğruluk kaynağı üretirdi. MADDE 2 uygulandı: maç öncesi mühür kalıcı
  arşivden (Supabase gözlemleri) geri yükleniyor —
  `backend/src/archive/gozlemGeriYukleme.js`, bekçi: gozlem-geri-yukleme.test.mjs.
  İLKE: geri yükleme kullanıcının ekranındaki boşluğu doldurur, KARNE
  UYGUNLUĞUNU DEĞİŞTİRMEZ. Geç mühürlü hafta karne dışı kalmaya devam eder.
- 2026-08-22 (kullanıcı kararı): Mühür anında sunucuyu dışarıdan uyandırmak
  için GitHub Actions bekçisi (`.github/workflows/muhur-uyandirma.yml` +
  `backend/scripts/muhur-bekcisi.mjs`). TASARIM KISITI: Render ücretsiz plan
  750 instance-saat/ay verir; 7/24 ping (~730 saat) bütçeyi bitirip servisi
  askıya aldırabilirdi — mevcut sorundan kötüsü. Bu yüzden bekçi ÖNCE Spor
  Toto'ya sorar (Render'a dokunmadan) ve yalnız mühür penceresinde uyandırır.
  Pencere 40 dk; ölçülen gerçek cron gecikmesi 19 dk. Gecikme 40 dk'yı aşmaya
  başlarsa pencere büyütülmeli.
- 2026-08-22 (kullanıcı kararı): Yayın imza anahtarı üretildi
  (`flutter/android/masteranaliz.jks`). Eski anahtar formatla kaybolmuştu;
  seçenekler "yeni yayın anahtarı" ve "debug imzasıyla derle" idi, kullanıcı
  ilkini seçti. Sonuç: telefonda BİR KEZ kaldır-kur, sonrasında güncellemeler
  üzerine kurulur. ŞART: anahtar depo dışında yedeklenmeli — kaybolursa aynı
  sorun tekrarlanır, Play Store'a çıkılırsa kalıcı kimlik olur.
- 2026-08-22: İki yayın bekçisi GERÇEK invariant'a bağlandı (kural
  gevşetilmedi, YANLIŞ ÖLÇÜ düzeltildi). (a) `key.properties`in diskte
  OLMAMASINI şart koşan kural imzalı derlemeyi imkânsız kılıyordu → artık
  "varsa git tarafından yoksayılmalı" (git check-ignore). (b) Sürümü
  `1.0.0+1`e sabitleyen kural (Expo kaynağıyla port eşitliği) güncellemeyi
  imkânsız kılıyordu; Android versionCode artışı şarttır → artık "biçim
  geçerli + port tabanına (1) geri düşmemeli", negatif olarak doğrulandı.
- 2026-08-22: Bekçinin hükmü ÇIKIŞ KODUNA yazılır (`hukumKodu`):
  'tamam'/'bilgi' → 0, 'dikkat' ve BİLİNMEYEN → 1. Gerekçe: sonuç yalnız iş
  akışı log'unda dururken dışarıdan okunamıyordu — log okumak kimlik
  doğrulaması ister. Çıkış kodu koşunun `conclusion` alanına yansır ve
  herkese açık API'den okunur; ayrıca GitHub başarısız zamanlanmış iş akışı
  için KENDİSİ bildirim yollar, yani ayrı bir izleme kurmaya gerek kalmaz.
  BİLİNMEYEN hüküm bilerek kırmızı sayılır: sessiz yeşil, kaçırılmış mühür
  demektir. Bekçi: test/muhur-bekcisi.test.mjs.
- 2026-08-22 (ölçülen kısıt, karar değil ama bağlayıcı): Anthropic bulut
  ortamı (scheduled routines) `sportoto-analiz.onrender.com` adresine
  ÇIKAMIYOR — curl "CONNECT tunnel failed 403", WebFetch "EGRESS_BLOCKED".
  `api.github.com` yalnız WebFetch ile okunur (curl 403). Bu yüzden bulut
  görevleri uygulamanın kendi durumunu doğrudan denetleyemez; hüküm GitHub
  Actions üzerinden okunur. Bu kısıt, yukarıdaki çıkış-kodu kararının
  sebebidir. Yeni bir bulut görevi yazılırken bu varsayılmalı — aksi hâlde
  görev sessizce yarım çalışır (deneme koşusunda tam bu yaşandı).
