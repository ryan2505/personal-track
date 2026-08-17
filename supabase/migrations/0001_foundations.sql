-- ═══════════════════════════════════════════════════════════════════════════
-- 0001 — Extensions, types énumérés, utilitaires
--
-- Les enums reprennent exactement le vocabulaire de CLAUDE.md §2. Un type
-- ajouté ici doit l'être aussi dans src/lib/domain/types.ts, et inversement.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;
-- Nécessaire à la contrainte d'exclusion qui empêche deux plannings de se
-- chevaucher sur une même habitude (voir 0004).
create extension if not exists btree_gist;

-- ── Domaines de vie ─────────────────────────────────────────────────────────
create type public.habit_category as enum (
  'career',
  'business',
  'finance',
  'health',
  'fitness',
  'learning',
  'relationships',
  'personal',
  'spiritual',
  'other'
);

-- ── Habitudes ───────────────────────────────────────────────────────────────
create type public.habit_type as enum ('boolean', 'numeric', 'duration', 'quantity', 'counter');

-- `at_most` : « ne pas dépasser ». Rester sous la cible vaut 100%.
create type public.habit_direction as enum ('at_least', 'at_most');

-- Deux natures, pas une (CLAUDE.md §5.2) : les trois premières sont datées,
-- les deux dernières sont des quotas et n'attendent aucun jour précis.
create type public.schedule_kind as enum (
  'daily',
  'days_of_week',
  'days_of_month',
  'times_per_week',
  'times_per_month'
);

-- ── Objectifs ───────────────────────────────────────────────────────────────
create type public.goal_scope as enum ('long_term', 'yearly', 'monthly');
create type public.goal_status as enum ('not_started', 'in_progress', 'completed', 'abandoned');
create type public.goal_source as enum ('manual', 'habit_count', 'habit_sum');

-- ── Revues ──────────────────────────────────────────────────────────────────
create type public.review_kind as enum ('weekly', 'monthly');

-- ── Vision ──────────────────────────────────────────────────────────────────
create type public.vision_item_kind as enum ('image', 'text', 'quote');

-- ── Couple ──────────────────────────────────────────────────────────────────
create type public.couple_member_status as enum ('invited', 'active', 'left');

-- ── Utilitaires ─────────────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.touch_updated_at is
  'Trigger générique : maintient updated_at sans faire confiance au client.';
