-- ═══════════════════════════════════════════════════════════════════════════
-- 0012 — État applicatif persisté côté serveur
--
-- Pont assumé vers le schéma normalisé.
--
-- Les tables de 0003 à 0006 restent la cible : ce sont elles que `get_couple_overview`
-- et le scoring SQL interrogent. Mais tant que l'application écrit son état
-- comme un tout (interface `Repository` : load/save d'un `AppState` entier),
-- synchroniser vers dix tables normalisées demanderait un moteur de diff dont
-- chaque bug se paierait en données perdues.
--
-- Ce document JSONB fait donc le lien : les données survivent au navigateur,
-- suivent le compte d'un appareil à l'autre, et restent protégées par la même
-- RLS stricte que le reste. La migration vers les tables normalisées se fera
-- écran par écran, sans nouvelle rupture pour l'utilisateur.
--
-- Conséquence à connaître : tant que les données vivent ici, l'espace couple
-- ne peut pas fonctionner — il agrège depuis les tables normalisées.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.user_state (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  state jsonb not null,
  -- Version de forme du document, miroir de STATE_VERSION côté TypeScript.
  version integer not null default 1,
  updated_at timestamptz not null default now(),

  -- Garde-fou : un document démesuré signale un bug client (images encodées
  -- entières, par exemple) et non un usage légitime. Les images doivent aller
  -- dans Storage, pas dans ce document.
  constraint user_state_size check (pg_column_size(state) < 2000000)
);

create trigger user_state_touch
  before update on public.user_state
  for each row execute function public.touch_updated_at();

alter table public.user_state enable row level security;

-- Table privée : une seule policy, sans exception (CLAUDE.md §7 niveau 1).
create policy user_state_own
  on public.user_state for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
