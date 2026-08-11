// KAYNAK: app/src/screens/PremiumCodeScreen.js — BİREBİR çeviri.
//
// PREMIUM KODU EKRANI — kullanıcı, kendisine verilen kodu buraya yazar.
// ---------------------------------------------------------------------------
// AKIŞ: operatör yönetim panelinden kod üretir → kullanıcıya iletir →
// kullanıcı burada kullanır → hak sunucuda yazılır.
//
// DÜRÜSTLÜK KURALLARI
//  • Durum SUNUCUDAN okunur. Uygulama "premium" bilgisini kendi belleğinde
//    tutup göstermez; kapatıp açınca farklı bir şey söylemesin.
//  • Premium sistemi sunucuda henüz kurulmadıysa (tablolar yok) ekran bunu
//    açıkça yazar — "premium değilsin" deyip sebebi gizlemez.
//  • Hata mesajı sunucudan ne geldiyse odur; uydurulmuş "başarılı" yok.

import 'package:flutter/material.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/tokens.dart';

/// Kullanıcı kodu tireli/küçük harfli yazabilir; sunucuya kanonik biçim gider.
///
/// `toUpperCase()` burada BİLEREK Türkçe kuralına çevrilmedi: kod alfabesi
/// yalnız A–Z ve 0–9'dur, süzgeç zaten Türkçe harfleri atar.
String kodTemizle(String? ham) =>
    (ham ?? '').toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');

class PremiumCodeScreen extends StatefulWidget {
  const PremiumCodeScreen({super.key});

  @override
  State<PremiumCodeScreen> createState() => _PremiumCodeScreenState();
}

class _PremiumCodeScreenState extends State<PremiumCodeScreen> {
  Map<String, dynamic>? _durum;
  bool _yukleniyor = true;
  final _kod = TextEditingController();
  bool _gonderiliyor = false;
  ({String tur, String metin})? _mesaj; // tur: 'ok' | 'hata'

  @override
  void initState() {
    super.initState();
    _durumOku();
  }

  @override
  void dispose() {
    _kod.dispose();
    super.dispose();
  }

  Future<void> _durumOku() async {
    setState(() => _yukleniyor = true);
    try {
      final d = await api.premiumDurum();
      if (mounted) setState(() => _durum = (d as Map).cast<String, dynamic>());
    } catch (e) {
      if (mounted) {
        setState(() {
          _durum = null;
          _mesaj = (tur: 'hata', metin: '$e');
        });
      }
    } finally {
      if (mounted) setState(() => _yukleniyor = false);
    }
  }

  Future<void> _kullan() async {
    final temiz = kodTemizle(_kod.text);
    if (temiz.length < 4) {
      setState(() => _mesaj = (tur: 'hata', metin: 'Kodu eksiksiz yaz.'));
      return;
    }
    setState(() {
      _gonderiliyor = true;
      _mesaj = null;
    });
    try {
      final r = await api.premiumKodKullan(temiz);
      if (!mounted) return;
      setState(() {
        _durum = (r as Map).cast<String, dynamic>();
        _kod.clear();
        _mesaj = (
          tur: 'ok',
          metin: 'Kod kullanıldı — premium erişimin açıldı.',
        );
      });
    } catch (e) {
      if (mounted) setState(() => _mesaj = (tur: 'hata', metin: '$e'));
    } finally {
      if (mounted) setState(() => _gonderiliyor = false);
    }
  }

  /// Kaynakta `new Date(bitis).toLocaleDateString('tr-TR')` → "9.08.2026".
  String _tarih(Object? bitis) {
    if (bitis == null) return 'bilinmiyor';
    final d = DateTime.tryParse('$bitis')?.toLocal();
    if (d == null) return 'bilinmiyor';
    return '${d.day}.${d.month.toString().padLeft(2, '0')}.${d.year}';
  }

  @override
  Widget build(BuildContext context) {
    final premium = _durum?['premium'] == true;
    final kurulmadi = _durum?['kurulmadi'] == true;
    final suresiz = _durum?['suresiz'] == true;

    final aciklama = kurulmadi
        ? 'Premium sistemi bu sunucuda henüz kurulmadı.'
        : premium
        ? (suresiz
              ? 'Süresiz erişimin var.'
              : 'Bitiş: ${_tarih(_durum?['bitis'])}')
        : 'Elinde bir kod varsa aşağıya yazarak erişimini açabilirsin.';

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(title: const Text('Premium Kodu')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          Spacing.md,
          Spacing.md,
          Spacing.md,
          40,
        ),
        children: [
          Container(
            padding: const EdgeInsets.all(Spacing.md),
            margin: const EdgeInsets.only(bottom: Spacing.md),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(AppRadius.md),
              border: Border.all(
                color: premium ? AppColors.warning : AppColors.border,
                width: premium ? 2 : 1,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  premium ? '⭐ Premium erişimin açık' : 'Premium erişimin yok',
                  style: const TextStyle(
                    color: AppColors.text,
                    fontSize: 15,
                    fontWeight: AppFont.black,
                  ),
                ),
                if (_yukleniyor)
                  const Padding(
                    padding: EdgeInsets.only(top: 8),
                    child: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.primary,
                      ),
                    ),
                  )
                else
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(
                      aciklama,
                      style: const TextStyle(
                        color: AppColors.textSoft,
                        fontSize: 13,
                        height: 18 / 13,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.all(Spacing.md),
            margin: const EdgeInsets.only(bottom: Spacing.md),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(AppRadius.md),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Kodum var',
                  style: TextStyle(
                    color: AppColors.text,
                    fontSize: 15,
                    fontWeight: AppFont.black,
                  ),
                ),
                const SizedBox(height: 10),
                Semantics(
                  label: 'Premium kodu',
                  textField: true,
                  child: TextField(
                    controller: _kod,
                    textCapitalization: TextCapitalization.characters,
                    autocorrect: false,
                    maxLength: 24,
                    style: const TextStyle(
                      color: AppColors.text,
                      fontSize: 16,
                      fontWeight: AppFont.black,
                      letterSpacing: 2,
                    ),
                    decoration: InputDecoration(
                      counterText: '',
                      hintText: 'ÖRNEK: A7K2M9P4XR',
                      hintStyle: const TextStyle(color: AppColors.textMuted),
                      filled: true,
                      fillColor: AppColors.surfaceSoft,
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 11,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppRadius.sm),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppRadius.sm),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppRadius.sm),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                Opacity(
                  opacity: _gonderiliyor ? 0.6 : 1,
                  child: GestureDetector(
                    onTap: _gonderiliyor ? null : _kullan,
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(AppRadius.sm),
                      ),
                      child: Text(
                        _gonderiliyor ? 'Kontrol ediliyor…' : 'Kodu kullan',
                        style: const TextStyle(
                          color: Color(0xFFFFFFFF),
                          fontSize: 14,
                          fontWeight: AppFont.black,
                        ),
                      ),
                    ),
                  ),
                ),
                if (_mesaj case final m?)
                  Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: Text(
                      m.metin,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: AppFont.heavy,
                        color: m.tur == 'ok'
                            ? AppColors.success
                            : AppColors.accent,
                      ),
                    ),
                  ),
                const Padding(
                  padding: EdgeInsets.only(top: 10),
                  child: Text(
                    'Kodlar büyük/küçük harf ve tire farkına takılmaz; “a7k2-m9p4” ile “A7K2M9P4” aynıdır. '
                    'Bir kodu yalnız bir kez kullanabilirsin.',
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 11.5,
                      height: 16 / 11.5,
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
