// KULLANICI PANELİ — sağdan açılan koyu yan panel (kullanıcı isteği,
// 2026-08-11).
//
// NE: Alt çubuğun sağındaki profil alanına (ve sağ alttaki yüzen rozete)
// dokununca ekranın SAĞINDAN açılan, arkasını karartan koyu panel. Üstte
// kullanıcının kendi bilgileri, altında Profil sayfasının erişimleri.
//
// REFERANS GÖRSELLER YALNIZ DÜZEN İÇİNDİR: Screenshot_20/21 yalnız
// tetikleyicinin yeri, panelin sağdan açılması, koyu tema ve boşluk düzeni için
// örnek alındı. Oradaki yazılar, menü adları ve örnek kullanıcı bilgileri
// KOPYALANMADI — buradaki her satır uygulamanın kendi ekranlarından gelir.
//
// KARARTMA / KAPANMA: panel bir `endDrawer`'dır. Arkasının kararması, panel
// dışına dokununca ve geri hareketiyle kapanması Scaffold'un kendi davranışıdır
// — elle kurulmuş bir kapatma mantığı YOKTUR (kurulsaydı geri tuşuyla
// uyumsuzlaşırdı).
//
// FAVORİ TAKIM ARMASI BURADA ÇEKİLMEZ: arma, ad → katalog eşlemesiyle bulunur
// (`api.favoriteTeams()`, profil ekranında yapılıyor) ve o katalog bütün
// liglerin takımlarını taşır. Paneli her açılışta o isteği atmak, hızlı
// açılması gereken bir yüzey için pahalıdır. Panelde takımın ADI yazar; arma
// tam Profil sayfasında görünür. BAŞKA kulübün arması ASLA konmaz.

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth.dart' as auth;
import '../../core/network/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../widgets/avatar.dart';
import '../../widgets/takim_logo_zemin.dart';

/// Geliştirme derlemesi mi? Yayın derlemesinde bu kapı DAİMA kapalıdır
/// (profile_screen.dart'taki kuralın aynısı).
const bool _kIsDevBuild = !bool.fromEnvironment('dart.vm.product');

// Koyu panel paleti — projenin kendi koyu renklerinden türetildi, yeni renk
// uydurulmadı.
//
// GETTER, `final` DEĞİL: modül düzeyi `final` Dart'ta BİR KEZ hesaplanır. Takım
// teması `AppColors`ı çalışma zamanında değiştirdiği için `final` yazılsaydı bu
// üç renk ilk okundukları andaki tonda DONAR ve panel takım değişince eski
// renkte açılırdı. `_ayrac` gerçekten sabit (yarı saydam beyaz), o `const`.
// DÜZELTME (2026-08-12, emülatörde görüldü): panel zemini `primaryDark`
// okuyordu. `primaryDark = karart(secili, 0.2)` ve KOYU temalı bir takımda
// `secili` zaten AÇIK bir renktir (Beşiktaş #D1D1D1, BB Erzurumspor açık
// mavi) — onu %20 karartmak koyu panel değil GRİ panel verir. Ekranda
// ölçüldü: BB Erzurumspor temasında panel gri açılıyordu.
//
// Doğru kaynak `darkCard`: koyu panel için üretilen, her temada zeminden
// ayrışan ve `onDark` / `onDarkSoft` ile AA sağlayan token.
Color get _zemin => AppColors.darkCard;
Color get _satir => AppColors.darkCardSoft;
Color get _ayrac => AppColors.onDark.withValues(alpha: 0.12);

// `muted` AÇIK yüzeylere (kart, zemin, ara şerit) göre hesaplanır; koyu
// panelin üstünde okunacağının garantisi yok. Koyu panelin kendi soluk
// metni kullanılır.
Color get _ikincilYazi => AppColors.onDarkSoft;

/// Paneldeki bir erişim satırı.
class _Giris {
  const _Giris(this.ikon, this.etiket, this.yol);

  final String ikon;
  final String etiket;

  /// `/profil/<yol>` rotası.
  final String yol;
}

/// Profil sayfasındaki erişimlerin AYNISI, aynı sırayla. Yeni bir alt ekran
/// eklenirken iki yerde de görünmeli; rota adları `profile_screen.dart`
/// içindeki `hazir` kümesiyle birebir aynıdır.
const List<_Giris> _kGirisler = [
  _Giris('📊', 'Haftalık Başarı', 'basari-panelim'),
  _Giris('⚽', 'Hazır Avatar Seç', 'avatar'),
  _Giris('🏳️', 'Takımım', 'takim-sec'),
  _Giris('🌗', 'Görünüm', 'gorunum'),
  _Giris('⭐', 'Premium Kodu', 'premium-kod'),
  _Giris('🔐', 'Güvenlik Ayarları', 'guvenlik'),
  _Giris('📱', 'Bağlı Cihazlar', 'cihazlar'),
  _Giris('🚫', 'Engellenen Kullanıcılar', 'engellenenler'),
  _Giris('ℹ️', 'Hakkında ve Gizlilik', 'hakkinda'),
];

/// Yalnız operatöre görünen erişimler (kapıyı SUNUCU açar).
const _Giris _kInceleme = _Giris('🛡️', 'İnceleme', 'inceleme');
const _Giris _kSistemKarnesi = _Giris('📊', 'Sistem Karnesi', 'sistem-karnesi');

class KullaniciPaneli extends StatefulWidget {
  const KullaniciPaneli({super.key});

  @override
  State<KullaniciPaneli> createState() => _KullaniciPaneliState();
}

class _KullaniciPaneliState extends State<KullaniciPaneli> {
  /// İNCELEME GİRİŞİ — kararı SUNUCU verir. `false` BAŞLANGIÇTIR: yetki cevabı
  /// gelene kadar giriş görünmez (profile_screen.dart'taki kuralın aynısı; ters
  /// kurgu girişi bir an herkese göstermek olurdu).
  bool _operator = false;
  String? _sonYetkiTokeni;

  Future<void> _yetkiSor(String? token) async {
    if (token == null) {
      if (mounted) setState(() => _operator = false);
      return;
    }
    try {
      final r = await api.moderationAccess();
      if (mounted) {
        setState(() => _operator = (r is Map) && r['operator'] == true);
      }
    } catch (_) {
      if (mounted) setState(() => _operator = false);
    }
  }

  /// Panel kapanır, SONRA gezinilir: açık kalan panelin altından ekran
  /// değiştirmek kullanıcıyı nerede olduğundan emin edemez.
  ///
  /// Yönlendirici `pop`'TAN ÖNCE alınır. Ölçtüm: ters sırada da çalışıyor
  /// (panel animasyonla kapandığı için bağlam o karede hâlâ diri). Yine de
  /// bağlamın ömrüne bel bağlamamak için sıra böyle — kapanış davranışı
  /// değişirse dokunuş sessizce ölmesin.
  void _git(String yol) {
    final yonlendirici = GoRouter.of(context);
    Navigator.of(context).pop();
    yonlendirici.go('/profil/$yol');
  }

  /// Aynı sıra: önce yönlendirici, sonra kapat, sonra git.
  void _profilSayfasiniAc() {
    final yonlendirici = GoRouter.of(context);
    Navigator.of(context).pop();
    yonlendirici.go('/profil');
  }

  @override
  Widget build(BuildContext context) {
    final genislik = (MediaQuery.of(context).size.width * 0.82).clamp(
      260.0,
      360.0,
    );

    return Drawer(
      backgroundColor: _zemin,
      width: genislik,
      shape: const RoundedRectangleBorder(),
      // FİLİGRAN: panel KENDİ koyu zeminini çizdiği için silüet açıkça
      // "açık renk" istenir — temanın zeminine bakmak, açık temada koyu bir
      // armayı koyu panele koymak olurdu.
      child: Stack(
        children: [
          TakimLogoZemin(acikSiluet: true),
          ValueListenableBuilder<auth.AuthState>(
            valueListenable: auth.authState,
            builder: (context, s, _) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (!mounted) return;
                if (_sonYetkiTokeni != s.token) {
                  _sonYetkiTokeni = s.token;
                  _yetkiSor(s.token);
                }
              });

              if (!s.girisli || s.user == null) return _girissiz();
              return _girisli(s.user!);
            },
          ),
        ],
      ),
    );
  }

  Widget _girisli(Map<String, dynamic> user) {
    final username = '${user['username'] ?? ''}';
    final favAd = '${user['favorite_team'] ?? ''}';

    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _kullaniciKarti(user, username, favAd),
          const SizedBox(height: Spacing.sm),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: Spacing.md),
              children: [
                for (final g in _kGirisler) _girisSatiri(g),
                if (_operator) _girisSatiri(_kInceleme),
                // SİSTEM KARNESİ normal kullanıcıya gösterilmez (kupon
                // kapsaması ile tekli ana tahmin farklı yüzde verir).
                if (_operator || _kIsDevBuild) _girisSatiri(_kSistemKarnesi),
                const SizedBox(height: Spacing.md),
                Divider(color: _ayrac, height: 1),
                const SizedBox(height: Spacing.md),
                _girisSatiri(
                  const _Giris('🚪', 'Çıkış Yap', ''),
                  onTap: () {
                    Navigator.of(context).pop();
                    auth.logout();
                  },
                ),
                _girisSatiri(
                  const _Giris('🗑️', 'Hesabımı Sil', 'hesap-sil'),
                  tehlike: true,
                ),
                const SizedBox(height: Spacing.lg),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Üst kart: kullanıcının kendi bilgileri. Dokununca tam Profil sayfası
  /// açılır — panel bir KISAYOLdur, profilin yerine geçmez.
  Widget _kullaniciKarti(
    Map<String, dynamic> user,
    String username,
    String fav,
  ) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        Spacing.md,
        Spacing.md,
        Spacing.md,
        Spacing.sm,
      ),
      child: Semantics(
        button: true,
        label: 'Profil sayfasını aç',
        child: GestureDetector(
          key: const Key('panel-kullanici-karti'),
          behavior: HitTestBehavior.opaque,
          onTap: _profilSayfasiniAc,
          child: Container(
            padding: const EdgeInsets.all(Spacing.md),
            decoration: BoxDecoration(
              color: _satir,
              borderRadius: AppRadius.mdR,
            ),
            child: Row(
              children: [
                AvatarView(
                  size: 46,
                  type: user['avatar_type'] as String?,
                  avatarKey: user['avatar_key'] as String?,
                  avatarUrl: user['avatar_url'] as String?,
                ),
                const SizedBox(width: Spacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        username.isNotEmpty ? username : 'Hesabım',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: AppColors.onDark,
                          fontSize: 15,
                          fontWeight: AppFont.heavy,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        fav.isNotEmpty ? fav : 'Takım seçilmedi',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: _ikincilYazi,
                          fontSize: 12.5,
                          fontWeight: AppFont.semibold,
                        ),
                      ),
                    ],
                  ),
                ),
                Text(
                  '›',
                  style: TextStyle(
                    color: _ikincilYazi,
                    fontSize: 20,
                    fontWeight: AppFont.black,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _girisSatiri(_Giris g, {VoidCallback? onTap, bool tehlike = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Semantics(
        button: true,
        label: g.etiket,
        child: GestureDetector(
          key: Key('panel-giris-${g.yol.isEmpty ? 'cikis' : g.yol}'),
          behavior: HitTestBehavior.opaque,
          onTap: onTap ?? () => _git(g.yol),
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: Spacing.md,
              vertical: 13,
            ),
            decoration: BoxDecoration(
              color: _satir,
              borderRadius: AppRadius.smR,
            ),
            child: Row(
              children: [
                SizedBox(
                  width: 24,
                  child: Text(g.ikon, style: const TextStyle(fontSize: 15)),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    g.etiket,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: tehlike ? AppColors.danger : AppColors.onDark,
                      fontSize: 13.5,
                      fontWeight: AppFont.semibold,
                    ),
                  ),
                ),
                Text('›', style: TextStyle(color: _ikincilYazi, fontSize: 16)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Girişsiz durum: panel boş açılmaz, ne yapılacağını söyler.
  Widget _girissiz() => SafeArea(
    child: Padding(
      padding: const EdgeInsets.all(Spacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            'Hesabına giriş yapınca profilin, takımın ve haftalık başarın '
            'burada görünür.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: _ikincilYazi,
              fontSize: 13,
              height: 18 / 13,
            ),
          ),
          const SizedBox(height: Spacing.lg),
          Semantics(
            button: true,
            label: 'Giriş ekranını aç',
            child: GestureDetector(
              key: const Key('panel-giris-yap'),
              behavior: HitTestBehavior.opaque,
              onTap: () {
                Navigator.of(context).pop();
                GoRouter.of(context).go('/profil');
              },
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 14),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.accent,
                  borderRadius: AppRadius.mdR,
                ),
                child: Text(
                  'Giriş Yap',
                  style: TextStyle(
                    color: AppColors.onAccent,
                    fontSize: 14,
                    fontWeight: AppFont.heavy,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    ),
  );
}
