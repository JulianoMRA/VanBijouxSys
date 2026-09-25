import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Fairs from '../../renderer/src/pages/Fairs'
import type { Fair } from '../../shared/ipc/feiras'
import type { Sale } from '../../shared/ipc/vendas'
import { instalarApiFalsa, type ApiFalsa } from './ajuda/api-falsa'

let api: ApiFalsa

const feiraRealizada: Fair = {
  id: 1,
  name: 'Feira do Bosque',
  location: 'Praça',
  organizer: null,
  date: '2026-08-01',
  endDate: null,
  enrollmentCost: 20,
  additionalCosts: [],
  createdAt: '2026-07-01 10:00:00'
}

/** R$ 100,00 no crédito com 3,5% de taxa: entraram R$ 96,50; a peça custou R$ 30,00. */
const vendaNoCredito: Sale = {
  id: 1,
  channel: 'Feira',
  fairId: 1,
  fairName: 'Feira do Bosque',
  customerName: null,
  totalAmount: 100,
  totalCost: 30,
  paymentMethod: 'credito',
  feePercentage: 3.5,
  feeAmount: 3.5,
  netAmount: 96.5,
  soldAt: '2026-08-01',
  receivedAt: null,
  items: [
    {
      id: 1,
      variationId: 10,
      variationIdentifier: 'Rosa',
      productName: 'Colar Aurora',
      quantity: 1,
      unitPrice: 100,
      unitCost: 30
    }
  ],
  payments: [],
  amountDue: 0
}

beforeEach(() => {
  api = instalarApiFalsa()
  api.fairs.getAll.mockResolvedValue([feiraRealizada])
  api.sales.getAll.mockResolvedValue([vendaNoCredito])
})

describe('Feiras: lucro sem a taxa do cartão, como no Painel', () => {
  it('should_discount_card_fees_from_the_fair_result', async () => {
    // (96,50 − 30,00) − 20,00 de inscrição. A tela usava o total bruto e mostrava
    // R$ 50,00, enquanto o Painel mostrava R$ 46,50 para a mesma feira.
    render(<Fairs />)

    const liquido = await screen.findByText('Líquido')
    expect(liquido.parentElement).toHaveTextContent('R$ 46,50')
  })

  it('should_show_the_profit_of_each_sale_without_the_fee', async () => {
    const usuaria = userEvent.setup()
    render(<Fairs />)

    await usuaria.click(await screen.findByRole('button', { name: /1 venda/ }))

    const linha = screen.getByText(/Colar Aurora — Rosa/).closest('tr') as HTMLElement
    expect(linha).toHaveTextContent('R$ 66,50')
    expect(screen.getByText('Lucro bruto').parentElement).toHaveTextContent('R$ 66,50')
  })
})
