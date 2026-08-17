-- ═══════════════════════════════════════════════════════════════════════════
-- 0003 — Vision
--
-- Le seul niveau de la boucle qui n'entre dans aucun score : une direction,
-- pas un résultat. Aucune fonction de calcul ne lit ces tables.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.vision_areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category public.habit_category not null,
  statement text not null default '',
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Un domaine de vie ne peut être défini qu'une fois par personne.
  constraint vision_areas_unique_category unique (user_id, category),
  constraint vision_areas_statement_length check (char_length(statement) <= 2000)
);

create index vision_areas_user_idx on public.vision_areas (user_id, position);

create trigger vision_areas_touch
  before update on public.vision_areas
  for each row execute function public.touch_updated_at();

create table public.vision_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.vision_item_kind not null,
  -- `null` = tuile non rattachée à un domaine de vie.
  category public.habit_category,
  -- Texte, citation, ou chemin dans le bucket Storage `vision`.
  -- Jamais une image encodée : le stockage binaire ne va pas dans Postgres.
  content text not null,
  caption text,
  author text,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint vision_items_content_present check (char_length(trim(content)) > 0),
  constraint vision_items_content_length check (char_length(content) <= 4000),
  -- Un auteur n'a de sens que sur une citation.
  constraint vision_items_author_only_on_quote check (author is null or kind = 'quote')
);

create index vision_items_user_idx on public.vision_items (user_id, position);

create trigger vision_items_touch
  before update on public.vision_items
  for each row execute function public.touch_updated_at();

alter table public.vision_areas enable row level security;
alter table public.vision_items enable row level security;

-- Tables privées : une seule policy, sans exception (CLAUDE.md §7 niveau 1).
create policy vision_areas_own
  on public.vision_areas for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy vision_items_own
  on public.vision_items for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
