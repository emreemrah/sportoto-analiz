// KAYNAK: app/src/screens/HomeScreen.js (1301 satır) — BİREBİR çeviri.
//
// ÇEVRİLEN: başlık (marka + zil rozeti + avatar), hero kart (hafta, zorluk,
// ilk maç, dört sayaç, üç düğme), ülke şeridi, Yaklaşan Maçlar şeridi, Öne
// Çıkan Analizler (iki kart yan yana), Sürpriz İhtimali Yüksek şeridi.
//
// HENÜZ ÇEVRİLMEDİ: BulletinHeroVisual/Backdrop (SVG süsleme), zil rozeti
// sayısı (notificationsService · Adım 4), TakimLogoZemin filigranı.
//
// KAYNAKTAN TAŞINAN SAYIM KURALLARI (hepsi "uydurma yok" ailesinden):
//   • Sayaçlar YALNIZ gerçek analizden. "Maç Analizi" = analizi olan maç
//     sayısı; PAYDA GÖSTERİLİR (14/15) çünkü yalnız "14" yazınca kullanıcı
//     eksik veri sanıyordu.
//   • Etiketler (SÜRPRİZ ADAYI / AÇIK MAÇ / DENGELİ) GERÇEK sürpriz puanından
//     türetilir — karta göre sabit etiket uydurulmaz.
//   • 1/X/2 ihtimal kutuları veri yoksa HİÇ çizilmez.
//   • Favori kutusu DOLGULU DEĞİL: dolu kutu mobilde "seçildi" demektir, oysa
//     burada seçim yok. Açık ton + çerçeve + ▲ + "seçim değil" notu kullanılır.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/brand.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/takim_paleti.dart'
    show ayrisanYuzey, okunurAyrisanYuzey, okunurMetin;
import '../../core/theme/tokens.dart';
import '../../core/ulke_seridi.dart' show macUlkesiEn;
import '../../core/utils.dart';
import '../../core/yaklasan_maclar.dart';
import '../../widgets/app_ui.dart';
import '../../widgets/states.dart' show HazirlaniyorState, sunucuHazirlaniyor;
import '../../widgets/avatar.dart';
import '../../widgets/kayan_serit.dart';
import '../../widgets/ulke_etiketi.dart';
import '../bulletin/bulletin_providers.dart';
import 'lig_seridi.dart';
import '../../widgets/takim_logo_zemin.dart';

// SÜRPRİZ SKORU EŞİKLERİ — TEK KAYNAK. Hem filtreyi hem etiketi bunlar besler.
// Ayrı yazılırlarsa biri değişip diğeri kalır ve ekran yalan söyler: "Öne Çıkan
// 45+" yazıp aslında 50+ sayan bir sayaç, kullanıcının doğrulayamayacağı bir
// hatadır. Bu yüzden sabit inline YAZILMAZ.
/// UYGULAMANIN ANA RENGİ — marka koyu mavisi.
///
/// Takım teması seçilse bile bu renk DEĞİŞMEZ: güncel hafta rozeti markanın
/// kimliğini taşır (kullanıcı kararı). Yalnız kart'tan ayrışacak kadar tonu
/// itilir, hue korunur.
const Color kMarkaMavisi = Color(0xFF0B1B3A);

const int _oneCikanEsik = 45;
const int _surprizEsik = 65;

/// Maçın sürpriz puanı; analiz yoksa 0.
double _puan(Map m) {
  final v = (m['analysis'] as Map?)?['surpriseScore'];
  return v is num ? v.toDouble() : 0;
}

/// Ana sayfa sayımları — TEK KAYNAK.
///
/// BÖLÜM BAŞLIKLARI DA BURADAN BESLENİR (16 Ağustos 2026'da ölçülen hata):
/// hero'daki sayaç "Öne Çıkan **0**" yazarken hemen altındaki bölüm
/// "Öne Çıkan Analizler" başlığıyla 2 kart gösteriyordu; aynı şekilde
/// "Sürpriz Adayı **0**" iken şerit "Sürpriz İhtimali Yüksek" diyordu.
/// Sebep: sayaçlar eşiğe (`_oneCikanEsik` / `_surprizEsik`) bakıyor, bölümler
/// ise eşiğe BAKMADAN en yüksek 2-3 maçı basıyordu. Kartların kendi etiketi
/// ("DENGELİ") dürüsttü; yalan söyleyen BAŞLIKTI.
///
/// Bu dosyanın kendi kuralı zaten bunu söylüyor: eşikler tek kaynaktır, yoksa
/// "ekran yalan söyler". Sayım da aynı yerden gelmeli.
class _Sayim {
  const _Sayim({
    required this.analizli,
    required this.oneCikan,
    required this.surpriz,
  });

  /// Gerçekten analizi olan maç sayısı.
  final int analizli;

  /// `_oneCikanEsik` eşiğini geçen maç sayısı.
  final int oneCikan;

  /// `_surprizEsik` eşiğini geçen maç sayısı.
  final int surpriz;
}

_Sayim _sayimYap(List matches) {
  final analizli = matches.cast<Map>().where((m) {
    final a = m['analysis'] as Map?;
    return a != null && a['surpriseScore'] != null;
  }).toList();
  return _Sayim(
    analizli: analizli.length,
    oneCikan: analizli.where((m) => _puan(m) >= _oneCikanEsik).length,
    surpriz: analizli.where((m) => _puan(m) >= _surprizEsik).length,
  );
}

String _shortTeam(Object? name) => '${name ?? ''}'
    .replaceAll(RegExp(r'\s+FK$', caseSensitive: false), '')
    .replaceAll(RegExp(r'\s+SK$', caseSensitive: false), '')
    .trim();

String _matchTime(Object? iso) {
  if (iso is! String) return 'Saat yok';
  final d = DateTime.tryParse(iso)?.toLocal();
  if (d == null) return 'Saat yok';
  String p(int n) => n.toString().padLeft(2, '0');
  return '${p(d.hour)}:${p(d.minute)}';
}

const List<String> _kisaGunler = [
  'Paz',
  'Pzt',
  'Sal',
  'Çar',
  'Per',
  'Cum',
  'Cmt',
];
const List<String> _kisaAylar = [
  'Oca',
  'Şub',
  'Mar',
  'Nis',
  'May',
  'Haz',
  'Tem',
  'Ağu',
  'Eyl',
  'Eki',
  'Kas',
  'Ara',
];

/// ÖNCEKİ HAFTANIN DEVAM EDEN MAÇLARI. Ayrı bir istektir ve BAŞARISIZ OLMASI
/// ana sayfayı BOZMAZ: bülten yine çizilir, liste yalnız güncel haftayı
/// gösterir. Ek bir veri için asıl ekranı riske atmak doğru olmazdı.
final _oncekiHaftaProvider = FutureProvider.autoDispose<Map<String, dynamic>?>((
  ref,
) async {
  try {
    final r = await api.rounds();
    final id = oncekiRoundId(r as Map?);
    if (id == null) return null;
    final h = await api.history(id);
    final ad = ((r as Map)['rounds'] as List?)
        ?.cast<Map>()
        .where((x) => x['id'] == id)
        .firstOrNull?['name'];
    return {
      'roundId': id,
      'round': ad,
      'matches': (h as Map?)?['matches'] ?? const [],
    };
  } catch (_) {
    return null; // sessiz geç — ana akış bozulmasın
  }
});

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bulletinAsync = ref.watch(bulletinProvider);
    final data = bulletinAsync.valueOrNull;
    final error = bulletinAsync.hasError ? '${bulletinAsync.error}' : null;
    final onceki = ref.watch(_oncekiHaftaProvider).valueOrNull;

    // GÜNCEL BÜLTEN YERİNE OTURDU MU (veri geldi ya da hata verdi).
    // "Yaklaşan Maçlar" iki isteği birleştirir ve önceki hafta isteği KÜÇÜK
    // olduğu için düzenli olarak ÖNCE döner; bülten (≈1 MB) hâlâ yoldayken
    // şerit tek başına çizilirse ana sayfa bir süre YALNIZ geçen haftanın
    // maçlarını gösterir, sonra yeni hafta üzerine biner (16 Ağu 2026 tespiti).
    final bultenYerlesti = data != null || error != null;

    final matches = (data?['matches'] as List?) ?? const [];

    // 360px SINIFI EKRANLAR: dar ekranda analiz kartları yan yana sıkışmak
    // yerine ALT ALTA dizilir.
    final darEkran = MediaQuery.sizeOf(context).width < 400;

    final siraliAnaliz =
        matches.cast<Map>().where((m) => m['status'] != 'finished').toList()
          ..sort((a, b) => _puan(b).compareTo(_puan(a)));

    final displayAnalysis = siraliAnaliz.isNotEmpty
        ? siraliAnaliz.take(2).toList()
        : matches.cast<Map>().take(2).toList();
    final displaySurprise = siraliAnaliz.isNotEmpty
        ? siraliAnaliz.take(3).toList()
        : matches.cast<Map>().take(3).toList();

    // BÖLÜM BAŞLIKLARI SAYAÇLARLA AYNI HESAPTAN (bkz. `_sayimYap`). Başlık,
    // altında GERÇEKTEN ne durduğunu anlatır; eşiği geçen maç yokken "öne
    // çıkan" ya da "sürpriz ihtimali yüksek" DENMEZ.
    final sayim = _sayimYap(matches);
    final analizBasligi = sayim.oneCikan > 0
        ? 'Öne Çıkan Analizler'
        : (sayim.analizli > 0 ? 'Analiz Edilen Maçlar' : 'Bültenden Maçlar');
    final surprizBasligi = sayim.surpriz > 0
        ? 'Sürpriz İhtimali Yüksek'
        : 'Sürpriz Puanına Göre Sıralı';

    // Yaklaşan maçlar — GÜNCEL hafta + ÖNCEKİ haftadan henüz oynanmamışlar,
    // tarihe göre en yakın önce.
    final upcoming = yaklasanMaclar({
      'roundId': data?['roundId'],
      'round': data?['round'],
      'matches': matches,
    }, onceki);

    return Scaffold(
      body: filigranli(
        SafeArea(
          bottom: false,
          child: RefreshIndicator(
            // Gösterge SAYFA ZEMİNİNİN üstünde çiziliyor.
            color: AppColors.onBackgroundAccent,
            onRefresh: () async {
              ref.invalidate(bulletinProvider);
              ref.invalidate(_oncekiHaftaProvider);
              await ref.read(bulletinProvider.future);
            },
            child: ListView(
              padding: const EdgeInsets.only(bottom: Spacing.xl + 12),
              children: [
                _Header(data: data),
                _HeroCard(
                  data: data,
                  loading: data == null && error == null,
                  onBulteniAc: () => GoRouter.of(context).go('/bulten'),
                  onOzet: () => context.push('/ana-sayfa/hafta-ozeti'),
                  onKapanis: () => context.push('/ana-sayfa/hafta-kapanisi'),
                ),

                // Bu haftanın ülkeleri: bayrak + ad, kayan tek satır. Bülten
                // yokken bileşen hiç çizilmez (boş çubuk bırakmaz).
                LigSeridi(matches: data?['matches'] as List?),

                // YAKLAŞAN MAÇLAR — konum kullanıcı isteğiyle "Öne Çıkan
                // Analizler"in ÜSTÜNDE: önce "ne zaman ne oynanıyor", sonra
                // "hangisi ilginç".
                //
                // BÜLTEN YERLEŞMEDEN ÇİZİLMEZ: liste iki haftayı belli bir
                // oranda karıştırır (güncel haftaya ayrılan asgari yer). Güncel
                // hafta henüz elde yokken çizmek o oranı bozar ve şeridi geçici
                // olarak %100 geçen haftaya bırakır. Hata durumunda da çizilir:
                // orada güncel hafta gerçekten yoktur ve geçen hafta doğru
                // yedektir.
                if (bultenYerlesti && upcoming.isNotEmpty) ...[
                  _SectionHead(
                    title: 'Yaklaşan Maçlar',
                    right: 'Tümünü Gör ›',
                    onTap: () => GoRouter.of(context).go('/bulten'),
                  ),
                  KayanSerit(
                    // YATAY BOŞLUK VERİLMEZ (16 Ağustos 2026'da ölçüldü).
                    // `KayanSerit` içeriğin iki kopyasını yan yana koyup BİR
                    // KOPYA genişliği kadar kayınca başa döner; ölçülen
                    // genişliğe şeridin `padding`'i DAHİL DEĞİLDİR. Yatay
                    // boşluk verilince başa dönüşte solda boşluk kadar sıçrama
                    // oluşur ve "dikişsiz döngü" bozulur.
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    semanticsLabel:
                        'Yaklaşan maçlar: ${upcoming.length} karşılaşma',
                    children: [
                      for (final m in upcoming) _KickoffCard(match: m),
                    ],
                  ),
                ],

                _SectionHead(
                  title: analizBasligi,
                  right: 'Tümünü Gör ›',
                  onTap: () => GoRouter.of(context).go('/radar'),
                ),

                if (data == null && error == null)
                  Padding(
                    padding: EdgeInsets.symmetric(horizontal: Spacing.md),
                    child: SkeletonCard(),
                  )
                // SUNUCU UYANIYORSA HATA DEĞİL, BEKLEME (16 Ağustos 2026).
                // Uç 503 + "veri henüz hazır değil" dönüyor; ham hata metnini
                // basmak kullanıcıya arıza var sandırıyordu.
                //
                // OTOMATİK YENİLEME AÇIK (2026-08-21): zamanlayıcıyı artık
                // HazirlaniyorState kendisi taşıyor. Eskiden kapalıydı ve ana
                // sayfa AÇILIŞ EKRANI olduğu için soğuk açılışta (61-90 sn)
                // elle basmayan kullanıcı hep hata görüp çıkıyordu — "sunucuya
                // bir daha bağlanmadı" bildirimi buradan geliyordu. Önceki
                // hafta sağlayıcısı da tazelenir; yoksa bülten gelince
                // "Yaklaşan Maçlar" geçen haftasız kalırdı (aşağı çekme
                // yenilemesiyle aynı çift tazeleme).
                else if (sunucuHazirlaniyor(bulletinAsync.error))
                  HazirlaniyorState(
                    onRetry: () {
                      ref.invalidate(bulletinProvider);
                      ref.invalidate(_oncekiHaftaProvider);
                    },
                  )
                else if (error != null || matches.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: Spacing.md),
                    child: EmptyState(
                      icon: Icons.bar_chart,
                      title: error != null
                          ? 'Bülten alınamadı'
                          : 'Dashboard hazırlanıyor',
                      message:
                          error ??
                          'Güncel bülten yayınlanınca analiz kartları burada '
                              'görünecek.',
                    ),
                  )
                else
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: Spacing.md),
                    // İKİ KART HER ZAMAN AYNI YÜKSEKLİKTE (kullanıcı kararı,
                    // 16 Ağustos 2026). Eskiden `Row` her kartı kendi içeriğine
                    // göre boyutluyordu: ihtimalleri olan kart uzuyor, veri
                    // gelmeyen kart kısa kalıyordu ve yan yana duran iki kart
                    // basamak gibi görünüyordu. `IntrinsicHeight` + `stretch`
                    // ikisini de UZUN OLANIN boyuna getirir; kartın kendisi de
                    // artan boşluğu düğmeyi alta iterek harcar (bkz.
                    // _AnalysisCard içindeki Spacer).
                    child: IntrinsicHeight(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          for (final m in displayAnalysis) ...[
                            Expanded(
                              child: _AnalysisCard(match: m, dar: darEkran),
                            ),
                            if (m != displayAnalysis.last)
                              const SizedBox(width: 8),
                          ],
                        ],
                      ),
                    ),
                  ),

                _SectionHead(
                  title: surprizBasligi,
                  right: 'Tümünü Gör ›',
                  onTap: () => GoRouter.of(context).go('/bulten'),
                ),

                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(
                    horizontal: Spacing.md,
                    vertical: 4,
                  ),
                  child: Row(
                    // HİÇ ANALİZ YOKKEN SIRALAMA GÖSTERİLMEZ: sürpriz puanı
                    // olmayan maçları "sürpriz" bölümünde dizmek, olmayan
                    // veriyi varmış gibi göstermek olurdu. Bekleme metni yazılır.
                    children: (displaySurprise.isEmpty || sayim.analizli == 0)
                        ? [
                            Container(
                              padding: const EdgeInsets.all(Spacing.md),
                              decoration: BoxDecoration(
                                color: AppColors.card,
                                borderRadius: AppRadius.mdR,
                              ),
                              child: Text(
                                'Sürpriz analizi için veri bekleniyor.',
                                style: TextStyle(
                                  color: AppColors.textMuted,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ]
                        : [
                            for (final m in displaySurprise)
                              _SurpriseCard(match: m),
                          ],
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

class _Header extends StatelessWidget {
  const _Header({required this.data});
  final Map? data;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(
      Spacing.md,
      Spacing.md,
      Spacing.md,
      Spacing.sm,
    ),
    child: Row(
      children: [
        Expanded(
          child: RichText(
            text: TextSpan(
              style: TextStyle(
                // Üst çubuk ZEMİNİN üstünde — kart değil.
                color: AppColors.onBackground,
                fontSize: 19,
                fontWeight: AppFont.black,
                letterSpacing: -0.3,
              ),
              children: [
                TextSpan(text: '$kBrandLine1 '),
                TextSpan(
                  text: kBrandLine2,
                  // ZEMİN üstünde duruyor: `accent` KART için türetildiğinden
                  // burada zeminle çakışıp marka satırının ikinci yarısı
                  // kayboluyordu (BB Erzurumspor teması, mavi üstüne mavi).
                  style: TextStyle(color: AppColors.onBackgroundAccent),
                ),
              ],
            ),
          ),
        ),
        // ZİL — bildirim merkezi Adım 4'te. Kırmızı sayı YALNIZ okunmamış
        // GERÇEK bildirim varsa görünür; süs rozeti yoktur. Sayı kaynağı
        // henüz bağlanmadığı için rozet HİÇ çizilmiyor (0 yazmıyor).
        Semantics(
          button: true,
          label: 'Bildirimler',
          child: GestureDetector(
            onTap: () => context.push('/ana-sayfa/bildirimler'),
            behavior: HitTestBehavior.opaque,
            child: Padding(
              padding: const EdgeInsets.all(6),
              // ZİL VEKTÖR: emojiyken üst çubuk koyu temada koyulaşırken zil
              // sabit renkte kalıyordu.
              child: Icon(
                Icons.notifications_none,
                size: 22,
                color: AppColors.onBackground,
              ),
            ),
          ),
        ),
        const SizedBox(width: 6),
        GestureDetector(
          onTap: () => GoRouter.of(context).go('/profil'),
          child: const ProfileAvatar(size: 34),
        ),
      ],
    ),
  );
}

class _HeroCard extends StatelessWidget {
  const _HeroCard({
    required this.data,
    required this.loading,
    required this.onBulteniAc,
    required this.onOzet,
    required this.onKapanis,
  });

  final Map? data;
  final bool loading;
  final VoidCallback onBulteniAc;
  final VoidCallback onOzet;
  final VoidCallback onKapanis;

  @override
  Widget build(BuildContext context) {
    final matches = (data?['matches'] as List?) ?? const [];

    // Sayılar YALNIZ güncel bültenin GERÇEK analizinden — ve bölüm
    // başlıklarıyla AYNI hesaptan (`_sayimYap`).
    final sayim = _sayimYap(matches);
    final total = sayim.analizli;
    final bulletinTotal = matches.length;
    final featured = sayim.oneCikan;
    final surprise = sayim.surpriz;
    final leagues = matches
        .cast<Map>()
        .map((m) => m['league'])
        .where((l) => l != null)
        .toSet()
        .length;

    final hazir = !loading && data != null;
    String v(int n) => hazir ? '$n' : '–';

    // ZORLUK ETİKETİ KALDIRILDI (kullanıcı kararı, 16 Ağustos 2026).
    //
    // Hero'da "Zorluk: Kolay / Orta / Zor" yazıyordu. İki ayrı sebeple kalktı:
    //   • YANILTICI: haftanın "kolay" olması diye bir şey yok; etiket
    //     kullanıcıya tutturma kolaylığı vaat ediyordu. Bu uygulama kupon
    //     karar desteği verir, kolaylık/garanti sözü vermez.
    //   • Rozetin rengi anlamsal yeşil/sarı/kırmızıydı ve takım temasının
    //     dışında kalıyordu.
    // Backend'in `difficulty` alanı DURUYOR; yalnız bu ekranda gösterilmiyor.
    //
    // Kalan satır haftanın GERÇEK verisi: ilk maç zamanı. Veri yoksa çizilmez.
    DateTime? ilk;
    for (final m in matches.cast<Map>()) {
      final t = m['date'] is String
          ? DateTime.tryParse(m['date'] as String)?.toLocal()
          : null;
      if (t != null && (ilk == null || t.isBefore(ilk))) ilk = t;
    }

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: Spacing.md),
      padding: const EdgeInsets.all(Spacing.lg),
      decoration: BoxDecoration(
        color: AppColors.heroZemin,
        borderRadius: AppRadius.xlR,
        boxShadow: AppShadow.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 4,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: AppColors.accent,
                  shape: BoxShape.circle,
                ),
              ),
              Text(
                '${data?['round'] ?? '—'}',
                style: TextStyle(
                  color: AppColors.onHero,
                  fontSize: 12,
                  fontWeight: AppFont.heavy,
                  letterSpacing: 0.5,
                ),
              ),
              if (hazir && ilk != null)
                Text(
                  'İlk maç: ${_kisaGunler[ilk.weekday % 7]} '
                  '${_matchTime(ilk.toIso8601String())}',
                  style: TextStyle(
                    color: AppColors.onHero.withValues(alpha: 0.70),
                    fontSize: 10.5,
                    fontWeight: AppFont.bold,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            'Bu Haftanın Bülteni',
            style: TextStyle(
              color: AppColors.onHero,
              fontSize: 20,
              fontWeight: AppFont.black,
            ),
          ),
          const SizedBox(height: 14),

          // Sayaçlar ve düğmeler AYRI satırlarda. Aynı satırda olduklarında
          // telefon genişliğinde sütunlar eziliyor ve etiketler harf harf alt
          // alta düşüyordu — yayında bozuk görünen gerçek bir kusurdu.
          Row(
            children: [
              _sayac(
                v(total),
                'Maç Analizi',
                suffix: hazir ? '/$bulletinTotal' : null,
              ),
              _ayrac(),
              _sayac(v(featured), 'Öne Çıkan'),
              _ayrac(),
              _sayac(v(surprise), 'Sürpriz Adayı'),
              _ayrac(),
              _sayac(v(leagues), 'Lig'),
            ],
          ),
          const SizedBox(height: 14),

          Row(
            children: [
              Expanded(
                child: _dugme('Bülteni Aç', onBulteniAc, dolu: true, ok: true),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _dugme(
                  'Haftanın Özeti',
                  onOzet,
                  ikon: Icons.live_tv_outlined,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          _dugme(
            'Geçen Haftanın Kapanışı',
            onKapanis,
            ok: true,
            ikon: Icons.sports_score_outlined,
          ),
        ],
      ),
    );
  }

  Widget _sayac(String deger, String etiket, {String? suffix}) => Expanded(
    child: Column(
      children: [
        RichText(
          maxLines: 1,
          text: TextSpan(
            style: TextStyle(
              color: AppColors.onHero,
              fontSize: 22,
              fontWeight: AppFont.black,
            ),
            children: [
              TextSpan(text: deger),
              // Payda küçük punto: "14/15" dar telefonda dört sütuna
              // sığsın diye sayı 22pt kalır, "/15" 13pt'ye düşer.
              if (suffix != null)
                TextSpan(text: suffix, style: const TextStyle(fontSize: 13)),
            ],
          ),
        ),
        const SizedBox(height: 2),
        Text(
          etiket,
          maxLines: 2,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: AppColors.onHero.withValues(alpha: 0.70),
            fontSize: 10,
            fontWeight: AppFont.bold,
          ),
        ),
      ],
    ),
  );

  Widget _ayrac() => Container(
    width: 1,
    height: 28,
    color: AppColors.onHero.withValues(alpha: 0.20),
  );

  /// [ikon] AYRI PARAMETRE, metne gömülü emoji DEĞİL (kullanıcı isteği,
  /// 2026-08-12): düğmenin yazısı hero zeminine göre `onHero`/`onAccent`
  /// alırken emoji sabit renkte kalıyordu.
  Widget _dugme(
    String etiket,
    VoidCallback onTap, {
    bool dolu = false,
    bool ok = false,
    IconData? ikon,
  }) => GestureDetector(
    onTap: onTap,
    behavior: HitTestBehavior.opaque,
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 12),
      decoration: BoxDecoration(
        color: dolu
            ? AppColors.accent
            : AppColors.onHero.withValues(alpha: 0.10),
        borderRadius: AppRadius.mdR,
        border: dolu
            ? null
            : Border.all(color: AppColors.onHero.withValues(alpha: 0.20)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (ikon != null) ...[
            Icon(
              ikon,
              size: 15,
              color: dolu ? AppColors.onAccent : AppColors.onHero,
            ),
            const SizedBox(width: 6),
          ],
          Flexible(
            child: Text(
              etiket,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: dolu ? AppColors.onAccent : AppColors.onHero,
                fontSize: 12.5,
                fontWeight: AppFont.black,
              ),
            ),
          ),
          if (ok)
            Padding(
              padding: EdgeInsets.only(left: 6),
              child: Text(
                '›',
                style: TextStyle(
                  color: dolu ? AppColors.onAccent : AppColors.onHero,
                  fontSize: 15,
                  fontWeight: AppFont.black,
                ),
              ),
            ),
        ],
      ),
    ),
  );
}

class _SectionHead extends StatelessWidget {
  const _SectionHead({required this.title, this.right, this.onTap});

  final String title;
  final String? right;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(
      Spacing.md,
      Spacing.xl,
      Spacing.md,
      Spacing.sm,
    ),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style: TextStyle(
            // ZEMİNİN üstünde duruyor, kartın değil → `onBackground`.
            // Ters kontrast düzeninde `text` kartın metnidir ve takım
            // temasında zeminle aynı renge düşer (Galatasaray: sarı/sarı).
            color: AppColors.onBackground,
            fontSize: 16,
            fontWeight: AppFont.black,
          ),
        ),
        if (right != null)
          GestureDetector(
            onTap: onTap,
            behavior: HitTestBehavior.opaque,
            child: Text(
              right!,
              style: TextStyle(
                // ZEMİN üstünde duran bağlantı — kart vurgusu değil.
                color: AppColors.onBackgroundAccent,
                fontSize: 12,
                fontWeight: AppFont.heavy,
              ),
            ),
          ),
      ],
    ),
  );
}

class _AnalysisCard extends StatelessWidget {
  const _AnalysisCard({required this.match, this.dar = false});

  final Map match;
  final bool dar;

  @override
  Widget build(BuildContext context) {
    final analysis = match['analysis'] as Map?;
    final probs = analysis?['probabilities'] as Map?;
    // NOT: `analysis['favorite']` BİLEREK okunmuyor — 1/X/2 kutuları tek tip
    // (2026-08-11 kullanıcı kararı, bkz. _ihtimalKutusu). Favoriyi ayırt eden
    // hiçbir görsel işaret yok, dolayısıyla değerine de ihtiyaç yok.

    // Etiket GERÇEK sürpriz puanından — karta göre sabit etiket uydurulmaz.
    //
    // RENK: rozet artık SABİT yeşil/sarı/kırmızı DEĞİL, temanın YUMUŞAK
    // YÜZEYLERİNDEN gelir (kullanıcı kararı, 16 Ağustos 2026). Eski hâlde
    // "DENGELİ" `AppColors.field` (0xFF16A34A) ile çiziliyordu; bu ton takım
    // temasının da açık/koyu görünümün de dışında kalan, her yerde görülen
    // genel bir yeşildi. `*Soft` yüzeyler [temayiUygula] tarafından takıma ve
    // görünüme göre yeniden hesaplanır; yazı rengi de zeminden türetilir
    // (`okunurMetin`), böylece kontrast her temada korunur.
    //
    // ÜÇ ROZET ÜÇ AYRI YÜZEY: takım temasında `accentSoft` ile `primarySoft`
    // AYNI renge ayarlanıyor (takim_gorunumu.dart) — ikisini kullansaydık
    // "AÇIK MAÇ" ile "DENGELİ" birbirinden ayırt edilemezdi. Bu yüzden en
    // dikkat çeken kademe DOLGULU takım vurgusu, ortası uyarı yüzeyi, en
    // sakini tema yüzeyidir.
    // Yumuşak yüzeyler karttan AYRIŞTIRILIR (bkz. ayrisanYuzey): ham değerler
    // bazı temalarda kartın üstünde seçilmiyor ve rozet kayboluyordu.
    final sc = (analysis?['surpriseScore'] as num?)?.toDouble() ?? 0;
    final uyariZemin = ayrisanYuzey(AppColors.warningSoft, AppColors.card);
    final temaZemin = ayrisanYuzey(AppColors.primarySoft, AppColors.card);
    final (tag, tagZemin, tagYazi) = sc >= _surprizEsik
        ? ('SÜRPRİZ ADAYI', AppColors.accent, AppColors.onAccent)
        : sc >= _oneCikanEsik
        ? ('AÇIK MAÇ', uyariZemin, okunurMetin(uyariZemin))
        : ('DENGELİ', temaZemin, okunurMetin(temaZemin));

    final d = match['date'] is String
        ? DateTime.tryParse(match['date'] as String)?.toLocal()
        : null;

    num deger(Object? v) => v is num ? v : (num.tryParse('$v') ?? 0);
    final segs = probs == null
        ? const <({String k, num v})>[]
        : [
            (k: '1', v: deger(probs['1'])),
            (k: 'X', v: deger(probs['X'] ?? probs['0'])),
            (k: '2', v: deger(probs['2'])),
          ];

    return GestureDetector(
      onTap: () => _acDetay(context, match['no']),
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: EdgeInsets.all(dar ? 10 : Spacing.md),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: AppRadius.lgR,
          border: Border.all(color: AppColors.border),
          boxShadow: AppShadow.soft,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Flexible(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 7,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: tagZemin,
                      borderRadius: AppRadius.smR,
                    ),
                    child: Text(
                      tag,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: tagYazi,
                        fontSize: dar ? 8.5 : 9.5,
                        fontWeight: AppFont.black,
                        letterSpacing: 0.3,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 4),
                UlkeEtiketi(
                  league: match['league'] as String?,
                  ligGoster: false,
                  kisa: dar,
                  yedekUlkeEn: macUlkesiEn(match),
                ),
              ],
            ),
            const SizedBox(height: 10),

            Row(
              children: [
                Expanded(child: _takim(match, 'home')),
                Column(
                  children: [
                    Container(
                      width: dar ? 26 : 32,
                      height: dar ? 26 : 32,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: AppColors.bgAlt,
                        shape: BoxShape.circle,
                      ),
                      child: Text(
                        'VS',
                        style: TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 10,
                          fontWeight: AppFont.black,
                        ),
                      ),
                    ),
                    if (d != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          '${d.day} ${_kisaAylar[d.month - 1]}'
                          '${dar ? '\n' : ' · '}'
                          '${_matchTime(match['date'])}',
                          maxLines: dar ? 2 : 1,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 9.5,
                            fontWeight: AppFont.bold,
                          ),
                        ),
                      ),
                  ],
                ),
                Expanded(child: _takim(match, 'away')),
              ],
            ),

            // GERÇEK ihtimaller. UYDURMA YOK: veri yoksa 1/X/2 kutuları
            // çizilmez — boş kutu ya da "%–" kullanıcıya sayı varmış izlenimi
            // verirdi. Onun yerine AYNI YÜKSEKLİKTE dürüst bir satır konur
            // ("İhtimal verisi yok"), böylece yan yana duran iki kart aynı
            // iskelete oturur ve eksik veri açıkça söylenmiş olur.
            const SizedBox(height: 10),
            if (segs.isNotEmpty)
              Row(
                children: [
                  for (final s in segs) ...[
                    Expanded(
                      child: _ihtimalKutusu(
                        s.k,
                        s.v,
                        analysis?['estimated'] == true,
                      ),
                    ),
                    if (s.k != '2') SizedBox(width: dar ? 4 : 5),
                  ],
                ],
              )
            else
              _ihtimalYok(),
            // Açıklama satırının yeri: kartı ferahlatmak için küçük bir
            // nefes payı bırakıldı (2026-08-11).
            SizedBox(height: dar ? 2 : 4),

            const SizedBox(height: 8),
            Text(
              '${analysis?['comment'] ?? match['aiComment'] ?? 'Form ve istatistik verileri birlikte değerlendiriliyor.'}',
              maxLines: dar ? 1 : 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: AppColors.textSoft,
                fontSize: dar ? 10 : 11.5,
                height: dar ? 1.3 : 1.4,
              ),
            ),
            // ARTAN BOŞLUĞU YUTAR: kartlar `IntrinsicHeight` ile eşit boya
            // getirildiğinde kısa kalan kartın fazlası buraya gider ve
            // "Analiz Detayı" düğmesi İKİ KARTTA DA en altta hizalanır.
            const Spacer(),
            const SizedBox(height: 8),
            Container(
              padding: EdgeInsets.symmetric(vertical: dar ? 7 : 9),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: AppRadius.smR,
              ),
              child: Text(
                'Analiz Detayı ›',
                style: TextStyle(
                  color: AppColors.onPrimary,
                  fontSize: dar ? 11 : 12.5,
                  fontWeight: AppFont.black,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _takim(Map m, String taraf) => Column(
    children: [
      Logo(
        uri: crestOf(m.cast<String, dynamic>(), taraf),
        name: (m[taraf] as Map?)?['name'] as String?,
        size: dar ? 28 : 46,
      ),
      const SizedBox(height: 5),
      Text(
        _shortTeam((m[taraf] as Map?)?['name']),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        textAlign: TextAlign.center,
        style: TextStyle(
          color: AppColors.text,
          fontSize: dar ? 10.5 : 12.5,
          fontWeight: AppFont.heavy,
        ),
      ),
    ],
  );

  /// İhtimal verisi olmayan maç için 1/X/2 satırının DÜRÜST karşılığı.
  ///
  /// `_ihtimalKutusu` ile AYNI iskelet (aynı iç boşluk, aynı iki satır, aynı
  /// punto) kullanılır; tek fark sayı yerine "verisi yok" yazmasıdır. Böylece
  /// yan yana duran iki kartın yüksekliği veri durumundan bağımsız aynı kalır
  /// ve eksik veri gizlenmek yerine açıkça söylenir.
  Widget _ihtimalYok() => Container(
    padding: EdgeInsets.symmetric(vertical: dar ? 3 : 4),
    alignment: Alignment.center,
    decoration: BoxDecoration(
      color: AppColors.bgAlt,
      borderRadius: AppRadius.smR,
    ),
    child: Column(
      children: [
        Text(
          'İHTİMAL',
          style: TextStyle(
            color: AppColors.textSoft,
            fontSize: dar ? 7 : 8,
            fontWeight: AppFont.bold,
          ),
        ),
        Text(
          'verisi yok',
          style: TextStyle(
            color: AppColors.textMuted,
            fontSize: dar ? 7.5 : 8.5,
            fontWeight: AppFont.bold,
          ),
        ),
      ],
    ),
  );

  /// 1/X/2 KUTULARI TEK TİPTİR — hiçbir seçenek öne çıkarılmaz.
  ///
  /// Üç turluk bir geri bildirim zincirinin sonucu:
  ///   • 2026-08-06 — "MS1 %40 seçilmiş gibi duruyor": dolgulu kutu kaldırıldı.
  ///   • 2026-08-11 (1) — ok işareti (▲), mavi çerçeve ve "en yüksek ihtimal —
  ///     seçim değil" açıklaması kaldırıldı; vurgu koyu zemin + kalın yazıya
  ///     indirildi.
  ///   • 2026-08-11 (2) — KALAN VURGU DA KALDIRILDI: koyu zemin ve kalın yazı
  ///     dahil hiçbir ayrım yok. Kullanıcı gerekçesi: hangi ihtimalin yüksek
  ///     olduğunu vurgulamak SEÇİM YÖNLENDİRMESİdir. Ekran sayıyı söyler,
  ///     yorumu kullanıcı yapar.
  ///
  /// Bu yüzden fonksiyon favoriyi BİLMEZ: ayırt edici bir parametre yok, yani
  /// vurgu yanlışlıkla geri gelemez. `analysis['favorite']` de okunmuyor.
  /// Erişilebilirlik etiketi de nötr ("1: yüzde 38") — ekran okuyucu kullanan
  /// biri de yönlendirilmez, yüzdeleri kendisi karşılaştırır.
  ///
  /// ÖLÇÜLER (2026-08-11 ikinci tur): yüzde 10.5→8.5 (~%20 küçük), sembol
  /// 9→8, dikey iç boşluk 5→4; dar sürüm sırasıyla 9.5→7.5, 8→7, 3.5→3.
  /// Üç kutu `Expanded` ile eşit genişlikte; ikisi arasında tek fark DEĞERDİR.
  Widget _ihtimalKutusu(String k, num v, bool estimated) => Semantics(
    label: '$k: yüzde $v',
    child: Container(
      padding: EdgeInsets.symmetric(vertical: dar ? 3 : 4),
      decoration: BoxDecoration(
        color: AppColors.bgAlt,
        borderRadius: AppRadius.smR,
      ),
      child: Column(
        children: [
          Text(
            k,
            style: TextStyle(
              color: AppColors.textSoft,
              fontSize: dar ? 7 : 8,
              fontWeight: AppFont.bold,
            ),
          ),
          Text(
            '%$v${estimated ? '≈' : ''}',
            style: TextStyle(
              color: AppColors.text,
              fontSize: dar ? 7.5 : 8.5,
              fontWeight: AppFont.bold,
            ),
          ),
        ],
      ),
    ),
  );
}

class _SurpriseCard extends StatelessWidget {
  const _SurpriseCard({required this.match});
  final Map match;

  @override
  Widget build(BuildContext context) {
    // Seviye ve yüzde GERÇEK sürpriz puanından — sıraya göre etiket
    // uydurulmaz.
    //
    // RENK: `_AnalysisCard` rozetiyle aynı gerekçe (16 Ağustos 2026) — sabit
    // yeşil/sarı yerine temanın yumuşak yüzeyleri; yazı zeminden türetilir.
    final score = (match['analysis'] as Map?)?['surpriseScore'] as num? ?? 0;
    final level = score >= 65 ? 'YÜKSEK' : (score >= 45 ? 'ORTA' : 'DÜŞÜK');
    final zemin = ayrisanYuzey(
      score >= 65
          ? AppColors.warningSoft
          : (score >= 45 ? AppColors.primarySoft : AppColors.bgAlt),
      AppColors.card,
    );
    final yazi = okunurMetin(zemin);

    // İzleyici armadan takımı tanımaz — kısaltılmış ad her zaman görünür.
    String kisaAd(Map? t) {
      final v = t?['mediumName'] ?? t?['shortName'];
      if (v != null && '$v'.isNotEmpty) return '$v';
      final n = '${t?['name'] ?? ''}';
      if (n.isEmpty) return '—';
      return n.length > 10 ? n.substring(0, 10) : n;
    }

    return GestureDetector(
      onTap: () => _acDetay(context, match['no']),
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: 168,
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.all(Spacing.md),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: AppRadius.lgR,
          border: Border.all(color: AppColors.border),
          boxShadow: AppShadow.soft,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            UlkeEtiketi(
              league: match['league'] as String?,
              ligGoster: false,
              yedekUlkeEn: macUlkesiEn(match),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                Logo(
                  uri: crestOf(match.cast<String, dynamic>(), 'home'),
                  name: (match['home'] as Map?)?['name'] as String?,
                  size: 30,
                ),
                Text(
                  'VS',
                  style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 11,
                    fontWeight: AppFont.black,
                  ),
                ),
                Logo(
                  uri: crestOf(match.cast<String, dynamic>(), 'away'),
                  name: (match['away'] as Map?)?['name'] as String?,
                  size: 30,
                ),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                Expanded(
                  child: Text(
                    kisaAd(match['home'] as Map?),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: _adStil,
                  ),
                ),
                Expanded(
                  child: Text(
                    kisaAd(match['away'] as Map?),
                    maxLines: 1,
                    textAlign: TextAlign.right,
                    overflow: TextOverflow.ellipsis,
                    style: _adStil,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: zemin,
                    borderRadius: AppRadius.smR,
                  ),
                  child: Text(
                    level,
                    style: TextStyle(
                      color: yazi,
                      fontSize: 9.5,
                      fontWeight: AppFont.black,
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    score > 0 ? 'İhtimal: %$score' : 'Veri bekleniyor',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 10.5,
                      fontWeight: AppFont.bold,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // GETTER, `static final` DEĞİL (2026-08-12): `AppColors.text` takım
  // temasıyla değişir. Statik alan — final olsun olmasın — İLK OKUNDUĞUNDA
  // bir kez hesaplanır ve o renkte donardı; takım değiştirildiğinde bu yazı
  // eski temada kalırdı. Analizcinin `prefer_final_fields` önerisi burada
  // yanlıştır, o yüzden alan tümden getter'a çevrildi.
  static TextStyle get _adStil => TextStyle(
    color: AppColors.text,
    fontSize: 11.5,
    fontWeight: AppFont.heavy,
  );
}

/// Yaklaşan maç kartı — gerçek bülten verisi: gün + saat + takımlar + ülke.
///
/// HAFTA ROZETİ HER KARTTA VARDIR (kullanıcı kararı, 16 Ağustos 2026). Önceden
/// yalnız önceki haftanın maçlarında çiziliyordu; rozetsiz kart "hafta bilgisi
/// yok" değil "güncel hafta" demek oluyordu ve bunu ancak rozetli kartlarla
/// karşılaştıran biri anlayabiliyordu. Liste iki haftayı karıştırdığı için her
/// kart hangi bültene ait olduğunu KENDİ ÜSTÜNDE yazar; iki hafta rozetin
/// renginden de ayırt edilir.
/// TIKLAMA HEDEFİ haftaya göre değişir — önceki hafta maçı MAÇ DETAYINA
/// GİDEMEZ, çünkü detay sıra numarasını GÜNCEL bültende arar ve aynı
/// numaradaki BAŞKA bir maçı açardı.
class _KickoffCard extends StatelessWidget {
  const _KickoffCard({required this.match});
  final Map match;

  @override
  Widget build(BuildContext context) {
    final d = match['date'] is String
        ? DateTime.tryParse(match['date'] as String)?.toLocal()
        : null;
    final day = d == null
        ? ''
        : '${_kisaGunler[d.weekday % 7]} ${d.day} ${_kisaAylar[d.month - 1]}';
    final oncekiHafta = match['oncekiHafta'] == true;

    return GestureDetector(
      onTap: () {
        // KAYNAK: HomeScreen.js:367 — geçmiş hafta maçı MAÇ detayına değil
        // BÜLTEN detayına gider (o hafta artık oynanmıştır; değerli olan tek
        // maç değil haftanın mühürlü kaydıdır).
        if (oncekiHafta) {
          _acBultenDetay(context, match['roundId']);
          return;
        }
        _acDetay(context, match['no']);
      },
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: 150,
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: AppRadius.mdR,
          border: Border.all(color: AppColors.border),
          boxShadow: AppShadow.soft,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (match['haftaAdi'] != null) _haftaRozeti(oncekiHafta),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Flexible(
                  child: Text(
                    day,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 10,
                      fontWeight: AppFont.bold,
                    ),
                  ),
                ),
                Text(
                  d != null ? _matchTime(match['date']) : '—',
                  style: TextStyle(
                    color: AppColors.text,
                    fontSize: 12,
                    fontWeight: AppFont.black,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            _takimSatiri(match, 'home'),
            const SizedBox(height: 4),
            _takimSatiri(match, 'away'),
            const SizedBox(height: 6),
            UlkeEtiketi(
              league: match['league'] as String?,
              yedekUlkeEn: macUlkesiEn(match),
            ),
          ],
        ),
      ),
    );
  }

  /// Hafta rozeti. ÖNCEKİ hafta uyarı tonunda, GÜNCEL hafta tema tonunda —
  /// aynı listede duran iki haftayı okumadan da ayırt ettirir. Yazı rengi iki
  /// durumda da zeminden hesaplanır, böylece takım teması ve açık/koyu
  /// görünüm değiştiğinde kontrast korunur.
  ///
  /// ZEMİN KARTTAN AYRIŞTIRILIR: ham `*Soft` değerleri her temada kartın
  /// üstünde seçilmiyordu (koyu görünümde "2. Hafta" rozeti karta gömülüyordu).
  /// [ayrisanYuzey] hue'yu koruyup parlaklığı gerektiği kadar kaydırır.
  Widget _haftaRozeti(bool oncekiHafta) {
    // AYRIM RENGE DEĞİL BİÇİME DAYANIR (16 Ağustos 2026 düzeltmesi).
    //
    // Önce iki hafta iki yumuşak yüzeyle ayrılıyordu (`warningSoft` /
    // `primarySoft`). Takım temasında bu ikisi ÇAKIŞABİLİYOR: Galatasaray'da
    // ölçüldü — warningSoft #56411C (hue 38) ile primarySoft #573E01
    // (hue 43) neredeyse aynı renk, yani iki hafta rozeti birbirinden ayırt
    // edilemiyordu. Üstelik `_anlamsalYuzey` doygunluğu %92→%51, parlaklığı
    // %50→%22 çektiği için amber kahverengiye düşüyor ve "çamurlu" duruyordu
    // (kullanıcı bildirimi).
    //
    // Yeni ayrım paletten BAĞIMSIZ: güncel hafta DOLGULU, geçen hafta
    // ÇERÇEVELİ. Hangi takım seçilirse seçilsin ikisi ayırt edilir; dolgu
    // kalkınca çamurlu blok da ortadan kalkar. Renk yine bilgi taşır ama tek
    // taşıyıcı değildir (renk körlüğü için de daha iyi).
    // RENKLER YER DEĞİŞTİRDİ + GÜNCEL HAFTA MARKA MAVİSİ
    // (kullanıcı kararı, 16 Ağustos 2026):
    //   • GEÇEN hafta, önceden güncel haftada olan DOLGULU vurgu rengini alır.
    //   • GÜNCEL hafta, uygulamanın ANA rengiyle (marka koyu mavisi) dolar.
    //
    // Marka mavisi SABİT bir kimliktir (#0B1B3A) ama körü körüne basılamaz:
    // kart da koyu olabilir ve rozet kartın içinde erir. `ayrisanYuzey` hue'yu
    // KORUYARAK yalnız kart'tan ayrışacak kadar ton iter — mavi yine mavi, ama
    // rozet hep görünür. Yazı da o son yüzeyden türetilir (bugün altı kez
    // yaşanan "yazı başka yüzeyin renginden geliyor" hatasına düşmemek için).
    //
    // TAKIM TEMASINDA RENK TAKIMDAN GELİR (kullanıcı isteği, 17 Ağustos 2026).
    //
    // 16 Ağustos'ta marka lacivertinin takım temasında da KORUNMASI kararı
    // alınmıştı (hue kaymasını sınırlayan test dâhil). Kullanıcı bunu tersine
    // çevirdi: "açık/koyu modda güzel oldu ama takım teması modunda takım
    // temasına uyum sağlaması lazım." Doğru gerekçe: o modda uygulamanın zemini,
    // kartı, metni, butonu — HEPSİ takımın iki rengine dönüyor; ortada duran tek
    // lacivert blok tema dışına düşüyor.
    //
    // AÇIK/KOYU GÖRÜNÜM DEĞİŞMEDİ: aşağıdaki iki dal aynen korundu. Yalnız
    // takım paleti UYGULANMIŞSA (tercih değil, uygulama — bkz.
    // AppColors.takimTemasiEtkin) rozet takımın vurgu ailesine geçer.
    //
    // İKİ HAFTA AYRIMI TAKIM TEMASINDA BİÇİMLEDİR (kullanıcı kararı,
    // 17 Ağustos 2026): güncel hafta DOLGULU vurgu, geçen hafta ÇERÇEVELİ.
    //
    // NEDEN RENKLE DEĞİL: takım temasında `accent` ile `primary` AYNI değere
    // (`p.vurgu`) yazılır — iki dolgu renkle ayrılamaz, üçüncü bir yüzey
    // gerekir. Üç aday 150 palette ölçüldü:
    //   primarySoft dolgu       → ayrım 2.59, yazı 150/150 AA, ama Galatasaray'da
    //                             koyu hardal (#4D3701) veriyor — kullanıcının
    //                             daha önce reddettiği "çamurlu ton" ailesi,
    //   onBackgroundAccent      → ayrım Levante UD'de 1.54'e düşüyor, yetersiz,
    //   ÇERÇEVE (seçilen)       → ayrım BİÇİMDEN gelir, paletten bağımsızdır.
    //
    // ÇERÇEVELİ ROZETİN YAZISI `primary` DEĞİL: yazı artık kartın üstünde
    // duruyor ve `primary`yi yazı yapmak ölçüldüğünde 150 takımın 63'ünde AA
    // altında kalıyor (en kötü Alanyaspor 3.00) — 9 punto bir etiket için
    // yetersiz. KİMLİK ÇERÇEVEDEN, OKUNURLUK KARTIN KENDİ METİN RENGİNDEN.
    //
    // `okunurAyrisanYuzey` — `ayrisanYuzey` DEĞİL: yüzeyi karttan ayrışacak
    // kadar itmek yazının kontrastını düşürebiliyor (Arsenal FC'de 4.49'da
    // kalmıştı). O fonksiyon iki kısıtı birden çözer.
    final cerceveli = AppColors.takimTemasiEtkin && oncekiHafta;

    final Color? dolgu;
    final Color yazi;
    if (cerceveli) {
      dolgu = null;
      yazi = AppColors.text;
    } else if (AppColors.takimTemasiEtkin) {
      dolgu = okunurAyrisanYuzey(AppColors.primary, AppColors.card);
      yazi = okunurMetin(dolgu);
    } else if (oncekiHafta) {
      dolgu = AppColors.accent;
      yazi = AppColors.onAccent;
    } else {
      dolgu = ayrisanYuzey(kMarkaMavisi, AppColors.card);
      yazi = okunurMetin(dolgu);
    }
    final stil = TextStyle(
      color: yazi,
      fontSize: 9,
      fontWeight: AppFont.black,
    );
    return Container(
      // ANAHTAR TESTİN ROZETİ TAM OLARAK BULMASI İÇİN: ekranda "N. Hafta"
      // metni birden fazla yerde geçiyor, metinle arama yanlış kutuyu okuyabilir
      // (`radar5-satir-*` ile aynı gerekçe).
      key: ValueKey('hafta-rozeti-${match['no']}'),
      margin: const EdgeInsets.only(bottom: 5),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        // Takım temasında geçen hafta DOLGUSUZ — ayrım biçimden gelir.
        color: dolgu,
        borderRadius: AppRadius.smR,
        border: cerceveli ? Border.all(color: AppColors.primary) : null,
      ),
      child: Text(
        '${match['haftaAdi']}',
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: stil,
      ),
    );
  }

  Widget _takimSatiri(Map m, String taraf) => Row(
    children: [
      Logo(
        uri: crestOf(m.cast<String, dynamic>(), taraf),
        name: (m[taraf] as Map?)?['name'] as String?,
        size: 22,
      ),
      const SizedBox(width: 6),
      Expanded(
        child: Text(
          _shortTeam((m[taraf] as Map?)?['name']),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: AppColors.text,
            fontSize: 11.5,
            fontWeight: AppFont.bold,
          ),
        ),
      ),
    ],
  );
}

/// Ana Sayfa dalından maç detayına gider (rota her dala ayrı kayıtlı).
void _acDetay(BuildContext context, Object? no) {
  if (no == null) return;
  GoRouter.of(context).go('/ana-sayfa/mac/$no');
}

/// Geçmiş hafta maçından o haftanın MÜHÜRLÜ bülten detayına gider.
///
/// KİMLİK: `yaklasan_maclar.dart` her kayda kaynak haftanın `roundId`'sini
/// koyar (satır 84). Arşiv ucu `/api/bulletins/:id` aynı değeri bekler —
/// sunucuda `rounds[].id` SAYI (1527), `bulletins[].id` METİN ('1527'); tek
/// fark tiptir ve yol parametresine yazılırken erir. Kaynak da aynı eşlemeyi
/// yapıyor (`HomeScreen.js:367` → `bulletinId: match.roundId`).
void _acBultenDetay(BuildContext context, Object? roundId) {
  // Kimlik yoksa sessizce hiçbir şey yapmak, dokunmanın kaybolması demektir.
  // Kullanıcı nedenini görsün.
  if (roundId == null || '$roundId'.isEmpty) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Bu maçın hafta kimliği gelmedi — detay açılamıyor.'),
        duration: Duration(seconds: 2),
      ),
    );
    return;
  }
  GoRouter.of(context).go('/ana-sayfa/bulten-detay/$roundId');
}
