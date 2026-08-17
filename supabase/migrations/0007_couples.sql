-- ═══════════════════════════════════════════════════════════════════════════
-- 0007 — Espace couple
--
-- ⚠️ Aucune policy de ce fichier n'ouvre l'accès aux tables privées. Le partage
-- entre membres passe exclusivement par la fonction `get_couple_overview`
-- (0009), qui ne renvoie que des scalaires agrégés.
--
-- L'erreur qu'on refuse de commettre (CLAUDE.md §7) : une policy sur
-- `habit_logs` du type « visible si le partenaire a activé le partage ».
-- N'importe quelle jointure un peu créative exposerait alors les notes intimes
-- de l'autre.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  name text,
  -- Code d'invitation à usage unique, consommé à l'acceptation.
  invite_code text unique,
  invite_expires_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.couple_members (
  couple_id uuid not null references public.couples (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.couple_member_status not null default 'invited',
  joined_at timestamptz,
  created_at timestamptz not null default now(),

  primary key (couple_id, user_id)
);

create index couple_members_user_idx on public.couple_members (user_id, status);

-- ── Réglages de partage ─────────────────────────────────────────────────────

create table public.sharing_settings (
  couple_id uuid not null references public.couples (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,

  -- Tout à false par défaut. On ouvre, on n'ouvre pas par défaut (§7).
  share_daily_score boolean not null default false,
  share_streak boolean not null default false,
  share_weekly_consistency boolean not null default false,
  share_monthly_consistency boolean not null default false,
  share_categories boolean not null default false,
  share_vision_board boolean not null default false,
  -- Liste blanche explicite : jamais « tous les objectifs sauf… ».
  shared_goal_ids uuid[] not null default '{}',

  updated_at timestamptz not null default now(),

  primary key (couple_id, user_id)
);

create trigger sharing_settings_touch
  before update on public.sharing_settings
  for each row execute function public.touch_updated_at();

-- ── Objectifs partagés ──────────────────────────────────────────────────────

create table public.shared_goals (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  title text not null,
  description text,
  target_value numeric(14, 3) not null,
  unit text,
  start_date date not null,
  due_date date,
  status public.goal_status not null default 'not_started',
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint shared_goals_title_present check (char_length(trim(title)) > 0),
  constraint shared_goals_target_positive check (target_value > 0),
  constraint shared_goals_window_ordered check (due_date is null or due_date >= start_date)
);

create index shared_goals_couple_idx on public.shared_goals (couple_id, due_date);

create trigger shared_goals_touch
  before update on public.shared_goals
  for each row execute function public.touch_updated_at();

create table public.shared_goal_contributions (
  id uuid primary key default gen_random_uuid(),
  shared_goal_id uuid not null references public.shared_goals (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  value numeric(14, 3) not null default 1,
  local_date date not null,
  note text,
  created_at timestamptz not null default now(),

  constraint shared_goal_contributions_value_positive check (value > 0)
);

create index shared_goal_contributions_goal_idx
  on public.shared_goal_contributions (shared_goal_id);

-- ── Appartenance ────────────────────────────────────────────────────────────

-- `security definer` + `stable` : sans ça, la policy de `couple_members`
-- s'interrogerait elle-même et provoquerait une récursion infinie.
create or replace function public.is_couple_member(p_couple_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
      from public.couple_members m
     where m.couple_id = p_couple_id
       and m.user_id = auth.uid()
       and m.status = 'active'
  );
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.sharing_settings enable row level security;
alter table public.shared_goals enable row level security;
alter table public.shared_goal_contributions enable row level security;

create policy couples_visible_to_members
  on public.couples for select
  using (created_by = auth.uid() or public.is_couple_member(id));

create policy couples_insert_own
  on public.couples for insert
  with check (created_by = auth.uid());

create policy couples_update_by_creator
  on public.couples for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- Chacun voit les membres de ses couples, mais ne modifie que sa propre ligne :
-- personne ne peut s'ajouter chez quelqu'un d'autre ni exclure l'autre.
create policy couple_members_visible
  on public.couple_members for select
  using (user_id = auth.uid() or public.is_couple_member(couple_id));

create policy couple_members_manage_self
  on public.couple_members for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy couple_members_leave_self
  on public.couple_members for delete
  using (user_id = auth.uid());

-- Les réglages de partage d'une personne ne sont lisibles que par elle. Le
-- partenaire n'a pas à savoir ce qui lui est caché.
create policy sharing_settings_own
  on public.sharing_settings for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy shared_goals_members
  on public.shared_goals for all
  using (public.is_couple_member(couple_id))
  with check (public.is_couple_member(couple_id));

create policy shared_goal_contributions_visible
  on public.shared_goal_contributions for select
  using (
    exists (
      select 1
        from public.shared_goals g
       where g.id = shared_goal_id
         and public.is_couple_member(g.couple_id)
    )
  );

-- Chacun n'écrit que ses propres contributions, mais voit le total.
create policy shared_goal_contributions_write_own
  on public.shared_goal_contributions for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
        from public.shared_goals g
       where g.id = shared_goal_id
         and public.is_couple_member(g.couple_id)
    )
  );

create policy shared_goal_contributions_delete_own
  on public.shared_goal_contributions for delete
  using (user_id = auth.uid());
