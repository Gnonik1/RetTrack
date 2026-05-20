-- Add durable purchase provenance for guest/account scope isolation.
--
-- Existing purchases cannot be safely classified from current columns alone, so
-- they remain/backfill to "unknown". New client writes should set account or
-- guest when that provenance is known locally.

alter table public.purchases
  add column if not exists purchase_origin text;

alter table public.purchases
  alter column purchase_origin set default 'unknown';

update public.purchases
set purchase_origin = 'unknown'
where purchase_origin is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'purchases_purchase_origin_check'
      and conrelid = 'public.purchases'::regclass
  ) then
    alter table public.purchases
      add constraint purchases_purchase_origin_check
      check (purchase_origin in ('account', 'guest', 'unknown'));
  end if;
end $$;

alter table public.purchases
  alter column purchase_origin set not null;
