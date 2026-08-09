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

Kurulum anındaki upstream deposu:

```text
depo   : https://github.com/machina-sports/sports-skills
commit : fcfc029432756d92654ad1fcbdc0296242de73f7
tarih  : 2026-08-06T01:13:14Z
sürüm  : 0.30.1
```

Bu SHA, çalışma zamanı ileride kurulursa **aynı sürüme sabitlemek** için
kaydedildi. Sabitlenmemiş `latest` sürüme geçilmez.

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
