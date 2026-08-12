// KAYNAK: app/src/screens/ForumScreen.js — BİREBİR çeviri.
//
// TOPLULUK ("Stadyum") — alt menüden kaldırıldı; kaynakta Ana Sayfa'daki
// "Toplulukta Gündem" bölümünden erişiliyordu, o bölüm de kullanıcı isteğiyle
// KALDIRILDI (içeriği sahte örnekti). Ekran kaynakta hâlâ KAYITLI ama hiçbir
// düğmeden açılmıyor.
//
// ÇEVİRİDE AYNI DURUM KORUNDU: rota kaydedilir (derin bağlantıyla açılabilir),
// arayüzde giriş noktası YOKTUR. Kaynakta olmayan bir düğme eklemek, kaldırılan
// bölümü geri getirmek olurdu.
//
// DÜRÜSTLÜK — bu ekranda UYDURMA İÇERİK YOK:
//  • Gönderi listesi BOŞTUR (`posts = []`); "örnek yorum" gösterilmez.
//  • Yorum/beğeni sayaçları "—" yazar; sahte sayı basılmaz.
//  • Oda kartları DÜĞME DEĞİLDİR: dokunulunca hiçbir şey olmayan bir düğme,
//    kullanıcıya "sen yanlış yaptın" hissi verir. Düz kart olarak çizilir ve
//    durum açıkça yazılır.

import 'package:flutter/material.dart';

import '../../core/theme/tokens.dart';
import '../../widgets/app_ui.dart';

// GETTER, `final` DEĞİL: takım teması `AppColors`ı çalışma zamanında değiştirir.
Map<String, Color> get _roomColors => {
  'primary': AppColors.primary,
  'info': AppColors.info,
  'warning': AppColors.warning,
  'success': AppColors.success,
};

const List<({String key, String label})> _tabs = [
  (key: 'all', label: 'Tümü'),
  (key: 'bulletin', label: 'Bülten'),
  (key: 'analysis', label: 'Analiz'),
  (key: 'surprise', label: 'Sürpriz'),
];

/// Gerçek topluluk verisi backend'e bağlanınca doldurulacak.
const List<Map<String, dynamic>> _posts = [];

const List<
  ({String title, String subtitle, IconData icon, String badge, String tone})
>
_quickRooms = [
  (
    title: 'Bülten Sohbeti',
    subtitle: 'Güncel maç listesi, eksik veri, saat kontrolü',
    icon: Icons.list,
    badge: 'Bülten',
    tone: 'primary',
  ),
  (
    title: 'Analiz Odası',
    subtitle: 'Form, olasılık, risk puanı, maç yorumu',
    icon: Icons.bar_chart,
    badge: 'Analiz',
    tone: 'info',
  ),
  (
    title: 'Sürpriz Radarı',
    subtitle: 'Beklenmeyen sonuç adayları ve tahmin listesi dengesi',
    icon: Icons.bolt,
    badge: 'Risk',
    tone: 'warning',
  ),
  (
    title: 'Tahmin Listesi Fikirleri',
    subtitle: 'Güçlü tercih ve alternatif işaret önerileri',
    icon: Icons.assignment,
    badge: 'Topluluk',
    tone: 'success',
  ),
];

class ForumScreen extends StatefulWidget {
  const ForumScreen({super.key});

  @override
  State<ForumScreen> createState() => _ForumScreenState();
}

class _ForumScreenState extends State<ForumScreen> {
  String _activeTab = 'all';

  @override
  Widget build(BuildContext context) {
    final filtered = _activeTab == 'all'
        ? _posts
        : _posts.where((p) => p['type'] == _activeTab).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Topluluk')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          Spacing.lg,
          Spacing.lg,
          Spacing.lg,
          28,
        ),
        children: [
          _hero(),
          _bolumBasligi(
            'Hızlı Odalar',
            'Kullanıcı uygulamayı açınca aradığı konuya tek dokunuşla girsin.',
          ),
          _odaIzgarasi(),
          Padding(
            padding: EdgeInsets.only(top: Spacing.md),
            child: Text(
              'Odalar henüz açılmadı — topluluk özellikleri hazır olduğunda burada '
              'aktifleşecek.',
              style: TextStyle(
                color: AppColors.textSoft,
                fontSize: AppFont.sm,
                height: 18 / 12,
              ),
            ),
          ),
          _bolumBasligi(
            'Stadyum Akışı',
            'Topluluk gündemi, analiz yorumları ve risk sinyalleri.',
          ),
          _sekmeler(),
          if (filtered.isEmpty)
            const EmptyState(
              icon: '💬',
              title: 'Henüz topluluk yorumu bulunmuyor',
              message:
                  "Gerçek kullanıcı yorumları backend'e bağlanınca burada görünecek.",
            ),
          _bolumBasligi(
            'Günün Sabit Başlıkları',
            'Forum boş kalmasın, kullanıcıya hazır gündem sunsun.',
          ),
          _sabitBasliklar(),
        ],
      ),
    );
  }

  Widget _hero() => Container(
    padding: const EdgeInsets.all(Spacing.lg),
    decoration: BoxDecoration(
      color: AppColors.darkCard,
      borderRadius: BorderRadius.circular(AppRadius.xl),
      border: Border.all(color: AppColors.darkCardSoft),
      boxShadow: AppShadow.card,
    ),
    clipBehavior: Clip.antiAlias,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Align(
                    alignment: Alignment.centerLeft,
                    child: Pill(label: 'STADYUM', tone: 'dark'),
                  ),
                  const Padding(
                    padding: EdgeInsets.only(top: Spacing.md),
                    child: Text(
                      'Tribün burada konuşuyor',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: AppFont.xxl,
                        fontWeight: AppFont.heavy,
                      ),
                    ),
                  ),
                  const Padding(
                    padding: EdgeInsets.only(top: Spacing.sm),
                    child: Text(
                      'Bülten, analiz, sürpriz maçlar ve tahmin listesi fikirleri tek sahada.',
                      style: TextStyle(
                        color: Color(0xFFD7DEEA),
                        fontSize: AppFont.md,
                        height: 21 / 14,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: Spacing.md),
            Container(
              width: 76,
              height: 76,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.darkCardSoft,
                borderRadius: BorderRadius.circular(AppRadius.xl),
              ),
              child: const Icon(Icons.people, size: 30, color: AppColors.white),
            ),
          ],
        ),
        Padding(
          padding: const EdgeInsets.only(top: Spacing.xl),
          child: Row(
            children: [
              // Sayı LİSTEDEN türer, elle yazılmaz — oda eklenip çıkarıldığında
              // sayacın sessizce yanlışa düşmesi imkânsız olsun diye.
              _heroSayac('${_quickRooms.length}', 'Oda'),
              const SizedBox(width: Spacing.md),
              // Yorum/beğeni verisi YOK — sahte sayı basılmaz.
              _heroSayac('—', 'Yorum'),
              const SizedBox(width: Spacing.md),
              _heroSayac('—', 'Beğeni'),
            ],
          ),
        ),
      ],
    ),
  );

  Widget _heroSayac(String deger, String etiket) => Expanded(
    child: Container(
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: AppColors.darkCardSoft,
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            deger,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: AppFont.xl,
              fontWeight: AppFont.heavy,
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text(
              etiket,
              style: const TextStyle(
                color: Color(0xFFB8C1D1),
                fontSize: AppFont.sm,
              ),
            ),
          ),
        ],
      ),
    ),
  );

  Widget _bolumBasligi(String baslik, String altBaslik) => Padding(
    padding: const EdgeInsets.only(top: Spacing.xl, bottom: Spacing.md),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          baslik,
          style: TextStyle(
            color: AppColors.text,
            fontSize: AppFont.lg,
            fontWeight: AppFont.heavy,
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 2),
          child: Text(
            altBaslik,
            style: TextStyle(color: AppColors.textSoft, fontSize: AppFont.sm),
          ),
        ),
      ],
    ),
  );

  /// ODA KARTLARI HENÜZ ÇALIŞMIYOR — topluluk arka ucu bağlı değil. Eskiden
  /// dokunulabilirdi: basınca sönüp geri geliyor ama HİÇBİR ŞEY olmuyordu.
  /// Artık düz kart olarak çiziliyorlar.
  Widget _odaIzgarasi() => LayoutBuilder(
    builder: (context, c) {
      final genislik = (c.maxWidth - Spacing.md) / 2;
      return Wrap(
        spacing: Spacing.md,
        runSpacing: Spacing.md,
        children: [
          for (final r in _quickRooms)
            SizedBox(
              width: genislik,
              child: Semantics(
                // Düğme DEĞİL: ekran okuyucuya da "metin" diye okunur.
                button: false,
                child: Container(
                  padding: const EdgeInsets.all(Spacing.lg),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(AppRadius.xl),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Icon(
                            r.icon,
                            size: 22,
                            color: _roomColors[r.tone] ?? AppColors.primary,
                          ),
                          Flexible(
                            child: Pill(label: r.badge, tone: r.tone),
                          ),
                        ],
                      ),
                      Padding(
                        padding: const EdgeInsets.only(top: Spacing.lg),
                        child: Text(
                          r.title,
                          style: TextStyle(
                            color: AppColors.text,
                            fontSize: AppFont.md,
                            fontWeight: AppFont.heavy,
                          ),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          r.subtitle,
                          style: TextStyle(
                            color: AppColors.textSoft,
                            fontSize: AppFont.sm,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      );
    },
  );

  Widget _sekmeler() => Padding(
    padding: const EdgeInsets.only(bottom: Spacing.md),
    child: Wrap(
      spacing: Spacing.sm,
      runSpacing: Spacing.sm,
      children: [
        for (final t in _tabs)
          GestureDetector(
            onTap: () => setState(() => _activeTab = t.key),
            behavior: HitTestBehavior.opaque,
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: Spacing.md,
                vertical: Spacing.sm,
              ),
              decoration: BoxDecoration(
                color: _activeTab == t.key
                    ? AppColors.primary
                    : AppColors.cardAlt,
                borderRadius: BorderRadius.circular(AppRadius.pill),
                border: Border.all(
                  color: _activeTab == t.key
                      ? AppColors.primary
                      : AppColors.border,
                ),
              ),
              child: Text(
                t.label,
                style: TextStyle(
                  color: _activeTab == t.key
                      ? AppColors.white
                      : AppColors.textSoft,
                  fontSize: AppFont.sm,
                  fontWeight: AppFont.bold,
                ),
              ),
            ),
          ),
      ],
    ),
  );

  Widget _sabitBasliklar() => Container(
    padding: const EdgeInsets.all(Spacing.lg),
    decoration: BoxDecoration(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppRadius.xl),
      border: Border.all(color: AppColors.border),
      boxShadow: AppShadow.card,
    ),
    child: Column(
      children: [
        _liste(
          Icons.lightbulb,
          AppColors.info,
          'Bugünün en mantıklı güçlü tercihi hangisi?',
          'Güçlü tercih maçları için topluluk kontrolü.',
          'Tartış',
          'info',
        ),
        _liste(
          Icons.bolt,
          AppColors.warning,
          'Sürpriz yapabilecek takım var mı?',
          'Favori karşıtı maçlar, beraberlik ihtimali ve beklenmeyen sonuç riski.',
          'Aktif',
          'warning',
        ),
        _liste(
          Icons.schedule,
          AppColors.success,
          'Geçmiş bültenden dersler',
          '15, 14, 13, 12 bilen dağılımı ve sonuç alışkanlıkları.',
          'Geçmiş',
          'success',
        ),
      ],
    ),
  );

  Widget _liste(
    IconData icon,
    Color renk,
    String baslik,
    String altBaslik,
    String rozet,
    String ton,
  ) => Container(
    padding: const EdgeInsets.symmetric(vertical: Spacing.md),
    decoration: BoxDecoration(
      border: Border(bottom: BorderSide(color: AppColors.border)),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Padding(
          padding: const EdgeInsets.only(right: Spacing.md),
          child: Icon(icon, size: 22, color: renk),
        ),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                baslik,
                style: TextStyle(
                  color: AppColors.text,
                  fontSize: AppFont.md,
                  fontWeight: AppFont.bold,
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 3),
                child: Text(
                  altBaslik,
                  style: TextStyle(
                    color: AppColors.textSoft,
                    fontSize: AppFont.sm,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: Spacing.sm),
        Pill(label: rozet, tone: ton),
      ],
    ),
  );
}
