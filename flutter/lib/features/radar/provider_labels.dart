// KAYNAK: app/src/components/RadarTabHeaders.js — kaynak kodu/ad/renk eşlemesi.
//
// BAHİS SİTESİ ADI HİÇBİR YERDE GEÇMEZ (yasal/mağaza kısıtı). Kullanıcı
// kaynakları RENK ADIYLA görür; maç satırında renkli nokta durur.
//
// EŞLEME SABİT (k1 sarı · k2 turuncu · k3 yeşil): aynı kaynak her hafta aynı
// kod ve aynı renk olmalı, yoksa kullanıcı haftalar arasında kıyas yapamaz.

import 'package:flutter/material.dart';

const Map<String, String> _providerNames = {
  'k1': 'Sarı kaynak',
  'k2': 'Turuncu kaynak',
  'k3': 'Yeşil kaynak',
  'k4': 'Mor kaynak',
  'k5': 'Mavi kaynak',
  'k0': 'Kaynak',
};

const Map<String, Color> kProviderColors = {
  'k1': Color(0xFFE8B923), // sarı
  'k2': Color(0xFFE8792B), // turuncu
  'k3': Color(0xFF2FA96B), // yeşil
  'k4': Color(0xFF7A6FF0), // mor
  'k5': Color(0xFF3B82F6), // mavi
  'k0': Color(0xFF9AA3AF), // bilinmeyen kaynak — gri
};

// ESKİ SUNUCU KORUMASI. Arka uç kimliği koda çeviriyor, AMA yayına alınmamış
// bir sunucu hâlâ ham kimlik gönderebilir. Bu eşleme onu koda çevirir; hem
// doğru renk çıkar hem marka adı ekrana ULAŞAMAZ.
const Map<String, String> _eskiKimlikler = {
  'nesine': 'k1',
  'misli': 'k2',
  'bilyoner': 'k3',
  'oley': 'k4',
  'iddaa': 'k5',
};

/// Gelen kaynak anahtarını GÜVENLİ koda çevirir.
/// Tanınmayan her değer 'k0' olur — ham değer ASLA geri döndürülmez.
String kaynakKodu(Object? s) {
  final k = '${s ?? ''}'.trim();
  if (_providerNames.containsKey(k)) return k;
  return _eskiKimlikler[k.toLowerCase()] ?? 'k0';
}

// DİKKAT — burada "?? s" YAZILAMAZ. Kaynağın eski hâli tanınmayan anahtarı
// OLDUĞU GİBİ basıyordu; sunucu ham kimlik gönderince ekranda marka adı çıktı.
// Bilinmeyen kaynak "Kaynak" olarak görünür, kimliği asla sızmaz.
String providerLabel(Object? s) => _providerNames[kaynakKodu(s)]!;

Color providerColor(Object? s) => kProviderColors[kaynakKodu(s)]!;

/// Bu hafta veri veren sağlayıcılar SABİT sırayla listelenir; sıra yanıttan
/// gelen rastgele diziliş olsaydı aynı maç her yenilemede farklı görünürdü.
const List<String> _providerOrder = ['k1', 'k2', 'k3', 'k4', 'k5'];

List<Object> aktifSaglayicilar(List? sources) {
  final liste = (sources ?? const []).cast<Object>().toList();
  int sira(Object s) {
    final i = _providerOrder.indexOf(kaynakKodu(s));
    return i >= 0 ? i + 1 : 99;
  }

  liste.sort((a, b) => sira(a).compareTo(sira(b)));
  return liste;
}
