import { describe, expect, it } from 'vitest'
import { chaveDeBusca, vendaCorrespondeABusca } from '../renderer/src/utils/busca-de-vendas'
import type { Sale } from '../renderer/src/types'

function venda(over: Partial<Sale> = {}): Sale {
  return {
    id: 1,
    channel: 'WhatsApp',
    fairId: null,
    fairName: null,
    customerName: null,
    totalAmount: 25,
    totalCost: 3,
    paymentMethod: 'pix',
    feePercentage: 0,
    feeAmount: 0,
    netAmount: 25,
    soldAt: '2026-09-20',
    receivedAt: null,
    items: [
      {
        id: 1,
        variationId: 10,
        variationIdentifier: 'Rosa',
        productName: 'Colar Aurora',
        quantity: 1,
        unitPrice: 25,
        unitCost: 3
      }
    ],
    payments: [],
    amountDue: 0,
    ...over
  }
}

describe('chaveDeBusca', () => {
  it('should_ignore_case_and_accents', () => {
    expect(chaveDeBusca('Márcia CONCEIÇÃO')).toBe('marcia conceicao')
  })
})

describe('vendaCorrespondeABusca', () => {
  it('should_match_every_sale_when_the_term_is_blank', () => {
    expect(vendaCorrespondeABusca(venda(), '')).toBe(true)
    expect(vendaCorrespondeABusca(venda(), '   ')).toBe(true)
  })

  it('should_find_by_customer_ignoring_case_and_accents', () => {
    expect(vendaCorrespondeABusca(venda({ customerName: 'Márcia' }), 'marcia')).toBe(true)
    expect(vendaCorrespondeABusca(venda({ customerName: 'Márcia' }), ' MÁR ')).toBe(true)
  })

  it('should_find_by_fair_product_and_variation', () => {
    expect(vendaCorrespondeABusca(venda({ fairName: 'Feira do Bosque' }), 'bosque')).toBe(true)
    expect(vendaCorrespondeABusca(venda(), 'aurora')).toBe(true)
    expect(vendaCorrespondeABusca(venda(), 'rosa')).toBe(true)
  })

  it('should_not_match_a_sale_without_the_term', () => {
    expect(vendaCorrespondeABusca(venda({ customerName: 'Ana' }), 'maria')).toBe(false)
  })
})
