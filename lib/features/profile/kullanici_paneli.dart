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
// FAVORİ TAKIM ARMASI PANELDE GÖRÜNÜR (kullanıcı isteği, 2026-08-12: "takım
// logoları görünsün"). Önceden yalnız takımın ADI yazıyordu; gerekçe, paneli
// her açılışta `api.favoriteTeams()` isteğine sokmamaktı.
//
// O GEREKÇE ARTIK GEÇERSİZ: katalog `takimArmasiBul` içinde uygulama ömrü
// boyunca TEK KEZ çekiliyor (`takim_logo_zemin.dart` → `_katalogSoz`) ve
// uygulamanın diğer ekranları zaten o isteği tetikliyor. Arma göstermenin ek
// bir ağ maliyeti yok.
//
// BAŞKA KULÜBÜN ARMASI ASLA KONMAZ: ad katalogda eşleşmezse arma çizilmez,
// "benzeri" bir görsel seçilmez.
//
// FİLİGRAN BU PANELDE YOK (kullanıcı isteği, 2026-08-12 gece): büyük arma
// menü satırlarının ARKASINDAN geçip yazıyı bozuyordu. Panel dar ve baştan
// sona liste — filigranın sığabileceği boş alan yok. Takım kimliği profil
// kartındaki armayla zaten taşınıyor.

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth.dart' as auth;
import '../../core/network/api_client.dart';
import '../../core/theme/takim_paleti.dart';
import '../../core/theme/tokens.dart';
import '../../widgets/app_ui.dart';
import '../../widgets/avatar.dart';
import '../../widgets/takim_logo_zemin.dart';

/// Geliştirme derlemesi mi? Yayın derlemesinde bu kapı DAİMA kapalıdır
/// (profile_screen.dart'taki kuralın aynısı).
const bool _kIsDevBuild = !bool.fromEnvironment('dart.vm.product');

// GETTER, `final` DEĞİL: modül düzeyi `final` Dart'ta BİR KEZ hesaplanır. Takım
// teması `AppColors`ı çalışma zamanında değiştirdiği için `final` yazılsaydı bu
// renkler ilk okundukları andaki tonda DONAR ve panel takım değişince eski
// renkte açılırdı.
//
// ═══════════ PANEL DE UYGULAMANIN İKİ RENKLİ DÜZENİNİ İZLER ════════════════
// (kullanıcı isteği, 2026-08-12 gece — ikinci tur)
//
// "Ana yan menü zemini: takımın birinci rengi. Profil kartı ve menü satırları:
//  takımın ikinci rengi veya erişilebilir beyaz yüzey. Beyaz yüzey üzerindeki
//  metin, ikon ve yön oku: takımın birinci rengi."
//
// Bu, uygulamanın geri kalanının ZATEN kullandığı düzendir; panel artık kendi
// özel renklerini türetmiyor, aynı tokenları okuyor:
//   zemin  = background   (birinci renk)
//   satır  = surface      (ikinci renk / erişilebilir yüzey)
//   yazı   = text         (satırın üstünde → birinci rengin tonu)
//
// PANELE ÖZEL `darkCard` AİLESİ BIRAKILDI: o tokenlar hâlâ Haftalık Özet,
// bildirimler ve gösterge kartları gibi KOYU PANELLİ ekranlarda kullanılıyor;
// buradan çıkmak onları etkilemez.
//
// AA GÜVENCESİ TÜRETMEDEN GELİR: `surface` ve `text` `kimlikTonu` ile AA'yı
// tutacak şekilde üretiliyor (bkz. paletUret). "İki renk doğrudan yeterince
// okunaklı değilse takım kimliğini koruyan erişilebilir bir yüzey tonu
// kullanılsın" kuralı orada karşılanıyor.
Color get _zemin => AppColors.background;
Color get _satir => AppColors.surface;

/// Satırın üstündeki birincil metin, ikon ve yön oku.
Color get _anaYazi => AppColors.text;

/// Satır içindeki ikincil metin ve yön okları.
Color get _ikincilYazi => AppColors.textSoft;

/// Ayırıcı — satırlar arası ince çizgi.
Color get _ayrac => AppColors.border;

/// ANLAMSAL RENK, OKUNUR TONDA.
///
/// Kullanıcı kuralı: "Başarı, hata, uyarı ve canlı durum renkleri anlamsal
/// amaçla bağımsız kalsın." Rengin ANLAMI (kırmızı = tehlike) korunuyor;
/// yalnız parlaklığı, üstünde durduğu takım yüzeyinde okunacak kadar
/// itiliyor. Ölçüldü: Galatasaray temasında kırmızı panelde ham `danger`
/// neredeyse görünmüyordu.
Color _anlamsalOkunur(Color anlamsal, Color zemin) =>
    kimlikTonu(anlamsal, zemin);

/// Paneldeki bir erişim satırı.
class _Giris {
  const _Giris(this.ikon, this.etiket, this.yol);

  /// VEKTÖR ikon, emoji DEĞİL (kullanıcı isteği, 2026-08-12): emoji rengi
  /// emoji fontundan gelir ve tema değişince olduğu gibi kalırdı. Panelin
  /// zemini koyu olduğu için sabit renkli emojiler burada özellikle
  /// kopuk duruyordu.
  final IconData ikon;
  final String etiket;

  /// `/profil/<yol>` rotası.
  final String yol;
}

/// Profil sayfasındaki erişimlerin AYNISI, aynı sırayla. Yeni bir alt ekran
/// eklenirken iki yerde de görünmeli; rota adları `profile_screen.dart`
/// içindeki `hazir` kümesiyle birebir aynıdır.
const List<_Giris> _kGirisler = [
  _Giris(Icons.insights, 'Haftalık Başarı', 'basari-panelim'),
  _Giris(Icons.sports_soccer, 'Hazır Avatar Seç', 'avatar'),
  _Giris(Icons.shield_outlined, 'Takımım', 'takim-sec'),
  _Giris(Icons.brightness_6_outlined, 'Görünüm', 'gorunum'),
  _Giris(Icons.star_outline, 'Premium Kodu', 'premium-kod'),
  _Giris(Icons.lock_outline, 'Güvenlik Ayarları', 'guvenlik'),
  _Giris(Icons.devices_outlined, 'Bağlı Cihazlar', 'cihazlar'),
  _Giris(Icons.block_outlined, 'Engellenen Kullanıcılar', 'engellenenler'),
  _Giris(Icons.info_outline, 'Hakkında ve Gizlilik', 'hakkinda'),
];

/// Yalnız operatöre görünen erişimler (kapıyı SUNUCU açar).
const _Giris _kInceleme = _Giris(Icons.gavel_outlined, 'İnceleme', 'inceleme');
const _Giris _kSistemKarnesi = _Giris(
  Icons.assessment_outlined,
  'Sistem Karnesi',
  'sistem-karnesi',
);

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

  /// Favori takımın arması. `null` = takım yok ya da katalogda EŞLEŞMEDİ —
  /// ikinci durumda da hiçbir görsel konmaz (başka kulübün arması yasak).
  String? _arma;
  String? _sonFavAd;

  Future<void> _armaSor(String favAd) async {
    final img = await takimArmasiBul(favAd);
    if (mounted && img != _arma) setState(() => _arma = img);
  }

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
      // FİLİGRAN PANELDE YOK (kullanıcı isteği, 2026-08-12 gece).
      //
      // Arma menü SATIRLARININ ARKASINDAN geçiyordu ve yazıyı bozuyordu —
      // emülatörde ölçüldü: AFC Ajax temasında "Premium Kodu" ile "Hakkında
      // ve Gizlilik" arasındaki altı satır armanın üstüne düşüyordu. Panel
      // dar ve baştan sona liste; filigranın sığabileceği "boş alt alan"
      // yok. Takım kimliği panelde profil kartındaki ARMA ile zaten var.
      child: Stack(
        children: [
          ValueListenableBuilder<auth.AuthState>(
            valueListenable: auth.authState,
            builder: (context, s, _) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (!mounted) return;
                if (_sonYetkiTokeni != s.token) {
                  _sonYetkiTokeni = s.token;
                  _yetkiSor(s.token);
                }
                // Favori takım DEĞİŞİNCE arma yeniden aranır; aynı adda
                // tekrar sorulmaz (katalog zaten önbellekli, bu yalnız
                // gereksiz setState'i önler).
                final favAd = '${s.user?['favorite_team'] ?? ''}';
                if (_sonFavAd != favAd) {
                  _sonFavAd = favAd;
                  _armaSor(favAd);
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
                  const _Giris(Icons.logout, 'Çıkış Yap', ''),
                  onTap: () {
                    Navigator.of(context).pop();
                    auth.logout();
                  },
                ),
                _girisSatiri(
                  const _Giris(
                    Icons.delete_outline,
                    'Hesabımı Sil',
                    'hesap-sil',
                  ),
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
                          color: _anaYazi,
                          fontSize: 15,
                          fontWeight: AppFont.heavy,
                        ),
                      ),
                      const SizedBox(height: 3),
                      // FAVORİ TAKIMIN ARMASI (kullanıcı isteği,
                      // 2026-08-12: "takım logoları görünsün"). Panelde
                      // eskiden yalnız takımın ADI yazıyordu; gerekçe,
                      // paneli her açılışta katalog isteği atmamaktı. O
                      // gerekçe artık geçersiz: katalog `takimArmasiBul`
                      // içinde UYGULAMA ÖMRÜNDE BİR KEZ çekiliyor ve
                      // filigran zaten onu çağırıyor — armanın ek maliyeti
                      // yok.
                      //
                      // Arma KENDİ RENGİNDE kalır; tema ikonu değildir.
                      Row(
                        children: [
                          if (_arma != null) ...[
                            Logo(uri: _arma, name: fav, size: 16),
                            const SizedBox(width: 5),
                          ],
                          Flexible(
                            child: Text(
                              fav.isNotEmpty ? fav : 'Takım seçilmedi',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: _ikincilYazi,
                                fontSize: 12.5,
                                fontWeight: AppFont.semibold,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right, size: 20, color: _ikincilYazi),
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
                  // İKON DA METİNLE AYNI RENGİ İZLER: tehlikeli satırda
                  // (Hesabımı Sil) kırmızı, diğerlerinde panelin koyu
                  // zeminine göre hesaplanan `onDark`.
                  child: Icon(
                    g.ikon,
                    size: 17,
                    color: tehlike
                        ? _anlamsalOkunur(AppColors.danger, _satir)
                        : _anaYazi,
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    g.etiket,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: tehlike
                          ? _anlamsalOkunur(AppColors.danger, _satir)
                          : _anaYazi,
                      fontSize: 13.5,
                      fontWeight: AppFont.semibold,
                    ),
                  ),
                ),
                // YÖN OKU nötr: takım renginde bir ok, menüyü
                // "renklendirilmiş" gösteriyordu.
                Icon(Icons.chevron_right, size: 18, color: _ikincilYazi),
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
