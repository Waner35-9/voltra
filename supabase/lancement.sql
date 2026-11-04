-- À coller une seule fois dans Supabase > SQL Editor.

-- 1. Photos de profil : chacun ne peut écrire que ses propres fichiers
drop policy if exists "Utilisateurs peuvent uploader leur avatar" on storage.objects;
drop policy if exists "Utilisateurs peuvent mettre a jour leur avatar" on storage.objects;

create policy "Utilisateurs peuvent uploader leur avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and name like (auth.uid()::text || '-%'));

create policy "Utilisateurs peuvent mettre a jour leur avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and name like (auth.uid()::text || '-%'))
  with check (bucket_id = 'avatars' and name like (auth.uid()::text || '-%'));

-- 2. Photos de profil : images uniquement, 5 Mo maximum
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
where id = 'avatars';
