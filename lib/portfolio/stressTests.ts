import { StressTestResults } from './contracts'

export function runSimpleStressTests(weights: number[], historicalMaxDrawdown = 0): StressTestResults {
  const totalWeight = weights.reduce((s, w) => s + w, 0)
  const equityExposure = weights
    .map(w => (totalWeight > 0 ? w / totalWeight : 0))
    .reduce((sum, weight) => sum + weight, 0)

  const crash30 = -0.30
  const crash50 = -0.50
  const drawdownFloor = Math.min(historicalMaxDrawdown, 0)

  function estimateScenario(shock: number) {
    const estimatedReturn = shock * equityExposure
    const estimatedDrawdown = Math.min(estimatedReturn, drawdownFloor * 1.1)

    return {
      assumed_shock: shock,
      estimated_portfolio_return: estimatedReturn,
      estimated_drawdown: estimatedDrawdown,
    }
  }

  return {
    equity_crash_30: estimateScenario(crash30),
    equity_crash_50: estimateScenario(crash50),
  }
}
