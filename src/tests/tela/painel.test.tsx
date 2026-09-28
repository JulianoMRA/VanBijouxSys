import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Dashboard from '../../renderer/src/pages/Dashboard'
import { instalarApiFalsa, painelFalso, type ApiFalsa } from './ajuda/api-falsa'

// O ResponsiveContainer do recharts mede a área com ResizeObserver, que o jsdom não tem.
class ResizeObserverFalso {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverFalso)

let api: ApiFalsa

beforeEach(() => {
  api = instalarApiFalsa()
})

const duasVendas = {
  totalRevenue: 50,
  totalNetRevenue: 50,
  totalCost: 8,
  totalProfit: 42,
  totalSales: 2,
  avgTicket: 25,
  totalReceivable: 0
}

describe('Painel: vendas antigas sem data', () => {
  it('should_open_the_all_time_charts_with_sales_saved_without_date', async () => {
    // Até a 1.13, apagar a data da venda e salvar gravava sold_at vazio; o SQLite
    // agrupa essas vendas sob mês nulo, e a tela quebrava ao formatar o mês.
    api.dashboard.getStats.mockResolvedValue(
      painelFalso({
        overview: duasVendas,
        revenueByMonth: [
          { month: null, revenue: 20, profit: 17 },
          { month: '2026-05', revenue: 30, profit: 25 }
        ],
        cashFlow: [
          { month: null, income: 20, expenses: 0 },
          { month: '2026-05', income: 30, expenses: 0 }
        ]
      })
    )

    render(<Dashboard />)

    expect(await screen.findByText('Faturamento e lucro')).toBeInTheDocument()
  })

  it('should_name_the_best_fair_day_even_when_it_has_no_date', async () => {
    api.dashboard.getStats.mockResolvedValue(
      painelFalso({
        overview: duasVendas,
        salesByFair: [
          {
            fairName: 'Feira do Bosque',
            date: '2026-05-09',
            endDate: '2026-05-10',
            revenue: 50,
            profit: 42,
            enrollmentCost: 0,
            additionalCosts: 0,
            netProfit: 42,
            dailyBreakdown: [
              { day: null, revenue: 30, salesCount: 1 },
              { day: '2026-05-10', revenue: 20, salesCount: 1 }
            ]
          }
        ]
      })
    )

    render(<Dashboard />)

    expect(await screen.findByText(/Melhor dia: Sem data/)).toBeInTheDocument()
  })
})
