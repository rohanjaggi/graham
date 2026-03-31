import OpenAI from 'openai'
import type { QaResponse, RiskLevel } from './contracts'
import { qaResponseSchema } from './contracts'

const QA_CACHE_TTL_MS = 15 * 60 * 1000
const QA_CACHE_TTL_SECONDS = Math.floor(QA_CACHE_TTL_MS / 1000)
const DEFAULT_GUARDRAILS = 'Facts may be delayed or incomplete. Inferences are phrased cautiously and are not financial advice.'

declare global {
  var __grahamQaCache: Map<string, { data: QaResponse; expiresAt: number }> | undefined
}

const qaCache = globalThis.__grahamQaCache ?? new Map<string, { data: QaResponse; expiresAt: number }>()
globalThis.__grahamQaCache = qaCache

export class QaServiceError extends Error {
  constructor(message: string, public readonly status = 500) {
    super(message)
    this.name = 'QaServiceError'
  }
}

type SourceSnapshot = {
  ticker: string
  name: string
  exchange: string | null
  sector: string | null
  entityType: string
  shortDescription: string
  marketCap: number | null
  price: number | null
  volume: number | null
  beta: number | null
  valuationMetric: string | null
  dividendYield: number | null
  week52High: number | null
  week52Low: number | null
  institutionSpecificMetrics: string[]
  newsHeadlines: string[]
  secExcerpt: string | null
}

type OpenAiResearchSnapshot = {
  notFound?: boolean
  name?: string
  exchange?: string | null
  sector?: string | null
  entityType?: string | null
  shortDescription?: string | null
  marketCap?: number | null
  price?: number | null
  volume?: number | null
  beta?: number | null
  valuationMetric?: string | null
  dividendYield?: number | null
  week52High?: number | null
  week52Low?: number | null
  institutionSpecificMetrics?: string[]
  newsHeadlines?: string[]
}

function formatCurrency(value: number | null, digits = 2): string | null {
  if (value == null || !Number.isFinite(value)) return null
  return `$${value.toFixed(digits)}`
}

function formatCompactNumber(value: number | null, digits = 1): string | null {
  if (value == null || !Number.isFinite(value)) return null
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(digits)}T`
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(digits)}B`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(digits)}M`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(digits)}K`
  return value.toFixed(digits)
}

function formatMarketCap(marketCapInMillions: number | null): string | null {
  if (marketCapInMillions == null || !Number.isFinite(marketCapInMillions)) return null
  if (marketCapInMillions >= 1_000_000) return `$${(marketCapInMillions / 1_000_000).toFixed(2)}T`
  if (marketCapInMillions >= 1_000) return `$${(marketCapInMillions / 1_000).toFixed(1)}B`
  return `$${marketCapInMillions.toFixed(0)}M`
}

function formatPercent(value: number | null, digits = 1): string | null {
  if (value == null || !Number.isFinite(value)) return null
  return `${value.toFixed(digits)}%`
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function deriveEntityType(ticker: string, name: string, sector: string | null): string {
  const combined = `${ticker} ${name} ${sector ?? ''}`.toLowerCase()
  if (/\betf\b|fund|spdr|trust/.test(combined) || ticker === 'SPY' || ticker === 'XLF') return 'ETF'
  if (/insurance|assurance/.test(combined) || ticker === 'AIG') return 'Insurer'
  if (/bank|bancorp|banco|financial/.test(combined) || ['JPM', 'BAC', 'C'].includes(ticker)) return 'Bank'
  if (/goldman|broker|capital markets|investment/.test(combined) || ticker === 'GS') return 'Broker / Investment Bank'
  return 'Listed company'
}

function pushUnique(values: string[], candidate: string) {
  if (!values.includes(candidate)) values.push(candidate)
}

function mapRiskFromBeta(beta: number | null): RiskLevel {
  if (beta == null) return 'unknown'
  if (beta >= 1.25) return 'high'
  if (beta >= 0.95) return 'medium'
  return 'low'
}

function confidenceFromSnapshot(snapshot: SourceSnapshot): RiskLevel {
  const score = [snapshot.price, snapshot.marketCap, snapshot.beta].filter((item) => item != null).length + snapshot.newsHeadlines.length + (snapshot.secExcerpt ? 2 : 0)
  if (score >= 6) return 'high'
  if (score >= 3) return 'medium'
  return 'low'
}

function computeRangePosition(current: number | null, low: number | null, high: number | null): number | null {
  if (current == null || low == null || high == null || high <= low) return null
  const pct = ((current - low) / (high - low)) * 100
  return Math.max(0, Math.min(100, Number(pct.toFixed(1))))
}

function buildHeuristics(snapshot: SourceSnapshot) {
  const sentiment = mapRiskFromBeta(snapshot.beta)
  const fundingRisk: RiskLevel = snapshot.entityType.includes('Bank') || snapshot.entityType.includes('Broker')
    ? 'high'
    : snapshot.entityType.includes('Insurer') || snapshot.entityType === 'ETF'
      ? 'medium'
      : sentiment

  const liquidityRisk: RiskLevel = snapshot.entityType === 'ETF'
    ? 'medium'
    : snapshot.volume != null && snapshot.volume >= 5_000_000
      ? 'low'
      : snapshot.volume != null && snapshot.volume >= 1_000_000
        ? 'medium'
        : snapshot.volume == null
          ? 'unknown'
          : 'high'

  const counterpartyRisk: RiskLevel = snapshot.entityType.includes('Bank') || snapshot.entityType.includes('Broker')
    ? 'high'
    : snapshot.entityType.includes('Insurer')
      ? 'medium'
      : snapshot.entityType === 'ETF'
        ? 'medium'
        : 'low'

  const interconnectedness: RiskLevel = snapshot.marketCap != null && snapshot.marketCap >= 100_000
    ? 'high'
    : snapshot.marketCap != null && snapshot.marketCap >= 20_000
      ? 'medium'
      : 'low'

  const exposures: string[] = []
  if (snapshot.entityType.includes('Bank')) {
    pushUnique(exposures, 'Wholesale funding')
    pushUnique(exposures, 'Credit markets')
    pushUnique(exposures, 'Counterparty networks')
  } else if (snapshot.entityType.includes('Broker')) {
    pushUnique(exposures, 'Capital markets')
    pushUnique(exposures, 'Prime brokerage')
    pushUnique(exposures, 'Derivatives counterparties')
  } else if (snapshot.entityType.includes('Insurer')) {
    pushUnique(exposures, 'Insurance liabilities')
    pushUnique(exposures, 'Investment portfolio marks')
    pushUnique(exposures, 'Credit-sensitive assets')
  } else if (snapshot.entityType === 'ETF') {
    pushUnique(exposures, 'Sector ETF flows')
    pushUnique(exposures, 'Passive sentiment swings')
    pushUnique(exposures, 'Underlying financials basket')
  } else {
    pushUnique(exposures, snapshot.sector ?? 'Sector exposure')
    pushUnique(exposures, 'Market sentiment')
  }

  return {
    fundingRisk,
    liquidityRisk,
    counterpartyRisk,
    marketSentimentSensitivity: sentiment,
    majorExposureCategories: exposures.slice(0, 6),
    interconnectedness,
    confidenceLevel: confidenceFromSnapshot(snapshot),
  }
}

function buildFallbackResponse(snapshot: SourceSnapshot, cacheHit: boolean, aiUsed: boolean): QaResponse {
  const heuristics = buildHeuristics(snapshot)
  const week52PositionPct = computeRangePosition(snapshot.price, snapshot.week52Low, snapshot.week52High)

  const vulnerabilities: string[] = []
  if (heuristics.fundingRisk === 'high') vulnerabilities.push('May be sensitive to funding-market stress or deposit/wholesale outflows.')
  if (heuristics.counterpartyRisk === 'high') vulnerabilities.push('Likely exposed to broader counterparty confidence and balance-sheet transmission.')
  if (heuristics.marketSentimentSensitivity !== 'low') vulnerabilities.push('Share-price and sentiment may react quickly during risk-off periods.')
  if (snapshot.valuationMetric) vulnerabilities.push(`Valuation context currently shows ${snapshot.valuationMetric}, which is best read alongside peers rather than in isolation.`)
  if (vulnerabilities.length === 0) vulnerabilities.push('No single public metric fully explains crisis risk; scenario testing is still useful.')

  const transmissionChannels: string[] = []
  if (snapshot.entityType.includes('Bank') || snapshot.entityType.includes('Broker')) {
    transmissionChannels.push('Funding and repo markets', 'Counterparty balance sheets', 'Credit spreads and confidence')
  } else if (snapshot.entityType.includes('Insurer')) {
    transmissionChannels.push('Investment portfolio losses', 'Credit-sensitive assets', 'Confidence in liabilities and reserves')
  } else if (snapshot.entityType === 'ETF') {
    transmissionChannels.push('ETF flow pressure', 'Sector-wide de-risking', 'Index and sentiment feedback loops')
  } else {
    transmissionChannels.push('Equity sentiment', 'Supplier or customer confidence', 'Sector valuation repricing')
  }

  const nextChecks = [
    'Compare this name against peers on valuation and balance-sheet resilience.',
    'Run a stress scenario to test market-sentiment and funding assumptions.',
    'Trace which exposures or channels could amplify a broader shock.',
  ]

  const valuationSignals: string[] = []
  if (snapshot.valuationMetric) valuationSignals.push(`Primary multiple: ${snapshot.valuationMetric}`)
  if (snapshot.marketCap != null) valuationSignals.push(`Scale: ${formatMarketCap(snapshot.marketCap)}`)
  if (snapshot.dividendYield != null) valuationSignals.push(`Dividend yield: ${formatPercent(snapshot.dividendYield, 2)}`)
  if (valuationSignals.length === 0) valuationSignals.push('Public-web valuation coverage was limited; compare multiple levels against direct peers.')

  const profitabilityMetrics = snapshot.institutionSpecificMetrics.filter((item) => /roe|margin|eps|growth|return/i.test(item))
  if (profitabilityMetrics.length === 0) {
    profitabilityMetrics.push('Review earnings quality, ROE, margins, and revenue growth in the latest filings or peer set.')
  }

  const balanceSheetMetrics = snapshot.institutionSpecificMetrics.filter((item) => /debt|capital|cet1|book|liquidity|reserve/i.test(item))
  if (balanceSheetMetrics.length === 0) {
    balanceSheetMetrics.push(
      snapshot.entityType.includes('Bank') || snapshot.entityType.includes('Insurer')
        ? 'Focus on capital ratios, funding mix, reserves, and liquidity disclosures.'
        : 'Check leverage, cash coverage, and refinancing needs against sector peers.'
    )
  }

  const tradingSignals: string[] = []
  if (week52PositionPct != null) {
    tradingSignals.push(
      week52PositionPct >= 70
        ? `Trading near the upper end of its 52-week range (${week52PositionPct}%).`
        : week52PositionPct <= 30
          ? `Trading near the lower end of its 52-week range (${week52PositionPct}%).`
          : `Trading around the middle of its 52-week range (${week52PositionPct}%).`
    )
  }
  if (snapshot.beta != null) {
    tradingSignals.push(
      snapshot.beta >= 1.2
        ? `Beta ${snapshot.beta.toFixed(2)} suggests above-market sensitivity.`
        : snapshot.beta <= 0.85
          ? `Beta ${snapshot.beta.toFixed(2)} suggests more defensive trading behavior.`
          : `Beta ${snapshot.beta.toFixed(2)} suggests moderate market sensitivity.`
    )
  }
  if (snapshot.volume != null) {
    tradingSignals.push(`Typical daily volume around ${formatCompactNumber(snapshot.volume)} points to ${snapshot.volume >= 5_000_000 ? 'strong' : 'moderate'} trading liquidity.`)
  }
  if (tradingSignals.length === 0) {
    tradingSignals.push('Public trading data was limited; monitor price momentum, liquidity, and volatility in context.')
  }

  return qaResponseSchema.parse({
    entityOverview: {
      name: snapshot.name,
      ticker: snapshot.ticker,
      exchange: snapshot.exchange,
      sector: snapshot.sector,
      entityType: snapshot.entityType,
      shortDescription: snapshot.shortDescription,
      systemicRelevance:
        heuristics.interconnectedness === 'high'
          ? 'Based on available public data, this name appears systemically relevant because of its scale, sector role, or market linkages.'
          : 'Based on available public data, this name may matter more through sector sentiment or localized spillovers than through system-wide dominance.',
    },
    financialSnapshot: {
      price: formatCurrency(snapshot.price),
      marketCap: formatMarketCap(snapshot.marketCap),
      volume: formatCompactNumber(snapshot.volume),
      beta: snapshot.beta != null ? snapshot.beta.toFixed(2) : null,
      valuationMetric: snapshot.valuationMetric,
      dividendYield: formatPercent(snapshot.dividendYield, 2),
      week52Range: snapshot.week52Low != null || snapshot.week52High != null
        ? `${formatCurrency(snapshot.week52Low) ?? '—'} - ${formatCurrency(snapshot.week52High) ?? '—'}`
        : null,
      week52PositionPct,
      valuationSignals: valuationSignals.slice(0, 4),
      profitabilityMetrics: profitabilityMetrics.slice(0, 4),
      balanceSheetMetrics: balanceSheetMetrics.slice(0, 4),
      tradingSignals: tradingSignals.slice(0, 4),
      institutionSpecificMetrics: snapshot.institutionSpecificMetrics,
    },
    quickAnalysis: {
      whatItIs: `${snapshot.name} is a ${snapshot.entityType.toLowerCase()} listed on ${snapshot.exchange ?? 'its primary exchange'} and grouped under ${snapshot.sector ?? 'its reported sector'} based on available market data.`,
      whyItMattersInCrisis: snapshot.entityType === 'ETF'
        ? 'In a crisis, this fund may matter because it can reflect and amplify rapid sentiment shifts across the financial sector.'
        : 'In a crisis, this institution likely matters because funding confidence, counterparty trust, and market sentiment can move together under stress.',
      keyVulnerabilities: vulnerabilities.slice(0, 5),
      likelyTransmissionChannels: transmissionChannels.slice(0, 5),
      whatToExploreNext: nextChecks.slice(0, 5),
    },
    crisisRelevanceHeuristics: heuristics,
    suggestedNextActions: ['View peers', 'Launch scenario', 'Trace contagion channels', 'Inspect vulnerabilities', 'Compare similar institutions'],
    metadata: {
      generatedAt: new Date().toISOString(),
      cacheHit,
      sourceSummary: aiUsed
        ? 'Based on OpenAI web search, public web sources, SEC filing excerpts, and model synthesis.'
        : 'Based on OpenAI web search, public web sources, SEC filing excerpts, and rule-based fallbacks when AI context is unavailable.',
      guardrails: DEFAULT_GUARDRAILS,
    },
  })
}

function buildPrompt(snapshot: SourceSnapshot): string {
  const lines = [
    `Ticker: ${snapshot.ticker}`,
    `Name: ${snapshot.name}`,
    `Exchange: ${snapshot.exchange ?? 'Unavailable'}`,
    `Sector: ${snapshot.sector ?? 'Unavailable'}`,
    `Entity type hint: ${snapshot.entityType}`,
    `Price: ${formatCurrency(snapshot.price) ?? 'Unavailable'}`,
    `Market cap: ${formatMarketCap(snapshot.marketCap) ?? 'Unavailable'}`,
    `Volume: ${formatCompactNumber(snapshot.volume) ?? 'Unavailable'}`,
    `Beta: ${snapshot.beta != null ? snapshot.beta.toFixed(2) : 'Unavailable'}`,
    `Primary valuation metric: ${snapshot.valuationMetric ?? 'Unavailable'}`,
    `Dividend yield: ${formatPercent(snapshot.dividendYield, 2) ?? 'Unavailable'}`,
    `52-week range: ${snapshot.week52Low != null || snapshot.week52High != null ? `${formatCurrency(snapshot.week52Low) ?? '—'} - ${formatCurrency(snapshot.week52High) ?? '—'}` : 'Unavailable'}`,
    `Institution-specific metrics: ${snapshot.institutionSpecificMetrics.length ? snapshot.institutionSpecificMetrics.join('; ') : 'Unavailable'}`,
    '',
    'Recent headlines:',
    snapshot.newsHeadlines.length ? snapshot.newsHeadlines.map((item) => `- ${item}`).join('\n') : '- No recent headlines available.',
    '',
    'SEC filing excerpt:',
    snapshot.secExcerpt ?? 'Unavailable',
  ]

  return lines.join('\n')
}

function extractJsonObject(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start >= 0 && end > start) {
      return JSON.parse(raw.slice(start, end + 1))
    }
    return null
  }
}

async function fetchSecExcerpt(symbol: string): Promise<string | null> {
  try {
    const tickerMap = await fetch('https://www.sec.gov/files/company_tickers.json', {
      headers: { 'User-Agent': 'Graham-App contact@graham.app' },
      next: { revalidate: 86400 },
    }).then((response) => response.json())

    const entry = Object.values(tickerMap as Record<string, { cik_str: number; ticker: string; title: string }>).find(
      (item) => item.ticker.toUpperCase() === symbol.toUpperCase()
    )

    if (!entry) return null

    const cik = String(entry.cik_str).padStart(10, '0')
    const submissions = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
      headers: { 'User-Agent': 'Graham-App contact@graham.app' },
      next: { revalidate: 86400 },
    }).then((response) => response.json())

    const filings = submissions.filings?.recent
    if (!filings) return null

    const index = filings.form?.findIndex((form: string) => form === '10-K' || form === '20-F')
    if (index == null || index < 0) return null

    const filingText = await fetch(
      `https://www.sec.gov/Archives/edgar/data/${entry.cik_str}/${String(filings.accessionNumber[index]).replace(/-/g, '')}/${filings.primaryDocument[index]}`,
      { headers: { 'User-Agent': 'Graham-App contact@graham.app' }, next: { revalidate: 86400 } }
    ).then((response) => response.text())

    return filingText
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 4000) || null
  } catch {
    return null
  }
}

async function loadSourceSnapshot(ticker: string): Promise<SourceSnapshot> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new QaServiceError('Missing OPENAI_API_KEY', 500)

  const model = process.env.OPENAI_QA_MODEL ?? 'gpt-4.1-mini'
  const openai = new OpenAI({ apiKey })
  const secExcerpt = await fetchSecExcerpt(ticker)

  const researchPrompt = [
    `Research the public-market ticker "${ticker}" using web search.`,
    'Return JSON only with the following shape:',
    JSON.stringify({
      notFound: false,
      name: 'string',
      exchange: 'string | null',
      sector: 'string | null',
      entityType: 'string | null',
      shortDescription: 'string | null',
      marketCap: 'number | null (USD millions)',
      price: 'number | null',
      volume: 'number | null',
      beta: 'number | null',
      valuationMetric: 'string | null',
      dividendYield: 'number | null',
      week52High: 'number | null',
      week52Low: 'number | null',
      institutionSpecificMetrics: ['string'],
      newsHeadlines: ['string'],
    }, null, 2),
    'Rules:',
    '- Use web sources and public company information only.',
    '- Do not invent missing numbers or exposures.',
    '- If data is unavailable, return null or an empty array.',
    '- If the ticker cannot be identified, return {"notFound": true}.',
    '- Keep shortDescription to 1 sentence and newsHeadlines to 3 to 6 short items.',
    secExcerpt ? `Relevant SEC excerpt:\n${secExcerpt}` : 'SEC excerpt unavailable.',
  ].join('\n')

  let candidate: OpenAiResearchSnapshot | null = null

  try {
    const response = await openai.responses.create({
      model,
      instructions: 'You identify listed companies and ETFs from public web data and return strict JSON only.',
      input: researchPrompt,
      temperature: 0.1,
      tools: [{ type: 'web_search_preview', search_context_size: 'medium' }],
    } as never)

    const parsed = extractJsonObject((response as unknown as { output_text?: string }).output_text ?? '{}')
    if (parsed && typeof parsed === 'object') {
      candidate = parsed as OpenAiResearchSnapshot
    }
  } catch {
    candidate = null
  }

  if (candidate?.notFound) {
    throw new QaServiceError('Ticker not found.', 404)
  }

  const name = typeof candidate?.name === 'string' && candidate.name.trim()
    ? candidate.name.trim()
    : ticker
  const sector = typeof candidate?.sector === 'string' && candidate.sector.trim()
    ? candidate.sector.trim()
    : null
  const entityType = typeof candidate?.entityType === 'string' && candidate.entityType.trim()
    ? candidate.entityType.trim()
    : deriveEntityType(ticker, name, sector)

  return {
    ticker,
    name,
    exchange: typeof candidate?.exchange === 'string' && candidate.exchange.trim() ? candidate.exchange.trim() : null,
    sector,
    entityType,
    shortDescription: typeof candidate?.shortDescription === 'string' && candidate.shortDescription.trim()
      ? candidate.shortDescription.trim()
      : `${name} appears in public web sources as a ${entityType.toLowerCase()}${sector ? ` within the ${sector} sector` : ''}.`,
    marketCap: asNumber(candidate?.marketCap),
    price: asNumber(candidate?.price),
    volume: asNumber(candidate?.volume),
    beta: asNumber(candidate?.beta),
    valuationMetric: typeof candidate?.valuationMetric === 'string' && candidate.valuationMetric.trim() ? candidate.valuationMetric.trim() : null,
    dividendYield: asNumber(candidate?.dividendYield),
    week52High: asNumber(candidate?.week52High),
    week52Low: asNumber(candidate?.week52Low),
    institutionSpecificMetrics: Array.isArray(candidate?.institutionSpecificMetrics)
      ? candidate.institutionSpecificMetrics.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 5)
      : [],
    newsHeadlines: Array.isArray(candidate?.newsHeadlines)
      ? candidate.newsHeadlines.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 6)
      : [],
    secExcerpt,
  }
}

async function requestOpenAiResponse(snapshot: SourceSnapshot): Promise<unknown | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const model = process.env.OPENAI_QA_MODEL ?? 'gpt-4.1-mini'
  const openai = new OpenAI({ apiKey })
  const instructions = `You are a senior crisis-simulation research analyst.\nReturn JSON only.\n\nRules:\n- Be concise, analyst-like, and beginner-friendly.\n- Distinguish fact from inference.\n- Use confidence-aware wording such as likely, may, or based on available data.\n- Do not provide financial advice.\n- Never invent real-time certainty, exact exposures, or unavailable ratios.\n- If a metric is missing, keep the field null or state that it is unavailable.\n- suggestedNextActions must contain 3 to 5 simulator actions.\n\nUse this exact JSON shape:\n${JSON.stringify({
    entityOverview: {
      name: 'string',
      ticker: 'string',
      exchange: 'string | null',
      sector: 'string | null',
      entityType: 'string',
      shortDescription: 'string',
      systemicRelevance: 'string',
    },
    financialSnapshot: {
      price: 'string | null',
      marketCap: 'string | null',
      volume: 'string | null',
      beta: 'string | null',
      valuationMetric: 'string | null',
      dividendYield: 'string | null',
      week52Range: 'string | null',
      week52PositionPct: 'number | null',
      valuationSignals: ['string'],
      profitabilityMetrics: ['string'],
      balanceSheetMetrics: ['string'],
      tradingSignals: ['string'],
      institutionSpecificMetrics: ['string'],
    },
    quickAnalysis: {
      whatItIs: 'string',
      whyItMattersInCrisis: 'string',
      keyVulnerabilities: ['string'],
      likelyTransmissionChannels: ['string'],
      whatToExploreNext: ['string'],
    },
    crisisRelevanceHeuristics: {
      fundingRisk: 'low | medium | high | unknown',
      liquidityRisk: 'low | medium | high | unknown',
      counterpartyRisk: 'low | medium | high | unknown',
      marketSentimentSensitivity: 'low | medium | high | unknown',
      majorExposureCategories: ['string'],
      interconnectedness: 'low | medium | high | unknown',
      confidenceLevel: 'low | medium | high | unknown',
    },
    suggestedNextActions: ['View peers', 'Launch scenario', 'Trace contagion channels'],
    metadata: {
      generatedAt: 'ISO timestamp',
      cacheHit: false,
      sourceSummary: 'string',
      guardrails: '${DEFAULT_GUARDRAILS}',
    },
  }, null, 2)}`

  const prompt = buildPrompt(snapshot)

  try {
    const response = await openai.responses.create({
      model,
      instructions,
      input: prompt,
      temperature: 0.2,
      tools: [{ type: 'web_search_preview', search_context_size: 'medium' }],
    } as never)

    return extractJsonObject((response as unknown as { output_text?: string }).output_text ?? '{}')
  } catch {
    try {
      const completion = await openai.chat.completions.create({
        model,
        response_format: { type: 'json_object' },
        temperature: 0.2,
        messages: [
          { role: 'system', content: instructions },
          { role: 'user', content: prompt },
        ],
      })

      return extractJsonObject(completion.choices[0]?.message?.content ?? '{}')
    } catch {
      return null
    }
  }
}

function mergeResponse(base: QaResponse, candidate: unknown, cacheHit: boolean, aiUsed: boolean): QaResponse {
  if (!candidate || typeof candidate !== 'object') return base

  const merged = {
    ...base,
    ...candidate,
    entityOverview: { ...base.entityOverview, ...((candidate as QaResponse).entityOverview ?? {}) },
    financialSnapshot: { ...base.financialSnapshot, ...((candidate as QaResponse).financialSnapshot ?? {}) },
    quickAnalysis: { ...base.quickAnalysis, ...((candidate as QaResponse).quickAnalysis ?? {}) },
    crisisRelevanceHeuristics: { ...base.crisisRelevanceHeuristics, ...((candidate as QaResponse).crisisRelevanceHeuristics ?? {}) },
    suggestedNextActions: Array.isArray((candidate as QaResponse).suggestedNextActions)
      ? (candidate as QaResponse).suggestedNextActions
      : base.suggestedNextActions,
    metadata: {
      ...base.metadata,
      ...((candidate as QaResponse).metadata ?? {}),
      generatedAt: new Date().toISOString(),
      cacheHit,
      sourceSummary: aiUsed
        ? 'Based on OpenAI web search, public web sources, SEC filing excerpts, and model synthesis.'
        : base.metadata.sourceSummary,
      guardrails: DEFAULT_GUARDRAILS,
    },
  }

  const parsed = qaResponseSchema.safeParse(merged)
  return parsed.success ? parsed.data : base
}

export async function getQualitativeAnalysis(ticker: string): Promise<QaResponse> {
  const cached = qaCache.get(ticker)
  if (cached && cached.expiresAt > Date.now()) {
    return {
      ...cached.data,
      metadata: {
        ...cached.data.metadata,
        cacheHit: true,
      },
    }
  }

  if (cached) qaCache.delete(ticker)

  const snapshot = await loadSourceSnapshot(ticker)
  const aiCandidate = await requestOpenAiResponse(snapshot)
  const fallback = buildFallbackResponse(snapshot, false, Boolean(aiCandidate))
  const finalResponse = mergeResponse(fallback, aiCandidate, false, Boolean(aiCandidate))

  qaCache.set(ticker, {
    data: finalResponse,
    expiresAt: Date.now() + QA_CACHE_TTL_MS,
  })

  return finalResponse
}

export { QA_CACHE_TTL_SECONDS }
