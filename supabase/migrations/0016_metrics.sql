-- ═══════════════════════════════════════════════════════════════════════════
-- 0016 — Métriques mensuelles, liaison aux objectifs, revue mensuelle
--
-- ⚠️ Schéma CIBLE, pas encore le chemin d'exécution.
--
-- Comme les tables de 0003 à 0006, celles-ci ne sont lues par aucun code
-- applicatif aujourd'hui : l'application écrit son état comme un tout dans
-- `user_state` (voir 0012 et CLAUDE.md §0). Elles sont écrites maintenant pour
-- que le modèle relationnel reste la référence du domaine, et que la migration
-- écran par écran n'ait pas à réinventer la forme des données.
--
-- **Rejouable** — voir l'en-tête de 0015.
--
-- Deux règles de non-duplication portées par le schéma lui-même :
--   · aucune colonne ne stocke un chiffre dérivable des `habit_logs` ;
--   · un objectif dérivé ne stocke pas sa valeur, il pointe vers sa source.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  kind public.metric_kind not null,
  category public.habit_category not null default 'other',
  -- Regroupement libre à l'intérieur d'un domaine — « YouTube », « Coaching ».
  -- Un projet n'est pas un domaine de vie : les domaines restent l'enum partagé
  -- par la vision, les objectifs et les habitudes.
  "group" text,
  unit text,
  value_type public.metric_value_type not null default 'count',
  direction public.metric_direction not null default 'increase',
  -- Pondération dans le score de sa couche. 1 = normal. Même échelle que `habits`.
  weight smallint not null default 1,
  -- Arrêter = borner. Jamais de DELETE : les mois déjà chiffrés gardent leurs
  -- lignes, leur score ne doit pas changer rétroactivement (§5.3).
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint metrics_name_present check (char_length(trim(name)) > 0),
  constraint metrics_name_length check (char_length(name) <= 120),
  constraint metrics_weight_range check (weight between 1 and 10),

  constraint metrics_id_user_unique unique (id, user_id)
);

create index if not exists metrics_user_kind_idx
  on public.metrics (user_id, kind)
  where archived_at is null;

drop trigger if exists metrics_touch on public.metrics;
create trigger metrics_touch
  before update on public.metrics
  for each row execute function public.touch_updated_at();

-- ── Valeurs mensuelles ──────────────────────────────────────────────────────
--
-- L'existence de la ligne met la métrique au contrat du mois : un mois ne
-- contient que les métriques pour lesquelles une entrée a été posée. Démarrer
-- un nouveau mois, c'est choisir lesquelles on reconduit.

create table if not exists public.metric_entries (
  metric_id uuid not null,
  user_id uuid not null,
  -- La période, ramenée à son premier jour. Une DATE et non un `text 'YYYY-MM'` :
  -- la base sait alors ordonner, borner et indexer les périodes. La contrainte
  -- de forme est posée en 0017, qui ouvre la cadence hebdomadaire.
  period_start date not null,

  -- `null` = suivi sans cible (un CTR qu'on observe) : affiché, jamais scoré.
  target numeric(16, 3),
  -- `null` = pas encore saisi. À ne JAMAIS confondre avec 0 : « je ne sais pas »
  -- n'est pas « j'ai fait zéro », et seul le second entre dans un score.
  actual numeric(16, 3),
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (metric_id, period_start),

  constraint metric_entries_period_is_month
    check (period_start = date_trunc('month', period_start)::date),

  -- La clé composite interdit de rattacher l'entrée d'une personne à la
  -- métrique d'une autre — même garde-fou que `goal_habits` en 0005.
  constraint metric_entries_metric_fk
    foreign key (metric_id, user_id)
    references public.metrics (id, user_id) on delete cascade
);

create index if not exists metric_entries_user_period_idx
  on public.metric_entries (user_id, period_start);

drop trigger if exists metric_entries_touch on public.metric_entries;
create trigger metric_entries_touch
  before update on public.metric_entries
  for each row execute function public.touch_updated_at();

-- ── Objectifs alimentés par une métrique ────────────────────────────────────

alter table public.goals
  add column if not exists metric_id uuid;

alter table public.goals
  drop constraint if exists goals_metric_fk;
alter table public.goals
  add constraint goals_metric_fk
  foreign key (metric_id, user_id)
  references public.metrics (id, user_id) on delete set null;

-- Un objectif `metric` sans métrique n'aurait aucune source ; un objectif d'une
-- autre source qui en désigne une afficherait deux vérités concurrentes.
alter table public.goals
  drop constraint if exists goals_metric_matches_source;
alter table public.goals
  add constraint goals_metric_matches_source
  check (
    (source = 'metric' and metric_id is not null)
    or (source <> 'metric' and metric_id is null)
  );

create index if not exists goals_metric_idx
  on public.goals (metric_id)
  where metric_id is not null;

-- ── Revue : la question manquante ───────────────────────────────────────────

alter table public.reviews
  add column if not exists distractions text;

comment on column public.reviews.distractions is
  '« Qu''est-ce qui t''a distrait ? » — ce qui a mangé du temps sans rien produire.';

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Tables privées : une seule policy, sans exception (CLAUDE.md §7 niveau 1).
-- Aucune condition de partage ici, jamais.

alter table public.metrics enable row level security;
alter table public.metric_entries enable row level security;

drop policy if exists metrics_own on public.metrics;
create policy metrics_own
  on public.metrics for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists metric_entries_own on public.metric_entries;
create policy metric_entries_own
  on public.metric_entries for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
