import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  dicaDaTaxa,
  FORMAS_DA_VENDA,
  FORMAS_RECEBIDAS,
  lembrarTaxa,
  PAYMENT_LABELS,
  taxaSugerida
} from '../renderer/src/utils/formas-de-pagamento'

beforeEach(() => {
  const guardado = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (chave: string) => guardado.get(chave) ?? null,
    setItem: (chave: string, valor: string) => guardado.set(chave, valor)
  })
})

describe('formas de pagamento', () => {
  it('should_offer_a_receber_only_in_the_sale', () => {
    expect(FORMAS_RECEBIDAS).not.toContain('areceber')
    expect(FORMAS_DA_VENDA).toEqual([...FORMAS_RECEBIDAS, 'areceber'])
    expect(FORMAS_DA_VENDA.map((forma) => PAYMENT_LABELS[forma])).toEqual([
      'Dinheiro',
      'PIX',
      'Débito',
      'Crédito',
      'A receber'
    ])
  })
})

describe('taxa lembrada', () => {
  it('should_suggest_the_last_fee_typed_for_the_same_method', () => {
    lembrarTaxa('credito', '3,49')

    expect(taxaSugerida('credito')).toBe('3,49')
    expect(taxaSugerida('debito')).toBe('')
  })

  it('should_keep_the_remembered_fee_when_the_new_one_is_zero_or_empty', () => {
    lembrarTaxa('pix', '0,99')
    lembrarTaxa('pix', '0')
    lembrarTaxa('pix', '')

    expect(taxaSugerida('pix')).toBe('0,99')
  })

  it('should_suggest_zero_for_cash_and_for_a_receber', () => {
    lembrarTaxa('dinheiro', '5')
    lembrarTaxa('areceber', '5')

    expect(taxaSugerida('dinheiro')).toBe('0')
    expect(taxaSugerida('areceber')).toBe('0')
  })

  it('should_hint_the_usual_fee_of_pix_and_debit', () => {
    expect(dicaDaTaxa('pix')).toBe('sugerido: 0,99%')
    expect(dicaDaTaxa('debito')).toBe('sugerido: 1,69%')
    expect(dicaDaTaxa('credito')).toBe('variável')
  })
})
