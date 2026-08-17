-- ═══════════════════════════════════════════════════════════════════════════
-- Seed — les deux comptes initiaux
--
-- ╔═════════════════════════════════════════════════════════════════════════╗
-- ║  DÉVELOPPEMENT LOCAL UNIQUEMENT — NE PAS EXÉCUTER SUR UN PROJET HÉBERGÉ ║
-- ╚═════════════════════════════════════════════════════════════════════════╝
--
-- Les mots de passe ci-dessous sont dans le dépôt, donc PUBLICS. Exécuter ce
-- fichier sur un projet accessible depuis internet revient à publier deux
-- comptes ouverts.
--
-- Si ce seed a déjà été joué ailleurs qu'en local : changer les deux mots de
-- passe immédiatement (Réglages → Compte, ou dashboard Supabase).
--
-- Sur un projet hébergé, créer les comptes depuis le dashboard
-- (Authentication → Add user) ou via l'API admin, avec des mots de passe qui
-- n'ont jamais transité par un fichier versionné.
--
-- Ce fichier n'est joué automatiquement que par `supabase db reset` en local.
--
-- Ryan et Grace ne sont que les deux premiers comptes : rien ici n'est codé en
-- dur ailleurs dans l'application (CLAUDE.md, en-tête).
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_ryan uuid := '11111111-1111-4111-8111-111111111111';
  v_grace uuid := '22222222-2222-4222-8222-222222222222';
begin
  -- Idempotent : rejouer le seed ne duplique pas les comptes.
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values
    (
      '00000000-0000-0000-0000-000000000000',
      v_ryan,
      'authenticated',
      'authenticated',
      'ryan@personal-os.local',
      crypt('ryan-change-me-2026', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Ryan"}'::jsonb,
      now(),
      now()
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      v_grace,
      'authenticated',
      'authenticated',
      'grace@personal-os.local',
      crypt('grace-change-me-2026', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Grace"}'::jsonb,
      now(),
      now()
    )
  on conflict (id) do nothing;

  -- Identités : sans cette table, la connexion par mot de passe échoue.
  insert into auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values
    (
      gen_random_uuid(),
      v_ryan,
      v_ryan::text,
      format('{"sub":"%s","email":"%s","email_verified":true}', v_ryan, 'ryan@personal-os.local')::jsonb,
      'email',
      now(),
      now(),
      now()
    ),
    (
      gen_random_uuid(),
      v_grace,
      v_grace::text,
      format('{"sub":"%s","email":"%s","email_verified":true}', v_grace, 'grace@personal-os.local')::jsonb,
      'email',
      now(),
      now(),
      now()
    )
  on conflict (provider, provider_id) do nothing;

  -- Le trigger `handle_new_user` a normalement créé les profils. On complète
  -- seulement le fuseau, qui n'a pas de valeur par défaut sensée.
  update public.profiles
     set timezone = 'Africa/Douala'
   where id in (v_ryan, v_grace)
     and timezone = 'UTC';
end;
$$;
