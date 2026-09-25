import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Dashboard from '../../renderer/src/pages/Dashboard'
import Sales from '../../renderer/src/pages/Sales'
import VariationDetailsModal from '../../renderer/src/components/products/VariationDetailsModal'
import VariationForm from '../../renderer/src/components/products/VariationForm'
import type { Product } from '../../shared/ipc/produtos'
import type { Sale } from '../../shared/ipc/vendas'
import {
  instalarApiFalsa,
  insumoFalso,
  painelFalso,
  variacaoFalsa,
  type ApiFalsa
} from './ajuda/api-falsa'

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
  localStorage.clear()
})

/**
 * O Intl separa "R$" do número com espaço não separável, e a busca por texto troca
 * esse espaço por um comum antes de comparar.
 */
const reais = (texto: string): string => `R$ ${texto}`

const fioNaReceita = {
  id: 1,
  variationId: 10,
  insumoId: 1,
  insumoName: 'Fio de nylon',
  unit: 'cm' as const,
  costPerUnit: 0.012,
  quantity: 0.25,
  archivedAt: null
}

describe('VariationDetailsModal: números com vírgula', () => {
  it('should_show_quantity_unit_cost_and_margin_the_brazilian_way', () => {
    const produto = { id: 1, name: 'Colar Aurora' } as Product
    render(
      <VariationDetailsModal
        product={produto}
        variation={variacaoFalsa({ costPrice: 3, salePrice: 24, insumos: [fioNaReceita] })}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('0,25 cm')).toBeInTheDocument()
    // Fio a granel custa menos de um centavo por cm: com duas casas viraria "R$ 0,01".
    expect(screen.getByText(reais('0,0120'))).toBeInTheDocument()
    expect(screen.getByText('87,5% margem')).toBeInTheDocument()
  })
})

describe('VariationForm: números com vírgula', () => {
  it('should_show_the_recipe_costs_in_reais_with_a_decimal_comma', async () => {
    const usuaria = userEvent.setup()
    api.insumos.getAll.mockResolvedValue([insumoFalso({ costPerUnit: 0.02 })])
    render(
      <VariationForm
        productId={1}
        productName="Colar Aurora"
        variation={variacaoFalsa({
          insumos: [{ ...fioNaReceita, costPerUnit: 0.02, quantity: 125 }]
        })}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(
      await screen.findByText(`Calculado pelos insumos: ${reais('2,50')} — clique para usar`)
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: /^Fio de nylon \(R\$\s0,0200\/cm\)$/ })
    ).toBeInTheDocument()
    expect(screen.getAllByText(reais('2,50'))).toHaveLength(2)

    await usuaria.click(screen.getByRole('button', { name: /Calculadora de preço/ }))

    expect(
      screen.getByText(`Usando custo calculado pelos insumos (${reais('2,50')}) como base de`, {
        exact: false
      })
    ).toBeInTheDocument()
  })
})

describe('Painel: porcentagens com vírgula', () => {
  it('should_show_margin_and_change_with_a_decimal_comma', async () => {
    api.dashboard.getStats.mockResolvedValue(
      painelFalso({
        overview: {
          totalRevenue: 80,
          totalNetRevenue: 80,
          totalCost: 70,
          totalProfit: 10,
          totalSales: 2,
          avgTicket: 40,
          totalReceivable: 0
        },
        previousOverview: {
          totalRevenue: 64,
          totalNetRevenue: 64,
          totalCost: 60,
          totalProfit: 4,
          totalSales: 2,
          avgTicket: 32
        }
      })
    )
    render(<Dashboard />)

    expect(await screen.findByText('margem 12,5%')).toBeInTheDocument()
    expect(screen.getByText('Margem de lucro no período: 12,5%')).toBeInTheDocument()
    // Custo de 60 para 70: 16,7% a mais.
    expect(screen.getByText(/16,7%/)).toBeInTheDocument()
    expect(screen.queryAllByText(/\d\.\d+%/)).toEqual([])
  })
})

describe('Vendas: porcentagem com vírgula', () => {
  it('should_show_the_margin_with_a_decimal_comma', async () => {
    const venda: Sale = {
      id: 1,
      channel: 'WhatsApp',
      fairId: null,
      fairName: null,
      customerName: null,
      totalAmount: 80,
      totalCost: 70,
      paymentMethod: 'pix',
      feePercentage: 0,
      feeAmount: 0,
      netAmount: 80,
      soldAt: '2026-09-20',
      receivedAt: null,
      items: [
        {
          id: 1,
          variationId: 10,
          variationIdentifier: 'Rosa',
          productName: 'Colar Aurora',
          quantity: 1,
          unitPrice: 80,
          unitCost: 70
        }
      ],
      payments: [],
      amountDue: 0
    }
    api.sales.getAll.mockResolvedValue([venda])
    render(<Sales />)

    expect(await screen.findByText('margem 12,5%')).toBeInTheDocument()
  })
})
