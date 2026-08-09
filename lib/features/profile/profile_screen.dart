// KAYNAK: app/src/screens/ProfileScreen.js — BİREBİR çeviri.
//
// ÇEVRİLEN: girişsiz/girişli iki durum, ad düzenleme, e-posta doğrulama
// rozeti, sayaçlar, favori takım satırı (arma katalogdan), avatar işlemleri,
// tüm alt ekran girişleri, çıkış, yasal metinler.
//
// KAYNAKTAN TAŞINAN İKİ GÜVENLİK KURALI:
//
//  1. İNCELEME GİRİŞİ — kararı SUNUCU verir, uygulama değil. Uygulamanın
//     içinde hiçbir operatör e-postası veya listesi YOKTUR; Android paketi
//     açılıp okunabildiği için oraya yazılan her şey herkese açıktır. Her
//     açılışta /api/moderation/access sorulur. `operator` BAŞLANGIÇTA
//     false'tur: yetki cevabı gelene kadar giriş görünmez. Ters kurgu (önce
//     göster, sonra gizle) girişi bir an herkese göstermek olurdu.
//
//  2. FAVORİ TAKIM ARMASI — ad → arma eşlemesi katalogdan yapılır.
//     Bulunamazsa nötr ⚽ kalır; BAŞKA kulübün arması ASLA konmaz.
//
// ÇEVRİLMEDİ: profil resmi YÜKLEME. Kaynakta da yalnız web'de çalışıyor
// (tarayıcı canvas'ı kullanıyor), mobilde karşılığı yok. Hazır avatar seçimi
// ve "Resmi Kaldır" çalışır; sunucudan gelen bir resim varsa gösterilir.

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth.dart' as auth;
import '../../core/brand.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../widgets/app_ui.dart';
import '../../widgets/avatar.dart';
import '../../widgets/takim_logo_zemin.dart';

/// Geliştirme derlemesi mi? Yayın derlemesinde bu kapı DAİMA kapalıdır.
const bool _kIsDevBuild = !bool.fromEnvironment('dart.vm.product');

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _nameCtl = TextEditingController();
  bool _savingName = false;
  bool _operator = false;
  String? _favLogo;
  String? _sonYetkiTokeni;
  String? _sonFavAd;

  @override
  void dispose() {
    _nameCtl.dispose();
    super.dispose();
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
      // Yetki bilinmiyorsa GÖSTERME.
      if (mounted) setState(() => _operator = false);
    }
  }

  /// Takım adı → arma (katalogdan; büyük/küçük harf duyarsız).
  /// Bulunamazsa null — eşleşme yoksa arma konmaz, benzeri görsel yasak.
  Future<void> _armaBul(String favAd) async {
    if (favAd.isEmpty) {
      if (mounted) setState(() => _favLogo = null);
      return;
    }
    try {
      final d = await api.favoriteTeams();
      if (!mounted) return;
      final kucuk = _kucukTr(favAd);
      for (final lig in ((d as Map)['leagues'] as List?) ?? const []) {
        for (final t in ((lig as Map)['teams'] as List?) ?? const []) {
          final tm = t as Map;
          if (_kucukTr('${tm['name']}') == kucuk ||
              _kucukTr('${tm['cleanName'] ?? ''}') == kucuk) {
            setState(() => _favLogo = tm['image'] as String?);
            return;
          }
        }
      }
      setState(() => _favLogo = null);
    } catch (_) {
      if (mounted) setState(() => _favLogo = null);
    }
  }

  /// Türkçe küçük harf: Dart'ın toLowerCase()'i 'I' → 'i' yapar, Türkçe'de
  /// 'ı' olmalıdır. Kaynak `toLocaleLowerCase('tr-TR')` kullanıyordu.
  static String _kucukTr(String s) =>
      s.replaceAll('I', 'ı').replaceAll('İ', 'i').toLowerCase();

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<auth.AuthState>(
      valueListenable: auth.authState,
      builder: (context, s, _) {
        // Yan etkiler build sırasında değil, kare sonrası tetiklenir.
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          if (_sonYetkiTokeni != s.token) {
            _sonYetkiTokeni = s.token;
            _yetkiSor(s.token);
          }
          final favAd = '${s.user?['favorite_team'] ?? ''}';
          if (_sonFavAd != favAd) {
            _sonFavAd = favAd;
            _armaBul(favAd);
          }
        });

        if (!s.ready) {
          return const Scaffold(
            backgroundColor: AppColors.bg,
            body: Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            ),
          );
        }
        if (!s.girisli || s.user == null) return const _LoggedOut();
        return _girisli(s.user!);
      },
    );
  }

  Widget _girisli(Map<String, dynamic> user) {
    final username = '${user['username'] ?? ''}';
    if (_nameCtl.text.isEmpty) _nameCtl.text = username;
    final nameChanged =
        _nameCtl.text.trim() != username && _nameCtl.text.trim().isNotEmpty;
    final favAd = '${user['favorite_team'] ?? ''}';

    return Scaffold(
      backgroundColor: AppColors.bg,
      // ARKA PLAN: hareketli desen (`ScreenBackdrop`) bu ekrandan KULLANICI
      // İSTEĞİYLE kaldırıldı (2026-08-04); zeminde yalnız favori takımın
      // arması filigran olarak kalır.
      body: Stack(
        children: [
          const TakimLogoZemin(),
          SafeArea(
            bottom: false,
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(Spacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Profil', style: _titleStil),
                  const SizedBox(height: Spacing.lg),

                  // ── AVATAR + AD + E-POSTA + SAYAÇLAR ──
                  Container(
                    padding: const EdgeInsets.all(Spacing.lg),
                    decoration: BoxDecoration(
                      color: AppColors.card,
                      borderRadius: AppRadius.lgR,
                      border: Border.all(color: AppColors.border),
                      boxShadow: AppShadow.soft,
                    ),
                    child: Column(
                      children: [
                        const ProfileAvatar(size: 112),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: _nameCtl,
                                maxLength: 24,
                                textAlign: TextAlign.center,
                                onChanged: (_) => setState(() {}),
                                buildCounter:
                                    (
                                      _, {
                                      required currentLength,
                                      required isFocused,
                                      maxLength,
                                    }) => null,
                                style: const TextStyle(
                                  color: AppColors.text,
                                  fontSize: 18,
                                  fontWeight: AppFont.heavy,
                                ),
                                decoration: const InputDecoration(
                                  border: InputBorder.none,
                                  isDense: true,
                                ),
                              ),
                            ),
                            if (nameChanged)
                              GestureDetector(
                                onTap: _savingName ? null : _adKaydet,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 6,
                                  ),
                                  decoration: BoxDecoration(
                                    color: AppColors.primary,
                                    borderRadius: AppRadius.smR,
                                  ),
                                  child: Text(
                                    _savingName ? '…' : 'Kaydet',
                                    style: const TextStyle(
                                      color: AppColors.white,
                                      fontSize: 12,
                                      fontWeight: AppFont.heavy,
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Flexible(
                              child: Text(
                                '${user['email'] ?? ''}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: AppColors.textMuted,
                                  fontSize: 12.5,
                                ),
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              user['email_verified'] == true
                                  ? '✓ doğrulandı'
                                  : 'doğrulanmadı',
                              style: TextStyle(
                                color: user['email_verified'] == true
                                    ? AppColors.success
                                    : AppColors.warning,
                                fontSize: 11,
                                fontWeight: AppFont.heavy,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 14,
                          runSpacing: 6,
                          alignment: WrapAlignment.center,
                          children: [
                            _sayac('💬 ${user['total_comments'] ?? 0} yorum'),
                            _sayac(
                              '♥ ${user['total_likes_received'] ?? 0} beğeni',
                            ),
                            _sayac(
                              '🎯 ${user['total_predictions'] ?? 0} tahmin',
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),

                        // Takım YAZILMAZ, listeden SEÇİLİR.
                        Row(
                          children: [
                            if (_favLogo != null) ...[
                              Logo(uri: _favLogo, name: favAd, size: 18),
                              const SizedBox(width: 6),
                            ],
                            Text(
                              _favLogo != null ? 'Takımım:' : '⚽ Takımım:',
                              style: const TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 12.5,
                                fontWeight: AppFont.bold,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: GestureDetector(
                                onTap: () => _git('takim-sec'),
                                behavior: HitTestBehavior.opaque,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 7,
                                  ),
                                  decoration: BoxDecoration(
                                    color: AppColors.bgAlt,
                                    borderRadius: AppRadius.smR,
                                    border: Border.all(color: AppColors.border),
                                  ),
                                  child: Row(
                                    children: [
                                      if (favAd.isNotEmpty) ...[
                                        Logo(
                                          uri: _favLogo,
                                          name: favAd,
                                          size: 20,
                                        ),
                                        const SizedBox(width: 6),
                                      ],
                                      Expanded(
                                        child: Text(
                                          favAd.isNotEmpty
                                              ? favAd
                                              : 'Takımını seç',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                            color: favAd.isNotEmpty
                                                ? AppColors.text
                                                : AppColors.textMuted,
                                            fontSize: 13,
                                            fontWeight: AppFont.bold,
                                          ),
                                        ),
                                      ),
                                      const Text(
                                        '›',
                                        style: TextStyle(
                                          color: AppColors.textMuted,
                                          fontSize: 16,
                                          fontWeight: AppFont.black,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: Spacing.md),

                  _dugme('⚽  Hazır Avatar Seç', () => _git('avatar')),
                  if (user['avatar_type'] != 'default')
                    _dugme(
                      'Resmi Kaldır (varsayılana dön)',
                      _avatarKaldir,
                      tur: _DugmeTuru.hayalet,
                    ),
                  _dugme('📊  Başarı Panelim', () => _git('basari-panelim')),
                  // PREMIUM KODU — hak SUNUCUDA yazılır; uygulama kendi başına
                  // premium ilan edemez.
                  _dugme('⭐  Premium Kodu', () => _git('premium-kod')),
                  _dugme('🔐  Güvenlik Ayarları', () => _git('guvenlik')),
                  _dugme('📱  Bağlı Cihazlar', () => _git('cihazlar')),
                  // Engellemek yorumun altından yapılır; GERİ ALMAK için de bir
                  // yol olmak zorunda.
                  _dugme(
                    '🚫  Engellenen Kullanıcılar',
                    () => _git('engellenenler'),
                  ),
                  if (_operator)
                    _dugme(
                      '🛡️  İnceleme (bildirilen yorumlar)',
                      () => _git('inceleme'),
                    ),
                  // SİSTEM KARNESİ — normal kullanıcıya GÖSTERİLMEZ: uygulamadaki
                  // "Sistem" sütunu kupon kapsamasıdır (çoklu tercih dahil), bu
                  // ise tekli ana tahmin — ikisi aynı hafta için farklı yüzde
                  // verir. Kapı: operatör YA DA geliştirme derlemesi.
                  if (_operator || _kIsDevBuild)
                    _dugme(
                      '📊  Sistem Karnesi (Master analiz)',
                      () => _git('sistem-karnesi'),
                    ),
                  _dugme('ℹ️  Hakkında ve Gizlilik', () => _git('hakkinda')),
                  _dugme('Çıkış Yap', auth.logout, tur: _DugmeTuru.cikis),
                  // HESAP SİLME — Google Play, hesap açan uygulamalarda uygulama
                  // içinden erişilebilen bir silme yolu ister. Silme gerçek ve
                  // kalıcıdır.
                  _dugme(
                    'Hesabımı Sil',
                    () => _git('hesap-sil'),
                    tur: _DugmeTuru.sil,
                  ),

                  const SizedBox(height: Spacing.md),
                  const Text(kIndependenceNotice, style: _legalStil),
                  const SizedBox(height: 6),
                  const Text(kCopyright, style: _copyrightStil),
                  const SizedBox(height: Spacing.xl),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _sayac(String metin) => Text(
    metin,
    style: const TextStyle(
      color: AppColors.textSoft,
      fontSize: 12,
      fontWeight: AppFont.bold,
    ),
  );

  Future<void> _adKaydet() async {
    setState(() => _savingName = true);
    try {
      await api.updateProfile({'username': _nameCtl.text.trim()});
      await auth.refreshUser();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _savingName = false);
    }
  }

  Future<void> _avatarKaldir() async {
    try {
      await api.updateProfile({'avatarType': 'default'});
      await auth.refreshUser();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  void _git(String alt) {
    // Bu ekrandan açılan alt ekranların HEPSİ çevrildi; küme yine de duruyor
    // çünkü kayıtlı OLMAYAN bir yola `go` demek go_router'da SESSİZ
    // başarısızlıktır — kullanıcı dokunur, hiçbir şey olmaz, hata da çıkmaz.
    // Yeni bir alt ekran eklenirken buraya da eklenmezse aşağıdaki dal
    // devreye girer ve sorunu görünür kılar.
    const hazir = <String>{
      'takim-sec',
      'avatar',
      'premium-kod',
      'guvenlik',
      'cihazlar',
      'engellenenler',
      'hakkinda',
      'hesap-sil',
      'basari-panelim',
      'sistem-karnesi',
      'inceleme',
    };
    if (hazir.contains(alt)) {
      GoRouter.of(context).go('/profil/$alt');
      return;
    }
    // Buraya düşmek bir GELİŞTİRME hatasıdır: `hazir` kümesine eklenmemiş bir
    // yola gidilmeye çalışılıyor. Kullanıcıya "çevrilmedi" demek yanlış olur
    // (ekran çevrilmiş olabilir, bağlantı unutulmuştur); durum olduğu gibi
    // söylenir.
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('"$alt" ekranı açılamadı — rota tanımlı değil.'),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  Widget _dugme(
    String etiket,
    VoidCallback onTap, {
    _DugmeTuru tur = _DugmeTuru.alt,
  }) {
    final (bg, fg, border) = switch (tur) {
      _DugmeTuru.alt => (AppColors.card, AppColors.text, AppColors.border),
      _DugmeTuru.hayalet => (
        Colors.transparent,
        AppColors.textMuted,
        AppColors.border,
      ),
      _DugmeTuru.cikis => (
        AppColors.cardAlt,
        AppColors.primary,
        AppColors.border,
      ),
      _DugmeTuru.sil => (
        AppColors.dangerSoft,
        AppColors.danger,
        AppColors.danger,
      ),
    };

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 13, horizontal: 14),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: AppRadius.mdR,
            border: Border.all(color: border),
          ),
          child: Text(
            etiket,
            style: TextStyle(
              color: fg,
              fontSize: 14,
              fontWeight: AppFont.heavy,
            ),
          ),
        ),
      ),
    );
  }
}

enum _DugmeTuru { alt, hayalet, cikis, sil }

class _LoggedOut extends StatelessWidget {
  const _LoggedOut();

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AppColors.bg,
    body: SafeArea(
      bottom: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(Spacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 30),
            const Text(
              '⚽',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 46),
            ),
            const SizedBox(height: 8),
            const Text(
              'Profil',
              textAlign: TextAlign.center,
              style: _titleStil,
            ),
            const SizedBox(height: 8),
            const Text(
              'Maçlara yorum yapmak, beğenmek ve avatarını seçmek için '
              'giriş yap.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 13,
                height: 19 / 13,
              ),
            ),
            const SizedBox(height: Spacing.lg),
            _buton(context, 'Giriş Yap', '/profil/giris', dolu: true),
            _buton(context, 'Kayıt Ol', '/profil/kayit'),
            // Gizlilik metni giriş yapmadan da erişilebilir olmalıdır.
            _buton(
              context,
              'Hakkında ve Gizlilik',
              '/profil/hakkinda',
              hakkinda: true,
            ),
            const SizedBox(height: Spacing.md),
            const Text(kIndependenceNotice, style: _legalStil),
            const SizedBox(height: 6),
            const Text(kCopyright, style: _copyrightStil),
          ],
        ),
      ),
    ),
  );

  Widget _buton(
    BuildContext context,
    String etiket,
    String? yol, {
    bool dolu = false,
    bool hakkinda = false,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: GestureDetector(
      onTap: yol == null ? null : () => GoRouter.of(context).go(yol),
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: dolu
              ? AppColors.primary
              : (hakkinda ? Colors.transparent : AppColors.card),
          borderRadius: AppRadius.mdR,
          border: Border.all(
            color: dolu ? AppColors.primary : AppColors.border,
          ),
        ),
        child: Text(
          etiket,
          style: TextStyle(
            color: dolu
                ? AppColors.bg
                : (hakkinda ? AppColors.textMuted : AppColors.text),
            fontSize: 15,
            fontWeight: AppFont.heavy,
          ),
        ),
      ),
    ),
  );
}

const TextStyle _titleStil = TextStyle(
  color: AppColors.text,
  fontSize: 24,
  fontWeight: AppFont.heavy,
);

const TextStyle _legalStil = TextStyle(
  color: AppColors.textMuted,
  fontSize: 10.5,
  height: 15 / 10.5,
  textBaseline: TextBaseline.alphabetic,
);

const TextStyle _copyrightStil = TextStyle(
  color: AppColors.textMuted,
  fontSize: 10.5,
  fontWeight: AppFont.semibold,
);
