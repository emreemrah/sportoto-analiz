// KAYNAK: app/test/bahis-sitesi-adi.test.mjs — BİREBİR çeviri.
//
// BAHİS SİTESİ ADI UYGULAMADA GEÇMEZ — kalıcı koruma.
//
// NEDEN: Uygulama bahis sitesi tanıtımı yapamaz (yasal kısıt + mağaza
// politikası). Oynanma yüzdesi kaynakları RENK ADIYLA anılır ("Sarı kaynak")
// ve ekranda renkli noktayla gösterilir; site kimliği (nesine/misli/bilyoner)
// yalnız İÇERİDE, kaynakları birbirine karıştırmamak için kullanılır.
//
// Bu test kaynakta bir kez ihlal edildi: kaynak adları maç satırından
// kaldırılırken "renk lejantı" diye başlığa AD olarak geri kondu. Tarama o
// yüzden var.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/features/radar/provider_labels.dart';

/// Marka adlarının GÖRÜNEN biçimi (baş harfi büyük). Arama BÜYÜK/KÜÇÜK HARFE
/// DUYARLIDIR: küçük harfli 'nesine'/'misli' İÇ KİMLİKTİR (veri ayrımı için
/// zorunlu, ekranda hiç görünmez); yasak olan kullanıcıya yazılabilecek
/// biçimdir.
const List<String> _yasak = [
  'Nesine',
  'Bilyoner',
  'Misli',
  'Oley',
  'İddaa',
  'Iddaa',
];

List<File> _dartDosyalari(Directory dir) => [
  for (final e in dir.listSync(recursive: true))
    if (e is File && e.path.endsWith('.dart')) e,
];

/// Yorum satırlarını ayıklar: yasak kelime YORUMDA geçebilir (kararın
/// gerekçesi yazılabilmeli), KODDA/METİNDE geçemez.
String _yorumsuz(String kaynak) => kaynak
    .replaceAll(RegExp(r'/\*[\s\S]*?\*/'), '')
    .split('\n')
    .where((l) => !RegExp(r'^\s*//').hasMatch(l))
    .join('\n');

void main() {
  test('uygulama kaynağında bahis sitesi adı GEÇMEZ (yorumlar hariç)', () {
    final kok = Directory('lib');
    final ihlaller = <String>[];
    for (final f in _dartDosyalari(kok)) {
      final satirlar = _yorumsuz(f.readAsStringSync()).split('\n');
      for (final ad in _yasak) {
        final i = satirlar.indexWhere((l) => l.contains(ad));
        if (i >= 0) {
          ihlaller.add('${f.path}:${i + 1} → "$ad"');
        }
      }
    }
    expect(
      ihlaller,
      isEmpty,
      reason:
          'Bahis sitesi adı uygulamada görünemez. Kaynaklar renk adıyla '
          'anılır (Sarı/Turuncu/Yeşil kaynak).\n${ihlaller.join('\n')}',
    );
  });

  test('etiket işlevi HAM DEĞERİ geri döndüremez ("|| s" tuzağı)', () {
    // GERÇEK OLAY: providerLabel "PROVIDER_NAMES[s] || s" idi. Sunucu henüz
    // güncellenmemişken ham kimlik gönderdi ve ekranda "nesine · misli" çıktı.
    //
    // Kaynakta bu, dosyayı regex'le tarayarak korunuyordu. Dart'ta işlevi
    // DOĞRUDAN çağırıp davranışı sınamak daha güçlü: kalıp değişse bile
    // koruma ayakta kalır.
    for (final ham in [
      'nesine',
      'misli',
      'bilyoner',
      'oley',
      'iddaa',
      'BILINMEYEN',
      '',
      null,
    ]) {
      final etiket = providerLabel(ham);
      expect(
        _providerAdlari.contains(etiket),
        isTrue,
        reason:
            'providerLabel bilinmeyen anahtarı OLDUĞU GİBİ döndürmemeli '
            '(gelen: "$ham" → "$etiket")',
      );
      for (final ad in _yasak) {
        expect(
          etiket.toLowerCase().contains(ad.toLowerCase()),
          isFalse,
          reason: 'etikete marka adı sızdı: $etiket',
        );
      }
      // Renk de her zaman bilinen paletten gelmeli (çökme/varsayılan yok).
      expect(kProviderColors.containsValue(providerColor(ham)), isTrue);
    }
  });

  test('eski sunucu ham kimlik gönderse bile DOĞRU renge düşer', () {
    // Yayına alınmamış bir sunucu hâlâ ham kimlik gönderebilir; eşleme hem
    // doğru rengi verir hem marka adını ekrana ULAŞTIRMAZ.
    expect(kaynakKodu('nesine'), 'k1');
    expect(kaynakKodu('misli'), 'k2');
    expect(kaynakKodu('bilyoner'), 'k3');
    expect(kaynakKodu('tanınmayan'), 'k0');
    expect(providerLabel('nesine'), 'Sarı kaynak');
  });
}

/// İzin verilen görünür etiketlerin TAMAMI — bu listenin dışına çıkan her şey
/// bir sızıntıdır.
const Set<String> _providerAdlari = {
  'Sarı kaynak',
  'Turuncu kaynak',
  'Yeşil kaynak',
  'Mor kaynak',
  'Mavi kaynak',
  'Kaynak',
};
