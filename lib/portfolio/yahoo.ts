/** Yahoo Finance chart API — adjusted closes for return series (no API key). */

/**
 * Yahoo chart symbols: keep exchange suffixes (VOD.L, AIR.PA, 7203.T); US multi-class tickers use hyphen (BRK-B).
 */
export function toYahooSymbol(symbol: string): string {
  const s = symbol.trim().toUpperCase()
  const m = /^(.+)\.([A-Z])$/.exec(s)
  if (m && (m[2] === 'A' || m[2] === 'B')) return `${m[1]}-${m[2]}`
  return s
}

type Point = { t: number; adj: number }

function parseChartJson(json: unknown): Point[] {
  const result = (json as { chart?: { result?: Array<{
    timestamp?: number[]
    indicators?: { adjclose?: Array<{ adjclose?: (number | null)[] }>; quote?: Array<{ close?: (number | null)[] }> }
  }> } })?.chart?.result?.[0]
  if (!result?.timestamp?.length) return []

  const ts = result.timestamp
  const adj =
    result.indicators?.adjclose?.[0]?.adjclose ??
    result.indicators?.quote?.[0]?.close ??
    []
  const out: Point[] = []
  for (let i = 0; i < ts.length; i++) {
    const a = adj[i]
    if (a != null && a > 0) out.push({ t: ts[i], adj: a })
  }
  return out
}

/** Lookback in whole calendar years (1–5). */
export function clampLookbackYears(y: number): number {
  return Math.min(5, Math.max(1, Math.floor(Number.isFinite(y) ? y : 5)))
}

/**
 * Daily adjusted closes from Yahoo chart API (`period1`/`period2` = rolling window ending now).
 */
export async function fetchAdjCloseSeries(symbol: string, years = 5): Promise<Point[]> {
  const y = clampLookbackYears(years)
  const sym = toYahooSymbol(symbol)
  const period2 = Math.floor(Date.now() / 1000)
  const start = new Date()
  start.setFullYear(start.getFullYear() - y)
  const period1 = Math.floor(start.getTime() / 1000)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&period1=${period1}&period2=${period2}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Graham/1.0)' },
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`Yahoo chart failed for ${sym}`)
  const json = await res.json()
  return parseChartJson(json)
}

/** Minimum aligned price rows and return rows (shorter windows need a lower floor). */
export function minObservationsForLookback(years: number): { minPriceRows: number; minReturnRows: number } {
  const y = clampLookbackYears(years)
  const minPriceRows = Math.max(80, Math.min(120, 35 * y))
  const minReturnRows = Math.max(60, minPriceRows - 5)
  return { minPriceRows, minReturnRows }
}

/** Align series by Unix day, compute simple daily returns matrix R (T × n). */
export function buildReturnMatrix(
  seriesBySymbol: Map<string, Point[]>,
  years = 5
): { symbols: string[]; R: number[][]; tradingDays: number } | null {
  const { minPriceRows, minReturnRows } = minObservationsForLookback(years)
  const symbols = [...seriesBySymbol.keys()]
  if (symbols.length < 2) return null

  const byDay = new Map<number, Map<string, number>>()
  for (const sym of symbols) {
    const pts = seriesBySymbol.get(sym)
    if (!pts?.length) return null
    for (const p of pts) {
      const day = Math.floor(p.t / 86400)
      if (!byDay.has(day)) byDay.set(day, new Map())
      byDay.get(day)!.set(sym, p.adj)
    }
  }

  const days = [...byDay.keys()].sort((a, b) => a - b)
  const prices: number[][] = []
  for (const day of days) {
    const row = byDay.get(day)!
    const ok = symbols.every(s => row.has(s))
    if (!ok) continue
    prices.push(symbols.map(s => row.get(s)!))
  }

  if (prices.length < minPriceRows) return null

  const R: number[][] = []
  for (let t = 1; t < prices.length; t++) {
    const prev = prices[t - 1]
    const cur = prices[t]
    const rets = symbols.map((_, i) => (cur[i] - prev[i]) / prev[i])
    if (rets.some(x => !Number.isFinite(x))) continue
    R.push(rets)
  }

  if (R.length < minReturnRows) return null

  return { symbols, R, tradingDays: R.length }
}
