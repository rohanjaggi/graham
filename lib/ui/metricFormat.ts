export function formatPercent(value: number | undefined, decimals = 2) {
  if (value == null || Number.isNaN(value)) return '-'
  return `${(value * 100).toFixed(decimals)}%`
}

export function formatSignedPercent(value: number | undefined, decimals = 2) {
  if (value == null || Number.isNaN(value)) return '-'
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${sign}${(Math.abs(value) * 100).toFixed(decimals)}%`
}

export function formatDownsidePercent(value: number | undefined, decimals = 2) {
  if (value == null || Number.isNaN(value)) return '-'
  if (Math.abs(value) < 1e-12) return `${(0).toFixed(decimals)}%`
  return `-${(Math.abs(value) * 100).toFixed(decimals)}%`
}

export function metricColorForValue(
  value: number | undefined,
  options?: {
    positive?: string
    negative?: string
    zero?: string
  }
) {
  const positive = options?.positive ?? 'var(--green)'
  const negative = options?.negative ?? 'var(--red)'
  const zero = options?.zero ?? 'var(--text-primary)'
  if (value == null || Number.isNaN(value) || Math.abs(value) < 1e-12) return zero
  return value > 0 ? positive : negative
}
