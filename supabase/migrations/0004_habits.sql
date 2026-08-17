-- ═══════════════════════════════════════════════════════════════════════════
-- 0004 — Habitudes, plannings datés, journal
--
-- Cœur du schéma. Trois invariants sont tenus par la base, pas par le client :
--   · un planning est daté et ne se chevauche jamais (§5.3, historique immuable)
--   · un jour est une DATE locale, jamais un instant (§5.1)
--   · un log appartient forcément au même utilisateur que son habitude
-- ═══════════════════════════════════════════════════════════════════════════

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  category public.habit_category not null default 'other',
  type public.habit_type not null default 'boolean',
  unit text,
  target_value numeric(12, 3),
  direction public.habit_direction not null default 'at_least',
  -- Pondération dans le score du jour. 1 = normal.
  weight smallint not null default 1,
  color text,
  icon text,
  start_date date not null,
  -- Archiver = borner la fenêtre. Jamais de DELETE : les jours déjà tenus
  -- doivent continuer de compter dans les statistiques passées.
  end_date date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint habits_title_present check (char_length(trim(title)) > 0),
  constraint habits_title_length check (char_length(title) <= 120),
  constraint habits_weight_range check (weight between 1 and 10),
  constraint habits_window_ordered check (end_date is null or end_date >= start_date),
  constraint habits_target_positive check (target_value is null or target_value > 0),
  -- Une habitude binaire n'a ni cible ni unité : sinon `completion` aurait deux
  -- définitions possibles pour la même ligne.
  constraint habits_boolean_has_no_target
    check (type <> 'boolean' or (target_value is null and unit is null)),
  -- « Ne pas dépasser » suppose une cible à ne pas dépasser.
  constraint habits_at_most_needs_target
    check (direction = 'at_least' or target_value is not null),

  -- Permet aux tables filles de référencer (id, user_id) et de garantir par
  -- clé étrangère qu'un log ne peut pas changer de propriétaire.
  constraint habits_id_user_unique unique (id, user_id)
);

create index habits_user_active_idx
  on public.habits (user_id)
  where archived_at is null;

create trigger habits_touch
  before update on public.habits
  for each row execute function public.touch_updated_at();

-- ── Plannings datés ─────────────────────────────────────────────────────────

create table public.habit_schedules (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null,
  user_id uuid not null,
  kind public.schedule_kind not null,
  -- 1 = lundi … 7 = dimanche (ISO).
  days_of_week smallint[],
  days_of_month smallint[],
  times_per_period smallint,
  effective_from date not null,
  -- `null` = version courante.
  effective_to date,
  created_at timestamptz not null default now(),

  constraint habit_schedules_habit_fk
    foreign key (habit_id, user_id)
    references public.habits (id, user_id) on delete cascade,

  constraint habit_schedules_window_ordered
    check (effective_to is null or effective_to >= effective_from),

  -- Cohérence stricte entre le type de planning et ses paramètres : aucune
  -- ligne ne peut décrire deux règles à la fois, ni aucune.
  constraint habit_schedules_shape check (
    case kind
      when 'daily' then
        days_of_week is null and days_of_month is null and times_per_period is null
      when 'days_of_week' then
        days_of_week is not null
        and array_length(days_of_week, 1) between 1 and 7
        and days_of_week <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
        and days_of_month is null and times_per_period is null
      when 'days_of_month' then
        days_of_month is not null
        and array_length(days_of_month, 1) between 1 and 31
        and days_of_month <@ array[
          1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,
          17,18,19,20,21,22,23,24,25,26,27,28,29,30,31
        ]::smallint[]
        and days_of_week is null and times_per_period is null
      when 'times_per_week' then
        times_per_period between 1 and 7
        and days_of_week is null and days_of_month is null
      when 'times_per_month' then
        times_per_period between 1 and 31
        and days_of_week is null and days_of_month is null
    end
  ),

  -- L'invariant central de §5.3 : à une date donnée, une habitude a au plus une
  -- règle. Modifier un planning ne peut donc pas réécrire le passé — il faut
  -- clore la version courante avant d'en ouvrir une nouvelle.
  constraint habit_schedules_no_overlap exclude using gist (
    habit_id with =,
    daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[]') with &&
  )
);

create index habit_schedules_lookup_idx
  on public.habit_schedules (habit_id, effective_from desc);

-- ── Journal ─────────────────────────────────────────────────────────────────

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null,
  user_id uuid not null,
  -- DATE locale de l'utilisateur, jamais un timestamptz (§5.1).
  local_date date not null,
  value numeric(12, 3),
  completed boolean not null default false,
  note text,
  -- Chemin dans le bucket Storage `evidence`. V1.1.
  evidence_path text,
  logged_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint habit_logs_habit_fk
    foreign key (habit_id, user_id)
    references public.habits (id, user_id) on delete cascade,

  -- Un seul enregistrement par habitude et par jour : c'est ce qui rend
  -- `completion` déterministe.
  constraint habit_logs_one_per_day unique (habit_id, local_date),
  constraint habit_logs_value_not_negative check (value is null or value >= 0),
  constraint habit_logs_note_length check (note is null or char_length(note) <= 2000)
);

create index habit_logs_user_date_idx on public.habit_logs (user_id, local_date);
create index habit_logs_habit_date_idx on public.habit_logs (habit_id, local_date);

create trigger habit_logs_touch
  before update on public.habit_logs
  for each row execute function public.touch_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table public.habits enable row level security;
alter table public.habit_schedules enable row level security;
alter table public.habit_logs enable row level security;

create policy habits_own
  on public.habits for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy habit_schedules_own
  on public.habit_schedules for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy habit_logs_own
  on public.habit_logs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
