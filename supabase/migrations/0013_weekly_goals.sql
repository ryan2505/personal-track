-- ═══════════════════════════════════════════════════════════════════════════
-- 0013 — Objectifs hebdomadaires
--
-- Ajoute l'horizon « semaine » aux objectifs. Placé avant `monthly` pour que
-- l'ordre de l'enum aille du plus court au plus long : un `order by scope`
-- classe alors naturellement du plus urgent au plus lointain.
--
-- Note Postgres : `alter type ... add value` ne peut pas être suivi, dans la
-- même transaction, d'une requête utilisant la nouvelle valeur. D'où une
-- migration dédiée qui ne fait que ça.
-- ═══════════════════════════════════════════════════════════════════════════

alter type public.goal_scope add value if not exists 'weekly' before 'monthly';
