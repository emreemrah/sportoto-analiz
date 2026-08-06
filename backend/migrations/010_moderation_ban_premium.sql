-- 010 — KULLANICI ENGELLEME + PREMIUM KOD SİSTEMİ
--
-- NEDEN: yönetim panelinden iki gerçek ihtiyaç doğdu:
--   1) Kötü davranan kullanıcıyı ENGELLEMEK (yorumunu silmek tek başına
--      yetmiyor; aynı kişi bir dakika sonra yenisini yazıyor).
--   2) Seçilen kişilere PREMIUM erişim vermek — ödeme altyapısı olmadan,
--      operatörün ürettiği KOD ile.
--
-- TASARIM KARARLARI
--
-- • Yetki VERİTABANINDA rol tablosuyla dağıtılmaz (bkz. moderatorGate.js).
--   Buradaki tablolar rol değil, DURUM tutar: "bu kullanıcı engelli mi",
--   "bu kullanıcının premium hakkı ne zamana kadar".
--
-- • Engel GERİ ALINABİLİR: satır silinmez, `lifted_at` doldurulur. Kimin ne
--   zaman neden engellendiği ve kaldırıldığı kayıtta kalır — bir gün "neden
--   engellenmişim" sorusu geldiğinde cevap verilebilsin.
--
-- • Kod TEK YAZIM, ÇOK OKUMA: kodun kendisi birincil anahtardır ve büyük
--   harfe normalize edilir. Kullanım sayısı `redemptions` tablosundan
--   SAYILARAK bulunur; koda sayaç yazmak (increment) yarış koşulu üretir.
--
-- • Bir kullanıcı aynı kodu İKİ KEZ kullanamaz: (code, user_id) benzersizdir.
--   Bu kural veritabanı seviyesindedir; uygulama katmanına güvenilmez.
--
-- • Premium süresi kodun üzerinde yazar (`grants_days`). Kullanım anında
--   hesaplanıp `premium_grants` satırına yazılır: kod sonradan değişse bile
--   verilmiş hak değişmez.
--
-- RLS: ev stili — erişim yalnız sunucunun service-role anahtarıyla.

-- ---------------------------------------------------------------------------
-- ENGELLEME
-- ---------------------------------------------------------------------------
create table if not exists public.user_bans (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  reason     text not null default '',
  banned_at  timestamptz not null default now(),
  banned_by  text,                       -- operatör e-postası (kim engelledi)
  until      timestamptz,                -- null = süresiz
  lifted_at  timestamptz,                -- doluysa engel KALDIRILMIŞ demektir
  lifted_by  text
);
-- Etkin engel sorgusu her istekte çalışır; indeks şart.
create index if not exists idx_user_bans_active
  on public.user_bans (user_id) where lifted_at is null;

comment on table public.user_bans is
  'Kullanıcı engelleri. Satır SİLİNMEZ; kaldırma lifted_at ile işaretlenir.';

alter table public.user_bans enable row level security;

-- ---------------------------------------------------------------------------
-- PREMIUM KODLARI
-- ---------------------------------------------------------------------------
create table if not exists public.premium_codes (
  code        text primary key,            -- BÜYÜK HARF, boşluksuz
  grants_days integer not null default 30, -- kullanınca kaç gün premium verir
  max_uses    integer not null default 1,  -- kaç kişi kullanabilir
  note        text not null default '',    -- "Ahmet'e verildi" gibi operatör notu
  created_at  timestamptz not null default now(),
  created_by  text,                        -- operatör e-postası
  expires_at  timestamptz,                 -- kodun kendisinin son kullanma tarihi
  revoked_at  timestamptz                  -- doluysa kod artık kullanılamaz
);

comment on table public.premium_codes is
  'Operatörün ürettiği premium erişim kodları. Kullanım sayısı redemptions''tan sayılır.';

alter table public.premium_codes enable row level security;

-- ---------------------------------------------------------------------------
-- KOD KULLANIMLARI (kim, hangi kodu, ne zaman)
-- ---------------------------------------------------------------------------
create table if not exists public.premium_redemptions (
  id          uuid primary key default gen_random_uuid(),
  code        text not null references public.premium_codes(code) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique (code, user_id)                   -- aynı kod aynı kişiye iki kez YOK
);
create index if not exists idx_premium_redemptions_code
  on public.premium_redemptions (code);

alter table public.premium_redemptions enable row level security;

-- ---------------------------------------------------------------------------
-- PREMIUM HAKLARI (etkin erişim)
-- ---------------------------------------------------------------------------
-- Neden ayrı tablo: hak yalnız koddan gelmeyebilir (operatör doğrudan da
-- verebilir, ileride satın alma da buraya yazar). Sorgu tek yerden yapılır:
-- "bu kullanıcının bugün geçerli bir hakkı var mı?"
create table if not exists public.premium_grants (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  source     text not null default 'code',  -- code | manual (ileride: purchase)
  code       text,                          -- koddan geldiyse hangi kod
  granted_at timestamptz not null default now(),
  granted_by text,                          -- elle verildiyse operatör e-postası
  expires_at timestamptz,                   -- null = süresiz
  revoked_at timestamptz                    -- doluysa hak iptal edilmiş
);
create index if not exists idx_premium_grants_user
  on public.premium_grants (user_id) where revoked_at is null;

comment on table public.premium_grants is
  'Etkin premium hakları. Hak İPTAL edilebilir (revoked_at) ama satır silinmez.';

alter table public.premium_grants enable row level security;
