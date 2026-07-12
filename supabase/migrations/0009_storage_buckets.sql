-- 0009_storage_buckets.sql
-- Storage buckets for media uploads (replaces MinIO in the spec).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'images', 'images', false, 20971520,
    array['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
  ),
  (
    'audio', 'audio', false, 52428800,
    array['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/m4a', 'audio/x-m4a', 'audio/webm']
  )
on conflict (id) do nothing;

-- Storage RLS: a user can manage objects under their own folder prefix.
create policy "images_owner_all"
  on storage.objects for all
  using (
    bucket_id = 'images'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  )
  with check (
    bucket_id = 'images'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );

create policy "audio_owner_all"
  on storage.objects for all
  using (
    bucket_id = 'audio'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  )
  with check (
    bucket_id = 'audio'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );
