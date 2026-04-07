export interface TickerData {
  symbol: string
  name: string
  exchange: string
  sector: string
  country: string
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
  pe: number | null
  pb: number | null
  evEbitda: number | null
  roe: number | null
  debtEquity: number | null
  revenueGrowth: number | null
  grossMargin: number | null
  dividendYield: number | null
  week52High: number | null
  week52Low: number | null
  news: { headline: string; source: string; datetime: number; url: string; summary: string }[]
}

export interface CompanySummaryResponse {
  summary?: string
  whatItIs?: string
  companyDescription?: string
  crisisRelevance?: string
  keyVulnerabilities?: string[]
  transmissionChannels?: string[]
  whatToExploreNext?: string[]
}

export type RiskLevel = 'Low' | 'Medium' | 'High'

export interface CrisisHeuristics {
  fundingRisk: RiskLevel
  liquidityRisk: RiskLevel
  counterpartyRisk: RiskLevel
  sentimentSensitivity: RiskLevel
  interconnectedness: RiskLevel
  confidenceLevel: RiskLevel
  exposureCategories: string[]
}

export interface AnalysisData {
  moat: string
  moatReasoning: string
  bullThesis: string[]
  bearThesis: string[]
  keyRisks: string[]
  managementSignals: string
  verdict: string
  verdictReasoning: string
  qualityScore: number
}
