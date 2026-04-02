export interface PathRiskMetrics {
  maxDrawdown: number
  worstMonthReturn: number
  worstQuarterReturn: number
}

export function computePathRiskMetrics(
  portfolioReturns: number[],   // daily simple returns
  timestamps: number[]          // unix seconds for each return
): PathRiskMetrics {
  if (portfolioReturns.length === 0) {
    return {
      maxDrawdown: 0,
      worstMonthReturn: 0,
      worstQuarterReturn: 0,
    }
  }

  const effectiveTimestamps =
    timestamps.length === portfolioReturns.length
      ? timestamps
      : portfolioReturns.map((_, index) => index * 86400)

  // 1) Max drawdown (you already have one in optimizer.ts; consider reusing that logic)
  let peak = 0
  let maxDd = 0
  let cumulative = 0
  for (const r of portfolioReturns) {
    cumulative += Math.log(1 + r)
    if (cumulative > peak) peak = cumulative
    const dd = Math.exp(cumulative - peak) - 1
    if (dd < maxDd) maxDd = dd
  }

  // 2) Group by calendar month YYYY-MM
  const byMonth = new Map<string, number>()
  for (let i = 0; i < portfolioReturns.length; i++) {
    const d = new Date(effectiveTimestamps[i] * 1000)
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`
    const r = portfolioReturns[i]
    const prev = byMonth.get(key) ?? 0
    byMonth.set(key, Math.log1p(r) + prev)
  }

  let worstMonth = 0
  for (const logR of byMonth.values()) {
    const r = Math.expm1(logR)
    if (r < worstMonth) worstMonth = r
  }

  // 3) Worst rolling quarter as approx 63 trading days
  const window = 63
  let worstQuarter = 0
  if (portfolioReturns.length >= window) {
    const prefix: number[] = [0]
    for (const r of portfolioReturns) {
      prefix.push(prefix[prefix.length - 1] + Math.log1p(r))
    }
    for (let i = window; i < prefix.length; i++) {
      const logR = prefix[i] - prefix[i - window]
      const r = Math.expm1(logR)
      if (r < worstQuarter) worstQuarter = r
    }
  } else {
    worstQuarter = worstMonth
  }

  return { maxDrawdown: maxDd, worstMonthReturn: worstMonth, worstQuarterReturn: worstQuarter }
}
