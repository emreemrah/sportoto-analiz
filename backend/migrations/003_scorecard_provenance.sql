-- 003 — KARNE PROVENANCE / KAYNAK SINIFLANDIRMASI (transaction-güvenli sürüm)
-- ---------------------------------------------------------------------------
-- Amaç: her snapshot'ın KAYNAĞINI kalıcı olarak işaretlemek — resmî ileri-test
-- (official_forward) ile demo/backfill/retrospektif/geç kayıtları ayırmak.
-- KURAL: Kanıtlanamayan kayıt resmî sayılMAZ (default-deny). Bu migration eski
-- veriyi SİLMEZ; snapshot payload'ına, hash'lere, kilit/donma zamanlarına ve
-- tahmin içeriğine DOKUNMAZ — yalnız YENİ provenance metadata kolonlarını doldurur.
--
-- NEDEN TRANSACTION + DAR KAPSAMLI TRIGGER DISABLE?
--   001 migration'ı bulletin_snapshots üzerinde gerçek değişmezlik kurar:
--   trg_snapshot_no_update (BEFORE UPDATE) kilitli satırın HER güncellemesini
--   IMMUTABLE_SNAPSHOT hatasıyla engeller — provenance metadata'sı gibi yeni
--   kolonlar dahil. Bu yüzden sınıflandırma UPDATE'i, YALNIZ bu migration'ın
--   transaction'ı içinde, YALNIZ update trigger'ı geçici kapatılarak yapılır:
--     * trg_snapshot_no_delete (DELETE koruması) HİÇ kapatılmaz.
--     * session_replication_role KULLANILMAZ; toplu trigger kapatma YOKTUR.
--     * ALTER TABLE ... DISABLE TRIGGER transaction'a tabidir: aradaki herhangi
--       bir SQL hata verirse PostgreSQL tüm transaction'ı geri alır ve trigger
--       otomatik olarak ETKİN hâlde kalır (kalıcı açık kapı riski yoktur).
--     * COMMIT'ten önce trigger aynı transaction içinde yeniden etkinleştirilir.
--
-- IDEMPOTENT: temiz DB'de, kısmen çalışmış (kolonları oluşmuş) DB'de, kilitli
-- snapshot'lı DB'de ve ikinci kez çalıştırmada güvenlidir.
-- Çalıştırma: Supabase SQL Editor'da dosyanın TAMAMINI yapıştır → Run.
--             (psql: npm run migrate — ON_ERROR_STOP=1 ile ilk hatada durur.)

BEGIN;

-- 1) SNAPSHOT PROVENANCE KOLONLARI ------------------------------------------
-- (Yeni kolon eklemek satır trigger'ı tetiklemez; kısmi önceki denemelerde
--  oluşmuş kolonlar IF NOT EXISTS ile sorunsuz atlanır.)
ALTER TABLE IF EXISTS public.bulletin_snapshots
  ADD COLUMN IF NOT EXISTS provenance_type text
    CHECK (provenance_type IN ('official_forward','late_unverified','retrospective_backtest','legacy_backfill','demo','unknown')),
  ADD COLUMN IF NOT EXISTS is_official_forward boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS backfilled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exclusion_reason text,
  ADD COLUMN IF NOT EXISTS source_record_id text;

-- 2) DEĞİŞMEZLİK UPDATE TRIGGER'INI GEÇİCİ KAPAT (yalnız bu transaction) -----
-- 001'deki GERÇEK trigger adı: trg_snapshot_no_update (bulletin_snapshots).
-- DELETE trigger'ı (trg_snapshot_no_delete) ETKİN KALIR.
ALTER TABLE public.bulletin_snapshots DISABLE TRIGGER trg_snapshot_no_update;

-- 3) MEVCUT KAYITLARI SINIFLANDIR (yalnız provenance'ı boş olanlar) ----------
-- official_forward KANITI (uygulamadaki merkezî default-deny kuralının SQL eşi):
--   geç DEĞİL + hash + kilit zamanı + kilit ilk maçtan önce + veri gözlemi
--   kilitten ve ilk maçtan önce + freeze tanımlı + değişmez kayıt.
-- Kanıtı eksik HER kayıt 'unknown' kalır (varsayımla resmî yapılmaz).
-- Snapshot payload/hash/zaman alanları OKUNUR ama YAZILMAZ.
UPDATE public.bulletin_snapshots s
SET provenance_type = CASE
      WHEN s.late IS TRUE THEN 'late_unverified'
      WHEN s.immutable IS TRUE
        AND s.payload_hash IS NOT NULL
        AND s.locked_at IS NOT NULL
        AND b.first_match_start_at IS NOT NULL
        AND s.locked_at <= b.first_match_start_at
        AND s.data_observed_at IS NOT NULL
        AND s.data_observed_at <= s.locked_at
        AND s.data_observed_at <= b.first_match_start_at
        AND b.freeze_at IS NOT NULL
      THEN 'official_forward'
      ELSE 'unknown'
    END,
    is_official_forward = (
      s.late IS NOT TRUE
      AND s.immutable IS TRUE
      AND s.payload_hash IS NOT NULL
      AND s.locked_at IS NOT NULL
      AND b.first_match_start_at IS NOT NULL
      AND s.locked_at <= b.first_match_start_at
      AND s.data_observed_at IS NOT NULL
      AND s.data_observed_at <= s.locked_at
      AND s.data_observed_at <= b.first_match_start_at
      AND b.freeze_at IS NOT NULL
    ),
    exclusion_reason = CASE
      WHEN s.late IS TRUE THEN 'late_lock'
      WHEN s.immutable IS NOT TRUE THEN 'not_immutable'
      WHEN s.payload_hash IS NULL THEN 'no_verification_hash'
      WHEN s.locked_at IS NULL THEN 'no_lock_time'
      WHEN b.first_match_start_at IS NULL THEN 'no_first_match_time'
      WHEN s.locked_at > b.first_match_start_at THEN 'locked_after_first_match'
      WHEN s.data_observed_at IS NULL THEN 'no_observation_time'
      WHEN s.data_observed_at > s.locked_at THEN 'prediction_after_lock'
      WHEN s.data_observed_at > b.first_match_start_at THEN 'prediction_after_first_match'
      WHEN b.freeze_at IS NULL THEN 'no_freeze_time'
      ELSE NULL
    END,
    source_record_id = COALESCE(s.source_record_id, s.id::text)
FROM public.bulletins b
WHERE b.id = s.bulletin_id
  AND s.provenance_type IS NULL;

-- 4) TRIGGER'I AYNI TRANSACTION İÇİNDE YENİDEN ETKİNLEŞTİR -------------------
ALTER TABLE public.bulletin_snapshots ENABLE TRIGGER trg_snapshot_no_update;

-- 5) RESMÎ İLERİ-TEST GÖRÜNÜMÜ ----------------------------------------------
CREATE OR REPLACE VIEW public.official_forward_snapshots AS
SELECT s.*, b.round_id, b.week_name, b.season, b.freeze_at, b.first_match_start_at
FROM public.bulletin_snapshots s
JOIN public.bulletins b ON b.id = s.bulletin_id
WHERE s.is_official_forward IS TRUE
  AND s.provenance_type = 'official_forward'
  AND s.is_demo IS FALSE
  AND s.backfilled IS FALSE
  AND s.late IS FALSE
  AND s.immutable IS TRUE
  AND s.payload_hash IS NOT NULL;

-- 6) İNDEKS (karne taramaları) ----------------------------------------------
CREATE INDEX IF NOT EXISTS idx_snapshots_provenance
  ON public.bulletin_snapshots (provenance_type, is_official_forward);

COMMIT;

-- DOĞRULAMA (salt-okunur; migration sonrası elle çalıştırılabilir):
--   SELECT tgname, tgenabled FROM pg_trigger
--   WHERE tgrelid = 'public.bulletin_snapshots'::regclass
--     AND tgname IN ('trg_snapshot_no_update','trg_snapshot_no_delete');
--   → her ikisi de tgenabled = 'O' (etkin) olmalıdır.
