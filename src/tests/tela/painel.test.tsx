import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

describe('Painel: caixa do período (RN-18)', () => {
  it('should_start_the_period_cash_from_the_balance_before_it', async () => {
    // Abertura de R$ 1.000 e R$ 1.400 líquidos antes do período: o card mostrava a
    // abertura e um "saldo atual" que ignorava tudo o que veio antes.
    api.dashboard.getStats.mockResolvedValue(
      painelFalso({
        overview: duasVendas,
        cashSummary: {
          openingBalance: 1000,
          startBalance: 2400,
          totalIncome: 30,
          totalExpenses: 0,
          currentBalance: 2430
        }
      })
    )

    render(<Dashboard />)

    const inicial = await screen.findByText('Saldo inicial')
    expect(inicial.parentElement).toHaveTextContent('R$ 2.400,00')
    expect(screen.getByText('Saldo atual').parentElement).toHaveTextContent('R$ 2.430,00')
  })
})

describe('Painel: período personalizado', () => {
  /** O faturamento diz de qual período vieram os números: 777 no personalizado, 111 nos outros. */
  function responderPorPeriodo(): void {
    api.dashboard.getStats.mockImplementation(async (params: { period: string }) =>
      painelFalso({
        overview: { ...duasVendas, totalRevenue: params.period === 'custom' ? 777 : 111 }
      })
    )
  }

  function preencherDatas(container: HTMLElement): void {
    const [inicio, fim] = container.querySelectorAll('input[type="date"]')
    fireEvent.change(inicio, { target: { value: '2026-08-01' } })
    fireEvent.change(fim, { target: { value: '2026-08-31' } })
  }

  it('should_reload_the_custom_period_when_coming_back_to_it', async () => {
    // As datas continuavam preenchidas, mas nada recarregava: o título dizia
    // "Período personalizado" e os números eram os do mês.
    responderPorPeriodo()
    const usuaria = userEvent.setup()
    const { container } = render(<Dashboard />)
    await screen.findByText(/R\$\s111,00/)

    await usuaria.click(screen.getByRole('button', { name: 'Personalizado' }))
    preencherDatas(container)
    await screen.findByText(/R\$\s777,00/)
    await usuaria.click(screen.getByRole('button', { name: 'Mês' }))
    await screen.findByText(/R\$\s111,00/)
    await usuaria.click(screen.getByRole('button', { name: 'Personalizado' }))

    expect(await screen.findByText(/R\$\s777,00/)).toBeInTheDocument()
  })

  it('should_not_show_another_period_while_the_custom_dates_are_incomplete', async () => {
    responderPorPeriodo()
    const usuaria = userEvent.setup()
    render(<Dashboard />)
    await screen.findByText(/R\$\s111,00/)

    await usuaria.click(screen.getByRole('button', { name: 'Personalizado' }))

    expect(
      await screen.findByText('Escolha a data inicial e a final do período.')
    ).toBeInTheDocument()
    expect(screen.queryByText(/R\$\s111,00/)).not.toBeInTheDocument()
  })
})

describe('Painel: a receber do período', () => {
  it('should_say_the_note_covers_only_the_sales_of_the_period', async () => {
    // A lista de Vendas mostra tudo o que falta receber; o Painel conta só as vendas
    // feitas no período, e o texto não dizia isso.
    api.dashboard.getStats.mockResolvedValue(
      painelFalso({ overview: { ...duasVendas, totalReceivable: 36 } })
    )

    render(<Dashboard />)

    const aviso = await screen.findByText(/a receber das vendas do período ainda não entraram/)
    expect(aviso).toHaveTextContent('R$ 36,00')
  })

  it('should_keep_the_plain_note_in_all_time', async () => {
    api.dashboard.getStats.mockResolvedValue(
      painelFalso({ overview: { ...duasVendas, totalReceivable: 36 } })
    )
    const usuaria = userEvent.setup()
    render(<Dashboard />)
    await screen.findByText(/das vendas do período/)

    await usuaria.click(screen.getByRole('button', { name: 'Tudo' }))

    expect(await screen.findByText(/a receber ainda não entraram no caixa/)).toBeInTheDocument()
    expect(screen.queryByText(/das vendas do período/)).not.toBeInTheDocument()
  })
})
