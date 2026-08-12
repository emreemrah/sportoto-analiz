// KAYNAK: app/src/screens/NotificationsScreen.js — BİREBİR çeviri.
//
// BİLDİRİM MERKEZİ EKRANI — kaçırdığın gerçek olaylar tek listede.
//
// Bu ekran hiçbir zaman örnek/sahte bildirim göstermez. Veri yoksa bunu
// açıkça söyler. Her satır dokunulabilir ve GERÇEK hedefe gider.

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/notifications.dart';
import '../../core/push_dev_test.dart';
import '../../core/push_planner.dart';
import '../../core/push_sync.dart';
import '../../core/services/notifications_service.dart';
import '../../core/services/push_service.dart';
import '../../core/theme/tokens.dart';
import '../../widgets/app_ui.dart';

// YAYIN KAPISI — İKİ KATMANLI:
//  1) `kDebugMode` DOĞRUDAN okunur. Dart derleyicisi yayın derlemesinde bu
//     sabiti `false` yapar ve ağaç sarsma `false && …` dalını paketten TAMAMEN
//     atar. Böylece seçenek yalnız "çizilmiyor" olmaz — müşterinin paketinde
//     metni bile BULUNMAZ.
//  2) `gelistirmeKipi()` aynı kararı ortak yerden verir; ikisi ayrışırsa test
//     kırılır.
final bool _gelistirme = kDebugMode && gelistirmeKipi();

/// Geliştirme testinin sonucunu DÜRÜSTÇE anlatır — "kuruldu" demeden önce
/// cihazdan okunmuştur.
String macTestMesaji(TestMacSonuc? r, int dk) {
  if (r != null && r.ok && r.mac != null) {
    final m = r.mac!;
    return '${m.no}. ${m.ev} – ${m.dep} maçı için hatırlatma $dk dakika sonrasına kuruldu. '
        'Bildirim gelince dokun: bu maçın detay ekranı açılmalı.';
  }
  return switch (r?.neden) {
    'bulten-yok' =>
      'Güncel bülten okunamadı; test için gerçek maç bulunamadı. Uydurma maç oluşturulmaz.',
    'mac-yok' =>
      'Güncel bültende başlamamış maç kalmadı; test için uydurma maç oluşturulmaz.',
    'izin' => 'Bildirim izni olmadığı için test hatırlatması kurulamadı.',
    'zamanlanamadi' =>
      'İşletim sistemi zamanlamayı kabul etmedi; test hatırlatması kurulamadı.',
    'destek-yok' => 'Bu ortamda telefon bildirimi kurulamıyor.',
    _ => 'Test hatırlatması kurulamadı.',
  };
}

String zamanMetni(int ms) {
  final fark = DateTime.now().millisecondsSinceEpoch - ms;
  final d = DateTime.fromMillisecondsSinceEpoch(ms).toLocal();
  String p(int n) => n.toString().padLeft(2, '0');
  if (fark < 0) {
    final dk = (-fark / 60000).round();
    return dk <= 90
        ? '$dk dk sonra'
        : '${p(d.day)}.${p(d.month)} ${p(d.hour)}:${p(d.minute)}';
  }
  final dk = (fark / 60000).round();
  if (dk < 1) return 'az önce';
  if (dk < 60) return '$dk dk önce';
  final sa = (dk / 60).round();
  if (sa < 24) return '$sa saat önce';
  return '${p(d.day)}.${p(d.month)}';
}

// GETTER, `final` DEĞİL: `primarySoft`/`primary` takım temasıyla değişir.
Map<String, ({Color bg, Color br})> get _ton => {
  'match-starting': (bg: AppColors.warningSoft, br: AppColors.warning),
  'result-official': (bg: AppColors.successSoft, br: AppColors.success),
  'new-round': (bg: AppColors.infoSoft, br: AppColors.info),
  'achievement': (bg: AppColors.primarySoft, br: AppColors.primary),
  'points': (bg: AppColors.primarySoft, br: AppColors.primary),
};

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen>
    with WidgetsBindingObserver {
  List<NotifItem> _items = const [];
  bool _firstRun = false;
  bool _loading = true;

  // Telefon hatırlatması durumu — hiçbiri varsayılmaz, hepsi cihazdan okunur.
  // `mesaj` ortam açıklamasıdır, `bilgi` son işlemin dürüst sonucudur
  // (kuruldu/kurulamadı). İkisi de uydurulmaz.
  PushDurumOzet? _push;
  String _pushMesaj = '';
  String _pushBilgi = '';
  bool _pushMesgul = false;
  bool _ayarOner = false;

  bool _testMesgul = false;
  String _testBilgi = '';
  bool _macTestMesgul = false;
  String _macTestBilgi = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _yukle();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  // İzin telefon ayarlarından değiştirilmiş olabilir: uygulama öne geldiğinde
  // durum CİHAZDAN yeniden okunur (varsayım yok).
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _pushDurumOku();
  }

  Future<void> _pushDurumOku() async {
    final d = await pushDurumu();
    if (!mounted) return;
    setState(() {
      _push = d;
      _pushMesaj = ortamMesaji();
      // İzin ayarlardan geri alındıysa kullanıcıya dürüstçe söylenir.
      if (d.tercihDuzeltildi) {
        _pushBilgi =
            'Telefon ayarlarından bildirim izni kaldırılmış; hatırlatmalar kapatıldı.';
      }
      _ayarOner = _ayarOner || d.izin == 'blocked' || d.tercihDuzeltildi;
      _pushMesgul = false;
    });
  }

  Future<void> _pushDegistir(bool istenen) async {
    setState(() {
      _pushMesgul = true;
      _pushBilgi = '';
    });
    ({bool enabled, String izin, SenkronSonuc? senkron, int iptal})? sonuc;
    try {
      final girdi = istenen ? await loadPushInputs() : null;
      sonuc = await setPushEnabled(
        istenen,
        bulletin: girdi?.bulletin,
        coupons: girdi?.coupons,
      );
    } catch (_) {
      // durum aşağıda yeniden okunur
    }
    await _pushDurumOku();
    if (!mounted) return;

    // Sonuç DÜRÜSTÇE raporlanır: izin verilmediyse "açıldı" denmez.
    var bilgi = '';
    var ayarOner = false;
    if (istenen && sonuc != null && !sonuc.enabled) {
      ayarOner = true;
      bilgi = switch (sonuc.izin) {
        'blocked' =>
          'Bildirim izni kapalı olduğu için hatırlatma kurulamadı. Telefon ayarlarından izin vermen gerekiyor.',
        'hata' => 'Bildirim izni sorulamadı; hatırlatma açılmadı.',
        _ => 'Bildirim izni verilmediği için hatırlatma açılmadı.',
      };
    } else if (istenen && sonuc != null && sonuc.enabled) {
      final s = sonuc.senkron;
      if (s == null || s.plan == 0) {
        bilgi =
            'Hatırlatma açıldı. Kuponunda başlama saati bilinen maç olduğunda hatırlatma kurulur.';
      } else if (s.durum == 'ok') {
        bilgi =
            'Hatırlatma açıldı ve ${s.dogrulanan} maç için kurulumu cihazda doğrulandı.';
      } else {
        bilgi =
            'Hatırlatma açıldı ancak ${s.plan} maçın ${s.dogrulanan} tanesi cihazda doğrulanabildi; kalanı işletim sistemi kabul etmedi.';
      }
    }
    if (bilgi.isNotEmpty || ayarOner) {
      setState(() {
        if (bilgi.isNotEmpty) _pushBilgi = bilgi;
        _ayarOner = _ayarOner || ayarOner;
      });
    }
    if (!istenen) {
      setState(() {
        _testMesgul = false;
        _testBilgi = '';
      });
    }
  }

  Future<void> _testGonder() async {
    if (_testMesgul) return;
    setState(() {
      _testMesgul = true;
      _testBilgi = '';
    });
    TestSonuc? r;
    try {
      r = await testBildirimiGonder();
    } catch (_) {
      r = null;
    }
    final dk = (kTestOnceSn / 60).round().clamp(1, 999);
    if (!mounted) return;
    setState(() {
      _testMesgul = false;
      _testBilgi = r != null && r.ok
          ? 'Test bildirimi kuruldu; $dk dakika sonra telefonunda görünecek. Görmezsen telefon ayarlarından bu uygulamanın bildirimlerini kontrol et.'
          : r?.neden == 'izin'
          ? 'Bildirim izni olmadığı için test kurulamadı.'
          : 'Test bildirimi kurulamadı: işletim sistemi zamanlamayı kabul etmedi.';
    });
    _pushDurumOku();
  }

  /// GELİŞTİRME TESTİ: güncel bültendeki gerçek bir maç için, üretimdeki maç
  /// hatırlatmasının aynısını 1 dakika sonrasına kurar. Kupon verisi
  /// kullanılmaz, üretimin 60 dakikalık düzenine dokunulmaz.
  Future<void> _macTestiKur() async {
    if (_macTestMesgul) return;
    setState(() {
      _macTestMesgul = true;
      _macTestBilgi = '';
    });
    TestMacSonuc? r;
    try {
      final girdi = await loadPushInputs();
      r = await macTestiGonder(bulletin: girdi.bulletin);
    } catch (_) {
      r = null;
    }
    final dk = (kTestMacOnceSn / 60).round().clamp(1, 999);
    if (!mounted) return;
    setState(() {
      _macTestMesgul = false;
      _macTestBilgi = macTestMesaji(r, dk);
    });
    _pushDurumOku();
  }

  Future<void> _ayarlaraGit() async {
    var oldu = false;
    try {
      oldu = await launchUrl(
        Uri.parse('app-settings:'),
        mode: LaunchMode.externalApplication,
      );
    } catch (_) {
      oldu = false;
    }
    if (!oldu && mounted) {
      setState(
        () => _pushBilgi =
            'Ayarlar ekranı açılamadı. Telefon ayarları → Uygulamalar → bu uygulama → Bildirimler yolunu izleyebilirsin.',
      );
    }
  }

  Future<void> _yukle() async {
    final r = await loadNotifications();
    if (!mounted) return;
    setState(() {
      _items = r.items;
      _firstRun = r.firstRun;
      _loading = false;
    });
    // Ekran açıldığı an okunmuş sayılır; aynı bildirim bir daha çıkmaz.
    if (!r.firstRun) {
      await markSeen(items: r.items, ctx: r.ctx);
    }

    // Kupon değişmiş olabilir → açıksa zamanlama güncellenir. Sessiz "tamam"
    // yok: işletim sistemi kabul etmediyse bu ekranda yazılır.
    try {
      final prefs = await getPushPrefs();
      if (isDesteklenir() && prefs.enabled) {
        final girdi = await loadPushInputs();
        final s = await syncMatchReminders(
          bulletin: girdi.bulletin,
          coupons: girdi.coupons,
        );
        if (s.durum == 'eksik' && mounted) {
          setState(
            () => _pushBilgi =
                'Planlanan ${s.plan} hatırlatmanın ${s.dogrulanan} tanesi cihazda doğrulanabildi; kalanı işletim sistemi kabul etmedi.',
          );
        }
      }
    } catch (_) {
      // hatırlatma kurulamazsa liste yine de gösterilir
    }
    _pushDurumOku();
  }

  void _git(NotifTarget t) {
    // Hedefi `kind`/`screen` belirler; serbest metin gezinmeyi SÜRÜKLEYEMEZ.
    final yol = switch (t.screen) {
      'Bulletin' => '/bulten',
      'LiveMatchDetail' => '/bulten/mac/${t.params?['no']}',
      'WeekRecap' =>
        '/ana-sayfa/hafta-kapanisi?roundId=${t.params?['roundId']}',
      _ => null,
    };
    if (yol != null) context.go(yol);
  }

  @override
  Widget build(BuildContext context) {
    final p = _push;
    final destek = p?.destek == true;

    return Scaffold(
      appBar: AppBar(title: const Text('Bildirimler')),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: _yukle,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            Spacing.md,
            Spacing.md,
            Spacing.md,
            Spacing.xl * 2,
          ),
          children: [
            _hero(),
            _pushKarti(p, destek),
            if (_loading)
              Padding(
                padding: EdgeInsets.symmetric(vertical: Spacing.lg),
                child: Text(
                  'Yükleniyor…',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.textSoft, fontSize: 13),
                ),
              )
            else if (_items.isEmpty)
              EmptyState(
                icon: '🔕',
                title: _firstRun ? 'Bildirimler açıldı' : 'Yeni bildirim yok',
                message: _firstRun
                    ? 'Bundan sonra olan biteni burada göreceksin. Geçmişe dönük bildirim üretilmez.'
                    : 'Yeni bir olay olduğunda burada görünecek. Uydurma bildirim gösterilmez.',
              )
            else
              for (final n in _items) _satir(n),
            Padding(
              padding: EdgeInsets.only(top: Spacing.md),
              child: Text(
                'Yukarıdaki liste uygulama açıldığında hesaplanır. Telefona düşen '
                'hatırlatma yalnız maç başlangıcı içindir ve cihazın kendi saatiyle '
                'çalışır — sunucudan bildirim gönderilmez. Resmî sonuç dışındaki hiçbir '
                'veri kesin sayılmaz.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppColors.muted,
                  fontSize: 11,
                  height: 16 / 11,
                ),
              ),
            ),
            // Destek hattı cümlesi kaldırıldı (kullanıcı kararı, 2 Ağustos 2026).
            Padding(
              padding: EdgeInsets.only(top: 6),
              child: Text(
                '18 yaş altı kullanamaz. Bu uygulama analiz ve karar desteği sunar.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.muted, fontSize: 10.5),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _hero() => Container(
    margin: const EdgeInsets.only(bottom: Spacing.md),
    padding: const EdgeInsets.all(Spacing.md),
    decoration: BoxDecoration(
      color: AppColors.darkCard,
      borderRadius: AppRadius.lgR,
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '🔔 Bildirimler',
          style: TextStyle(
            color: AppColors.onDark,
            fontSize: 18,
            fontWeight: AppFont.black,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Yalnız gerçekleşmiş olaylar listelenir: yeni bülten, kuponundaki maçın '
          'başlaması, resmî sonuçların açıklanması ve sunucunun doğruladığı puan.',
          style: TextStyle(
            color: AppColors.onDark.withValues(alpha: 0.82),
            fontSize: 12,
            height: 17 / 12,
          ),
        ),
      ],
    ),
  );

  Widget _pushKarti(PushDurumOzet? p, bool destek) {
    final acik = p?.acik == true;
    final kurulu = p?.kurulu ?? 0;

    return Container(
      margin: const EdgeInsets.only(bottom: Spacing.md),
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: AppRadius.mdR,
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '📱 Telefon hatırlatması',
                      style: TextStyle(
                        color: AppColors.text,
                        fontSize: 14,
                        fontWeight: AppFont.black,
                      ),
                    ),
                    Padding(
                      padding: EdgeInsets.only(top: 3),
                      child: Text(
                        'Kuponundaki maç başlamadan $kVarsayilanOnceDk dk önce telefonuna hatırlatma düşer. '
                        'Uygulama kapalıyken de çalışır.',
                        style: TextStyle(
                          color: AppColors.textSoft,
                          fontSize: 12,
                          height: 17 / 12,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              // Anahtar GERÇEK platformda görünür; izin durumu onu gizlemez —
              // izin yoksa açılmaz ve bu aşağıda dürüstçe yazılır.
              if (destek)
                Switch(
                  value: acik,
                  onChanged: _pushMesgul ? null : _pushDegistir,
                  activeTrackColor: AppColors.primary,
                  inactiveTrackColor: AppColors.border,
                ),
            ],
          ),
          if (!destek)
            // Metin duruma göre değişir: tarayıcı gerçekten tarayıcıysa
            // "tarayıcı", eklenti yüklenemediyse GERÇEK teknik durum yazılır.
            _not(_pushMesaj)
          else if (p?.izin == 'blocked')
            _not(
              'Bildirim izni telefon ayarlarından kapatılmış. Uygulama içinden tekrar '
              'sorulamıyor; izni ayarlardan açtıktan sonra bu ekrana dönmen yeterli.',
            )
          else if (acik)
            _not(
              kurulu > 0
                  ? 'Kurulu hatırlatma: $kurulu. Kuponunu değiştirdiğinde liste kendini günceller.'
                  : 'Şu an kurulu hatırlatma yok. Kuponuna maç ekledikçe hatırlatmalar kurulur; başlama saati bilinmeyen maç için hatırlatma kurulmaz.',
            )
          else
            _not(
              'Kapalı. Açtığında yalnız KENDİ kuponundaki maçlar için hatırlatma kurulur; '
              'tahmin, sonuç veya "kesin" iddiası içeren bildirim gönderilmez.',
            ),
          if (_pushBilgi.isNotEmpty) _bilgi(_pushBilgi),
          if (destek && !acik && _ayarOner)
            _altDugme('⚙️ Telefon bildirim ayarlarını aç', false, _ayarlaraGit),

          // TEST BİLDİRİMİ — gerçek kanal, gerçek zamanlama, 1 dakika sonrası.
          // İçinde tahmin, seçim, skor, puan veya hesap bilgisi YOKTUR.
          if (destek && acik) ...[
            Opacity(
              opacity: _testMesgul ? 0.6 : 1,
              child: GestureDetector(
                onTap: _testMesgul ? null : _testGonder,
                child: Container(
                  margin: const EdgeInsets.only(top: 10),
                  padding: const EdgeInsets.symmetric(vertical: 11),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: AppRadius.mdR,
                  ),
                  child: Text(
                    _testMesgul ? 'Kuruluyor…' : '🔔 Test bildirimi gönder',
                    style: TextStyle(
                      color: AppColors.onPrimary,
                      fontSize: 13,
                      fontWeight: AppFont.black,
                    ),
                  ),
                ),
              ),
            ),
            _not(
              'Telefonunun bu uygulamaya bildirim izni verdiğini kendi gözünle '
              'doğrulaman için 1 dakika sonrasına tek bir deneme bildirimi kurulur. '
              'İçinde maç, tahmin, skor veya hesap bilgisi bulunmaz.',
            ),
            if (_testBilgi.isNotEmpty) _bilgi(_testBilgi),
          ],

          // GELİŞTİRME TESTİ — yayın sürümünde HİÇ çizilmez.
          if (_gelistirme && destek && acik)
            Container(
              margin: const EdgeInsets.only(top: Spacing.md),
              padding: const EdgeInsets.only(top: Spacing.sm),
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: AppColors.border)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '🧪 GELİŞTİRME — yayın sürümünde görünmez',
                    style: TextStyle(
                      color: AppColors.muted,
                      fontSize: 10.5,
                      fontWeight: AppFont.black,
                      letterSpacing: 0.4,
                    ),
                  ),
                  _altDugme(
                    _macTestMesgul
                        ? 'Kuruluyor…'
                        : '⚽ Maç hatırlatmasını test et',
                    _macTestMesgul,
                    _macTestiKur,
                  ),
                  _not(
                    'Güncel bültendeki başlamamış gerçek bir maç için, üretimde kullanılan '
                    'maç hatırlatmasının aynısı 1 dakika sonrasına kurulur. Bildirime '
                    'dokunduğunda o maçın detay ekranı açılmalı. Uygun maç yoksa uydurma '
                    'maç oluşturulmaz. Kuponundaki gerçek hatırlatmalar bundan etkilenmez; '
                    'onlar maçtan $kVarsayilanOnceDk dk önce kurulmaya devam eder.',
                  ),
                  if (_macTestBilgi.isNotEmpty) _bilgi(_macTestBilgi),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _not(String metin) => Padding(
    padding: const EdgeInsets.only(top: 8),
    child: Text(
      metin,
      style: TextStyle(
        color: AppColors.muted,
        fontSize: 11.5,
        height: 16 / 11.5,
      ),
    ),
  );

  Widget _bilgi(String metin) => Container(
    margin: const EdgeInsets.only(top: 8),
    padding: const EdgeInsets.symmetric(vertical: 7, horizontal: 9),
    decoration: BoxDecoration(
      color: AppColors.primarySoft,
      borderRadius: AppRadius.smR,
    ),
    child: Text(
      metin,
      style: TextStyle(
        color: AppColors.text,
        fontSize: 11.5,
        height: 16 / 11.5,
        fontWeight: AppFont.bold,
      ),
    ),
  );

  Widget _altDugme(String metin, bool mesgul, VoidCallback onTap) => Opacity(
    opacity: mesgul ? 0.6 : 1,
    child: GestureDetector(
      onTap: mesgul ? null : onTap,
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.only(top: 10),
        padding: const EdgeInsets.symmetric(vertical: 10),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: AppColors.surfaceSoft,
          borderRadius: AppRadius.mdR,
          border: Border.all(color: AppColors.border),
        ),
        child: Text(
          metin,
          style: TextStyle(
            color: AppColors.text,
            fontSize: 12.5,
            fontWeight: AppFont.black,
          ),
        ),
      ),
    ),
  );

  Widget _satir(NotifItem n) {
    final ton =
        _ton[n.kind] ?? (bg: AppColors.surfaceSoft, br: AppColors.border);
    return GestureDetector(
      onTap: () => _git(n.target),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(Spacing.md),
        decoration: BoxDecoration(
          color: ton.bg,
          borderRadius: AppRadius.mdR,
          border: Border(left: BorderSide(color: ton.br, width: 4)),
        ),
        child: Row(
          children: [
            Text(n.icon, style: const TextStyle(fontSize: 20)),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    n.title,
                    style: TextStyle(
                      color: AppColors.text,
                      fontSize: 14,
                      fontWeight: AppFont.black,
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      n.body,
                      style: TextStyle(
                        color: AppColors.textSoft,
                        fontSize: 12.5,
                        height: 17 / 12.5,
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      zamanMetni(n.at),
                      style: TextStyle(
                        color: AppColors.muted,
                        fontSize: 11,
                        fontWeight: AppFont.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Text(
              '›',
              style: TextStyle(
                color: AppColors.muted,
                fontSize: 20,
                fontWeight: AppFont.black,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
