---
name: spor-toto-data-research
description: Spor Toto Master Analiz projesinde football-data skill'ini YALNIZ geliştirme, araştırma, prototip ve çapraz kontrol amacıyla kullanmanın kuralları. Hangi ligde hangi verinin bulunduğunu, xG'nin hangi liglerde olmadığını ve sonuçların nasıl kaynak/zaman/güven etiketiyle sunulacağını tanımlar. Kullan: football-data ile veri çekmeden veya çektiğin veriyi yorumlamadan önce. Kullanma: üretim verisi gerektiğinde (o Sportmonks veya lisanslı sağlayıcıdan gelir) ya da veriyi Supabase'e yazarken.
---

# Spor Toto — Veri Araştırma Kuralları

`football-data` skill'i bu projede **yardımcı bir araştırma aracıdır**, üretim
veri kaynağı değildir.

## Kırmızı çizgi: üretim ile araştırma ayrımı

- `football-data` YALNIZ şunlar için kullanılır: geliştirme, araştırma,
  prototip, çapraz kontrol.
- Üretim uygulamasının ana veri kaynağı olarak KULLANILMAZ.
- Üretim verisi Sportmonks'tan ya da ayrıca lisanslanmış bir sağlayıcıdan
  gelir.
- Bu skill'in ürettiği hiçbir veri Supabase'e **otomatik yazılmaz**.
- Hiçbir veri uygulamaya gömülmeden önce **ticari lisans kontrolü** yapılır.
  Açık veri "serbestçe ticari kullanılabilir" demek değildir.

## Kaynakların kapsamı birbirinden FARKLIDIR

`football-data` tek bir veri tabanı değil; arkasında farklı kapsamda kaynaklar
var: ESPN, Understat, FPL, Transfermarkt, football-data.co.uk, ClubElo,
openfootball. Bir kaynakta olan alan diğerinde olmayabilir. Sonuç birleştirilip
tek bir bütünmüş gibi sunulmaz.

### xG (beklenen gol)

- xG YALNIZ şu beş lig için kullanılır: Premier League, La Liga, Bundesliga,
  Serie A, Ligue 1.
- **Süper Lig için xG YOKTUR.** Süper Lig maçında xG istenirse "bu lig için
  xG verisi yok" denir; başka bir metrikle doldurulup xG diye sunulmaz.

### Diğer bilinen sınırlar

- Eksik/sakat oyuncu komutu **yalnız Premier League'de** çalışır; diğer
  liglerde boş döner. Boş dönmesi "eksik oyuncu yok" demek DEĞİLDİR.
- Sezon lideri/istatistik lideri komutları da Premier League dışında boş
  dönebilir.
- H2H (karşılıklı geçmiş) **aynı lig maçlarıyla sınırlı olabilir**; kupa ve
  Avrupa maçları listede olmayabilir. Bu sınır her H2H çıktısında yazılır.
- Bu skill **gerçek canlı futbol skoru sağlamaz**. Veriler maç sonrası
  güncellenir. "Canlı skor" iddiasında BULUNMA.

## Her sonuçta bulunması zorunlu dört alan

Hangi komut çalıştırılırsa çalıştırılsın, çıktı şu dördü taşır:

```text
Kaynak        : hangi alt kaynaktan geldi (ESPN / Understat / FPL / ...)
Veri zamanı   : verinin ait olduğu an (maç sonrası mı, hangi tarih)
Lig kapsamı   : bu alan bu ligde var mı, yok mu
Güven seviyesi: yüksek / orta / düşük — ve neden
```

## Çelişki ve boşluk

- Kaynaklar çelişirse **üretim verisi ve resmî sonuç önceliklidir**.
  `football-data` çıktısı resmî Spor Toto sonucunu geçersiz kılmaz.
- İki araştırma kaynağı birbiriyle çelişirse ikisi de yazılır, biri sessizce
  seçilmez.
- **Verisi bulunmayan alan tahmin ederek doldurulmaz.** "Bilinmiyor" geçerli
  ve tercih edilen cevaptır.

## Bağımlılık ön kontrolü

Bu skill kaynak `football-data` skill'ine dayanır. Onun **veri veya CLI
komutu** kullanılacaksa, önce şunları doğrula:

```text
.agents/skills/football-data/SKILL.md   → dosya var mı
.claude/skills/football-data           → bağlantı var mı, hedefi açılıyor mu
```

Sonra `references/calisma-zamani.md` dosyasını oku (çalışma zamanı ve sürüm
durumu oradadır).

Eksiklik varsa:

- **Otomatik kurulum yapma.** Eksikliği kullanıcıya bildir ve kurulum için
  açık onay iste; kurulum komutu `references/calisma-zamani.md` içindedir.
- **Yasaklı başka bir skill'e geçme** (`markets`, `kalshi`, `polymarket`,
  `polymarket-trading`, `machina`, `world-cup`).
- Kaynak skill eksikken **veri çekilmiş gibi gösterme**; çıktı uydurma.
- Bu belgedeki proje kuralları (üretim/araştırma ayrımı, xG kapsamı, kaynak
  ve güven etiketi) **yine de geçerlidir** — yalnız veri komutları devre dışı
  kalır.

## Çalışma zamanı durumu

`football-data` komutları `sports-skills` Python paketini kullanır. Bu
makinede çalışma zamanı KURULU (2026-08-09, kullanıcı onayıyla):

```text
.venv-sports\Scripts\sports-skills.exe football <komut> ...
```

Ayrıntı, sürüm sabitleme ve venv silinirse yeniden kurulum:
`references/calisma-zamani.md`. Venv yoksa: komut uydurma, "çalıştırdım"
deme, kullanıcıya durumu bildir ve kurulum için açık onay iste.
