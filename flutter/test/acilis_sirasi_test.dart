// AÇILIŞ SIRASI — `acilisKilitKarari` dikişinin ve `main.dart` yapısının
// regresyon testleri.
//
// NEYİ KİLİTLİYOR: 2026-08-09'da kaldırılan 8 sn'lik `initAuth().timeout(...)`
// iki gerçek hata üretiyordu:
//   1. Ağ yavaşken kesme, `authState.token` dolmadan karar verdiriyordu —
//      girişli kullanıcıya giriş ekranı parlıyor, biyometrik kilit
//      atlanabiliyordu.
//   2. `.timeout` alttaki Future'ı İPTAL ETMEZ; kesilen `initAuth` arkada
//      yaşayıp geç `catch` ile `clearPersisted()` çağırarak oturumu uygulama
//      açıkken KALICI silebiliyordu.
// Düzeltme: açılış yalnız DİSK okuyan `initAuthYerel`i zaman aşımı OLMADAN
// bekler; ağ işi `initAuthUzak` ile arka planda sürer ve oturumu yalnız
// KESİN ret (401) düşürür. Buradaki testler o sözleşmeyi sabitler.

import 'dart:async';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/main.dart';

/// Bir Dart kaynak dosyasından, [imza] ile başlayan işlevin gövdesini kaba
/// ama dürüst biçimde keser (imzadan sonraki ilk satır-başı `}` işaretine
/// kadar). test/biyometrik_kilit_test.dart içindekiyle aynı; test dosyaları
/// birbirinden bağımsız kalsın diye kopyadır.
String _govde(String kaynak, String imza) {
  final bas = kaynak.indexOf(imza);
  if (bas < 0) fail('imza bulunamadı: $imza');
  final son = kaynak.indexOf('\n}', bas);
  if (son < 0) fail('gövde sonu bulunamadı: $imza');
  return kaynak.substring(bas, son);
}

/// [_govde] çıktısından `//` yorum satırlarını süzer: bekçiler KOD arar;
/// bir yorumda geçen `clearPersisted()` sözü yanlış alarm üretmemeli.
String _kod(String govde) =>
    govde.split('\n').where((s) => !s.trimLeft().startsWith('//')).join('\n');

void main() {
  group('acilisKilitKarari — sıra sözleşmesi', () {
    test('kilit kararı, oturum yüklemesi BİTMEDEN alınmaz', () async {
      final yukleme = Completer<void>();
      final sira = <String>[];

      final karar = acilisKilitKarari(
        oturumuYukle: () {
          sira.add('yukleme-basladi');
          return yukleme.future;
        },
        girisliMi: () {
          sira.add('giris-okundu');
          return true;
        },
        kilitGerekliMi: (girisli) async {
          sira.add('kilit-soruldu');
          return girisli;
        },
      );

      // Mikro görevler aksın: yükleme sürerken karar adımları BAŞLAMAMALI.
      await Future<void>.delayed(Duration.zero);
      expect(sira, [
        'yukleme-basladi',
      ], reason: 'yükleme bitmeden giriş durumu okunamaz / kilit sorulamaz');

      yukleme.complete();
      expect(await karar, isTrue);
      expect(sira, ['yukleme-basladi', 'giris-okundu', 'kilit-soruldu']);
    });

    test(
      'YAVAŞ yükleme: oturum geç dolsa da karar DOLMUŞ duruma bakar',
      () async {
        // 8 sn'lik kesme dünyasındaki hatanın minyatürü: oturum belleğe ancak
        // yükleme sonunda gelir. Kesme olsaydı karar `girisli=false` görürdü.
        var girisli = false;

        final karar = await acilisKilitKarari(
          oturumuYukle: () async {
            await Future<void>.delayed(const Duration(milliseconds: 20));
            girisli = true; // disk okuması ancak şimdi bitti
          },
          girisliMi: () => girisli,
          kilitGerekliMi: (g) async => g,
        );

        expect(
          karar,
          isTrue,
          reason: 'girişli kullanıcı yavaş diskte KİLİTSİZ bırakılamaz',
        );
      },
    );

    test(
      'yükleme HATASI açılışı engellemez: oturumsuz+kilitsiz devam',
      () async {
        bool? sorulanGiris;

        final karar = await acilisKilitKarari(
          oturumuYukle: () async => throw StateError('disk okunamadı'),
          girisliMi: () => false,
          kilitGerekliMi: (g) async {
            sorulanGiris = g;
            return g;
          },
        );

        expect(karar, isFalse);
        expect(
          sorulanGiris,
          isFalse,
          reason:
              'hatalı yükleme = oturumsuz açılış; kilit sorusu yine sorulur',
        );
      },
    );

    test('kilit SORGUSU hata verirse uygulama kilitsiz açılır', () async {
      // Erişim kaybettirmek hata durumunun cezası olamaz: tercih bayrağı
      // okunamıyorsa kullanıcı uygulamadan atılmaz. (Oturum zaten şifreyle
      // korunuyor; kilit ek katmandır.)
      final karar = await acilisKilitKarari(
        oturumuYukle: () async {},
        girisliMi: () => true,
        kilitGerekliMi: (_) async => throw StateError('secure storage çöktü'),
      );

      expect(karar, isFalse);
    });

    test(
      'her bağımlılık TAM BİR KEZ çağrılır — karar tek atımlıktır',
      () async {
        var yuklemeSayisi = 0;
        var okumaSayisi = 0;
        var soruSayisi = 0;

        await acilisKilitKarari(
          oturumuYukle: () async => yuklemeSayisi += 1,
          girisliMi: () {
            okumaSayisi += 1;
            return true;
          },
          kilitGerekliMi: (_) async {
            soruSayisi += 1;
            return true;
          },
        );

        expect(yuklemeSayisi, 1);
        expect(okumaSayisi, 1);
        expect(soruSayisi, 1);
      },
    );
  });

  group('main.dart yapısal bekçiler (kaynak taraması)', () {
    final anaKaynak = File('lib/main.dart').readAsStringSync();

    test('runApp TAM BİR KEZ çağrılır', () {
      expect(
        RegExp(r'runApp\(').allMatches(anaKaynak).length,
        1,
        reason: 'ikinci runApp = açılışta ekran değişimi/parlama riski',
      );
    });

    test('kilit kararı runApp\'ten ÖNCE ve beklenerek alınır', () {
      final kararIdx = anaKaynak.indexOf('await acilisKilitKarari(');
      final runAppIdx = anaKaynak.indexOf('runApp(');
      expect(kararIdx, greaterThanOrEqualTo(0), reason: 'karar await edilmeli');
      expect(
        kararIdx,
        lessThan(runAppIdx),
        reason: 'korunan içerik, karar verilmeden ÇİZİLMEYE başlanamaz',
      );
    });

    test('uzak doğrulama arka planda: unawaited(initAuthUzak())', () {
      expect(anaKaynak.contains('unawaited(initAuthUzak())'), isTrue);
    });

    test('8 sn\'lik zaman aşımı GERİ GELMEMİŞ (.timeout yok)', () {
      expect(
        anaKaynak.contains('.timeout('),
        isFalse,
        reason:
            'kesilen Future arkada yaşayıp oturumu geç silebiliyordu — '
            'geri eklenecekse önce bu dosyanın başındaki not okunmalı',
      );
    });
  });

  group('auth.dart yapısal bekçiler (kaynak taraması)', () {
    final authKaynak = File('lib/core/auth.dart').readAsStringSync();

    test('initAuthYerel yalnız DİSK okur — ağ çağrısı yok', () {
      final g = _kod(_govde(authKaynak, 'Future<void> initAuthYerel'));
      expect(
        g.contains('api.'),
        isFalse,
        reason:
            'açılışın beklediği aşamaya ağ çağrısı sızarsa açılış '
            'yeniden ağa bağlanmış olur',
      );
    });

    test('initAuthYerel oturum izini İLK KAREYE taşır (giriş parlamaz)', () {
      final g = _govde(authKaynak, 'Future<void> initAuthYerel');
      expect(
        g.contains(
          r'_set(token: persisted.token ?? kOturumIsareti, '
          'ready: true)',
        ),
        isTrue,
        reason:
            'diskte iz varken ilk kare "girişli" kurulmalı; yoksa '
            'girişli kullanıcıya giriş ekranı parlar ve kilit atlanır',
      );
    });

    test('initAuthUzak oturumu YALNIZ kesin rette (401) temizler', () {
      // Yorum satırları süzülür: satır 136'daki açıklama `clearPersisted()`
      // sözünü İÇERİYOR; bekçi yalnız gerçek kodu saymalı.
      final g = _kod(_govde(authKaynak, 'Future<void> initAuthUzak'));
      final ret = g.indexOf('e.status == 401');
      final temizlik = g.indexOf('clearPersisted');
      expect(ret, greaterThanOrEqualTo(0));
      expect(
        RegExp('clearPersisted').allMatches(g).length,
        1,
        reason: 'birden çok temizlik noktası = 401 koşulu dışına sızma riski',
      );
      expect(
        temizlik,
        greaterThan(ret),
        reason:
            'temizlik 401 koşulunun İÇİNDE olmalı; geçici ağ hatası '
            'kalıcı oturum silmeye dönüşemez',
      );
    });
  });
}
