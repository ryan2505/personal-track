-- ═══════════════════════════════════════════════════════════════════════════
-- 0017 — Cadence des métriques : semaine ou mois
--
-- Une cible hebdomadaire et une cible mensuelle ne sont pas deux mécanismes,
-- c'est le même à deux rythmes. D'où une colonne plutôt qu'une seconde paire
-- de tables : même calcul de ratio, même reconduction, même gel.
--
-- ⚠️ Schéma cible, non branché — voir 0016.
-- **Rejouable** — voir l'en-tête de 0015.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from pg_type where typname = 'metric_cadence') then
    create type public.metric_cadence as enum ('weekly', 'monthly');
  end if;
end
$$;

alter table public.metrics
  add column if not exists cadence public.metric_cadence not null default 'monthly';

comment on column public.metrics.cadence is
  'Rythme auquel la cible se repose. Immuable une fois des périodes chiffrées : changer le rythme rendrait l''historique inintelligible.';

create index if not exists metrics_user_cadence_idx
  on public.metrics (user_id, cadence)
  where archived_at is null;

-- ── La période accepte désormais deux formes ────────────────────────────────
--
-- `period_start` reste une DATE : le 1er du mois pour une métrique mensuelle,
-- le lundi ISO pour une métrique hebdomadaire. Une seule colonne, deux
-- cadences, et la base sait toujours ordonner et borner les périodes.
--
-- Un CHECK de table ne peut pas consulter `metrics.cadence` ; il vérifie donc
-- la forme faible — début de mois OU lundi — et la cohérence avec la cadence
-- est tenue par le déclencheur ci-dessous.

alter table public.metric_entries
  drop constraint if exists metric_entries_period_is_month;

alter table public.metric_entries
  drop constraint if exists metric_entries_period_is_boundary;
alter table public.metric_entries
  add constraint metric_entries_period_is_boundary
  check (
    period_start = date_trunc('month', period_start)::date
    or extract(isodow from period_start) = 1
  );

create or replace function public.check_metric_entry_period()
returns trigger
language plpgsql
as $$
declare
  wanted public.metric_cadence;
begin
  select cadence into wanted from public.metrics where id = new.metric_id;

  if wanted = 'weekly' and extract(isodow from new.period_start) <> 1 then
    raise exception 'Une métrique hebdomadaire est datée du lundi de sa semaine (reçu : %)',
      new.period_start;
  end if;

  if wanted = 'monthly'
     and new.period_start <> date_trunc('month', new.period_start)::date then
    raise exception 'Une métrique mensuelle est datée du 1er de son mois (reçu : %)',
      new.period_start;
  end if;

  return new;
end;
$$;

comment on function public.check_metric_entry_period is
  'Interdit qu''une entrée soit posée sur une période étrangère à la cadence de sa métrique — elle deviendrait invisible dans toutes les vues.';

drop trigger if exists metric_entries_period_matches_cadence on public.metric_entries;
create trigger metric_entries_period_matches_cadence
  before insert or update on public.metric_entries
  for each row execute function public.check_metric_entry_period();
