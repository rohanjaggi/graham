export interface CompanyData {
  symbol: string
  name: string
  sector: string
  marketCap: number | null
  price: number | null
  pe: number | null
  pb: number | null
  evEbitda: number | null
  evRevenue: number | null
  roe: number | null
  grossMargin: number | null
  revenueGrowth: number | null
  debtEquity: number | null
}

export interface PeerAssessment {
  symbol: string
  score: number
  keep: boolean
  reason: string
  aiAdded?: boolean
}

export interface MetricWeight {
  score: number
  reason: string
}

export interface AiInsights {
  peerAssessments: PeerAssessment[]
  suggestedAdditions: string[]
  metricWeights: Record<string, MetricWeight>
  analystNote: string
}

export interface CompsData {
  subject: CompanyData
  peers: CompanyData[]
  aiInsights: AiInsights | null
}

export interface SearchResult {
  symbol: string
  description: string
  updatedAt?: string
}
