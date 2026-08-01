// HESAP SİLME — GERÇEK VE KALICI SİLME.
//
// Google Play "Kullanıcı Verileri" politikası: hesap oluşturmaya izin veren
// uygulama, hem UYGULAMA İÇİNDEN hem de uygulamayı kurmadan erişilebilen bir
// WEB BAĞLANTISINDAN hesap silme yolu sunmak ZORUNDADIR ve silme GERÇEK olmalıdır.
//
// KESİN KURALLAR
// 1. Silme "pasife alma" DEĞİLDİR. Kullanıcıya ait satırlar veritabanından
//    gerçekten silinir, yüklediği avatar dosyaları depodan gerçekten silinir,
//    ardından auth kullanıcısı gerçekten silinir.
// 2. Kullanıcının kendi verisi DIŞINDAKİ hiçbir şeye dokunulmaz. Bülten arşivi,
//    mühürlü analizler, resmî sonuçlar, Radar ve Sistem Karnesi verileri
//    (bulletins, bulletin_snapshots, match_official_results, sportoto_history_*,
//    snapshot_* ...) KESİNLİKLE SİLİNMEZ — bunlar kullanıcıya ait değildir.
// 3. Silme tamamlanamazsa "silindi" DENMEZ. Hangi adımın başarısız olduğu
//    dürüstçe raporlanır; auth kullanıcısı en SON silinir; böylece kısmi
//    başarısızlıkta kullanıcı tekrar deneyebilir (yetim veri kalmaz).
// 4. Rapora hiçbir zaman e-posta, token veya şifre yazılmaz.

// Kullanıcıya AİT tablolar ve sahiplik sütunu. Bu liste dışındaki hiçbir tabloya
// dokunulmaz. Yeni bir kullanıcı tablosu eklenirse BURAYA da eklenmelidir.
export const USER_OWNED_TABLES = [
  { table: 'comment_likes', column: 'user_id' },
  // Kullanıcının YAPTIĞI bildirimler, yorumlarından ÖNCE silinir. (Başkalarının
  // onun yorumlarına yaptığı bildirimler ayrı bir adımda siliniyor — aşağıdaki
  // purgeReportsOnOwnComments.)
  { table: 'comment_reports', column: 'reporter_id' },
  { table: 'comments', column: 'user_id' },
  { table: 'community_poll_votes', column: 'user_id' },
  { table: 'player_votes', column: 'user_id' },
  { table: 'score_predictions', column: 'user_id' },
  { table: 'lineup_predictions', column: 'user_id' },
  { table: 'analysis_profiles', column: 'user_id' },
  { table: 'user_analysis_snapshots', column: 'user_id' },
  // Hesap güvenliği + ilerleme sistemi (migration 006). sessions, devices'tan
  // ÖNCE silinir (device_id ilişkisi). security_logs da silinir: kişisel veri
  // (IP, tarayıcı bilgisi) içerir; "gerçek silme" ilkesi burada da geçerlidir.
  { table: 'user_achievements', column: 'user_id' },
  { table: 'user_tasks', column: 'user_id' },
  { table: 'points_history', column: 'user_id' },
  { table: 'sessions', column: 'user_id' },
  { table: 'devices', column: 'user_id' },
  { table: 'security_logs', column: 'user_id' },
  // Engeller İKİ YÖNDEN de silinir (migration 007). Yalnız `blocker_id`
  // silinseydi, silinen hesabın BAŞKALARI tarafından konmuş engelleri
  // veritabanında kalırdı; artık var olmayan bir kişiyi engelleyen satırlar.
  { table: 'user_blocks', column: 'blocker_id' },
  { table: 'user_blocks', column: 'blocked_id' },
  // profiles EN SONDA: diğer tablolar ona bağlı olabilir.
  { table: 'profiles', column: 'id' },
];

// Kullanıcının yüklediği avatar dosyaları `avatars` deposunda `<userId>/...`
// klasöründe tutulur; klasörün tamamı silinir.
export const AVATAR_BUCKET = 'avatars';

/**
 * BAŞKALARININ, bu kullanıcının yorumlarına yazdığı bildirimleri siler.
 *
 * NEDEN AYRI BİR ADIM: bu satırların sahibi `reporter_id` (başka biri), o yüzden
 * USER_OWNED_TABLES döngüsü onları yakalayamaz. Normal şartta yorum silinince
 * yabancı anahtar (`comment_reports_comment_fk`, on delete cascade) onları da
 * siler — ama 007'de o kısıt KORUMALI ekleniyor: canlı `comments.id` sütununun
 * türü ölçülmediği için kurulamama ihtimali var. Kısıt kurulmuşsa bu adım
 * zararsızdır (silinecek satır kalmaz); kurulamamışsa yorum silindikten sonra
 * geride HİÇBİR YORUMA BAĞLI OLMAYAN bildirim satırları kalırdı.
 *
 * Kimlikler parça parça sorulur: kullanıcının binlerce yorumu varsa tek bir
 * dev `in (...)` sorgusu istek boyu sınırına takılabilir.
 *
 * @returns {Promise<{ok:boolean, removed?:number, skipped?:string, error?:string}>}
 */
export async function purgeReportsOnOwnComments(sbAdmin, uid) {
  const yok = (m) => /does not exist|42P01/i.test(String(m || ''));
  try {
    const { data, error } = await sbAdmin.from('comments').select('id').eq('user_id', uid);
    if (error) {
      if (yok(error.message)) return { ok: true, skipped: 'tablo-yok' };
      return { ok: false, error: error.message };
    }
    const ids = (data || []).map((r) => r.id);
    if (!ids.length) return { ok: true, removed: 0 };

    const PARCA = 200;
    for (let i = 0; i < ids.length; i += PARCA) {
      const { error: de } = await sbAdmin.from('comment_reports')
        .delete().in('comment_id', ids.slice(i, i + PARCA));
      if (de) {
        if (yok(de.message)) return { ok: true, skipped: 'tablo-yok' };
        return { ok: false, error: de.message };
      }
    }
    return { ok: true, removed: ids.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Kullanıcının kuponları sürücülü depodadır (couponStore: Supabase user_coupons
// veya dosya). Silme sırasında bu kaydın da kaldırılması için çağrılır.
// T12: eski (readMap, writeMap) imzası yerine doğrudan async silici alınır —
// depo sürücüsünü depo bilir, silme akışı bilmek zorunda değildir.
export function makeCouponPurger(deleteCoupons) {
  return async (userId) => {
    const r = await deleteCoupons(userId);
    return { removed: r?.removed ?? 0 };
  };
}

/**
 * Kullanıcının TÜM verisini kalıcı olarak siler.
 *
 * @param {object} deps
 * @param {object} deps.sbAdmin            Supabase admin istemcisi
 * @param {string} deps.userId             Silinecek kullanıcının kimliği
 * @param {(id:string)=>object} [deps.purgeCoupons]  Dosya deposundaki kuponları siler
 * @returns {Promise<{ok:boolean, steps:object[], failed:string[]}>}
 */
export async function deleteUserAccount({ sbAdmin, userId, purgeCoupons }) {
  const steps = [];
  const failed = [];
  const uid = String(userId || '');
  if (!uid) return { ok: false, steps, failed: ['userId yok'] };

  // 0) Kullanıcının yorumlarına BAŞKALARININ yazdığı bildirimler. Yorumlar
  //    silinmeden ÖNCE olmalı: yorum gidince hangi bildirimin ona ait olduğunu
  //    bulmanın yolu kalmaz.
  {
    const r = await purgeReportsOnOwnComments(sbAdmin, uid);
    steps.push({ step: 'yoruma-gelen-bildirimler', ...r });
    if (!r.ok) failed.push('yoruma-gelen-bildirimler');
  }

  // 1) Kullanıcıya ait veritabanı satırları.
  for (const { table, column } of USER_OWNED_TABLES) {
    try {
      const { error } = await sbAdmin.from(table).delete().eq(column, uid);
      if (error) {
        // Henüz oluşturulmamış tablo (migration bekliyor) silme işlemini
        // ENGELLEMEZ: o tabloda kullanıcıya ait veri zaten yoktur.
        if (/does not exist|42P01/i.test(error.message || '')) {
          steps.push({ step: table, ok: true, skipped: 'tablo-yok' });
        } else {
          steps.push({ step: table, ok: false, error: error.message });
          failed.push(table);
        }
      } else {
        steps.push({ step: table, ok: true });
      }
    } catch (e) {
      steps.push({ step: table, ok: false, error: e.message });
      failed.push(table);
    }
  }

  // 2) Yüklenen avatar dosyaları (varsa).
  try {
    const { data: files, error: le } = await sbAdmin.storage.from(AVATAR_BUCKET).list(uid);
    if (le) throw new Error(le.message);
    const paths = (files || []).map((f) => `${uid}/${f.name}`);
    if (paths.length) {
      const { error: re } = await sbAdmin.storage.from(AVATAR_BUCKET).remove(paths);
      if (re) throw new Error(re.message);
    }
    steps.push({ step: 'avatar-dosyalari', ok: true, removed: paths.length });
  } catch (e) {
    steps.push({ step: 'avatar-dosyalari', ok: false, error: e.message });
    failed.push('avatar-dosyalari');
  }

  // 3) Kupon deposu (sürücülü: Supabase tablosu veya dosya).
  if (typeof purgeCoupons === 'function') {
    try {
      const r = await purgeCoupons(uid);
      steps.push({ step: 'kuponlar', ok: true, removed: r?.removed ?? 0 });
    } catch (e) {
      steps.push({ step: 'kuponlar', ok: false, error: e.message });
      failed.push('kuponlar');
    }
  }

  // 4) Auth kullanıcısı EN SON. Önceki adımlarda hata varsa auth kullanıcısı
  //    SİLİNMEZ — yoksa kullanıcı bir daha giriş yapıp tekrar deneyemez ve
  //    verisi yetim kalır. Bu durumda dürüstçe "tamamlanamadı" denir.
  if (failed.length) {
    return { ok: false, steps, failed };
  }
  try {
    const { error } = await sbAdmin.auth.admin.deleteUser(uid);
    if (error) throw new Error(error.message);
    steps.push({ step: 'auth-kullanicisi', ok: true });
  } catch (e) {
    steps.push({ step: 'auth-kullanicisi', ok: false, error: e.message });
    failed.push('auth-kullanicisi');
    return { ok: false, steps, failed };
  }

  return { ok: true, steps, failed: [] };
}
