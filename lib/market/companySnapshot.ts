import { fetchCompanyMapping } from '@/lib/sec/edgar'

type FinnhubProfile = {
  name?: string
  exchange?: string
  finnhubIndustry?: string
  country?: string
  weburl?: string
  logo?: string
  marketCapitalization?: number
}

type FinnhubQuote = {
  c?: number
  d?: number
  dp?: number
  h?: number
  l?: number
  o?: number
  pc?: number
}

type FinnhubMetricsResponse = {
  metric?: Record<string, number | null | undefined>
}

export type MergedCompanySnapshot = {
  symbol: string
  name: string
  exchange: string | null
  sector: string | null
  country: string | null
  website: string | null
  logo: string | null
  marketCap: number | null
  price: number | null
  priceChange: number | null
  priceChangePct: number | null
  dayHigh: number | null
  dayLow: number | null
  open: number | null
  prevClose: number | null
  metrics: Record<string, number | null | undefined>
  dataWarnings: string[]
}

function takeString(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed) return trimmed
    }
  }
  return null
}

function takeNumber(...values: Array<unknown>): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return null
}

function deriveCountryFromLocation(location: string | null): string | null {
  if (!location) return null
  const parts = location.split(';').map((part) => part.trim()).filter(Boolean)
  return parts[parts.length - 1] ?? location
}

export async function fetchMergedCompanySnapshot(symbol: string, finnhubKey: string): Promise<MergedCompanySnapshot | null> {
  const base = 'https://finnhub.io/api/v1'

  const [profileRes, quoteRes, metricsRes, secMapping] = await Promise.all([
    fetch(`${base}/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${finnhubKey}`, { next: { revalidate: 3600 } })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null),
    fetch(`${base}/quote?symbol=${encodeURIComponent(symbol)}&token=${finnhubKey}`, { next: { revalidate: 60 } })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null),
    fetch(`${base}/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${finnhubKey}`, { next: { revalidate: 3600 } })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null),
    fetchCompanyMapping(symbol).catch(() => null),
  ])

  const profile = (profileRes ?? {}) as FinnhubProfile
  const quote = (quoteRes ?? {}) as FinnhubQuote
  const metrics = ((metricsRes ?? {}) as FinnhubMetricsResponse).metric ?? {}

  const name = takeString(profile.name, secMapping?.name)
  if (!name) return null

  const exchange = takeString(profile.exchange, secMapping?.exchange)
  const sector = takeString(profile.finnhubIndustry, secMapping?.sector, secMapping?.sicSector, secMapping?.industry)
  const country = takeString(profile.country, deriveCountryFromLocation(takeString(secMapping?.location)))
  const warnings: string[] = []

  if (!takeString(profile.name) && takeString(secMapping?.name)) warnings.push('Filled company identity from SEC mapping.')
  if (!takeString(profile.finnhubIndustry) && sector) warnings.push('Filled sector classification from SEC mapping.')
  if (!takeString(profile.exchange) && exchange) warnings.push('Filled exchange from SEC mapping.')

  return {
    symbol: symbol.toUpperCase(),
    name,
    exchange,
    sector,
    country,
    website: takeString(profile.weburl),
    logo: takeString(profile.logo),
    marketCap: takeNumber(profile.marketCapitalization),
    price: takeNumber(quote.c),
    priceChange: takeNumber(quote.d),
    priceChangePct: takeNumber(quote.dp),
    dayHigh: takeNumber(quote.h),
    dayLow: takeNumber(quote.l),
    open: takeNumber(quote.o),
    prevClose: takeNumber(quote.pc),
    metrics,
    dataWarnings: warnings,
  }
}

