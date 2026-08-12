// KAYNAK: app/src/screens/BiometricLockScreen.js — çeviri + güvenli kurtarma.
//
// BİYOMETRİK KİLİT EKRANI — uygulama açılışında, kullanıcı bu özelliği
// AÇMIŞSA gösterilir. Cihazın kendi doğrulaması (parmak izi / yüz / cihaz
// PIN'i) başarılı olana dek uygulama içeriği görünmez.
//
//   • Başarısızlıkta güvenli alternatif HER ZAMAN sunulur: "Şifreyle giriş" —
//     oturum kapatılır ve kullanıcı şifresiyle yeniden giriş yapar.
//   • Biyometrik veri uygulamaya girmez; yalnız başarılı/başarısız sonucu
//     gelir (bkz. core/security/biometric_lock.dart).
//
// KORUNAN İÇERİK HİÇ ÇİZİLMEZ: bu ekran gösterilirken yönlendirici (router)
// ağacı KURULMAZ — app.dart'ta kilitliyken `MaterialApp.router` yerine bu
// ekranı taşıyan sade bir `MaterialApp` çizilir. Böylece ana ekran bir kare
// bile görünmez.
//
// KURTARMA MODU (2026-08-09 güvenlik kararı): cihaz desteği kaybolsa da —
// kayıtlı biyometri silinmiş, sensör geçici kilitli, donanım yok — kilit
// ATLANMAZ; bu ekran durumu AÇIKLAR ve iki yol sunar: cihaz ekran kilidiyle
// doğrulama ("Kilidi Aç", biometricOnly=false PIN'e düşer) ya da şifreyle
// giriş (oturum kapatılır). Eskiden destek kaybı korunan içeriği sessizce
// kilitsiz açıyordu.
//
// GEÇ SONUÇLARA KARŞI ÜÇ KAT KORUMA:
//   1. Deneme nesli (`_denemeNo`): süperseden her eylem sayacı artırır;
//      eski denemenin geç sonucu — BAŞARILI bile olsa — yok sayılır.
//   2. `mounted` denetimi: ekran kapandıysa setState/onUnlock çağrılmaz.
//   3. `dispose()` da nesli artırır (mounted'a ek çifte emniyet).

import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/auth.dart';
import '../../core/brand.dart';
import '../../core/security/bio_lock_policy.dart';
import '../../core/security/biometric_lock.dart';
import '../../core/theme/tokens.dart';

class BiometricLockScreen extends StatefulWidget {
  const BiometricLockScreen({
    super.key,
    required this.onUnlock,
    this.dogrula,
    this.cikisYap,
    this.destekSorgula,
  });

  /// Kilit kalktığında çağrılır. Şifre alternatifinde de çağrılır: oturum
  /// kapandığı için arkada Giriş ekranı belirir.
  final VoidCallback onUnlock;

  /// Cihaz doğrulaması. Üretimde `authenticate` (core/security). Testte
  /// enjekte edilir: gerçek biyometri donanımına ve platform kanalına
  /// bağımlı kalmadan bütün sonuç senaryoları sınanabilsin.
  final Future<String> Function()? dogrula;

  /// Şifre alternatifinde çağrılır. Üretimde `logout` (core/auth).
  final Future<void> Function()? cikisYap;

  /// Cihazda kullanılabilir biyometri var mı? Üretimde `biometricsSupported`.
  /// Sonuç kilidi ATLATMAZ; yalnız ekrandaki açıklamayı seçer.
  final Future<bool> Function()? destekSorgula;

  @override
  State<BiometricLockScreen> createState() => _BiometricLockScreenState();
}

class _BiometricLockScreenState extends State<BiometricLockScreen> {
  bool _busy = false;
  bool _cikisSuruyor = false;
  int _attempts = 0;

  /// Deneme nesli — geç/süpersede edilmiş doğrulama sonuçlarını ayıklar.
  int _denemeNo = 0;

  /// null = sorgu sürüyor; false = cihazda kullanılabilir biyometri yok.
  bool? _destekVar;

  /// Son başarısızlığın local_auth kodu (`temporaryLockout` gibi) — yalnız
  /// kullanıcıya doğru açıklamayı seçmek için.
  String? _hataKodu;

  @override
  void initState() {
    super.initState();
    // Açılışta doğrulama kendiliğinden başlar (kaynaktaki `useEffect`).
    // İlk kare çizildikten sonra tetiklenir; `initState` içinde doğrudan
    // çağrılırsa cihaz istemi ekran hazır olmadan açılabilir.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _destekProbe();
      _tryUnlock();
    });
  }

  @override
  void dispose() {
    // Süren bir doğrulamanın geç sonucu `mounted` denetimine takılır; nesil
    // artışı buna çifte emniyettir.
    _denemeNo++;
    super.dispose();
  }

  Future<void> _destekProbe() async {
    bool s;
    try {
      s = await (widget.destekSorgula ?? biometricsSupported)();
    } catch (_) {
      s = false; // sorgu patlarsa "yok" varsayılır; kilit yine de sürer
    }
    if (!mounted) return;
    setState(() => _destekVar = s);
  }

  Future<void> _tryUnlock() async {
    if (_busy || _cikisSuruyor) return; // aynı istem iki kez açılmaz
    final benimNo = ++_denemeNo;
    setState(() => _busy = true);
    // `authenticate()` kendi içinde hatayı koda çevirir ('locked:<kod>');
    // yine de ikinci bir ağ atılır: işlev dışarıdan enjekte edilebiliyor ve
    // hata sızarsa `_busy` açık kalıp ekran donardı.
    String outcome;
    try {
      outcome = await (widget.dogrula ?? authenticate)();
    } catch (_) {
      outcome = 'locked'; // hata kilidi AÇMAZ (güvenli taraf)
    }
    // GEÇ SONUÇ SÜZGECİ: ekran kapandıysa YA DA bu deneme süperseden bir
    // eylemle (şifreyle giriş, dispose) eskidiyse sonuç — 'unlocked' bile
    // olsa — uygulanmaz.
    if (!mounted || benimNo != _denemeNo) return;
    final acildi = outcome == 'unlocked';
    setState(() {
      _busy = false;
      if (!acildi) {
        _attempts += 1;
        _hataKodu = outcome.startsWith('locked:')
            ? outcome.substring('locked:'.length)
            : null;
      }
    });
    if (acildi) widget.onUnlock();
  }

  Future<void> _passwordFallback() async {
    if (_cikisSuruyor) return; // çift dokunma tek çıkış üretir
    setState(() => _cikisSuruyor = true);
    // Süren doğrulamanın geç sonucu artık YOK SAYILIR…
    _denemeNo++;
    // …ve Android'de açık kalmış istem en iyi çabayla kapatılır (iOS'ta
    // no-op olabilir; güvenlik buna dayanmaz, bkz. dogrulamayiDurdur).
    unawaited(dogrulamayiDurdur());
    try {
      // Oturum sunucuda da kapanır; yeniden girmek için şifre gerekir.
      await (widget.cikisYap ?? logout)();
    } catch (_) {
      // Çıkış sunucuya ulaşamasa bile yerel oturum temizlenir (auth.dart);
      // kullanıcıyı kilitli bırakmamak için burada durulmaz.
    }
    if (!mounted) return;
    setState(() => _cikisSuruyor = false);
    widget.onUnlock(); // kilit kalkar → girişsiz durum → Giriş ekranı
  }

  /// Duruma göre kullanıcıya gösterilecek açıklama. Öncelik: spesifik hata
  /// kodu → cihazda biyometri yokluğu → genel başarısızlık.
  String? _durumMetni() {
    switch (_hataKodu) {
      case 'temporaryLockout':
        return 'Çok sayıda başarısız deneme nedeniyle biyometri geçici '
            'olarak kilitlendi. Biraz bekleyip yeniden dene ya da şifrenle '
            'giriş yap.';
      case 'biometricLockout':
        return 'Biyometri kilitlendi. "Kilidi Aç" ile cihazının ekran '
            'kilidini (PIN/desen) kullanabilir ya da şifrenle giriş '
            'yapabilirsin.';
      case 'noCredentialsSet':
        return 'Bu cihazda ekran kilidi kurulu değil, biyometrik doğrulama '
            'da yapılamıyor. Şifrenle giriş yapman gerekiyor.';
    }
    if (_destekVar == false) {
      return 'Bu cihazda şu an kullanılabilir biyometrik doğrulama yok — '
          'kayıtlı parmak izi/yüz silinmiş, sensör geçici olarak '
          'kullanılamıyor ya da cihaz desteklemiyor olabilir. "Kilidi Aç" '
          'cihazının ekran kilidiyle (PIN/desen) doğrulamayı dener; istersen '
          'şifrenle giriş yapabilirsin.';
    }
    if (_attempts > 0) {
      return 'Doğrulama başarısız oldu. Tekrar deneyebilir ya da şifrenle '
          'giriş yapabilirsin.';
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final policy = afterFailure(_attempts);
    final durum = _durumMetni();

    return Scaffold(
      backgroundColor: AppColors.primary,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(Spacing.xl),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Padding(
                  padding: EdgeInsets.only(bottom: 14),
                  child: Text('🔒', style: TextStyle(fontSize: 52)),
                ),
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(text: '$kBrandLine1 '),
                        TextSpan(
                          text: kBrandLine2,
                          style: TextStyle(color: AppColors.accent),
                        ),
                      ],
                    ),
                    style: TextStyle(
                      color: AppColors.onPrimary,
                      fontSize: 20,
                      fontWeight: AppFont.black,
                    ),
                  ),
                ),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 320),
                  child: const Padding(
                    padding: EdgeInsets.only(bottom: Spacing.lg),
                    child: Text(
                      'Devam etmek için kimliğini doğrula. Parmak izi ya da '
                      'yüz tanıma verilerin cihazından asla çıkmaz.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Color(0xFFC9D4EA),
                        fontSize: 13.5,
                        height: 20 / 13.5,
                      ),
                    ),
                  ),
                ),

                if (durum != null)
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 320),
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: Spacing.md),
                      child: Text(
                        durum,
                        key: const Key('bio-durum-metni'),
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Color(0xFFFFB4A8),
                          fontSize: 13,
                          fontWeight: AppFont.bold,
                          height: 18 / 13,
                        ),
                      ),
                    ),
                  ),

                // Deneme hakkı ASLA kapanmaz (bio_lock_policy.afterFailure);
                // yalnız şifre alternatifinin vurgusu artar.
                Opacity(
                  opacity: _busy ? 0.6 : 1,
                  child: GestureDetector(
                    onTap: (_busy || _cikisSuruyor) ? null : _tryUnlock,
                    child: Container(
                      key: const Key('bio-kilidi-ac'),
                      margin: const EdgeInsets.only(bottom: Spacing.md),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 38,
                        vertical: 14,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.accent,
                        borderRadius: AppRadius.mdR,
                      ),
                      child: _busy
                          ? SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: AppColors.bg,
                              ),
                            )
                          : Text(
                              '🫆  Kilidi Aç',
                              style: TextStyle(
                                color: AppColors.bg,
                                fontSize: 15.5,
                                fontWeight: AppFont.heavy,
                              ),
                            ),
                    ),
                  ),
                ),

                // HAPSOLMA YOK: bu düğme doğrulama SÜRERKEN DE açıktır.
                // Platform kanalı yanıt vermeyen bir doğrulamada kullanıcının
                // tek çıkış yolu budur; kapatılırsa dönen çarka mahkûm kalır.
                // (Çifte dokunma `_cikisSuruyor` ile teklenir.)
                GestureDetector(
                  onTap: _cikisSuruyor ? null : _passwordFallback,
                  child: Container(
                    key: const Key('bio-sifreyle-giris'),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 10,
                    ),
                    decoration: policy.emphasizePasswordFallback
                        ? BoxDecoration(
                            border: Border.all(color: AppColors.accent),
                            borderRadius: AppRadius.mdR,
                          )
                        : null,
                    child: Text(
                      'Şifreyle giriş yap',
                      style: TextStyle(
                        color: policy.emphasizePasswordFallback
                            ? AppColors.accent
                            : const Color(0xFFC9D4EA),
                        fontSize: 13.5,
                        fontWeight: AppFont.bold,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
