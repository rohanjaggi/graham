import { describe, expect, it } from 'vitest'
import { normalizeQaTicker, qaRequestSchema, qaResponseSchema } from '../qa/contracts'

describe('QA contracts', () => {
  it('normalizes supported tickers to uppercase', () => {
    expect(normalizeQaTicker(' jPm ')).toBe('JPM')
  })

  it('rejects invalid ticker payloads', () => {
    const result = qaRequestSchema.safeParse({ ticker: 'bad symbol!!' })
    expect(result.success).toBe(false)
  })

  it('accepts a structured QA response payload', () => {
    const result = qaResponseSchema.safeParse({
      entityOverview: {
        name: 'JPMorgan Chase & Co.',
        ticker: 'JPM',
        exchange: 'NYSE',
        sector: 'Financial Services',
        entityType: 'Bank',
        shortDescription: 'Large diversified bank.',
        systemicRelevance: 'Systemically important due to scale and interconnectedness.',
      },
      financialSnapshot: {
        price: '$245.10',
        marketCap: '$680B',
        volume: '8.1M',
        beta: '1.10',
        valuationMetric: 'P/B 1.9x',
        dividendYield: '2.1%',
        week52Range: '$180 - $248',
        week52PositionPct: 77,
        valuationSignals: ['P/B 1.9x'],
        profitabilityMetrics: ['ROE 17.4%'],
        balanceSheetMetrics: ['CET1 ratio reported in latest filings if available.'],
        tradingSignals: ['Trading in the upper half of the 52-week range'],
        institutionSpecificMetrics: ['CET1 ratio reported in latest filings if available.'],
      },
      quickAnalysis: {
        whatItIs: 'A global universal bank.',
        whyItMattersInCrisis: 'Likely important because of funding and counterparty links.',
        keyVulnerabilities: ['Funding mix sensitivity'],
        likelyTransmissionChannels: ['Credit markets'],
        whatToExploreNext: ['Check wholesale funding reliance'],
      },
      crisisRelevanceHeuristics: {
        fundingRisk: 'medium',
        liquidityRisk: 'medium',
        counterpartyRisk: 'high',
        marketSentimentSensitivity: 'medium',
        majorExposureCategories: ['Investment banking', 'Consumer credit'],
        interconnectedness: 'high',
        confidenceLevel: 'medium',
      },
      suggestedNextActions: ['View peers', 'Launch scenario', 'Trace contagion channels'],
      metadata: {
        generatedAt: '2026-03-31T00:00:00.000Z',
        cacheHit: false,
        sourceSummary: 'Based on company profile, delayed market data, recent news, and model synthesis.',
        guardrails: 'Facts may be delayed; inferences are marked as likely or may.',
      },
    })

    expect(result.success).toBe(true)
  })
})
