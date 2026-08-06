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

  $('yenileBtn').addEventListener('click', function () {
    $('yenileBtn').disabled = true;
    Promise.all([ozetYukle(), modYukle()])
      .catch(hataGoster)
      .finally(function () { $('yenileBtn').disabled = false; });
  });

  function baslat() {
    var kim = sessionStorage.getItem('yonetim_kim');
    $('kimBilgi').textContent = kim ? kim : '';
    $('girisEkran').hidden = true;
    $('panel').hidden = false;
    Promise.all([ozetYukle(), modYukle()]).catch(hataGoster);
  }

  if (token) baslat(); else girisGoster('');
})();
