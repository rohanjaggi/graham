create table if not exists public.dcf_snapshots (
  id                         uuid             primary key default gen_random_uuid(),
  user_id                    uuid             not null references auth.users(id) on delete cascade,
  symbol                     text             not null,
  company_name               text             not null default '',
  label                      text,

  -- Assumptions (rates stored as percentages, e.g. 10.0 = 10%)
  base_fcf                   double precision not null,
  wacc                       double precision not null,
  years                      integer          not null,
  terminal_growth_rate       double precision not null,
  growth_rate_conservative   double precision not null,
  growth_rate_neutral        double precision not null,
  growth_rate_bullish        double precision not null,

  -- Market context at save time
  market_price               double precision,
  shares_outstanding         double precision not null default 0,
  net_debt                   double precision not null default 0,

  -- Full results: { conservative: DCFResult, neutral: DCFResult, bullish: DCFResult }
  results_json               jsonb            not null default '{}'::jsonb,

  created_at                 timestamptz      not null default now(),

  constraint dcf_snapshots_symbol_format check (symbol ~ '^[A-Z][A-Z0-9.\-]{0,19}$'),
  constraint dcf_snapshots_wacc_positive check (wacc > 0),
  constraint dcf_snapshots_years_range   check (years >= 1 and years <= 30)
);

create index if not exists dcf_snapshots_user_symbol_created_idx
  on public.dcf_snapshots(user_id, symbol, created_at desc);

alter table public.dcf_snapshots enable row level security;

drop policy if exists "dcf_snapshots_select_own" on public.dcf_snapshots;
create policy "dcf_snapshots_select_own"
  on public.dcf_snapshots for select using (auth.uid() = user_id);

drop policy if exists "dcf_snapshots_insert_own" on public.dcf_snapshots;
create policy "dcf_snapshots_insert_own"
  on public.dcf_snapshots for insert with check (auth.uid() = user_id);

drop policy if exists "dcf_snapshots_delete_own" on public.dcf_snapshots;
create policy "dcf_snapshots_delete_own"
  on public.dcf_snapshots for delete using (auth.uid() = user_id);
