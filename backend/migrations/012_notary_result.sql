-- 012 — NOTER KARARI: ertelenen/oynanmayan maçın resmî işareti (2026-08-10)
--
-- NEDEN: 53. Hafta 14. maç (Raków–Zagłębie) ertelendi. Sonuç sağlayıcıdan
-- ASLA gelmez (motor yalnız skorlu gerçek sonucu kabul eder) ve hafta sonsuza
-- dek 'locked' kalıyordu — kullanıcı "sonuçlar yansımamış" görüyordu.
-- Spor Toto böyle maçları noter kararıyla sonuçlandırır; bu göç o kaydın
-- şemadaki iki engelini kaldırır:
--
--  1) full_time_score NOT NULL idi. Noter maçında SKOR YOKTUR ve uydurulmaz
--     ("0-0" yazmak olmayan maçı oynanmış gibi gösterirdi) → kolon null'a
--     açılır. Normal akış (resultsService.ingestOfficialResults) skoru hâlâ
--     ZORUNLU tutar — gevşeme yalnız şemadadır, uygulama kuralı değişmez.
--
--  2) result_type kolonu yoktu. 'notary_decision' ayrı kimliktir: radar
--     karnesi bu maçı motor isabetine SAYMAZ (maç oynanmadı, tahmin
--     sınanamadı); kupon değerlendirmesi Spor Toto kuralı gereği işareti
--     sayar. NULL = normal (oynanmış) sonuç — geriye dönük kayıtlar aynen
--     geçerli kalır, veri göçü gerekmez.

alter table public.match_official_results
  alter column full_time_score drop not null;

alter table public.match_official_results
  add column if not exists result_type text;

comment on column public.match_official_results.result_type is
  'NULL = oynanmış maçın normal sonucu · notary_decision = ertelenen maçın noter kararı (skorsuz; radar karnesine sayılmaz).';
