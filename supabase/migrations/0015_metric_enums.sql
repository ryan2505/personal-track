-- ═══════════════════════════════════════════════════════════════════════════
-- 0015 — Types énumérés des métriques mensuelles
--
-- Migration dédiée aux seuls `create type` / `alter type`, pour la raison déjà
-- rencontrée en 0013 : Postgres refuse d'utiliser une valeur d'enum ajoutée
-- dans la même transaction. Les tables qui s'en servent arrivent en 0016.
--
-- Vocabulaire (CLAUDE.md §2, étendu) :
--   HABITUDES = ce que j'ai fait     → habit_logs, déjà en base
--   OUTPUTS   = ce que j'ai produit  → metric_kind 'output'
--   RESULTS   = ce que ça a généré   → metric_kind 'result'
--
-- `metric_kind` n'a délibérément pas de valeur 'habit' : ce qui relève des
-- habitudes se calcule depuis `habit_logs`, seule source de vérité. Une valeur
-- 'habit' ici ouvrirait la porte à une saisie manuelle en double.
-- ═══════════════════════════════════════════════════════════════════════════

create type public.metric_kind as enum ('output', 'result');

-- Plus n'est pas toujours mieux. `maintain` est suivi mais non scoré : définir
-- un « bon écart » autour d'une cible serait arbitraire (voir metricRatio).
create type public.metric_direction as enum ('increase', 'decrease', 'maintain');

-- Formatage uniquement. N'intervient dans aucun calcul.
create type public.metric_value_type as enum (
  'count',
  'currency',
  'percent',
  'duration',
  'decimal'
);

-- Un objectif peut désormais être alimenté par une métrique mensuelle, comme il
-- l'est déjà par les logs de ses habitudes liées.
alter type public.goal_source add value if not exists 'metric';
