# Karar Günlüğü

- 2026-08-19T16:24:19.8619753Z: Konuşma geçmişi yerine `.ai-project` kayıtları ve Git kalıcı gerçek kaynağı olarak seçildi.
- 2026-08-21 (kullanıcı kararı): Radar 5 "Tüm Haftalar" TÜM sezonları kapsar
  ("tüm sezonlar olacak"). 1 Ağustos 2026'daki "sabit pencereler aktif sezona
  bağlı" kararının yerine geçer — o günkü kaygı (4 sezon/150 haftanın tek
  ortalamada seyrelmesi) eskiHaftalariAt'ın 1525 başlangıç kesimiyle yapısal
  olarak engellidir. `season` alanı yalnız bakılan haftanın üst verisidir,
  süzgeç değildir. Uygulandığı yer: backend/src/routes/radar.js
  (siraDnaTabani + /position-matches), bekçi: radar5-sezon-devri.test.mjs.
