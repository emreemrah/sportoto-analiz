---
name: spor-toto-mac-anlatimi
description: Spor Toto Master Analiz için Türkçe maç anlatımı ve analiz metni üretme kuralları. sports-reporter'ın anlatım disiplinini kullanır ama yalnız mühürlü snapshot verisine dayanır, olasılıkları yeniden hesaplamaz ve iddialı dil kullanmaz. Kullan: maç önizlemesi, analiz metni, kriter özeti veya maç sonrası karne yazılacağında. Kullanma: ham veri istendiğinde ya da mühürlü kayıt yokken analiz uydurulması gerekeceğinde.
---

# Spor Toto — Maç Anlatımı

`sports-reporter`ın anlatım disiplini kullanılır; veri ve dil kuralları
buradaki gibidir.

## Veri kaynağı

- Yalnız **Supabase'deki ya da backend'in sağladığı mühürlü analiz
  snapshot'ı** kullanılır.
- Tahmin motorunun olasılıkları **yeniden hesaplanmaz, düzeltilmez,
  yuvarlanarak değiştirilmez**.
- Var olmayan istatistik, sakatlık, oran veya olay **uydurulmaz**.
- Veriler arasında çelişki varsa **açıkça belirtilir**, biri sessizce
  seçilmez.
- Mühürlü kayıt yoksa analiz üretilmez; "bu maç için maç öncesi mühürlü kayıt
  yok" denir.

## Dil

- Tüm kullanıcı çıktıları **Türkçe**.
- Anlaşılır ama profesyonel futbol analiz dili.
- Kaynak `sports-reporter` içindeki **Portekizce varsayılan yardım metni
  kullanıcıya taşınmaz**.
- Şunlar kullanılmaz: "kesin", "garanti", "banko para", "şu sonucu oyna".

## Bölüm düzeni

Veri elverdiğince şu bölümler bulunur; veri yoksa bölüm atlanır ve neden
atlandığı yazılır:

```text
Kısa maç özeti
Modelin 1-X-2 olasılıkları
Spor Toto oynanma yüzdeleri
Marjı temizlenmiş piyasa olasılıkları
Model–piyasa–oynanma farkı
En güçlü 3 kriter
Modelin tersine çalışan 2 kriter
Sürpriz sinyali
Veri kalitesi ve eksik alanlar
```

"Model–piyasa–oynanma farkı" hesaplanırken `spor-toto-piyasa-analizi`
kuralları geçerlidir (oynanma yüzdesine de-vig/EV/Kelly uygulanmaz).

## Analiz ile sonuç ayrımı

- Analiz **tahmindir**, gerçekleşen sonuç **olgudur**. İkisi aynı cümlede
  birbirine karıştırılmaz.
- Maç başlamadan önce **muhtemel kadro kesin kadro gibi gösterilmez**.
- Maç bittikten sonra Kriter Karnesi **yalnız mühürlü tahmin ile resmî sonucu**
  karşılaştırır; bugünkü veriyle geçmişe dönük yeniden hesap yapılmaz.

## Canlı iddiası

Futbol için **gerçek canlı veri yoktur** (`football-data` maç sonrası
güncellenir). "Canlı rapor" üretildiği iddia edilmez.

## Komut çelişkisi

Kaynak `sports-reporter` ile `football-data` arasında komut adı/parametre
çelişkisi varsa **güncel `football-data` komut tablosu** ve bu projenin
wrapper kuralları esas alınır.

## Bağımlılık ön kontrolü

Bu skill kaynak `sports-reporter` skill'ine dayanır. Onun **veri veya CLI
komutu** kullanılacaksa, önce şunları doğrula:

```text
.agents/skills/sports-reporter/SKILL.md   → dosya var mı
.claude/skills/sports-reporter            → bağlantı var mı, hedefi açılıyor mu
```

Sonra `../spor-toto-data-research/references/calisma-zamani.md` dosyasını oku.

Eksiklik varsa:

- **Otomatik kurulum yapma.** Kullanıcıya bildir, açık onay iste; kurulum
  komutu yukarıdaki çalışma zamanı belgesindedir.
- **Yasaklı skill'e geçme** (`markets`, `kalshi`, `polymarket`,
  `polymarket-trading`, `machina`, `world-cup`).
- Kaynak skill eksikken **veri çekilmiş gibi gösterme**; istatistik uydurma.
- Bu belgedeki kurallar (yalnız mühürlü snapshot, iddialı dil yasağı, analiz
  ile sonuç ayrımı) **yine de geçerlidir**. Mühürlü snapshot backend'den
  gelir; `sports-reporter` yalnız anlatım disiplinidir, veri kaynağı değildir.

## Çalışma zamanı

Veri çeken komutlar `sports-skills` Python paketini ister; bu makinede Python
yok. Bkz. `../spor-toto-data-research/references/calisma-zamani.md`. Komut
çalıştırılamıyorsa uydurulmaz, durum kullanıcıya bildirilir.
