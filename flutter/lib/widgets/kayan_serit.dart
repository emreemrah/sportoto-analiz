// KAYNAK: app/src/components/KayanSerit.js — çeviri.
//
// KAYAN ŞERİT — soldan sağa DURMADAN dönen yatay satır (ortak mekanizma).
// Hem lig şeridi hem yaklaşan maç şeridi bunu kullanır.
//
// KAYNAKTAN AYNEN KORUNAN İKİ KARAR:
//
// 1) İKİ KOPYA: dikişsiz döngü için içerik iki kez çizilir. Birinci kopya tam
//    genişliği kadar sola kayınca ikinci kopya onun yerini almış olur; başa
//    dönüşte görüntüde sıçrama olmaz. Tek kopyayla her turda "zıplama" olur.
//
// 2) HAREKET AZALTMA (WCAG 2.2.2): durdurulamayan otomatik hareket, vestibüler
//    rahatsızlığı olan kullanıcılar için gerçek bir sorundur. Cihazda "hareketi
//    azalt" açıksa şerit KAYMAZ; parmakla kaydırılan normal bir satır olur.
//    Bilgi kaybı yoktur — aynı içerik, aynı sırada.
//
// KAYNAKTAN TAŞINMAYAN İKİ ŞEY VE NEDENİ:
//
// 3) "JS SÜRÜCÜSÜ" tercihi (useNativeDriver: false) — React Native'e özgü bir
//    takastı. Yerel sürücü animasyonu görünüm ağacından koptuğunda SESSİZCE
//    ölüyor ve JS tarafına haber gelmiyordu. Flutter'da böyle bir kopukluk yok:
//    AnimationController çerçevenin ticker'ına bağlıdır ve widget ağaçtan
//    düştüğünde `dispose` ile birlikte düzgünce durur.
//
// 4) BEKÇİ (değer kıpırdamıyorsa döngüyü yeniden kur) — (3)'ün sonucuydu.
//    Sebep ortadan kalktığı için bekçi de gereksiz. `TickerProviderStateMixin`
//    rota görünmezken ticker'ı zaten susturur, geri gelince devam ettirir.
//
// Kaynağın "dokunmayla durdurma EKLENMEMELİ" uyarısına uyuldu: şerit
// dokunmayla durmaz.

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/scheduler.dart';

/// Varsayılan kayma hızı (piksel/saniye). Okunabilirlik sınırı: bundan
/// hızlısında içerik gözle takip edilemiyor, yavaşında şerit donmuş gibi
/// duruyor.
const double kVarsayilanHiz = 34;

class KayanSerit extends StatefulWidget {
  const KayanSerit({
    super.key,
    required this.children,
    this.hiz = kVarsayilanHiz,
    this.padding,
    this.semanticsLabel,
  });

  final List<Widget> children;
  final double hiz;
  final EdgeInsetsGeometry? padding;
  final String? semanticsLabel;

  @override
  State<KayanSerit> createState() => _KayanSeritState();
}

class _KayanSeritState extends State<KayanSerit>
    with SingleTickerProviderStateMixin {
  late final ScrollController _ctl = ScrollController();
  late final Ticker _ticker;
  double _offset = 0;
  double _kopyaGenislik = 0;

  @override
  void initState() {
    super.initState();
    _ticker = createTicker(_tik)..start();
  }

  Duration? _oncekiAn;

  void _tik(Duration an) {
    final onceki = _oncekiAn;
    _oncekiAn = an;
    if (onceki == null || _kopyaGenislik <= 0) return;
    if (!_ctl.hasClients) return;

    final dt = (an - onceki).inMicroseconds / 1e6;
    _offset += widget.hiz * dt;
    // Bir kopya genişliği kadar kayınca başa dön — ikinci kopya yerini almış
    // olduğu için sıçrama görünmez.
    if (_offset >= _kopyaGenislik) _offset -= _kopyaGenislik;
    _ctl.jumpTo(_offset);
  }

  @override
  void dispose() {
    _ticker.dispose();
    _ctl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // HAREKET AZALTMA: cihazda açıksa animasyon durur ve şerit elle
    // kaydırılabilir normal bir satıra döner.
    final azalt = MediaQuery.disableAnimationsOf(context);
    if (azalt && _ticker.isActive) {
      _ticker.stop();
    } else if (!azalt && !_ticker.isActive) {
      _oncekiAn = null;
      _ticker.start();
    }

    final icerik = Row(
      mainAxisSize: MainAxisSize.min,
      children: widget.children,
    );

    return Semantics(
      label: widget.semanticsLabel,
      container: true,
      child: SingleChildScrollView(
        controller: _ctl,
        scrollDirection: Axis.horizontal,
        physics: azalt
            ? const BouncingScrollPhysics()
            : const NeverScrollableScrollPhysics(),
        padding: widget.padding,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _Olculen(
              onGenislik: (w) {
                if (w != _kopyaGenislik) _kopyaGenislik = w;
              },
              child: icerik,
            ),
            // İKİNCİ KOPYA — dikişsiz döngü için (hareket azaltmada gereksiz).
            if (!azalt)
              Row(mainAxisSize: MainAxisSize.min, children: widget.children),
          ],
        ),
      ),
    );
  }
}

/// Çocuğun çizim genişliğini ölçüp geri bildirir.
class _Olculen extends StatelessWidget {
  const _Olculen({required this.child, required this.onGenislik});

  final Widget child;
  final ValueChanged<double> onGenislik;

  @override
  Widget build(BuildContext context) =>
      _OlcumProxy(onGenislik: onGenislik, child: child);
}

class _OlcumProxy extends SingleChildRenderObjectWidget {
  const _OlcumProxy({required super.child, required this.onGenislik});

  final ValueChanged<double> onGenislik;

  @override
  RenderObject createRenderObject(BuildContext context) =>
      _OlcumRender(onGenislik);

  @override
  void updateRenderObject(BuildContext context, _OlcumRender renderObject) {
    renderObject.onGenislik = onGenislik;
  }
}

class _OlcumRender extends RenderProxyBox {
  _OlcumRender(this.onGenislik);
  ValueChanged<double> onGenislik;

  @override
  void performLayout() {
    super.performLayout();
    onGenislik(size.width);
  }
}
