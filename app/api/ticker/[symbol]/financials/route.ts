import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface FinancialRow {
  concept: string
  label: string
  values: (number | null)[]  // one per year, newest first
}

export interface RevenueSegment {
  name: string
  value: number
  pct: number
  growthYoy: number | null
}

export interface ExtendedMetrics {
  // Buffett
  roeTTM: number | null
  roicTTM: number | null
  grossMarginTTM: number | null
  netMarginTTM: number | null
  operatingMarginTTM: number | null
  freeCashFlowAnnual: number | null
  revenueGrowth5Y: number | null
  epsGrowth5Y: number | null
  dividendYieldAnnual: number | null
  debtEquity: number | null
  cashFlowPerShare: number | null
  // Graham
  peNormalized: number | null
  pb: number | null
  currentRatio: number | null
  quickRatio: number | null
  // Lynch
  pegRatio: number | null
  revenueGrowthTTM: number | null
  inventoryTurnover: number | null
  // Burry
  evEbitda: number | null
  priceFCF: number | null
  ltDebtToCapitalization: number | null
}

export interface FinancialsApiResponse {
  years: number[]
  annualIncome: FinancialRow[]
  annualBalance: FinancialRow[]
  annualCashFlow: FinancialRow[]
  extendedMetrics: ExtendedMetrics
  segments: RevenueSegment[] | null
}

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function yearFromEndDate(v: unknown): number | null {
  if (typeof v !== 'string' || v.length < 4) return null
  const y = Number(v.slice(0, 4))
  return Number.isFinite(y) ? y : null
}

// Extract line items from a financials-reported section array
function pickConcept(rows: Array<Record<string, unknown>>, ...needles: string[]): number | null {
  for (const row of rows) {
    const concept = typeof row.concept === 'string' ? row.concept.toLowerCase() : ''
    if (!concept) continue
    if (!needles.some(n => concept.includes(n.toLowerCase()))) continue
    const v = numOrNull(row.value)
    if (v != null) return v
  }
  return null
}

interface ReportedYear {
  year: number
  ic: Array<Record<string, unknown>>
  bs: Array<Record<string, unknown>>
  cf: Array<Record<string, unknown>>
}

function parseReportedYears(financialsData: unknown): ReportedYear[] {
  const data = financialsData as { data?: Array<Record<string, unknown>> }
  if (!Array.isArray(data?.data)) return []

  return data.data
    .map((entry: Record<string, unknown>) => {
      const year = yearFromEndDate(entry.endDate) ?? yearFromEndDate(entry.period)
      if (!year) return null
      const report = entry.report as Record<string, unknown> | null
      if (!report) return null
      const ic = Array.isArray(report.ic) ? (report.ic as Array<Record<string, unknown>>) : []
      const bs = Array.isArray(report.bs) ? (report.bs as Array<Record<string, unknown>>) : []
      const cf = Array.isArray(report.cf) ? (report.cf as Array<Record<string, unknown>>) : []
      return { year, ic, bs, cf }
    })
    .filter((x): x is ReportedYear => x != null)
    .sort((a, b) => b.year - a.year)
    .slice(0, 5)
}

function buildRows(
  reportedYears: ReportedYear[],
  defs: Array<{ concept: string; label: string; needles: string[]; section: 'ic' | 'bs' | 'cf'; derive?: (y: ReportedYear) => number | null }>
): FinancialRow[] {
  return defs.map(({ concept, label, needles, section, derive }) => ({
    concept,
    label,
    values: reportedYears.map(y => {
      if (derive) return derive(y)
      return pickConcept(y[section], ...needles)
    }),
  }))
}

async function fetchSegments(symbol: string): Promise<RevenueSegment[] | null> {
  try {
    const tickerMap = await fetch('https://www.sec.gov/files/company_tickers.json', {
      headers: { 'User-Agent': 'Graham-App contact@graham.app' },
      next: { revalidate: 86400 },
    }).then(r => (r.ok ? r.json() : null))
    if (!tickerMap) return null

    const entry = Object.values(tickerMap as Record<string, { cik_str: number; ticker: string }>)
      .find(e => e?.ticker?.toUpperCase() === symbol.toUpperCase())
    if (!entry) return null

    const cik = String(entry.cik_str).padStart(10, '0')
    const facts = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
      headers: { 'User-Agent': 'Graham-App contact@graham.app' },
      next: { revalidate: 86400 },
    }).then(r => (r.ok ? r.json() : null))
    if (!facts) return null

    const usGaap = facts?.facts?.['us-gaap'] as Record<string, { units?: Record<string, Array<Record<string, unknown>>> }> | undefined
    if (!usGaap) return null

    // Look for segmented revenue concepts
    const revConcepts = [
      'RevenueFromContractWithCustomerExcludingAssessedTax',
      'RevenueFromContractWithCustomerIncludingAssessedTax',
      'SalesRevenueNet',
      'Revenues',
    ]

    for (const c of revConcepts) {
      const units = usGaap[c]?.units?.USD
      if (!Array.isArray(units)) continue

      // Find entries with segment dimensions (they have a "segment" or "dim" field)
      const segEntries = units.filter(u =>
        (u.form === '10-K' || u.fp === 'FY') &&
        u.segment != null
      )
      if (segEntries.length < 2) continue

      // Get the most recent fiscal year
      const latestYear = segEntries
        .map(u => yearFromEndDate(u.end) ?? 0)
        .reduce((a, b) => Math.max(a, b), 0)
      if (!latestYear) continue

      const currentYearEntries = segEntries.filter(u => yearFromEndDate(u.end) === latestYear)
      const prevYearEntries = segEntries.filter(u => yearFromEndDate(u.end) === latestYear - 1)

      if (currentYearEntries.length < 2) continue

      const total = currentYearEntries.reduce((sum, u) => sum + (numOrNull(u.val) ?? 0), 0)
      if (total <= 0) continue

      const segments: RevenueSegment[] = currentYearEntries
        .map(u => {
          const val = numOrNull(u.val) ?? 0
          const segName = typeof u.segment === 'object' && u.segment != null
            ? (u.segment as Record<string, unknown>).value as string ?? String(u.segment)
            : String(u.segment)

          // Try to find prior year value for this segment
          const prevEntry = prevYearEntries.find(p => {
            const pName = typeof p.segment === 'object' && p.segment != null
              ? (p.segment as Record<string, unknown>).value as string ?? String(p.segment)
              : String(p.segment)
            return pName === segName
          })
          const prevVal = prevEntry ? numOrNull(prevEntry.val) : null
          const growthYoy = prevVal != null && prevVal !== 0
            ? parseFloat(((val - prevVal) / Math.abs(prevVal) * 100).toFixed(1))
            : null

          return {
            name: segName,
            value: val,
            pct: parseFloat((val / total * 100).toFixed(1)),
            growthYoy,
          }
        })
        .filter(s => s.value > 0)
        .sort((a, b) => b.value - a.value)

      if (segments.length >= 2) return segments
    }

    return null
  } catch {
    return null
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params
  const sym = symbol.toUpperCase()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const fKey = process.env.FINNHUB_API_KEY
  if (!fKey) return NextResponse.json({ error: 'Missing FINNHUB_API_KEY' }, { status: 500 })

  const base = 'https://finnhub.io/api/v1'

  const [metricsRes, financialsRes, segmentsRes] = await Promise.allSettled([
    fetch(`${base}/stock/metric?symbol=${sym}&metric=all&token=${fKey}`, { next: { revalidate: 3600 } }).then(r => r.ok ? r.json() : null),
    fetch(`${base}/stock/financials-reported?symbol=${sym}&freq=annual&token=${fKey}`, { next: { revalidate: 86400 } }).then(r => r.ok ? r.json() : null),
    fetchSegments(sym),
  ])

  const m = metricsRes.status === 'fulfilled' ? metricsRes.value?.metric ?? {} : {}
  const financialsRaw = financialsRes.status === 'fulfilled' ? financialsRes.value : null
  const segments = segmentsRes.status === 'fulfilled' ? segmentsRes.value : null

  const reportedYears = parseReportedYears(financialsRaw)
  const years = reportedYears.map(y => y.year)

  // Income statement rows
  const annualIncome = buildRows(reportedYears, [
    { concept: 'revenue', label: 'Revenue', needles: ['revenue', 'salesrevenue', 'totalrevenue'], section: 'ic' },
    { concept: 'grossProfit', label: 'Gross Profit', needles: ['grossprofit'], section: 'ic' },
    { concept: 'operatingIncome', label: 'Operating Income', needles: ['operatingincome', 'incomefromoperations', 'operatingprofit'], section: 'ic' },
    { concept: 'netIncome', label: 'Net Income', needles: ['netincome', 'netearnings'], section: 'ic' },
    { concept: 'ebitda', label: 'EBITDA', needles: ['ebitda'], section: 'ic' },
    { concept: 'eps', label: 'EPS (Diluted)', needles: ['earningspersharediluted', 'epsdiluted', 'earningspershare'], section: 'ic' },
    { concept: 'rd', label: 'R&D Expense', needles: ['researchanddevelopment', 'researchdevelopment'], section: 'ic' },
    { concept: 'sga', label: 'SG&A', needles: ['sellinggeneralandadmin', 'sgaexpense', 'sellingandmarketing'], section: 'ic' },
    { concept: 'interestExpense', label: 'Interest Expense', needles: ['interestexpense'], section: 'ic' },
  ])

  // Balance sheet rows
  const annualBalance = buildRows(reportedYears, [
    { concept: 'totalAssets', label: 'Total Assets', needles: ['totalassets', 'assets'], section: 'bs' },
    { concept: 'totalLiabilities', label: 'Total Liabilities', needles: ['totalliabilities', 'liabilities'], section: 'bs' },
    { concept: 'totalEquity', label: 'Total Equity', needles: ['stockholdersequity', 'shareholdersequity', 'totalequity'], section: 'bs' },
    { concept: 'cash', label: 'Cash & Equivalents', needles: ['cashandcashequivalents', 'cash'], section: 'bs' },
    { concept: 'totalDebt', label: 'Total Debt', needles: ['longtermdebtnoncurrent', 'longtermdebt', 'totaldebt'], section: 'bs' },
    { concept: 'goodwill', label: 'Goodwill & Intangibles', needles: ['goodwill', 'intangibleassets'], section: 'bs' },
    { concept: 'ppe', label: 'PP&E (Net)', needles: ['propertyplantandequipment', 'ppe'], section: 'bs' },
    { concept: 'currentAssets', label: 'Current Assets', needles: ['currentassets', 'totalcurrentassets'], section: 'bs' },
    { concept: 'currentLiabilities', label: 'Current Liabilities', needles: ['currentliabilities', 'totalcurrentliabilities'], section: 'bs' },
  ])

  // Cash flow rows
  const annualCashFlow = buildRows(reportedYears, [
    { concept: 'operatingCF', label: 'Operating Cash Flow', needles: ['netcashprovidedbyusedinoperatingactivities', 'netcashfromoperatingactivities', 'operatingactivities'], section: 'cf' },
    { concept: 'capex', label: 'Capital Expenditure', needles: ['paymentstoacquirepropertyplantandequipment', 'capitalexpenditure', 'capex', 'purchaseofproperty'], section: 'cf' },
    {
      concept: 'fcf', label: 'Free Cash Flow', needles: [], section: 'cf',
      derive: (y) => {
        const cfo = pickConcept(y.cf, 'netcashprovidedbyusedinoperatingactivities', 'netcashfromoperatingactivities', 'operatingactivities')
        const capex = pickConcept(y.cf, 'paymentstoacquirepropertyplantandequipment', 'capitalexpenditure', 'capex', 'purchaseofproperty')
        if (cfo == null || capex == null) return null
        return capex < 0 ? cfo + capex : cfo - capex
      },
    },
    { concept: 'buybacks', label: 'Share Buybacks', needles: ['repurchaseofcommonstock', 'buyback', 'repurchaseofstock', 'paymentsforrepurchaseofcommonstock'], section: 'cf' },
    { concept: 'dividendsPaid', label: 'Dividends Paid', needles: ['dividendspaid', 'paymentsofdividends', 'paymentsofdividendscommonstock'], section: 'cf' },
    { concept: 'investingCF', label: 'Investing Cash Flow', needles: ['netcashprovidedbyusedinvestingactivities', 'netcashfrominvestingactivities'], section: 'cf' },
    { concept: 'financingCF', label: 'Financing Cash Flow', needles: ['netcashprovidedbyusedinfinancingactivities', 'netcashfromfinancingactivities'], section: 'cf' },
  ])

  // Compute PEG ratio
  const pe = numOrNull(m['peNormalizedAnnual'] ?? m['peTTM'])
  const epsGrowth = numOrNull(m['epsGrowthTTMYoy'] ?? m['epsBasicExclExtraItemsGrowthTTMYoy'])
  const pegRatio = pe != null && epsGrowth != null && epsGrowth > 0
    ? parseFloat((pe / epsGrowth).toFixed(2))
    : null

  const extendedMetrics: ExtendedMetrics = {
    // Buffett
    roeTTM: numOrNull(m['roeTTM']),
    roicTTM: numOrNull(m['roicTTM']),
    grossMarginTTM: numOrNull(m['grossMarginTTM']),
    netMarginTTM: numOrNull(m['netProfitMarginTTM']),
    operatingMarginTTM: numOrNull(m['operatingMarginTTM']),
    freeCashFlowAnnual: numOrNull(m['freeCashFlowAnnual'] ?? m['freeCashFlowTTM']),
    revenueGrowth5Y: numOrNull(m['revenueGrowth5Y'] ?? m['cagr5Years']),
    epsGrowth5Y: numOrNull(m['epsGrowth5Y'] ?? m['epsBasicExclExtraItemsGrowth5Y']),
    dividendYieldAnnual: numOrNull(m['dividendYieldIndicatedAnnual']),
    debtEquity: numOrNull(m['totalDebt/totalEquityAnnual']),
    cashFlowPerShare: numOrNull(m['cashFlowPerShareTTM']),
    // Graham
    peNormalized: pe,
    pb: numOrNull(m['pbAnnual'] ?? m['pbQuarterly']),
    currentRatio: numOrNull(m['currentRatioAnnual']),
    quickRatio: numOrNull(m['quickRatioAnnual']),
    // Lynch
    pegRatio,
    revenueGrowthTTM: numOrNull(m['revenueGrowthTTMYoy']),
    inventoryTurnover: numOrNull(m['inventoryTurnoverAnnual']),
    // Burry
    evEbitda: numOrNull(m['evEbitdaTTM']),
    priceFCF: numOrNull(m['priceToFreeCashFlowAnnual'] ?? m['pfcfAnnual']),
    ltDebtToCapitalization: numOrNull(m['longTermDebt/totalCapitalAnnual'] ?? m['ltDebtToTotalCapitalAnnual']),
  }

  const response: FinancialsApiResponse = {
    years,
    annualIncome,
    annualBalance,
    annualCashFlow,
    extendedMetrics,
    segments,
  }

  return NextResponse.json(response)
}
