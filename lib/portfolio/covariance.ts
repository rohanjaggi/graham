// Simple shrink-to-identity covariance regularisation
export function shrinkCovariance(
  Sigma: number[][]
): { shrunk: number[][]; alpha: number } {
  const n = Sigma.length
  if (n === 0) return { shrunk: Sigma, alpha: 0 }

  // Target: average variance * I
  let sumVar = 0
  for (let i = 0; i < n; i++) sumVar += Sigma[i][i]
  const avgVar = sumVar / n

  let sqDiff = 0
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const target = i === j ? avgVar : 0
      const diff = Sigma[i][j] - target
      sqDiff += diff * diff
    }
  }

  // Heuristic alpha: between 0.1 and 0.5
  const alpha = Math.min(0.5, Math.max(0.1, sqDiff / (sqDiff + 1e-6)))

  const shrunk: number[][] = []
  for (let i = 0; i < n; i++) {
    shrunk[i] = []
    for (let j = 0; j < n; j++) {
      const target = i === j ? avgVar : 0
      shrunk[i][j] = alpha * target + (1 - alpha) * Sigma[i][j]
    }
  }

  return { shrunk, alpha }
}