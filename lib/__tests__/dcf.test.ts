import { describe, it, expect } from 'vitest'
import { runDCF } from '../dcf'

const base = {
  baseFCF: 100,             // $100M
  growthRate: 0.10,         // 10%
  terminalGrowthRate: 0.025,
  wacc: 0.10,
  years: 5,
  sharesOutstanding: 50,    // 50M shares
  netDebt: 200,             // $200M net debt
}

describe('runDCF', () => {
  it('projects year 1 FCF as baseFCF * (1 + growthRate)', () => {
    const result = runDCF(base)
    expect(result.yearlyBreakdown[0].fcf).toBeCloseTo(110, 2)
  })

  it('discounts year 1 FCF at WACC to arrive at PV', () => {
    // PV = 110 / 1.10 = 100.00
    const result = runDCF(base)
    expect(result.yearlyBreakdown[0].pvFCF).toBeCloseTo(100, 2)
  })

  it('returns one row per projection year', () => {
    const result = runDCF(base)
    expect(result.yearlyBreakdown).toHaveLength(5)
  })

  it('pvProjectedFCFs equals sum of all pvFCF rows', () => {
    const result = runDCF(base)
    const sum = result.yearlyBreakdown.reduce((acc, r) => acc + r.pvFCF, 0)
    expect(result.pvProjectedFCFs).toBeCloseTo(sum, 4)
  })

  it('calculates terminal value using Gordon Growth Model', () => {
    // FCF_5 = 100 * 1.1^5 = 161.051
    // TV = FCF_5 * (1 + g_t) / (wacc - g_t) = 161.051 * 1.025 / 0.075
    const fcf5 = 100 * Math.pow(1.1, 5)
    const expected = (fcf5 * 1.025) / (0.10 - 0.025)
    const result = runDCF(base)
    expect(result.terminalValue).toBeCloseTo(expected, 1)
  })

  it('discounts terminal value back N years at WACC', () => {
    const result = runDCF(base)
    const expected = result.terminalValue / Math.pow(1.10, 5)
    expect(result.pvTerminalValue).toBeCloseTo(expected, 2)
  })

  it('enterpriseValue = pvProjectedFCFs + pvTerminalValue', () => {
    const result = runDCF(base)
    expect(result.enterpriseValue).toBeCloseTo(result.pvProjectedFCFs + result.pvTerminalValue, 4)
  })

  it('equityValue = enterpriseValue - netDebt', () => {
    const result = runDCF(base)
    expect(result.equityValue).toBeCloseTo(result.enterpriseValue - 200, 4)
  })

  it('intrinsicPricePerShare = equityValue / sharesOutstanding', () => {
    const result = runDCF(base)
    expect(result.intrinsicPricePerShare).toBeCloseTo(result.equityValue / 50, 4)
  })

  it('returns 0 intrinsicPricePerShare when sharesOutstanding is 0', () => {
    const result = runDCF({ ...base, sharesOutstanding: 0 })
    expect(result.intrinsicPricePerShare).toBe(0)
  })

  it('works correctly with years = 10', () => {
    const result = runDCF({ ...base, years: 10 })
    expect(result.yearlyBreakdown).toHaveLength(10)
  })

  it('throws when wacc does not exceed terminalGrowthRate', () => {
    expect(() => runDCF({ ...base, wacc: 0.025, terminalGrowthRate: 0.025 })).toThrow()
    expect(() => runDCF({ ...base, wacc: 0.02, terminalGrowthRate: 0.025 })).toThrow()
  })
})
