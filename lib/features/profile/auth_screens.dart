// KAYNAK: app/src/screens/AuthScreens.js — BİREBİR çeviri.
//
// GİRİŞ / KAYIT / ŞİFREMİ UNUTTUM — üç ayrı ekran.
//   • Şifre göster/gizle · şifre gücü göstergesi · net yükleniyor/başarı/hata
//   • E-posta doğrulaması açıkken kayıt sonrası bilgi + "yeniden gönder"
//   • ŞİFRE hiçbir yerde saklanmaz; yalnız girişte sunucuya HTTPS ile gider

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth.dart' as auth;
import '../../core/network/api_client.dart';
import '../../core/security/password_strength.dart';
import '../../core/theme/tokens.dart';

class _Field extends StatelessWidget {
  const _Field({
    required this.label,
    required this.controller,
    this.placeholder,
    this.keyboardType,
    this.maxLength,
  });

  final String label;
  final TextEditingController controller;
  final String? placeholder;
  final TextInputType? keyboardType;
  final int? maxLength;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: Spacing.md),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: _labelStil),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          keyboardType: keyboardType,
          maxLength: maxLength,
          buildCounter:
              (_, {required currentLength, required isFocused, maxLength}) =>
                  null,
          autocorrect: false,
          textCapitalization: TextCapitalization.none,
          style: TextStyle(color: AppColors.text, fontSize: 15),
          decoration: _girdiSusu(placeholder),
        ),
      ],
    ),
  );
}

InputDecoration _girdiSusu(String? placeholder) => InputDecoration(
  hintText: placeholder,
  hintStyle: TextStyle(color: AppColors.textMuted, fontSize: 15),
  filled: true,
  fillColor: AppColors.card,
  isDense: true,
  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
  border: OutlineInputBorder(
    borderRadius: AppRadius.mdR,
    borderSide: BorderSide(color: AppColors.border),
  ),
  enabledBorder: OutlineInputBorder(
    borderRadius: AppRadius.mdR,
    borderSide: BorderSide(color: AppColors.border),
  ),
  focusedBorder: OutlineInputBorder(
    borderRadius: AppRadius.mdR,
    borderSide: BorderSide(color: AppColors.primary),
  ),
);

/// Şifre alanı: göster/gizle düğmesi + istenirse güç göstergesi.
class PasswordField extends StatefulWidget {
  const PasswordField({
    super.key,
    required this.label,
    required this.controller,
    this.showStrength = false,
    this.placeholder,
  });

  final String label;
  final TextEditingController controller;
  final bool showStrength;
  final String? placeholder;

  @override
  State<PasswordField> createState() => _PasswordFieldState();
}

class _PasswordFieldState extends State<PasswordField> {
  bool _hidden = true;

  @override
  Widget build(BuildContext context) {
    final deger = widget.controller.text;
    final strength = widget.showStrength ? passwordStrength(deger) : null;
    final strengthColor = strength == null
        ? null
        : switch (strength.color) {
            'red' => AppColors.red,
            'orange' => const Color(0xFFF0883E),
            'yellow' => const Color(0xFFD4A017),
            _ => AppColors.green,
          };

    return Padding(
      padding: const EdgeInsets.only(bottom: Spacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(widget.label, style: _labelStil),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: widget.controller,
                  obscureText: _hidden,
                  autocorrect: false,
                  enableSuggestions: false,
                  textCapitalization: TextCapitalization.none,
                  onChanged: (_) => setState(() {}),
                  style: TextStyle(color: AppColors.text, fontSize: 15),
                  decoration: _girdiSusu(
                    widget.placeholder ?? 'en az $kMinPasswordLength karakter',
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Semantics(
                button: true,
                label: _hidden ? 'Şifreyi göster' : 'Şifreyi gizle',
                child: GestureDetector(
                  onTap: () => setState(() => _hidden = !_hidden),
                  child: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.card,
                      borderRadius: AppRadius.mdR,
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Text(
                      _hidden ? '👁' : '🙈',
                      style: const TextStyle(fontSize: 16),
                    ),
                  ),
                ),
              ),
            ],
          ),
          if (strength != null && deger.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(3),
                    child: Container(
                      height: 5,
                      color: AppColors.border,
                      child: FractionallySizedBox(
                        alignment: Alignment.centerLeft,
                        widthFactor: strength.score / 4,
                        child: Container(color: strengthColor),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      '${strength.label}'
                      '${strength.hints.isNotEmpty ? ' · ${strength.hints.first}' : ''}',
                      style: TextStyle(
                        color: strengthColor,
                        fontSize: 11.5,
                        fontWeight: AppFont.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _Submit extends StatelessWidget {
  const _Submit({required this.busy, required this.onTap, required this.text});

  final bool busy;
  final VoidCallback onTap;
  final String text;

  @override
  Widget build(BuildContext context) => Opacity(
    opacity: busy ? 0.6 : 1,
    child: GestureDetector(
      onTap: busy ? null : onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        margin: const EdgeInsets.only(top: Spacing.sm),
        padding: const EdgeInsets.symmetric(vertical: 14),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: AppColors.primary,
          borderRadius: AppRadius.mdR,
        ),
        child: busy
            ? SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: AppColors.bg,
                ),
              )
            : Text(
                text,
                style: TextStyle(
                  color: AppColors.bg,
                  fontSize: 16,
                  fontWeight: AppFont.heavy,
                ),
              ),
      ),
    ),
  );
}

class _Link extends StatelessWidget {
  const _Link({required this.text, required this.onTap});
  final String text;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    behavior: HitTestBehavior.opaque,
    child: Padding(
      padding: const EdgeInsets.only(top: Spacing.md),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: TextStyle(
          color: AppColors.primary,
          fontSize: 13.5,
          fontWeight: AppFont.bold,
        ),
      ),
    ),
  );
}

/// Doğrulama bekleyen e-posta için bilgi kutusu + yeniden gönderme.
class _VerificationNotice extends StatefulWidget {
  const _VerificationNotice({required this.email, required this.message});
  final String email;
  final String message;

  @override
  State<_VerificationNotice> createState() => _VerificationNoticeState();
}

class _VerificationNoticeState extends State<_VerificationNotice> {
  bool _busy = false;
  String? _info;

  Future<void> _resend() async {
    setState(() {
      _busy = true;
      _info = null;
    });
    try {
      final r = await auth.resendVerification(widget.email);
      if (mounted) {
        setState(
          () => _info =
              (r is Map ? r['message'] as String? : null) ??
              'Bağlantı yeniden gönderildi.',
        );
      }
    } catch (e) {
      if (mounted) setState(() => _info = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: Spacing.md),
    padding: const EdgeInsets.all(Spacing.md),
    decoration: BoxDecoration(
      color: AppColors.card,
      borderRadius: AppRadius.mdR,
      border: Border.all(color: AppColors.border),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '📧 E-postanı doğrula',
          style: TextStyle(
            color: AppColors.text,
            fontSize: 15,
            fontWeight: AppFont.heavy,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          widget.message,
          style: TextStyle(
            color: AppColors.textMuted,
            fontSize: 13,
            height: 19 / 13,
          ),
        ),
        if (_info != null) Text(_info!, style: _okStil),
        _Link(
          text: _busy
              ? 'Gönderiliyor…'
              : 'Doğrulama bağlantısını yeniden gönder',
          onTap: _busy ? () {} : _resend,
        ),
      ],
    ),
  );
}

// ── GİRİŞ ────────────────────────────────────────────────────────────────
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _err;
  bool _needsVerification = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _err = null;
      _needsVerification = false;
      _busy = true;
    });
    try {
      await auth.login(_email.text.trim(), _password.text);
      if (mounted) GoRouter.of(context).go('/profil');
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _err = '$e';
        if (e is ApiException && e.needsVerification) {
          _needsVerification = true;
        }
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => _Kabuk(
    baslik: 'Giriş Yap',
    children: [
      _Field(
        label: 'E-posta',
        controller: _email,
        keyboardType: TextInputType.emailAddress,
        placeholder: 'ornek@mail.com',
      ),
      PasswordField(
        label: 'Şifre',
        controller: _password,
        placeholder: '••••••••',
      ),
      if (_err != null) Text(_err!, style: _errStil),
      if (_needsVerification)
        _VerificationNotice(
          email: _email.text.trim(),
          message:
              'Giriş için önce e-postana gelen doğrulama '
              'bağlantısına tıklaman gerekiyor.',
        ),
      _Submit(busy: _busy, onTap: _submit, text: 'Giriş Yap'),
      _Link(
        text: 'Şifremi unuttum',
        onTap: () => GoRouter.of(context).go('/profil/sifremi-unuttum'),
      ),
      _Link(
        text: 'Hesabın yok mu? Kayıt ol',
        onTap: () => GoRouter.of(context).go('/profil/kayit'),
      ),
    ],
  );
}

// ── KAYIT ────────────────────────────────────────────────────────────────
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _email = TextEditingController();
  final _username = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _err;
  String? _verifyMsg;

  @override
  void dispose() {
    _email.dispose();
    _username.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _err = null;
      _busy = true;
    });
    try {
      final r = await auth.register(
        _email.text.trim(),
        _username.text.trim(),
        _password.text,
      );
      if (!mounted) return;
      if (r['needsVerification'] == true) {
        setState(() => _verifyMsg = '${r['message'] ?? ''}');
        return;
      }
      GoRouter.of(context).go('/profil');
    } catch (e) {
      if (mounted) setState(() => _err = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_verifyMsg != null) {
      return _Kabuk(
        baslik: 'Kayıt Alındı ✅',
        children: [
          _VerificationNotice(email: _email.text.trim(), message: _verifyMsg!),
          _Link(
            text: 'Doğruladım — girişe git',
            onTap: () => GoRouter.of(context).go('/profil/giris'),
          ),
        ],
      );
    }

    return _Kabuk(
      baslik: 'Kayıt Ol',
      children: [
        _Field(
          label: 'E-posta',
          controller: _email,
          keyboardType: TextInputType.emailAddress,
          placeholder: 'ornek@mail.com',
        ),
        _Field(
          label: 'Kullanıcı adı',
          controller: _username,
          placeholder: '3-24 karakter',
          maxLength: 24,
        ),
        PasswordField(
          label: 'Şifre',
          controller: _password,
          showStrength: true,
        ),
        if (_err != null) Text(_err!, style: _errStil),
        _Submit(busy: _busy, onTap: _submit, text: 'Kayıt Ol'),
        _Link(
          text: 'Zaten hesabın var mı? Giriş yap',
          onTap: () => GoRouter.of(context).go('/profil/giris'),
        ),
      ],
    );
  }
}

// ── ŞİFREMİ UNUTTUM ──────────────────────────────────────────────────────
class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _email = TextEditingController();
  bool _busy = false;
  String? _msg;
  String? _err;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _err = null;
      _msg = null;
      _busy = true;
    });
    try {
      final r = await auth.forgotPassword(_email.text.trim());
      if (mounted) {
        setState(
          () => _msg =
              (r is Map ? r['message'] as String? : null) ??
              'Sıfırlama bağlantısı gönderildi.',
        );
      }
    } catch (e) {
      if (mounted) setState(() => _err = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => _Kabuk(
    baslik: 'Şifremi Unuttum',
    children: [
      Padding(
        padding: EdgeInsets.only(bottom: Spacing.md),
        child: Text(
          'E-postanı gir; şifre sıfırlama bağlantısı gönderelim.',
          style: TextStyle(color: AppColors.textMuted, fontSize: 13),
        ),
      ),
      _Field(
        label: 'E-posta',
        controller: _email,
        keyboardType: TextInputType.emailAddress,
        placeholder: 'ornek@mail.com',
      ),
      if (_msg != null) Text(_msg!, style: _okStil),
      if (_err != null) Text(_err!, style: _errStil),
      _Submit(busy: _busy, onTap: _submit, text: 'Bağlantı Gönder'),
      _Link(
        text: 'Girişe dön',
        onTap: () => GoRouter.of(context).go('/profil/giris'),
      ),
    ],
  );
}

class _Kabuk extends StatelessWidget {
  const _Kabuk({required this.baslik, required this.children});

  final String baslik;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(baslik)),
    body: SingleChildScrollView(
      padding: const EdgeInsets.all(Spacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: children,
      ),
    ),
  );
}

TextStyle _labelStil = TextStyle(
  color: AppColors.textMuted,
  fontSize: 12,
  fontWeight: AppFont.bold,
);

const TextStyle _errStil = TextStyle(
  color: AppColors.red,
  fontSize: 13,
  fontWeight: AppFont.semibold,
);

const TextStyle _okStil = TextStyle(
  color: AppColors.green,
  fontSize: 13,
  fontWeight: AppFont.semibold,
);
