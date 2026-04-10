create table if not exists public.user_ticker_thesis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  bull_case text not null default '',
  bear_case text not null default '',
  thesis text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_ticker_thesis_user_symbol_unique unique (user_id, symbol)
);

create index if not exists user_ticker_thesis_user_id_idx
  on public.user_ticker_thesis(user_id, updated_at desc);

create or replace function public.set_user_ticker_thesis_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_ticker_thesis_updated_at on public.user_ticker_thesis;
create trigger trg_user_ticker_thesis_updated_at
before update on public.user_ticker_thesis
for each row
execute function public.set_user_ticker_thesis_updated_at();

alter table public.user_ticker_thesis enable row level security;

drop policy if exists "user_ticker_thesis_select_own" on public.user_ticker_thesis;
create policy "user_ticker_thesis_select_own"
  on public.user_ticker_thesis
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_ticker_thesis_insert_own" on public.user_ticker_thesis;
create policy "user_ticker_thesis_insert_own"
  on public.user_ticker_thesis
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_ticker_thesis_update_own" on public.user_ticker_thesis;
create policy "user_ticker_thesis_update_own"
  on public.user_ticker_thesis
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
