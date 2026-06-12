-- ============================================================
-- Story Maps — Storage Bucket Setup
-- Run this in your Supabase SQL Editor (safe to re-run)
-- ============================================================

-- Create the public 'datasets' bucket
insert into storage.buckets (id, name, public)
values ('datasets', 'datasets', true)
on conflict (id) do nothing;

-- Logged-in users can upload into the bucket (scoped to their own folder)
drop policy if exists "auth_upload_datasets" on storage.objects;
create policy "auth_upload_datasets"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'datasets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own files
drop policy if exists "auth_delete_own_datasets" on storage.objects;
create policy "auth_delete_own_datasets"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'datasets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Anyone can read (needed for published viewers)
drop policy if exists "public_read_datasets" on storage.objects;
create policy "public_read_datasets"
  on storage.objects for select
  using (bucket_id = 'datasets');
