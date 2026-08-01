-- ============================================================================
-- 001_bulletin_archive.sql
-- BÜLTEN ARŞİVİ + DEĞİŞMEZ SNAPSHOT MOTORU — kalıcı veri modeli (PostgreSQL /
-- Supabase). Çalıştırma: psql "$SUPABASE_DB_URL" -f backend/migrations/001_bulletin_archive.sql
-- (veya Supabase Studio > SQL Editor'e yapıştır).
--
-- TASARIM KURALLARI
--  * Zaman damgaları UTC (timestamptz) saklanır; Europe/Istanbul sadece gösterimdir.
--  * Bir bültenin TEK resmî kilitli snapshot'ı olabilir (unique index).
--  * Kilitli snapshot UPDATE/DELETE edilemez (trigger — DB seviyesinde).
--  * Kilitli bültenin maç kimlikleri (sıra/takım/lig/saat) değiştirilemez (trigger).
--  * Resmî sonuçlar snapshot'tan TAMAMEN ayrı tabloda tutulur; yalnız 90 dk
--    1/X/2 (ilk yarı skoru bu modelde YOKTUR ve eklenmez).
--  * Audit log append-only'dir (UPDATE/DELETE yasak).
-- ============================================================================

begin;

create schema if not exists public;

-- ---------------------------------------------------------------------------
-- A) bulletins — resmî Spor Toto haftası (bülten) üst kaydı
-- ---------------------------------------------------------------------------
create table if not exists public.bulletins (
  id                   text primary key,              -- String(roundId) — resmî hafta id'si
  round_id             bigint not null unique,        -- resmî Spor Toto gameRoundId
  season               text,                          -- örn. "2026/2027"
  week_name            text,                          -- örn. "49. Hafta"
  status               text not null default 'draft'
                       check (status in ('draft','active','locked','completed','cancelled')),
  first_match_start_at timestamptz,                   -- ilk maçın resmî başlama zamanı (UTC)
  freeze_at            timestamptz,                   -- first_match_start_at - 5 dakika (UTC)
  locked_at            timestamptz,
  completed_at         timestamptz,
  cancelled_at         timestamptz,
  close_date           timestamptz,                   -- resmî roundCloseDate (bilgi)
  official_signature   text,                          -- resmî kaynak imzası (sha256)
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.bulletins is
  'Spor Toto bülten arşivi üst kaydı. freeze_at = ilk maç - 5 dk; UTC saklanır.';

-- ---------------------------------------------------------------------------
-- B) bulletin_matches — bültenin 15 maçı (kimlik bilgileri)
-- ---------------------------------------------------------------------------
create table if not exists public.bulletin_matches (
  bulletin_id        text not null references public.bulletins(id) on delete restrict,
  match_id           text not null,                   -- resmî sportotoMatchId
  order_no           smallint not null check (order_no between 1 and 15),
  home_name          text not null,
  away_name          text not null,
  league             text,
  kickoff_at         timestamptz,                     -- resmî başlama zamanı (UTC)
  external_ids       jsonb not null default '{}'::jsonb, -- { footyMatchId, footySeasonId, footySwapped, homeExternalTeamId, awayExternalTeamId }
  pre_match_identity jsonb not null default '{}'::jsonb, -- maç-öncesi kimlik bilgileri (resmî ad varyantları vb.)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  primary key (bulletin_id, match_id)
);

create unique index if not exists bulletin_matches_order_uq
  on public.bulletin_matches (bulletin_id, order_no);

-- ---------------------------------------------------------------------------
-- C) bulletin_data_observations — kilide kadar toplanan zaman serisi gözlemleri
-- ---------------------------------------------------------------------------
create table if not exists public.bulletin_data_observations (
  id            bigint generated always as identity primary key,
  bulletin_id   text not null references public.bulletins(id) on delete restrict,
  match_id      text not null,
  source        text not null,                        -- örn. 'refresh', 'FootyStats'
  observed_at   timestamptz not null default now(),
  played_pct    jsonb,                                -- { "1": .., "X": .., "2": .. } — kaynak sunmuyorsa NULL (uydurma yok)
  odds          jsonb,                                -- { home, draw, away } — maç-öncesi oranlar
  stats_summary jsonb,                                -- { probabilities, xg, ppg, surpriseScore, ... }
  data_quality  jsonb,                                -- { matched, hasOdds, hasStats, hasXg, reason }
  raw           jsonb                                 -- gerekiyorsa ham veri
);

create index if not exists bulletin_data_observations_bidx
  on public.bulletin_data_observations (bulletin_id, match_id, observed_at);

-- ---------------------------------------------------------------------------
-- D) bulletin_snapshots — kilit anında dondurulan resmî snapshot (TEK ve DEĞİŞMEZ)
-- ---------------------------------------------------------------------------
create table if not exists public.bulletin_snapshots (
  id               text primary key,                  -- 'snap-<bulletinId>'
  bulletin_id      text not null references public.bulletins(id) on delete restrict,
  schema_version   text not null,
  engine_version   text not null,                     -- analiz motoru sürümü
  source_versions  jsonb not null default '{}'::jsonb,-- veri kaynağı sürümleri/imzaları
  created_at       timestamptz not null default now(),
  locked_at        timestamptz not null,              -- mühür zamanı
  data_observed_at timestamptz not null,              -- payload verisinin gerçekten elde edildiği an
  late             boolean not null default false,    -- freeze_at kaçırılıp sonradan mı alındı
  immutable        boolean not null default true,
  snapshot_payload jsonb not null,
  payload_hash     text not null,                     -- doğrulama hash'i (sha256, kanonik JSON)
  hash_algo        text not null default 'sha256-canonical-json-v1'
);

-- Bir bülten için YALNIZCA BİR resmî kilitli snapshot.
create unique index if not exists bulletin_snapshots_one_official
  on public.bulletin_snapshots (bulletin_id);

-- ---------------------------------------------------------------------------
-- E) match_official_results — resmî 90 dk sonuçları (snapshot'tan TAMAMEN ayrı)
--    İlk yarı skoru bu tabloda YOKTUR; yalnız 1/X/2 + tam maç skoru.
-- ---------------------------------------------------------------------------
create table if not exists public.match_official_results (
  bulletin_id        text not null references public.bulletins(id) on delete restrict,
  match_id           text not null,
  order_no           smallint,
  official_result    text not null check (official_result in ('1','X','2')),
  full_time_score    jsonb not null,                  -- { home: int, away: int }
  result_source      text not null default 'Spor Toto resmi API',
  confirmed_at       timestamptz not null default now(),
  source_updated_at  timestamptz not null default now(),
  correction_version integer not null default 1,
  corrections        jsonb not null default '[]'::jsonb, -- eski değerlerin tarihçesi
  primary key (bulletin_id, match_id)
);

-- ---------------------------------------------------------------------------
-- F) snapshot_evaluations — sonuçlar geldikten SONRA snapshot değerlendirmesi
-- ---------------------------------------------------------------------------
create table if not exists public.snapshot_evaluations (
  bulletin_id            text primary key references public.bulletins(id) on delete restrict,
  round_id               bigint not null,
  snapshot_id            text not null,
  snapshot_hash          text not null,               -- değerlendirilen snapshot'ın hash'i (kanıt)
  evaluated_at           timestamptz not null default now(),
  result_source          text not null default 'Spor Toto resmi API',
  effective_from_round_id bigint not null,            -- ÖĞRENME SINIRI: bu değerler ancak bu round ve sonrasında kullanılabilir
  summary                jsonb not null,              -- { total, resolved, correct, wrong, accuracy, banko*, surprise*, byResult }
  matches                jsonb not null               -- maç-başı: frozenPrediction, officialResult, correct, banko, surprise, criteriaHits, radar
);

-- ---------------------------------------------------------------------------
-- G) snapshot_audit_log — append-only denetim kaydı
-- ---------------------------------------------------------------------------
create table if not exists public.snapshot_audit_log (
  id          bigint generated always as identity primary key,
  bulletin_id text,
  action      text not null,                          -- register/observe/freeze/result/correction/evaluate/rejected_update/...
  actor       text not null default 'system',         -- system | worker | refresh | api:internal
  at          timestamptz not null default now(),
  old_value   jsonb,
  new_value   jsonb,
  rejected    boolean not null default false,
  reason      text
);

create index if not exists snapshot_audit_log_bidx on public.snapshot_audit_log (bulletin_id, at);

-- ============================================================================
-- GERÇEK DEĞİŞMEZLİK — veritabanı seviyesi trigger'lar
-- ============================================================================

-- 1) Kilitli snapshot: UPDATE ve DELETE tamamen yasak.
create or replace function public.forbid_snapshot_mutation()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.immutable then
      raise exception 'IMMUTABLE_SNAPSHOT: kilitli snapshot silinemez (bulletin %)', old.bulletin_id
        using errcode = 'P0001';
    end if;
    return old;
  end if;
  if old.immutable then
    raise exception 'IMMUTABLE_SNAPSHOT: kilitli snapshot degistirilemez (bulletin %)', old.bulletin_id
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists trg_snapshot_no_update on public.bulletin_snapshots;
create trigger trg_snapshot_no_update
  before update on public.bulletin_snapshots
  for each row execute function public.forbid_snapshot_mutation();

drop trigger if exists trg_snapshot_no_delete on public.bulletin_snapshots;
create trigger trg_snapshot_no_delete
  before delete on public.bulletin_snapshots
  for each row execute function public.forbid_snapshot_mutation();

-- 2) Kilitli bültenin maç kimliği: sıra, takımlar, lig, başlama saati DONMUŞTUR.
--    (Kilit sonrası satır silme/ekleme de yasak.)
create or replace function public.forbid_locked_match_identity_change()
returns trigger language plpgsql as $$
declare b_status text;
begin
  select status into b_status from public.bulletins
    where id = coalesce(new.bulletin_id, old.bulletin_id);
  if b_status in ('locked','completed','cancelled') then
    if tg_op = 'DELETE' then
      raise exception 'LOCKED_BULLETIN: kilitli bultenden mac silinemez (%)', old.bulletin_id
        using errcode = 'P0001';
    elsif tg_op = 'INSERT' then
      raise exception 'LOCKED_BULLETIN: kilitli bultene mac eklenemez (%)', new.bulletin_id
        using errcode = 'P0001';
    else
      if new.order_no  is distinct from old.order_no
        or new.home_name is distinct from old.home_name
        or new.away_name is distinct from old.away_name
        or new.league    is distinct from old.league
        or new.kickoff_at is distinct from old.kickoff_at
        or new.match_id  is distinct from old.match_id then
        raise exception 'LOCKED_BULLETIN: kilitli macin kimligi degistirilemez (% / %)', old.bulletin_id, old.match_id
          using errcode = 'P0001';
      end if;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists trg_matches_lock_ins on public.bulletin_matches;
create trigger trg_matches_lock_ins
  before insert on public.bulletin_matches
  for each row execute function public.forbid_locked_match_identity_change();

drop trigger if exists trg_matches_lock_upd on public.bulletin_matches;
create trigger trg_matches_lock_upd
  before update on public.bulletin_matches
  for each row execute function public.forbid_locked_match_identity_change();

drop trigger if exists trg_matches_lock_del on public.bulletin_matches;
create trigger trg_matches_lock_del
  before delete on public.bulletin_matches
  for each row execute function public.forbid_locked_match_identity_change();

-- 3) Kilitli bültende zaman/kimlik alanları sessizce değiştirilemez.
create or replace function public.forbid_locked_bulletin_identity_change()
returns trigger language plpgsql as $$
begin
  if old.status in ('locked','completed') then
    if new.round_id is distinct from old.round_id
      or new.first_match_start_at is distinct from old.first_match_start_at
      or new.freeze_at is distinct from old.freeze_at
      or new.locked_at is distinct from old.locked_at then
      raise exception 'LOCKED_BULLETIN: kilitli bultenin kimlik/zaman alanlari degistirilemez (%)', old.id
        using errcode = 'P0001';
    end if;
    -- Kilit sonrası geriye dönüş yok: locked -> draft/active yasak.
    if old.status = 'locked' and new.status in ('draft','active') then
      raise exception 'LOCKED_BULLETIN: kilitli bulten geri acilamaz (%)', old.id using errcode = 'P0001';
    end if;
    if old.status = 'completed' and new.status <> 'completed' then
      raise exception 'LOCKED_BULLETIN: tamamlanmis bulten durumu degistirilemez (%)', old.id using errcode = 'P0001';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_bulletins_lock on public.bulletins;
create trigger trg_bulletins_lock
  before update on public.bulletins
  for each row execute function public.forbid_locked_bulletin_identity_change();

-- 4) Audit log append-only.
create or replace function public.forbid_audit_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'AUDIT_APPEND_ONLY: denetim kaydi degistirilemez/silinemez' using errcode = 'P0001';
end $$;

drop trigger if exists trg_audit_no_update on public.snapshot_audit_log;
create trigger trg_audit_no_update
  before update on public.snapshot_audit_log
  for each row execute function public.forbid_audit_mutation();

drop trigger if exists trg_audit_no_delete on public.snapshot_audit_log;
create trigger trg_audit_no_delete
  before delete on public.snapshot_audit_log
  for each row execute function public.forbid_audit_mutation();

-- 5) Değerlendirme yalnız 1/X/2 içerebilir — summary/matches içine ilk yarı
--    skoru yazılmasını şema seviyesinde engellemek JSONB'de pratik değildir;
--    bu kural servis katmanı + testlerle korunur (halfTimeScore alanı hiç üretilmez).

-- ============================================================================
-- RLS — bu tablolar yalnız backend'in service-role anahtarıyla kullanılmalı.
-- RLS açık + policy YOK => anon/publishable anahtarlar hiçbir satır göremez/yazamaz;
-- service role RLS'i zaten atlar. (Frontend'e Supabase anahtarı sızmaz.)
-- ============================================================================
alter table public.bulletins                 enable row level security;
alter table public.bulletin_matches          enable row level security;
alter table public.bulletin_data_observations enable row level security;
alter table public.bulletin_snapshots        enable row level security;
alter table public.match_official_results    enable row level security;
alter table public.snapshot_evaluations      enable row level security;
alter table public.snapshot_audit_log        enable row level security;

commit;
