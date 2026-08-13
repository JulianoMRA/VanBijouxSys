import { describe, it, expect } from 'vitest'
import {
  buildInsights,
  calcDelta,
  formatDay,
  formatMonth
} from '../renderer/src/utils/dashboard-calculations'
import type { DashboardStats } from '../renderer/src/types'

function stats(over: Partial<DashboardStats> = {}): DashboardStats {
  return {
    overview: {
      totalRevenue: 0,
      totalNetRevenue: 0,
      totalCost: 0,
      totalProfit: 0,
      totalSales: 0,
      avgTicket: 0,
      totalReceivable: 0
    },
    previousOverview: null,
    revenueByMonth: [],
    salesByChannel: [],
    salesByCategory: [],
    salesByFair: [],
    topVariations: [],
    outOfStock: [],
    lowStock: [],
    outOfInsumos: [],
    lowInsumos: [],
    cashFlow: [],
    cashSummary: { openingBalance: 0, totalIncome: 0, totalExpenses: 0, currentBalance: 0 },
    ...over
  } as DashboardStats
}

function categoria(nome: string, quantity: number, revenue: number) {
  return { category: nome, revenue, quantity, count: 1 }
}

function itemSemEstoque(id: number) {
  return {
    id,
    productName: 'Colar Lua',
    categoryName: 'Colar',
    identifier: 'Dourado',
    stockQuantity: 0,
    minimumStock: 2
  }
}

describe('formatMonth', () => {
  it('should_render_year_month_as_short_label', () => {
    expect(formatMonth('2026-08')).toBe('Ago/26')
  })

  it('should_handle_january_and_december', () => {
    expect(formatMonth('2026-01')).toBe('Jan/26')
    expect(formatMonth('2026-12')).toBe('Dez/26')
  })
})

describe('formatDay', () => {
  it('should_render_day_and_short_month', () => {
    expect(formatDay('2026-08-05')).toBe('5 Ago')
  })

  it('should_drop_the_leading_zero_of_the_day', () => {
    expect(formatDay('2026-03-01')).toBe('1 Mar')
  })
})

describe('calcDelta', () => {
  it('should_return_null_when_there_is_no_previous_movement', () => {
    expect(calcDelta(500, 0)).toBeNull()
  })

  it('should_compute_growth_as_percentage', () => {
    expect(calcDelta(150, 100)).toBe(50)
  })

  it('should_compute_a_drop_as_negative', () => {
    expect(calcDelta(50, 100)).toBe(-50)
  })

  it('should_return_zero_when_nothing_changed', () => {
    expect(calcDelta(100, 100)).toBe(0)
  })
})

describe('buildInsights', () => {
  it('should_return_nothing_for_an_empty_period', () => {
    expect(buildInsights(stats())).toEqual([])
  })

  it('should_pick_the_most_sold_category_by_units_not_by_revenue', () => {
    // Regressão: a lista vem ordenada por faturamento. Pegar o primeiro daria
    // "Colar", que fatura mais vendendo menos peças.
    const resultado = buildInsights(
      stats({
        salesByCategory: [categoria('Colar', 3, 900), categoria('Brinco', 20, 400)]
      })
    )
    const insight = resultado.find((i) => i.kind === 'categoria')
    expect(insight?.text).toContain('Brinco')
    expect(insight?.text).toContain('20 unidades')
  })

  it('should_use_singular_unit_for_a_single_piece', () => {
    const resultado = buildInsights(stats({ salesByCategory: [categoria('Tiara', 1, 50)] }))
    expect(resultado.find((i) => i.kind === 'categoria')?.text).toContain('1 unidade)')
  })

  it('should_write_plural_of_item_correctly', () => {
    // Regressão: a concatenação antiga produzia "2 itemns esgotados".
    const dois = buildInsights(stats({ outOfStock: [itemSemEstoque(1), itemSemEstoque(2)] }))
    expect(dois.find((i) => i.kind === 'estoque')?.text).toContain('2 itens esgotados')
    expect(dois.find((i) => i.kind === 'estoque')?.text).not.toContain('itemns')
  })

  it('should_write_singular_of_item_for_exactly_one', () => {
    const um = buildInsights(stats({ outOfStock: [itemSemEstoque(1)] }))
    expect(um.find((i) => i.kind === 'estoque')?.text).toContain('1 item esgotado')
  })

  it('should_count_out_of_stock_products_and_supplies_together', () => {
    const resultado = buildInsights(
      stats({
        outOfStock: [itemSemEstoque(1)],
        outOfInsumos: [{ id: 9, name: 'Fio', unit: 'cm', stockQuantity: 0, minimumStock: 100 }]
      })
    )
    expect(resultado.find((i) => i.kind === 'estoque')?.text).toContain('2 itens esgotados')
  })

  it('should_report_the_channel_share_of_revenue', () => {
    const resultado = buildInsights(
      stats({
        salesByChannel: [
          { channel: 'Feira', revenue: 750, profit: 300, count: 5 },
          { channel: 'WhatsApp', revenue: 250, profit: 100, count: 2 }
        ]
      })
    )
    expect(resultado.find((i) => i.kind === 'canal')?.text).toContain('Feira')
    expect(resultado.find((i) => i.kind === 'canal')?.text).toContain('75%')
  })

  it('should_ignore_fairs_that_sold_nothing', () => {
    const resultado = buildInsights(
      stats({
        salesByFair: [
          {
            fairName: 'Feira Vazia',
            date: '2026-08-01',
            endDate: null,
            revenue: 0,
            profit: 0,
            enrollmentCost: 100,
            additionalCosts: 0,
            netProfit: -100,
            dailyBreakdown: []
          }
        ]
      })
    )
    expect(resultado.find((i) => i.kind === 'feira')).toBeUndefined()
  })

  it('should_not_celebrate_a_fair_that_closed_at_a_loss', () => {
    const resultado = buildInsights(
      stats({
        salesByFair: [
          {
            fairName: 'Feira Cara',
            date: '2026-08-01',
            endDate: null,
            revenue: 200,
            profit: 80,
            enrollmentCost: 300,
            additionalCosts: 0,
            netProfit: -220,
            dailyBreakdown: []
          }
        ]
      })
    )
    expect(resultado.find((i) => i.kind === 'feira')).toBeUndefined()
  })

  it('should_pick_the_fair_with_the_best_net_profit', () => {
    const feira = (nome: string, revenue: number, netProfit: number) => ({
      fairName: nome,
      date: '2026-08-01',
      endDate: null,
      revenue,
      profit: netProfit,
      enrollmentCost: 0,
      additionalCosts: 0,
      netProfit,
      dailyBreakdown: []
    })
    const resultado = buildInsights(
      stats({ salesByFair: [feira('Bosque', 900, 100), feira('Centro', 400, 380)] })
    )
    expect(resultado.find((i) => i.kind === 'feira')?.text).toContain('Centro')
  })

  it('should_compute_margin_over_net_revenue', () => {
    const resultado = buildInsights(
      stats({
        overview: {
          totalRevenue: 1000,
          totalNetRevenue: 1000,
          totalCost: 600,
          totalProfit: 400,
          totalSales: 10,
          avgTicket: 100,
          totalReceivable: 0
        }
      })
    )
    expect(resultado.find((i) => i.kind === 'margem')?.text).toContain('40.0%')
  })

  it('should_skip_margin_when_there_is_no_net_revenue', () => {
    const resultado = buildInsights(stats())
    expect(resultado.find((i) => i.kind === 'margem')).toBeUndefined()
  })
})
