create extension if not exists pgcrypto;

create table if not exists public.user_saved_tickers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  company_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_saved_tickers_symbol_format check (symbol ~ '^[A-Z][A-Z0-9.-]{0,9}$'),
  constraint user_saved_tickers_user_symbol_unique unique (user_id, symbol)
);

create index if not exists user_saved_tickers_user_id_idx
  on public.user_saved_tickers(user_id, created_at desc);

create or replace function public.set_user_saved_tickers_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_saved_tickers_updated_at on public.user_saved_tickers;
create trigger trg_user_saved_tickers_updated_at
before update on public.user_saved_tickers
for each row
execute function public.set_user_saved_tickers_updated_at();

alter table public.user_saved_tickers enable row level security;

drop policy if exists "user_saved_tickers_select_own" on public.user_saved_tickers;
create policy "user_saved_tickers_select_own"
  on public.user_saved_tickers
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_saved_tickers_insert_own" on public.user_saved_tickers;
create policy "user_saved_tickers_insert_own"
  on public.user_saved_tickers
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_saved_tickers_update_own" on public.user_saved_tickers;
create policy "user_saved_tickers_update_own"
  on public.user_saved_tickers
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_saved_tickers_delete_own" on public.user_saved_tickers;
create policy "user_saved_tickers_delete_own"
  on public.user_saved_tickers
  for delete
  using (auth.uid() = user_id);
