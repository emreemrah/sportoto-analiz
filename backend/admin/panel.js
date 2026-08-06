// YÖNETİM PANELİ BETİĞİ — AYRI DOSYA, bilerek.
// ---------------------------------------------------------------------------
// NEDEN AYRI: sunucunun güvenlik başlıklarında CSP `script-src 'self'` var
// (src/security/headers.js). Satır içi <script> bu kuralla ENGELLENİR; panel
// açılır ama betik hiç çalışmadığı için ekran BOŞ kalır — ilk sürümde tam
// olarak bu oldu. Doğru çözüm CSP'yi gevşetmek değil, betiği dosyaya almaktı:
// güvenlik kuralı yerinde kalır, panel çalışır.

(function () {
  'use strict';

  // Belirteç yalnız SEKME ÖMRÜ boyunca durur (sessionStorage): paylaşılan bir
  // masaüstünde tarayıcı kapanınca oturum da kapanır.
  var ANAHTAR = 'yonetim_token';
  // OTURUM KİMLİĞİ (X-Session-Id) — ZORUNLU, süs değil.
  // Sunucu her istekte oturum satırını doğruluyor (mw.js/checkSession):
  // başlık gelmezse istek 401 ile reddediliyor. Bu, 'tüm cihazlardan çıkış'
  // özelliğinin atlatılamamasını sağlayan koruma. İlk sürümde panel bu
  // başlığı göndermiyordu; giriş başarılı oluyor ama ilk veri isteği 401
  // dönüp 'Oturum düştü' diyordu — yaşanan arıza tam olarak buydu.
  var OTURUM = 'yonetim_oturum';
  var token = sessionStorage.getItem(ANAHTAR) || '';
  var oturumId = sessionStorage.getItem(OTURUM) || '';
  var $ = function (id) { return document.getElementById(id); };
  var yok = '<span class="kucuk">bilinmiyor</span>';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function tarih(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString('tr-TR');
  }
  function kutu(etiket, deger, altYazi) {
    return '<div class="kutu"><div class="etiket">' + esc(etiket) + '</div>' +
      '<div class="deger">' + (deger == null ? yok : deger) + '</div>' +
      (altYazi ? '<div class="kucuk">' + esc(altYazi) + '</div>' : '') + '</div>';
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
      return r.json().catch(function () { return {}; }).then(function (govde) {
        if (!r.ok) {
          var e = new Error(govde.error || ('Sunucu ' + r.status));
          e.durum = r.status;
          throw e;
        }
        return govde;
      });
    });
  }

  function girisGoster(mesaj) {
    $('panel').hidden = true;
    $('girisEkran').hidden = false;
    if (mesaj) { $('girisHata').textContent = mesaj; $('girisHata').hidden = false; }
  }

  function hataGoster(e) {
    // 401/403: yetki yok ya da oturum düştü → girişe dön, sebebi söyle.
    if (e && (e.durum === 401 || e.durum === 403)) {
      sessionStorage.removeItem(ANAHTAR); sessionStorage.removeItem(OTURUM);
      token = ''; oturumId = '';
      girisGoster(e.durum === 403
        ? 'Bu hesap yönetim yetkisine sahip değil.'
        : 'Oturum düştü, tekrar gir.');
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
        // Sunucu belirteci `token` alanında döndürür (bkz. routes/auth.js issueSession).
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

  // ——— ÖZET ———
  function ozetYukle() {
    return istek('/api/admin/ozet').then(function (o) {
      $('ustHata').hidden = true;
      $('zamanBilgi').textContent = tarih(o.zaman) ? '· ' + tarih(o.zaman) : '';

      var sema = o.sistem.semaOk === true
        ? '<span class="rozet ok">tamam</span>'
        : o.sistem.semaOk === false
          ? '<span class="rozet kotu">' + esc(o.sistem.semaDurum || 'hata') + '</span>'
          : '<span class="rozet notr">' + esc(o.sistem.semaDurum || 'bilinmiyor') + '</span>';
      var db = o.sistem.veritabani
        ? '<span class="rozet ok">bağlı</span>'
        : '<span class="rozet kotu">kapalı</span>';
      var kota = (o.kota && o.kota.kalan != null)
        ? esc(o.kota.kalan) + (o.kota.limit != null ? ' <span class="kucuk">/ ' + esc(o.kota.limit) + '</span>' : '')
        : null;

      $('durumIzgara').innerHTML =
        kutu('Veritabanı', db) +
        kutu('Şema göçü', sema, tarih(o.sistem.semaZaman) || '') +
        kutu('Veri kotası', kota, o.kota && o.kota.sonGuncelleme ? 'son: ' + (tarih(o.kota.sonGuncelleme) || '') : '') +
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

  // ——— BÜLTEN YENİLE ———
  $('bultenBtn').addEventListener('click', function () {
    $('bultenBtn').disabled = true;
    $('bultenNot').textContent = 'Yenileniyor… bu işlem birkaç dakika sürebilir, sayfayı kapatma.';
    istek('/api/admin/bulten-yenile', { method: 'POST' })
      .then(function (r) {
        $('bultenNot').textContent = 'Yenilendi' + (tarih(r.guncellendi) ? ' · ' + tarih(r.guncellendi) : '');
        return ozetYukle();
      })
      .catch(function (e) { $('bultenNot').textContent = 'Yenilenemedi: ' + e.message; hataGoster(e); })
      .finally(function () { $('bultenBtn').disabled = false; });
  });


  // ——— ANALİZ PANOSU ———
  // KAYNAK: mevcut /api/scorecards/* uçları. Yeni backend ucu YAZILMADI —
  // uygulamanın Sistem Karnesi ekranıyla AYNI veriyi okur, böylece panel ile
  // uygulama asla farklı sayı söyleyemez.
  //
  // DÜRÜSTLÜK KURALLARI BURADA DA GEÇERLİ:
  //  • Yalnız maç öncesi MÜHÜRLENDİĞİ doğrulanan tahminler sayılır (uç öyle
  //    döndürüyor); dışlanan kayıt sayısı gizlenmez, ekranda yazılır.
  //  • Veri yoksa yüzde uydurulmaz, "veri yok" yazılır.
  function analizYukle() {
    return istek('/api/scorecards/system').then(function (k) {
      if (!k || k.hasData !== true) {
        $('analizUyari').innerHTML = '<p class="uyari">Henüz resmî sonuçla eşleşmiş mühürlü tahmin yok — başarı hesaplanamaz.</p>';
        $('analizIzgara').innerHTML = '';
        $('sonucKirilim').innerHTML = '';
        $('haftaTablo').innerHTML = '<p class="kucuk">Veri yok.</p>';
        $('hataTablo').innerHTML = '<p class="kucuk">Veri yok.</p>';
        return;
      }

      // Az örneklem uyarısı: 1-2 haftalık veriden çıkan yüzde yanıltıcıdır.
      var uyari = '';
      if (Number(k.weeksCounted) > 0 && Number(k.weeksCounted) < 5) {
        uyari += '<p class="uyari">Yalnız ' + esc(k.weeksCounted) + ' hafta sayıldı — bu kadar az veride yüzde yanıltıcı olabilir.</p>';
      }
      if (Number(k.excludedCount) > 0) {
        var kirilim = k.exclusionBreakdown || {};
        var parcalar = Object.keys(kirilim).map(function (a) { return esc(a) + ': ' + esc(kirilim[a]); });
        uyari += '<p class="uyari">' + esc(k.excludedCount) + ' hafta başarıya DAHİL EDİLMEDİ' +
          (parcalar.length ? ' (' + parcalar.join(' · ') + ')' : '') +
          ' — mühür kanıtı doğrulanamadığı için. Gizlenmiyor, sayılmıyor.</p>';
      }
      $('analizUyari').innerHTML = uyari;

      var kap = k.coverage || {};
      $('analizIzgara').innerHTML =
        kutu('Tekli isabet', '%' + esc(k.accuracy), esc(k.correct) + ' / ' + esc(k.total) + ' maç') +
        kutu('Son 5 hafta', k.last5 && k.last5.total ? '%' + esc(k.last5.accuracy) : null,
          k.last5 && k.last5.total ? esc(k.last5.correct) + ' / ' + esc(k.last5.total) + ' maç' : '') +
        kutu('Sayılan hafta', esc(k.weeksCounted), (Number(k.pendingWeeks) ? esc(k.pendingWeeks) + ' hafta sonuç bekliyor' : '')) +
        kutu('En iyi hafta', k.bestWeek ? '%' + esc(k.bestWeek.accuracy) : null,
          k.bestWeek ? esc(k.bestWeek.round) + ' · ' + esc(k.bestWeek.record) : '') +
        kutu('Kapsama', kap.rate != null ? '%' + esc(kap.rate) : null,
          kap.total != null ? esc(kap.covered) + ' / ' + esc(kap.total) + ' maç' : '') +
        kutu('Yanlış tahmin', esc(k.wrong), 'aşağıda tek tek listeleniyor');

      // 1 / X / 2 kırılımı — sistemin hangi sonuçta zayıf olduğunu gösterir.
      var br = k.byResult || {};
      var satirlar = ['1', 'X', '2'].map(function (o) {
        var d = br[o];
        if (!d || !d.t) return '<tr><td><b>' + o + '</b></td><td class="sag kucuk">veri yok</td><td class="sag"></td></tr>';
        return '<tr><td><b>' + o + '</b></td><td class="sag">' + esc(d.c) + ' / ' + esc(d.t) + '</td>' +
          '<td class="sag"><b>%' + esc(d.rate) + '</b></td></tr>';
      }).join('');
      $('sonucKirilim').innerHTML =
        '<div class="tabloSar"><table><thead><tr><th>Gerçekleşen sonuç</th><th class="sag">Doğru / Toplam</th>' +
        '<th class="sag">Başarı</th></tr></thead><tbody>' + satirlar + '</tbody></table></div>' +
        '<p class="kucuk">Sistem hangi sonuç türünde zayıf, tek bakışta görünür.</p>';

      // Hafta hafta
      var haftalar = k.weeks || [];
      $('haftaTablo').innerHTML = haftalar.length
        ? '<div class="tabloSar"><table><thead><tr><th>Hafta</th><th class="sag">Kayıt</th>' +
          '<th class="sag">Başarı</th><th>Durum</th><th>Mühür</th></tr></thead><tbody>' +
          haftalar.map(function (w) {
            var rozet = w.status === 'complete' ? '<span class="rozet ok">tam</span>'
              : w.status === 'partial' ? '<span class="rozet notr">kısmi</span>'
                : '<span class="rozet notr">bekliyor</span>';
            return '<tr><td>' + esc(w.round || ('#' + w.roundId)) + '</td>' +
              '<td class="sag">' + esc(w.record || '—') + '</td>' +
              '<td class="sag"><b>' + (w.accuracy == null ? '—' : '%' + esc(w.accuracy)) + '</b></td>' +
              '<td>' + rozet + '</td>' +
              '<td class="kucuk">' + esc(w.verificationHashShort || '—') + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        : '<p class="kucuk">Sayılan hafta yok.</p>';

      // Tutmayan tahminler — kök neden aramanın başladığı yer.
      var hatalar = k.errors || [];
      $('hataTablo').innerHTML = hatalar.length
        ? '<div class="tabloSar"><table><thead><tr><th>Hafta</th><th>No</th><th>Maç</th>' +
          '<th class="sag">Sistem</th><th class="sag">Sonuç</th><th class="sag">Skor</th></tr></thead><tbody>' +
          hatalar.map(function (e) {
            return '<tr><td class="kucuk">' + esc(e.round || '') + '</td><td class="sag">' + esc(e.no) + '</td>' +
              '<td>' + esc(e.home) + ' – ' + esc(e.away) + '</td>' +
              '<td class="sag"><b>' + esc(e.system) + '</b></td>' +
              '<td class="sag"><b>' + esc(e.result) + '</b></td>' +
              '<td class="sag kucuk">' + esc(e.score || '') + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        : '<p class="kucuk">Bu dönemde tutmayan tahmin yok.</p>';
    });
  }

  function kriterYukle() {
    return istek('/api/scorecards/criteria').then(function (c) {
      var liste = (c && c.criteria) || [];
      if (!liste.length) {
        $('kriterTablo').innerHTML = '<p class="kucuk">Kriter karnesi için yeterli mühürlü veri yok.</p>';
        return;
      }
      // Sinyal ürettiği maç sayısına göre sırala: çok maçta ölçülen kriter üstte.
      var sirali = liste.filter(function (x) { return !x.informational; }).slice().sort(function (a, b) {
        return ((b.windows && b.windows.allTime && b.windows.allTime.total) || 0) -
          ((a.windows && a.windows.allTime && a.windows.allTime.total) || 0);
      });
      $('kriterTablo').innerHTML =
        '<div class="tabloSar"><table><thead><tr><th>Kriter</th><th class="sag">Maç</th>' +
        '<th class="sag">Doğru</th><th class="sag">Başarı</th></tr></thead><tbody>' +
        sirali.map(function (x) {
          var w = (x.windows && x.windows.allTime) || {};
          if (w.rate == null) {
            var sebep = (x.noData >= x.evaluated) ? 'veri yok' : 'sinyal yok';
            return '<tr><td>' + esc(x.label) + '</td><td class="sag kucuk" colspan="3">' + sebep + '</td></tr>';
          }
          return '<tr><td>' + esc(x.label) + '</td><td class="sag">' + esc(w.total) + '</td>' +
            '<td class="sag">' + esc(w.hits) + '</td>' +
            '<td class="sag"><b>%' + esc(w.rate) + '</b></td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<p class="kucuk">"Maç" = kriterin yön gösterdiği maç sayısı. Az maçta yüzde yanıltıcı olabilir.</p>';
    });
  }


  // ——— KULLANICILAR ———
  // "Aktif" burada ÖLÇÜLEBİLİR bir şeydir: iptal edilmemiş oturumu olan
  // kullanıcı. Tahmini/uydurma bir "çevrimiçi" sayısı gösterilmez.
  function kullaniciYukle() {
    var q = ($('kullaniciAra').value || '').trim();
    return istek('/api/admin/kullanicilar?limit=100' + (q ? '&q=' + encodeURIComponent(q) : ''))
      .then(function (r) {
        if (!r.veritabani) {
          $('kullaniciIzgara').innerHTML = '';
          $('kullaniciTablo').innerHTML = '<p class="uyari">Veritabanı bağlı değil — kullanıcı bilgisi okunamıyor.</p>';
          return;
        }
        var s = r.sayim || {};
        $('kullaniciIzgara').innerHTML =
          kutu('Toplam kayıt', esc(s.toplam)) +
          kutu('Etkin oturumu olan', esc(s.etkinOturumlu), 'çıkış yapmamış hesaplar') +
          kutu('Son 7 günde giriş', esc(s.son7gGiris)) +
          kutu('Yeni kayıt · 24 saat', esc(s.yeni24s)) +
          kutu('Yeni kayıt · 7 gün', esc(s.yeni7g)) +
          kutu('Yeni kayıt · 30 gün', esc(s.yeni30g)) +
          kutu('E-postası doğrulanmış', esc(s.dogrulanmis),
            (s.dogrulanmamis ? esc(s.dogrulanmamis) + ' hesap doğrulanmamış' : '')) +
          kutu('Premium / satın alma', null, 'sistem henüz kurulmadı');

        var liste = r.liste || [];
        $('kullaniciTablo').innerHTML = liste.length
          ? '<div class="tabloSar"><table><thead><tr><th>E-posta</th><th>Kullanıcı adı</th>' +
            '<th>Kayıt</th><th>Son giriş</th><th>Durum</th></tr></thead><tbody>' +
            liste.map(function (k) {
              var rozet = k.etkinOturum ? '<span class="rozet ok">aktif</span>'
                : k.dogrulandi ? '<span class="rozet notr">çıkış yapmış</span>'
                  : '<span class="rozet kotu">doğrulanmamış</span>';
              return '<tr><td>' + esc(k.eposta || '—') + '</td>' +
                '<td>' + esc(k.kullaniciAdi || '—') + '</td>' +
                '<td class="kucuk">' + esc(tarih(k.kayit) || '—') + '</td>' +
                '<td class="kucuk">' + esc(tarih(k.sonGiris) || 'hiç') + '</td>' +
                '<td>' + rozet + '</td></tr>';
            }).join('') + '</tbody></table></div>'
          : '<p class="kucuk">Eşleşen kullanıcı yok.</p>';
        $('kullaniciNot').textContent = 'Gösterilen: ' + (r.gosterilen || 0) + ' kayıt. '
          + 'Şifre, belirteç ve IP bu ekranda hiç görünmez.';
      });
  }

  // ——— MODERASYON ———
  function modYukle() {
    return istek('/api/moderation/reports').then(function (r) {
      // Sunucu şekli: { items: [...], total, orphanCount } (moderationOps.js).
      var liste = (r && r.items) || [];
      var oksuz = (r && r.orphanCount) || 0;
      var oksuzNot = oksuz ? '<p class="uyari">' + esc(oksuz) + ' bildirim, silinmiş bir yoruma ait — listede gösterilemiyor.</p>' : '';
      if (!liste.length) {
        $('modAlan').innerHTML = oksuzNot + '<p class="kucuk">Bekleyen bildirim yok.</p>';
        return;
      }
      $('modAlan').innerHTML = oksuzNot + liste.map(function (b) {
        var sebepler = Array.isArray(b.reasons) ? b.reasons.join(', ') : (b.reasons || '');
        var durum = b.hidden
          ? '<span class="rozet kotu">gizli' + (b.hiddenBy ? ' · ' + esc(b.hiddenBy) : '') + '</span>'
          : '<span class="rozet notr">görünür</span>';
        return '<div class="bildirim" data-yorum="' + esc(b.commentId) + '">' +
          '<div class="satir"><span class="kucuk">' +
            esc(b.reportCount) + ' bildirim · ' + esc(b.reporterCount) + ' kişi · ' +
            esc(sebepler) + '</span>' + durum + '</div>' +
          '<div class="kucuk">' + esc((b.author && b.author.username) || '—') +
            (tarih(b.createdAt) ? ' · ' + esc(tarih(b.createdAt)) : '') + '</div>' +
          '<div class="metin">' + esc(b.text || '(metin okunamadı)') + '</div>' +
          '<div class="satir">' +
            (b.hidden
              ? '<button class="ikincil" data-is="geri">Gizlemeyi geri al</button>'
              : '<button class="tehlike" data-is="gizle">Yorumu gizle</button>') +
            '<button class="ikincil" data-is="yoksay">Bildirimi yok say</button>' +
          '</div></div>';
      }).join('');
    });
  }

  $('modAlan').addEventListener('click', function (ev) {
    var dugme = ev.target.closest('button[data-is]');
    if (!dugme) return;
    var kart = dugme.closest('.bildirim');
    var yorumId = kart && kart.getAttribute('data-yorum');
    if (!yorumId) return;
    var is = dugme.getAttribute('data-is');
    var yol = is === 'gizle' ? '/api/moderation/comments/' + encodeURIComponent(yorumId) + '/hide'
      : is === 'geri' ? '/api/moderation/comments/' + encodeURIComponent(yorumId) + '/unhide'
        : '/api/moderation/reports/' + encodeURIComponent(yorumId) + '/dismiss';
    kart.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
    istek(yol, { method: 'POST' })
      .then(function () { return Promise.all([modYukle(), ozetYukle()]); })
      .catch(function (e) {
        hataGoster(e);
        kart.querySelectorAll('button').forEach(function (b) { b.disabled = false; });
      });
  });

  $('kullaniciAraBtn').addEventListener('click', function () { kullaniciYukle().catch(hataGoster); });
  $('kullaniciAra').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') $('kullaniciAraBtn').click(); });

  $('yenileBtn').addEventListener('click', function () {
    $('yenileBtn').disabled = true;
    Promise.all([ozetYukle(), analizYukle(), kriterYukle(), kullaniciYukle(), modYukle()])
      .catch(hataGoster)
      .finally(function () { $('yenileBtn').disabled = false; });
  });

  function baslat() {
    var kim = sessionStorage.getItem('yonetim_kim');
    $('kimBilgi').textContent = kim ? kim : '';
    $('girisEkran').hidden = true;
    $('panel').hidden = false;
    Promise.all([ozetYukle(), analizYukle(), kriterYukle(), kullaniciYukle(), modYukle()]).catch(hataGoster);
  }

  if (token) baslat(); else girisGoster('');
})();
