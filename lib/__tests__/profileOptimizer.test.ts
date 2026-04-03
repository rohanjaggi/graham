import { describe, expect, it } from 'vitest'
import { runProfileOptimize } from '../portfolio/profileOptimizer'
import type {
  HardConstraints,
  InvestmentHorizonBucket,
  ProfileOptimizeContext,
  RiskTolerance,
  UniverseFilter,
} from '../portfolio/contracts'

type TestContext = ProfileOptimizeContext & {
  timestamps?: number[]
  sectorBySymbol?: Record<string, string | null>
}

function buildReturns(days: number, generator: (day: number, asset: number) => number, assetCount: number) {
  return Array.from({ length: days }, (_, day) =>
    Array.from({ length: assetCount }, (_, asset) => generator(day, asset))
  )
}

function buildContext(overrides: Partial<TestContext> & {
  R?: number[][]
  symbols?: string[]
  timestamps?: number[]
  sectorBySymbol?: Record<string, string | null>
  hardConstraints?: HardConstraints
} = {}): TestContext {
  const symbols = overrides.symbols ?? ['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF']
  const R = overrides.R ?? buildReturns(160, (day, asset) => {
    const base = [0.0014, 0.0011, 0.0009, 0.0008, 0.0007, 0.0006][asset]
    const cycle = (((day + asset * 3) % 9) - 4) * 0.00035
    return base + cycle
  }, symbols.length)

  return {
    symbols,
    requestedSymbols: symbols,
    R,
    tradingDays: R.length,
    rfAnnual: 0.02,
    years: 5,
    investmentHorizon: (overrides.investmentHorizon ?? '<3y') as InvestmentHorizonBucket,
    riskTolerance: (overrides.riskTolerance ?? 'MODERATE') as RiskTolerance,
    universeFilter: (overrides.universeFilter ?? 'US_LARGE_CAP') as UniverseFilter,
    hardConstraints: overrides.hardConstraints ?? { max_single_position: 0.25, max_sector_weight: 0.45 },
    dataWarnings: overrides.dataWarnings ?? [],
    timestamps: overrides.timestamps,
    sectorBySymbol: overrides.sectorBySymbol,
  }
}

describe('runProfileOptimize', () => {
  it('returns long-only fully invested weights that respect the single-position cap', async () => {
    const result = await runProfileOptimize(
      buildContext({
        hardConstraints: { max_single_position: 0.2, max_sector_weight: 0.6 },
        sectorBySymbol: {
          AAA: 'Tech',
          BBB: 'Health',
          CCC: 'Energy',
          DDD: 'Finance',
          EEE: 'Industrial',
          FFF: 'Utilities',
        },
      })
    )

    const weights = Object.values(result.optimal_weights)
    const total = weights.reduce((sum, weight) => sum + weight, 0)

    expect(total).toBeCloseTo(1, 5)
    for (const weight of weights) {
      expect(weight).toBeGreaterThanOrEqual(0)
      expect(weight).toBeLessThanOrEqual(0.200001)
    }
  })

  it('respects sector caps when a feasible solution exists', async () => {
    const sectorLookup: Record<string, string> = {
      AAA: 'Tech',
      BBB: 'Tech',
      CCC: 'Health',
      DDD: 'Health',
      EEE: 'Industrial',
      FFF: 'Industrial',
    }

    const result = await runProfileOptimize(
      buildContext({
        hardConstraints: { max_single_position: 0.25, max_sector_weight: 0.4 },
        sectorBySymbol: sectorLookup,
      })
    )

    const sectorTotals = Object.entries(result.optimal_weights).reduce<Record<string, number>>((acc, [symbol, weight]) => {
      const sector = sectorLookup[symbol]
      acc[sector] = (acc[sector] ?? 0) + weight
      return acc
    }, {})

    expect(sectorTotals.Tech).toBeLessThanOrEqual(0.400001)
    expect(sectorTotals.Health).toBeLessThanOrEqual(0.400001)
    expect(sectorTotals.Industrial).toBeLessThanOrEqual(0.400001)
  })

  it('throws when the sector cap is infeasible for the supplied universe', async () => {
    await expect(runProfileOptimize(
      buildContext({
        symbols: ['AAA', 'BBB', 'CCC'],
        R: buildReturns(120, (day, asset) => 0.001 + (((day + asset) % 5) - 2) * 0.0004, 3),
        hardConstraints: { max_single_position: 0.25, max_sector_weight: 0.4 },
        sectorBySymbol: { AAA: 'Tech', BBB: 'Tech', CCC: 'Tech' },
      })
    )).rejects.toThrow('Infeasible max_single_position constraint')
  })

  it('adds risk warnings when drawdowns are harsh for conservative short-horizon users', async () => {
    const R = buildReturns(90, (day, asset) => {
      if (day < 20) return -0.03 - asset * 0.001
      if (day < 45) return 0.004 + asset * 0.0002
      return 0.002
    }, 4)

    const result = await runProfileOptimize(
      buildContext({
        symbols: ['AAA', 'BBB', 'CCC', 'DDD'],
        R,
        riskTolerance: 'CONSERVATIVE',
        investmentHorizon: '<3y',
        hardConstraints: { max_single_position: 0.25 },
      })
    )

    expect(result.data_warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('conservative investor'),
        expect.stringContaining('sub-3-year investment horizon'),
      ])
    )
    expect(result.max_drawdown).toBeLessThan(-0.35)
  })
})
