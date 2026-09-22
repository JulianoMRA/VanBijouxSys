import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prepararAmbienteIpc, type AmbienteIpc } from '../helpers/ambiente-ipc'
import { queryAll } from '../helpers/testDb'
import { criarVariacao, criarVenda, estoqueDaVariacao } from '../helpers/estoque'
import { receber, simularRecebimentoAntigo } from '../helpers/recebimentos'
import type { DashboardStats } from '../../shared/ipc/painel'
import type { Sale } from '../../shared/ipc/vendas'

vi.mock('electron', async () => (await import('../helpers/ambiente-ipc')).electronFalso)
vi.mock('../../main/database', async () => (await import('../helpers/ambiente-ipc')).bancoFalso)

let ambiente: AmbienteIpc
let variacao: number

beforeEach(async () => {
  ambiente = await prepararAmbienteIpc()
  variacao = await criarVariacao(ambiente, {
    receita: [],
    costPrice: 20,
    salePrice: 86,
    stockQuantity: 10,
    motivoDoEstoqueInicial: 'contagem'
  })
})

type Itens = Array<{ variationId: number; quantity: number; unitPrice: number; unitCost: number }>

const itens = (unitPrice = 86, quantity = 1): Itens => [
  { variationId: variacao, quantity, unitPrice, unitCost: 20 }
]

/** O exemplo da cliente: venda de R$ 86,00 a receber da Maria, em 21/09. */
function vendaAReceber(dados: { items?: Itens; soldAt?: string } = {}): Promise<number> {
  return criarVenda(ambiente, {
    soldAt: '2026-09-21',
    paymentMethod: 'areceber',
    customerName: 'Maria',
    items: itens(),
    ...dados
  })
}

/** Mesmo formato que o SaleForm envia ao salvar a edição de uma venda a receber. */
const edicao = (id: number, dados: Record<string, unknown> = {}): Record<string, unknown> => ({
  id,
  channel: 'WhatsApp',
  customerName: 'Maria',
  soldAt: '2026-09-21',
  paymentMethod: 'areceber',
  feePercentage: 0,
  feeAmount: 0,
  netAmount: 86,
  items: itens(),
  ...dados
})

async function venda(id: number): Promise<Sale> {
  const vendas = await ambiente.chamar<Sale[]>('sales:getAll')
  return vendas.find((v) => v.id === id) as Sale
}

function estado(): unknown {
  return ['sales', 'sale_items', 'sale_payments', 'product_variations'].map((t) =>
    queryAll(ambiente.banco, `SELECT * FROM ${t} ORDER BY id`)
  )
}

async function recusaSemGravar(chamada: () => Promise<unknown>, motivo: RegExp): Promise<void> {
  const antes = estado()
  await expect(chamada()).rejects.toThrow(motivo)
  expect(estado()).toEqual(antes)
}

function painel(customFrom: string, customTo: string): Promise<DashboardStats> {
  return ambiente.chamar<DashboardStats>('dashboard:getStats', {
    period: 'custom',
    customFrom,
    customTo
  })
}

describe('pagamento de venda a receber (RN-17)', () => {
  it('should_leave_what_is_still_due_after_a_partial_payment', async () => {
    const id = await vendaAReceber()

    await receber(ambiente, id, { amount: 50, receivedAt: '2026-09-22' })

    const atual = await venda(id)
    expect(atual.amountDue).toBe(36)
    expect(atual.paymentMethod).toBe('areceber')
    expect(atual.payments).toEqual([
      {
        id: expect.any(Number),
        amount: 50,
        paymentMethod: 'pix',
        feePercentage: 0,
        feeAmount: 0,
        netAmount: 50,
        receivedAt: '2026-09-22'
      }
    ])
  })

  it('should_settle_the_sale_when_the_payments_reach_the_total', async () => {
    const id = await vendaAReceber()

    await receber(ambiente, id, { amount: 50, receivedAt: '2026-09-22' })
    await receber(ambiente, id, { amount: 36, paymentMethod: 'dinheiro', receivedAt: '2026-10-05' })

    const atual = await venda(id)
    expect(atual.amountDue).toBe(0)
    expect(atual.payments.map((p) => [p.receivedAt, p.amount])).toEqual([
      ['2026-09-22', 50],
      ['2026-10-05', 36]
    ])
  })

  it('should_settle_at_once_when_the_whole_amount_is_paid', async () => {
    const id = await vendaAReceber()

    await receber(ambiente, id, { amount: 86 })

    expect((await venda(id)).amountDue).toBe(0)
  })

  it('should_settle_exactly_even_when_the_total_carries_floating_point_residue', async () => {
    // 3 × 28,67 menos 50 e 36,01 dá 1,4e-14 em ponto flutuante: sem arredondar em
    // centavos, a venda ficaria "a receber" por um resíduo invisível.
    const id = await vendaAReceber({ items: itens(28.67, 3) })

    await receber(ambiente, id, { amount: 50 })
    await receber(ambiente, id, { amount: 36.01 })

    expect((await venda(id)).amountDue).toBe(0)
  })

  it('should_report_a_plain_zero_when_the_residue_is_negative', async () => {
    // 3 × 19,90 menos 29,85 e 29,85 dá -7e-15, que arredonda para -0: a tela
    // mostraria "-R$ 0,00" e o painel compararia -0 como se sobrasse algo.
    const id = await vendaAReceber({ items: itens(19.9, 3) })

    await receber(ambiente, id, { amount: 29.85 })
    await receber(ambiente, id, { amount: 29.85 })

    expect(Object.is((await venda(id)).amountDue, 0)).toBe(true)
  })

  it('should_report_nothing_due_for_a_sale_paid_at_once', async () => {
    const id = await criarVenda(ambiente, { paymentMethod: 'pix', items: itens() })

    const atual = await venda(id)
    expect(atual.amountDue).toBe(0)
    expect(atual.payments).toEqual([])
  })
})

describe('pagamento: recusas', () => {
  it('should_refuse_a_payment_above_what_is_due', async () => {
    const id = await vendaAReceber()
    await receber(ambiente, id, { amount: 50 })

    await recusaSemGravar(
      () => receber(ambiente, id, { amount: 40 }),
      /maior do que o que falta receber/
    )
  })

  it('should_refuse_a_payment_for_a_sale_paid_at_once', async () => {
    const id = await criarVenda(ambiente, { paymentMethod: 'pix', items: itens() })

    await recusaSemGravar(
      () => receber(ambiente, id, { amount: 10 }),
      /Só venda a receber aceita pagamento/
    )
  })

  it('should_refuse_a_payment_for_a_settled_sale', async () => {
    const id = await vendaAReceber()
    await receber(ambiente, id, { amount: 86 })

    await recusaSemGravar(() => receber(ambiente, id, { amount: 1 }), /já foi recebida por inteiro/)
  })

  it('should_refuse_a_payment_dated_before_the_sale', async () => {
    const id = await vendaAReceber()

    await recusaSemGravar(
      () => receber(ambiente, id, { amount: 50, receivedAt: '2026-09-20' }),
      /não pode ser anterior à data da venda/
    )
  })

  it('should_refuse_a_payment_for_a_sale_that_does_not_exist', async () => {
    await recusaSemGravar(() => receber(ambiente, 999, { amount: 10 }), /não foi encontrada/)
  })
})

describe('pagamento: taxa', () => {
  it('should_take_the_fee_of_each_payment_out_of_the_sale_net', async () => {
    const id = await vendaAReceber()

    await receber(ambiente, id, { amount: 50, paymentMethod: 'pix', feePercentage: 1 })
    await receber(ambiente, id, { amount: 36, paymentMethod: 'credito', feePercentage: 2 })

    const atual = await venda(id)
    expect(atual.payments.map((p) => [p.feeAmount, p.netAmount])).toEqual([
      [0.5, 49.5],
      [0.72, 35.28]
    ])
    expect(atual.feeAmount).toBeCloseTo(1.22, 10)
    expect(atual.netAmount).toBeCloseTo(84.78, 10)
  })

  it('should_not_let_the_fee_change_what_is_due', async () => {
    const id = await vendaAReceber()

    await receber(ambiente, id, { amount: 50, paymentMethod: 'credito', feePercentage: 3.49 })

    expect((await venda(id)).amountDue).toBe(36)
  })

  it('should_count_the_payment_fee_in_the_dashboard_profit', async () => {
    const id = await vendaAReceber()
    await receber(ambiente, id, { amount: 50, paymentMethod: 'pix', feePercentage: 1 })

    const { overview } = await painel('2026-09-01', '2026-09-30')

    expect(overview.totalRevenue).toBe(86)
    expect(overview.totalProfit).toBeCloseTo(86 - 0.5 - 20, 10)
  })
})

describe('pagamento: exclusão', () => {
  it('should_return_the_amount_to_what_is_due_when_a_payment_is_deleted', async () => {
    const id = await vendaAReceber()
    const pagamento = await receber(ambiente, id, { amount: 50, feePercentage: 1 })

    await ambiente.chamar('sales:deletePayment', pagamento)

    const atual = await venda(id)
    expect(atual).toMatchObject({ amountDue: 86, payments: [], feeAmount: 0, netAmount: 86 })
  })

  it('should_keep_the_other_payments_when_one_is_deleted', async () => {
    const id = await vendaAReceber()
    const primeiro = await receber(ambiente, id, { amount: 50, receivedAt: '2026-09-22' })
    await receber(ambiente, id, { amount: 20, feePercentage: 1, receivedAt: '2026-09-25' })

    await ambiente.chamar('sales:deletePayment', primeiro)

    const atual = await venda(id)
    expect(atual.payments.map((p) => p.amount)).toEqual([20])
    expect(atual.amountDue).toBe(66)
    expect(atual.feeAmount).toBeCloseTo(0.2, 10)
  })
})

describe('venda com pagamento: editar e excluir', () => {
  it('should_refuse_changing_the_payment_method_of_a_sale_with_payments', async () => {
    const id = await vendaAReceber()
    await receber(ambiente, id, { amount: 50 })

    await recusaSemGravar(
      () => ambiente.chamar('sales:update', edicao(id, { paymentMethod: 'pix' })),
      /forma continua "A receber"/
    )
  })

  it('should_refuse_a_total_below_what_was_already_received', async () => {
    const id = await vendaAReceber()
    await receber(ambiente, id, { amount: 50 })

    await recusaSemGravar(
      () => ambiente.chamar('sales:update', edicao(id, { items: itens(40) })),
      /abaixo do que já foi recebido/
    )
  })

  it('should_refuse_moving_the_sale_date_after_a_payment', async () => {
    const id = await vendaAReceber()
    await receber(ambiente, id, { amount: 50, receivedAt: '2026-09-22' })

    await recusaSemGravar(
      () => ambiente.chamar('sales:update', edicao(id, { soldAt: '2026-09-23' })),
      /depois de um pagamento já registrado/
    )
  })

  it('should_keep_the_payment_fees_when_the_sale_total_is_edited', async () => {
    const id = await vendaAReceber()
    await receber(ambiente, id, { amount: 50, feePercentage: 1 })

    await ambiente.chamar('sales:update', edicao(id, { items: itens(100), netAmount: 100 }))

    const atual = await venda(id)
    expect(atual.amountDue).toBe(50)
    expect(atual.feeAmount).toBeCloseTo(0.5, 10)
    expect(atual.netAmount).toBeCloseTo(99.5, 10)
  })

  it('should_delete_the_payments_together_with_the_sale', async () => {
    const id = await vendaAReceber()
    await receber(ambiente, id, { amount: 50 })

    await ambiente.chamar('sales:delete', id)

    expect(queryAll(ambiente.banco, 'SELECT * FROM sale_payments')).toEqual([])
    expect(estoqueDaVariacao(ambiente, variacao)).toBe(10)
  })
})

describe('vendas recebidas antes da migração 4', () => {
  const recebimentoAntigo = {
    paymentMethod: 'pix',
    feePercentage: 0.99,
    feeAmount: 0.85,
    netAmount: 85.15,
    receivedAt: '2026-09-22'
  } as const

  it('should_report_nothing_due_for_a_sale_received_by_the_old_version', async () => {
    const id = await vendaAReceber()
    simularRecebimentoAntigo(ambiente, id, recebimentoAntigo)

    expect(await venda(id)).toMatchObject({ amountDue: 0, payments: [] })
  })

  it('should_undo_a_receipt_recorded_by_the_old_version', async () => {
    const id = await vendaAReceber()
    simularRecebimentoAntigo(ambiente, id, recebimentoAntigo)

    await ambiente.chamar('sales:unmarkAsReceived', id)

    expect(await venda(id)).toMatchObject({
      paymentMethod: 'areceber',
      feePercentage: 0,
      feeAmount: 0,
      netAmount: 86,
      receivedAt: null,
      amountDue: 86
    })
  })

  it('should_not_let_undo_touch_a_sale_whose_receipts_are_payments', async () => {
    const id = await vendaAReceber()
    await receber(ambiente, id, { amount: 50, feePercentage: 1 })
    const antes = estado()

    await ambiente.chamar('sales:unmarkAsReceived', id)

    expect(estado()).toEqual(antes)
  })

  it('should_keep_an_old_receipt_in_the_cash_on_the_day_it_was_received', async () => {
    const id = await vendaAReceber({ soldAt: '2026-08-30' })
    simularRecebimentoAntigo(ambiente, id, recebimentoAntigo)

    const setembro = await painel('2026-09-01', '2026-09-30')

    expect(setembro.cashSummary.totalIncome).toBeCloseTo(85.15, 10)
  })
})

describe('pagamento no caixa e no painel', () => {
  it('should_put_each_payment_in_the_cash_on_the_day_it_was_received', async () => {
    const id = await vendaAReceber()
    await receber(ambiente, id, { amount: 50, feePercentage: 1, receivedAt: '2026-09-22' })
    await receber(ambiente, id, { amount: 36, paymentMethod: 'dinheiro', receivedAt: '2026-10-05' })

    const setembro = await painel('2026-09-01', '2026-09-30')
    const outubro = await painel('2026-10-01', '2026-10-31')
    const tudo = await ambiente.chamar<DashboardStats>('dashboard:getStats', { period: 'all' })

    expect(setembro.cashSummary.totalIncome).toBeCloseTo(49.5, 10)
    expect(outubro.cashSummary.totalIncome).toBe(36)
    expect(tudo.cashFlow).toEqual([
      { month: '2026-09', income: 49.5, expenses: 0 },
      { month: '2026-10', income: 36, expenses: 0 }
    ])
  })

  it('should_show_in_the_dashboard_only_what_is_still_due', async () => {
    const id = await vendaAReceber()
    await receber(ambiente, id, { amount: 50 })

    const { overview } = await painel('2026-09-01', '2026-09-30')

    expect(overview.totalReceivable).toBe(36)
  })

  it('should_show_nothing_due_in_the_dashboard_once_the_sale_is_settled', async () => {
    const id = await vendaAReceber({ items: itens(28.67, 3) })
    await receber(ambiente, id, { amount: 50 })
    await receber(ambiente, id, { amount: 36.01 })

    const { overview } = await painel('2026-09-01', '2026-09-30')

    expect(overview.totalReceivable).toBe(0)
  })

  it('should_sum_payments_in_the_cash_stats_by_payment_date', async () => {
    const id = await vendaAReceber()
    await receber(ambiente, id, { amount: 50, feePercentage: 1, receivedAt: '2026-09-22' })
    await receber(ambiente, id, { amount: 36, receivedAt: '2026-10-05' })

    const setembro = await ambiente.chamar<{ totalIncome: number }>('cash-expenses:getStats', {
      startDate: '2026-09-01',
      endDate: '2026-09-30'
    })
    const tudo = await ambiente.chamar<{ totalIncome: number }>('cash-expenses:getStats')

    expect(setembro.totalIncome).toBeCloseTo(49.5, 10)
    expect(tudo.totalIncome).toBeCloseTo(85.5, 10)
  })
})
