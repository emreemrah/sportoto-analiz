// KAYNAK: app/src/screens/SecuritySettingsScreen.js — BİREBİR çeviri.
//
// GÜVENLİK AYARLARI — şifre değiştir · e-posta değiştir · diğer oturumları
// kapat · son güvenlik olayları.
//
//   • Şifre ve e-posta değişikliği MEVCUT ŞİFRE ile yeniden doğrulama ister
//     (sunucu da ayrıca zorunlu kılar — arayüz atlatılamaz).
//   • Şifre değişince diğer cihazlardaki oturumlar sunucuda kapatılır.
//   • Olay listesinde şifre/token benzeri hassas veri YOKTUR (sunucu süzer).

import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/auth.dart' as auth;
import '../../core/network/api_client.dart';
import '../../core/security/biometric_lock.dart';
import '../../core/theme/tokens.dart';
import '../../widgets/screen_backdrop.dart';
import 'auth_screens.dart' show PasswordField;

const Map<String, String> _eventLabels = {
  'login_success': '✅ Giriş yapıldı',
  'login_failed': '⚠️ Başarısız giriş denemesi',
  'login_unverified': '⚠️ Doğrulanmamış e-posta ile giriş denemesi',
  'logout': '👋 Çıkış yapıldı',
  'logout_all': '🚪 Diğer oturumlar kapatıldı',
  'session_revoked': '📵 Bir cihazın oturumu kapatıldı',
  'password_changed': '🔑 Şifre değiştirildi',
  'email_change_requested': '📧 E-posta değişikliği istendi',
  'reauth_failed': '⚠️ Hatalı şifreyle doğrulama denemesi',
  'refresh_denied': '⛔ Kapatılmış oturumla erişim denemesi',
  'register': '🆕 Hesap oluşturuldu',
  'account_delete_started': '🗑️ Hesap silme başlatıldı',
};

class SecuritySettingsScreen extends StatefulWidget {
  const SecuritySettingsScreen({super.key});

  @override
  State<SecuritySettingsScreen> createState() => _SecuritySettingsScreenState();
}

class _SecuritySettingsScreenState extends State<SecuritySettingsScreen> {
  // Şifre değiştirme
  final _curPw = TextEditingController();
  final _newPw = TextEditingController();
  bool _pwBusy = false;
  String? _pwOk;
  String? _pwErr;

  // E-posta değiştirme
  final _newEmail = TextEditingController();
  final _emailPw = TextEditingController();
  bool _emBusy = false;
  String? _emOk;
  String? _emErr;

  // Diğer oturumları kapatma
  bool _allBusy = false;
  String? _allMsg;

  // Güvenlik olayları
  List<dynamic>? _events;

  @override
  void initState() {
    super.initState();
    api
        .securityEvents()
        .then((r) {
          if (!mounted) return;
          setState(
            () => _events = (r is Map ? r['events'] as List? : null) ?? [],
          );
        })
        .catchError((_) {
          if (mounted) setState(() => _events = []);
        });
  }

  @override
  void dispose() {
    _curPw.dispose();
    _newPw.dispose();
    _newEmail.dispose();
    _emailPw.dispose();
    super.dispose();
  }

  Future<void> _changePw() async {
    setState(() {
      _pwOk = null;
      _pwErr = null;
      _pwBusy = true;
    });
    try {
      final r = await api.changePassword({
        'currentPassword': _curPw.text,
        'newPassword': _newPw.text,
      });
      if (!mounted) return;
      setState(() {
        _pwOk =
            (r is Map ? r['message'] as String? : null) ??
            'Şifren değiştirildi.';
        _curPw.clear();
        _newPw.clear();
      });
    } catch (e) {
      if (mounted) setState(() => _pwErr = '$e');
    } finally {
      if (mounted) setState(() => _pwBusy = false);
    }
  }

  Future<void> _changeEmail() async {
    setState(() {
      _emOk = null;
      _emErr = null;
      _emBusy = true;
    });
    try {
      final r = await api.changeEmail({
        'newEmail': _newEmail.text.trim(),
        'currentPassword': _emailPw.text,
      });
      if (!mounted) return;
      setState(() {
        _emOk = r is Map ? r['message'] as String? : null;
        _newEmail.clear();
        _emailPw.clear();
      });
      // Kaynakta beklenmeden çağrılıyor — e-posta doğrulanana kadar profil
      // zaten değişmez, bu yüzden sonucu beklemek gerekmiyor.
      unawaited(auth.refreshUser());
    } catch (e) {
      if (mounted) setState(() => _emErr = '$e');
    } finally {
      if (mounted) setState(() => _emBusy = false);
    }
  }

  Future<void> _closeOthers() async {
    setState(() {
      _allBusy = true;
      _allMsg = null;
    });
    try {
      final r = await api.logoutAll();
      final kapanan = r is Map ? r['closed'] : null;
      if (mounted) {
        setState(
          () => _allMsg = '$kapanan oturum kapatıldı. Bu cihaz açık kaldı.',
        );
      }
    } catch (e) {
      if (mounted) setState(() => _allMsg = '$e');
    } finally {
      if (mounted) setState(() => _allBusy = false);
    }
  }

  /// Kaynakta `new Date(created_at).toLocaleString('tr-TR')` → "9.08.2026 10:34:00"
  String _olayZamani(Object? iso) {
    final d = DateTime.tryParse('$iso')?.toLocal();
    if (d == null) return '—';
    String p(int n) => n.toString().padLeft(2, '0');
    return '${d.day}.${p(d.month)}.${d.year} ${p(d.hour)}:${p(d.minute)}:${p(d.second)}';
  }

  @override
  Widget build(BuildContext context) => ValueListenableBuilder<auth.AuthState>(
    valueListenable: auth.authState,
    builder: (context, s, _) => Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(title: const Text('Güvenlik Ayarları')),
      body: ScreenBackdrop(
        child: ListView(
          padding: const EdgeInsets.all(Spacing.lg),
          children: [
            const Text(
              'Güvenlik Ayarları',
              style: TextStyle(
                color: AppColors.text,
                fontSize: 22,
                fontWeight: AppFont.heavy,
              ),
            ),
            const SizedBox(height: Spacing.lg),

            const _BiometricCard(),

            _Kart(
              baslik: '🔑 Şifre Değiştir',
              children: [
                const _Ipucu(
                  'Onaylandığında diğer cihazlardaki oturumların güvenlik için kapatılır.',
                ),
                PasswordField(
                  label: 'Mevcut şifre',
                  controller: _curPw,
                  placeholder: '••••••••',
                ),
                PasswordField(
                  label: 'Yeni şifre',
                  controller: _newPw,
                  showStrength: true,
                ),
                _Geribildirim(ok: _pwOk, err: _pwErr),
                _Dugme(
                  metin: 'Şifreyi Değiştir',
                  busy: _pwBusy,
                  onTap: _changePw,
                ),
              ],
            ),

            _Kart(
              baslik: '📧 E-posta Değiştir',
              children: [
                _Ipucu(
                  'Mevcut adres: ${s.user?['email'] ?? '—'}. Değişiklik, yeni adrese gelen doğrulama bağlantısıyla tamamlanır.',
                ),
                const Text(
                  'Yeni e-posta',
                  style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 12,
                    fontWeight: AppFont.bold,
                  ),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: _newEmail,
                  keyboardType: TextInputType.emailAddress,
                  autocorrect: false,
                  style: const TextStyle(color: AppColors.text, fontSize: 15),
                  decoration: InputDecoration(
                    hintText: 'yeni@ornek.com',
                    hintStyle: const TextStyle(color: AppColors.textMuted),
                    filled: true,
                    fillColor: AppColors.cardAlt,
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                  ),
                ),
                const SizedBox(height: Spacing.md),
                PasswordField(
                  label: 'Mevcut şifre',
                  controller: _emailPw,
                  placeholder: '••••••••',
                ),
                _Geribildirim(ok: _emOk, err: _emErr),
                _Dugme(
                  metin: 'Doğrulama Bağlantısı Gönder',
                  busy: _emBusy,
                  onTap: _changeEmail,
                ),
              ],
            ),

            _Kart(
              baslik: '🚪 Diğer Oturumları Kapat',
              children: [
                const _Ipucu(
                  'Şüpheli bir durum fark edersen bu cihaz dışındaki tüm oturumları tek dokunuşla kapatabilirsin.',
                ),
                if (_allMsg != null) _Onay(_allMsg!),
                _Dugme(
                  metin: 'Diğer Tüm Oturumları Kapat',
                  busy: _allBusy,
                  onTap: _closeOthers,
                  uyari: true,
                ),
              ],
            ),

            _Kart(
              baslik: '🕓 Son Güvenlik Olayları',
              children: [
                if (_events == null)
                  const Center(
                    child: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                if (_events != null && _events!.isEmpty)
                  const _Ipucu('Henüz kayıtlı olay yok.'),
                for (final e in _events ?? const [])
                  _olaySatiri((e as Map).cast<String, dynamic>()),
              ],
            ),
          ],
        ),
      ),
    ),
  );

  Widget _olaySatiri(Map<String, dynamic> e) {
    final ip = e['ip'];
    final ipVar = ip != null && '$ip'.isNotEmpty;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            // Bilinmeyen olay TÜRÜ ham anahtarıyla gösterilir — sunucu yeni
            // bir olay eklediğinde satır KAYBOLMAZ (kaynak aynen).
            _eventLabels['${e['event']}'] ?? '${e['event']}',
            style: const TextStyle(
              color: AppColors.text,
              fontSize: 13,
              fontWeight: AppFont.bold,
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text(
              '${_olayZamani(e['created_at'])}${ipVar ? ' · $ip' : ''}',
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 11.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Biyometrik kilit — yalnız destekleyen cihazlarda görünür (web'de hiç).
/// Aç/kapat için önce cihazın biyometrik doğrulaması istenir; böylece kilidi
/// yalnız cihaz sahibi değiştirebilir. Biyometrik veri uygulamaya girmez.
class _BiometricCard extends StatefulWidget {
  const _BiometricCard();

  @override
  State<_BiometricCard> createState() => _BiometricCardState();
}

class _BiometricCardState extends State<_BiometricCard> {
  bool _supported = false;
  bool _enabled = false;
  bool _busy = false;
  String? _msg;

  @override
  void initState() {
    super.initState();
    () async {
      final s = await biometricsSupported();
      if (!mounted) return;
      setState(() => _supported = s);
      if (s) {
        final e = await isBioLockEnabled();
        if (mounted) setState(() => _enabled = e);
      }
    }();
  }

  Future<void> _toggle(bool next) async {
    setState(() {
      _busy = true;
      _msg = null;
    });
    // değişiklik için kimlik doğrulaması şart
    final outcome = await authenticate();
    if (outcome != 'unlocked') {
      if (mounted) {
        setState(() {
          _msg = 'Doğrulama başarısız — ayar değiştirilmedi.';
          _busy = false;
        });
      }
      return;
    }
    await setBioLockEnabled(next);
    if (!mounted) return;
    setState(() {
      _enabled = next;
      _msg = next
          ? 'Biyometrik kilit açıldı. Uygulama her açılışta kimlik doğrulaması isteyecek.'
          : 'Biyometrik kilit kapatıldı.';
      _busy = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!_supported) return const SizedBox.shrink();
    return _Kart(
      baslik: '🫆 Biyometrik Kilit',
      children: [
        const _Ipucu(
          'Açıkken uygulama her açılışta parmak izi / yüz tanıma ister. Biyometrik '
          'verilerin cihazından asla çıkmaz ve uygulama tarafından kaydedilmez; '
          'doğrulama başarısız olursa şifreyle giriş her zaman mümkündür.',
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              _enabled ? 'Açık' : 'Kapalı',
              style: const TextStyle(
                color: AppColors.text,
                fontSize: 14,
                fontWeight: AppFont.heavy,
              ),
            ),
            Switch(
              value: _enabled,
              onChanged: _busy ? null : _toggle,
              activeTrackColor: AppColors.primary,
            ),
          ],
        ),
        if (_msg != null) _Onay(_msg!),
      ],
    );
  }
}

class _Kart extends StatelessWidget {
  const _Kart({required this.baslik, required this.children});

  final String baslik;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: Spacing.md),
    padding: const EdgeInsets.all(Spacing.md),
    decoration: BoxDecoration(
      color: AppColors.card,
      borderRadius: BorderRadius.circular(AppRadius.md),
      border: Border.all(color: AppColors.border),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          baslik,
          style: const TextStyle(
            color: AppColors.text,
            fontSize: 15.5,
            fontWeight: AppFont.heavy,
          ),
        ),
        const SizedBox(height: 8),
        ...children,
      ],
    ),
  );
}

class _Ipucu extends StatelessWidget {
  const _Ipucu(this.metin);

  final String metin;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: Spacing.md),
    child: Text(
      metin,
      style: const TextStyle(
        color: AppColors.textMuted,
        fontSize: 12.5,
        height: 18 / 12.5,
      ),
    ),
  );
}

class _Onay extends StatelessWidget {
  const _Onay(this.metin);

  final String metin;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Text(
      metin,
      style: const TextStyle(
        color: AppColors.green,
        fontSize: 13,
        fontWeight: AppFont.semibold,
      ),
    ),
  );
}

class _Geribildirim extends StatelessWidget {
  const _Geribildirim({this.ok, this.err});

  final String? ok;
  final String? err;

  @override
  Widget build(BuildContext context) {
    if (ok != null) return _Onay(ok!);
    if (err != null) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(
          err!,
          style: const TextStyle(
            color: AppColors.red,
            fontSize: 13,
            fontWeight: AppFont.semibold,
          ),
        ),
      );
    }
    return const SizedBox.shrink();
  }
}

class _Dugme extends StatelessWidget {
  const _Dugme({
    required this.metin,
    required this.busy,
    required this.onTap,
    this.uyari = false,
  });

  final String metin;
  final bool busy;
  final VoidCallback onTap;
  final bool uyari;

  @override
  Widget build(BuildContext context) => Opacity(
    opacity: busy ? 0.6 : 1,
    child: GestureDetector(
      onTap: busy ? null : onTap,
      child: Container(
        margin: const EdgeInsets.only(top: 4),
        padding: const EdgeInsets.symmetric(vertical: 13),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: uyari ? null : AppColors.primary,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: uyari ? Border.all(color: AppColors.red) : null,
        ),
        child: busy
            ? SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: uyari ? AppColors.red : AppColors.bg,
                ),
              )
            : Text(
                metin,
                style: TextStyle(
                  color: uyari ? AppColors.red : AppColors.bg,
                  fontSize: 14.5,
                  fontWeight: AppFont.heavy,
                ),
              ),
      ),
    ),
  );
}
