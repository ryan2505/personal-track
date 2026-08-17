-- ═══════════════════════════════════════════════════════════════════════════
-- 0014 — Partage lisant directement les données du propriétaire
--
-- Remplace le mécanisme de 0010, qui reposait sur un instantané publié par le
-- navigateur du propriétaire : le lien ne se mettait à jour que si son
-- application était ouverte.
--
-- Ici, le lien ne transporte rien. Il désigne un propriétaire, et chaque
-- consultation lit `user_state` au moment de la requête. Le destinataire voit
-- donc toujours l'état réel, même appareil éteint.
--
-- Le modèle de confidentialité est celui du §7 niveau 3 : aucune ligne brute ne
-- traverse la frontière. La fonction lit en interne, applique les réglages de
-- partage du propriétaire, et ne renvoie qu'une projection filtrée.
--
-- Ce qui ne sort JAMAIS, quel que soit le réglage :
--   · les notes des journaux (`note`)
--   · la vision et le vision board
--   · les descriptions d'habitudes
--   · le jeton du lien lui-même
-- Les intitulés d'habitudes ne sortent que si l'utilisateur a coché « habitudes »
-- ou « suivi du jour » ; sinon la structure est conservée mais anonymisée, ce
-- qui permet de calculer les scores sans révéler ce qui est suivi.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  secret_hash text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index share_links_owner_idx on public.share_links (owner_id);

alter table public.share_links enable row level security;

-- Le propriétaire gère ses liens. Personne d'autre ne lit cette table : le
-- destinataire passe exclusivement par la fonction ci-dessous.
create policy share_links_own
  on public.share_links for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ── Création ────────────────────────────────────────────────────────────────

create or replace function public.create_share_link(p_secret text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentification requise';
  end if;
  if p_secret is null or length(p_secret) < 32 then
    raise exception 'secret invalide';
  end if;

  insert into public.share_links (owner_id, secret_hash)
  values (auth.uid(), public.hash_board_secret(p_secret))
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.revoke_share_link(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_done boolean;
begin
  if auth.uid() is null then
    raise exception 'authentification requise';
  end if;

  update public.share_links
     set revoked_at = now()
   where id = p_id
     and owner_id = auth.uid()
     and revoked_at is null;

  get diagnostics v_done = row_count;
  return v_done;
end;
$$;

-- ── Lecture par le destinataire ─────────────────────────────────────────────

create or replace function public.get_shared_state(p_id uuid, p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_owner uuid;
  v_state jsonb;
  v_share jsonb;
  v_show_titles boolean;
  v_habits jsonb;
  v_logs jsonb;
begin
  select owner_id into v_owner
    from public.share_links
   where id = p_id
     and secret_hash = public.hash_board_secret(p_secret)
     and revoked_at is null;

  if v_owner is null then
    return null;
  end if;

  select state into v_state
    from public.user_state
   where user_id = v_owner;

  if v_state is null then
    return null;
  end if;

  v_share := coalesce(v_state -> 'shareSettings', '{}'::jsonb);
  v_show_titles := coalesce((v_share ->> 'habits')::boolean, false)
                or coalesce((v_share ->> 'tracking')::boolean, false);

  -- Structure conservée pour permettre le calcul des scores ; intitulé masqué
  -- tant que l'utilisateur ne l'a pas explicitement ouvert.
  select coalesce(
           jsonb_agg(
             case
               when v_show_titles then h - 'description'
               else jsonb_set(h - 'description', '{title}', '"Habitude"'::jsonb)
             end
           ),
           '[]'::jsonb
         )
    into v_habits
    from jsonb_array_elements(coalesce(v_state -> 'habits', '[]'::jsonb)) as h;

  -- Les notes ne quittent jamais le compte, sous aucun réglage.
  select coalesce(jsonb_agg(l - 'note'), '[]'::jsonb)
    into v_logs
    from jsonb_array_elements(coalesce(v_state -> 'logs', '[]'::jsonb)) as l;

  return jsonb_build_object(
    'version', coalesce(v_state -> 'version', to_jsonb(1)),
    'profile', jsonb_build_object(
      'displayName', coalesce(v_state -> 'profile' ->> 'displayName', ''),
      -- Nécessaire pour évaluer « aujourd'hui » dans le fuseau du propriétaire.
      'timezone', coalesce(v_state -> 'profile' ->> 'timezone', 'UTC'),
      'avatar', null,
      'onboarded', true,
      'onboardingStep', 5
    ),
    'shareSettings', v_share,
    'habits', v_habits,
    'logs', v_logs,
    'goals', case
               when coalesce((v_share ->> 'goals')::boolean, false)
               then coalesce(v_state -> 'goals', '[]'::jsonb)
               else '[]'::jsonb
             end,
    'visionAreas', '[]'::jsonb,
    'visionItems', '[]'::jsonb,
    'liveBoard', null
  );
end;
$$;

revoke all on function public.create_share_link(text) from public;
revoke all on function public.revoke_share_link(uuid) from public;
revoke all on function public.get_shared_state(uuid, text) from public;

grant execute on function public.create_share_link(text) to authenticated;
grant execute on function public.revoke_share_link(uuid) to authenticated;
-- Le destinataire n'a pas de compte : la clé anon suffit, le secret fait foi.
grant execute on function public.get_shared_state(uuid, text) to anon, authenticated;
