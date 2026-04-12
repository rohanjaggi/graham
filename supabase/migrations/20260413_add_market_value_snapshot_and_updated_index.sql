alter table public.user_portfolio_positions
  add column if not exists market_value_snapshot double precision;

create index if not exists user_portfolios_user_id_updated_at_idx
  on public.user_portfolios(user_id, updated_at desc);
