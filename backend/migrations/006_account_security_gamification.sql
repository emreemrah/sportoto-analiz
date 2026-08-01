-- ============================================================================
-- 006 — HESAP GÜVENLİĞİ + PROFİL İLERLEME SİSTEMİ
-- ============================================================================
-- Bu migration şu tabloları ekler:
--
--   devices           bağlı cihazlar (kullanıcının giriş yaptığı cihazlar)
--   sessions          oturumlar (süreli, yenilenebilir, uzaktan iptal edilebilir)
--   achievements      rozet/başarı kataloğu (kod tarafından beslenir)
--   user_achievements kullanıcının kazandığı başarılar (mükerrer ödül İMKÂNSIZ)
--   tasks             görev kataloğu (kod tarafından beslenir)
--   user_tasks        kullanıcının görev ilerlemesi
--   points_history    puan DEFTERİ — tek doğruluk kaynağı (toplam = SUM)
--   security_logs     güvenlik olay kaydı (şifre/token ASLA yazılmaz)
--
-- İstenen "users" ve "user_profiles" tabloları YENİDEN OLUŞTURULMAZ:
--   users        → auth.users        (Supabase Auth; şifre özetleri burada)
--   user_profiles→ public.profiles   (mevcut; kuponlar/yorumlar buna bağlı)
-- Mevcut hesaplar ve verileri korumak için bu eşleme bilinçli bir karardır.
--
-- ERİŞİM MODELİ: Bu tablolara YALNIZ backend (service role) erişir. RLS tümünde
-- açıktır ve HİÇBİR policy tanımlanmaz → anon/publishable anahtarla erişim
-- varsayılan olarak REDDEDİLİR (default deny). Kullanıcı kimliği asla istemciden
-- gelen bilgiye güvenilerek belirlenmez; her istek backend'de JWT ile doğrulanır.
--
-- İDEMPOTENT: Bu dosya birden çok kez güvenle çalıştırılabilir.
-- SIRA: 001 → 002 → 003 → 004 → 005 → 006. Migration sırasında backend KAPALI.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) BAĞLI CİHAZLAR
-- ---------------------------------------------------------------------------
create table if not exists public.devices (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  -- İstemcinin ürettiği kalıcı cihaz kimliği (rastgele uuid; kişisel veri değildir)
  client_device_id text not null,
  name             text,            -- "Android" / "Windows · Chrome" gibi
  platform         text,            -- android | ios | web
  first_seen_at    timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  unique (user_id, client_device_id)
);
create index if not exists idx_devices_user on public.devices (user_id);

-- ---------------------------------------------------------------------------
-- 2) OTURUMLAR
-- ---------------------------------------------------------------------------
-- Erişim belirteci (JWT) Supabase tarafından verilir ve süresi kısadır.
-- Bu tablo her girişi bir OTURUM olarak kaydeder; yenileme (refresh) ancak
-- oturum iptal edilmemişse yapılır. Böylece:
--   • kullanıcı cihazlarını görebilir,
--   • istediği cihazın oturumunu uzaktan kapatabilir,
--   • şifre değişince diğer oturumlar kapatılır,
--   • uzun süre kullanılmayan oturum kendiliğinden geçersizleşir.
create table if not exists public.sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  device_id     uuid references public.devices(id) on delete set null,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  revoked_at    timestamptz,          -- null = etkin
  revoke_reason text,                 -- logout | remote | password_change | expired
  ip            text,
  user_agent    text
);
create index if not exists idx_sessions_user_active
  on public.sessions (user_id) where revoked_at is null;

-- ---------------------------------------------------------------------------
-- 3) BAŞARI KATALOĞU + KULLANICI BAŞARILARI
-- ---------------------------------------------------------------------------
-- Katalogun TEK doğruluk kaynağı backend kodudur (gamification/catalog.js);
-- backend açılışta bu tabloyu idempotent biçimde eşitler (upsert).
create table if not exists public.achievements (
  key         text primary key,
  title       text not null,
  description text not null default '',
  icon        text not null default '',
  points      integer not null default 0,   -- kazanınca verilen puan
  sort        integer not null default 0
);

create table if not exists public.user_achievements (
  user_id         uuid not null references auth.users(id) on delete cascade,
  achievement_key text not null references public.achievements(key) on delete cascade,
  earned_at       timestamptz not null default now(),
  -- MÜKERRER ÖDÜL ENGELİ: aynı başarı aynı kullanıcıya bir kez yazılabilir.
  primary key (user_id, achievement_key)
);
create index if not exists idx_user_achievements_user on public.user_achievements (user_id);

-- ---------------------------------------------------------------------------
-- 4) GÖREV KATALOĞU + KULLANICI GÖREVLERİ
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  key         text primary key,
  title       text not null,
  description text not null default '',
  icon        text not null default '',
  target      integer not null default 1,   -- tamamlanma eşiği
  points      integer not null default 0,   -- tamamlanınca verilen puan
  sort        integer not null default 0
);

create table if not exists public.user_tasks (
  user_id      uuid not null references auth.users(id) on delete cascade,
  task_key     text not null references public.tasks(key) on delete cascade,
  progress     integer not null default 0,
  completed_at timestamptz,                 -- null = devam ediyor
  updated_at   timestamptz not null default now(),
  -- Aynı görev bir kullanıcıda tek satırdır; ödülü completed_at ile BİR KEZ verilir.
  primary key (user_id, task_key)
);

-- ---------------------------------------------------------------------------
-- 5) PUAN DEFTERİ (tek doğruluk kaynağı)
-- ---------------------------------------------------------------------------
-- Toplam puan = SUM(points). Ayrı bir sayaç tutulmaz; böylece yarış/uyumsuzluk
-- olamaz. (user_id, kind, ref_id) benzersizdir: AYNI eylem AYNI puanı iki kez
-- YAZAMAZ — istemci ne gönderirse göndersin sunucu mükerrer ödülü reddeder.
create table if not exists public.points_history (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null,                 -- ör. lock_score | acc_score | task | achievement
  ref_id     text not null default '',     -- ör. "1520:12345" (hafta:maç)
  points     integer not null,
  meta       jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref_id)
);
create index if not exists idx_points_history_user on public.points_history (user_id);

-- ---------------------------------------------------------------------------
-- 6) GÜVENLİK OLAY KAYDI
-- ---------------------------------------------------------------------------
-- ŞİFRE, TOKEN veya HASSAS VERİ bu tabloya ASLA yazılmaz. Backend'deki
-- securityLog modülü meta alanını beyaz listeyle süzer.
create table if not exists public.security_logs (
  id         bigint generated always as identity primary key,
  user_id    uuid,                          -- silinen hesapta satırlar da silinir
  event      text not null,                 -- login_success | login_failed | ...
  ip         text,
  user_agent text,
  meta       jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_security_logs_user
  on public.security_logs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 7) RLS — VARSAYILAN RET (default deny)
-- ---------------------------------------------------------------------------
alter table public.devices           enable row level security;
alter table public.sessions          enable row level security;
alter table public.achievements      enable row level security;
alter table public.user_achievements enable row level security;
alter table public.tasks             enable row level security;
alter table public.user_tasks        enable row level security;
alter table public.points_history    enable row level security;
alter table public.security_logs     enable row level security;
-- Bilerek HİÇBİR policy yok: yalnız service role (backend) erişir.

-- ---------------------------------------------------------------------------
-- SALT-OKUNUR DOĞRULAMA (çalıştırdıktan sonra):
--   select relname, relrowsecurity from pg_class
--   where relname in ('devices','sessions','achievements','user_achievements',
--                     'tasks','user_tasks','points_history','security_logs');
--   -- Beklenen: 8 satır, hepsinde relrowsecurity = true
-- ---------------------------------------------------------------------------
