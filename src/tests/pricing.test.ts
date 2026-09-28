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

  it('should_not_add_a_real_when_the_margin_gives_an_exact_value', () => {
    // materiais 10, mão de obra 20: (30 + 20) × 1,10 + 1 = 56 exatos. Em ponto
    // flutuante, 50 × 1,1 dá 55,00000000000001, e o teto subia para 57.
    expect(calcSuggestedPrice(10, 20)).toBe(56)
    expect(calcSuggestedPrice(0, 100)).toBe(111)
  })

  it('should_match_the_exact_formula_for_every_round_base_up_to_2000', () => {
    // Base redonda (múltiplo de 10): × 1,10 dá um valor inteiro, e o preço é esse + 1.
    // Antes, 111 das 200 bases saíam um real acima.
    for (let base = 10; base <= 2000; base += 10) {
      expect(calcSuggestedPrice(0, base)).toBe((base / 10) * 11 + 1)
    }
  })

  it('should_round_fractional_insumo_costs_to_cents_before_the_ceiling', () => {
    // Receita com custo por unidade de quatro casas: 9,9999 é R$ 10,00 na tela.
    expect(calcSuggestedPrice(3.3333, 0)).toBe(12)
  })
})
