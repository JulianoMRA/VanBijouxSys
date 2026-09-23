import { describe, expect, it } from 'vitest'
import {
  descreverPagamento,
  estaPendente,
  somaDoQueFalta,
  totalRecebido
} from '../renderer/src/utils/recebimentos'
import { formatCurrency } from '../renderer/src/utils/format'
import type { Sale, SalePayment } from '../renderer/src/types'

function pagamento(over: Partial<SalePayment> = {}): SalePayment {
  return {
    id: 1,
    amount: 50,
    paymentMethod: 'pix',
    feePercentage: 0,
    feeAmount: 0,
    netAmount: 50,
    receivedAt: '2026-09-22',
    ...over
  }
}

/** Venda de R$ 86,00 a receber, sem pagamento. */
function venda(over: Partial<Sale> = {}): Sale {
  return {
    id: 1,
    channel: 'WhatsApp',
    fairId: null,
    fairName: null,
    customerName: 'Maria',
    totalAmount: 86,
    totalCost: 20,
    paymentMethod: 'areceber',
    feePercentage: 0,
    feeAmount: 0,
    netAmount: 86,
    soldAt: '2026-09-21',
    receivedAt: null,
    items: [],
    payments: [],
    amountDue: 86,
    ...over
  }
}

describe('estaPendente', () => {
  it('should_be_pending_while_something_is_still_due', () => {
    expect(estaPendente(venda())).toBe(true)
    expect(estaPendente(venda({ payments: [pagamento()], amountDue: 36 }))).toBe(true)
  })

  it('should_not_be_pending_once_settled_or_paid_at_once', () => {
    expect(estaPendente(venda({ payments: [pagamento({ amount: 86 })], amountDue: 0 }))).toBe(false)
    expect(estaPendente(venda({ paymentMethod: 'pix', amountDue: 0 }))).toBe(false)
  })
})

describe('totalRecebido', () => {
  it('should_sum_the_amounts_paid_before_fees', () => {
    const pagamentos = [pagamento({ amount: 50, netAmount: 49.5 }), pagamento({ amount: 20 })]
    expect(totalRecebido(venda({ payments: pagamentos }))).toBe(70)
  })
})

describe('somaDoQueFalta', () => {
  it('should_sum_what_each_sale_still_owes', () => {
    expect(somaDoQueFalta([venda({ amountDue: 36 }), venda({ amountDue: 30 })])).toBe(66)
  })

  it('should_add_in_cents_without_floating_point_residue', () => {
    expect(somaDoQueFalta([venda({ amountDue: 0.1 }), venda({ amountDue: 0.2 })])).toBe(0.3)
  })
})

describe('descreverPagamento', () => {
  it('should_say_nothing_entered_the_cash_for_a_receivable_without_payments', () => {
    expect(descreverPagamento(venda())).toBe('A receber · ainda não entrou no caixa')
  })

  it('should_show_paid_and_due_for_a_partially_paid_sale', () => {
    expect(descreverPagamento(venda({ payments: [pagamento()], amountDue: 36 }))).toBe(
      `A receber · pago ${formatCurrency(50)} · falta ${formatCurrency(36)}`
    )
  })

  it('should_describe_a_sale_settled_by_one_payment_like_a_received_one', () => {
    const pago = pagamento({
      amount: 86,
      paymentMethod: 'credito',
      feePercentage: 3.49,
      feeAmount: 3,
      netAmount: 83
    })
    expect(descreverPagamento(venda({ payments: [pago], amountDue: 0 }))).toBe(
      `Crédito (3,49%) · taxa − ${formatCurrency(3)} · recebido em 22/09/2026`
    )
  })

  it('should_count_the_payments_of_a_sale_settled_in_parts', () => {
    const pagamentos = [
      pagamento({ amount: 50, receivedAt: '2026-09-22' }),
      pagamento({ id: 2, amount: 36, receivedAt: '2026-10-05' })
    ]
    expect(descreverPagamento(venda({ payments: pagamentos, amountDue: 0 }))).toBe(
      'Recebida em 2 pagamentos · quitada em 05/10/2026'
    )
  })

  it('should_describe_a_sale_paid_at_once_with_its_fee', () => {
    expect(
      descreverPagamento(
        venda({ paymentMethod: 'credito', feePercentage: 3.49, feeAmount: 3, amountDue: 0 })
      )
    ).toBe(`Crédito (3,49%) · taxa − ${formatCurrency(3)}`)
    expect(descreverPagamento(venda({ paymentMethod: 'pix', amountDue: 0 }))).toBe('PIX · sem taxa')
  })

  it('should_keep_the_receipt_date_of_a_sale_received_by_the_old_version', () => {
    expect(
      descreverPagamento(venda({ paymentMethod: 'pix', receivedAt: '2026-09-22', amountDue: 0 }))
    ).toBe('PIX · sem taxa · recebido em 22/09/2026')
  })
})
