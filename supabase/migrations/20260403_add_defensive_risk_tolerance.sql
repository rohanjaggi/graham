alter table public.user_portfolios
  drop constraint if exists user_portfolios_risk_check;

alter table public.user_portfolios
  add constraint user_portfolios_risk_check
  check (risk_tolerance in ('DEFENSIVE', 'CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'));
