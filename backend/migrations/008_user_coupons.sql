-- 008 — KULLANICI KUPONLARI: dosya deposundan kalıcı veritabanına (T12).
--
-- NEDEN: Kuponlar backend/data/coupons.json içinde tutuluyordu; Render free
-- planında disk KALICI DEĞİLDİR — her yeniden dağıtımda kullanıcı kuponları
-- silinirdi. Kupon sözleşmesi kullanıcı başına TAM LİSTEDİR (kaynak app'tir,
-- PUT tüm listeyi değiştirir); bu yüzden şema da kullanıcı başına TEK satırdır:
-- ayrı kupon tablosu kurmak sözleşmeyi değiştirmeden hiçbir şey kazandırmaz.
--
-- Dosyadan tek seferlik içe aktarma kod tarafında yapılır (src/couponStore.js):
-- tabloda satırı OLMAYAN kullanıcılar dosyadan yüklenir, dosya .migrated olarak
-- yeniden adlandırılır (veri kaybı yok, çift kaynak yok).

create table if not exists public.user_coupons (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  coupons    jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.user_coupons is
  'Kullanıcının kupon listesi (tam liste sözleşmesi; kaynak uygulamadır). Hesap silinince cascade ile gider.';

-- RLS: erişim yalnız sunucunun service-role anahtarıyladır (ev stili —
-- politika tanımlanmaz; anon/authenticated rolleri tabloya hiç dokunamaz).
alter table public.user_coupons enable row level security;
