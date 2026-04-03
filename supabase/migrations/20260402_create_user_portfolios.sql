create extension if not exists pgcrypto;

create table if not exists public.user_portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  objective text not null default 'max_sharpe',
  investment_horizon_bucket text not null default '3-7y',
  risk_tolerance text not null default 'MODERATE',
  universe_filter text not null default 'US_LARGE_CAP',
  lookback_period_years integer not null default 5,
  expected_annual_return double precision not null,
  expected_annual_volatility double precision not null,
  sharpe_ratio double precision not null,
  max_drawdown double precision not null,
  worst_month_return double precision not null,
  worst_quarter_return double precision not null,
  risk_free_rate_used double precision not null,
  stress_test_results jsonb not null default '{}'::jsonb,
  data_warnings jsonb not null default '[]'::jsonb,
  optimize_request jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_portfolios_horizon_check
    check (investment_horizon_bucket in ('<3y', '3-7y', '>7y')),
  constraint user_portfolios_risk_check
    check (risk_tolerance in ('CONSERVATIVE', 'MODERATE', 'AGGRESSIVE')),
  constraint user_portfolios_universe_check
    check (universe_filter in ('US_LARGE_CAP', 'US_ALL_CAP'))
);

create table if not exists public.user_portfolio_positions (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.user_portfolios(id) on delete cascade,
  symbol text not null,
  weight double precision not null,
  sector text,
  created_at timestamptz not null default now(),
  constraint user_portfolio_positions_symbol_format check (symbol ~ '^[A-Z][A-Z0-9.-]{0,19}$'),
  constraint user_portfolio_positions_weight_check check (weight >= 0 and weight <= 1),
  constraint user_portfolio_positions_portfolio_symbol_unique unique (portfolio_id, symbol)
);

create index if not exists user_portfolios_user_id_created_at_idx
  on public.user_portfolios(user_id, created_at desc);

create index if not exists user_portfolio_positions_portfolio_id_idx
  on public.user_portfolio_positions(portfolio_id);

create or replace function public.set_user_portfolios_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_portfolios_updated_at on public.user_portfolios;
create trigger trg_user_portfolios_updated_at
before update on public.user_portfolios
for each row
execute function public.set_user_portfolios_updated_at();

alter table public.user_portfolios enable row level security;
alter table public.user_portfolio_positions enable row level security;

drop policy if exists "user_portfolios_select_own" on public.user_portfolios;
create policy "user_portfolios_select_own"
  on public.user_portfolios
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_portfolios_insert_own" on public.user_portfolios;
create policy "user_portfolios_insert_own"
  on public.user_portfolios
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_portfolios_update_own" on public.user_portfolios;
create policy "user_portfolios_update_own"
  on public.user_portfolios
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_portfolios_delete_own" on public.user_portfolios;
create policy "user_portfolios_delete_own"
  on public.user_portfolios
  for delete
  using (auth.uid() = user_id);

drop policy if exists "user_portfolio_positions_select_own" on public.user_portfolio_positions;
create policy "user_portfolio_positions_select_own"
  on public.user_portfolio_positions
  for select
  using (
    exists (
      select 1
      from public.user_portfolios p
      where p.id = portfolio_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "user_portfolio_positions_insert_own" on public.user_portfolio_positions;
create policy "user_portfolio_positions_insert_own"
  on public.user_portfolio_positions
  for insert
  with check (
    exists (
      select 1
      from public.user_portfolios p
      where p.id = portfolio_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "user_portfolio_positions_update_own" on public.user_portfolio_positions;
create policy "user_portfolio_positions_update_own"
  on public.user_portfolio_positions
  for update
  using (
    exists (
      select 1
      from public.user_portfolios p
      where p.id = portfolio_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.user_portfolios p
      where p.id = portfolio_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "user_portfolio_positions_delete_own" on public.user_portfolio_positions;
create policy "user_portfolio_positions_delete_own"
  on public.user_portfolio_positions
  for delete
  using (
    exists (
      select 1
      from public.user_portfolios p
      where p.id = portfolio_id and p.user_id = auth.uid()
    )
  );
