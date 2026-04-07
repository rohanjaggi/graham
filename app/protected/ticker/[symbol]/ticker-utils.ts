import type React from 'react'
import type { CrisisHeuristics, RiskLevel, TickerData } from './ticker-types'

export function fmt(n: number | null, decimals = 2, suffix = ''): string {
  if (n == null) return '-'
  return n.toFixed(decimals) + suffix
}

export function fmtMarketCap(n: number | null): string {
  if (n == null) return '-'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}T`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}B`
  return `$${n.toFixed(0)}M`
}

export function fmtDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function scoreToLevel(score: number): RiskLevel {
  if (score >= 7) return 'High'
  if (score >= 4) return 'Medium'
  return 'Low'
}

function confidenceFromCoverage(totalItems: number): RiskLevel {
  if (totalItems >= 8) return 'High'
  if (totalItems >= 4) return 'Medium'
  return 'Low'
}

function bucketByKeyword(items: string[], mappings: Array<{ label: string; re: RegExp }>): string[] {
  const labels = new Set<string>()
  for (const item of items) {
    for (const mapping of mappings) {
      if (mapping.re.test(item)) labels.add(mapping.label)
    }
  }
  return Array.from(labels)
}

export function getCrisisHeuristics(
  data: TickerData,
  vulnerabilities: string[],
  channels: string[],
  nextSteps: string[]
): CrisisHeuristics {
  const fundingScore = (() => {
    let score = 3
    const de = data.debtEquity ?? 0
    const growth = data.revenueGrowth ?? 0
    if (de > 2) score += 4
    else if (de > 1) score += 2
    if (growth < 0) score += 1
    if (/financial|bank|insurance|real estate/i.test(data.sector || '')) score += 1
    return Math.min(10, score)
  })()

  const liquidityScore = (() => {
    let score = 3
    const absMove = Math.abs(data.priceChangePct ?? 0)
    const de = data.debtEquity ?? 0
    if (absMove > 5) score += 2
    if (de > 2) score += 2
    if ((data.marketCap ?? 0) < 10_000) score += 1
    if (/funding|liquidity|refinanc/i.test(vulnerabilities.join(' '))) score += 1
    return Math.min(10, score)
  })()

  const counterpartyScore = (() => {
    let score = 3
    const text = `${vulnerabilities.join(' ')} ${channels.join(' ')}`
    if (/counterparty|interbank|credit|derivative|broker|dealer/i.test(text)) score += 4
    if (/financial|bank|insurance/i.test(data.sector || '')) score += 2
    return Math.min(10, score)
  })()

  const sentimentScore = (() => {
    let score = 3
    const absMove = Math.abs(data.priceChangePct ?? 0)
    if (absMove > 6) score += 4
    else if (absMove > 3) score += 2
    if ((data.marketCap ?? 0) > 250_000) score += 1
    if (/news|sentiment|confidence|volatility/i.test(channels.join(' '))) score += 1
    return Math.min(10, score)
  })()

  const interconnectednessScore = (() => {
    let score = 3
    const text = `${channels.join(' ')} ${nextSteps.join(' ')}`
    if (/contagion|transmission|supply chain|counterparty|system|interconnect/i.test(text)) score += 3
    if ((data.marketCap ?? 0) > 500_000) score += 2
    if (/financial|technology|energy|healthcare/i.test(data.sector || '')) score += 1
    return Math.min(10, score)
  })()

  const exposureMatches = bucketByKeyword(
    [...vulnerabilities, ...channels, ...nextSteps],
    [
      { label: 'Funding liabilities', re: /funding|refinanc|maturity|short-term/i },
      { label: 'Credit exposures', re: /credit|default|counterparty|interbank/i },
      { label: 'Trading assets', re: /trading|mark-to-market|market contagion|asset price/i },
      { label: 'Derivatives', re: /derivative|hedg/i },
      { label: 'Consumer demand', re: /consumer|spending|retail/i },
      { label: 'Enterprise spending', re: /enterprise|business spend|capex/i },
      { label: 'Cloud and infrastructure', re: /cloud|infrastructure|data center/i },
      { label: 'Regulatory sensitivity', re: /regulator|policy|compliance|legal/i },
      { label: 'Global supply chain', re: /supply chain|logistics|geopolit/i },
    ]
  )

  const fallbackBySector = /financial|bank|insurance/i.test(data.sector || '')
    ? ['Funding liabilities', 'Credit exposures', 'Trading assets', 'Derivatives']
    : /technology/i.test(data.sector || '')
      ? ['Enterprise spending', 'Cloud and infrastructure', 'Consumer demand', 'Regulatory sensitivity']
      : ['Consumer demand', 'Global supply chain', 'Regulatory sensitivity']

  const exposureCategories = (exposureMatches.length > 0 ? exposureMatches : fallbackBySector).slice(0, 4)
  const coverage = vulnerabilities.length + channels.length + nextSteps.length

  return {
    fundingRisk: scoreToLevel(fundingScore),
    liquidityRisk: scoreToLevel(liquidityScore),
    counterpartyRisk: scoreToLevel(counterpartyScore),
    sentimentSensitivity: scoreToLevel(sentimentScore),
    interconnectedness: scoreToLevel(interconnectednessScore),
    confidenceLevel: confidenceFromCoverage(coverage),
    exposureCategories,
  }
}

export function riskBadgeStyle(level: RiskLevel): React.CSSProperties {
  if (level === 'High') return { color: '#ff88a0', background: 'rgba(240, 96, 112, 0.14)', border: '1px solid rgba(240, 96, 112, 0.36)' }
  if (level === 'Medium') return { color: '#e4c27a', background: 'rgba(212, 180, 117, 0.16)', border: '1px solid rgba(212, 180, 117, 0.34)' }
  return { color: '#78cda1', background: 'rgba(61, 214, 140, 0.14)', border: '1px solid rgba(61, 214, 140, 0.3)' }
}
