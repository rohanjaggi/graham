alter table public.user_portfolio_positions
  add column if not exists company_name text,
  add column if not exists industry text,
  add column if not exists pe_snapshot double precision;

create index if not exists user_portfolio_positions_portfolio_weight_idx
  on public.user_portfolio_positions(portfolio_id, weight desc);

alter table public.user_ticker_thesis
  drop constraint if exists user_ticker_thesis_symbol_format;

alter table public.user_ticker_thesis
  add constraint user_ticker_thesis_symbol_format
  check (symbol ~ '^[A-Z][A-Z0-9.-]{0,19}$');
