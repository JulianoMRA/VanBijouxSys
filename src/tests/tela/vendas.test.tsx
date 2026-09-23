import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Sales from '../../renderer/src/pages/Sales'
import type { Sale, SalePayment } from '../../shared/ipc/vendas'
import { instalarApiFalsa, type ApiFalsa } from './ajuda/api-falsa'

let api: ApiFalsa

/** Venda a receber de R$ 86,00, sem cliente nem pagamento, com um item. */
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
  payments: [],
  amountDue: 86,
  ...dados
})

const cinquentaNoPix = (): SalePayment => ({
  id: 5,
  amount: 50,
  paymentMethod: 'pix',
  feePercentage: 0,
  feeAmount: 0,
  netAmount: 50,
  receivedAt: '2026-09-22'
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
      venda({ id: 2, customerName: 'Ana', totalAmount: 30, netAmount: 30, amountDue: 30 }),
      venda({
        id: 3,
        customerName: 'Maria',
        paymentMethod: 'pix',
        totalAmount: 50,
        netAmount: 50,
        amountDue: 0
      })
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

describe('Vendas: pagamento parcial', () => {
  it('should_open_receber_for_a_pending_sale', async () => {
    api.sales.getAll.mockResolvedValue([venda({ customerName: 'Maria' })])
    const usuaria = userEvent.setup()
    render(<Sales />)

    await usuaria.click(await screen.findByRole('button', { name: 'Receber' }))

    expect(screen.getByRole('heading', { name: 'Receber pagamento' })).toBeInTheDocument()
  })

  it('should_show_paid_and_due_in_the_row_of_a_partially_paid_sale', async () => {
    api.sales.getAll.mockResolvedValue([
      venda({ customerName: 'Maria', payments: [cinquentaNoPix()], amountDue: 36 })
    ])

    render(<Sales />)

    expect(await screen.findByText(/pago R\$ 50,00 · falta R\$ 36,00/)).toBeInTheDocument()
  })

  it('should_sum_only_what_is_still_due_in_the_receivable_card', async () => {
    api.sales.getAll.mockResolvedValue([
      venda({ id: 1, customerName: 'Maria', payments: [cinquentaNoPix()], amountDue: 36 }),
      venda({ id: 2, customerName: 'Ana', totalAmount: 30, netAmount: 30, amountDue: 30 })
    ])

    render(<Sales />)
    await screen.findByText('Ana')

    expect(within(cardAReceber()).getByText('R$ 66,00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /2 a receber/ })).toHaveTextContent('R$ 66,00')
  })

  it('should_not_offer_receber_for_a_sale_settled_in_payments', async () => {
    api.sales.getAll.mockResolvedValue([
      venda({
        customerName: 'Maria',
        payments: [cinquentaNoPix(), { ...cinquentaNoPix(), id: 6, amount: 36 }],
        amountDue: 0
      })
    ])

    render(<Sales />)
    await screen.findByText('Maria')

    expect(screen.queryByRole('button', { name: 'Receber' })).not.toBeInTheDocument()
    expect(screen.getByText(/Recebida em 2 pagamentos/)).toBeInTheDocument()
  })

  it('should_delete_a_payment_after_confirming', async () => {
    api.sales.getAll.mockResolvedValue([
      venda({ customerName: 'Maria', payments: [cinquentaNoPix()], amountDue: 36 })
    ])
    const usuaria = userEvent.setup()
    render(<Sales />)

    await usuaria.click(await screen.findByText('Maria'))
    // O nome acessível não passa pela normalização de espaços, e o R$ vem com espaço
    // não separável do formatador de moeda.
    await usuaria.click(screen.getByRole('button', { name: /Excluir o pagamento de R\$\s50,00/ }))
    await usuaria.click(screen.getByRole('button', { name: 'Excluir pagamento' }))

    await waitFor(() => expect(api.sales.deletePayment).toHaveBeenCalledWith(5))
    expect(api.sales.getAll).toHaveBeenCalledTimes(2)
  })
})
