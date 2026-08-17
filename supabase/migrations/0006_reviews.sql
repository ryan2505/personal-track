-- ═══════════════════════════════════════════════════════════════════════════
-- 0006 — Revues hebdomadaires et mensuelles
--
-- Une seule table pour les deux : mêmes champs de réflexion, seule la période
-- change. `period_start` est le lundi ISO (weekly) ou le 1er du mois (monthly),
-- ce qui rend une revue idempotente par période.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.review_kind not null,
  period_start date not null,
  period_end date not null,

  went_well text,
  went_poorly text,
  proud_of text,
  learned text,
  improve_next text,
  main_focus text,
  -- Réservé aux revues mensuelles.
  stop_doing text,
  start_doing text,
  continue_doing text,

  -- Chiffres figés au moment de la revue. Sans ce gel, relire une revue de mars
  -- afficherait les statistiques recalculées d'aujourd'hui, ce qui n'aurait
  -- aucun sens rétrospectif.
  metrics jsonb not null default '{}'::jsonb,

  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reviews_window_ordered check (period_end >= period_start),
  constraint reviews_one_per_period unique (user_id, kind, period_start),
  -- Les trois champs rétrospectifs n'ont de sens qu'à l'échelle du mois.
  constraint reviews_monthly_only_fields check (
    kind = 'monthly'
    or (stop_doing is null and start_doing is null and continue_doing is null)
  )
);

create index reviews_user_idx on public.reviews (user_id, kind, period_start desc);

create trigger reviews_touch
  before update on public.reviews
  for each row execute function public.touch_updated_at();

alter table public.reviews enable row level security;

create policy reviews_own
  on public.reviews for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
