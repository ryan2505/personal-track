-- ═══════════════════════════════════════════════════════════════════════════
-- 0010 — Liens de partage vivants
--
-- Modèle de sécurité : jeton-capacité, sans comptes. Chaque lien porte un
-- secret aléatoire de 32 octets ; la table ne stocke que son SHA-256, donc une
-- fuite de la base ne permet pas de reconstituer les liens.
--
-- La table est inaccessible en direct : RLS activée, aucune policy. Les trois
-- seules portes d'entrée sont les fonctions ci-dessous, toutes en SECURITY
-- DEFINER et toutes exigeant le secret.
--
-- Indépendant de `auth` : c'est ce qui permet de partager avant M1. Ce n'est
-- pas l'espace couple (0007/0009), qui suppose deux comptes et de la
-- réciprocité.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.shared_boards (
  id uuid primary key default gen_random_uuid(),
  secret_hash text not null,
  payload jsonb not null,
  -- Optionnel : rattache le lien à un compte quand M1 sera là, sans casser les
  -- liens créés avant.
  owner_id uuid references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index shared_boards_live_idx
  on public.shared_boards (id)
  where revoked_at is null;

alter table public.shared_boards enable row level security;

-- Aucune policy : même la clé anon ne peut ni lire ni écrire la table.
revoke all on public.shared_boards from anon, authenticated;

create or replace function public.hash_board_secret(p_secret text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(digest(p_secret, 'sha256'), 'hex');
$$;

-- Crée le lien si `p_id` est null, sinon met à jour son contenu.
create or replace function public.publish_shared_board(
  p_id uuid,
  p_secret text,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_id uuid;
begin
  if p_secret is null or length(p_secret) < 32 then
    raise exception 'secret invalide';
  end if;

  -- Un payload démesuré signale un bug côté client, pas un usage légitime.
  if pg_column_size(p_payload) > 200000 then
    raise exception 'payload trop volumineux';
  end if;

  v_hash := public.hash_board_secret(p_secret);

  if p_id is null then
    insert into public.shared_boards (secret_hash, payload, owner_id)
    values (v_hash, p_payload, auth.uid())
    returning id into v_id;
    return v_id;
  end if;

  update public.shared_boards
     set payload = p_payload,
         updated_at = now()
   where id = p_id
     and secret_hash = v_hash
     and revoked_at is null;

  if not found then
    raise exception 'lien introuvable, révoqué, ou secret invalide';
  end if;

  return p_id;
end;
$$;

create or replace function public.get_shared_board(p_id uuid, p_secret text)
returns table (payload jsonb, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
    select b.payload, b.updated_at
      from public.shared_boards b
     where b.id = p_id
       and b.secret_hash = public.hash_board_secret(p_secret)
       and b.revoked_at is null;
end;
$$;

-- Révocation définitive : le contenu est effacé, pas seulement masqué.
create or replace function public.revoke_shared_board(p_id uuid, p_secret text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_done boolean;
begin
  update public.shared_boards
     set revoked_at = now(),
         payload = '{}'::jsonb
   where id = p_id
     and secret_hash = public.hash_board_secret(p_secret)
     and revoked_at is null;

  get diagnostics v_done = row_count;
  return v_done;
end;
$$;

revoke all on function public.publish_shared_board(uuid, text, jsonb) from public;
revoke all on function public.get_shared_board(uuid, text) from public;
revoke all on function public.revoke_shared_board(uuid, text) from public;

grant execute on function public.publish_shared_board(uuid, text, jsonb) to anon, authenticated;
grant execute on function public.get_shared_board(uuid, text) to anon, authenticated;
grant execute on function public.revoke_shared_board(uuid, text) to anon, authenticated;
