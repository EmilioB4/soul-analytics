-- Preserve actual quantities from Whatnot financial CSV reports.
-- Existing financial amounts, COGS and report records are retained.
alter table public.whatnot_ledger add column if not exists quantity_sold integer check(quantity_sold>=0);
notify pgrst, 'reload schema';
