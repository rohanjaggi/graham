import { cache } from 'react' // or a simple in-memory map

// For PoC, static mapping or Finnhub calls.

const SECTOR_MAP = new Map<string, string>([
  ['AAPL', 'Information Technology'],
  ['MSFT', 'Information Technology'],
  ['JPM', 'Financials'],
  // ...
])

export async function getSector(symbol: string): Promise<string | null> {
  return SECTOR_MAP.get(symbol) ?? null
}

export async function computeSectorWeights(
  symbols: string[],
  weights: number[]
): Promise<Map<string, number>> {
  const bySector = new Map<string, number>()
  for (let i = 0; i < symbols.length; i++) {
    const sector = (await getSector(symbols[i])) ?? 'UNKNOWN'
    bySector.set(sector, (bySector.get(sector) ?? 0) + weights[i])
  }
  return bySector
}