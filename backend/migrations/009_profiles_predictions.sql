-- 009 — EKSİK TABLOLAR: profil + topluluk tahmin tabloları.
--
-- NEDEN: bu beş tablo koddan KULLANILIYOR ama hiçbir göç dosyasında
-- oluşturulmuyordu. Mevcut kurulumda elle açılmış oldukları için hata
-- görünmüyordu; SIFIRDAN kurulan bir veritabanında ise:
--
--   • kayıt (register) `profiles` insert'inde patlıyor,
--   • profil güncelleme / kullanıcı adı kontrolü çalışmıyor,
--   • yorum ve liderlik ekranlarındaki kullanıcı adları boş geliyor,
--   • dört tahmin ucu (skor, oyuncu, kadro, anket) tümüyle ölü.
--
-- Kolonlar koddaki gerçek kullanımdan çıkarıldı (uydurma alan yok):
--   profiles              → routes/auth.js (insert), routes/users.js (patch),
--                           supabase.js getProfiles (select)
--   score_predictions     → routes/predictions.js POST /score
--   player_votes          → routes/predictions.js POST /player
--   lineup_predictions    → routes/predictions.js POST /lineup
--   community_poll_votes  → routes/predictions.js POST /poll
--
-- `if not exists` kullanıldı: elle açılmış mevcut kurulumlarda bu göç
-- ZARARSIZDIR, var olan tabloya ve veriye dokunmaz.
--
-- RLS: diğer tablolarla aynı ev stili — erişim yalnız sunucunun service-role
-- anahtarıyla; anon/authenticated rolleri tabloya hiç dokunamaz.

-- ---------------------------------------------------------------------------
-- PROFİL
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique,
  avatar_type   text,                       -- 'preset' | 'default' | 'upload'
  avatar_key    text,                       -- hazır avatar anahtarı
  avatar_url    text,                       -- yüklenen resmin genel adresi
  favorite_team text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is
  'Kullanıcının görünen adı ve avatarı. Hesap silinince cascade ile gider.';

-- Kullanıcı adı benzersizliği zaten unique kısıtta; arama için ayrıca indeks
-- gerekmiyor (unique kısıt kendi indeksini kurar).

alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------------
-- SKOR TAHMİNİ — kullanıcı başına maç başına TEK satır (upsert).
-- ---------------------------------------------------------------------------
create table if not exists public.score_predictions (
  match_id   text not null,
  user_id    uuid not null references auth.users(id) on delete cascade,
  fh_home    smallint,
  fh_away    smallint,
  ft_home    smallint,
  ft_away    smallint,
  updated_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

comment on table public.score_predictions is
  'Kullanıcının maç skoru tahmini (ilk yarı + maç sonu). Maç başladıktan sonra sunucu yeni kayıt kabul etmez.';

create index if not exists score_predictions_match_idx on public.score_predictions (match_id);
alter table public.score_predictions enable row level security;

-- ---------------------------------------------------------------------------
-- MAÇIN OYUNCUSU — kullanıcı başına maç başına TEK oy.
-- ---------------------------------------------------------------------------
create table if not exists public.player_votes (
  match_id    text not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  team_id     text,
  team_name   text,
  player_id   text,
  player_name text not null,
  updated_at  timestamptz not null default now(),
  primary key (match_id, user_id)
);

comment on table public.player_votes is
  'Kullanıcının "maçın oyuncusu" oyu. Maç başladıktan sonra kabul edilmez.';

create index if not exists player_votes_match_idx on public.player_votes (match_id);
alter table public.player_votes enable row level security;

-- ---------------------------------------------------------------------------
-- KADRO TAHMİNİ — takım başına ayrı satır (ev/deplasman).
-- ---------------------------------------------------------------------------
create table if not exists public.lineup_predictions (
  match_id         text not null,
  user_id          uuid not null references auth.users(id) on delete cascade,
  team_id          text not null,            -- 'home' | 'away'
  team_name        text,
  formation        text,
  selected_players jsonb not null default '[]'::jsonb,
  updated_at       timestamptz not null default now(),
  primary key (match_id, user_id, team_id)
);

comment on table public.lineup_predictions is
  'Kullanıcının kadro tahmini (diziliş + en çok 11 oyuncu). Maç başladıktan sonra kabul edilmez.';

create index if not exists lineup_predictions_match_idx on public.lineup_predictions (match_id);
alter table public.lineup_predictions enable row level security;

-- ---------------------------------------------------------------------------
-- TOPLULUK ANKETİ — anket anahtarı başına TEK oy.
-- ---------------------------------------------------------------------------
create table if not exists public.community_poll_votes (
  match_id        text not null,
  user_id         uuid not null references auth.users(id) on delete cascade,
  poll_key        text not null,
  selected_option text not null,
  updated_at      timestamptz not null default now(),
  primary key (match_id, user_id, poll_key)
);

comment on table public.community_poll_votes is
  'Topluluk anketi oyu. Maç başladıktan sonra kabul edilmez.';

create index if not exists community_poll_votes_match_idx on public.community_poll_votes (match_id);
alter table public.community_poll_votes enable row level security;
