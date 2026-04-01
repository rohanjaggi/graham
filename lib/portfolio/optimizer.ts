/**
 * Long-only portfolio optimisation on historical return matrix R (T × n).
 * Sample mean/covariance; annualisation √252 for daily returns.
 */

export type Objective =
  | 'max_sharpe'
  | 'max_sortino'
  | 'max_return'
  | 'min_volatility'
  | 'min_max_drawdown'

const TRADING_DAYS = 252
const RIDGE = 1e-8

function mean(v: number[]): number {
  return v.reduce((a, b) => a + b, 0) / v.length
}

function columnMeans(R: number[][]): number[] {
  const T = R.length
  const n = R[0].length
  const mu = new Array(n).fill(0)
  for (let t = 0; t < T; t++) for (let i = 0; i < n; i++) mu[i] += R[t][i]
  return mu.map(x => x / T)
}

function covariance(R: number[][]): number[][] {
  const T = R.length
  const n = R[0].length
  const mu = columnMeans(R)
  const S: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let t = 0; t < T; t++) {
    for (let i = 0; i < n; i++) {
      const di = R[t][i] - mu[i]
      for (let j = 0; j < n; j++) {
        const dj = R[t][j] - mu[j]
        S[i][j] += di * dj
      }
    }
  }
  const c = T > 1 ? 1 / (T - 1) : 1
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) S[i][j] *= c
  for (let i = 0; i < n; i++) S[i][i] += RIDGE
  return S
}

function matVec(S: number[][], w: number[]): number[] {
  const n = w.length
  const o = new Array(n).fill(0)
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) o[i] += S[i][j] * w[j]
  return o
}

function dot(a: number[], b: number[]): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

/** Euclidean projection onto {w >= 0, sum w = z} */
export function projectOntoSimplex(v: number[], z = 1): number[] {
  const n = v.length
  if (n === 0) return []
  const u = [...v].sort((a, b) => b - a)
  let rho = 0
  for (let j = 0; j < n; j++) {
    const sum = u.slice(0, j + 1).reduce((a, b) => a + b, 0)
    const t = (sum - z) / (j + 1)
    if (u[j] - t > 0) rho = j + 1
  }
  const theta = rho > 0 ? (u.slice(0, rho).reduce((a, b) => a + b, 0) - z) / rho : 0
  return v.map(x => Math.max(x - theta, 0))
}

function portfolioReturns(R: number[][], w: number[]): number[] {
  return R.map(row => dot(row, w))
}

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(mean(xs.map(x => (x - m) ** 2)))
}

function sharpeAnnual(w: number[], mu: number[], Sigma: number[][], rfAnnual: number): number {
  const rfDaily = Math.pow(1 + rfAnnual, 1 / TRADING_DAYS) - 1
  const muEx = mu.map(m => m - rfDaily)
  const muP = dot(muEx, w)
  const varP = Math.max(dot(w, matVec(Sigma, w)), 1e-12)
  const sigP = Math.sqrt(varP)
  return (muP / sigP) * Math.sqrt(TRADING_DAYS)
}

function sortinoAnnual(w: number[], R: number[][], rfDaily: number): number {
  const rp = portfolioReturns(R, w)
  const mar = rfDaily
  const below = rp.map(r => Math.min(0, r - mar))
  const ds = Math.sqrt(mean(below.map(x => x * x)))
  if (ds < 1e-12) return mean(rp) > mar ? 999 : 0
  const muP = mean(rp)
  return ((muP - mar) / ds) * Math.sqrt(TRADING_DAYS)
}

function maxDrawdown(w: number[], R: number[][]): number {
  let cum = 1
  let peak = 1
  let mdd = 0
  for (const row of R) {
    const rp = dot(row, w)
    cum *= 1 + rp
    if (cum > peak) peak = cum
    const dd = peak > 0 ? (peak - cum) / peak : 0
    if (dd > mdd) mdd = dd
  }
  return mdd
}

function randomWeights(n: number): number[] {
  const g = Array.from({ length: n }, () => -Math.log(Math.max(1e-12, Math.random())))
  const s = g.reduce((a, b) => a + b, 0)
  return g.map(x => x / s)
}

/** z on unit simplex → weights with w_i ≥ minW and Σw = 1 (if minW ≤ 0, returns z). */
function wFromZ(z: number[], minW: number): number[] {
  if (minW <= 0 || !Number.isFinite(minW)) return z.slice()
  const n = z.length
  const cap = 1 - n * minW
  if (cap <= 1e-14) throw new Error('MIN_WEIGHT_INFEASIBLE')
  return z.map(zi => minW + cap * zi)
}

function capFromMinW(n: number, minW: number): number {
  return minW > 0 ? 1 - n * minW : 1
}

function minVolatility(Sigma: number[][], minW: number): number[] {
  const n = Sigma.length
  const cap = capFromMinW(n, minW)
  let z = new Array(n).fill(1 / n)
  const lr = 0.5
  for (let iter = 0; iter < 8000; iter++) {
    const w = wFromZ(z, minW)
    const gradW = matVec(Sigma, w).map(x => 2 * x)
    const gradZ = minW > 0 ? gradW.map(g => g * cap) : gradW
    z = projectOntoSimplex(z.map((zi, i) => zi - lr * gradZ[i]))
  }
  return wFromZ(z, minW)
}

function maxSharpeGradient(mu: number[], Sigma: number[][], rfAnnual: number, minW: number): number[] {
  const rfDaily = Math.pow(1 + rfAnnual, 1 / TRADING_DAYS) - 1
  const muEx = mu.map(m => m - rfDaily)
  const n = mu.length
  const cap = capFromMinW(n, minW)
  let best = randomWeights(n)
  let bestS = -Infinity
  const toW = (zz: number[]) => wFromZ(zz, minW)
  for (let r = 0; r < 12; r++) {
    let z = randomWeights(n)
    for (let iter = 0; iter < 6000; iter++) {
      const w = toW(z)
      const Sw = matVec(Sigma, w)
      const sig2 = Math.max(dot(w, Sw), 1e-12)
      const sig = Math.sqrt(sig2)
      const f = dot(muEx, w)
      const gradW = muEx.map((m, i) => (m * sig2 - f * Sw[i]) / (sig2 * sig + 1e-15))
      const gradZ = minW > 0 ? gradW.map(g => g * cap) : gradW
      z = projectOntoSimplex(z.map((zi, i) => zi + 0.25 * gradZ[i]))
    }
    const w = toW(z)
    const s = (() => {
      const muP = dot(muEx, w)
      const varP = Math.max(dot(w, matVec(Sigma, w)), 1e-12)
      return (muP / Math.sqrt(varP)) * Math.sqrt(TRADING_DAYS)
    })()
    if (s > bestS) {
      bestS = s
      best = z.slice()
    }
  }
  let zRef = best
  for (let iter = 0; iter < 8000; iter++) {
    const w = toW(zRef)
    const Sw = matVec(Sigma, w)
    const sig2 = Math.max(dot(w, Sw), 1e-12)
    const sig = Math.sqrt(sig2)
    const f = dot(muEx, w)
    const gradW = muEx.map((m, i) => (m * sig2 - f * Sw[i]) / (sig2 * sig + 1e-15))
    const gradZ = minW > 0 ? gradW.map(g => g * cap) : gradW
    zRef = projectOntoSimplex(zRef.map((zi, i) => zi + 0.3 * gradZ[i]))
  }
  return toW(zRef)
}

function monteCarloBest(
  n: number,
  score: (z: number[]) => number,
  samples: number,
  maximize: boolean
): number[] {
  let best = randomWeights(n)
  let bestSc = score(best)
  for (let k = 0; k < samples; k++) {
    const w = randomWeights(n)
    const s = score(w)
    if (maximize ? s > bestSc : s < bestSc) {
      bestSc = s
      best = w
    }
  }
  let w = [...best]
  for (let iter = 0; iter < 400; iter++) {
    const j = Math.floor(Math.random() * n)
    const delta = (Math.random() - 0.5) * 0.08
    const trial = [...w]
    trial[j] = Math.max(0, trial[j] + delta)
    const s0 = trial.reduce((a, b) => a + b, 0)
    if (s0 <= 0) continue
    const norm = trial.map(x => x / s0)
    const sc = score(norm)
    if (maximize ? sc > bestSc : sc < bestSc) {
      bestSc = sc
      w = norm
    }
  }
  return w
}

/** After rounding, enforce each weight ≥ floor and renormalise (proportional take from above-floor names). */
function applyMinWeightAfterRound(w: number[], floor: number): number[] {
  if (floor <= 0) return normalizeTo100(w)
  const n = w.length
  let x = normalizeTo100(w)
  for (let t = 0; t < 80; t++) {
    const i = x.findIndex(v => v < floor - 1e-9)
    if (i < 0) break
    const need = floor - x[i]
    x[i] = floor
    let surplus = 0
    const weights: number[] = []
    for (let j = 0; j < n; j++) {
      if (j === i) {
        weights.push(0)
        continue
      }
      const ex = Math.max(0, x[j] - floor)
      weights.push(ex)
      surplus += ex
    }
    if (surplus < need - 1e-10) {
      return normalizeTo100(w)
    }
    for (let j = 0; j < n; j++) {
      if (j !== i) x[j] -= need * (weights[j] / surplus)
    }
  }
  let s = x.reduce((a, b) => a + b, 0)
  if (Math.abs(s - 1) > 1e-6 && n > 0) {
    const k = x.indexOf(Math.max(...x))
    x[k] += 1 - s
  }
  return x.map(v => Math.round(v * 10000) / 10000)
}

export function normalizeTo100(w: number[]): number[] {
  const s = w.reduce((a, b) => a + b, 0)
  const raw = w.map(x => (s > 0 ? x / s : 0))
  const rounded = raw.map(x => Math.round(x * 10000) / 10000)
  let sum = rounded.reduce((a, b) => a + b, 0)
  const diff = Math.round((1 - sum) * 10000) / 10000
  if (Math.abs(diff) > 1e-6 && rounded.length > 0) {
    const idx = rounded.indexOf(Math.max(...rounded))
    rounded[idx] = Math.round((rounded[idx] + diff) * 10000) / 10000
  }
  return rounded
}

export interface MetricBlock {
  annualizedReturnPct: number
  annualizedVolatilityPct: number
  sharpe: number
  sortino: number
  maxDrawdownPct: number
}

export interface OptimizeResult {
  weights: { symbol: string; weight: number }[]
  objective: Objective
  metrics: MetricBlock
  sample: { tradingDays: number; rfAnnualPct: number }
  minWeightPct?: number
}

/** Implied sample metrics for a single daily return series (same definitions as optimised portfolio). */
export function metricsForDailyReturns(rp: number[], rfAnnual = 0.04): MetricBlock {
  if (rp.length < 2) {
    return {
      annualizedReturnPct: 0,
      annualizedVolatilityPct: 0,
      sharpe: 0,
      sortino: 0,
      maxDrawdownPct: 0,
    }
  }
  const rfDaily = Math.pow(1 + rfAnnual, 1 / TRADING_DAYS) - 1
  const m = mean(rp)
  const sd = stdev(rp)
  const excess = m - rfDaily
  const sharpe = sd > 1e-12 ? (excess / sd) * Math.sqrt(TRADING_DAYS) : 0
  const below = rp.map(r => Math.min(0, r - rfDaily))
  const ds = Math.sqrt(mean(below.map(x => x * x)))
  const sortino = ds > 1e-12 ? ((m - rfDaily) / ds) * Math.sqrt(TRADING_DAYS) : m > rfDaily ? 999 : 0

  let cum = 1
  let peak = 1
  let mdd = 0
  for (const r of rp) {
    cum *= 1 + r
    if (cum > peak) peak = cum
    const dd = peak > 0 ? (peak - cum) / peak : 0
    if (dd > mdd) mdd = dd
  }

  return {
    annualizedReturnPct: m * TRADING_DAYS * 100,
    annualizedVolatilityPct: sd * Math.sqrt(TRADING_DAYS) * 100,
    sharpe,
    sortino: Math.min(sortino, 999),
    maxDrawdownPct: mdd * 100,
  }
}

function computeWeights(R: number[][], objective: Objective, rfAnnual: number, minW: number): number[] {
  const mu = columnMeans(R)
  const Sigma = covariance(R)
  const n = mu.length
  const rfDaily = Math.pow(1 + rfAnnual, 1 / TRADING_DAYS) - 1

  switch (objective) {
    case 'max_return': {
      let k = 0
      for (let i = 1; i < n; i++) if (mu[i] > mu[k]) k = i
      const z = new Array(n).fill(0)
      z[k] = 1
      return wFromZ(z, minW)
    }
    case 'min_volatility':
      return minVolatility(Sigma, minW)
    case 'max_sharpe':
      return maxSharpeGradient(mu, Sigma, rfAnnual, minW)
    case 'max_sortino':
      return wFromZ(
        monteCarloBest(
          n,
          zz => sortinoAnnual(wFromZ(zz, minW), R, rfDaily),
          Math.min(60000, 8000 + n * 4000),
          true
        ),
        minW
      )
    case 'min_max_drawdown':
      return wFromZ(
        monteCarloBest(
          n,
          zz => maxDrawdown(wFromZ(zz, minW), R),
          Math.min(60000, 8000 + n * 4000),
          false
        ),
        minW
      )
    default:
      return wFromZ(new Array(n).fill(1 / n), minW)
  }
}

// R: T x n matrix of daily returns
function sampleCovariance(R: number[][]): number[][] { /* likely already present */ }

function shrinkToIdentity(
  Sigma: number[][]
): { shrunk: number[][]; alpha: number } {
  const n = Sigma.length
  // 1) Target: scalar times identity
  const avgVar = Sigma.reduce((sum, row, i) => sum + row[i], 0) / n
  const F = avgVar

  // 2) Compute squared Frobenius norm of (Sigma - F I)
  let sqDiff = 0
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const diff = Sigma[i][j] - (i === j ? F : 0)
      sqDiff += diff * diff
    }
  }

  // 3) Estimate alpha (shrinkage intensity) heuristically
  // For PoC you can start with something simple and conservative:
  const alpha = Math.min(0.5, Math.max(0.1, sqDiff / (sqDiff + 1e-4)))

  // 4) Blend
  const shrunk: number[][] = []
  for (let i = 0; i < n; i++) {
    shrunk[i] = []
    for (let j = 0; j < n; j++) {
      const target = i === j ? F : 0
      shrunk[i][j] = alpha * target + (1 - alpha) * Sigma[i][j]
    }
  }

  return { shrunk, alpha }
}
export function runOptimize(
  R: number[][],
  symbols: string[],
  objective: Objective,
  rfAnnual = 0.04,
  minWeightFraction = 0
): OptimizeResult {
  const minW = Math.max(0, minWeightFraction)
  if (minW > 0 && minW * R[0].length > 1 + 1e-10) {
    throw new Error('MIN_WEIGHT_INFEASIBLE')
  }
  const wRaw = computeWeights(R, objective, rfAnnual, minW)
  const weightsArr =
    minW > 0 ? applyMinWeightAfterRound(wRaw, minW) : normalizeTo100(wRaw)
  const weights = symbols.map((s, i) => ({ symbol: s, weight: weightsArr[i] })).sort((a, b) => b.weight - a.weight)

  const mu = columnMeans(R)
  const Sigma = covariance(R)
  const rfDaily = Math.pow(1 + rfAnnual, 1 / TRADING_DAYS) - 1
  const rp = portfolioReturns(R, weightsArr)

  const metrics: MetricBlock = {
    annualizedReturnPct: mean(rp) * TRADING_DAYS * 100,
    annualizedVolatilityPct: stdev(rp) * Math.sqrt(TRADING_DAYS) * 100,
    sharpe: sharpeAnnual(weightsArr, mu, Sigma, rfAnnual),
    sortino: sortinoAnnual(weightsArr, R, rfDaily),
    maxDrawdownPct: maxDrawdown(weightsArr, R) * 100,
  }

  return {
    weights,
    objective,
    metrics,
    sample: { tradingDays: R.length, rfAnnualPct: rfAnnual * 100 },
    ...(minW > 0 ? { minWeightPct: minW * 100 } : {}),
  }
}
