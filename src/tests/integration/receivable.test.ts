import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prepararAmbienteIpc, type AmbienteIpc } from '../helpers/ambiente-ipc'
import { queryOne } from '../helpers/testDb'
import { criarVariacao, criarVenda } from '../helpers/estoque'
import type { DashboardStats } from '../../shared/ipc/painel'

vi.mock('electron', async () => (await import('../helpers/ambiente-ipc')).electronFalso)
vi.mock('../../main/database', async () => (await import('../helpers/ambiente-ipc')).bancoFalso)

let ambiente: AmbienteIpc
let variacao: number

beforeEach(async () => {
  ambiente = await prepararAmbienteIpc()
  variacao = await criarVariacao(ambiente, {
    receita: [],
    costPrice: 5,
    salePrice: 30,
    stockQuantity: 10,
    motivoDoEstoqueInicial: 'contagem'
  })
})

const item = (
  quantity: number,
  unitPrice: number,
  unitCost = 5
): {
  variationId: number
  quantity: number
  unitPrice: number
  unitCost: number
} => ({ variationId: variacao, quantity, unitPrice, unitCost })

function painelDeMaio(): Promise<DashboardStats> {
  return ambiente.chamar<DashboardStats>('dashboard:getStats', {
    period: 'custom',
    customFrom: '2026-05-01',
    customTo: '2026-05-31'
  })
}

function painelCompleto(): Promise<DashboardStats> {
  return ambiente.chamar<DashboardStats>('dashboard:getStats', { period: 'all' })
}

describe("'A receber' — competência vs caixa", () => {
  it('should_keep_a_pending_receivable_out_of_cash_income', async () => {
    await criarVenda(ambiente, {
      soldAt: '2026-05-10',
      paymentMethod: 'areceber',
      items: [item(1, 30)]
    })

    const painel = await painelDeMaio()

    expect(painel.cashSummary.totalIncome).toBe(0)
  })

  it('should_count_a_pending_receivable_in_revenue_and_profit', async () => {
    await criarVenda(ambiente, {
      soldAt: '2026-05-10',
      paymentMethod: 'areceber',
      items: [item(1, 30)]
    })

    const { overview } = await painelDeMaio()

    expect(overview.totalRevenue).toBe(30)
    expect(overview.totalProfit).toBe(25)
    expect(overview.totalSales).toBe(1)
  })

  it('should_sum_pending_receivables_of_the_period', async () => {
    await criarVenda(ambiente, {
      soldAt: '2026-05-10',
      paymentMethod: 'areceber',
      items: [item(1, 30)]
    })
    await criarVenda(ambiente, {
      soldAt: '2026-05-11',
      paymentMethod: 'areceber',
      items: [item(2, 30)]
    })
    await criarVenda(ambiente, {
      soldAt: '2026-05-12',
      paymentMethod: 'dinheiro',
      items: [item(1, 30)]
    })

    const { overview } = await painelDeMaio()

    expect(overview.totalReceivable).toBe(90)
  })

  it('should_leave_a_receivable_out_of_the_total_once_it_is_marked_as_received', async () => {
    const recebida = await criarVenda(ambiente, {
      soldAt: '2026-05-10',
      paymentMethod: 'areceber',
      items: [item(1, 30)]
    })
    await criarVenda(ambiente, {
      soldAt: '2026-05-11',
      paymentMethod: 'areceber',
      items: [item(1, 30)]
    })
    await ambiente.chamar('sales:markAsReceived', {
      id: recebida,
      paymentMethod: 'pix',
      feePercentage: 0,
      feeAmount: 0,
      netAmount: 30,
      receivedAt: '2026-05-20'
    })

    const { overview } = await painelDeMaio()

    expect(overview.totalReceivable).toBe(30)
  })
})

describe("'A receber' — markAsReceived e unmarkAsReceived", () => {
  function registro(id: number): {
    payment_method: string
    fee_percentage: number
    fee_amount: number
    net_amount: number
    received_at: string | null
  } {
    return queryOne(
      ambiente.banco,
      'SELECT payment_method, fee_percentage, fee_amount, net_amount, received_at FROM sales WHERE id = ?',
      [id]
    )!
  }

  it('should_store_method_fee_net_and_received_date_when_marking_as_received', async () => {
    const venda = await criarVenda(ambiente, {
      soldAt: '2026-05-10',
      paymentMethod: 'areceber',
      items: [item(1, 100, 20)]
    })

    await ambiente.chamar('sales:markAsReceived', {
      id: venda,
      paymentMethod: 'pix',
      feePercentage: 0.99,
      feeAmount: 0.99,
      netAmount: 99.01,
      receivedAt: '2026-05-20'
    })

    const salvo = registro(venda)
    expect(salvo.payment_method).toBe('pix')
    expect(salvo.fee_amount).toBeCloseTo(0.99, 2)
    expect(salvo.net_amount).toBeCloseTo(99.01, 2)
    expect(salvo.received_at).toBe('2026-05-20')
  })

  it('should_restore_receivable_with_no_fee_and_net_equal_to_total_when_unmarking', async () => {
    const venda = await criarVenda(ambiente, {
      soldAt: '2026-05-10',
      paymentMethod: 'areceber',
      items: [item(1, 100, 20)]
    })
    await ambiente.chamar('sales:markAsReceived', {
      id: venda,
      paymentMethod: 'pix',
      feePercentage: 0.99,
      feeAmount: 0.99,
      netAmount: 99.01,
      receivedAt: '2026-05-20'
    })

    await ambiente.chamar('sales:unmarkAsReceived', venda)

    expect(registro(venda)).toEqual({
      payment_method: 'areceber',
      fee_percentage: 0,
      fee_amount: 0,
      net_amount: 100,
      received_at: null
    })
  })
})

describe("'A receber' — fluxo de caixa agrupa pela data de recebimento", () => {
  it('should_place_a_sale_from_march_received_in_may_in_may', async () => {
    const venda = await criarVenda(ambiente, {
      soldAt: '2026-03-15',
      paymentMethod: 'areceber',
      items: [item(1, 50)]
    })
    await ambiente.chamar('sales:markAsReceived', {
      id: venda,
      paymentMethod: 'pix',
      feePercentage: 0,
      feeAmount: 0,
      netAmount: 50,
      receivedAt: '2026-05-10'
    })

    const { cashFlow } = await painelCompleto()

    expect(cashFlow).toEqual([{ month: '2026-05', income: 50, expenses: 0 }])
  })

  it('should_keep_a_cash_sale_in_the_month_it_was_sold', async () => {
    await criarVenda(ambiente, {
      soldAt: '2026-04-20',
      paymentMethod: 'dinheiro',
      items: [item(1, 40)]
    })

    const { cashFlow } = await painelCompleto()

    expect(cashFlow).toEqual([{ month: '2026-04', income: 40, expenses: 0 }])
  })

  it('should_leave_a_pending_receivable_out_of_every_month', async () => {
    await criarVenda(ambiente, {
      soldAt: '2026-05-01',
      paymentMethod: 'areceber',
      items: [item(1, 30)]
    })

    const { cashFlow } = await painelCompleto()

    expect(cashFlow).toEqual([])
  })
})
