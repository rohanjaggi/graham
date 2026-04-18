# Graham

A long-term equity intelligence platform built for IS4228. Graham brings together qualitative research, quantitative screening, DCF valuation, portfolio optimisation, and tail risk analysis in a single dark-themed interface.

## Features

| Module | Description |
|---|---|
| **Overview** | Dashboard synced to a saved portfolio — holdings table, allocation donut, portfolio value chart, and quick-access cards |
| **Research** | Natural-language stock lookup powered by OpenAI; resolves intent queries to the best-matching ticker before running QA |
| **Stock Screener** | Warren Buffett-style fundamental and technical filters across US-listed equities |
| **Valuation** | DCF model with adjustable WACC, growth, and terminal assumptions; comparables tab with peer benchmarking |
| **Portfolio Optimiser** | Mean-variance optimisation (max Sharpe, min vol, max return); save and version portfolios |
| **Portfolios** | Saved portfolio library with per-portfolio detail pages |
| **Tail Risk** | Maximum drawdown, historical stress scenarios (COVID, GFC), VaR, and CVaR metrics |
| **Stock Page** | Per-ticker deep-dive: price chart, key metrics, financials, news, AI analysis, and crisis heuristics |

## Tech Stack

- **Framework** — Next.js 16 (App Router), React 19
- **Auth & DB** — Supabase (Postgres + Auth)
- **Market Data** — Finnhub (quotes, news, financials), Yahoo Finance (historical prices)
- **AI** — OpenAI (qualitative research, company analysis)
- **SEC Filings** — EDGAR API
- **Styling** — Tailwind CSS v4, CSS variables, custom dark theme
- **Testing** — Vitest

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set environment variables

Copy `.env.example` to `.env.local` and fill in your keys:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes | Powers qualitative research and AI analysis |
| `FINNHUB_API_KEY` | Yes | Market data, quotes, news, financials |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase anon key |
| `SEC_API_KEY` | No | Improves EDGAR filing lookup accuracy |

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
app/
  api/                    # Route handlers (ticker, portfolio, screener, dcf-snapshots…)
  auth/                   # Sign in / sign up pages
  onboarding/             # Profile setup after signup
  protected/
    (shell)/              # Main app pages (overview, research, screener, valuation…)
    ticker/[symbol]/      # Per-ticker deep-dive page
lib/
  dcf.ts                  # DCF valuation logic
  market/                 # Market data helpers
  portfolio/              # Optimisation logic, covariance, stress tests, Yahoo Finance
  sec/                    # EDGAR integration
  supabase/               # Supabase client/server setup
  ui/                     # Shared formatting utilities
supabase/
  migrations/             # SQL schema migrations
```
