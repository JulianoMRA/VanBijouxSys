import { describe, it, expect } from 'vitest'
import { calcSuggestedPrice } from '../renderer/src/utils/pricing'

describe('calcSuggestedPrice', () => {
  it('should return 1 when both inputs are zero', () => {
    // teto((0 × 3 + 0) × 1,10 + 1,00) = teto(1,00) = 1
    expect(calcSuggestedPrice(0, 0)).toBe(1)
  })

  it('should apply the full formula correctly', () => {
    // materiais=10, labor=5
    // step1 = 10 × 3 = 30
    // step2 = 30 + 5 = 35
    // step3 = 35 × 1,10 = 38,5
    // step4 = 38,5 + 1 = 39,5
    // teto(39,5) = 40
    expect(calcSuggestedPrice(10, 5)).toBe(40)
  })

  it('should ceil a non-integer result', () => {
    // materiais=1, labor=0
    // step1 = 3, step2 = 3, step3 = 3,30, step4 = 4,30 → teto = 5
    expect(calcSuggestedPrice(1, 0)).toBe(5)
  })

  it('should not ceil when result is already an integer', () => {
    // Encontra valores onde o resultado é inteiro exato
    // materiais=0, labor=0 → teto(1) = 1
    expect(calcSuggestedPrice(0, 0)).toBe(1)
  })

  it('should handle only labor cost', () => {
    // materiais=0, labor=10
    // step1 = 0, step2 = 10, step3 = 11, step4 = 12 → teto(12) = 12
    expect(calcSuggestedPrice(0, 10)).toBe(12)
  })

  it('should handle only materials cost', () => {
    // materiais=5, labor=0
    // step1 = 15, step2 = 15, step3 = 16,5, step4 = 17,5 → teto(17,5) = 18
    expect(calcSuggestedPrice(5, 0)).toBe(18)
  })

  it('should handle decimal material costs', () => {
    // materiais=2,50, labor=3
    // step1 = 7,50, step2 = 10,50, step3 = 11,55, step4 = 12,55 → teto(12,55) = 13
    expect(calcSuggestedPrice(2.5, 3)).toBe(13)
  })

  it('should always return a positive integer', () => {
    const result = calcSuggestedPrice(3.75, 8.5)
    expect(result).toBeGreaterThan(0)
    expect(Number.isInteger(result)).toBe(true)
  })
})
