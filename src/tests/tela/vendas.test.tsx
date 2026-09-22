import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Sales from '../../renderer/src/pages/Sales'
import type { Sale } from '../../shared/ipc/vendas'
import { instalarApiFalsa, type ApiFalsa } from './ajuda/api-falsa'

let api: ApiFalsa

/** Venda a receber de R$ 86,00, sem cliente, com um item. */
const venda = (dados: Partial<Sale> = {}): Sale => ({
  id: 1,
  channel: 'WhatsApp',
  fairId: null,
  fairName: null,
  customerName: null,
  totalAmount: 86,
  totalCost: 20,
  paymentMethod: 'areceber',
  feePercentage: 0,
  feeAmount: 0,
  netAmount: 86,
  soldAt: '2026-09-20',
  receivedAt: null,
  items: [
    {
      id: 1,
      variationId: 10,
      variationIdentifier: 'Rosa',
      productName: 'Colar Aurora',
      quantity: 1,
      unitPrice: 86,
      unitCost: 20
    }
  ],
  ...dados
})

beforeEach(() => {
  api = instalarApiFalsa()
})

function cardAReceber(): HTMLElement {
  return screen.getByText('A receber').parentElement as HTMLElement
}

describe('Vendas: cliente', () => {
  it('should_show_the_customer_in_the_sale_row', async () => {
    api.sales.getAll.mockResolvedValue([venda({ customerName: 'Maria' })])

    render(<Sales />)

    expect(await screen.findByText('Maria')).toBeInTheDocument()
  })

  it('should_find_sales_by_customer_ignoring_case_and_accents', async () => {
    api.sales.getAll.mockResolvedValue([
      venda({ id: 1, customerName: 'Márcia' }),
      venda({ id: 2, customerName: 'Ana' })
    ])
    const usuaria = userEvent.setup()
    render(<Sales />)
    await screen.findByText('Márcia')

    await usuaria.type(screen.getByPlaceholderText(/Buscar/), 'marcia')

    expect(screen.getByText('Márcia')).toBeInTheDocument()
    expect(screen.queryByText('Ana')).not.toBeInTheDocument()
  })

  it('should_sum_in_the_receivable_card_only_what_the_searched_customer_owes', async () => {
    api.sales.getAll.mockResolvedValue([
      venda({ id: 1, customerName: 'Maria' }),
      venda({ id: 2, customerName: 'Ana', totalAmount: 30, netAmount: 30 }),
      venda({ id: 3, customerName: 'Maria', paymentMethod: 'pix', totalAmount: 50, netAmount: 50 })
    ])
    const usuaria = userEvent.setup()
    render(<Sales />)
    await screen.findByText('Ana')

    await usuaria.type(screen.getByPlaceholderText(/Buscar/), 'maria')

    expect(within(cardAReceber()).getByText('R$ 86,00')).toBeInTheDocument()
    // O botão do filtro continua somando todas as clientes.
    expect(screen.getByRole('button', { name: /2 a receber/ })).toHaveTextContent('R$ 116,00')
  })
})
