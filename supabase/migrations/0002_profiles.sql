-- ═══════════════════════════════════════════════════════════════════════════
-- 0002 — Profils
--
-- Un profil par compte. `timezone` est la donnée la plus structurante de tout
-- le schéma : c'est elle qui décide à quel jour local appartient une habitude
-- cochée à 23h (CLAUDE.md §5.1).
-- ═══════════════════════════════════════════════════════════════════════════

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  timezone text not null default 'UTC',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_display_name_length check (char_length(display_name) <= 80),
  -- Rejette un fuseau inconnu à l'écriture plutôt que de fausser silencieusement
  -- toutes les dates locales de l'utilisateur.
  constraint profiles_timezone_valid check (now() at time zone timezone is not null)
);

create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;

create policy profiles_select_own
  on public.profiles for select
  using (id = auth.uid());

create policy profiles_insert_own
  on public.profiles for insert
  with check (id = auth.uid());

create policy profiles_update_own
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Pas de policy de suppression : un profil disparaît avec son compte auth.

-- Crée le profil à l'inscription. Sans ça, chaque écran devrait gérer le cas
-- « utilisateur authentifié mais sans profil ».
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
