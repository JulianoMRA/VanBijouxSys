import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Cash from '../../renderer/src/pages/Cash'
import type { CashExpense } from '../../shared/ipc/caixa'
import type { Sale } from '../../shared/ipc/vendas'
import { instalarApiFalsa, type ApiFalsa } from './ajuda/api-falsa'

let api: ApiFalsa

/** Venda de R$ 2.000,00 paga no pix em 10 de agosto. */
const vendaDeAgosto = (): Sale => ({
  id: 1,
  channel: 'WhatsApp',
  fairId: null,
  fairName: null,
  customerName: null,
  totalAmount: 2000,
  totalCost: 400,
  paymentMethod: 'pix',
  feePercentage: 0,
  feeAmount: 0,
  netAmount: 2000,
  soldAt: '2026-08-10',
  receivedAt: null,
  items: [
    {
      id: 1,
      variationId: 10,
      variationIdentifier: 'Rosa',
      productName: 'Colar Aurora',
      quantity: 1,
      unitPrice: 2000,
      unitCost: 400
    }
  ],
  payments: [],
  amountDue: 0
})

const despesaDeAgosto = (): CashExpense => ({
  id: 1,
  categoryId: 1,
  categoryName: 'Material',
  description: 'Fio',
  amount: 500,
  expenseDate: '2026-08-20',
  notes: null,
  createdAt: '2026-08-20 12:00:00'
})

/** O card do caixa cujo rótulo é o texto dado: rótulo, valor e legenda. */
function card(rotulo: string): HTMLElement {
  return screen.getByText(rotulo).parentElement as HTMLElement
}

beforeEach(() => {
  // Só Date é falsificado: os temporizadores reais continuam servindo ao findBy.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 25, 12))
  api = instalarApiFalsa()
  api.cashSettings.get.mockResolvedValue({
    id: 1,
    openingBalance: 1000,
    updatedAt: '2026-01-01 00:00:00'
  })
  api.sales.getAll.mockResolvedValue([vendaDeAgosto()])
  api.cashExpenses.getAll.mockResolvedValue([despesaDeAgosto()])
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Caixa: saldo em qualquer período (RN-18)', () => {
  it('should_show_the_real_current_balance_in_the_month_view', async () => {
    // Abertura de R$ 1.000, +R$ 2.000 e −R$ 500 em agosto: em setembro, o "Mês"
    // mostrava R$ 1.000 de saldo atual, como se agosto não tivesse existido.
    render(<Cash />)

    expect(await screen.findByText('Saldo inicial')).toBeInTheDocument()
    expect(card('Saldo inicial')).toHaveTextContent('R$ 2.500,00')
    expect(card('Saldo inicial')).toHaveTextContent('antes de 01/09/2026')
    expect(card('Saldo atual')).toHaveTextContent('R$ 2.500,00')
  })

  it('should_start_all_time_from_the_opening_balance', async () => {
    const usuaria = userEvent.setup()
    render(<Cash />)
    await screen.findByText('Saldo inicial')

    await usuaria.click(screen.getByRole('button', { name: 'Tudo' }))

    expect(card('Abertura')).toHaveTextContent('R$ 1.000,00')
    expect(card('Saldo atual')).toHaveTextContent('R$ 2.500,00')
  })

  it('should_name_the_day_of_a_custom_period_that_ended_before_today', async () => {
    const usuaria = userEvent.setup()
    const { container } = render(<Cash />)
    await screen.findByText('Saldo inicial')

    await usuaria.click(screen.getByRole('button', { name: 'Personalizado' }))
    const [inicio, fim] = container.querySelectorAll('input[type="date"]')
    fireEvent.change(inicio, { target: { value: '2026-08-01' } })
    fireEvent.change(fim, { target: { value: '2026-08-31' } })

    expect(card('Saldo inicial')).toHaveTextContent('R$ 1.000,00')
    expect(card('Saldo em 31/08/2026')).toHaveTextContent('R$ 2.500,00')
  })
})

describe('Caixa: falhas aparecem na tela', () => {
  it('should_say_when_the_cash_could_not_load_instead_of_loading_forever', async () => {
    // Sem tratamento, uma falha em qualquer das cinco leituras deixava o
    // "Carregando…" na tela para sempre, sem dizer nada.
    api.sales.getAll.mockRejectedValue(new Error('falhou'))

    render(<Cash />)

    expect(await screen.findByText('Não foi possível carregar o caixa.')).toBeInTheDocument()
    expect(screen.queryByText('Carregando…')).not.toBeInTheDocument()
  })

  it('should_warn_about_an_opening_balance_that_is_not_a_number', async () => {
    const usuaria = userEvent.setup()
    render(<Cash />)
    await screen.findByText('Saldo inicial')

    await usuaria.click(screen.getByRole('button', { name: 'Saldo de abertura' }))
    await usuaria.clear(screen.getByLabelText('Valor (R$)'))
    await usuaria.type(screen.getByLabelText('Valor (R$)'), 'mil')
    await usuaria.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(screen.getByText('Informe um valor igual ou maior que zero.')).toBeInTheDocument()
    expect(api.cashSettings.setOpeningBalance).not.toHaveBeenCalled()
  })

  it('should_explain_and_keep_the_value_when_saving_the_opening_balance_fails', async () => {
    api.cashSettings.setOpeningBalance.mockRejectedValue(
      new Error('Não foi possível concluir a operação. Tente novamente.')
    )
    const usuaria = userEvent.setup()
    render(<Cash />)
    await screen.findByText('Saldo inicial')

    await usuaria.click(screen.getByRole('button', { name: 'Saldo de abertura' }))
    await usuaria.clear(screen.getByLabelText('Valor (R$)'))
    await usuaria.type(screen.getByLabelText('Valor (R$)'), '1500')
    await usuaria.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(
      await screen.findByText('Não foi possível concluir a operação. Tente novamente.')
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Valor (R$)')).toHaveValue('1500')
  })
})
