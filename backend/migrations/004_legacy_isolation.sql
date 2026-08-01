-- 004 — LEGACY İZOLASYONU (transaction-güvenli sürüm)
-- ---------------------------------------------------------------------------
-- YENİ BAŞLANGIÇ KARARI: Radar ve bütün resmî karneler sıfır veriden başlar.
-- legacy_backfill / retrospective_backtest / demo / unknown / late_unverified
-- kayıtlar hiçbir resmî karne sorgusuna girmez. HİÇBİR KAYIT SİLİNMEZ; payload,
-- hash ve zaman alanlarına DOKUNULMAZ.
--
-- Bu dosyada bulletin_snapshots üzerinde BİR adet metadata UPDATE'i vardır
-- (003 sonrası eklenmiş ama provenance'ı boş kalmış satırlar için default-deny
-- sınıflandırma). 001'deki değişmezlik trigger'ı (trg_snapshot_no_update) bu
-- UPDATE'i de engelleyeceğinden, 003 ile AYNI dar kapsamlı ve transaction-
-- güvenli kalıp uygulanır: yalnız update trigger'ı, yalnız bu transaction
-- içinde kapatılır; DELETE trigger'ına dokunulmaz; hata hâlinde rollback
-- trigger'ı otomatik etkin bırakır. View/index bölümleri trigger gerektirmez.
--
-- IDEMPOTENT: ikinci kez çalıştırmak güvenlidir.
-- Çalıştırma: 003 başarıyla tamamlandıktan SONRA, Supabase SQL Editor'da
--             dosyanın TAMAMINI yapıştır → Run.

BEGIN;

-- 1) DEĞİŞMEZLİK UPDATE TRIGGER'INI GEÇİCİ KAPAT (yalnız bu transaction) -----
ALTER TABLE public.bulletin_snapshots DISABLE TRIGGER trg_snapshot_no_update;

-- 2) SINIFLANDIRILMAMIŞ ESKİ KAYITLAR → default-deny --------------------------
-- (003'ü atlayıp eklenmiş ya da sonradan oluşmuş provenance'sız satırlar.)
UPDATE public.bulletin_snapshots s
SET provenance_type = CASE
      WHEN s.late IS TRUE THEN 'late_unverified'
      ELSE 'unknown'
    END,
    is_official_forward = false,
    exclusion_reason = COALESCE(s.exclusion_reason,
      CASE WHEN s.late IS TRUE THEN 'late_lock' ELSE 'unclassified_default_deny' END)
WHERE s.provenance_type IS NULL;

-- 3) TRIGGER'I AYNI TRANSACTION İÇİNDE YENİDEN ETKİNLEŞTİR -------------------
ALTER TABLE public.bulletin_snapshots ENABLE TRIGGER trg_snapshot_no_update;

-- 4) RESMÎ GÖRÜNÜMÜ SIKILAŞTIR ----------------------------------------------
-- Yalnız TAM kanıtlı official_forward satırlar döner; bütün legacy türleri
-- açıkça dışarıda. Karne sorguları YALNIZ bu görünümü kullanmalıdır.
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
  AND s.payload_hash IS NOT NULL
  AND s.locked_at IS NOT NULL
  AND b.first_match_start_at IS NOT NULL
  AND s.locked_at <= b.first_match_start_at
  AND s.data_observed_at IS NOT NULL
  AND s.data_observed_at <= s.locked_at
  AND s.data_observed_at <= b.first_match_start_at
  AND b.freeze_at IS NOT NULL
  AND s.provenance_type NOT IN ('legacy_backfill','retrospective_backtest','demo','unknown','late_unverified');

-- 5) LEGACY KAYIT GÖRÜNÜMÜ (yalnız teknik/denetim amaçlı; API'ye açılmaz) ----
CREATE OR REPLACE VIEW public.legacy_excluded_snapshots AS
SELECT s.id, s.bulletin_id, b.round_id, s.provenance_type, s.exclusion_reason,
       s.backfilled, s.is_demo, s.late, s.created_at, s.locked_at
FROM public.bulletin_snapshots s
JOIN public.bulletins b ON b.id = s.bulletin_id
WHERE s.is_official_forward IS DISTINCT FROM TRUE;

-- 6) İNDEKS (izolasyon sorguları) -------------------------------------------
CREATE INDEX IF NOT EXISTS idx_snapshots_official_only
  ON public.bulletin_snapshots (is_official_forward)
  WHERE is_official_forward IS TRUE;

COMMIT;

-- DOĞRULAMA (salt-okunur):
--   SELECT tgname, tgenabled FROM pg_trigger
--   WHERE tgrelid = 'public.bulletin_snapshots'::regclass
--     AND tgname IN ('trg_snapshot_no_update','trg_snapshot_no_delete');
--   → her ikisi de tgenabled = 'O' (etkin) olmalıdır.
