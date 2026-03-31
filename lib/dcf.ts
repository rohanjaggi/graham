/* ─── TYPES ───────────────────────────────────────────────────────────────── */

export interface DCFInputs {
  baseFCF: number            // trailing FCF in $millions
  growthRate: number         // annual FCF growth rate as decimal (e.g. 0.10 = 10%)
  terminalGrowthRate: number // perpetuity growth rate as decimal (e.g. 0.025 = 2.5%)
  wacc: number               // discount rate as decimal (e.g. 0.10 = 10%)
  years: number              // projection horizon (5–15)
  sharesOutstanding: number  // in millions
  netDebt: number            // total debt minus cash, in $millions
}

export interface DCFYearRow {
  year: number
  fcf: number    // projected FCF in $millions
  pvFCF: number  // present value of that FCF in $millions
}

export interface DCFResult {
  yearlyBreakdown: DCFYearRow[]
  pvProjectedFCFs: number       // sum of discounted projected FCFs ($millions)
  terminalValue: number         // Gordon Growth Model terminal value ($millions)
  pvTerminalValue: number       // PV of terminal value ($millions)
  enterpriseValue: number       // pvProjectedFCFs + pvTerminalValue ($millions)
  equityValue: number           // enterpriseValue - netDebt ($millions)
  intrinsicPricePerShare: number // equityValue / sharesOutstanding ($ per share)
}

/* ─── CORE FUNCTION ───────────────────────────────────────────────────────── */

export function runDCF(inputs: DCFInputs): DCFResult {
  const { baseFCF, growthRate, terminalGrowthRate, wacc, years, sharesOutstanding, netDebt } = inputs

  if (wacc <= terminalGrowthRate) {
    throw new Error(`WACC (${wacc}) must exceed terminal growth rate (${terminalGrowthRate})`)
  }

  // Step 1 & 2: Project and discount FCFs
  const yearlyBreakdown: DCFYearRow[] = []
  let pvProjectedFCFs = 0

  for (let t = 1; t <= years; t++) {
    const fcf = baseFCF * Math.pow(1 + growthRate, t)
    const pvFCF = fcf / Math.pow(1 + wacc, t)
    yearlyBreakdown.push({ year: t, fcf, pvFCF })
    pvProjectedFCFs += pvFCF
  }

  // Step 3 & 4: Terminal value using Gordon Growth Model, discounted back
  const lastFCF = baseFCF * Math.pow(1 + growthRate, years)
  const terminalValue = (lastFCF * (1 + terminalGrowthRate)) / (wacc - terminalGrowthRate)
  const pvTerminalValue = terminalValue / Math.pow(1 + wacc, years)

  // Step 5: Enterprise Value
  const enterpriseValue = pvProjectedFCFs + pvTerminalValue

  // Step 6: Intrinsic value per share
  // All values in $millions — equity_millions / shares_millions = $ per share
  const equityValue = enterpriseValue - netDebt
  const intrinsicPricePerShare = sharesOutstanding > 0 ? equityValue / sharesOutstanding : 0

  return {
    yearlyBreakdown,
    pvProjectedFCFs,
    terminalValue,
    pvTerminalValue,
    enterpriseValue,
    equityValue,
    intrinsicPricePerShare,
  }
}
