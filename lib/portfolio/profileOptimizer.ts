import { ProfileOptimizeContext, PortfolioProfileOptimizeResponse } from './contracts'
import { shrinkCovariance } from './covariance'
import { computePathRiskMetrics } from './pathMetrics'
import { runSimpleStressTests } from './stressTests'

const TRADING_DAYS = 252
const MAX_SINGLE_POSITION_CAP = 0.25
const EPSILON = 1e-9

type OptimizeContext = ProfileOptimizeContext & {
  timestamps?: number[]
  sectorBySymbol?: Record<string, string | null>
}

function dot(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i]
  return sum
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function covarianceMatrix(R: number[][]): { muDaily: number[]; sigma: number[][] } {
  const rows = R.length
  const cols = R[0].length
  const muDaily = new Array<number>(cols).fill(0)
  for (const row of R) {
    for (let i = 0; i < cols; i++) muDaily[i] += row[i]
  }
  for (let i = 0; i < cols; i++) muDaily[i] /= rows

  const sigma = Array.from({ length: cols }, () => new Array<number>(cols).fill(0))
  for (const row of R) {
    for (let i = 0; i < cols; i++) {
      const di = row[i] - muDaily[i]
      for (let j = 0; j < cols; j++) {
        sigma[i][j] += di * (row[j] - muDaily[j])
      }
    }
  }

  const scale = rows > 1 ? 1 / (rows - 1) : 1
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < cols; j++) sigma[i][j] *= scale
  }

  return { muDaily, sigma }
}

function matVec(matrix: number[][], vector: number[]): number[] {
  return matrix.map((row) => dot(row, vector))
}

function projectToCappedSimplex(values: number[], cap: number): number[] {
  const n = values.length
  if (n === 0) return []
  if (cap * n < 1 - EPSILON) throw new Error('Infeasible max_single_position constraint.')

  let remaining = 1
  const output = new Array<number>(n).fill(0)
  const active = new Set(values.map((_, index) => index))
  const baseline = values.map((value) => Math.max(value, 0))

  while (active.size > 0) {
    const activeIndexes = [...active]
    const activeSum = activeIndexes.reduce((sum, index) => sum + baseline[index], 0)
    const fill = activeSum > 0
      ? activeIndexes.map((index) => (baseline[index] / activeSum) * remaining)
      : activeIndexes.map(() => remaining / activeIndexes.length)

    let clipped = false
    for (let i = 0; i < activeIndexes.length; i++) {
      const index = activeIndexes[i]
      if (fill[i] > cap + EPSILON) {
        output[index] = cap
        remaining -= cap
        active.delete(index)
        clipped = true
      }
    }

    if (!clipped) {
      for (let i = 0; i < activeIndexes.length; i++) {
        output[activeIndexes[i]] = fill[i]
      }
      break
    }
  }

  const total = output.reduce((sum, value) => sum + value, 0)
  if (Math.abs(total - 1) > 1e-6) {
    const deficit = 1 - total
    const index = output.indexOf(Math.max(...output))
    output[index] += deficit
  }

  return output
}

function portfolioReturns(R: number[][], weights: number[]): number[] {
  return R.map((row) => dot(row, weights))
}

function annualizedMetrics(returns: number[], rfAnnual: number) {
  const muDaily = mean(returns)
  const variance = returns.reduce((sum, value) => sum + (value - muDaily) ** 2, 0) / Math.max(1, returns.length - 1)
  const annualReturn = muDaily * TRADING_DAYS
  const annualVolatility = Math.sqrt(variance * TRADING_DAYS)
  const sharpe = annualVolatility > 1e-12 ? (annualReturn - rfAnnual) / annualVolatility : 0

  return { annualReturn, annualVolatility, sharpe }
}

function getSector(symbol: string, sectorBySymbol?: Record<string, string | null>) {
  return sectorBySymbol?.[symbol] ?? 'UNKNOWN'
}

function computeSectorWeights(
  symbols: string[],
  weights: number[],
  sectorBySymbol?: Record<string, string | null>
): Map<string, number> {
  const output = new Map<string, number>()
  for (let i = 0; i < symbols.length; i++) {
    const sector = getSector(symbols[i], sectorBySymbol)
    output.set(sector, (output.get(sector) ?? 0) + weights[i])
  }
  return output
}

function isFeasible(
  symbols: string[],
  weights: number[],
  maxSinglePosition: number,
  maxSectorWeight: number | undefined,
  sectorBySymbol?: Record<string, string | null>
): boolean {
  const total = weights.reduce((sum, value) => sum + value, 0)
  if (Math.abs(total - 1) > 1e-6) return false
  if (weights.some((value) => value < -EPSILON || value > maxSinglePosition + 1e-6)) return false
  if (maxSectorWeight == null) return true

  const sectorWeights = computeSectorWeights(symbols, weights, sectorBySymbol)
  for (const value of sectorWeights.values()) {
    if (value > maxSectorWeight + 1e-6) return false
  }
  return true
}

function buildSectorMembers(symbols: string[], sectorBySymbol?: Record<string, string | null>) {
  const members = new Map<string, number[]>()
  for (let i = 0; i < symbols.length; i++) {
    const sector = getSector(symbols[i], sectorBySymbol)
    const current = members.get(sector) ?? []
    current.push(i)
    members.set(sector, current)
  }
  return members
}
function repairSectorCaps(
  symbols: string[],
  weights: number[],
  maxSinglePosition: number,
  maxSectorWeight: number | undefined,
  sectorBySymbol?: Record<string, string | null>
): number[] | null {
  let current = projectToCappedSimplex(weights, maxSinglePosition)
  if (maxSectorWeight == null) return current

  const sectorMembers = buildSectorMembers(symbols, sectorBySymbol)
  const sectorCount = sectorMembers.size
  if (sectorCount * maxSectorWeight < 1 - 1e-6) return null

  for (let iteration = 0; iteration < 40; iteration++) {
    const sectorWeights = computeSectorWeights(symbols, current, sectorBySymbol)
    const overSectors = [...sectorWeights.entries()].filter(([, weight]) => weight > maxSectorWeight + 1e-6)
    if (overSectors.length === 0) return current

    let freed = 0
    for (const [sector, sectorWeight] of overSectors) {
      const indexes = sectorMembers.get(sector) ?? []
      const excess = sectorWeight - maxSectorWeight
      if (indexes.length === 0 || excess <= 0) continue
      for (const index of indexes) {
        const reduction = excess * (current[index] / sectorWeight)
        current[index] = Math.max(0, current[index] - reduction)
      }
      freed += excess
    }

    const refreshedSectorWeights = computeSectorWeights(symbols, current, sectorBySymbol)
    type Recipient = { sector: string; index: number; capacity: number }
    const recipients: Recipient[] = []
    let totalCapacity = 0

    for (const [sector, indexes] of sectorMembers.entries()) {
      const sectorSlack = maxSectorWeight - (refreshedSectorWeights.get(sector) ?? 0)
      if (sectorSlack <= 1e-8) continue

      const assetCaps = indexes.map((index) => ({
        index,
        capacity: Math.max(0, Math.min(maxSinglePosition - current[index], sectorSlack)),
      })).filter((item) => item.capacity > 1e-8)

      const sectorCapacity = Math.min(
        sectorSlack,
        assetCaps.reduce((sum, item) => sum + item.capacity, 0)
      )
      if (sectorCapacity <= 1e-8) continue

      for (const asset of assetCaps) {
        const scaledCapacity = sectorCapacity * (asset.capacity / assetCaps.reduce((sum, item) => sum + item.capacity, 0))
        recipients.push({ sector, index: asset.index, capacity: scaledCapacity })
        totalCapacity += scaledCapacity
      }
    }

    if (freed > totalCapacity + 1e-6 || totalCapacity <= 1e-8) return null

    for (const recipient of recipients) {
      current[recipient.index] += freed * (recipient.capacity / totalCapacity)
    }

    current = projectToCappedSimplex(current, maxSinglePosition)
  }

  return isFeasible(symbols, current, maxSinglePosition, maxSectorWeight, sectorBySymbol) ? current : null
}

function annualSharpe(
  weights: number[],
  muAnnual: number[],
  sigmaAnnual: number[][],
  rfAnnual: number
): number {
  const annualReturn = dot(muAnnual, weights)
  const annualVariance = Math.max(dot(weights, matVec(sigmaAnnual, weights)), 1e-12)
  return (annualReturn - rfAnnual) / Math.sqrt(annualVariance)
}

function sharpeGradient(
  weights: number[],
  muAnnual: number[],
  sigmaAnnual: number[][],
  rfAnnual: number
): number[] {
  const sigmaWeights = matVec(sigmaAnnual, weights)
  const excessReturn = dot(muAnnual, weights) - rfAnnual
  const variance = Math.max(dot(weights, sigmaWeights), 1e-12)
  const volatility = Math.sqrt(variance)
  const variancePower = variance * volatility

  return muAnnual.map((mu, index) => (mu / volatility) - (excessReturn * sigmaWeights[index]) / variancePower)
}

function applyRiskGuardrails(ctx: ProfileOptimizeContext, annualVolatility: number, maxDrawdown: number, dataWarnings: string[]) {
  const highVol = annualVolatility > 0.25
  const deepDrawdown = maxDrawdown < -0.35

  if ((ctx.riskTolerance === 'DEFENSIVE' || ctx.riskTolerance === 'CONSERVATIVE') && (highVol || deepDrawdown)) {
    dataWarnings.push('Portfolio risk profile may be too aggressive for a conservative investor.')
  }

  if (ctx.investmentHorizon === '<3y' && deepDrawdown) {
    dataWarnings.push('Observed drawdown may be difficult to tolerate for a sub-3-year investment horizon.')
  }
}

function buildWarmStarts(
  muAnnual: number[],
  sigmaAnnual: number[][],
  maxSinglePosition: number
): number[][] {
  const n = muAnnual.length
  const equalWeight = new Array<number>(n).fill(1 / n)

  const inverseVolRaw = sigmaAnnual.map((row, index) => {
    const variance = Math.max(row[index], 1e-12)
    return 1 / Math.sqrt(variance)
  })

  const ranked = muAnnual
    .map((value, index) => ({ value, index }))
    .sort((a, b) => b.value - a.value)
  const concentrated = new Array<number>(n).fill(0)
  let remaining = 1
  for (const item of ranked) {
    if (remaining <= 1e-12) break
    const allocation = Math.min(maxSinglePosition, remaining)
    concentrated[item.index] = allocation
    remaining -= allocation
  }

  return [equalWeight, inverseVolRaw, concentrated]
}

function solveMaxSharpe(
  symbols: string[],
  muAnnual: number[],
  sigmaAnnual: number[][],
  rfAnnual: number,
  maxSinglePosition: number,
  maxSectorWeight: number | undefined,
  sectorBySymbol?: Record<string, string | null>
): number[] {
  const warmStarts = buildWarmStarts(muAnnual, sigmaAnnual, maxSinglePosition)
  let bestWeights: number[] | null = null
  let bestSharpe = Number.NEGATIVE_INFINITY

  for (const start of warmStarts) {
    let current = repairSectorCaps(symbols, start, maxSinglePosition, maxSectorWeight, sectorBySymbol)
    if (!current) continue

    let currentSharpe = annualSharpe(current, muAnnual, sigmaAnnual, rfAnnual)
    let step = 0.25

    for (let iteration = 0; iteration < 400; iteration++) {
      const gradient = sharpeGradient(current, muAnnual, sigmaAnnual, rfAnnual)
      let improved = false

      for (let attempt = 0; attempt < 12; attempt++) {
        const candidateVector = current.map((value, index) => value + step * gradient[index])
        const candidate = repairSectorCaps(symbols, candidateVector, maxSinglePosition, maxSectorWeight, sectorBySymbol)
        if (!candidate) {
          step *= 0.5
          continue
        }

        const candidateSharpe = annualSharpe(candidate, muAnnual, sigmaAnnual, rfAnnual)
        if (candidateSharpe > currentSharpe + 1e-8) {
          current = candidate
          currentSharpe = candidateSharpe
          step = Math.min(step * 1.15, 1)
          improved = true
          break
        }

        step *= 0.5
      }

      if (!improved && step < 1e-6) break
    }

    if (currentSharpe > bestSharpe) {
      bestSharpe = currentSharpe
      bestWeights = current
    }
  }

  if (!bestWeights) {
    throw new Error('Could not find a feasible portfolio under the supplied constraints.')
  }

  return bestWeights
}
export async function runProfileOptimize(ctx: OptimizeContext): Promise<PortfolioProfileOptimizeResponse> {
  const { symbols, R, rfAnnual, hardConstraints, dataWarnings } = ctx

  if (R.length < 60 || symbols.length < 3) {
    throw new Error('Not enough observations or assets for robust optimisation.')
  }

  const { muDaily, sigma } = covarianceMatrix(R)
  const { shrunk, alpha } = shrinkCovariance(sigma)
  dataWarnings.push(`Applied covariance shrinkage with alpha=${alpha.toFixed(2)}.`)

  const maxSinglePosition = Math.min(
    MAX_SINGLE_POSITION_CAP,
    hardConstraints?.max_single_position ?? MAX_SINGLE_POSITION_CAP
  )
  const maxSectorWeight = hardConstraints?.max_sector_weight

  const muAnnual = muDaily.map((value) => value * TRADING_DAYS)
  const sigmaAnnual = shrunk.map((row) => row.map((value) => value * TRADING_DAYS))

  const bestWeights = solveMaxSharpe(
    symbols,
    muAnnual,
    sigmaAnnual,
    rfAnnual,
    maxSinglePosition,
    maxSectorWeight,
    ctx.sectorBySymbol
  )

  const returns = portfolioReturns(R, bestWeights)
  const metrics = annualizedMetrics(returns, rfAnnual)
  const pathMetrics = computePathRiskMetrics(returns, ctx.timestamps ?? [])
  const stress = runSimpleStressTests(bestWeights, pathMetrics.maxDrawdown)

  if (!isFeasible(symbols, bestWeights, maxSinglePosition, maxSectorWeight, ctx.sectorBySymbol)) {
    throw new Error('Optimiser returned an infeasible portfolio.')
  }

  applyRiskGuardrails(ctx, metrics.annualVolatility, pathMetrics.maxDrawdown, dataWarnings)

  const optimalWeights = Object.fromEntries(
    symbols.map((symbol, index) => [symbol, Number(bestWeights[index].toFixed(6))])
  )

  return {
    optimal_weights: optimalWeights,
    expected_annual_return: Number(metrics.annualReturn.toFixed(6)),
    expected_annual_volatility: Number(metrics.annualVolatility.toFixed(6)),
    sharpe_ratio: Number(metrics.sharpe.toFixed(6)),
    max_drawdown: Number(pathMetrics.maxDrawdown.toFixed(6)),
    worst_month_return: Number(pathMetrics.worstMonthReturn.toFixed(6)),
    worst_quarter_return: Number(pathMetrics.worstQuarterReturn.toFixed(6)),
    stress_test_results: stress,
    risk_free_rate_used: rfAnnual,
    data_warnings: [...new Set(dataWarnings)],
  }
}
