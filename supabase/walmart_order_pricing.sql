-- One-time upgrade. No historical amounts or account permissions are changed.
begin;
alter table public.walmart_sales add column if not exists pricing jsonb;
comment on column public.walmart_sales.pricing is 'Order-time Walmart incentive evidence and buyer amounts; no buyer personal data. Null means not yet re-synced.';
notify pgrst,'reload schema';
commit;
