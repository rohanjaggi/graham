const SEC_USER_AGENT = 'Graham-App contact@graham.app'
const SEC_MAPPING_TTL_MS = 24 * 60 * 60 * 1000
const SEC_EXCERPT_TTL_MS = 24 * 60 * 60 * 1000

export type SecMappingCompany = {
  cik?: string
  ticker?: string
  name?: string
  isDelisted?: boolean
  exchange?: string
  sector?: string
  industry?: string
  sicSector?: string
  location?: string
  currency?: string
}

type SecQueryResponse = {
  filings?: Array<{
    linkToFilingDetails?: string
    linkToTxt?: string
    accessionNo?: string
    formType?: string
  }>
}

type SecMappingCacheEntry = {
  fetchedAt: number
  value: SecMappingCompany | null
}

type FilingExcerptCacheEntry = {
  fetchedAt: number
  value: string | null
}

const secMappingCache = new Map<string, SecMappingCacheEntry>()
const filingExcerptCache = new Map<string, FilingExcerptCacheEntry>()

function getSecApiKey() {
  const value = process.env.SEC_API_KEY?.trim()
  return value ? value : null
}

function getSecApiHeaders(): Record<string, string> {
  const apiKey = getSecApiKey()
  return apiKey ? { Authorization: apiKey } : {}
}

async function resolveCikViaSecApi(symbol: string): Promise<string | null> {
  const data = await fetchCompanyMapping(symbol)
  if (!data) return null

  const cik = typeof data.cik === 'string' ? data.cik.trim() : ''
  return cik || null
}

export async function fetchCompanyMapping(symbol: string): Promise<SecMappingCompany | null> {
  const apiKey = getSecApiKey()
  if (!apiKey) return null

  const normalizedSymbol = symbol.trim().toUpperCase()
  if (!normalizedSymbol) return null

  const cached = secMappingCache.get(normalizedSymbol)
  if (cached && Date.now() - cached.fetchedAt < SEC_MAPPING_TTL_MS) {
    return cached.value
  }

  const response = await fetch(`https://api.sec-api.io/mapping/ticker/${encodeURIComponent(normalizedSymbol)}`, {
    headers: {
      ...getSecApiHeaders(),
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    secMappingCache.set(normalizedSymbol, { fetchedAt: Date.now(), value: null })
    return null
  }

  const data = await response.json().catch(() => null)
  if (!Array.isArray(data) || data.length === 0) {
    secMappingCache.set(normalizedSymbol, { fetchedAt: Date.now(), value: null })
    return null
  }

  const preferred = (data as SecMappingCompany[]).find((entry) => entry.isDelisted === false)
    ?? (data as SecMappingCompany[])[0]

  const trimmed = preferred
    ? {
        cik: preferred.cik,
        ticker: preferred.ticker,
        name: preferred.name,
        isDelisted: preferred.isDelisted,
        exchange: preferred.exchange,
        sector: preferred.sector,
        industry: preferred.industry,
        sicSector: preferred.sicSector,
        location: preferred.location,
        currency: preferred.currency,
      }
    : null

  secMappingCache.set(normalizedSymbol, { fetchedAt: Date.now(), value: trimmed })
  return trimmed
}

async function resolveCikViaSecGov(symbol: string): Promise<string | null> {
  const tickerMap = await fetch('https://www.sec.gov/files/company_tickers.json', {
    headers: { 'User-Agent': SEC_USER_AGENT },
    next: { revalidate: 86400 },
  }).then((response) => (response.ok ? response.json() : null))

  if (!tickerMap || typeof tickerMap !== 'object') return null

  const entry = Object.values(tickerMap as Record<string, { cik_str: number; ticker: string }>)
    .find((item) => item?.ticker?.toUpperCase() === symbol.toUpperCase())

  if (!entry) return null

  return String(entry.cik_str).padStart(10, '0')
}

export async function resolveCompanyCik(symbol: string): Promise<string | null> {
  return (await resolveCikViaSecApi(symbol)) ?? (await resolveCikViaSecGov(symbol))
}

async function findLatestAnnualFilingUrlViaSecApi(symbol: string): Promise<string | null> {
  const apiKey = getSecApiKey()
  if (!apiKey) return null

  const response = await fetch('https://api.sec-api.io', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getSecApiHeaders(),
    },
    body: JSON.stringify({
      query: `ticker:${symbol.toUpperCase()} AND (formType:"10-K" OR formType:"20-F") AND NOT formType:"10-K/A" AND NOT formType:"20-F/A"`,
      from: '0',
      size: '1',
      sort: [{ filedAt: { order: 'desc' } }],
    }),
    next: { revalidate: 86400 },
  })

  if (!response.ok) return null

  const data = (await response.json().catch(() => null)) as SecQueryResponse | null
  const filing = data?.filings?.[0]
  return filing?.linkToFilingDetails ?? filing?.linkToTxt ?? null
}

async function findLatestAnnualFilingUrlViaSecGov(symbol: string): Promise<string | null> {
  const cik = await resolveCikViaSecGov(symbol)
  if (!cik) return null

  const submissions = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
    headers: { 'User-Agent': SEC_USER_AGENT },
    next: { revalidate: 86400 },
  }).then((response) => (response.ok ? response.json() : null))

  const filings = submissions?.filings?.recent
  if (!filings) return null

  const index = filings.form?.findIndex((form: string) => form === '10-K' || form === '20-F')
  if (index == null || index < 0) return null

  const compactAccession = String(filings.accessionNumber[index]).replace(/-/g, '')
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${compactAccession}/${filings.primaryDocument[index]}`
}

export async function findLatestAnnualFilingUrl(symbol: string): Promise<string | null> {
  return (await findLatestAnnualFilingUrlViaSecApi(symbol)) ?? (await findLatestAnnualFilingUrlViaSecGov(symbol))
}

export async function fetchLatestAnnualFilingExcerpt(symbol: string, maxChars = 4000): Promise<string | null> {
  try {
    const normalizedSymbol = symbol.trim().toUpperCase()
    if (!normalizedSymbol) return null

    const cacheKey = `${normalizedSymbol}:${maxChars}`
    const cached = filingExcerptCache.get(cacheKey)
    if (cached && Date.now() - cached.fetchedAt < SEC_EXCERPT_TTL_MS) {
      return cached.value
    }

    const filingUrl = await findLatestAnnualFilingUrl(normalizedSymbol)
    if (!filingUrl) return null

    const response = await fetch(filingUrl, {
      headers: { 'User-Agent': SEC_USER_AGENT },
      cache: 'no-store',
    })

    if (!response.ok) return null

    const filingText = await response.text()

    const excerpt = filingText
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, maxChars) || null

    filingExcerptCache.set(cacheKey, { fetchedAt: Date.now(), value: excerpt })
    return excerpt
  } catch {
    return null
  }
}
