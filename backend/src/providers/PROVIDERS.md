# Oynanma Yüzdesi Sağlayıcı İncelemesi (22 Tem 2026, gerçek tarayıcı denetimi)

Soru (her kaynak için): Spor Toto'nun 15 maçına ait **gerçek 1/X/2 oynanma
yüzdesi** var mı · veri **açık ve oturumsuz** mu · **zaman damgalı otomatik**
alınabilir mi · gösterilen değer **gerçek yüzde mi**, yoksa oran / popülerlik
sırası / kupon sayısı mı?

## ✅ Bilyoner — ETKİN (gerçek, açık, oturumsuz)
- **Program:** `GET https://www.bilyoner.com/api/sto/programs/active`
  → `gameCycleEntityModel.{ gcNo, payinEndDate, eventVOs[] }` (gcNo dinamik).
- **Yüzdeler:** `GET https://www.bilyoner.com/api/sto/playratio?gcNo=<gcNo>`
  → `playRatioList[{ eventNo, count_1, count_0, count_2 }]`
  (count_1→1/ev, count_0→X, count_2→2/dep).
- **Oturumsuz KANITI:** her iki uç da `fetch(..., {credentials:'omit'})` ile
  (çerez/oturum GÖNDERİLMEDEN) **HTTP 200** ve tam veri döndürdü. gcNo halka
  açık program kodudur; kullanıcı belirteci içermez.
- **Değer türü:** gerçek 1/X/2 tercih yüzdesi (ekranda görünen değerlerle birebir:
  1. maç %42.5/%34/%23.5). Toplam ≈100.
- Adaptör: `bilyoner.js` — parser + bülten eşleştirme + doğrulama; `enabled:true`.

## ⏸ Misli — GERÇEK yüzde VAR, ama akış oturumsuz REST DEĞİL
- Program açık/oturumsuz REST'te: `GET https://apivx.misli.com/api/web/v1/sportoto/active`
  → `{success, data:{draw:{drawNumber:350, events:[{no,name,league,date}]}}}`
  (200, credentials:'omit'). Ancak burada **yüzde YOK**, yalnız maç listesi.
- Yüzdeler `aggr.misli.com/ws/event-play-stats/info` üzerinden geliyor →
  yanıt `{"websocket":true,"cookie_needed":true}` = **SockJS/WebSocket** akışı,
  **çerez gerektiriyor**. Bu, Bilyoner'in temiz oturumsuz REST'i gibi DEĞİL.
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
etkinleştirilir (şu an: Bilyoner). "En çok oynanan maçlar" sıralaması, kupon
sayısı veya bahis oranı, 1/X/2 oynanma yüzdesi gibi KULLANILMAZ. Sağlayıcılar
ham veride karışmaz; yalnız medyan/uzlaşma analizinde birlikte değerlendirilir.
Kullanıcıya teknik hata metni gösterilmez.
