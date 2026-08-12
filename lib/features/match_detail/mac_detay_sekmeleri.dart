// MAÇ DETAYI SEKME DÜZENİ (kullanıcı isteği, 2026-08-11)
//
// Bültendeki bir maça girildiğinde görünen sekmelerin KATALOĞU, kullanıcının
// aç/kapat tercihi ve Screenshot_6'daki yatay sekme çubuğu burada.
//
// NEDEN AYRI DOSYA: `widgets/tabs.dart` içindeki `AppTabs` bu ekranın DIŞINDA
// da kullanılıyor (`bulletin_detail_screen.dart:180`). Oradaki davranışı
// değiştirmemek için maç detayının çubuğu ayrı yazıldı; AppTabs'a dokunulmadı.
//
// DÜZEN (Screenshot_6): SOLDA sabit ayar dişlisi, sağında yatay kaydırılabilir
// sekmeler; seçili sekmenin altında ince accent çizgi. Sekmeler ekrana
// sığmazsa sağa-sola kaydırılır — kesilmez, küçültülmez.
//
// RADAR SEKMESİ KALDIRILDI (2026-08-11): eski 'Radar' sekmesi Radar 3/4'ü tek
// panelde topluyordu. Yerine üç ayrı sekme geldi (Oynanma Yüzdeleri, Oran
// Takibi, Bülten Sırası) — hepsi YALNIZ açılan maçın verisini gösterir. Ana
// Radar ekranı bu değişiklikten ETKİLENMEZ.

import 'package:flutter/material.dart';

import '../../core/prefs.dart';
import '../../core/theme/tokens.dart';

/// Bir maç detayı sekmesi.
class MacDetaySekme {
  const MacDetaySekme(this.ad, this.ikon, {this.ayarlanabilir = true});

  final String ad;

  /// İKON VEKTÖRDÜR, EMOJİ DEĞİL (kullanıcı isteği, 2026-08-12). Emoji renk
  /// emoji fontundan gelir; `TextStyle.color` onu değiştirmez, bu yüzden
  /// sekme ikonları açık/koyu/takım temasında sabit renkte kalıyordu. Tip
  /// `IconData` olduğu için emoji metni buraya artık DERLENMEZ.
  final IconData ikon;

  /// Kullanıcı bu sekmeyi kapatabilir mi? Yorumlar KAPATILAMAZ: kullanıcı
  /// "Yorumlar bölümü varsa korunsun" dedi ve aç/kapat listesinde saymadı.
  /// Aynı zamanda ekranın çıpasıdır — tüm sekmeler kapatılsa bile maç detayı
  /// boş bir kabuk hâline gelmez.
  final bool ayarlanabilir;
}

/// Sekme SIRASI kullanıcının verdiği sıradır; ekranda da bu sırayla çizilir.
const List<MacDetaySekme> kMacDetaySekmeleri = [
  MacDetaySekme('Özet', Icons.schedule),
  MacDetaySekme('Analiz', Icons.trending_up),
  MacDetaySekme('İstatistik', Icons.bar_chart),
  MacDetaySekme('Oynanma Yüzdeleri', Icons.groups_outlined),
  MacDetaySekme('Oran Takibi', Icons.currency_exchange),
  MacDetaySekme('Bülten Sırası', Icons.list_alt),
  MacDetaySekme('Yorumlar', Icons.chat_bubble_outline, ayarlanabilir: false),
];

/// Ayarlar ekranında listelenen (kapatılabilir) sekmeler.
List<MacDetaySekme> get macDetayAyarlanabilirSekmeler =>
    kMacDetaySekmeleri.where((s) => s.ayarlanabilir).toList();

/// Kullanıcının KAPATTIĞI sekme adları.
///
/// Diskte kalmış tanınmayan ad (ör. kaldırılan 'Radar') ve kapatılamaz sekme
/// adları SESSİZCE ELENİR: eski bir kayıt yüzünden var olmayan bir sekme
/// "kapalı" sayılamaz, Yorumlar da hiçbir kayıtla kapanamaz.
Set<String> macDetayGizliSekmeler() {
  final v = getPref('macDetayGizliSekmeler');
  if (v is! List) return const {};
  final ayarlanabilir = macDetayAyarlanabilirSekmeler.map((s) => s.ad).toSet();
  return v.map((e) => '$e').where(ayarlanabilir.contains).toSet();
}

/// Tercihi diske yazar. Liste SIRALI yazılır — aynı seçim her seferinde aynı
/// kaydı üretsin (kayıt karşılaştırması ve test tekrarlanabilirliği için).
void macDetayGizliSekmeleriYaz(Set<String> gizli) {
  final ayarlanabilir = macDetayAyarlanabilirSekmeler.map((s) => s.ad).toSet();
  setPref(
    'macDetayGizliSekmeler',
    gizli.where(ayarlanabilir.contains).toList()..sort(),
  );
}

/// Ekranda çizilecek sekmeler — katalog sırasında, kapalılar çıkarılmış.
List<MacDetaySekme> macDetayGorunurSekmeler() {
  final gizli = macDetayGizliSekmeler();
  return kMacDetaySekmeleri.where((s) => !gizli.contains(s.ad)).toList();
}

/// Screenshot_6 düzenindeki sekme çubuğu.
///
/// Kaydırma ve seçili sekmenin içerikle eşleşmesi `TabController`'ın işidir:
/// çubuk da içerik alanı (TabBarView) da AYNI denetleyiciyi kullanır, bu
/// yüzden parmakla içerik kaydırılınca üstteki seçili sekme kendiliğinden
/// güncellenir — ayrıca elle senkron tutulan bir durum YOKTUR.
class MacDetaySekmeCubugu extends StatelessWidget {
  const MacDetaySekmeCubugu({
    super.key,
    required this.controller,
    required this.sekmeler,
    required this.onAyarlar,
  });

  final TabController controller;
  final List<MacDetaySekme> sekmeler;
  final VoidCallback onAyarlar;

  @override
  Widget build(BuildContext context) {
    // ZEMİN YOK: çubuk kendi `UstPanel` kartının içinde; zemini, kenarlığı ve
    // yuvarlaklığı panel veriyor.
    return Row(
      children: [
        // AYAR DİŞLİSİ — solda SABİT: sekmelerle birlikte kaymaz, hangi
        // sekmede olunursa olunsun aynı yerde durur (Screenshot_6).
        Semantics(
          button: true,
          label: 'Maç detay sekme ayarları',
          child: GestureDetector(
            key: const Key('mac-detay-sekme-ayar-dugmesi'),
            onTap: onAyarlar,
            behavior: HitTestBehavior.opaque,
            child: Padding(
              padding: EdgeInsets.fromLTRB(
                Spacing.md,
                Spacing.md,
                Spacing.sm,
                Spacing.md,
              ),
              child: Icon(Icons.settings, size: 20, color: AppColors.textSoft),
            ),
          ),
        ),
        Container(width: 1, height: 26, color: AppColors.border),
        Expanded(
          child: TabBar(
            controller: controller,
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            padding: const EdgeInsets.only(left: Spacing.sm),
            labelPadding: const EdgeInsets.symmetric(horizontal: 14),
            labelColor: AppColors.text,
            unselectedLabelColor: AppColors.textMuted,
            labelStyle: const TextStyle(
              fontSize: 13,
              fontWeight: AppFont.black,
            ),
            unselectedLabelStyle: const TextStyle(
              fontSize: 13,
              fontWeight: AppFont.bold,
            ),
            indicatorSize: TabBarIndicatorSize.label,
            indicator: UnderlineTabIndicator(
              borderSide: BorderSide(color: AppColors.accent, width: 3),
              insets: EdgeInsets.only(bottom: 6),
            ),
            // Kendi alt kenarlığımız var; TabBar'ın kendi ayıracı çift çizgi
            // yapardı.
            dividerColor: Colors.transparent,
            overlayColor: WidgetStateProperty.all(Colors.transparent),
            tabs: [
              for (final s in sekmeler)
                Tab(
                  height: 54,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _Ikon(controller: controller, sekmeler: sekmeler, s: s),
                      const SizedBox(height: 2),
                      Text(s.ad),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Sekme ikonu — SEÇİLİ `accent`, PASİF `muted`; arası kaydırma boyunca
/// yumuşak geçer.
///
/// ESKİDEN OPAKLIKLA yapılıyordu, çünkü ikon bir emojiydi ve rengi
/// değiştirilemiyordu. Artık vektör: ikonun kendisi renk alıyor, böylece
/// pasif ikon koyu temada zeminle karışmak yerine nötr `muted` tonunda
/// okunur kalıyor. Denetleyicinin animasyonu dinlenir ki PARMAKLA
/// kaydırırken de renk anında dönsün.
class _Ikon extends StatelessWidget {
  const _Ikon({
    required this.controller,
    required this.sekmeler,
    required this.s,
  });

  final TabController controller;
  final List<MacDetaySekme> sekmeler;
  final MacDetaySekme s;

  Widget _ciz(double uzaklik) => Icon(
    s.ikon,
    size: 19,
    // `lerp` null dönebilir yalnız iki renk de null ise; ikisi de dolu.
    color: Color.lerp(AppColors.accent, AppColors.muted, uzaklik),
  );

  @override
  Widget build(BuildContext context) {
    final i = sekmeler.indexOf(s);
    final anim = controller.animation;
    if (anim == null) return _ciz(controller.index == i ? 0 : 1);
    return AnimatedBuilder(
      animation: anim,
      builder: (_, _) => _ciz((anim.value - i).abs().clamp(0.0, 1.0)),
    );
  }
}
