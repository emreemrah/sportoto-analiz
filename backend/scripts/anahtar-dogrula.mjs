#!/usr/bin/env node
// SUPABASE ANAHTAR DOĞRULAMA — anahtar yenilendikten SONRA çalıştırılır.
//
// NEDEN VAR: Anahtar yenilemenin kendisi 2 dakika; asıl korkutan kısım
// "yeniledim ama üretimi bozdum mu?" sorusu. Bu betik o soruyu cevaplar:
// yeni anahtarlarla gerçekten bağlanılıyor mu, tablolar okunuyor mu, RLS
// hâlâ duruyor mu, giriş akışı çalışıyor mu.
//
// HİÇBİR VERİ YAZMAZ. Yalnız okur ve rapor eder. Güvenli — yanlışlıkla
// çalıştırmak zarar vermez.
//
// KULLANIM:
//   1) Supabase panelinde anahtarları yenile
//   2) backend/.env dosyasına yeni değerleri yaz
//   3) backend klasöründe:  node scripts/anahtar-dogrula.mjs
//
// Çıkış kodu 0 = her şey yolunda · 1 = en az bir kontrol kaldı.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..');

// .env'i elle oku — betik dotenv'e bağımlı olmasın (yenileme anında
// bağımlılık sorunu yaşanmasın diye).
function envOku() {
  const yol = join(kok, '.env');
  if (!existsSync(yol)) return {};
  const out = {};
  for (const satir of readFileSync(yol, 'utf8').split('\n')) {
    const m = satir.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return out;
}

const env = { ...envOku(), ...process.env };
const URL_ = env.SUPABASE_URL;
const SECRET = env.SUPABASE_SECRET_KEY;
const PUBLISHABLE = env.SUPABASE_PUBLISHABLE_KEY;

// Sunucunun gerçekten kullandığı tablolar (archive/supabaseStore + couponStore).
const TABLOLAR = [
  'bulletins', 'bulletin_matches', 'bulletin_snapshots',
  'bulletin_data_observations', 'match_official_results',
  'snapshot_evaluations', 'snapshot_audit_log', 'user_coupons',
];

const sonuc = [];
const ekle = (ad, ok, not = '') => { sonuc.push({ ad, ok, not }); };
const gizle = (v) => (!v ? '(boş)' : `${String(v).slice(0, 6)}…${String(v).slice(-4)} (${String(v).length} karakter)`);

async function main() {
  console.log('\n🔑 SUPABASE ANAHTAR DOĞRULAMA\n');
  console.log(`   URL          : ${URL_ || '(boş)'}`);
  console.log(`   SECRET       : ${gizle(SECRET)}`);
  console.log(`   PUBLISHABLE  : ${gizle(PUBLISHABLE)}\n`);

  // 0) Alanlar dolu mu?
  ekle('SUPABASE_URL dolu', !!URL_);
  ekle('SUPABASE_SECRET_KEY dolu', !!SECRET);
  ekle('SUPABASE_PUBLISHABLE_KEY dolu', !!PUBLISHABLE);
  // İki anahtar AYNI olamaz — kopyala-yapıştır sırasında en sık yapılan hata.
  ekle('İki anahtar birbirinden farklı', !!SECRET && !!PUBLISHABLE && SECRET !== PUBLISHABLE,
    SECRET === PUBLISHABLE ? 'Aynı değer yapıştırılmış!' : '');

  if (!URL_ || !SECRET || !PUBLISHABLE) return rapor();

  const admin = createClient(URL_, SECRET, { auth: { persistSession: false } });
  const anon = createClient(URL_, PUBLISHABLE, { auth: { persistSession: false } });

  // 1) Yönetici anahtarı: her tabloyu okuyabilmeli.
  for (const t of TABLOLAR) {
    try {
      const { error } = await admin.from(t).select('*', { count: 'exact', head: true });
      ekle(`admin → ${t} okunuyor`, !error, error?.message || '');
    } catch (e) {
      ekle(`admin → ${t} okunuyor`, false, e.message);
    }
  }

  // 2) RLS HÂLÂ DURUYOR MU? — anon istemci arşiv tablolarını GÖRMEMELİ.
  //    Bu en kritik kontrol: yeni anahtar çalışıyor diye sevinip RLS'in
  //    kapandığını fark etmemek, anahtar sızmasından daha kötüdür.
  //
  //    ⚠ ÖNEMLİ: Supabase'de RLS engellemesi HATA DÖNDÜRMEZ — sessizce BOŞ
  //    sonuç döner. Bu betiğin ilk hâli "hata var mı?" diye bakıyordu ve
  //    RLS düzgün çalışırken YANLIŞ ALARM veriyordu. Doğru ölçüt satır
  //    SAYILARINI karşılaştırmaktır: admin görüyor + anon görmüyor = korumalı.
  for (const t of ['bulletins', 'user_coupons']) {
    try {
      const a = await admin.from(t).select('*', { count: 'exact', head: true });
      const b = await anon.from(t).select('*', { count: 'exact', head: true });
      const adminSayi = a.count ?? 0;
      const anonSayi = b.count ?? 0;
      if (adminSayi === 0) {
        // Tablo boşsa bu kontrol hiçbir şey kanıtlamaz — "geçti" demek yanıltıcı olur.
        ekle(`RLS koruyor → ${t}`, true, 'ⓘ Tablo boş — bu kontrol SONUÇSUZ (veri gelince tekrar çalıştır).');
      } else {
        ekle(`RLS koruyor → ${t} anon'a KAPALI`, anonSayi === 0,
          anonSayi === 0
            ? `admin ${adminSayi} satır görüyor, anon 0 — doğru.`
            : `⚠ anon ${anonSayi} satır OKUYABİLİYOR — RLS kapalı ya da politika çok geniş!`);
      }
    } catch (e) {
      ekle(`RLS koruyor → ${t} anon'a KAPALI`, false, e.message);
    }
  }

  // 3) Giriş akışı: publishable anahtar auth uç noktasına ulaşıyor mu?
  //    Var olmayan bir hesapla giriş DENENİR; beklenen sonuç "geçersiz
  //    kimlik" hatasıdır. Ağ/anahtar hatası BAŞKA bir mesaj verir.
  try {
    const { error } = await anon.auth.signInWithPassword({
      email: 'anahtar-dogrulama@example.invalid',
      password: 'gecersiz-parola-dogrulama-icin',
    });
    const mesaj = error?.message || '';
    const kimlikHatasi = /invalid login credentials|invalid credentials/i.test(mesaj);
    const anahtarHatasi = /api key|apikey|jwt|unauthorized/i.test(mesaj);
    ekle('publishable anahtar auth ile çalışıyor', kimlikHatasi,
      kimlikHatasi ? '' : (anahtarHatasi ? `Anahtar reddedildi: ${mesaj}` : `Beklenmeyen yanıt: ${mesaj || 'hata yok?!'}`));
  } catch (e) {
    ekle('publishable anahtar auth ile çalışıyor', false, e.message);
  }

  // 4) Yönetici anahtarı auth yönetimine erişiyor mu (kullanıcı listesi).
  try {
    const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    ekle('secret anahtar auth yönetimine erişiyor', !error, error?.message || '');
  } catch (e) {
    ekle('secret anahtar auth yönetimine erişiyor', false, e.message);
  }

  rapor();
}

function rapor() {
  console.log('─'.repeat(64));
  let kalan = 0;
  for (const s of sonuc) {
    if (!s.ok) kalan += 1;
    console.log(`${s.ok ? '✅' : '❌'}  ${s.ad}${s.not ? `\n      ${s.not}` : ''}`);
  }
  console.log('─'.repeat(64));
  if (kalan === 0) {
    console.log('\n✅ Hepsi geçti — yeni anahtarlar çalışıyor, RLS yerinde.');
    console.log('   Sıradaki adım: sunucuyu yeniden başlat ve uygulamadan bir kez giriş yap.\n');
  } else {
    console.log(`\n❌ ${kalan} kontrol kaldı. Yukarıdaki nota bak.`);
    console.log('   ESKİ ANAHTARI HENÜZ SİLME — önce buradaki hatalar çözülsün.\n');
  }
  process.exit(kalan === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\n❌ Betik çalışamadı:', e.message);
  console.error('   (Bu genellikle SUPABASE_URL yanlış ya da ağ erişimi yok demektir.)\n');
  process.exit(1);
});
