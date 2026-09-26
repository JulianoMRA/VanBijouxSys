import { describe, expect, it } from 'vitest'
import { precisaDeReposicao, situacaoDoInsumo } from '../renderer/src/utils/situacao-do-insumo'

const insumo = (stockQuantity: number, minimumStock: number) => ({ stockQuantity, minimumStock })

describe('situacaoDoInsumo (RN-19)', () => {
  it('should_call_an_insumo_without_stock_out_even_without_a_minimum', () => {
    expect(situacaoDoInsumo(insumo(0, 0))).toBe('out')
    expect(situacaoDoInsumo(insumo(0, 50))).toBe('out')
  })

  it('should_call_a_negative_balance_out_and_not_low', () => {
    // RN-03: negativo quer dizer compra não lançada; não é "pouco", é "nada".
    expect(situacaoDoInsumo(insumo(-12.5, 50))).toBe('out')
  })

  it('should_call_it_low_only_below_a_minimum_that_was_set', () => {
    expect(situacaoDoInsumo(insumo(30, 50))).toBe('low')
    expect(situacaoDoInsumo(insumo(30, 0))).toBe('ok')
  })

  it('should_call_it_ok_at_the_minimum', () => {
    expect(situacaoDoInsumo(insumo(50, 50))).toBe('ok')
  })

  it('should_ask_for_replenishment_when_out_or_low', () => {
    expect(precisaDeReposicao(insumo(0, 0))).toBe(true)
    expect(precisaDeReposicao(insumo(30, 50))).toBe(true)
    expect(precisaDeReposicao(insumo(80, 50))).toBe(false)
  })
})
