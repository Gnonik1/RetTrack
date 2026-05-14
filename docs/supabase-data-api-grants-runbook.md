# RetTrack Supabase Data API Grants/RLS Runbook

Migration file:

`supabase/migrations/20260514223347_rettrack_data_api_grants_rls_cleanup.sql`

## Purpose

This runbook covers the manual apply, verification, and rollback review process for RetTrack's Supabase Data API grants and RLS cleanup migration.

The migration prepares RetTrack for Supabase Data API explicit grants by version-controlling the grant and RLS posture for these public tables:

- `public.profiles`
- `public.purchases`
- `public.purchase_photos`

RetTrack uses `supabase-js`, so app table access goes through the Supabase Data API. Guest mode is local-only, so `anon` intentionally receives no app table access. Signed-in app access is granted to `authenticated` and restricted by RLS. `purchase_photos` allows authenticated owner-scoped `DELETE` so photo sync can clean up stale metadata. `service_role` is backend/admin only and must never be used in the mobile app.

Storage is separate from this table migration. The live `purchase-photos` bucket was observed as private with Storage policies by user folder.

## Pre-Apply Checklist

- Confirm the latest app commit is pushed or otherwise backed up.
- Confirm `supabase/migrations/20260514223347_rettrack_data_api_grants_rls_cleanup.sql` was reviewed.
- Confirm Supabase Dashboard Security Advisor has been checked.
- Confirm current live public tables are still `profiles`, `purchases`, and `purchase_photos`.
- Confirm guest mode remains local-only.
- Confirm no mobile app `service_role` key exists.
- Confirm Storage bucket `purchase-photos` remains private.
- Confirm Storage policies remain separate and unchanged.
- Capture the before-state SQL snapshots below before applying the migration.

## Pre-Apply Read-Only SQL Queries

Use these queries only to capture the current live state before applying the migration.

### RLS Status

```sql
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('profiles', 'purchases', 'purchase_photos')
order by c.relname;
```

### Table Grants

```sql
select
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('profiles', 'purchases', 'purchase_photos')
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;
```

### Table Policies

```sql
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'purchases', 'purchase_photos')
order by tablename, policyname;
```

### Storage Bucket Status

```sql
select
  id,
  name,
  public,
  allowed_mime_types,
  file_size_limit
from storage.buckets
where id = 'purchase-photos';
```

### Storage Policies

```sql
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
order by policyname;
```

## Apply

Do not apply this migration automatically from this runbook.

Apply should be done manually only after final review, using either the Supabase Dashboard SQL Editor or a reviewed Supabase CLI migration workflow. Confirm that the SQL being applied matches:

`supabase/migrations/20260514223347_rettrack_data_api_grants_rls_cleanup.sql`

Do not change Storage policies as part of this migration.

## Post-Apply Verification SQL

Run these queries after manual apply and compare the output to the expected posture.

### RLS Enabled

Expected: all three tables have `rls_enabled = true`.

```sql
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('profiles', 'purchases', 'purchase_photos')
order by c.relname;
```

### Anon Has No App Table Grants

Expected: zero rows.

```sql
select
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('profiles', 'purchases', 'purchase_photos')
  and grantee = 'anon'
order by table_name, privilege_type;
```

### Authenticated Grants

Expected:

- `profiles`: `INSERT`, `SELECT`, `UPDATE`
- `purchases`: `INSERT`, `SELECT`, `UPDATE`
- `purchase_photos`: `DELETE`, `INSERT`, `SELECT`, `UPDATE`

```sql
select
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('profiles', 'purchases', 'purchase_photos')
  and grantee = 'authenticated'
order by table_name, privilege_type;
```

### No Authenticated Hard Delete On Profiles Or Purchases

Expected: zero rows.

```sql
select
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('profiles', 'purchases')
  and grantee = 'authenticated'
  and privilege_type = 'DELETE'
order by table_name;
```

### Purchase Photos Delete Policy

Expected: `purchase_photos_delete_own` exists for authenticated owner-scoped deletes.

```sql
select
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'purchase_photos'
  and policyname = 'purchase_photos_delete_own';
```

### Own-Row Policies

Expected: all listed policies exist.

```sql
select
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'purchases', 'purchase_photos')
  and policyname in (
    'profiles_select_own',
    'profiles_insert_own',
    'profiles_update_own',
    'purchases_select_own',
    'purchases_insert_own',
    'purchases_update_own',
    'purchase_photos_select_own',
    'purchase_photos_insert_own',
    'purchase_photos_update_own',
    'purchase_photos_delete_own'
  )
order by tablename, policyname;
```

## Functional Smoke Test Checklist

After the migration is manually applied and SQL verification passes:

- Sign in works.
- Profile loads.
- Profile updates.
- Purchase list loads.
- Add purchase works.
- Edit purchase works.
- Mark returned works.
- Mark kept works.
- Soft delete purchase works.
- Add photo works.
- Replace photo works.
- Remove photo works.
- Stale photo cleanup works, if directly testable.
- Guest mode local-only still works.

## Rollback

Review before use. Do not run rollback SQL blindly. Prefer restoring from the captured before-state snapshots and confirming the exact failure first.

The safest rollback is usually a targeted grant or policy repair, not broad access. Avoid granting `anon` app table access unless absolutely necessary and separately reviewed.

```sql
-- REVIEW BEFORE USE. Do not run as-is.
--
-- If authenticated app access breaks because a required CRUD grant is missing,
-- restore only the minimum app grants needed:
--
-- grant select, insert, update on table public.profiles to authenticated;
-- grant select, insert, update on table public.purchases to authenticated;
-- grant select, insert, update, delete on table public.purchase_photos to authenticated;
--
-- If purchase_photos owner delete causes an unexpected issue, review before
-- removing it. Removing this can break stale photo metadata cleanup:
--
-- revoke delete on table public.purchase_photos from authenticated;
-- drop policy if exists purchase_photos_delete_own on public.purchase_photos;
--
-- If policy recreation breaks app access, restore the reviewed previous
-- policy definitions from the before-state snapshot.
--
-- Do not grant anon table access unless absolutely necessary and reviewed.
```

## Risks

- Do not grant `anon` table access.
- Do not expose `service_role` in the mobile app.
- Do not rely on client-side `user_id` filters without RLS.
- Do not apply on production without reviewed SQL and before/after snapshots.
- Do not change Storage policies in this migration.
- Do not broaden authenticated access beyond the app's required table operations.
