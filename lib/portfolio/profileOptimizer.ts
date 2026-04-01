import { ProfileOptimizeContext, PortfolioProfileOptimizeResponse } from './contracts'
import { shrinkCovariance } from './covariance'
import { computePathRiskMetrics } from './pathMetrics'
import { runSimpleStressTests } from './stressTests'
import { runOptimize } from './optimizer' // existing

export async function runProfileOptimize(
  ctx: ProfileOptimizeContext
): Promise<PortfolioProfileOptimizeResponse> {
  const { symbols, R, rfAnnual, years, hardConstraints, dataWarnings } = ctx

  const n = symbols.length
  const T = R.length

  if (T < 60 || n < 3) {
    throw new Error('Not enough observations or assets for robust optimisation.')
  }

  // Compute daily mean returns
  const muDaily = new Array<number>(n).fill(0)
  for (let t = 0; t < T; t++) {
    const row = R[t]
    for (let i = 0; i < n; i++) {
      muDaily[i] += row[i]
    }
  }
  for (let i = 0; i < n; i++) muDaily[i] /= T

  const muAnnual = muDaily.map(m => m * 252)

  // Sample covariance
  const SigmaRaw: number[][] = []
  for (let i = 0; i < n; i++) {
    SigmaRaw[i] = []
    for (let j = 0; j < n; j++) SigmaRaw[i][j] = 0
  }
  for (let t = 0; t < T; t++) {
    const row = R[t]
    for (let i = 0; i < n; i++) {
      const di = row[i] - muDaily[i]
      for (let j = 0; j < n; j++) {
        const dj = row[j] - muDaily[j]
        SigmaRaw[i][j] += di * dj
      }
    }
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) SigmaRaw[i][j] /= T - 1
  }

  const { shrunk: Sigma, alpha } = shrinkCovariance(SigmaRaw)
  dataWarnings.push(`Applied covariance shrinkage with alpha=${alpha.toFixed(2)}.`)

  // Base max weight cap from spec
  const baseMaxW = 0.25
  const userMax = hardConstraints?.max_single_position
  const maxSinglePosition = userMax != null ? Math.min(userMax, baseMaxW) : baseMaxW

  // Use existing runOptimize for max_sharpe objective and min-weight floor of 0
  const optimizeResult = runOptimize(R, symbols, 'max_sharpe', rfAnnual, 0)

  // Enforce per-asset cap via soft clipping + renormalisation
  let weights = optimizeResult.weights.map(w => w.weight) // assuming OptimizeResult has this shape

  let capped = false
  for (let i = 0; i < weights.length; i++) {
    if (weights[i] > maxSinglePosition) {
      weights[i] = maxSinglePosition
      capped = true
    }
  }
  const sum = weights.reduce((s, w) => s + w, 0)
  if (sum > 0) weights = weights.map(w => w / sum)
  if (capped) dataWarnings.push(`Weights were capped at max_single_position=${maxSinglePosition}.`)

  // Recompute portfolio-level metrics based on capped weights
  const portfolioReturns: number[] = []
  for (let t = 0; t < T; t++) {
    const row = R[t]
    let rp = 0
    for (let i = 0; i < n; i++) rp += weights[i] * row[i]
    portfolioReturns.push(rp)
  }

  const meanDaily = portfolioReturns.reduce((s, r) => s + r, 0) / T
  const varDaily = portfolioReturns.reduce((s, r) => s + Math.pow(r - meanDaily, 2), 0) / (T - 1)
  const annualReturn = meanDaily * 252
  const annualVol = Math.sqrt(varDaily * 252)
  const rf = rfAnnual
  const sharpe = annualVol > 0 ? (annualReturn - rf) / annualVol : 0

  const timestamps = [] as number[]
  // If you have timestamps from yahoo.ts, pass them through in ctx and use them here.

  const pathMetrics = computePathRiskMetrics(portfolioReturns, timestamps)
  const stress = runSimpleStressTests(weights)

  const optimalWeights: Record<string, number> = {}
  symbols.forEach((sym, i) => {
    optimalWeights[sym] = weights[i]
  })

  return {
    optimal_weights: optimalWeights,
    expected_annual_return: annualReturn,
    expected_annual_volatility: annualVol,
    sharpe_ratio: sharpe,
    max_drawdown: pathMetrics.maxDrawdown,
    worst_month_return: pathMetrics.worstMonthReturn,
    worst_quarter_return: pathMetrics.worstQuarterReturn,
    stress_test_results: stress,
    risk_free_rate_used: rf,
    data_warnings: dataWarnings
  }
}