// KAYNAK: app/src/screens/DeleteAccountScreen.js — BİREBİR çeviri.
//
// HESABIMI SİL — uygulama içi kalıcı hesap silme (Google Play zorunluluğu).
//
// KESİN KURALLAR
// • Silme GERÇEKTİR; pasife alma değildir. Sunucu gerçekten siler.
// • Ne silinir / ne silinmez kullanıcıya AÇIKÇA yazılır.
// • Onay ifadesi yazılmadan buton çalışmaz.
// • Sunucu "tamamlanamadı" derse ekranda "silindi" YAZILMAZ; hata dürüstçe
//   gösterilir ve kullanıcı tekrar deneyebilir.
// • Yerel veriler yalnız silme BAŞARILI olduktan sonra temizlenir.

import 'package:flutter/material.dart';

import 'package:go_router/go_router.dart';

import '../../core/auth.dart' as auth;
import '../../core/local_data.dart';
import '../../core/network/api_client.dart';
import '../../core/services/push_service.dart';
import '../../core/theme/tokens.dart';
import '../../widgets/screen_backdrop.dart';

const String kConfirmPhrase = 'HESABIMI SIL';

/// Büyük/küçük harf ve Türkçe "İ/I" farkı kullanıcıyı engellemesin.
///
/// Sıralama kaynaktakiyle AYNI olmalı: önce 'İ'→'I' ve 'ı'→'i', SONRA
/// büyütme. Ters sırada 'ı' Dart'ta 'I' olmaz ve doğru yazan kullanıcı
/// kilitli kalır.
bool isConfirmed(String? text) =>
    (text ?? '')
        .replaceAll('İ', 'I')
        .replaceAll('ı', 'i')
        .toUpperCase()
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim() ==
    kConfirmPhrase;

const List<String> _silinenler = [
  'Hesabın (e-posta ve giriş bilgilerin)',
  'Profilin, kullanıcı adın ve profil fotoğrafın',
  'Yorumların ve beğenilerin',
  'Skor tahminlerin, kadro tahminlerin, oyuncu ve anket oyların',
  'Kaydettiğin kuponların',
  'Analiz profillerin ve kendi analiz kayıtların',
];

const List<String> _silinmeyenler = [
  'Haftalık bülten arşivi',
  'Mühürlü analiz kayıtları ve resmî maç sonuçları',
  'Radar ve Sistem Karnesi verileri',
];

class DeleteAccountScreen extends StatefulWidget {
  const DeleteAccountScreen({super.key});

  @override
  State<DeleteAccountScreen> createState() => _DeleteAccountScreenState();
}

class _DeleteAccountScreenState extends State<DeleteAccountScreen> {
  final _text = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _hata;

  @override
  void dispose() {
    _text.dispose();
    _password.dispose();
    super.dispose();
  }

  bool get _onaylandi => isConfirmed(_text.text) && _password.text.isNotEmpty;

  Future<void> _sil() async {
    if (!_onaylandi || _busy) return;
    setState(() {
      _busy = true;
      _hata = null;
    });
    try {
      // Yeniden kimlik doğrulama: sunucu, onay ifadesine ek olarak MEVCUT
      // ŞİFREYİ de doğrular — ele geçirilmiş bir oturum tek başına silemez.
      final r = await api.deleteAccount(kConfirmPhrase, _password.text);
      final ok = r is Map && r['ok'] == true;
      if (!ok) {
        throw const ApiException(
          'Silme tamamlanamadı. Hesabın silinmedi, lütfen tekrar dene.',
        );
      }

      // Sunucu silmeyi ONAYLADIKTAN sonra cihazdaki izler temizlenir.
      // Zamanlanmış maç hatırlatmaları da iptal edilir; aksi hâlde hesap
      // silindikten SONRA da telefon çalmaya devam ederdi.
      try {
        await cancelAllOurNotifications();
      } catch (_) {
        // silmeyi engellemesin
      }
      await wipeLocalData();
      await auth.logout();
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Hesap silindi'),
          content: const Text(
            'Hesabın ve sana ait tüm veriler kalıcı olarak silindi.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Tamam'),
            ),
          ],
        ),
      );
    } catch (e) {
      setState(() => _hata = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Hesabımı Sil')),
    body: ScreenBackdrop(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(
          Spacing.lg,
          Spacing.lg,
          Spacing.lg,
          Spacing.xl * 2,
        ),
        children: [
          Text(
            'Hesabımı Sil',
            style: TextStyle(
              color: AppColors.text,
              fontSize: 22,
              fontWeight: AppFont.black,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Bu işlem geri alınamaz. Hesabın pasife alınmaz, kalıcı olarak silinir.',
            style: TextStyle(
              color: AppColors.textMuted,
              fontSize: 14,
              height: 20 / 14,
            ),
          ),
          const SizedBox(height: Spacing.lg),

          _Kart(
            baslik: 'Silinecekler',
            children: [for (final s in _silinenler) _Madde(s)],
          ),

          _Kart(
            baslik: 'Silinmeyecekler',
            children: [
              const _Not(
                'Sana ait olmayan ve kimliğinle ilişkilendirilmeyen kayıtlar korunur:',
              ),
              for (final s in _silinmeyenler) _Madde(s),
            ],
          ),

          _Kart(
            baslik: 'Onay',
            tehlike: true,
            children: [
              // Onay ifadesi metnin İÇİNDE vurgulu geçer — kullanıcı ne
              // yazacağını ayrı bir yerden aramak zorunda kalmaz.
              RichText(
                text: TextSpan(
                  style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 13,
                    height: 19 / 13,
                  ),
                  children: [
                    TextSpan(text: 'Devam etmek için aşağıya '),
                    TextSpan(
                      text: kConfirmPhrase,
                      style: TextStyle(
                        color: AppColors.text,
                        fontWeight: AppFont.black,
                      ),
                    ),
                    TextSpan(text: ' yaz.'),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              _Girdi(
                controller: _text,
                placeholder: kConfirmPhrase,
                enabled: !_busy,
                // autoCapitalize="characters" karşılığı.
                textCapitalization: TextCapitalization.characters,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: Spacing.sm),
              const _Not('Güvenlik için mevcut şifreni de gir:'),
              _Girdi(
                controller: _password,
                placeholder: 'Mevcut şifren',
                enabled: !_busy,
                obscure: true,
                onChanged: (_) => setState(() {}),
              ),
            ],
          ),

          if (_hata != null)
            Padding(
              padding: const EdgeInsets.only(bottom: Spacing.sm),
              child: Text(
                _hata!,
                style: const TextStyle(
                  color: AppColors.red,
                  fontSize: 13,
                  height: 19 / 13,
                ),
              ),
            ),

          Opacity(
            opacity: (!_onaylandi || _busy) ? 0.45 : 1,
            child: GestureDetector(
              onTap: (!_onaylandi || _busy) ? null : _sil,
              child: Container(
                margin: const EdgeInsets.only(top: Spacing.sm),
                padding: const EdgeInsets.symmetric(vertical: 14),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.red,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Text(
                  _busy ? 'Siliniyor…' : 'Hesabımı kalıcı olarak sil',
                  style: const TextStyle(
                    color: Color(0xFFFFFFFF),
                    fontSize: 15,
                    fontWeight: AppFont.heavy,
                  ),
                ),
              ),
            ),
          ),

          GestureDetector(
            onTap: _busy ? null : () => context.pop(),
            child: Container(
              margin: const EdgeInsets.only(top: Spacing.sm),
              padding: const EdgeInsets.symmetric(vertical: 14),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(AppRadius.md),
                border: Border.all(color: AppColors.border),
              ),
              child: Text(
                'Vazgeç',
                style: TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 14,
                  fontWeight: AppFont.bold,
                ),
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class _Kart extends StatelessWidget {
  const _Kart({
    required this.baslik,
    required this.children,
    this.tehlike = false,
  });

  final String baslik;
  final List<Widget> children;
  final bool tehlike;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: Spacing.md),
    padding: const EdgeInsets.all(Spacing.md),
    decoration: BoxDecoration(
      color: AppColors.card,
      borderRadius: BorderRadius.circular(AppRadius.md),
      border: Border.all(color: tehlike ? AppColors.red : AppColors.border),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          baslik,
          style: TextStyle(
            color: tehlike ? AppColors.red : AppColors.text,
            fontSize: 15,
            fontWeight: AppFont.heavy,
          ),
        ),
        const SizedBox(height: 8),
        ...children,
      ],
    ),
  );
}

class _Madde extends StatelessWidget {
  const _Madde(this.metin);

  final String metin;

  @override
  Widget build(BuildContext context) => Text(
    '•  $metin',
    style: TextStyle(
      color: AppColors.textMuted,
      fontSize: 13.5,
      height: 21 / 13.5,
    ),
  );
}

class _Not extends StatelessWidget {
  const _Not(this.metin);

  final String metin;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Text(
      metin,
      style: TextStyle(
        color: AppColors.textMuted,
        fontSize: 13,
        height: 19 / 13,
      ),
    ),
  );
}

class _Girdi extends StatelessWidget {
  const _Girdi({
    required this.controller,
    required this.placeholder,
    required this.enabled,
    required this.onChanged,
    this.obscure = false,
    this.textCapitalization = TextCapitalization.none,
  });

  final TextEditingController controller;
  final String placeholder;
  final bool enabled;
  final ValueChanged<String> onChanged;
  final bool obscure;
  final TextCapitalization textCapitalization;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 4),
    child: TextField(
      controller: controller,
      enabled: enabled,
      obscureText: obscure,
      textCapitalization: textCapitalization,
      autocorrect: false,
      // autoCorrect={false} yanında: onay ifadesi düzeltme önerisiyle
      // bozulmasın diye akıllı tırnak/nokta da kapatılır.
      smartDashesType: SmartDashesType.disabled,
      smartQuotesType: SmartQuotesType.disabled,
      style: TextStyle(
        color: AppColors.text,
        fontSize: 15,
        fontWeight: AppFont.heavy,
        letterSpacing: 1,
      ),
      onChanged: onChanged,
      decoration: InputDecoration(
        hintText: placeholder,
        hintStyle: TextStyle(
          color: AppColors.textMuted,
          fontWeight: AppFont.heavy,
        ),
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 12,
          vertical: 10,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.sm),
          borderSide: BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.sm),
          borderSide: BorderSide(color: AppColors.border),
        ),
        disabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.sm),
          borderSide: BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.sm),
          borderSide: BorderSide(color: AppColors.border),
        ),
      ),
    ),
  );
}
