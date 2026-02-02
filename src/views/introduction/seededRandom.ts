// Simple seeded random number generator (Mulberry32)
export function createSeededRandom(seed: number) {
  return function(): number {
    let t = seed += 0x6D2B79F5
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// Seeded gaussian random using Box-Muller
export function createSeededGaussian(random: () => number) {
  let spare: number | null = null
  
  return function(mean: number = 0, stdDev: number = 1): number {
    if (spare !== null) {
      const val = spare
      spare = null
      return val * stdDev + mean
    }
    
    let u, v, s
    do {
      u = random() * 2 - 1
      v = random() * 2 - 1
      s = u * u + v * v
    } while (s >= 1 || s === 0)
    
    s = Math.sqrt(-2 * Math.log(s) / s)
    spare = v * s
    return u * s * stdDev + mean
  }
}
