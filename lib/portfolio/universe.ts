import { UniverseFilter } from './contracts'

// For PoC, start with a static large-cap set or load from a JSON file.
const US_LARGE_CAP_TICKERS = new Set<string>([
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'BRK.B', 'JPM', 'V', 'JNJ', 'WMT', 'DIS'
])

export async function validateUniverseMembership(
  symbols: string[],
  universe: UniverseFilter
): Promise<{ ok: boolean; outside: string[] }> {
  if (universe === 'US_ALL_CAP') {
    // For now, accept all and maybe add basic filters later (e.g. reject OTC)
    return { ok: true, outside: [] }
  }

  const outside: string[] = []
  for (const s of symbols) {
    if (!US_LARGE_CAP_TICKERS.has(s)) outside.push(s)
  }
  return { ok: outside.length === 0, outside }
}
// can later be backed with Finnhub profile data