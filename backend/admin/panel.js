// YÖNETİM PANELİ BETİĞİ — AYRI DOSYA, bilerek.
// ---------------------------------------------------------------------------
// NEDEN AYRI: sunucunun güvenlik başlıklarında CSP `script-src 'self'` var
// (src/security/headers.js). Satır içi <script> bu kuralla ENGELLENİR; panel
// açılır ama betik hiç çalışmadığı için ekran BOŞ kalır — ilk sürümde tam
// olarak bu oldu. Doğru çözüm CSP'yi gevşetmek değil, betiği dosyaya almaktı.
//
// TASARIM
//  • Sekmeli: her sekme kendi verisini İLK açılışta çeker (tembel yükleme).
//  • Filtreler istemcide değil, mümkün olduğunca SUNUCUDA (arama uçlara gider).
//  • Yıkıcı işlemler (yorum silme, engelleme) ONAY ister.
//  • Sayı okunamazsa "bilinmiyor" yazar — 0 yazmak yalan olurdu.
(function () {
  'use strict';

  var ANAHTAR = 'yonetim_token';
  // OTURUM KİMLİĞİ (X-Session-Id) — ZORUNLU. Sunucu her istekte oturum
  // satırını doğruluyor (mw.js/checkSession); başlık gelmezse 401 döner.
  var OTURUM = 'yonetim_oturum';
  var token = sessionStorage.getItem(ANAHTAR) || '';
  var oturumId = sessionStorage.getItem(OTURUM) || '';
  var $ = function (id) { return document.getElementById(id); };
  var yok = '<span class="kucuk">bilinmiyor</span>';
  var yuklendi = {};          // sekme → veri çekildi mi
  var sonKarne = null;        // /api/scorecards/system yanıtı (haftalar için)
  var sonKriter = null;       // /api/scorecards/criteria yanıtı

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function tarih(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    return isNaN(d.getTime()) ? null : d.toLocaleString('tr-TR');
  }
  function kutu(etiket, deger, alt) {
    return '<div class="kutu"><div class="etiket">' + esc(etiket) + '</div>' +
      '<div class="deger">' + (deger == null ? yok : deger) + '</div>' +
      (alt ? '<div class="kucuk">' + esc(alt) + '</div>' : '') + '</div>';
  }
  function bilgi(hedef, mesaj, tur) {
    $(hedef).innerHTML = '<div class="' + (tur || 'basari') + '">' + esc(mesaj) + '</div>';
  }

  function istek(yol, secenek) {
    secenek = secenek || {};
    var bas = { 'Content-Type': 'application/json' };
    if (token) bas.Authorization = 'Bearer ' + token;
    if (oturumId) bas['X-Session-Id'] = oturumId;
    return fetch(yol, {
      method: secenek.method || 'GET',
      headers: bas,
      body: secenek.body ? JSON.stringify(secenek.body) : undefined,
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (g) {
        if (!r.ok) { var e = new Error(g.error || ('Sunucu ' + r.status)); e.durum = r.status; throw e; }
        return g;
      });
    });
  }

  function girisGoster(mesaj) {
    $('panel').hidden = true;
    $('girisEkran').hidden = false;
    if (mesaj) { $('girisHata').textContent = mesaj; $('girisHata').hidden = false; }
  }

  function hataGoster(e) {
    if (e && (e.durum === 401 || e.durum === 403)) {
      sessionStorage.removeItem(ANAHTAR); sessionStorage.removeItem(OTURUM);
      token = ''; oturumId = '';
      girisGoster(e.durum === 403 ? 'Bu hesap yönetim yetkisine sahip değil.' : 'Oturum düştü, tekrar gir.');
      return;
    }
    $('ustHata').textContent = (e && e.message) || 'Bilinmeyen hata.';
    $('ustHata').hidden = false;
  }

  // ——— GİRİŞ ———
  $('girisBtn').addEventListener('click', function () {
    var e = $('eposta').value.trim(), s = $('sifre').value;
    if (!e || !s) return;
    $('girisBtn').disabled = true; $('girisHata').hidden = true;
    istek('/api/auth/login', { method: 'POST', body: { email: e, password: s, platform: 'web', deviceName: 'Yönetim Paneli' } })
      .then(function (r) {
        token = r.token || '';
        if (!token) throw new Error('Sunucu belirteç döndürmedi.');
        oturumId = r.sessionId || '';
        sessionStorage.setItem(ANAHTAR, token);
        if (oturumId) sessionStorage.setItem(OTURUM, oturumId);
        if (r.user && r.user.username) sessionStorage.setItem('yonetim_kim', r.user.username);
        $('sifre').value = '';
        baslat();
      })
      .catch(function (err) { $('girisHata').textContent = err.message; $('girisHata').hidden = false; })
      .finally(function () { $('girisBtn').disabled = false; });
  });
  $('sifre').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') $('girisBtn').click(); });

  $('cikisBtn').addEventListener('click', function () {
    sessionStorage.removeItem(ANAHTAR); sessionStorage.removeItem(OTURUM);
    token = ''; oturumId = '';
    girisGoster('');
  });

  // ——— SEKME YÖNETİMİ ———
  var yukleyiciler = {
    genel: function () { return ozetYukle(); },
    analiz: function () { return karneYukle().then(kriterCiz); },
    haftalar: function () { return haftaYukle(); },
    oruntu: function () { return Promise.resolve(); },
    sinyal: function () { return sinyalKataloguYukle(); },
    kullanicilar: function () { return kullaniciYukle(); },
    yorumlar: function () { return yorumYukle(); },
    premium: function () { return kodYukle(); },
    bildirimler: function () { return modYukle(); },
    kayitlar: function () { return kayitYukle(); },
  };

  function sekmeAc(ad) {
    var dugmeler = $('sekmeler').querySelectorAll('button');
    for (var i = 0; i < dugmeler.length; i += 1) {
      dugmeler[i].classList.toggle('acik', dugmeler[i].getAttribute('data-sekme') === ad);
    }
    var paneller = document.querySelectorAll('[data-panel]');
    for (var j = 0; j < paneller.length; j += 1) {
      paneller[j].hidden = paneller[j].getAttribute('data-panel') !== ad;
    }
    if (!yuklendi[ad]) {
      yuklendi[ad] = true;
      (yukleyiciler[ad] || function () { return Promise.resolve(); })().catch(hataGoster);
    }
  }
  $('sekmeler').addEventListener('click', function (ev) {
    var d = ev.target.closest('button[data-sekme]');
    if (d) sekmeAc(d.getAttribute('data-sekme'));
  });

  // ——— GENEL ———
  function ozetYukle() {
    return istek('/api/admin/ozet').then(function (o) {
      $('ustHata').hidden = true;
      $('zamanBilgi').textContent = tarih(o.zaman) ? '· ' + tarih(o.zaman) : '';
      var sema = o.sistem.semaOk === true ? '<span class="rozet ok">tamam</span>'
        : o.sistem.semaOk === false ? '<span class="rozet kotu">' + esc(o.sistem.semaDurum || 'hata') + '</span>'
          : '<span class="rozet notr">' + esc(o.sistem.semaDurum || 'bilinmiyor') + '</span>';
      $('durumIzgara').innerHTML =
        kutu('Veritabanı', o.sistem.veritabani ? '<span class="rozet ok">bağlı</span>' : '<span class="rozet kotu">kapalı</span>') +
        kutu('Şema göçü', sema, tarih(o.sistem.semaZaman) || '') +
        kutu('Veri kotası', o.kota && o.kota.kalan != null
          ? esc(o.kota.kalan) + ' <span class="kucuk">/ ' + esc(o.kota.limit) + '</span>' : null) +
        kutu('Kayıtlı kullanıcı', o.sayim.kullanici == null ? null : esc(o.sayim.kullanici)) +
        kutu('Yorum', o.sayim.yorum == null ? null : esc(o.sayim.yorum)) +
        kutu('Bekleyen bildirim', o.sayim.bekleyenBildirim == null ? null : esc(o.sayim.bekleyenBildirim));
      $('bultenIzgara').innerHTML =
        kutu('Hafta', o.bulten.hafta ? esc(o.bulten.hafta) : null) +
        kutu('Maç', o.bulten.var ? esc(o.bulten.macSayisi) : null) +
        kutu('Analizli maç', o.bulten.var ? esc(o.bulten.analizliMac) + ' <span class="kucuk">/ ' + esc(o.bulten.macSayisi) + '</span>' : null) +
        kutu('Son güncelleme', tarih(o.bulten.guncellendi) ? '<span style="font-size:15px">' + esc(tarih(o.bulten.guncellendi)) + '</span>' : null);
    });
  }

  $('bultenBtn').addEventListener('click', function () {
    $('bultenBtn').disabled = true;
    $('bultenNot').textContent = 'Yenileniyor… birkaç dakika sürebilir, sayfayı kapatma.';
    istek('/api/admin/bulten-yenile', { method: 'POST' })
      .then(function (r) {
        $('bultenNot').textContent = 'Yenilendi' + (tarih(r.guncellendi) ? ' · ' + tarih(r.guncellendi) : '');
        return ozetYukle();
      })
      .catch(function (e) { $('bultenNot').textContent = 'Yenilenemedi: ' + e.message; hataGoster(e); })
      .finally(function () { $('bultenBtn').disabled = false; });
  });

  // ——— ANALİZ ———
  // KAYNAK: mevcut /api/scorecards/* uçları. Yeni backend ucu yazılmadı —
  // uygulamanın Sistem Karnesi ekranıyla AYNI veriyi okur, böylece panel ile
  // uygulama asla farklı sayı söyleyemez.
  function karneYukle() {
    if (sonKarne) return Promise.resolve(sonKarne);
    return Promise.all([istek('/api/scorecards/system'), istek('/api/scorecards/criteria').catch(function () { return null; })])
      .then(function (r) {
        sonKarne = r[0]; sonKriter = r[1];
        analizCiz();
        return sonKarne;
      });
  }

  function analizCiz() {
    var k = sonKarne;
    if (!k || k.hasData !== true) {
      $('analizUyari').innerHTML = '<p class="uyari">Henüz resmî sonuçla eşleşmiş mühürlü tahmin yok — başarı hesaplanamaz.</p>';
      $('analizIzgara').innerHTML = ''; $('sonucKirilim').innerHTML = '';
      $('hataTablo').innerHTML = '<p class="kucuk">Veri yok.</p>';
      return;
    }
    var u = '';
    if (Number(k.weeksCounted) > 0 && Number(k.weeksCounted) < 5) {
      u += '<p class="uyari">Yalnız ' + esc(k.weeksCounted) + ' hafta sayıldı — bu kadar az veride yüzde yanıltıcı olabilir.</p>';
    }
    if (Number(k.excludedCount) > 0) {
      var kr = k.exclusionBreakdown || {};
      var p = Object.keys(kr).map(function (a) { return esc(a) + ': ' + esc(kr[a]); });
      u += '<p class="uyari">' + esc(k.excludedCount) + ' hafta başarıya DAHİL EDİLMEDİ' +
        (p.length ? ' (' + p.join(' · ') + ')' : '') + ' — mühür kanıtı doğrulanamadığı için. Gizlenmiyor, sayılmıyor.</p>';
    }
    $('analizUyari').innerHTML = u;

    var kap = k.coverage || {};
    $('analizIzgara').innerHTML =
      kutu('Tekli isabet', '%' + esc(k.accuracy), esc(k.correct) + ' / ' + esc(k.total) + ' maç') +
      kutu('Son 5 hafta', k.last5 && k.last5.total ? '%' + esc(k.last5.accuracy) : null,
        k.last5 && k.last5.total ? esc(k.last5.correct) + ' / ' + esc(k.last5.total) + ' maç' : '') +
      kutu('Sayılan hafta', esc(k.weeksCounted), Number(k.pendingWeeks) ? esc(k.pendingWeeks) + ' hafta sonuç bekliyor' : '') +
      kutu('En iyi hafta', k.bestWeek ? '%' + esc(k.bestWeek.accuracy) : null,
        k.bestWeek ? esc(k.bestWeek.round) + ' · ' + esc(k.bestWeek.record) : '') +
      kutu('Kapsama', kap.rate != null ? '%' + esc(kap.rate) : null,
        kap.total != null ? esc(kap.covered) + ' / ' + esc(kap.total) + ' maç' : '') +
      kutu('Yanlış tahmin', esc(k.wrong), 'aşağıda tek tek listeleniyor');

    var br = k.byResult || {};
    $('sonucKirilim').innerHTML = '<div class="tabloSar"><table><thead><tr><th>Gerçekleşen sonuç</th>' +
      '<th class="sag">Doğru / Toplam</th><th class="sag">Başarı</th></tr></thead><tbody>' +
      ['1', 'X', '2'].map(function (o) {
        var d = br[o];
        if (!d || !d.t) return '<tr><td><b>' + o + '</b></td><td class="sag kucuk">veri yok</td><td></td></tr>';
        return '<tr><td><b>' + o + '</b></td><td class="sag">' + esc(d.c) + ' / ' + esc(d.t) +
          '</td><td class="sag"><b>%' + esc(d.rate) + '</b></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="kucuk">Sistem hangi sonuç türünde zayıf, tek bakışta görünür.</p>';

    var h = k.errors || [];
    $('hataTablo').innerHTML = h.length
      ? '<div class="tabloSar"><table><thead><tr><th>Hafta</th><th class="sag">No</th><th>Maç</th>' +
        '<th class="sag">Sistem</th><th class="sag">Sonuç</th><th class="sag">Skor</th></tr></thead><tbody>' +
        h.map(function (e) {
          return '<tr><td class="kucuk">' + esc(e.round || '') + '</td><td class="sag">' + esc(e.no) + '</td>' +
            '<td>' + esc(e.home) + ' – ' + esc(e.away) + '</td><td class="sag"><b>' + esc(e.system) + '</b></td>' +
            '<td class="sag"><b>' + esc(e.result) + '</b></td><td class="sag kucuk">' + esc(e.score || '') + '</td></tr>';
        }).join('') + '</tbody></table></div>'
      : '<p class="kucuk">Bu dönemde tutmayan tahmin yok.</p>';
  }

  function kriterCiz() {
    var c = sonKriter;
    var liste = (c && c.criteria) || [];
    if (!liste.length) { $('kriterTablo').innerHTML = '<p class="kucuk">Kriter karnesi için yeterli mühürlü veri yok.</p>'; return; }
    var donem = $('kriterDonem').value, sira = $('kriterSira').value;
    var pencere = function (x) { return (x.windows && x.windows[donem]) || {}; };
    var sirali = liste.filter(function (x) { return !x.informational; }).slice().sort(function (a, b) {
      if (sira === 'ad') return String(a.label).localeCompare(String(b.label), 'tr');
      if (sira === 'basari') return (pencere(b).rate || -1) - (pencere(a).rate || -1);
      return (pencere(b).total || 0) - (pencere(a).total || 0);
    });
    $('kriterTablo').innerHTML = '<div class="tabloSar"><table><thead><tr><th>Kriter</th>' +
      '<th class="sag">Maç</th><th class="sag">Doğru</th><th class="sag">Başarı</th></tr></thead><tbody>' +
      sirali.map(function (x) {
        var w = pencere(x);
        if (w.rate == null) {
          return '<tr><td>' + esc(x.label) + '</td><td class="sag kucuk" colspan="3">' +
            ((x.noData >= x.evaluated) ? 'veri yok' : 'sinyal yok') + '</td></tr>';
        }
        return '<tr><td>' + esc(x.label) + '</td><td class="sag">' + esc(w.total) + '</td>' +
          '<td class="sag">' + esc(w.hits) + '</td><td class="sag"><b>%' + esc(w.rate) + '</b></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="kucuk">"Maç" = kriterin yön gösterdiği maç sayısı. Az maçta yüzde yanıltıcı olabilir.</p>';
  }
  $('kriterDonem').addEventListener('change', kriterCiz);
  $('kriterSira').addEventListener('change', kriterCiz);

  // ——— ÖRÜNTÜLER (sistem kendi bulur) ———
  // Kullanıcı haklıydı: arama kutusu vermek keşfi ona yıkmaktı. Burası tüm
  // sinyalleri tüm dilimlerde tarar ve cümleyi KENDİ kurar.
  var sonOruntu = null;

  function guvenRozet(g) {
    var sinif = g === 'güçlü' ? 'ok' : g === 'orta' ? 'altin' : 'notr';
    return '<span class="rozet ' + sinif + '">' + esc(g) + '</span>';
  }

  function oruntuCiz() {
    if (!sonOruntu) return;
    var yon = $('oruntuYon').value;
    var minMac = Number($('oruntuMinMac').value) || 0;
    var liste = (sonOruntu.bulgular || []).filter(function (b) {
      if (yon && b.yon !== yon) return false;
      return b.mac >= minMac;
    });

    $('oruntuBulgu').innerHTML = liste.length
      ? '<div class="tabloSar"><table><thead><tr><th>Sinyal</th><th>Dilim</th>' +
        '<th class="sag">Sonuç</th><th class="sag">Kendi ortalaması</th>' +
        '<th class="sag">Fark</th><th>Güven</th></tr></thead><tbody>' +
        liste.map(function (b) {
          var ok = b.sapma > 0 ? '▲' : '▼';
          var renk = b.sapma > 0 ? 'ok' : 'kotu';
          return '<tr><td><b>' + esc(b.sinyal) + '</b><div class="kucuk">' + esc(b.tur) + '</div></td>' +
            '<td>' + esc(b.kural) + '<div class="kucuk">' + esc(b.sekilBaslik) + '</div></td>' +
            '<td class="sag"><b>' + esc(b.mac) + ' maçta ' + esc(b.dogru) + '</b>' +
              '<div class="kucuk">%' + esc(b.oran) + '</div></td>' +
            '<td class="sag kucuk">%' + esc(b.tabanOran) + '</td>' +
            '<td class="sag"><span class="rozet ' + renk + '">' + ok + ' ' +
              esc(Math.abs(b.sapma)) + ' puan</span></td>' +
            '<td>' + guvenRozet(b.guven) + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<p class="kucuk">"Kendi ortalaması" = o sinyalin TÜM maçlardaki başarısı. ' +
        'Fark, dilimin o ortalamadan sapmasıdır. ▼ satırlar sinyalin ZAYIF olduğu ' +
        'dilimlerdir ve bilerek gösterilir — yalnız iyi haberi göstermek aracı yanlı yapar.</p>'
      : '<p class="kucuk">Bu filtreyle bulgu yok. Eşikleri gevşetebilirsin ama düşük ' +
        'örneklemli bulgular tesadüf olmaya çok yakındır.</p>';

    var so = sonOruntu.sonucOruntuleri;
    $('oruntuSonuc').innerHTML = so && so.oruntuler && so.oruntuler.length
      ? '<div class="tabloSar"><table><thead><tr><th>Dilim</th><th class="sag">Maç</th>' +
        '<th class="sag">Baskın sonuç</th><th class="sag">Pay</th><th class="sag">Genel</th>' +
        '<th>Güven</th></tr></thead><tbody>' +
        so.oruntuler.map(function (o) {
          return '<tr><td>' + esc(o.kural) + '<div class="kucuk">' + esc(o.sekilBaslik) + '</div></td>' +
            '<td class="sag">' + esc(o.mac) + '</td>' +
            '<td class="sag"><b>' + esc(o.sonuc) + '</b></td>' +
            '<td class="sag"><b>%' + esc(o.pay) + '</b></td>' +
            '<td class="sag kucuk">%' + esc(o.tabanPay) + '</td>' +
            '<td>' + guvenRozet(o.guven) + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        (so.uyari ? '<p class="uyari" style="margin-top:10px">' + esc(so.uyari) + '</p>' : '')
      : '<p class="kucuk">' + esc((so && so.uyari) || 'Sonuç örüntüsü bulunamadı.') + '</p>';
  }

  $('oruntuTara').addEventListener('click', function () {
    $('oruntuTara').disabled = true;
    $('oruntuUyari').innerHTML = '<p class="kucuk">Taranıyor… tüm sinyaller için arşiv okunuyor, ' +
      'ilk çalıştırmada bir dakika sürebilir.</p>';
    istek('/api/admin/oruntuler')
      .then(function (r) {
        sonOruntu = r;
        var k = r.kapsam || {};
        $('oruntuUyari').innerHTML =
          '<div class="izgara" style="margin-bottom:10px">' +
          kutu('Taranan sinyal', esc(r.sinyalSayisi)) +
          kutu('Taranan dilim', esc(r.taranan)) +
          kutu('Bulgu', esc((r.bulgular || []).length)) +
          kutu('Sayılan hafta', esc(k.haftaDahil), esc(k.haftaDislanan) + ' hafta dışlandı') +
          '</div>' +
          '<p class="uyari">' + esc(r.uyari) + '</p>' +
          (r.bellekten ? '<p class="kucuk">Bellekten geldi (10 dk). Yeniden hesaplamak için sayfayı yenile.</p>' : '');
        oruntuCiz();
      })
      .catch(function (e) { $('oruntuUyari').innerHTML = '<p class="hata">' + esc(e.message) + '</p>'; })
      .finally(function () { $('oruntuTara').disabled = false; });
  });
  $('oruntuYon').addEventListener('change', oruntuCiz);
  $('oruntuMinMac').addEventListener('change', oruntuCiz);

  // ——— SİNYAL KIRILIMI ———
  // Kullanıcının yakaladığı örüntüyü ölçer: aynı sıra + benzer oynanma →
  // aynı sonuç. Hesap SUNUCUDA (analysis/sinyalKirilim.js); burası yalnız
  // çizer. Az örneklem işaretleri sunucudan gelir, burada uydurulmaz.
  var sonSinyal = null;

  function hucreYaz(h) {
    if (!h || h.veriYok) return '<span class="kucuk">—</span>';
    var metin = esc(h.mac) + ' maçta ' + esc(h.dogru);
    var yuzde = h.oran == null ? '—' : '%' + esc(h.oran);
    // AZ ÖRNEKLEM: yüzde gizlenmez ama işaretlenir; ham sayı hep önde.
    return '<div><b>' + yuzde + '</b>' + (h.azOrneklem ? ' <span class="rozet notr">az veri</span>' : '') +
      '</div><div class="kucuk">' + metin + '</div>';
  }

  function sinyalKataloguYukle() {
    return istek('/api/admin/sinyaller').then(function (k) {
      var sec = $('sinyalSec');
      var html = '<optgroup label="Radarlar">' +
        (k.radarlar || []).map(function (r) {
          return '<option value="radar:' + esc(r.key) + '">' + esc(r.ad) + '</option>';
        }).join('') + '</optgroup>' +
        '<option value="master:master">Master Analiz (ana tahmin)</option>' +
        '<optgroup label="Kriterler">' +
        (k.kriterler || []).map(function (c) {
          return '<option value="kriter:' + esc(c.key) + '">' + esc(c.ad) + '</option>';
        }).join('') + '</optgroup>';
      sec.innerHTML = html || '<option>kriter bulunamadı</option>';
      var siraSec = $('oynanmaSira');
      siraSec.innerHTML = '';
      for (var i = 1; i <= 15; i += 1) siraSec.innerHTML += '<option value="' + i + '">' + i + '. sıra</option>';
    });
  }

  function sinyalHesapla() {
    var v = ($('sinyalSec').value || '').split(':');
    if (v.length < 2) return Promise.resolve();
    $('sinyalGetir').disabled = true;
    return istek('/api/admin/sinyal-kirilim?tur=' + encodeURIComponent(v[0]) + '&key=' + encodeURIComponent(v[1]))
      .then(function (r) {
        sonSinyal = r;
        var kap = r.kapsam || {};
        $('sinyalKapsam').innerHTML =
          (r.uyari ? '<p class="uyari">' + esc(r.uyari) + '</p>' : '') +
          '<div class="izgara">' +
          kutu('Genel başarı', r.genel && r.genel.oran != null ? '%' + esc(r.genel.oran) : null,
            r.genel ? esc(r.genel.mac) + ' maçta ' + esc(r.genel.dogru) : '') +
          kutu('Sayılan hafta', esc(kap.haftaDahil), esc(kap.haftaDislanan) + ' hafta dışlandı') +
          kutu('Sinyal veren maç', esc(kap.sinyalOlan), esc(r.genel ? r.genel.sinyalsizMac : 0) + ' maçta yön yok') +
          kutu('Oynanma verisi olan', esc(kap.oynanmaOlan), 'maç') +
          '</div>';
        sinyalSiraCiz();
        oynanmaCiz();
      })
      .finally(function () { $('sinyalGetir').disabled = false; });
  }

  /** Bir maçın DETAY satırı: hangi maç, ne oynanmış, oranı neydi, ne oldu. */
  function macDetaySatiri(m) {
    var durum = m.sinyal == null
      ? '<span class="rozet notr">yön yok</span>'
      : (m.tutmus ? '<span class="rozet ok">tuttu</span>' : '<span class="rozet kotu">tutmadı</span>');
    var oyn = m.oynanma
      ? '%' + esc(m.oynanma['1']) + ' / %' + esc(m.oynanma.X) + ' / %' + esc(m.oynanma['2'])
      : '<span class="kucuk">oynanma verisi yok</span>';
    var oran = m.oran
      ? esc(m.oran.home) + ' / ' + esc(m.oran.draw) + ' / ' + esc(m.oran.away)
      : '<span class="kucuk">oran yok</span>';
    return '<tr><td class="kucuk">' + esc(m.hafta) + '</td>' +
      '<td>' + esc(m.home) + ' – ' + esc(m.away) +
        (m.lig ? '<div class="kucuk">' + esc(m.lig) + '</div>' : '') + '</td>' +
      '<td class="sag"><b>' + esc(m.skor || '—') + '</b></td>' +
      '<td class="sag">' + (m.sinyal ? '<b>' + esc(m.sinyal) + '</b>' : '—') + '</td>' +
      '<td class="sag"><b>' + esc(m.sonuc) + '</b></td>' +
      '<td class="sag kod">' + oyn + '</td>' +
      '<td class="sag kod">' + oran + '</td>' +
      '<td>' + durum + '</td></tr>';
  }

  function sinyalSiraCiz() {
    if (!sonSinyal) return;
    var sira = sonSinyal.sira || [];
    var dag = {};
    (sonSinyal.dagilim || []).forEach(function (d) { dag[d.no] = d; });
    $('sinyalSira').innerHTML =
      '<div class="tabloSar"><table><thead><tr><th>Sıra</th><th>Tüm haftalar</th><th>Son 5</th>' +
      '<th>Son 10</th><th>O sırada ne çıkmış (1 / X / 2)</th><th></th></tr></thead><tbody>' +
      sira.map(function (s) {
        var d = dag[s.no];
        var dagMetin = d && d.mac
          ? ['1', 'X', '2'].map(function (o) {
            return '<b>' + o + '</b> ' + (d.dagilim[o].oran == null ? '—' : '%' + esc(d.dagilim[o].oran));
          }).join(' · ') + ' <span class="kucuk">(' + esc(d.mac) + ' maç)</span>'
          : '<span class="kucuk">—</span>';
        var macSayisi = (s.maclar || []).length;
        var satir = '<tr data-sira="' + esc(s.no) + '"><td><b>' + esc(s.no) + '</b></td>' +
          '<td>' + hucreYaz(s.donem.tum) + '</td>' +
          '<td>' + hucreYaz(s.donem.son5) + '</td>' +
          '<td>' + hucreYaz(s.donem.son10) + '</td>' +
          '<td class="kucuk">' + dagMetin + '</td>' +
          '<td>' + (macSayisi
            ? '<button class="ikincil ufak" data-ac="' + esc(s.no) + '">Maçları gör (' + macSayisi + ')</button>'
            : '') + '</td></tr>';
        // DETAY: varsayılan gizli. "1 maçta 1 doğru" yazıp hangi maç olduğunu
        // söylememek sayıyı doğrulanamaz kılıyordu (kullanıcı bildirimi).
        if (macSayisi) {
          satir += '<tr class="detay" data-detay="' + esc(s.no) + '" hidden><td colspan="6">' +
            '<div class="tabloSar"><table><thead><tr><th>Hafta</th><th>Maç</th><th class="sag">Skor</th>' +
            '<th class="sag">Sinyal</th><th class="sag">Sonuç</th><th class="sag">Oynanma 1/X/2</th>' +
            '<th class="sag">Oran 1/X/2</th><th>Durum</th></tr></thead><tbody>' +
            s.maclar.map(macDetaySatiri).join('') + '</tbody></table></div></td></tr>';
        }
        return satir;
      }).join('') + '</tbody></table></div>' +
      '<p class="kucuk">Sinyalin başarısı, o sıranın DOĞAL dağılımıyla birlikte okunmalı: ' +
      'bir sıra zaten çoğunlukla 1 bitiyorsa, "1" diyen sinyalin yüksek başarısı tek başına bir şey söylemez. ' +
      '"Maçları gör" ile her sayının arkasındaki maçları açabilirsin.</p>';
  }

  $('sinyalSira').addEventListener('click', function (ev) {
    var d = ev.target.closest('button[data-ac]');
    if (!d) return;
    var no = d.getAttribute('data-ac');
    var detay = $('sinyalSira').querySelector('tr[data-detay="' + no + '"]');
    if (!detay) return;
    detay.hidden = !detay.hidden;
    d.textContent = detay.hidden ? 'Maçları gör (' + (sonSinyal.sira.find(function (x) {
      return String(x.no) === String(no);
    }).maclar || []).length + ')' : 'Gizle';
  });

  function oynanmaCiz() {
    if (!sonSinyal) return;
    var no = Number($('oynanmaSira').value) || 1;
    var satirlar = (sonSinyal.oynanmaProfili || []).filter(function (r) { return Number(r.no) === no; });
    var govde = satirlar.map(function (r) {
      if (r.veriYok) {
        return '<tr><td><b>' + esc(r.sonuc) + '</b></td><td class="kucuk" colspan="4">bu sırada ' +
          esc(r.sonuc) + ' ile biten maç yok</td></tr>';
      }
      var p = r.profil || {};
      var hucreP = function (o) {
        var x = p[o];
        if (!x) return '<span class="kucuk">—</span>';
        return '<b>%' + esc(x.ortalama) + '</b><div class="kucuk">' +
          esc(x.enAz) + '–' + esc(x.enCok) + '</div>';
      };
      return '<tr><td><b>' + esc(r.sonuc) + '</b>' +
        (r.azOrneklem ? ' <span class="rozet notr">az veri</span>' : '') + '</td>' +
        '<td class="sag">' + esc(r.mac) + '</td>' +
        '<td class="sag">' + hucreP('1') + '</td>' +
        '<td class="sag">' + hucreP('X') + '</td>' +
        '<td class="sag">' + hucreP('2') + '</td></tr>' +
        '<tr><td colspan="5" class="kucuk">' + (r.maclar || []).map(function (m) {
          return esc(m.hafta) + ' ' + esc(m.home) + '–' + esc(m.away) +
            (m.skor ? ' ' + esc(m.skor) : '') +
            (m.oynanma ? ' <span class="kod">%' + esc(m.oynanma['1']) + '/%' + esc(m.oynanma.X) +
              '/%' + esc(m.oynanma['2']) + '</span>' : '');
        }).join(' &nbsp;·&nbsp; ') + '</td></tr>';
    }).join('');
    $('sinyalOynanma').innerHTML = govde
      ? '<div class="tabloSar"><table><thead><tr><th>Sonuç</th><th class="sag">Maç</th>' +
        '<th class="sag">Oynanma 1</th><th class="sag">Oynanma X</th><th class="sag">Oynanma 2</th>' +
        '</tr></thead><tbody>' + govde + '</tbody></table></div>' +
        '<p class="kucuk">Kalın sayı ortalama, altındaki en az–en çok aralığıdır. ' +
        'Ortalama tek başına yanıltır: %44 ile %30’un ortalaması %37’dir ve %37 hiçbir maçta görülmemiş olabilir.</p>'
      : '<p class="kucuk">Bu sırada oynanma verisi olan maç yok.</p>';
  }

  $('sinyalGetir').addEventListener('click', function () { sinyalHesapla().catch(hataGoster); });
  $('oynanmaSira').addEventListener('change', oynanmaCiz);

  $('bnzBtn').addEventListener('click', function () {
    var v = ($('sinyalSec').value || '').split(':');
    if (v.length < 2) return;
    var q = '/api/admin/sinyal-kirilim?tur=' + encodeURIComponent(v[0]) + '&key=' + encodeURIComponent(v[1]) +
      '&sira=' + encodeURIComponent($('bnzSira').value) +
      '&h1=' + encodeURIComponent($('bnz1').value) +
      '&hx=' + encodeURIComponent($('bnzX').value) +
      '&h2=' + encodeURIComponent($('bnz2').value) +
      '&tolerans=' + encodeURIComponent($('bnzTol').value);
    $('bnzBtn').disabled = true;
    istek(q).then(function (r) {
      var b = r.benzer;
      if (!b || b.veriYok) {
        $('sinyalBenzer').innerHTML = '<p class="kucuk">Bu profile benzeyen geçmiş maç bulunamadı. ' +
          'Toleransı artırabilirsin — ama geniş tolerans "benzer" tanımını anlamsızlaştırır.</p>';
        return;
      }
      $('sinyalBenzer').innerHTML =
        '<div class="izgara" style="margin-bottom:10px">' +
        ['1', 'X', '2'].map(function (o) {
          return kutu('Sonuç ' + o, b.dagilim[o].oran == null ? null : '%' + esc(b.dagilim[o].oran),
            esc(b.dagilim[o].adet) + ' / ' + esc(b.mac) + ' maç');
        }).join('') + '</div>' +
        (b.azOrneklem ? '<p class="uyari">Yalnız ' + esc(b.mac) + ' benzer maç bulundu — bu sayıdan çıkarım yapılmaz, ' +
          'yalnız gözlem olarak okunur.</p>' : '') +
        '<div class="tabloSar"><table><thead><tr><th>Hafta</th><th class="sag">Sıra</th><th>Maç</th>' +
        '<th class="sag">Skor</th><th class="sag">Oynanma</th><th class="sag">Sonuç</th></tr></thead><tbody>' +
        b.vakalar.map(function (m) {
          return '<tr><td class="kucuk">' + esc(m.hafta) + '</td><td class="sag">' + esc(m.no) + '</td>' +
            '<td>' + esc(m.home) + ' – ' + esc(m.away) + '</td>' +
            '<td class="sag kucuk">' + esc(m.skor || '') + '</td>' +
            '<td class="sag kod">%' + esc(m.oynanma['1']) + '/%' + esc(m.oynanma.X) + '/%' + esc(m.oynanma['2']) + '</td>' +
            '<td class="sag"><b>' + esc(m.sonuc) + '</b></td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<p class="kucuk">Bu tablo GEÇMİŞ gözlemidir. Gelecek maç için bir vaat içermez.</p>';
    }).catch(hataGoster).finally(function () { $('bnzBtn').disabled = false; });
  });

  // ——— HAFTALAR ———
  // KULLANICI SORUSU (2026-08-06): "50-51. haftalar neden yok?"
  // Liste karneden besleniyordu; karne yalnız BAŞARIYA SAYILAN (maç öncesi
  // mühürlendiği doğrulanan) haftaları döndürür. Dışlanan hafta hiç
  // görünmediği için veri kayıp sanılıyordu. Artık TÜM arşiv haftaları
  // listeleniyor ve dışlananın SEBEBİ yazıyor.
  var haftaListe = [];
  function haftaYukle() {
    return istek('/api/admin/haftalar').then(function (r) {
      haftaListe = r.liste || [];
      var o = r.ozet || {};
      $('haftaOzet').innerHTML = '<div class="izgara" style="margin-bottom:10px">' +
        kutu('Arşivdeki hafta', esc(o.toplam)) +
        kutu('Başarıya dahil', esc(o.dahil)) +
        kutu('Dışlanan', esc(o.dislanan), 'silinmedi, yalnız sayılmıyor') +
        '</div>';
      haftaCiz();
    });
  }

  function haftaCiz() {
    var f = $('haftaDurum').value, ara = ($('haftaAra').value || '').trim().toLowerCase();
    var suz = haftaListe.filter(function (h) {
      if (f === 'dahil' && !h.dahil) return false;
      if (f === 'dislanan' && h.dahil) return false;
      if (ara && String(h.hafta || '').toLowerCase().indexOf(ara) < 0) return false;
      return true;
    });
    $('haftaTablo').innerHTML = suz.length
      ? '<div class="tabloSar"><table><thead><tr><th>Hafta</th><th>Durum</th><th class="sag">Kayıt</th>' +
        '<th class="sag">Başarı</th><th class="sag">Resmî sonuç</th><th>Mühür</th>' +
        '<th>Neden sayılmıyor?</th></tr></thead><tbody>' +
        suz.map(function (h) {
          var rozet = h.dahil ? '<span class="rozet ok">dahil</span>'
            : '<span class="rozet kotu">dışlandı</span>';
          return '<tr><td><b>' + esc(h.hafta || ('#' + h.roundId)) + '</b>' +
            '<div class="kucuk">' + esc(h.kaynak) + '</div></td>' +
            '<td>' + rozet + '</td>' +
            '<td class="sag">' + esc(h.kayit || '—') + '</td>' +
            '<td class="sag"><b>' + (h.basari == null ? '—' : '%' + esc(h.basari)) + '</b></td>' +
            '<td class="sag">' + esc(h.resmiSonuc == null ? '—' : h.resmiSonuc) + '</td>' +
            '<td class="kucuk kod">' + esc(h.muhur || '—') +
              (h.muhurZamani ? '<div class="kucuk">' + esc(tarih(h.muhurZamani) || '') + '</div>' : '') + '</td>' +
            '<td class="kucuk">' + esc(h.sebepMetni || '') + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<p class="kucuk">Dışlanan hafta <b>silinmez</b> ve gizlenmez; yalnız başarı hesabına katılmaz. ' +
        'Kural: tahmin ilk maç başlamadan ÖNCE mühürlenmiş olmalı.</p>'
      : '<p class="kucuk">Filtreye uyan hafta yok.</p>';
  }
  $('haftaDurum').addEventListener('change', haftaCiz);
  $('haftaAra').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') haftaCiz(); });

  // ——— KULLANICILAR ———
  var kullaniciListe = [];
  function kullaniciYukle() {
    var q = ($('kullaniciAra').value || '').trim();
    return istek('/api/admin/kullanicilar?limit=200' + (q ? '&q=' + encodeURIComponent(q) : ''))
      .then(function (r) {
        if (!r.veritabani) {
          $('kullaniciIzgara').innerHTML = '';
          $('kullaniciTablo').innerHTML = '<p class="uyari">Veritabanı bağlı değil.</p>';
          return;
        }
        var s = r.sayim || {};
        $('kullaniciIzgara').innerHTML =
          kutu('Toplam kayıt', esc(s.toplam)) +
          kutu('Etkin oturumu olan', esc(s.etkinOturumlu), 'çıkış yapmamış hesaplar') +
          kutu('Premium', s.premiumlu == null ? null : esc(s.premiumlu)) +
          kutu('Engelli', s.engelli == null ? null : esc(s.engelli)) +
          kutu('Son 7 günde giriş', esc(s.son7gGiris)) +
          kutu('Yeni · 24 saat', esc(s.yeni24s)) +
          kutu('Yeni · 7 gün', esc(s.yeni7g)) +
          kutu('Doğrulanmamış', esc(s.dogrulanmamis));
        kullaniciListe = r.liste || [];
        kullaniciCiz();
        $('kullaniciNot').textContent = 'Şifre, belirteç ve IP bu ekranda hiç görünmez.';
      });
  }

  function kullaniciCiz() {
    var f = $('kullaniciFiltre').value;
    var liste = kullaniciListe.filter(function (k) {
      if (f === 'aktif') return k.etkinOturum;
      if (f === 'premium') return k.premium === true;
      if (f === 'engelli') return k.engelli === true;
      if (f === 'dogrulanmamis') return !k.dogrulandi;
      return true;
    });
    $('kullaniciTablo').innerHTML = liste.length
      ? '<div class="tabloSar"><table><thead><tr><th>E-posta</th><th>Kullanıcı adı</th><th>Kayıt</th>' +
        '<th>Son giriş</th><th>Durum</th><th>Premium</th><th>İşlem</th></tr></thead><tbody>' +
        liste.map(function (k) {
          var d = k.engelli ? '<span class="rozet kotu">engelli</span>'
            : k.etkinOturum ? '<span class="rozet ok">aktif</span>'
              : k.dogrulandi ? '<span class="rozet notr">çıkış yapmış</span>'
                : '<span class="rozet kotu">doğrulanmamış</span>';
          var pr = k.premium === true
            ? '<span class="rozet altin">' + (k.premiumSuresiz ? 'süresiz' : esc(tarih(k.premiumBitis) || 'var')) + '</span>'
            : (k.premium === null ? '<span class="kucuk">—</span>' : '<span class="kucuk">yok</span>');
          return '<tr data-uid="' + esc(k.id) + '"><td>' + esc(k.eposta || '—') + '</td>' +
            '<td>' + esc(k.kullaniciAdi || '—') + '</td>' +
            '<td class="kucuk">' + esc(tarih(k.kayit) || '—') + '</td>' +
            '<td class="kucuk">' + esc(tarih(k.sonGiris) || 'hiç') + '</td>' +
            '<td>' + d + (k.engelSebep ? '<div class="kucuk">' + esc(k.engelSebep) + '</div>' : '') + '</td>' +
            '<td>' + pr + '</td>' +
            '<td><div class="satir">' +
              (k.engelli
                ? '<button class="ikincil ufak" data-is="engel-kaldir">Engeli kaldır</button>'
                : '<button class="tehlike ufak" data-is="engelle">Engelle</button>') +
              (k.premium
                ? '<button class="ikincil ufak" data-is="premium-iptal">Premium iptal</button>'
                : '<button class="ikincil ufak" data-is="premium-ver">Premium ver</button>') +
            '</div></td></tr>';
        }).join('') + '</tbody></table></div>'
      : '<p class="kucuk">Eşleşen kullanıcı yok.</p>';
  }

  $('kullaniciTablo').addEventListener('click', function (ev) {
    var d = ev.target.closest('button[data-is]');
    if (!d) return;
    var satir = d.closest('tr'), uid = satir && satir.getAttribute('data-uid');
    if (!uid) return;
    var is = d.getAttribute('data-is'), yol = null, govde = null;
    if (is === 'engelle') {
      var sebep = window.prompt('Engelleme sebebi (kullanıcıya gösterilmez, kayıt için):', 'Topluluk kurallarını ihlal');
      if (sebep === null) return;
      var gun = window.prompt('Kaç gün? (boş bırakırsan süresiz)', '');
      if (gun === null) return;
      yol = '/api/admin/kullanici/' + encodeURIComponent(uid) + '/engelle';
      govde = { sebep: sebep, gun: Number(gun) || 0 };
    } else if (is === 'engel-kaldir') {
      yol = '/api/admin/kullanici/' + encodeURIComponent(uid) + '/engeli-kaldir';
    } else if (is === 'premium-ver') {
      var g = window.prompt('Kaç gün premium? (0 = süresiz)', '30');
      if (g === null) return;
      yol = '/api/admin/kullanici/' + encodeURIComponent(uid) + '/premium';
      govde = { gun: Number(g) || 0 };
    } else if (is === 'premium-iptal') {
      if (!window.confirm('Bu kullanıcının premium hakkı iptal edilsin mi?')) return;
      yol = '/api/admin/kullanici/' + encodeURIComponent(uid) + '/premium-iptal';
    }
    if (!yol) return;
    satir.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
    istek(yol, { method: 'POST', body: govde })
      .then(function () { bilgi('kullaniciDurum', 'İşlem tamam.'); return kullaniciYukle(); })
      .catch(function (e) { bilgi('kullaniciDurum', e.message, 'hata'); hataGoster(e); });
  });

  $('kullaniciAraBtn').addEventListener('click', function () { kullaniciYukle().catch(hataGoster); });
  $('kullaniciFiltre').addEventListener('change', kullaniciCiz);
  $('kullaniciAra').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') $('kullaniciAraBtn').click(); });

  // ——— YORUMLAR ———
  function yorumYukle() {
    var q = ($('yorumAra').value || '').trim();
    var gizli = $('yorumFiltre').value === 'gizli' ? '&gizli=1' : '';
    return istek('/api/admin/yorumlar?limit=300' + (q ? '&q=' + encodeURIComponent(q) : '') + gizli)
      .then(function (r) {
        var liste = r.liste || [];
        $('yorumTablo').innerHTML = liste.length
          ? '<div class="tabloSar"><table><thead><tr><th>Tarih</th><th>Kullanıcı</th><th>Yorum</th>' +
            '<th>Durum</th><th>İşlem</th></tr></thead><tbody>' +
            liste.map(function (c) {
              return '<tr data-yid="' + esc(c.id) + '"><td class="kucuk">' + esc(tarih(c.tarih) || '') + '</td>' +
                '<td>' + esc(c.kullaniciAdi) + '</td>' +
                '<td style="max-width:420px"><div class="metin">' + esc(c.metin) + '</div></td>' +
                '<td>' + (c.gizli ? '<span class="rozet kotu">gizli</span>' : '<span class="rozet ok">görünür</span>') + '</td>' +
                '<td><div class="satir">' +
                  (c.gizli ? '<button class="ikincil ufak" data-is="goster">Göster</button>'
                    : '<button class="ikincil ufak" data-is="gizle">Gizle</button>') +
                  '<button class="tehlike ufak" data-is="sil">Sil</button>' +
                '</div></td></tr>';
            }).join('') + '</tbody></table></div>' +
            '<p class="kucuk">' + liste.length + ' yorum gösteriliyor. Silme GERİ ALINAMAZ.</p>'
          : '<p class="kucuk">Eşleşen yorum yok.</p>';
      });
  }

  $('yorumTablo').addEventListener('click', function (ev) {
    var d = ev.target.closest('button[data-is]');
    if (!d) return;
    var satir = d.closest('tr'), yid = satir && satir.getAttribute('data-yid');
    if (!yid) return;
    var is = d.getAttribute('data-is');
    var yol = '/api/admin/yorum/' + encodeURIComponent(yid) + (is === 'sil' ? '' : '/' + is);
    if (is === 'sil' && !window.confirm('Bu yorum KALICI olarak silinecek. Geri alınamaz. Emin misin?')) return;
    satir.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
    istek(yol, { method: is === 'sil' ? 'DELETE' : 'POST' })
      .then(function () { bilgi('yorumDurum', is === 'sil' ? 'Yorum silindi.' : 'İşlem tamam.'); return yorumYukle(); })
      .catch(function (e) { bilgi('yorumDurum', e.message, 'hata'); hataGoster(e); });
  });
  $('yorumAraBtn').addEventListener('click', function () { yorumYukle().catch(hataGoster); });
  $('yorumAra').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') $('yorumAraBtn').click(); });

  // ——— PREMIUM KODLARI ———
  function kodYukle() {
    return istek('/api/admin/premium/kodlar').then(function (r) {
      var liste = r.liste || [];
      $('kodTablo').innerHTML = liste.length
        ? '<div class="tabloSar"><table><thead><tr><th>Kod</th><th class="sag">Gün</th>' +
          '<th class="sag">Kullanım</th><th>Not</th><th>Üretim</th><th>Durum</th><th>İşlem</th></tr></thead><tbody>' +
          liste.map(function (k) {
            var durum = k.iptal ? '<span class="rozet kotu">iptal</span>'
              : k.gecerli ? '<span class="rozet ok">geçerli</span>'
                : '<span class="rozet notr">kullanılamaz</span>';
            return '<tr data-kod="' + esc(k.kod) + '"><td class="kod">' + esc(k.kod) + '</td>' +
              '<td class="sag">' + (Number(k.gun) > 0 ? esc(k.gun) : 'süresiz') + '</td>' +
              '<td class="sag">' + esc(k.kullanim) + ' / ' + esc(k.maxKullanim) + '</td>' +
              '<td class="kucuk">' + esc(k.not || '') + '</td>' +
              '<td class="kucuk">' + esc(tarih(k.olusturma) || '') + '</td>' +
              '<td>' + durum + '</td>' +
              '<td>' + (k.iptal ? '' : '<button class="tehlike ufak" data-is="kod-iptal">İptal et</button>') + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        : '<p class="kucuk">Henüz kod üretilmedi.</p>';
    });
  }

  $('kodUretBtn').addEventListener('click', function () {
    $('kodUretBtn').disabled = true;
    istek('/api/admin/premium/kod', {
      method: 'POST',
      body: {
        adet: Number($('kodAdet').value) || 1,
        gun: Number($('kodGun').value),
        maxKullanim: Number($('kodMax').value) || 1,
        not: $('kodNot').value,
      },
    })
      .then(function (r) {
        $('kodSonuc').innerHTML = '<div class="basari">Üretilen kod' + ((r.kodlar || []).length > 1 ? 'lar' : '') +
          ': <span class="kod">' + (r.kodlar || []).map(esc).join(' · ') + '</span></div>';
        return kodYukle();
      })
      .catch(function (e) { bilgi('kodSonuc', e.message, 'hata'); hataGoster(e); })
      .finally(function () { $('kodUretBtn').disabled = false; });
  });

  $('kodTablo').addEventListener('click', function (ev) {
    var d = ev.target.closest('button[data-is="kod-iptal"]');
    if (!d) return;
    var satir = d.closest('tr'), kod = satir && satir.getAttribute('data-kod');
    if (!kod || !window.confirm(kod + ' kodu iptal edilsin mi? Kullanılmış haklar geri alınmaz.')) return;
    d.disabled = true;
    istek('/api/admin/premium/kod/' + encodeURIComponent(kod) + '/iptal', { method: 'POST' })
      .then(kodYukle).catch(hataGoster);
  });

  // ——— DENETİM KAYDI ———
  function kayitYukle() {
    var tur = $('kayitTur').value;
    return istek('/api/admin/kayitlar?limit=300' + (tur ? '&tur=' + encodeURIComponent(tur) : ''))
      .then(function (r) {
        if (r.kurulmadi) {
          $('kayitTablo').innerHTML = '<p class="uyari">Denetim tablosu henüz kurulmadı (migration 011). ' +
            'Sunucuda SUPABASE_DB_URL tanımlanınca açılışta otomatik oluşur.</p>';
          return;
        }
        var liste = r.liste || [];
        $('kayitTablo').innerHTML = liste.length
          ? '<div class="tabloSar"><table><thead><tr><th>Zaman</th><th>Operatör</th><th>İşlem</th>' +
            '<th>Hedef</th><th>Ayrıntı</th></tr></thead><tbody>' +
            liste.map(function (k) {
              return '<tr><td class="kucuk">' + esc(tarih(k.at) || '') + '</td>' +
                '<td class="kucuk">' + esc(k.actor) + '</td>' +
                '<td><span class="rozet notr">' + esc(k.action) + '</span></td>' +
                '<td class="kucuk kod">' + esc(k.target || '—') + '</td>' +
                '<td class="kucuk">' + esc(k.detail || '') + '</td></tr>';
            }).join('') + '</tbody></table></div>' +
            '<p class="kucuk">' + liste.length + ' kayıt gösteriliyor.</p>'
          : '<p class="kucuk">Kayıt yok.</p>';
      });
  }
  $('kayitTur').addEventListener('change', function () { kayitYukle().catch(hataGoster); });

  // ——— MODERASYON KUYRUĞU ———
  function modYukle() {
    return istek('/api/moderation/reports').then(function (r) {
      var liste = (r && r.items) || [];
      var oksuz = (r && r.orphanCount) || 0;
      var not = oksuz ? '<p class="uyari">' + esc(oksuz) + ' bildirim silinmiş bir yoruma ait — listede gösterilemiyor.</p>' : '';
      if (!liste.length) { $('modAlan').innerHTML = not + '<p class="kucuk">Bekleyen bildirim yok.</p>'; return; }
      $('modAlan').innerHTML = not + liste.map(function (b) {
        var sebepler = Array.isArray(b.reasons) ? b.reasons.join(', ') : (b.reasons || '');
        return '<div class="bildirim" data-yorum="' + esc(b.commentId) + '">' +
          '<div class="satir"><span class="kucuk">' + esc(b.reportCount) + ' bildirim · ' +
            esc(b.reporterCount) + ' kişi · ' + esc(sebepler) + '</span>' +
            (b.hidden ? '<span class="rozet kotu">gizli</span>' : '<span class="rozet notr">görünür</span>') + '</div>' +
          '<div class="kucuk">' + esc((b.author && b.author.username) || '—') +
            (tarih(b.createdAt) ? ' · ' + esc(tarih(b.createdAt)) : '') + '</div>' +
          '<div class="metin">' + esc(b.text || '(metin okunamadı)') + '</div>' +
          '<div class="satir">' +
            (b.hidden ? '<button class="ikincil ufak" data-is="geri">Gizlemeyi geri al</button>'
              : '<button class="tehlike ufak" data-is="gizle">Yorumu gizle</button>') +
            '<button class="tehlike ufak" data-is="sil">Yorumu sil</button>' +
            '<button class="ikincil ufak" data-is="yoksay">Bildirimi yok say</button>' +
          '</div></div>';
      }).join('');
    });
  }

  $('modAlan').addEventListener('click', function (ev) {
    var d = ev.target.closest('button[data-is]');
    if (!d) return;
    var kart = d.closest('.bildirim'), id = kart && kart.getAttribute('data-yorum');
    if (!id) return;
    var is = d.getAttribute('data-is');
    if (is === 'sil' && !window.confirm('Bu yorum KALICI olarak silinecek. Emin misin?')) return;
    var yol = is === 'sil' ? '/api/admin/yorum/' + encodeURIComponent(id)
      : is === 'gizle' ? '/api/moderation/comments/' + encodeURIComponent(id) + '/hide'
        : is === 'geri' ? '/api/moderation/comments/' + encodeURIComponent(id) + '/unhide'
          : '/api/moderation/reports/' + encodeURIComponent(id) + '/dismiss';
    kart.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
    istek(yol, { method: is === 'sil' ? 'DELETE' : 'POST' })
      .then(function () { return Promise.all([modYukle(), ozetYukle()]); })
      .catch(function (e) {
        hataGoster(e);
        kart.querySelectorAll('button').forEach(function (b) { b.disabled = false; });
      });
  });

  // ——— GENEL YENİLE ———
  $('yenileBtn').addEventListener('click', function () {
    $('yenileBtn').disabled = true;
    sonKarne = null; sonKriter = null;
    var acik = ($('sekmeler').querySelector('button.acik') || {}).getAttribute
      ? $('sekmeler').querySelector('button.acik').getAttribute('data-sekme') : 'genel';
    Promise.all([ozetYukle(), (yukleyiciler[acik] || function () { return Promise.resolve(); })()])
      .catch(hataGoster)
      .finally(function () { $('yenileBtn').disabled = false; });
  });

  function baslat() {
    var kim = sessionStorage.getItem('yonetim_kim');
    $('kimBilgi').textContent = kim || '';
    $('girisEkran').hidden = true;
    $('panel').hidden = false;
    yuklendi = {};
    sekmeAc('genel');
  }

  if (token) baslat(); else girisGoster('');
})();
