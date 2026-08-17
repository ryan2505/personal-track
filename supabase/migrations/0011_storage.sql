-- ═══════════════════════════════════════════════════════════════════════════
-- 0011 — Stockage des images
--
-- Deux buckets PRIVÉS. Les images du vision board et les preuves d'habitude
-- sont des données personnelles : elles se servent par URL signée à durée
-- courte, jamais par URL publique devinable.
--
-- Convention de chemin, sur laquelle reposent les policies :
--     <user_id>/<nom-de-fichier>
-- Le premier segment doit être l'identifiant du propriétaire. Toute la sécurité
-- du stockage tient à cette règle — la respecter côté client est obligatoire.
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('vision', 'vision', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('evidence', 'evidence', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Une seule règle, appliquée aux quatre verbes : le dossier racine doit porter
-- l'identifiant de l'appelant.
create policy "vision_read_own"
  on storage.objects for select
  using (bucket_id = 'vision' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "vision_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'vision' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "vision_update_own"
  on storage.objects for update
  using (bucket_id = 'vision' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'vision' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "vision_delete_own"
  on storage.objects for delete
  using (bucket_id = 'vision' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "evidence_read_own"
  on storage.objects for select
  using (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "evidence_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "evidence_update_own"
  on storage.objects for update
  using (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "evidence_delete_own"
  on storage.objects for delete
  using (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text);
