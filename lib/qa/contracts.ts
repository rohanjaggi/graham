import { z } from 'zod'

const TICKER_PATTERN = /^[A-Z][A-Z0-9.-]{0,9}$/

export function normalizeQaTicker(value: string): string {
  const normalized = value.trim().toUpperCase()
  if (!TICKER_PATTERN.test(normalized)) {
    throw new Error('Enter a valid ticker like JPM or SPY.')
  }
  return normalized
}

export const qaRequestSchema = z.object({
  ticker: z.string()
    .trim()
    .min(1, 'Ticker is required.')
    .max(10, 'Ticker is too long.')
    .transform((value) => value.toUpperCase())
    .refine((value) => TICKER_PATTERN.test(value), 'Enter a valid ticker like JPM or SPY.'),
})

export const riskLevelSchema = z.enum(['low', 'medium', 'high', 'unknown'])

export const qaResponseSchema = z.object({
  entityOverview: z.object({
    name: z.string(),
    ticker: z.string(),
    exchange: z.string().nullable(),
    sector: z.string().nullable(),
    entityType: z.string(),
    shortDescription: z.string(),
    systemicRelevance: z.string(),
  }),
  financialSnapshot: z.object({
    price: z.string().nullable(),
    marketCap: z.string().nullable(),
    volume: z.string().nullable(),
    beta: z.string().nullable(),
    valuationMetric: z.string().nullable(),
    dividendYield: z.string().nullable(),
    week52Range: z.string().nullable(),
    week52PositionPct: z.number().min(0).max(100).nullable(),
    valuationSignals: z.array(z.string()).max(4),
    profitabilityMetrics: z.array(z.string()).max(4),
    balanceSheetMetrics: z.array(z.string()).max(4),
    tradingSignals: z.array(z.string()).max(4),
    institutionSpecificMetrics: z.array(z.string()).max(5),
  }),
  quickAnalysis: z.object({
    whatItIs: z.string(),
    whyItMattersInCrisis: z.string(),
    keyVulnerabilities: z.array(z.string()).min(1).max(5),
    likelyTransmissionChannels: z.array(z.string()).min(1).max(5),
    whatToExploreNext: z.array(z.string()).min(1).max(5),
  }),
  crisisRelevanceHeuristics: z.object({
    fundingRisk: riskLevelSchema,
    liquidityRisk: riskLevelSchema,
    counterpartyRisk: riskLevelSchema,
    marketSentimentSensitivity: riskLevelSchema,
    majorExposureCategories: z.array(z.string()).max(6),
    interconnectedness: riskLevelSchema,
    confidenceLevel: riskLevelSchema,
  }),
  suggestedNextActions: z.array(z.string()).min(3).max(5),
  metadata: z.object({
    generatedAt: z.string(),
    cacheHit: z.boolean(),
    sourceSummary: z.string(),
    guardrails: z.string(),
  }),
})

export type QaRequest = z.infer<typeof qaRequestSchema>
export type RiskLevel = z.infer<typeof riskLevelSchema>
export type QaResponse = z.infer<typeof qaResponseSchema>

export const qaResponseJsonExample: QaResponse = {
  entityOverview: {
    name: 'Example Institution',
    ticker: 'JPM',
    exchange: 'NYSE',
    sector: 'Financial Services',
    entityType: 'Bank',
    shortDescription: 'Short factual description based on available public data.',
    systemicRelevance: 'Based on available data, this firm likely matters because of its size or market links.',
  },
  financialSnapshot: {
    price: '$245.10',
    marketCap: '$690B',
    volume: '8.1M',
    beta: '1.10',
    valuationMetric: 'P/B 1.9x',
    dividendYield: '2.1%',
    week52Range: '$180.00 - $248.00',
    week52PositionPct: 78,
    valuationSignals: ['P/B 1.9x', 'Dividend yield 2.1%'],
    profitabilityMetrics: ['ROE 17.4%', 'EPS growth remains positive'],
    balanceSheetMetrics: ['Debt/Equity 1.3x', 'Capital ratios should be reviewed against peers'],
    tradingSignals: ['Trading in the upper half of its 52-week range', 'Beta suggests moderate market sensitivity'],
    institutionSpecificMetrics: ['ROE 17.4%', 'Debt/Equity 1.3x'],
  },
  quickAnalysis: {
    whatItIs: 'A concise factual description of the institution and its role.',
    whyItMattersInCrisis: 'A short inference using cautious language such as likely or may.',
    keyVulnerabilities: ['Funding mix sensitivity'],
    likelyTransmissionChannels: ['Credit markets'],
    whatToExploreNext: ['Compare liquidity profile vs peers'],
  },
  crisisRelevanceHeuristics: {
    fundingRisk: 'medium',
    liquidityRisk: 'medium',
    counterpartyRisk: 'high',
    marketSentimentSensitivity: 'medium',
    majorExposureCategories: ['Consumer credit', 'Capital markets'],
    interconnectedness: 'high',
    confidenceLevel: 'medium',
  },
  suggestedNextActions: ['View peers', 'Launch scenario', 'Trace contagion channels'],
  metadata: {
    generatedAt: new Date(0).toISOString(),
    cacheHit: false,
    sourceSummary: 'Based on delayed market data, recent company news, and model synthesis.',
    guardrails: 'Facts may be delayed; inferences should use confidence-aware language and avoid financial advice.',
  },
}
