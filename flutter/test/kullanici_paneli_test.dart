// KULLANICI PANELİ — sağdan açılan koyu yan panel (kullanıcı isteği,
// 2026-08-11).
//
// NE SABİTLENİYOR:
//  1. Panelde kullanıcının KENDİ bilgileri görünür (ad + seçtiği takım);
//     referans görseldeki örnek kullanıcı bilgileri değil.
//  2. Menü, Profil sayfasının erişimlerini taşır ve her erişim KAYITLI bir
//     rotaya gider — kayıtsız yola `go` demek go_router'da SESSİZ
//     başarısızlıktır (kullanıcı dokunur, hiçbir şey olmaz, hata da çıkmaz).
//  3. OPERATÖR GİRİŞİ yetki cevabı gelmeden GÖRÜNMEZ. Kapıyı sunucu açar;
//     ters kurgu girişi bir an herkese göstermek olurdu.
//  4. Girişsiz kullanıcıya hesap menüsü değil, ne yapacağı söylenir.

import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:masteranaliz/app.dart';
import 'package:masteranaliz/core/auth.dart' as auth;
import 'package:masteranaliz/core/network/api_client.dart';
import 'package:masteranaliz/core/theme/gorunum.dart';
import 'package:masteranaliz/core/theme/takim_paleti.dart';
import 'package:masteranaliz/core/theme/takim_renkleri.dart';
import 'package:masteranaliz/core/theme/tokens.dart';
import 'package:masteranaliz/features/profile/kullanici_paneli.dart';
import 'package:masteranaliz/widgets/tab_icons.dart';
import 'package:masteranaliz/widgets/avatar.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Yetki ucu dahil her istek 404 — yani "operatör değil".
class _SahteTasiyici implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async => ResponseBody.fromString(
    '{"error":"yok"}',
    404,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );

  @override
  void close({bool force = false}) {}
}

final _kabukAnahtari = GlobalKey<ScaffoldState>();

/// Sabit sayıda kare: veri bekleyen ekranların dönen göstergesi hiç durmadığı
/// için `pumpAndSettle` orada zaman aşımına düşer.
Future<void> _tur(WidgetTester t, [int n = 25]) async {
  for (var i = 0; i < n; i++) {
    await t.pump(const Duration(milliseconds: 16));
  }
}

Future<void> _paneliAc(WidgetTester t) async {
  t.view.physicalSize = const Size(1000, 2000);
  t.view.devicePixelRatio = 1.0;
  addTearDown(() {
    t.view.resetPhysicalSize();
    t.view.resetDevicePixelRatio();
  });

  await t.pumpWidget(
    MaterialApp(
      home: Scaffold(
        key: _kabukAnahtari,
        endDrawer: const KullaniciPaneli(),
        body: const SizedBox.expand(),
      ),
    ),
  );
  _kabukAnahtari.currentState!.openEndDrawer();
  await t.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    api.tasiyici = _SahteTasiyici();
    auth.authState.value = const auth.AuthState(
      token: 'test-belirteci',
      ready: true,
      user: {
        'username': 'emrah41',
        'favorite_team': 'Galatasaray',
        'avatar_type': 'preset',
        'avatar_key': 'ball_01',
      },
    );
  });

  tearDown(() => auth.authState.value = const auth.AuthState());

  group('Panel içeriği — kullanıcının KENDİ bilgileri', () {
    testWidgets('kullanıcı adı ve seçtiği takım görünür', (t) async {
      await _paneliAc(t);
      expect(find.text('emrah41'), findsOne);
      expect(find.text('Galatasaray'), findsOne);
    });

    testWidgets('takım seçilmemişse uydurma takım yazılmaz', (t) async {
      auth.authState.value = const auth.AuthState(
        token: 't',
        ready: true,
        user: {'username': 'emrah41'},
      );
      await _paneliAc(t);
      expect(find.text('Takım seçilmedi'), findsOne);
    });

    testWidgets('Profil sayfasının erişimleri panelde duruyor', (t) async {
      await _paneliAc(t);
      for (final etiket in const [
        'Haftalık Başarı',
        'Hazır Avatar Seç',
        'Takımım',
        'Premium Kodu',
        'Güvenlik Ayarları',
        'Bağlı Cihazlar',
        'Engellenen Kullanıcılar',
        'Hakkında ve Gizlilik',
        'Çıkış Yap',
        'Hesabımı Sil',
      ]) {
        expect(find.text(etiket), findsOne, reason: '"$etiket" panelde yok');
      }
    });

    testWidgets('kullanıcı kartı tam Profil sayfasına götürür', (t) async {
      await _paneliAc(t);
      expect(find.byKey(const Key('panel-kullanici-karti')), findsOne);
    });
  });

  group('Operatör kapısı', () {
    testWidgets('yetki yokken İnceleme girişi GÖRÜNMEZ', (t) async {
      await _paneliAc(t);
      // Yetki ucu 404 döndü → operatör değil.
      expect(find.text('İnceleme'), findsNothing);
      expect(find.byKey(const Key('panel-giris-inceleme')), findsNothing);
    });
  });

  group('Girişsiz kullanıcı', () {
    testWidgets('hesap menüsü değil, giriş daveti gösterilir', (t) async {
      auth.authState.value = const auth.AuthState(ready: true);
      await _paneliAc(t);

      expect(find.byKey(const Key('panel-giris-yap')), findsOne);
      expect(find.text('Haftalık Başarı'), findsNothing);
      expect(find.text('Çıkış Yap'), findsNothing);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TETİKLEYİCİLER — kullanıcı kararı: "her ikisi de açsın".
  // Sağ alttaki profil sekmesi VE sağ alttaki yüzen rozet aynı paneli açar;
  // panel uygulamanın her sekmesinden erişilebilir olmalı.
  // ══════════════════════════════════════════════════════════════════════════
  group('Panelin açılması', () {
    Future<void> uygulamayiAc(WidgetTester t) async {
      t.view.physicalSize = const Size(1100, 2200);
      t.view.devicePixelRatio = 1.0;
      addTearDown(() {
        t.view.resetPhysicalSize();
        t.view.resetDevicePixelRatio();
      });
      // Uygulama üretimde de ProviderScope içinde kurulur (main.dart).
      await t.pumpWidget(
        const ProviderScope(child: MasterAnalizApp(baslangictaKilitli: false)),
      );
      await _tur(t, 30);

      // SIZINTI: yönlendirici uygulama düzeyinde tek bir nesnedir (üretimde
      // doğru; testte testler arasında YAŞAR). Önceki testin bıraktığı rota
      // taşınmasın diye her test bilinen aynı yerden başlar.
      final ctx = t.element(find.byKey(const Key('alt-sekme-Profil')));
      GoRouter.of(ctx).go('/ana-sayfa');
      await _tur(t, 30);
    }

    /// Alt çubuğun sağındaki Profil alanı.
    final profilAlani = find.byKey(const Key('alt-sekme-Profil'));

    testWidgets('sağ alttaki sekme ikonu KULLANICININ KENDİ resmidir', (
      t,
    ) async {
      await uygulamayiAc(t);
      // Nötr silüet (ProfileIcon) değil, avatar çizilir.
      expect(
        find.descendant(of: profilAlani, matching: find.byType(ProfileAvatar)),
        findsOne,
      );
      expect(
        find.descendant(of: profilAlani, matching: find.byType(ProfileIcon)),
        findsNothing,
      );
    });

    testWidgets('girişsizken avatar DEĞİL, nötr silüet çizilir', (t) async {
      auth.authState.value = const auth.AuthState(ready: true);
      await uygulamayiAc(t);
      expect(
        find.descendant(of: profilAlani, matching: find.byType(ProfileAvatar)),
        findsNothing,
      );
      // SİLÜET ARTIK VEKTÖR (2026-08-12): `assets/tab-profile.png` yerine
      // `ProfileIcon` çizilir — raster ikon tema rengini alamıyordu.
      expect(
        find.descendant(of: profilAlani, matching: find.byType(ProfileIcon)),
        findsOne,
      );
    });

    testWidgets('sağ alttaki profil alanına dokunmak paneli açar', (t) async {
      await uygulamayiAc(t);
      expect(find.byKey(const Key('panel-kullanici-karti')), findsNothing);

      await t.tap(profilAlani);
      await t.pumpAndSettle();
      expect(find.byKey(const Key('panel-kullanici-karti')), findsOne);
      expect(find.text('emrah41'), findsOne);
    });

    testWidgets('panel dışına dokununca kapanır', (t) async {
      await uygulamayiAc(t);
      await t.tap(profilAlani);
      await t.pumpAndSettle();
      expect(find.byKey(const Key('panel-kullanici-karti')), findsOne);

      // Karartılmış alana (sol kenar) dokunmak paneli kapatır.
      await t.tapAt(const Offset(20, 400));
      await t.pumpAndSettle();
      expect(find.byKey(const Key('panel-kullanici-karti')), findsNothing);
    });

    // ────────────────────────────────────────────────────────────────────────
    // "menü açılınca hangisine tıklasam o açılsın" — dokunulan satırın ekranı
    // GERÇEKTEN açılıyor mu? Bu, varlık kontrolü değil davranış kontrolüdür:
    // rota yanlışsa ya da bağlam ölmüş bir widget'tan aranırsa dokunuş sessizce
    // hiçbir şey yapar ve ekranda hiçbir hata görünmez.
    // ────────────────────────────────────────────────────────────────────────
    testWidgets('menüdeki satıra dokununca O ekran açılır', (t) async {
      await uygulamayiAc(t);
      await t.tap(profilAlani);
      await t.pumpAndSettle();

      await t.tap(find.byKey(const Key('panel-giris-cihazlar')));
      // TUZAK: burada `pumpAndSettle` KULLANILMAZ. Açılan ekran veri beklerken
      // dönen bir gösterge çizer; o animasyon hiç durmadığı için pumpAndSettle
      // zaman aşımına düşer (gezinme çalışmış olsa bile).
      await _tur(t);

      // Panel kapandı ve Bağlı Cihazlar ekranı açıldı.
      expect(find.byKey(const Key('panel-kullanici-karti')), findsNothing);
      expect(find.widgetWithText(AppBar, 'Bağlı Cihazlar'), findsOne);
    });

    testWidgets('kullanıcı kartına dokununca tam Profil sayfası açılır', (
      t,
    ) async {
      await uygulamayiAc(t);
      await t.tap(profilAlani);
      await t.pumpAndSettle();

      await t.tap(find.byKey(const Key('panel-kullanici-karti')));
      await _tur(t); // bkz. yukarıdaki pumpAndSettle tuzağı

      expect(find.byKey(const Key('panel-kullanici-karti')), findsNothing);
      // Profil sayfasının kendi alanı (panelde olmayan bir satır).
      expect(find.textContaining('Takımım'), findsWidgets);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // BEKÇİ: paneldeki her erişim KAYITLI bir rotaya gitmeli.
  //
  // go_router'da tanımsız yola `go` demek sessizce hiçbir şey yapmaz. Panel,
  // Profil ekranıyla aynı rota adlarını kullanır; biri değişip öteki kalırsa
  // kullanıcı dokunur ve ekran açılmaz — hata da çıkmaz.
  // ══════════════════════════════════════════════════════════════════════════
  group('Rota bekçisi', () {
    test('panelin yolları Profil ekranının kayıtlı yolları arasında', () {
      final panel = File(
        'lib/features/profile/kullanici_paneli.dart',
      ).readAsStringSync();
      final profil = File(
        'lib/features/profile/profile_screen.dart',
      ).readAsStringSync();

      // İlk parametre artık EMOJİ METNİ DEĞİL, `Icons.x` sabiti
      // (2026-08-12) — desen ona göre okur.
      final yollar =
          RegExp(r"_Giris\(\s*Icons\.\w+,\s*'[^']*',\s*'([^']*)',?\s*\)")
              .allMatches(panel)
              .map((m) => m.group(1)!)
              .where((y) => y.isNotEmpty)
              .toSet();

      expect(
        yollar.length,
        greaterThanOrEqualTo(8),
        reason: 'bekçi yolları okuyamadı — _Giris biçimi değişmiş olabilir',
      );
      for (final y in yollar) {
        expect(
          profil.contains("'$y'"),
          isTrue,
          reason:
              '"$y" Profil ekranının kayıtlı yolları arasında yok — panelden '
              'dokunulunca hiçbir şey olmaz',
        );
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PANEL OKUNURLUĞU — TÜM TAKIM TEMALARI (kullanıcı isteği, 2026-08-12 gece)
  //
  // Panelin yazısı bir dönem `onDark` idi ve iki renkli takım temasında o,
  // TAKIM RENGİNİN tonu oluyordu; beyaz panelde her satır ince kırmızı-pembe
  // çıkıyordu (emülatörde ölçüldü, AFC Ajax teması).
  //
  // Kural: satır metni/ikonu/oku NÖTRDÜR ve panel yüzeyinde AA'yı geçer.
  // Ekran görüntüsüyle tek tek bakmak 150 takımı kapsamaz — burada hepsi
  // hesapla taranır.
  // ══════════════════════════════════════════════════════════════════════════
  group('Panel okunurluğu — 150 takım', () {
    test('satır yazısı kendi yüzeyinde AA geçer — 150 takım', () {
      // PANEL DÜZENİ (kullanıcı isteği, 2026-08-12 gece):
      //   zemin  = background (takımın BİRİNCİ rengi)
      //   satır  = surface    (İKİNCİL renk / erişilebilir yüzey)
      //   yazı   = text       (satırın üstünde → birinci rengin tonu)
      // Ekran görüntüsü 150 takımı kapsamaz; hesap burada taranır.
      final dusenler = <String>[];
      for (final ad in kTakimRenkleri.keys) {
        gorunumuKur(GorunumModu.takim, Brightness.light, takimPaletiBul(ad));
        for (final (etiket, renk) in [
          ('text', AppColors.text),
          ('textSoft', AppColors.textSoft),
        ]) {
          final o = kontrastOrani(renk, AppColors.surface);
          if (o < kAaEsigi) {
            dusenler.add('$ad $etiket=${o.toStringAsFixed(2)}');
          }
        }
        // Satır kutusu ZEMİNDEN ayrışmalı, yoksa "kutucuk" görünmez.
        final ayrim = kontrastOrani(AppColors.surface, AppColors.background);
        if (ayrim < 1.12) {
          dusenler.add('$ad satır/zemin=${ayrim.toStringAsFixed(3)}');
        }
      }
      expect(dusenler, isEmpty, reason: dusenler.take(12).join(' · '));
    });

    test('panelde FİLİGRAN çizilmez', () {
      final panel = File(
        'lib/features/profile/kullanici_paneli.dart',
      ).readAsStringSync();
      expect(
        panel.contains('TakimLogoZemin('),
        isFalse,
        reason:
            'filigran menü satırlarının arkasından geçip yazıyı bozuyordu — '
            'panele geri eklenmemeli',
      );
    });
  });
}
