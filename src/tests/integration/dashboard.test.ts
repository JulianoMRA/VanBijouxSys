import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prepararAmbienteIpc, type AmbienteIpc } from '../helpers/ambiente-ipc'
import { queryOne } from '../helpers/testDb'
import { criarProduto, criarVariacao, criarVenda } from '../helpers/estoque'
import type { DashboardStats } from '../../shared/ipc/painel'

vi.mock('electron', async () => (await import('../helpers/ambiente-ipc')).electronFalso)
vi.mock('../../main/database', async () => (await import('../helpers/ambiente-ipc')).bancoFalso)

let ambiente: AmbienteIpc
let colar: number
let pulseira: number
let brinco: number

async function variacaoEmCategoria(
  nome: string,
  categoryId: number,
  custo: number,
  preco: number
): Promise<number> {
  const { id } = await ambiente.chamar<{ id: number }>('products:create', {
    name: nome,
    categoryId
  })
  return criarVariacao(ambiente, {
    productId: Number(id),
    receita: [],
    identifier: nome,
    costPrice: custo,
    salePrice: preco,
    stockQuantity: 10,
    motivoDoEstoqueInicial: 'contagem'
  })
}

beforeEach(async () => {
  ambiente = await prepararAmbienteIpc()
  colar = await variacaoEmCategoria('Colar Rosa', 1, 5, 30)
  pulseira = await variacaoEmCategoria('Pulseira Azul', 2, 4, 25)
  brinco = await variacaoEmCategoria('Brinco Pérola', 3, 3, 20)
})

afterEach(() => {
  vi.useRealTimers()
})

function painel(customFrom: string, customTo: string): Promise<DashboardStats> {
  return ambiente.chamar<DashboardStats>('dashboard:getStats', {
    period: 'custom',
    customFrom,
    customTo
  })
}

describe('dashboard: bordas do período', () => {
  it('should_include_a_sale_on_the_very_first_day_of_the_period', async () => {
    await criarVenda(ambiente, {
      soldAt: '2026-05-01',
      items: [{ variationId: colar, quantity: 1, unitPrice: 30, unitCost: 5 }]
    })
    await criarVenda(ambiente, {
      soldAt: '2026-04-30',
      items: [{ variationId: colar, quantity: 1, unitPrice: 30, unitCost: 5 }]
    })

    const stats = await painel('2026-05-01', '2026-05-31')

    expect(stats.overview.totalSales).toBe(1)
    expect(stats.overview.totalRevenue).toBe(30)
  })

  it('should_discount_the_payment_fee_from_revenue_and_profit', async () => {
    await criarVenda(ambiente, {
      soldAt: '2026-05-10',
      paymentMethod: 'credito',
      feePercentage: 10,
      feeAmount: 3,
      items: [{ variationId: colar, quantity: 1, unitPrice: 30, unitCost: 5 }]
    })

    const stats = await painel('2026-05-01', '2026-05-31')

    // Bruto 30, taxa 3, custo 5: o painel mostra o bruto na receita e o lucro
    // já sem a taxa, que é o dinheiro que entrou de verdade.
    expect(stats.overview.totalRevenue).toBe(30)
    expect(stats.overview.totalNetRevenue).toBe(27)
    expect(stats.overview.totalProfit).toBe(22)
  })

  it('should_include_a_sale_on_the_very_last_day_of_the_period', async () => {
    await criarVenda(ambiente, {
      soldAt: '2026-05-31',
      items: [{ variationId: colar, quantity: 1, unitPrice: 30, unitCost: 5 }]
    })

    const stats = await painel('2026-05-01', '2026-05-31')

    expect(stats.overview.totalSales).toBe(1)
  })
})

describe('dashboard: data com hora em sold_at', () => {
  it('should_include_a_sale_with_time_on_the_last_day_of_the_period', async () => {
    await criarVenda(ambiente, {
      soldAt: '2026-05-14 23:59:59',
      items: [{ variationId: colar, quantity: 1, unitPrice: 30, unitCost: 5 }]
    })
    await criarVenda(ambiente, {
      soldAt: '2026-05-14',
      items: [{ variationId: pulseira, quantity: 1, unitPrice: 25, unitCost: 4 }]
    })

    const { overview } = await painel('2026-05-01', '2026-05-14')

    expect(overview.totalSales).toBe(2)
    expect(overview.totalRevenue).toBe(55)
  })

  it('should_exclude_a_sale_from_the_day_after_the_period', async () => {
    await criarVenda(ambiente, {
      soldAt: '2026-05-14 10:00:00',
      items: [{ variationId: colar, quantity: 1, unitPrice: 30, unitCost: 5 }]
    })
    await criarVenda(ambiente, {
      soldAt: '2026-05-15 00:00:01',
      items: [{ variationId: pulseira, quantity: 1, unitPrice: 25, unitCost: 4 }]
    })

    const { overview } = await painel('2026-05-01', '2026-05-14')

    expect(overview.totalSales).toBe(1)
  })

  it('should_count_a_sale_with_time_in_cash_income_and_cash_flow', async () => {
    await criarVenda(ambiente, {
      soldAt: '2026-05-14 18:30:00',
      items: [{ variationId: colar, quantity: 2, unitPrice: 30, unitCost: 5 }]
    })

    const { cashSummary, cashFlow } = await painel('2026-05-01', '2026-05-14')

    expect(cashSummary.totalIncome).toBe(60)
    expect(cashFlow).toEqual([{ month: '2026-05', income: 60, expenses: 0 }])
  })
})

describe('dashboard: faturamento por categoria bate com o total', () => {
  it('should_sum_categories_to_the_total_revenue', async () => {
    await criarVenda(ambiente, {
      soldAt: '2026-05-10',
      items: [{ variationId: colar, quantity: 1, unitPrice: 30, unitCost: 5 }]
    })
    await criarVenda(ambiente, {
      soldAt: '2026-05-11',
      items: [{ variationId: pulseira, quantity: 2, unitPrice: 25, unitCost: 4 }]
    })
    await criarVenda(ambiente, {
      soldAt: '2026-05-12',
      items: [
        { variationId: colar, quantity: 1, unitPrice: 30, unitCost: 5 },
        { variationId: brinco, quantity: 3, unitPrice: 20, unitCost: 3 }
      ]
    })

    const { overview, salesByCategory } = await painel('2026-05-01', '2026-05-31')

    const soma = salesByCategory.reduce((s, c) => s + c.revenue, 0)
    expect(soma).toBe(overview.totalRevenue)
    expect(soma).toBe(170)
    expect(salesByCategory).toHaveLength(3)
  })

  it('should_group_an_orphan_item_as_no_category_without_losing_revenue', async () => {
    // Estado legado que os handlers não produzem: item de venda apontando para uma
    // variação que não existe mais. Montado direto no banco, com a FK desligada.
    const banco = ambiente.banco
    banco.run('PRAGMA foreign_keys = OFF')
    banco.run(
      `INSERT INTO sales (channel, total_amount, total_cost, net_amount, sold_at)
       VALUES ('WhatsApp', 50, 10, 50, '2026-05-15')`
    )
    const venda = queryOne<{ id: number }>(banco, 'SELECT last_insert_rowid() AS id')!.id
    banco.run(
      `INSERT INTO sale_items (sale_id, variation_id, quantity, unit_price, unit_cost)
       VALUES (?, 9999, 1, 50, 10)`,
      [venda]
    )
    banco.run('PRAGMA foreign_keys = ON')

    const { overview, salesByCategory } = await painel('2026-05-01', '2026-05-31')

    expect(salesByCategory.reduce((s, c) => s + c.revenue, 0)).toBe(overview.totalRevenue)
    expect(salesByCategory.find((c) => c.category === 'Sem categoria')?.revenue).toBe(50)
  })
})

describe('dashboard: período anterior', () => {
  it('should_compare_the_current_year_with_the_previous_one', async () => {
    // Só Date é falsificado; as vendas ficam longe das bordas do ano, então o
    // resultado não depende do fuso horário da máquina.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
    await criarVenda(ambiente, {
      soldAt: '2026-03-10 23:30:00',
      items: [{ variationId: pulseira, quantity: 1, unitPrice: 25, unitCost: 4 }]
    })
    await criarVenda(ambiente, {
      soldAt: '2025-07-20 23:30:00',
      items: [{ variationId: colar, quantity: 1, unitPrice: 30, unitCost: 5 }]
    })

    const { overview, previousOverview } = await ambiente.chamar<DashboardStats>(
      'dashboard:getStats',
      { period: 'year' }
    )

    expect(overview.totalRevenue).toBe(25)
    expect(previousOverview?.totalRevenue).toBe(30)
  })

  it('should_have_no_previous_period_for_a_custom_range', async () => {
    const { previousOverview } = await painel('2026-05-01', '2026-05-31')

    expect(previousOverview).toBeNull()
  })
})

describe('dashboard: venda antiga sem data', () => {
  it('should_group_a_sale_saved_without_date_apart_in_the_all_time_charts', async () => {
    await criarVenda(ambiente, {
      soldAt: '2026-05-10',
      items: [{ variationId: colar, quantity: 1, unitPrice: 30, unitCost: 5 }]
    })
    // Até a 1.13, apagar a data da venda e salvar gravava sold_at vazio. O canal
    // hoje recusa isso, então a linha antiga entra direto no banco.
    ambiente.banco.run(
      `INSERT INTO sales (channel, total_amount, total_cost, payment_method, net_amount, sold_at)
       VALUES ('Outro', 20, 3, 'dinheiro', 20, '')`
    )

    const stats = await ambiente.chamar<DashboardStats>('dashboard:getStats', { period: 'all' })

    expect(stats.overview.totalRevenue).toBe(50)
    expect(stats.revenueByMonth).toContainEqual({ month: null, revenue: 20, profit: 17 })
    expect(stats.cashFlow).toContainEqual({ month: null, income: 20, expenses: 0 })
  })
})

describe('dashboard: saldo do caixa no período (RN-18)', () => {
  async function despesa(valor: number, expenseDate: string): Promise<void> {
    const { id: categoryId } = await ambiente.chamar<{ id: number }>('expense-categories:create', {
      name: `Categoria ${expenseDate}`
    })
    await ambiente.chamar('cash-expenses:create', {
      categoryId,
      description: 'Despesa',
      amount: valor,
      expenseDate
    })
  }

  beforeEach(async () => {
    // Abertura de R$ 1.000 e um agosto movimentado antes do período de setembro.
    await ambiente.chamar('cash-settings:setOpeningBalance', 1000)
    await criarVenda(ambiente, {
      soldAt: '2026-08-10',
      items: [{ variationId: colar, quantity: 1, unitPrice: 2000, unitCost: 5 }]
    })
    await despesa(500, '2026-08-20')
    await ambiente.chamar('fairs:create', {
      name: 'Feira de agosto',
      location: 'Praça',
      date: '2026-08-05',
      enrollmentCost: 80,
      additionalCosts: [{ description: 'Mesa', amount: 20 }]
    })
    await criarVenda(ambiente, {
      soldAt: '2026-09-05',
      items: [{ variationId: colar, quantity: 1, unitPrice: 30, unitCost: 5 }]
    })
  })

  it('should_start_the_period_from_the_opening_plus_everything_before_it', async () => {
    const { cashSummary } = await painel('2026-09-01', '2026-09-30')

    expect(cashSummary.openingBalance).toBe(1000)
    expect(cashSummary.startBalance).toBe(1000 + 2000 - 500 - 100)
    expect(cashSummary.totalIncome).toBe(30)
    expect(cashSummary.currentBalance).toBe(2400 + 30)
  })

  it('should_end_with_the_same_balance_as_all_time_when_the_period_reaches_the_last_movement', async () => {
    const periodo = await painel('2026-09-01', '2026-09-30')
    const tudo = await ambiente.chamar<DashboardStats>('dashboard:getStats', { period: 'all' })

    expect(tudo.cashSummary.startBalance).toBe(1000)
    expect(periodo.cashSummary.currentBalance).toBe(tudo.cashSummary.currentBalance)
  })

  it('should_count_a_legacy_sale_saved_without_date_in_the_starting_balance', async () => {
    ambiente.banco.run(
      `INSERT INTO sales (channel, total_amount, total_cost, payment_method, net_amount, sold_at)
       VALUES ('Outro', 20, 3, 'dinheiro', 20, '')`
    )

    const { cashSummary } = await painel('2026-09-01', '2026-09-30')

    expect(cashSummary.startBalance).toBe(2400 + 20)
  })
})

describe('dashboard: validação do período', () => {
  it('should_refuse_an_end_date_without_a_start_date', async () => {
    await expect(
      ambiente.chamar('dashboard:getStats', { period: 'custom', customTo: '2026-05-31' })
    ).rejects.toThrow('Informe a data inicial do período personalizado.')
  })
})

describe('dashboard: produto sem venda', () => {
  it('should_return_zeroes_instead_of_null_when_there_are_no_sales', async () => {
    await criarProduto(ambiente, 'Sem vendas')

    const { overview, salesByCategory, cashFlow } = await painel('2026-05-01', '2026-05-31')

    expect(overview.totalRevenue).toBe(0)
    expect(overview.totalReceivable).toBe(0)
    expect(salesByCategory).toEqual([])
    expect(cashFlow).toEqual([])
  })
})
