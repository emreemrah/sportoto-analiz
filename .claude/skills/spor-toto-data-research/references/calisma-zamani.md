# Çalışma zamanı notu (dört spor-toto-* wrapper için ortak)

## Kurulan kaynak skill'ler

`machina-sports/sports-skills` deposundan proje kapsamına kurulanlar:

| Skill | Gerçek konum | Claude Code görünümü |
|---|---|---|
| `football-data` | `.agents/skills/football-data` | `.claude/skills/football-data` (symlink) |
| `betting` | `.agents/skills/betting` | `.claude/skills/betting` (symlink) |
| `sports-reporter` | `.agents/skills/sports-reporter` | `.claude/skills/sports-reporter` (symlink) |
| `sports-news` | `.agents/skills/sports-news` | `.claude/skills/sports-news` (symlink) |

Kayıt dosyası: proje kökündeki `skills-lock.json` (yalnız bu dört kayıt).

Kurulan kaynak sürüm:

```text
depo   : https://github.com/machina-sports/sports-skills
commit : fcfc029432756d92654ad1fcbdc0296242de73f7
tarih  : 2026-08-06T01:13:14Z
sürüm  : 0.30.1
```

## Yeniden kurulum — sürüm nasıl sabitlenir

**Mevcut bilgisayarda yeniden kurulum GEREKMEZ.** Dört skill kurulu ve
çalışıyor. Aşağıdaki komut yalnız iki durumda kullanılır: temiz bir Git
klonunda ya da kurulum diskten kaybolduğunda.

### Neden düz depo adı yetmez

Aşağıdaki biçim bu projede **KULLANILMAZ** — karşı örnek olarak duruyor,
kopyalanacak komut değildir:

```text
KULLANMA · npx skills add machina-sports/sports-skills ...
```

Bu biçim deponun **varsayılan dalını** indirir; yukarıdaki commit'i
**sabitlemez**. Yarın çalıştırılırsa upstream'in o günkü hâli gelir.

**Commit SHA'sının bir belgede yazılı olması tek başına sabitleme değildir.**
Sabitlemeyi yapan, komuta verilen adresin kendisidir.

### Sabitleyen adres

Aşağıdaki GitHub arşiv URL'si doğrudan o commit'in kaynak içeriğini gösterir:

```text
https://github.com/machina-sports/sports-skills/archive/fcfc029432756d92654ad1fcbdc0296242de73f7.zip
```

### Kesin yeniden kurulum komutu

CMD ve PowerShell'de tek satır olarak çalışır:

```text
npx skills add "https://github.com/machina-sports/sports-skills/archive/fcfc029432756d92654ad1fcbdc0296242de73f7.zip" --skill football-data --skill betting --skill sports-reporter --skill sports-news --agent universal --agent claude-code --yes
```

### Bu sabitlemenin sınırı

Arşiv URL'si **dört kaynak skill'in içeriğini** sabitler. `npx skills`
aracının kendi sürümünü sabitlemez — `npx` her çağrıda aracın güncel
sürümünü çekebilir. Kurulan skill dosyaları aynı kalır, kurulumu yapan araç
değişebilir.

### Kurulum öncesi onay

Bu komut **kullanıcıdan açık onay alınmadan çalıştırılmaz**. Kurulum, skill
ekleyen ve diske yazan bir işlemdir; kendiliğinden başlatılmaz.

### Kurulum sonrası doğrulama listesi

- Yalnız `football-data`, `betting`, `sports-reporter`, `sports-news`
  kurulmuş olmalı.
- `markets`, `kalshi`, `polymarket`, `polymarket-trading`, `machina`,
  `world-cup` **kurulmamalı**.
- `.agents/skills/` altında dört gerçek klasör ve her birinde `SKILL.md`
  bulunmalı.
- `.claude/skills/` altında aynı adlı dört bağlantı bulunmalı ve hedefleri
  erişilebilir olmalı.
- Kaynak skill dosyaları **kullanıcı onayı olmadan düzenlenmemeli**;
  upstream bütünlüğü korunur.
- `skills-lock.json` `.gitignore`'dadır: **temiz klonda otomatik gelmez**,
  yukarıdaki kurulum komutu çalıştırılınca yeniden oluşur.

## Python çalışma zamanı: KURULU DEĞİL

Kurulum sırasında yapılan salt okunur kontroller:

```text
node    : v24.18.0      ✓
npx     : 11.17.0       ✓
py -3   : bulunamadı
python  : bulunamadı
python3 : bulunamadı
sports-skills : PATH'te yok
```

Yaygın kurulum dizinleri (`%LOCALAPPDATA%\Programs\Python`, `C:\Python3xx`,
`%ProgramFiles%\Python3xx`) de tarandı; Python bulunamadı.

**Sonuç:** kaynak skill'lerin veri çeken/hesaplayan komutları
(`sports-skills football-data ...`, `sports-skills betting ...`) bu makinede
**çalıştırılamaz**. Skill tanımları ve dokümantasyonu kuruludur; yalnız
çalışma zamanı eksiktir.

### İki ayrı soru — karıştırılmamalı

| Soru | Cevap |
|---|---|
| Geliştirme yardımcısı (Claude) yerel Python'a ihtiyaç duyar mı? | **Evet** — yalnız kaynak skill'lerin veri/CLI komutlarını çalıştırmak için. |
| Flutter/Node üretim sunucusu Python'a ihtiyaç duyar mı? | **Hayır.** Uygulama kodu bu pakete hiç bağlanmaz; skill'ler yalnız geliştirme ortamı aracıdır. |

Yani Python'un burada olmaması **üretimi etkilemez**; yalnız geliştirme
sırasında bu dört skill'in komutları kullanılamaz.

### Bu durumda ne yapılır

- Komut çalıştırılmış gibi davranılmaz, çıktı uydurulmaz.
- Kullanıcıya "Python çalışma zamanı yok, bu komut çalıştırılamıyor" denir.
- Kaynak skill'lerin `pip install` önerisi **otomatik çalıştırılmaz**.
- Python kurulumu, PATH değişikliği veya sistem ayarı **yapılmaz**; bu ayrı
  bir onay gerektirir.

### Python 3.10+ ileride kurulursa

1. Global Python paketlerine dokunulmaz.
2. Proje-yerel izole bir sanal ortam kullanılır.
3. `sports-skills` çalışma zamanı yukarıdaki commit SHA'sına sabitlenir.
4. Otomatik güncelleme açılmaz.
5. Sanal ortam dosyaları Git'e eklenmez / stage edilmez.

## Python gerektirmeyen doğrulama

`betting` skill'i "pure computation" olduğunu söyler. Referansındaki formüller
(`references/api-reference.md` → Key Concepts) Python olmadan da bağımsız
doğrulanabilir. Kurulum sırasında yapılan hesap-yalnız smoke test:

```text
convert_odds(-150, american) → olasılık 0.6      · ondalık 1.6667
convert_odds(+130, american) → olasılık 0.4348
devig(-110/-110)             → ham toplam %104.8 · adil olasılık 0.5
find_edge(0.58, 0.52)        → edge 0.06 · EV 0.1154 · Kelly 0.125
```

%104.8 değeri kaynak referansın kendi metniyle birebir uyuştu. Bu test ağa
çıkmaz, para hareketi içermez, kimlik bilgisi kullanmaz.
