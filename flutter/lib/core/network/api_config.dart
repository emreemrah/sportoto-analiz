// KAYNAK: app/src/config.js — BİREBİR çeviri.
//
// Uygulama SADECE kendi backend'ine bağlanır (dış veri sağlayıcısına asla
// doğrudan). Adres çözümleme mantığı saf modüldedir: api_base.dart.
//
// Kaynakta adres `process.env.EXPO_PUBLIC_API_BASE` ile veriliyordu.
// Flutter'daki karşılığı derleme zamanı tanımıdır:
//
//   flutter run   --dart-define=API_BASE=http://192.168.1.100:4000
//   flutter build --dart-define=API_BASE=https://sunucu.example.com
//
// Verilmezse geliştirmede platforma göre yerel adres kullanılır; YAYINDA
// verilmemesi hata verir (web hariç — orada aynı origin geçerlidir).

import 'package:flutter/foundation.dart';

import 'api_base.dart';

/// Derleme zamanı adres tanımı (kaynaktaki `EXPO_PUBLIC_API_BASE`).
const String _envApiBase = String.fromEnvironment('API_BASE');

/// Çalışılan platformun adres çözümlemesindeki karşılığı.
ApiPlatform get currentApiPlatform {
  if (kIsWeb) return ApiPlatform.web;
  return switch (defaultTargetPlatform) {
    TargetPlatform.android => ApiPlatform.android,
    TargetPlatform.iOS => ApiPlatform.ios,
    _ => ApiPlatform.other,
  };
}

/// Backend kök adresi. Kaynaktaki `API_BASE` ile aynı anlamı taşır.
///
/// Kaynakta bu değer modül yüklenirken hesaplanıyordu ve hatalı yayın
/// yapılandırmasında import anında patlıyordu. Dart'ta üst düzey değişkenler
/// ZATEN tembeldir (ilk okumada hesaplanır), bu yüzden `late` gerekmez —
/// hata Flutter motoru ayaktayken atılır ve kullanıcı boş beyaz ekran yerine
/// gerçek hata metnini görebilir. Mesaj ve kural aynen korunmuştur.
final String apiBase = resolveApiBase(
  envBase: _envApiBase,
  isDev: kDebugMode,
  platform: currentApiPlatform,
);
