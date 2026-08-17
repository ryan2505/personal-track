-- ═══════════════════════════════════════════════════════════════════════════
-- 0009 — Vue couple
--
-- LA frontière de confidentialité du produit (CLAUDE.md §7 niveau 3).
--
-- Principe : aucune ligne brute ne traverse jamais la frontière entre deux
-- comptes. Cette fonction lit les données en interne, applique les
-- `sharing_settings` du partenaire, et ne renvoie que des scalaires agrégés.
-- Un champ non partagé sort à `null` — il n'est pas filtré côté client.
--
-- C'est pour ça qu'aucune policy de partage n'existe sur `habit_logs` :
-- l'exposition est une liste blanche explicite, tenue à un seul endroit,
-- auditable en une lecture.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.get_couple_overview(p_couple_id uuid)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  is_self boolean,
  daily_score numeric,
  current_streak int,
  longest_streak int,
  week_consistency numeric,
  month_consistency numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'authentification requise';
  end if;

  -- Le contrôle d'appartenance est fait ici, une fois, avant toute lecture.
  if not exists (
    select 1
      from public.couple_members m
     where m.couple_id = p_couple_id
       and m.user_id = v_caller
       and m.status = 'active'
  ) then
    raise exception 'accès refusé à cet espace couple';
  end if;

  return query
  with members as (
    select m.user_id as uid,
           p.display_name,
           p.avatar_url,
           p.timezone,
           (m.user_id = v_caller) as self
      from public.couple_members m
      join public.profiles p on p.id = m.user_id
     where m.couple_id = p_couple_id
       and m.status = 'active'
  ),
  computed as (
    select mem.uid,
           mem.display_name,
           mem.avatar_url,
           mem.self,
           coalesce(s.share_daily_score, false) as ok_daily,
           coalesce(s.share_streak, false) as ok_streak,
           coalesce(s.share_weekly_consistency, false) as ok_week,
           coalesce(s.share_monthly_consistency, false) as ok_month,
           -- Chaque membre est évalué dans SON fuseau : comparer le score de
           -- Douala au « aujourd'hui » de Paris n'aurait aucun sens.
           (now() at time zone mem.timezone)::date as local_today
      from members mem
      left join public.sharing_settings s
        on s.couple_id = p_couple_id and s.user_id = mem.uid
  )
  select c.uid,
         c.display_name,
         c.avatar_url,
         c.self,
         case when c.self or c.ok_daily
              then public.daily_score(c.uid, c.local_today) end,
         case when c.self or c.ok_streak
              then (select st.current_streak from public.streaks(c.uid, c.local_today) st) end,
         case when c.self or c.ok_streak
              then (select st.longest_streak from public.streaks(c.uid, c.local_today) st) end,
         case when c.self or c.ok_week
              then public.consistency(
                     c.uid,
                     date_trunc('week', c.local_today)::date,
                     (date_trunc('week', c.local_today) + interval '6 days')::date
                   ) end,
         case when c.self or c.ok_month
              then public.consistency(
                     c.uid,
                     date_trunc('month', c.local_today)::date,
                     (date_trunc('month', c.local_today) + interval '1 month - 1 day')::date
                   ) end
    from computed c
   order by c.self desc, c.display_name;
end;
$$;

-- Progression des objectifs partagés, avec le détail par personne.
-- Pas de classement : le but est l'encouragement, pas la compétition (§19).
create or replace function public.get_shared_goal_progress(p_couple_id uuid)
returns table (
  goal_id uuid,
  title text,
  target_value numeric,
  unit text,
  due_date date,
  status public.goal_status,
  total numeric,
  ratio numeric,
  contributions jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'authentification requise';
  end if;

  if not exists (
    select 1
      from public.couple_members m
     where m.couple_id = p_couple_id
       and m.user_id = v_caller
       and m.status = 'active'
  ) then
    raise exception 'accès refusé à cet espace couple';
  end if;

  return query
  select g.id,
         g.title,
         g.target_value,
         g.unit,
         g.due_date,
         g.status,
         coalesce(sum(c.value), 0) as total,
         least(coalesce(sum(c.value), 0) / g.target_value, 1) as ratio,
         coalesce(
           jsonb_object_agg(p.display_name, c.per_user) filter (where p.id is not null),
           '{}'::jsonb
         ) as contributions
    from public.shared_goals g
    left join lateral (
      select sgc.user_id, sum(sgc.value) as per_user, sum(sgc.value) as value
        from public.shared_goal_contributions sgc
       where sgc.shared_goal_id = g.id
       group by sgc.user_id
    ) c on true
    left join public.profiles p on p.id = c.user_id
   where g.couple_id = p_couple_id
   group by g.id, g.title, g.target_value, g.unit, g.due_date, g.status
   order by g.due_date nulls last, g.title;
end;
$$;

revoke all on function public.get_couple_overview(uuid) from public;
revoke all on function public.get_shared_goal_progress(uuid) from public;

grant execute on function public.get_couple_overview(uuid) to authenticated;
grant execute on function public.get_shared_goal_progress(uuid) to authenticated;
