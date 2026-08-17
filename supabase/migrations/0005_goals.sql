-- ═══════════════════════════════════════════════════════════════════════════
-- 0005 — Objectifs
--
-- Le pari central du produit : un objectif mesurable peut être alimenté
-- automatiquement par les logs de ses habitudes liées (`source`). Sans la table
-- de liaison, Goals et Habits ne seraient que deux listes côte à côte.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  category public.habit_category not null default 'other',
  scope public.goal_scope not null default 'monthly',
  priority smallint not null default 2,
  target_value numeric(14, 3),
  -- Ignoré lorsque `source <> 'manual'` : la valeur est alors dérivée des logs.
  current_value numeric(14, 3) not null default 0,
  source public.goal_source not null default 'manual',
  unit text,
  start_date date not null,
  due_date date,
  status public.goal_status not null default 'not_started',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint goals_title_present check (char_length(trim(title)) > 0),
  constraint goals_title_length check (char_length(title) <= 160),
  constraint goals_priority_range check (priority between 1 and 3),
  constraint goals_window_ordered check (due_date is null or due_date >= start_date),
  constraint goals_target_positive check (target_value is null or target_value > 0),
  constraint goals_current_not_negative check (current_value >= 0),
  -- Un objectif dérivé sans cible ne pourrait afficher aucune progression.
  constraint goals_derived_needs_target
    check (source = 'manual' or target_value is not null),

  constraint goals_id_user_unique unique (id, user_id)
);

create index goals_user_scope_idx on public.goals (user_id, scope, due_date);

create trigger goals_touch
  before update on public.goals
  for each row execute function public.touch_updated_at();

-- ── Liaison objectif ↔ habitudes ────────────────────────────────────────────

create table public.goal_habits (
  goal_id uuid not null,
  habit_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),

  primary key (goal_id, habit_id),

  -- Les deux clés composites garantissent qu'on ne peut pas relier l'objectif
  -- d'une personne à l'habitude d'une autre.
  constraint goal_habits_goal_fk
    foreign key (goal_id, user_id)
    references public.goals (id, user_id) on delete cascade,
  constraint goal_habits_habit_fk
    foreign key (habit_id, user_id)
    references public.habits (id, user_id) on delete cascade
);

create index goal_habits_habit_idx on public.goal_habits (habit_id);

alter table public.goals enable row level security;
alter table public.goal_habits enable row level security;

create policy goals_own
  on public.goals for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy goal_habits_own
  on public.goal_habits for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
