// TERCİHLER ERKEN YAZMAYLA SİLİNMEZ.
//
// GERÇEKTE YAŞANAN (16 Ağustos 2026): kullanıcı takım temasını seçti; sonraki
// bir açılışta uygulama varsayılan AÇIK temada açıldı ve diskte
// `gorunumModu` 'sistem'e dönmüştü.
//
// KÖK NEDEN: tüm tercihler TEK JSON blob'unda tutuluyor ve `setPref` blob'un
// TAMAMINI yazıyor. Açılışta disk yüklenmeden `_cache` yalnız varsayılanlardır;
// o pencerede herhangi bir tercih yazılırsa (liste sıralaması, takip edilen
// maç, kupon ayarı…) diskteki KAYITLI TERCİHLERİN HEPSİ eziliyordu.
//
// Yükleme tarafında ters yön zaten korunuyordu (geç gelen disk, taze seçimi
// ezmiyor). Eksik olan bu yöndü: erken yazma diski ezmemeli.

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/prefs.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _anahtar = 'sportoto.prefs';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('disk yüklenmeden yapılan yazma, KAYITLI tercihleri EZMEZ', () async {
    // Diskte kullanıcının seçimleri var.
    SharedPreferences.setMockInitialValues({
      _anahtar: '{"gorunumModu":"takim","histSort":"resolvedTop"}',
    });

    // Disk HENÜZ yüklenmeden bir tercih değişiyor (gerçek senaryo: açılışta
    // bir ekran kendi ayarını yazıyor).
    setPref('liveSort', 'liveTop');

    // KRİTİK AN: yazma "ateşle-unut" olduğu için ona zaman tanınır. Hata
    // buradaydı — bu pencerede disk VARSAYILANLARLA eziliyordu. Kontrolü
    // yükleme SONRASINA bırakmak hatayı gizler: yükleme sonrası doğru yazma
    // ezilmiş kaydı düzeltir ve test boşuna yeşil kalır (ölçüldü).
    await Future<void>.delayed(const Duration(milliseconds: 30));
    final spErken = await SharedPreferences.getInstance();
    expect(
      spErken.getString(_anahtar),
      contains('"gorunumModu":"takim"'),
      reason: 'disk yüklenmeden yapılan yazma KAYITLI tercihleri ezmiş',
    );

    // Şimdi disk yükleniyor.
    await prefsYukle();
    await Future<void>.delayed(const Duration(milliseconds: 30));

    // Kullanıcının kayıtlı seçimi DURUYOR…
    expect(getPref('gorunumModu'), 'takim', reason: 'tema seçimi silinmiş');
    expect(getPref('histSort'), 'resolvedTop');
    // …ve erken yapılan değişiklik de kaybolmamış.
    expect(getPref('liveSort'), 'liveTop');

    // Diske de doğru birleşim yazılmış olmalı.
    final sp = await SharedPreferences.getInstance();
    final ham = sp.getString(_anahtar)!;
    expect(ham, contains('"gorunumModu":"takim"'));
    expect(ham, contains('"liveSort":"liveTop"'));
  });

  test('disk yüklendikten SONRA yazma normal çalışır', () async {
    SharedPreferences.setMockInitialValues({
      _anahtar: '{"gorunumModu":"koyu"}',
    });
    await prefsYukle();
    setPref('gorunumModu', 'takim-ters');
    await Future<void>.delayed(const Duration(milliseconds: 20));

    final sp = await SharedPreferences.getInstance();
    expect(sp.getString(_anahtar), contains('"gorunumModu":"takim-ters"'));
    expect(getPref('gorunumModu'), 'takim-ters');
  });
}
