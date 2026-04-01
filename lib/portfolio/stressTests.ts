import { StressTestResults } from './contracts'

export function runSimpleStressTests(weights: number[]): StressTestResults {
  const totalWeight = weights.reduce((s, w) => s + w, 0)
  const normalized = weights.map(w => (totalWeight > 0 ? w / totalWeight : 0))

  const crash30 = -0.30
  const crash50 = -0.50

  const equityCrash30 = {
    assumed_shock: crash30,
    estimated_portfolio_return: crash30,
    estimated_drawdown: crash30
  }

  const equityCrash50 = {
    assumed_shock: crash50,
    estimated_portfolio_return: crash50,
    estimated_drawdown: crash50
  }

  return {
    equity_crash_30: equityCrash30,
    equity_crash_50: equityCrash50
  }
}
// can later refine to be asset-class aware