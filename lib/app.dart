// KAYNAK: app/App.js — gezinme yapısı.
//
// Kaynakta 5 alt sekme vardı ve HER SEKMENİN KENDİ YIĞINI (native-stack)
// bulunuyordu. go_router'ın karşılığı `StatefulShellRoute.indexedStack`:
// her dal kendi gezinme geçmişini korur, sekme değişince sıfırlanmaz.
//
// KAYNAKTAN TAŞINAN ÜÇ İNCE DAVRANIŞ:
//
//  1. `popToTopOnBlur: true` — sekmeden ayrılınca o yığın köke döner. Böylece
//     "Bülteni Aç" ya da alt sekme HER ZAMAN hedef ekrana götürür; eski
//     gezintiden kalan maç detayı karşına çıkmaz.
//
//  2. `MatchDetail` ve `KriterKirilim` DÖRT ayrı yığında birden kayıtlıydı.
//     Kaynaktaki not açık: yalnız Profil yığınına konulduğunda diğer
//     sekmelerden "kritere tıklanmıyor" şikâyeti çıkıyordu — rota o yığında
//     YOK ve navigate SESSİZCE başarısız oluyordu. Aynı yol burada da her
//     dala ayrı ayrı kaydedilecek (Adım 2).
//
//  3. Alt sekme çubuğu stili TEK yerde durur (aşağıdaki sabitler). Kaynakta
//     bunun gerekçesi yazılıydı: seçenekleri yayarak birleştiren yapıda
//     stilin "undefined" ile ezilmesi diğer ekranlarda çubuğu bozuyordu.

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'core/auth.dart' as auth;
import 'core/brand.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/gorunum.dart';
import 'core/theme/takim_temasi.dart';
import 'core/theme/tokens.dart';
import 'features/bulletin/bulletin_screen.dart';
import 'features/bulletin_history/bulletin_detail_screen.dart';
import 'features/bulletin_history/bulletin_history_screen.dart';
import 'features/coupon/coupon_center_screen.dart';
import 'features/coupon/coupon_editor_screen.dart';
import 'features/coupon/coupon_result_screen.dart';
import 'features/coupon/coupon_share_screen.dart';
import 'features/dashboard/system_dashboard_screen.dart';
import 'features/dashboard/system_scorecard_screen.dart';
import 'features/dashboard/user_dashboard_screen.dart';
import 'features/forum/forum_screen.dart';
import 'features/moderation/moderation_screen.dart';
import 'features/home/home_screen.dart';
import 'features/match_detail/kriter_kirilim_screen.dart';
import 'features/match_detail/match_detail_screen.dart';
import 'features/notifications/notifications_screen.dart';
import 'features/profile/about_screen.dart';
import 'features/profile/auth_screens.dart';
import 'features/profile/avatar_picker_screen.dart';
import 'features/profile/blocked_users_screen.dart';
import 'features/profile/delete_account_screen.dart';
import 'features/profile/devices_screen.dart';
import 'features/profile/gorunum_secim_screen.dart';
import 'features/profile/kullanici_paneli.dart';
import 'features/profile/premium_code_screen.dart';
import 'features/profile/profile_screen.dart';
import 'features/profile/security_settings_screen.dart';
import 'features/profile/team_picker_screen.dart';
import 'widgets/avatar.dart';
import 'features/radar/radar_screen.dart';
import 'features/security/biometric_lock_screen.dart';
import 'features/week/week_recap_screen.dart';
import 'features/week/week_summary_screen.dart';
import 'widgets/tab_icons.dart';

/// MAÇ DETAYI + KRİTER KIRILIMI ROTALARI — HER DALA AYRI AYRI kaydedilir.
///
/// Kaynaktaki not aynen geçerli: `MatchDetail` ve `KriterKirilim` dört ayrı
/// yığında kayıtlıydı ve yalnız birine konulduğunda diğer sekmelerden gezinme
/// SESSİZCE başarısız oluyordu (rota o yığında yok → navigate hiçbir şey
/// yapmaz, hata da vermez). Bu yüzden tanım tek yerde tutulur ama HER dala
/// eklenir.
List<GoRoute> _ortakRotalar() => [
  GoRoute(
    path: 'mac/:no',
    builder: (context, state) => MatchDetailScreen(
      no: state.pathParameters['no']!,
      initialTab: state.uri.queryParameters['tab'],
    ),
  ),
  GoRoute(
    path: 'kupon-editor/:roundId',
    builder: (context, state) {
      // TİP TUZAĞI: yol parametresi her zaman METİNDİR ('1528'), oysa
      // bülten ve kupon deposu roundId'yi SAYI tutar (1528). Ham metinle
      // karşılaştırmak "bu hafta güncel bülten değil" hatasına yol açıyor
      // ve kupon deposu da yanlış anahtarla arıyordu. Burada bir kez
      // sayıya çevrilir; ekranların hepsi aynı tipi görür.
      final ham = state.pathParameters['roundId']!;
      return CouponEditorScreen(
        roundId: int.tryParse(ham) ?? ham,
        couponId: state.uri.queryParameters['couponId'],
      );
    },
  ),
  GoRoute(
    path: 'kriter/:key',
    builder: (context, state) => KriterKirilimScreen(
      kriterKey: state.pathParameters['key']!,
      ad: state.uri.queryParameters['ad'],
    ),
  ),
  // BÜLTEN DETAYI — kaynakta `HomeScreen.js:367` geçmiş hafta maçına
  // dokununca `navigate('BulletinDetail', { bulletinId: match.roundId })`
  // diyor. O gezinme SEKME DEĞİŞTİRMEZ, bulunulan yığına biner; bu yüzden
  // rota `/bulten/gecmis/:id` altında bırakılmadı (oraya gitmek kullanıcıyı
  // Bülten sekmesine atardı ve geri dönünce Ana Sayfa'ya değil Bülten'e
  // düşerdi). Ortak rota olarak her dala eklenir — `mac/:no` ile aynı gerekçe.
  GoRoute(
    path: 'bulten-detay/:bulletinId',
    builder: (context, state) =>
        BulletinDetailScreen(bulletinId: state.pathParameters['bulletinId']!),
  ),
];

// Kaynaktaki TAB_BAR_STYLE.
const double _kTabBarHeight = 64;
const double _kTabBarPaddingTop = 7;
const double _kTabBarPaddingBottom = 8;

final _rootKey = GlobalKey<NavigatorState>();

final _router = GoRouter(
  navigatorKey: _rootKey,
  initialLocation: '/bulten',
  routes: [
    StatefulShellRoute.indexedStack(
      builder: (context, state, shell) => _AnaKabuk(shell: shell),
      branches: [
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/ana-sayfa',
              builder: (_, _) => const HomeScreen(),
              routes: [
                ..._ortakRotalar(),
                // Haftanın Özeti / Hafta Kapanışı yalnız Ana Sayfa'dan açılır
                // (kaynakta da giriş noktası tek: hafta kartındaki iki düğme).
                GoRoute(
                  path: 'hafta-ozeti',
                  builder: (_, _) => const WeekSummaryScreen(),
                ),
                GoRoute(
                  path: 'hafta-kapanisi',
                  builder: (context, state) => WeekRecapScreen(
                    roundId: state.uri.queryParameters['roundId'],
                  ),
                ),
                GoRoute(
                  path: 'bildirimler',
                  builder: (_, _) => const NotificationsScreen(),
                ),
                // TOPLULUK — kaynakta kayıtlı ama arayüzde GİRİŞ NOKTASI YOK:
                // Ana Sayfa'daki "Toplulukta Gündem" bölümü kullanıcı isteğiyle
                // kaldırıldı (içeriği sahte örnekti). Rota aynı sebeple burada
                // duruyor; ekrana düğme EKLENMEDİ, çünkü eklemek kaldırılan
                // bölümü geri getirmek olurdu.
                GoRoute(path: 'forum', builder: (_, _) => const ForumScreen()),
              ],
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/bulten',
              builder: (_, _) => const BulletinScreen(),
              routes: [
                ..._ortakRotalar(),
                // Bülten Geçmişi yalnız Bülten dalından açılır (kaynakta da
                // giriş noktası tek: bülten altındaki "📜 Bülten Geçmişi").
                GoRoute(
                  path: 'gecmis',
                  builder: (_, _) => const BulletinHistoryScreen(),
                  routes: [
                    GoRoute(
                      path: ':bulletinId',
                      builder: (context, state) => BulletinDetailScreen(
                        bulletinId: state.pathParameters['bulletinId']!,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/radar',
              builder: (_, _) => const RadarScreen(),
              routes: _ortakRotalar(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/kuponlarim',
              builder: (_, _) => const CouponCenterScreen(),
              routes: [
                ..._ortakRotalar(),
                GoRoute(
                  path: 'kupon-sonuc/:roundId',
                  builder: (context, state) {
                    // roundId aynı tip tuzağı: yol parametresi METİN gelir,
                    // depo ve bülten SAYI tutar (bkz. kupon editörü notu).
                    final ham = state.pathParameters['roundId']!;
                    final q = state.uri.queryParameters;
                    return CouponResultScreen(
                      roundId: int.tryParse(ham) ?? ham,
                      couponId: q['couponId'],
                      roundName: q['roundName'],
                      season: q['season'],
                    );
                  },
                ),
                GoRoute(
                  path: 'kupon-paylas/:couponId',
                  builder: (context, state) {
                    final q = state.uri.queryParameters;
                    final ham = q['roundId'] ?? '';
                    return CouponShareScreen(
                      couponId: state.pathParameters['couponId']!,
                      roundId: int.tryParse(ham) ?? ham,
                      roundName: q['roundName'],
                      season: q['season'],
                    );
                  },
                ),
              ],
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/profil',
              builder: (_, _) => const ProfileScreen(),
              routes: [
                GoRoute(path: 'giris', builder: (_, _) => const LoginScreen()),
                GoRoute(
                  path: 'kayit',
                  builder: (_, _) => const RegisterScreen(),
                ),
                GoRoute(
                  path: 'sifremi-unuttum',
                  builder: (_, _) => const ForgotPasswordScreen(),
                ),
                GoRoute(
                  path: 'avatar',
                  builder: (_, _) => const AvatarPickerScreen(),
                ),
                GoRoute(
                  path: 'takim-sec',
                  builder: (_, _) => const TeamPickerScreen(),
                ),
                GoRoute(
                  path: 'gorunum',
                  builder: (_, _) => const GorunumSecimScreen(),
                ),
                GoRoute(
                  path: 'basari-panelim',
                  builder: (_, _) => const UserDashboardScreen(),
                ),
                GoRoute(
                  path: 'sistem-karnesi',
                  builder: (_, _) => const SystemScorecardScreen(),
                ),
                GoRoute(
                  path: 'inceleme',
                  builder: (_, _) => const ModerationScreen(),
                ),
                // GELİŞTİRİCİ EKRANI — kaynakta yalnız geliştirme derlemesinde
                // kayıtlıdır (App.js: `IS_DEV_BUILD ? … : null`). Yayın
                // derlemesinde demo/örnek veri içeren hiçbir ekran gezinmeye
                // açılmaz; `kDebugMode` sabiti bu dalı paketten TAMAMEN atar.
                if (kDebugMode)
                  GoRoute(
                    path: 'sistem-panosu',
                    builder: (_, _) => const SystemDashboardScreen(),
                  ),
                GoRoute(
                  path: 'premium-kod',
                  builder: (_, _) => const PremiumCodeScreen(),
                ),
                GoRoute(
                  path: 'guvenlik',
                  builder: (_, _) => const SecuritySettingsScreen(),
                ),
                GoRoute(
                  path: 'cihazlar',
                  builder: (_, _) => const DevicesScreen(),
                ),
                GoRoute(
                  path: 'engellenenler',
                  builder: (_, _) => const BlockedUsersScreen(),
                ),
                GoRoute(
                  path: 'hakkinda',
                  builder: (_, _) => const AboutScreen(),
                ),
                GoRoute(
                  path: 'hesap-sil',
                  builder: (_, _) => const DeleteAccountScreen(),
                ),
              ],
            ),
          ],
        ),
      ],
    ),
  ],
);

/// KAYNAK: App.js — `locked ? <BiometricLockScreen/> : <NavigationContainer/>`
///
/// Kilitliyken yönlendirici (router) ağacı HİÇ KURULMAZ; korunan ekranlar bir
/// kare bile çizilmez. `MaterialApp.router`ın `builder`ına bindirmek yeterli
/// olmazdı: orada router alt ağacı yine kurulur ve ekranlar arka planda
/// oluşturulurdu.
class MasterAnalizApp extends StatefulWidget {
  const MasterAnalizApp({super.key, this.baslangictaKilitli = false});

  /// `main.dart` oturumu yükledikten SONRA hesaplar (bkz. `needsLockOnLaunch`).
  /// Karar burada değil orada verilir; widget yalnız sonucu taşır.
  final bool baslangictaKilitli;

  @override
  State<MasterAnalizApp> createState() => _MasterAnalizAppState();
}

class _MasterAnalizAppState extends State<MasterAnalizApp>
    with WidgetsBindingObserver {
  late bool _kilitli = widget.baslangictaKilitli;

  @override
  void initState() {
    super.initState();
    // Cihazın açık/koyu ayarı DEĞİŞİNCE haber alınır. `MediaQuery` bu
    // widget'ın ÜSTÜNDE yoktur (onu MaterialApp kurar), bu yüzden parlaklık
    // `PlatformDispatcher`tan okunur ve değişimi gözlemciyle dinlenir.
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangePlatformBrightness() {
    // Yalnız 'sistem' tercihinde bir şey değişir; yine de koşulsuz yeniden
    // çizmek en ucuzu ve idempotent.
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) => ValueListenableBuilder<GorunumModu>(
    valueListenable: gorunumNotifier,
    builder: (context, modu, _) => _govde(modu),
  );

  Brightness get _cihazParlakligi =>
      WidgetsBinding.instance.platformDispatcher.platformBrightness;

  Widget _govde(GorunumModu modu) {
    if (_kilitli) {
      // Router YOK: yalnız kilit ekranı. Burada favori takım paleti KULLANILMAZ
      // — kilit, oturum açılmadan da görünebilir; takım modu da olsa kilit
      // ekranı görünüm tercihinin açık/koyu karşılığını kullanır.
      final etkin = etkinParlaklik(_cihazParlakligi, modu);
      gorunumuUygula(etkin);
      return MaterialApp(
        title: kAppName,
        debugShowCheckedModeBanner: false,
        theme: AppTheme.gecerli(etkin),
        home: BiometricLockScreen(
          onUnlock: () => setState(() => _kilitli = false),
        ),
      );
    }

    // GÖRÜNÜM BURADA KURULUR — palet gerektiği için auth'un İÇİNDE.
    //
    // 'takim' modunda tema favori takımın paletinden gelir, o palet de
    // `auth.authState`ten okunur. Kullanıcı takımını değiştirdiğinde bu
    // dinleyici zaten yeniden çalışır, yani TEMA DA KENDİLİĞİNDEN yeni
    // takıma geçer (kullanıcı isteği).
    //
    // Diğer üç modda palet yalnız ağaca verilir; onu okuyan yerler kimlik
    // alanlarıdır (profil, arma, filigran) — yapısal renklere karışmaz.
    return ValueListenableBuilder<auth.AuthState>(
      valueListenable: auth.authState,
      builder: (context, s, _) {
        final palet = favoriTakimPaleti(s);
        // `AppTheme` ve bütün ekranlar renkleri `AppColors`tan okur; tema
        // kurulmadan ÖNCE doğru paletin yazılmış olması gerekir.
        // İdempotenttir ve `setState` tetiklemez.
        final etkin = gorunumuKur(modu, _cihazParlakligi, palet);

        return MaterialApp.router(
          // Kaynakta `documentTitle` merkezî marka kaynağından besleniyordu;
          // aynı sabit kullanılır — ekran adları başlığa SIZMAZ.
          title: kAppName,
          debugShowCheckedModeBanner: false,
          theme: AppTheme.gecerli(etkin),
          routerConfig: _router,
          // Rotalar, modallar ve alt sayfalar Navigator'ın altındadır; kabuk
          // buraya takılınca hepsi aynı paleti görür.
          builder: (context, child) => TakimTemasi(
            palet: palet,
            // GÖRÜNÜM DEĞİŞİNCE AĞAÇ YENİDEN KURULUR (2026-08-12, emülatörde
            // görüldü ve düzeltildi).
            //
            // BELİRTİ (takım teması döneminde ölçüldü): tema değişince
            // sayfanın gövdesi yeni renge döndü ama maç detayının başlığı,
            // sekme çubuğu ve "Kupona İşle" bloğu ESKİ renkte kaldı.
            //
            // SEBEP: uygulamanın neredeyse tamamı renkleri `AppColors`
            // KÜRESELLERİNDEN okuyor, yani hiçbir InheritedWidget'a BAĞIMLI
            // değil. Üstelik `child` widget örneği değişmediği için Flutter o
            // alt ağacı hiç yeniden kurmuyor — eski renklerle çizilmiş hâli
            // olduğu gibi kalıyor.
            //
            // ÇÖZÜM: etkin görünümü anahtara koymak. Anahtar değişince
            // Flutter alt ağacın elemanlarını atar ve HER widget'ın `build`i
            // yeniden çalışır; hepsi `AppColors`ın yeni değerlerini okur.
            //
            // TAKIM ADI DA ANAHTARDA: takım artık yapısal renkleri
            // değiştirmiyor ama filigran ve kimlik vurguları onu okuyor;
            // favori değişince o yüzeyler de yenilenmeli.
            //
            // BEDELİ: görünüm/takım değiştiğinde ekran içi durum (kaydırma
            // konumu, açılmış paneller) sıfırlanır. Rota GoRouter'da
            // tutulduğu için hangi ekranda olunduğu KORUNUR. İkisi de nadir
            // ve bilinçli eylemdir; yarısı eski temada kalan bir ekrandansa
            // sıfırlanan bir kaydırma tercih edilir.
            child: KeyedSubtree(
              // MOD DA ANAHTARDA: 'açık' ile açık temalı bir takımın 'takım'
              // modu AYNI parlaklığı verir; mod anahtarda olmasaydı ikisi
              // arasında geçişte ağaç yeniden kurulmaz ve renkler eski
              // kalırdı.
              key: ValueKey(
                '${modu.anahtar}|${etkin.name}|'
                '${palet?.takim ?? '_varsayilan'}',
              ),
              child: child ?? const SizedBox.shrink(),
            ),
          ),
        );
      },
    );
  }
}

class _AnaKabuk extends StatefulWidget {
  const _AnaKabuk({required this.shell});

  final StatefulNavigationShell shell;

  @override
  State<_AnaKabuk> createState() => _AnaKabukState();
}

class _AnaKabukState extends State<_AnaKabuk> {
  /// Paneli açmak Scaffold'un kendi işidir; ona ulaşmak için anahtar gerekir.
  final _kabukAnahtari = GlobalKey<ScaffoldState>();

  StatefulNavigationShell get shell => widget.shell;

  void _paneliAc() => _kabukAnahtari.currentState?.openEndDrawer();

  @override
  Widget build(BuildContext context) {
    final aktif = shell.currentIndex;

    return ValueListenableBuilder<auth.AuthState>(
      valueListenable: auth.authState,
      builder: (context, s, _) => _kabuk(aktif, s.girisli && s.user != null),
    );
  }

  Widget _kabuk(int aktif, bool girisli) {
    return Scaffold(
      key: _kabukAnahtari,
      body: shell,
      // KULLANICI PANELİ — ekranın SAĞINDAN açılır. Arkasının kararması, panel
      // dışına dokununca ve geri hareketiyle kapanması Scaffold'un kendi
      // davranışıdır; elle kurulmuş bir kapatma mantığı yoktur.
      endDrawer: const KullaniciPaneli(),
      // YÜZEN ROZET KALDIRILDI (2026-08-11, kullanıcı: "profil resmi sağ
      // alttaki mavi adamın oraya gelsin"): avatar artık alt çubuktaki Profil
      // sekmesinin kendi ikonu. Aynı köşede aynı resmi iki kez göstermek
      // tekrardı; panelin girişi tek ve beklenen yerde.
      bottomNavigationBar: Container(
        // ALT MENÜ — yapısal yüzey; takım teması varsa onun yüzey rengi.
        decoration: BoxDecoration(
          color: AppColors.surface,
          border: Border(top: BorderSide(color: AppColors.border)),
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: _kTabBarHeight,
            child: Padding(
              padding: const EdgeInsets.only(
                top: _kTabBarPaddingTop,
                bottom: _kTabBarPaddingBottom,
              ),
              child: Row(
                children: [
                  _sekme(
                    0,
                    aktif,
                    'Ana Sayfa',
                    _pngIkon('assets/tab-home.png', aktif == 0),
                  ),
                  _sekme(
                    1,
                    aktif,
                    'Bülten',
                    _pngIkon('assets/tab-bulletin.png', aktif == 1),
                  ),
                  _sekme(
                    2,
                    aktif,
                    'Radar',
                    RadarIcon(
                      color: aktif == 2 ? AppColors.accent : AppColors.muted,
                    ),
                  ),
                  _sekme(
                    3,
                    aktif,
                    'Kuponlarım',
                    TicketIcon(
                      color: aktif == 3 ? AppColors.accent : AppColors.muted,
                    ),
                  ),
                  // PROFİL SEKMESİ — giriş yapmış kullanıcıda Profil dalına
                  // ATLAMAZ, sağdaki paneli açar (kullanıcı kararı). Profil
                  // sayfasının tamamına panelin üstündeki kullanıcı kartından
                  // geçilir. Girişsizken eski davranış korunur: dokunmak giriş
                  // ekranını açar.
                  //
                  // İKON — giriş yapmışsa KULLANICININ KENDİ RESMİ (kullanıcı
                  // isteği, 2026-08-11): sağ alttaki nötr silüetin yerini
                  // avatar alır. Girişsizken silüet kalır; olmayan bir hesabın
                  // resmi gösterilmez.
                  _sekme(
                    4,
                    aktif,
                    'Profil',
                    girisli
                        ? _avatarIkon(aktif == 4)
                        : _pngIkon('assets/tab-profile.png', aktif == 4),
                    onTap: girisli ? _paneliAc : null,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// Kaynaktaki `TabIcon`: 28×28, odakta tam, odak dışında %50 opaklık.
  Widget _pngIkon(String yol, bool odakta) => Opacity(
    opacity: odakta ? 1 : 0.5,
    child: Image.asset(yol, width: 28, height: 28, fit: BoxFit.contain),
  );

  /// Profil sekmesinin ikonu olarak kullanıcının kendi avatarı.
  ///
  /// Diğer sekmelerdeki %50 opaklık BURAYA UYGULANMAZ: kullanıcının resmini
  /// soluklaştırmak onu "pasif" göstermek olurdu. Odak, ikonun etrafındaki
  /// halkayla belirtilir — diğer sekmelerdeki accent vurgusunun karşılığı.
  Widget _avatarIkon(bool odakta) => Container(
    width: 28,
    height: 28,
    decoration: BoxDecoration(
      shape: BoxShape.circle,
      border: Border.all(
        color: odakta ? AppColors.accent : Colors.transparent,
        width: 2,
      ),
    ),
    child: const ProfileAvatar(size: 24),
  );

  Widget _sekme(
    int index,
    int aktif,
    String etiket,
    Widget ikon, {
    VoidCallback? onTap,
  }) {
    final odakta = index == aktif;
    return Expanded(
      key: Key('alt-sekme-$etiket'),
      child: Semantics(
        button: true,
        selected: odakta,
        label: etiket,
        child: InkWell(
          onTap:
              onTap ??
              () => shell.goBranch(
                index,
                // popToTopOnBlur karşılığı: zaten açık sekmeye tekrar dokunmak
                // o dalı köküne döndürür.
                initialLocation: index == aktif,
              ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              ikon,
              const SizedBox(height: 2),
              Text(
                etiket,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: AppFont.heavy,
                  // SEÇİLİ SEKME — takım vurgusu.
                  color: odakta ? AppColors.accent : AppColors.textMuted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
