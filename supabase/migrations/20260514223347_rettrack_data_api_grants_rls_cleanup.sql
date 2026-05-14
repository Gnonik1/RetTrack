-- RetTrack Data API grants and RLS cleanup.
--
-- This migration documents and tightens RetTrack's public table posture for
-- Supabase Data API access. RetTrack uses supabase-js / the Data API for:
--   - public.profiles
--   - public.purchases
--   - public.purchase_photos
--
-- Guest mode is local-only, so anon intentionally receives no app table
-- access. Signed-in app access is granted to authenticated and restricted by
-- RLS policies. service_role is backend/admin only and must never be used in
-- the mobile app.
--
-- Storage policies are handled separately. Live Storage posture was observed as:
--   - bucket purchase-photos is private
--   - allowed mime type is image/jpeg
--   - folder-based policies use first path segment = auth.uid()

alter table public.profiles enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_photos enable row level security;

revoke all on table public.profiles from anon;
revoke all on table public.purchases from anon;
revoke all on table public.purchase_photos from anon;

revoke truncate, trigger, references on table public.profiles from authenticated;
revoke truncate, trigger, references on table public.purchases from authenticated;
revoke truncate, trigger, references on table public.purchase_photos from authenticated;
revoke delete on table public.profiles from authenticated;
revoke delete on table public.purchases from authenticated;

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update on table public.purchases to authenticated;
grant select, insert, update, delete on table public.purchase_photos to authenticated;

-- service_role is backend/admin only and must not be used in the mobile app.
grant all privileges on table public.profiles to service_role;
grant all privileges on table public.purchases to service_role;
grant all privileges on table public.purchase_photos to service_role;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists purchases_select_own on public.purchases;
create policy purchases_select_own
  on public.purchases
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists purchases_insert_own on public.purchases;
create policy purchases_insert_own
  on public.purchases
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists purchases_update_own on public.purchases;
create policy purchases_update_own
  on public.purchases
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- purchase_photos has an existing composite ownership FK linking
-- purchase_id/user_id to purchases(id/user_id). TODO: future policy hardening
-- can add EXISTS ownership checks if needed.
drop policy if exists purchase_photos_select_own on public.purchase_photos;
create policy purchase_photos_select_own
  on public.purchase_photos
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists purchase_photos_insert_own on public.purchase_photos;
create policy purchase_photos_insert_own
  on public.purchase_photos
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists purchase_photos_update_own on public.purchase_photos;
create policy purchase_photos_update_own
  on public.purchase_photos
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists purchase_photos_delete_own on public.purchase_photos;
create policy purchase_photos_delete_own
  on public.purchase_photos
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
