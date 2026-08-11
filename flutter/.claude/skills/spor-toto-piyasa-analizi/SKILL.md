---
name: spor-toto-piyasa-analizi
description: Spor Toto kuponlarındaki oynanma yüzdesi ile bahis piyasası olasılığını ve kendi model olasılığımızı BİRBİRİNE KARIŞTIRMADAN karşılaştırma kuralları. betting skill'inin matematiğinden yararlanır ama oynanma yüzdesine de-vig, EV, Kelly veya arbitraj uygulanmasını yasaklar. Kullan: halk sapması, favori şişmesi, az oynanma değeri veya model-piyasa farkı hesaplanacağında. Kullanma: gerçek para, cüzdan, bahis sitesi yönlendirmesi veya kesin tavsiye istendiğinde.
---

# Spor Toto — Piyasa ve Oynanma Analizi

`betting` skill'inin matematiği kullanılabilir, **ama** üç kavram asla
birbirinin yerine geçmez.

## Üç ayrı kavram — karıştırılması yasak

```text
marketProb  = bahis oranlarından marj (vig) temizlenerek elde edilen
              piyasa olasılığı
publicShare = Spor Toto kuponlarında işaretlenen 1-X-2 oynanma yüzdesi
modelProb   = bizim 40 kriterli analiz motorumuzun olasılığı
```

`publicShare` bir **fiyat değildir**. Kaç kişinin o işareti seçtiğini gösterir.
Fiyat, para hacmi ya da "public money" olarak adlandırılmaz.

## Tanımlı hesaplar

```text
halkSapması     = publicShare - marketProb
modelSapması    = modelProb   - marketProb
favoriŞişmesi   = publicShare - modelProb
azOynanmaDeğeri = modelProb   - publicShare
```

Her sonuç hangi iki kavramdan üretildiği yazılarak sunulur.

## Oynanma yüzdesine YAPILMAYACAKLAR

- De-vig **uygulanmaz**. De-vig yalnız gerçek bahis oranlarına uygulanır;
  oynanma yüzdesinde marj diye bir şey yoktur.
- Parasal EV **üretilmez**.
- Kelly büyüklüğü **üretilmez**.
- Arbitraj sonucu **çıkarılmaz**.

## Kelly ve havuz sistemi

- Kelly yalnız **sabit fiyat** ve **güvenilir model olasılığı** birlikte varsa
  anlamlıdır.
- Spor Toto bir **havuz (pari-mutuel) sistemidir**; ödeme oranı önceden belli
  değildir, kazananlar arasında paylaşılır. Bu yüzden klasik Kelly doğrudan
  geçerli DEĞİLDİR. Hesaplanırsa bu uyarıyla birlikte verilir.

## 15 maçlık kupon bağımsız parlay değildir

- Kolonu sıradan bir bağımsız parlay gibi çarpma.
- Tekli / çift / kapalı seçim, kolon maliyeti, havuz büyüklüğü ve ikramiye
  paylaşımı ayrı bir optimizasyon problemidir; `parlay_analysis` çıktısı
  buraya doğrudan taşınmaz.

## Hareket dili

- Açılış ile kapanış arasındaki oynanma yüzdesi değişimi **"seçim hareketi"**
  olarak adlandırılır.
- Bunun "profesyonel para hareketi" ya da "sharp money" olduğu **iddia
  edilmez**. Kim işaretledi bilinmiyor.

## Dil ve sınırlar

- Sonuç **kesin bahis tavsiyesi** olarak sunulmaz.
- "Banko", "kesin kazanır", "garanti para" gibi ifadeler kullanılmaz.
- Gerçek para, cüzdan veya bahis sitesi yönlendirmesi yapılmaz.
- `markets`, `kalshi`, `polymarket`, `polymarket-trading` skill'leri
  **çağrılmaz** (bu projeye kurulmadılar).
- Piyasa oranı gerekiyorsa yalnız **lisanslı ve proje tarafından sağlanan**
  oran verisi kullanılır.

## Kapsam

Bu skill **hesaplama yöntemini tarif eder**. Üretimdeki hesap Node.js
backend'de uygulanır; burada üretilen sayılar doğrudan uygulamaya yazılmaz.

## Bağımlılık ön kontrolü

Bu skill kaynak `betting` skill'ine dayanır. Onun **veri veya CLI komutu**
kullanılacaksa, önce şunları doğrula:

```text
.agents/skills/betting/SKILL.md   → dosya var mı
.claude/skills/betting            → bağlantı var mı, hedefi açılıyor mu
```

Sonra `../spor-toto-data-research/references/calisma-zamani.md` dosyasını oku.

Eksiklik varsa:

- **Otomatik kurulum yapma.** Kullanıcıya bildir, açık onay iste; kurulum
  komutu yukarıdaki çalışma zamanı belgesindedir.
- **Yasaklı skill'e geçme** (`markets`, `kalshi`, `polymarket`,
  `polymarket-trading`, `machina`, `world-cup`).
- Kaynak skill eksikken **hesap yapılmış gibi gösterme**; sayı uydurma.
- Bu belgedeki kavram ayrımı ve yasaklar (de-vig/EV/Kelly/arbitraj sınırları,
  banko dili yasağı) **yine de geçerlidir**.

## Çalışma zamanı

`betting` komutları `sports-skills` Python paketini ister; bu makinede Python
yok. Formüller referansta yazılı olduğu için el hesabı yapılabilir, ama
"komutu çalıştırdım" denmez. Bkz. `../spor-toto-data-research/references/calisma-zamani.md`.
