alter table public.user_portfolios
  add column if not exists objective text not null default 'max_sharpe',
  add column if not exists investment_horizon_bucket text not null default '3-7y',
  add column if not exists risk_tolerance text not null default 'MODERATE',
  add column if not exists universe_filter text not null default 'US_LARGE_CAP',
  add column if not exists lookback_period_years integer not null default 5,
  add column if not exists stress_test_results jsonb not null default '{}'::jsonb,
  add column if not exists data_warnings jsonb not null default '[]'::jsonb,
  add column if not exists optimize_request jsonb,
  add column if not exists notes text;

alter table public.user_portfolios
  drop constraint if exists user_portfolios_horizon_check;

alter table public.user_portfolios
  add constraint user_portfolios_horizon_check
  check (investment_horizon_bucket in ('<3y', '3-7y', '>7y'));

alter table public.user_portfolios
  drop constraint if exists user_portfolios_risk_check;

alter table public.user_portfolios
  add constraint user_portfolios_risk_check
  check (risk_tolerance in ('DEFENSIVE', 'CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'));

alter table public.user_portfolios
  drop constraint if exists user_portfolios_universe_check;

alter table public.user_portfolios
  add constraint user_portfolios_universe_check
  check (universe_filter in ('US_LARGE_CAP', 'US_ALL_CAP'));
