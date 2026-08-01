-- ============================================================================
-- 005 — RESMÎ GEÇMİŞ BÜLTEN HAFIZASI + OYNANMA YÜZDESİ GÖZLEM SEMANTİĞİ
-- ============================================================================
-- AMAÇ
--  A) sportoto.gov.tr resmî geçmiş bülten arşivi için AYRI provenance'lı
--     tablolar (provenance_type = 'official_result_history').
--     * bulletin_snapshots'a DOKUNMAZ — kilitli snapshot payload/hash'leri
--       değişmez; 001'deki immutability trigger'ları aynen yürürlükte kalır.
--     * Geçmişe tahmin/radar/kriter sinyali YAZILMAZ; bu tablolar yalnız
--       resmî 90 dakika 1/X/2 sonucunu saklar (ilk yarı skoru YOK).
--  B) bulletin_data_observations tablosuna oynanma yüzdesi gözlem semantiği:
--     kind ('opening'|'regular'|'pre_freeze'|'post_lock_research'),
--     usable_for_prediction, first_observed_late.
--
-- GÜVENCELER
--  * Idempotent: IF NOT EXISTS / ADD COLUMN IF NOT EXISTS — tekrar çalışabilir.
--  * Hiçbir DELETE / DROP / TRUNCATE yok; hiçbir mevcut satır değişmez.
--  * 001-004'ün immutability/provenance kurallarına dokunulmaz.
--  * RLS: tüm yeni tablolarda AÇIK + policy YOK ⇒ anon anahtarlar hiçbir satırı
--    göremez/yazamaz; yalnız service-role (backend) erişir (001 ile aynı model).
--  * Tüm zaman kolonları UTC (timestamptz); ekran çevirisi frontend'te.
--
-- ÇALIŞTIRMA: Supabase SQL Editor'da bu dosyayı tek parça çalıştır
-- (BEGIN/COMMIT dahil). Hata olursa hiçbir parça uygulanmaz.
-- ============================================================================

\set ON_ERROR_STOP on

begin;

-- ----------------------------------------------------------------------------
-- A1) GEÇMİŞ BÜLTEN HAFTALARI — resmî arşivden içe alınan her hafta bir satır.
-- ----------------------------------------------------------------------------
create table if not exists public.sportoto_history_rounds (
  round_id            text primary key,              -- resmî gameRoundId (metin: kaynak kimliği aynen)
  season_year         text,                          -- resmî sezon etiketi (ör. '2023-2024')
  week_name           text,                          -- resmî hafta adı (ör. '1478. Hafta')
  status              text not null default 'pending',-- pending | completed | result_conflict
  round_close_at      timestamptz,                   -- haftanın kapanışı (öğrenme sınırı çapası, UTC)
  match_count         integer,
  source_url          text,                          -- verinin alındığı resmî sayfa/uç
  source_type         text,                          -- 'sportoto-webapi' vb.
  source_hash         text,                          -- kaynak içerik özeti (düzeltme tespiti)
  fetched_at          timestamptz,                   -- kaynaktan çekilme anı (UTC)
  observed_at         timestamptz,                   -- sistemin gözlem anı (UTC)
  provenance_type     text not null default 'official_result_history',
  correction_version  integer not null default 1,    -- kaynak düzeltmesi geldiğinde artar
  created_at          timestamptz not null default now(),
  -- Bu tablo YALNIZ resmî geçmiş arşivi taşır — başka provenance yazılamaz.
  constraint sportoto_history_rounds_prov_ck
    check (provenance_type = 'official_result_history')
);

-- ----------------------------------------------------------------------------
-- A2) GEÇMİŞ BÜLTEN MAÇLARI — hafta × sıra (1-15) tekil; idempotent upsert hedefi.
-- ----------------------------------------------------------------------------
create table if not exists public.sportoto_history_matches (
  round_id            text not null references public.sportoto_history_rounds(round_id),
  position            integer not null,              -- bülten sırası 1..15
  home_team           text,
  away_team           text,
  match_at            timestamptz,                   -- maç tarihi/saati (UTC)
  score_home          integer,                       -- resmî 90 dk skoru (ilk yarı YOK)
  score_away          integer,
  result              text,                          -- doğrulanmış 1|X|2 (0 → X normalize edilir)
  result_valid        boolean not null default false,-- skor↔sonuç tutarlılık kontrolünden geçti mi
  conflict            text,                          -- result_conflict | missing_score | missing_result | null
  source_hash         text,                          -- satır içerik özeti (düzeltme tespiti)
  observed_at         timestamptz,
  fetched_at          timestamptz,
  provenance_type     text not null default 'official_result_history',
  correction_version  integer not null default 1,
  created_at          timestamptz not null default now(),
  primary key (round_id, position),                  -- aynı sezon/hafta/sıra İKİNCİ KEZ eklenemez
  constraint sportoto_history_matches_pos_ck  check (position between 1 and 15),
  constraint sportoto_history_matches_res_ck  check (result is null or result in ('1','X','2')),
  constraint sportoto_history_matches_prov_ck check (provenance_type = 'official_result_history')
);

create index if not exists sportoto_history_matches_pos_idx
  on public.sportoto_history_matches (position);

-- ----------------------------------------------------------------------------
-- A3) DÜZELTME/İHTİLAF DENETİM İZİ — eski değer SESSİZCE ezilmez; iz bırakılır.
-- ----------------------------------------------------------------------------
create table if not exists public.sportoto_history_audit (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  round_id    text,
  position    integer,
  action      text not null,        -- imported | corrected | result_conflict
  field       text,
  old_value   jsonb,
  new_value   jsonb,
  source_url  text
);

create index if not exists sportoto_history_audit_round_idx
  on public.sportoto_history_audit (round_id, at);

-- ----------------------------------------------------------------------------
-- A4) İÇE AKTARIM CHECKPOINT'İ — kaldığı yerden devam (yeniden başlatmada
--     kaynağa aşırı yük binmez; işlenen haftalar tekrarlanmaz).
-- ----------------------------------------------------------------------------
create table if not exists public.sportoto_history_checkpoint (
  id          text primary key,     -- 'main'
  state       jsonb,                -- { doneRounds: [...], lastRunAt, ... }
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- B) OYNANMA YÜZDESİ GÖZLEM SEMANTİĞİ — mevcut gözlem tablosuna kolon ekleme.
--    (Yalnız EKLEME — mevcut satırlar/kolonlar değişmez; eski satırlarda null
--    kalır ve okuma katmanı raw içindeki değerlere geri düşer.)
-- ----------------------------------------------------------------------------
alter table public.bulletin_data_observations
  add column if not exists kind                  text,     -- opening|regular|pre_freeze|post_lock_research
  add column if not exists usable_for_prediction boolean,  -- MÜHÜR KURALI: false ⇒ tahmine/DNA kapanışına giremez
  add column if not exists first_observed_late   boolean;  -- dürüst açılış: geç başlayan takip işaretlenir

create index if not exists bulletin_data_observations_kind_idx
  on public.bulletin_data_observations (bulletin_id, kind);

-- ----------------------------------------------------------------------------
-- RLS — 001 ile aynı model: RLS AÇIK + policy YOK ⇒ yalnız service-role erişir.
-- ----------------------------------------------------------------------------
alter table public.sportoto_history_rounds     enable row level security;
alter table public.sportoto_history_matches    enable row level security;
alter table public.sportoto_history_audit      enable row level security;
alter table public.sportoto_history_checkpoint enable row level security;

commit;

-- ============================================================================
-- DOĞRULAMA (isteğe bağlı, migration sonrası elle çalıştırılabilir):
--   select count(*) from public.sportoto_history_rounds;
--   select column_name from information_schema.columns
--     where table_name = 'bulletin_data_observations'
--       and column_name in ('kind','usable_for_prediction','first_observed_late');
--   -- Kilitli snapshot'ların DEĞİŞMEDİĞİNİN kanıtı (001 trigger'ları):
--   update public.bulletin_snapshots set payload = payload where false; -- no-op
-- ============================================================================
