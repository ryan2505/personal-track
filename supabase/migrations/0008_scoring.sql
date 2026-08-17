-- ═══════════════════════════════════════════════════════════════════════════
-- 0008 — Scoring en SQL
--
-- ⚠️ DUPLICATION ASSUMÉE ET UNIQUE (CLAUDE.md §5.5).
-- Ces fonctions réimplémentent `src/lib/domain/{scheduling,scoring,streaks}.ts`.
-- Elles n'existent que parce que `get_couple_overview` (0009) doit calculer les
-- chiffres du partenaire côté serveur, sans jamais exposer ses lignes brutes.
-- Toute évolution d'une formule doit être portée des deux côtés le même jour.
--
-- SECURITY INVOKER (défaut) volontaire : la RLS s'applique donc normalement.
-- Appelées par un client sur l'identifiant de quelqu'un d'autre, elles ne
-- voient aucune ligne et renvoient null. Elles ne deviennent utiles sur les
-- données du partenaire qu'à l'intérieur de `get_couple_overview`, qui est
-- SECURITY DEFINER et applique explicitement les réglages de partage.
--
-- Performance : O(jours × habitudes). Assumé à cette échelle. Le jour où ça
-- coince, la réponse est une table `daily_scores` matérialisée, pas une
-- réécriture de ces formules.
-- ═══════════════════════════════════════════════════════════════════════════

-- Règle en vigueur pour une habitude à une date, ou aucune ligne hors fenêtre.
create or replace function public.schedule_on(p_habit_id uuid, p_date date)
returns public.habit_schedules
language sql
stable
as $$
  select s.*
    from public.habit_schedules s
    join public.habits h on h.id = s.habit_id
   where s.habit_id = p_habit_id
     and p_date >= h.start_date
     and (h.end_date is null or p_date <= h.end_date)
     and s.effective_from <= p_date
     and (s.effective_to is null or s.effective_to >= p_date)
   limit 1;
$$;

-- L'habitude est-elle attendue ce jour précis ?
-- Toujours faux pour un quota : « 3× par semaine » ne peut pas rater un lundi.
create or replace function public.is_scheduled_on(p_habit_id uuid, p_date date)
returns boolean
language plpgsql
stable
as $$
declare
  s public.habit_schedules;
  v_dow smallint;
  v_dom smallint;
  v_last_day smallint;
begin
  s := public.schedule_on(p_habit_id, p_date);
  if s.id is null then
    return false;
  end if;

  case s.kind
    when 'daily' then
      return true;

    when 'days_of_week' then
      v_dow := extract(isodow from p_date)::smallint;
      return v_dow = any (s.days_of_week);

    when 'days_of_month' then
      v_dom := extract(day from p_date)::smallint;
      v_last_day := extract(
        day from (date_trunc('month', p_date) + interval '1 month - 1 day')
      )::smallint;
      -- Un « 31 » demandé retombe sur le dernier jour des mois plus courts.
      return exists (
        select 1
          from unnest(s.days_of_month) as d
         where d = v_dom
            or (d > v_last_day and v_dom = v_last_day)
      );

    else
      return false;
  end case;
end;
$$;

-- Ratio d'accomplissement d'une occurrence. Toujours borné à [0, 1] : le
-- dépassement est conservé dans `value` et affiché, jamais scoré au-delà.
create or replace function public.habit_completion(p_habit_id uuid, p_date date)
returns numeric
language plpgsql
stable
as $$
declare
  h public.habits%rowtype;
  l public.habit_logs%rowtype;
  v numeric;
  t numeric;
begin
  select * into h from public.habits where id = p_habit_id;
  if not found then
    return 0;
  end if;

  select * into l
    from public.habit_logs
   where habit_id = p_habit_id and local_date = p_date;
  if not found then
    return 0;
  end if;

  if h.type = 'boolean' then
    return case when l.completed then 1 else 0 end;
  end if;

  v := coalesce(l.value, 0);
  t := h.target_value;

  if t is null or t <= 0 then
    -- Pas de cible exploitable : sémantique binaire.
    if h.direction = 'at_most' then
      return case when v <= 0 then 1 else 0 end;
    end if;
    return case when v > 0 then 1 else 0 end;
  end if;

  if h.direction = 'at_most' then
    if v <= t then
      return 1;
    end if;
    return greatest(0, 1 - (v - t) / t);
  end if;

  return least(v / t, 1);
end;
$$;

-- Score du jour : moyenne pondérée des habitudes à planning DATÉ.
-- `null` = jour neutre, aucune habitude attendue. Surtout pas 0.
create or replace function public.daily_score(p_user_id uuid, p_date date)
returns numeric
language sql
stable
as $$
  with expected as (
    select h.weight::numeric as w,
           public.habit_completion(h.id, p_date) as c
      from public.habits h
     where h.user_id = p_user_id
       and public.is_scheduled_on(h.id, p_date)
  )
  select case
           when coalesce(sum(w), 0) = 0 then null
           else sum(w * c) / sum(w)
         end
    from expected;
$$;

-- Consistance sur une période : Σ numérateurs / Σ dénominateurs.
-- Ce n'est PAS la moyenne des scores quotidiens (§5.4).
create or replace function public.consistency(p_user_id uuid, p_from date, p_to date)
returns numeric
language plpgsql
stable
as $$
declare
  v_num numeric := 0;
  v_den numeric := 0;
  r record;
  v_cursor date;
  v_limit date;
  v_full_start date;
  v_full_end date;
  v_period_start date;
  v_period_end date;
  v_target numeric;
  v_done int;
begin
  -- Part datée : chaque occurrence attendue pèse `weight`.
  select coalesce(sum(h.weight * public.habit_completion(h.id, g.day)), 0),
         coalesce(sum(h.weight), 0)
    into v_num, v_den
    from (
      select d::date as day
        from generate_series(p_from, p_to, interval '1 day') as d
    ) g
    join public.habits h on h.user_id = p_user_id
   where public.is_scheduled_on(h.id, g.day);

  -- Part quota : chaque période pèse `weight × cible proratisée`.
  for r in
    select s.habit_id,
           s.kind,
           s.times_per_period,
           s.effective_from,
           s.effective_to,
           h.weight,
           h.start_date,
           h.end_date
      from public.habit_schedules s
      join public.habits h on h.id = s.habit_id
     where h.user_id = p_user_id
       and s.kind in ('times_per_week', 'times_per_month')
       and s.effective_from <= p_to
       and (s.effective_to is null or s.effective_to >= p_from)
  loop
    v_cursor := greatest(p_from, r.effective_from, r.start_date);
    v_limit := least(
      p_to,
      coalesce(r.effective_to, 'infinity'::date),
      coalesce(r.end_date, 'infinity'::date)
    );

    while v_cursor <= v_limit loop
      if r.kind = 'times_per_week' then
        -- date_trunc('week') renvoie le lundi : même convention que l'ISO.
        v_full_start := date_trunc('week', v_cursor)::date;
        v_full_end := v_full_start + 6;
      else
        v_full_start := date_trunc('month', v_cursor)::date;
        v_full_end := (v_full_start + interval '1 month - 1 day')::date;
      end if;

      v_period_start := greatest(v_full_start, v_cursor);
      v_period_end := least(v_full_end, v_limit);

      -- Proratisation : une semaine entamée n'exige pas la cible entière, sinon
      -- la consistance du lundi serait artificiellement catastrophique.
      v_target := r.times_per_period::numeric
                  * ((v_period_end - v_period_start) + 1)
                  / ((v_full_end - v_full_start) + 1);

      select count(*)
        into v_done
        from generate_series(v_period_start, v_period_end, interval '1 day') as g
       where public.habit_completion(r.habit_id, g::date) = 1;

      v_num := v_num + r.weight * least(v_done, v_target);
      v_den := v_den + r.weight * v_target;

      v_cursor := v_period_end + 1;
    end loop;
  end loop;

  if v_den = 0 then
    return null;
  end if;
  return v_num / v_den;
end;
$$;

-- Séries. Un seul passage avant, exactement comme `streaks.ts` :
--   · jours neutres sautés, jamais cassants
--   · le jour courant ne casse jamais la série
--   · un joker par fenêtre glissante de 7 jours maintient la continuité
--     sans incrémenter le compteur
--   · `current` et `longest` suivent les mêmes règles
create or replace function public.streaks(
  p_user_id uuid,
  p_today date,
  p_threshold numeric default 0.8
)
returns table (current_streak int, longest_streak int, freezes_used int)
language plpgsql
stable
as $$
declare
  v_start date;
  v_day date;
  v_score numeric;
  v_run int := 0;
  v_longest int := 0;
  v_freezes date[] := '{}';
begin
  select min(start_date) into v_start
    from public.habits
   where user_id = p_user_id;

  if v_start is null or v_start > p_today then
    return query select 0, 0, 0;
    return;
  end if;

  v_day := v_start;
  while v_day <= p_today loop
    v_score := public.daily_score(p_user_id, v_day);

    if v_score is null then
      -- Jour neutre : ignoré.
      null;
    elsif v_score >= p_threshold then
      v_run := v_run + 1;
      if v_run > v_longest then
        v_longest := v_run;
      end if;
    elsif v_day = p_today then
      -- Journée en cours : pas encore jouée.
      null;
    elsif not exists (
      select 1 from unnest(v_freezes) as f where abs(v_day - f) < 7
    ) then
      v_freezes := v_freezes || v_day;
    else
      v_run := 0;
      v_freezes := '{}';
    end if;

    v_day := v_day + 1;
  end loop;

  return query select v_run, v_longest, coalesce(array_length(v_freezes, 1), 0);
end;
$$;
