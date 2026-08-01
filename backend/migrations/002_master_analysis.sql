-- ============================================================================
-- 002_master_analysis.sql — MASTER ANALİZ MOTORU + KRİTER PROFİLLERİ + KARNE
-- İdempotenttir. Çalıştırma:
--   psql "$SUPABASE_DB_URL" -f backend/migrations/002_master_analysis.sql
-- Not: Kriter değerlendirmeleri (catalogEvaluations) ve resmî Master Analiz,
-- 001'deki bulletin_snapshots.snapshot_payload içine MÜHÜRLENİR (değişmezlik
-- trigger'ları oradadır). Bu migration profil/kullanıcı-analizi/backtest ve
-- referans tablolarını ekler.
-- ============================================================================

begin;

-- Metodoloji sürümleri (referans/denetim)
create table if not exists public.analysis_methodologies (
  version     text primary key,
  description text,
  created_at  timestamptz not null default now()
);
insert into public.analysis_methodologies (version, description)
  values ('master-analysis-1.0.0', 'Master Analiz motoru ilk sürüm: 40 kriter, aile tavanı, Manuel/Akıllı mod')
  on conflict (version) do nothing;

-- Kriter kataloğu sürümleri (referans/denetim)
create table if not exists public.criterion_catalog_versions (
  version     text primary key,
  criteria_count integer not null,
  keys        jsonb not null,
  created_at  timestamptz not null default now()
);

-- Kullanıcı analiz profilleri (payload: sürümler dahil TÜM profil gövdesi;
-- analysis_profile_versions payload.versions[] içinde append-only tutulur ve
-- trigger sürüm GERİLEMESİNİ engeller → eski sürüm ezilemez).
create table if not exists public.analysis_profiles (
  id              text not null,
  user_id         text not null,
  name            text not null,
  current_version integer not null default 1,
  is_default      boolean not null default false,
  payload         jsonb not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (user_id, id)
);

create or replace function public.forbid_profile_version_rollback()
returns trigger language plpgsql as $$
begin
  if new.current_version < old.current_version then
    raise exception 'PROFILE_VERSION_ROLLBACK: profil surumu geri alinamaz (%->%)', old.current_version, new.current_version
      using errcode = 'P0001';
  end if;
  if jsonb_array_length(coalesce(new.payload->'versions', '[]'::jsonb)) < jsonb_array_length(coalesce(old.payload->'versions', '[]'::jsonb)) then
    raise exception 'PROFILE_VERSIONS_APPEND_ONLY: eski profil surumleri silinemez' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_profiles_no_rollback on public.analysis_profiles;
create trigger trg_profiles_no_rollback
  before update on public.analysis_profiles
  for each row execute function public.forbid_profile_version_rollback();

-- Kullanıcı analiz kayıtları — bülten kilidiyle DONAR (update/delete yasak).
create table if not exists public.user_analysis_snapshots (
  bulletin_id text not null,
  user_id     text not null,
  locked      boolean not null default false,
  locked_at   timestamptz,
  payload     jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (bulletin_id, user_id)
);

create or replace function public.forbid_locked_user_analysis_mutation()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.locked then
      raise exception 'LOCKED_USER_ANALYSIS: kilitli kullanici analizi silinemez' using errcode = 'P0001';
    end if;
    return old;
  end if;
  if old.locked then
    -- Kilitliyken yalnız hiçbir alan değişmeden geçen no-op'a izin verilmez;
    -- her UPDATE reddedilir (kilit geri açılamaz, payload değiştirilemez).
    raise exception 'LOCKED_USER_ANALYSIS: kilitli kullanici analizi degistirilemez' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_user_analysis_no_update on public.user_analysis_snapshots;
create trigger trg_user_analysis_no_update
  before update on public.user_analysis_snapshots
  for each row execute function public.forbid_locked_user_analysis_mutation();

drop trigger if exists trg_user_analysis_no_delete on public.user_analysis_snapshots;
create trigger trg_user_analysis_no_delete
  before delete on public.user_analysis_snapshots
  for each row execute function public.forbid_locked_user_analysis_mutation();

-- Kriter karnesi önbelleği (merkezî hesap; kullanıcı başına hesaplanmaz)
create table if not exists public.criterion_scorecard_cache (
  cache_key    text primary key,           -- örn. 'all' | 'upTo-4200'
  generated_at timestamptz not null default now(),
  payload      jsonb not null
);

-- Zaman Makinesi koşuları — HER ZAMAN retrospektif etiketli; resmî başarıya eklenmez.
create table if not exists public.backtest_runs (
  run_id       text primary key,
  requested_at timestamptz not null default now(),
  status       text not null default 'completed',
  payload      jsonb not null
);

-- RLS: yalnız service-role erişir (frontend'e anahtar sızmaz).
alter table public.analysis_methodologies      enable row level security;
alter table public.criterion_catalog_versions  enable row level security;
alter table public.analysis_profiles           enable row level security;
alter table public.user_analysis_snapshots     enable row level security;
alter table public.criterion_scorecard_cache   enable row level security;
alter table public.backtest_runs               enable row level security;

commit;
