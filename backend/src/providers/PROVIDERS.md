# Oynanma Yüzdesi Sağlayıcı İncelemesi (22 Tem 2026, gerçek tarayıcı denetimi)

Soru (her kaynak için): Spor Toto'nun 15 maçına ait **gerçek 1/X/2 oynanma
yüzdesi** var mı · veri **açık ve oturumsuz** mu · **zaman damgalı otomatik**
alınabilir mi · gösterilen değer **gerçek yüzde mi**, yoksa oran / popülerlik
sırası / kupon sayısı mı?

## ❌ Üçüncü kaynak — KALDIRILDI (2 Ağustos 2026, kullanıcı kararı)
- Kaynağın oynanma yüzdesi ucu Temmuz'da çalışıyordu, sonra erişilemez oldu:
  sunucudan atılan isteklerin büyük kısmına `HTTP 400 / "giriş yap"` dönüyor,
  aralarda rastgele başarılı oluyordu. Ölçüm (2 Ağu): aynı adrese saniyeler
  arayla 400 · 400 · 200 — tarayıcı, curl ve Node aynı davranışı gördü.
  Yani istemci farkı değil, ucun kendi dalgalanması.
- Tempo/tekrar ayarlarıyla kısmen çalıştırılabiliyordu ama güvenilir değildi;
  kullanıcı kaynağı tümüyle kaldırma kararı verdi.
- Adaptörü, testleri, betikleri ve kayıt satırı SİLİNDİ. Ortak yardımcıları
  (`assertAsciiHeaders`, `matchEventToBulletin`) kaynağa bağımlı olmadığı için
  `saglayiciOrtak.js`e taşındı; Nesine ve Misli oradan kullanıyor.
- Arşivdeki eski gözlemleri SİLİNMEDİ (geçmiş kayıt değiştirilmez). Kimlik
  eşlemesi kalktığı için artık nötr `k0` kovasına düşerler — ham marka adı
  hiçbir yanıtta görünmez.
- Marka adı YALNIZ yasak listelerinde geçmeye devam ediyor (ekranda ve HTTP
  yanıtında görünmediğini kanıtlayan testler). Oralardan silmek yasağı
  zayıflatırdı.

## ⏸ Misli — GERÇEK yüzde VAR, ama akış oturumsuz REST DEĞİL
- Program açık/oturumsuz REST'te: `GET https://apivx.misli.com/api/web/v1/sportoto/active`
  → `{success, data:{draw:{drawNumber:350, events:[{no,name,league,date}]}}}`
  (200, credentials:'omit'). Ancak burada **yüzde YOK**, yalnız maç listesi.
- Yüzdeler `aggr.misli.com/ws/event-play-stats/info` üzerinden geliyor →
  yanıt `{"websocket":true,"cookie_needed":true}` = **SockJS/WebSocket** akışı,
  **çerez gerektiriyor**. Bu, temiz oturumsuz bir REST akışı DEĞİL.
- **Karar:** Yüzdeler halka açık gösteriliyor (giriş yapılmadan görünür) fakat
  otomatik alım için WebSocket + çerez tokalaşması gerektiğinden, bu turda
  **etkinleştirilmedi**. İleride SockJS istemcisi + oturumsuzluk yeniden
  doğrulanırsa `apivx.../sportoto/active` (program) + ws akışı ile eklenebilir.
  Uydurma değer üretilmez.

## ✗ Nesine — Spor Toto oynanma yüzdesi bulunamadı
- `nesine.com/iddaa/spor-toto` → `nesine.com/iddaa`'ya yönlendirdi (İddaa ürünü).
  Spor Toto 15 maçına ait 1/X/2 oynanma yüzdesi yayımlayan açık sayfa/uç
  gözlenmedi. **Etkin değil.**

## ✗ Oley — yüzde YOK (yalnız kupon ızgarası; ana sayfada oran)
- `oley.com/spor-toto/oyna` → 15 maçlık program + Kolon 1-4 için 1/X/2 **işaret
  kutuları** var, ama **oynanma yüzdesi sütunu YOK**. Ana sayfada gösterilen
  1.86/3.36/2.70 gibi değerler **bahis ORANI**dır (yüzde değil). **Etkin değil.**

## ◦ iddaa.com — bu turda değerlendirilmedi
- Kullanıcı denetimi durdurduğu için incelenmedi; hakkında iddia edilmez.

---
**Kural:** Yalnız gerçek + açık + oturumsuz 1/X/2 yüzdesi doğrulanan kaynak
etkinleştirilir. "En çok oynanan maçlar" sıralaması, kupon
sayısı veya bahis oranı, 1/X/2 oynanma yüzdesi gibi KULLANILMAZ. Sağlayıcılar
ham veride karışmaz; yalnız medyan/uzlaşma analizinde birlikte değerlendirilir.
Kullanıcıya teknik hata metni gösterilmez.
