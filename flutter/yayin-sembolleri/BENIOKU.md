# Yayın sembolleri — BU KLASÖRÜ SİLMEYİN

Yayın derlemeleri `--obfuscate` ile karartılır: sınıf, işlev ve alan adları
anlamsız kısa adlara çevrilir. Bu, paketi küçültür ve kodun tersine
mühendislikle okunmasını zorlaştırır.

**Bedeli şudur:** karartılmış bir uygulamadan gelen çökme raporu okunamaz.
Yığın izi (stack trace) şuna benzer:

```
#0  ab (package:masteranaliz/xy.dart:12)
#1  cd (package:masteranaliz/zw.dart:44)
```

Bu satırları gerçek dosya/işlev adlarına çevirmek için **o derlemeye ait**
sembol dosyası gerekir. Sembol dosyası kaybolursa çökme raporu kalıcı olarak
okunamaz hâle gelir — geriye dönük üretilemez.

## Kural

Her yayın için `yayin-sembolleri/<sürüm>/` klasörü oluşturulur ve o sürüm
mağazada olduğu sürece **saklanır**. Sürüm numarası `pubspec.yaml`
içindeki `version:` alanıyla aynıdır (ör. `1.0.0+1`).

## Derleme komutları

```bash
# Play Store paketi
flutter build appbundle --release \
  --obfuscate --split-debug-info=yayin-sembolleri/1.0.0+1 \
  --dart-define=API_BASE=https://gercek-sunucu.example.com

# Cihaza kurulabilir APK'lar (mağaza dışı dağıtım)
flutter build apk --release --split-per-abi \
  --obfuscate --split-debug-info=yayin-sembolleri/1.0.0+1 \
  --dart-define=API_BASE=https://gercek-sunucu.example.com
```

`API_BASE` verilmezse derleme HATA VERİR — yayın paketi sessizce yerel adrese
düşmez (bkz. `lib/core/network/api_base.dart`).

## Çökme raporunu çözme

```bash
flutter symbolize -i cokme.txt -d yayin-sembolleri/1.0.0+1/app.android-arm64.symbols
```

Mimariyi rapordan seçin: `arm64` (çoğu telefon), `arm` (eski 32-bit cihazlar),
`x64` (emülatör).

## Karartmanın kırabildiği yer

Karartma, tip ve alan ADLARINA çalışma zamanında bakan kodu bozar. Bu projede
tek böyle yer `token_store.dart` içindeki cihaz/platform adıydı; enum'un
`.name` getter'ı yerine açık `switch` yazıldı (kaynaktaki `Platform.OS`
değerleriyle birebir aynı). Yeni kod yazarken `runtimeType.toString()`,
`enum.name` ve `Enum.values.byName(...)` kullanmayın.
