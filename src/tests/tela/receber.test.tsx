import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReceberPagamentoModal from '../../renderer/src/components/sales/ReceberPagamentoModal'
import type { Sale, SalePayment } from '../../shared/ipc/vendas'
import { instalarApiFalsa, type ApiFalsa } from './ajuda/api-falsa'

let api: ApiFalsa

const pagamentoFeito = (): SalePayment => ({
  id: 1,
  amount: 50,
  paymentMethod: 'pix',
  feePercentage: 0,
  feeAmount: 0,
  netAmount: 50,
  receivedAt: '2026-09-22'
})

/** O exemplo da cliente: venda de R$ 86,00, já pagou R$ 50,00, falta R$ 36,00. */
const venda = (dados: Partial<Sale> = {}): Sale => ({
  id: 9,
  channel: 'WhatsApp',
  fairId: null,
  fairName: null,
  customerName: 'Maria',
  totalAmount: 86,
  totalCost: 20,
  paymentMethod: 'areceber',
  feePercentage: 0,
  feeAmount: 0,
  netAmount: 86,
  soldAt: '2026-09-21',
  receivedAt: null,
  items: [],
  payments: [pagamentoFeito()],
  amountDue: 36,
  ...dados
})

function hoje(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

beforeEach(() => {
  api = instalarApiFalsa()
  localStorage.clear()
})

describe('Receber pagamento', () => {
  it('should_suggest_what_is_still_due_as_the_amount', () => {
    render(<ReceberPagamentoModal sale={venda()} onSave={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByLabelText('Valor recebido (R$)')).toHaveValue('36')
    expect(screen.getByText(/a venda fica quitada/)).toBeInTheDocument()
  })

  it('should_show_the_customer_and_what_was_already_received', () => {
    render(<ReceberPagamentoModal sale={venda()} onSave={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByText('Maria')).toBeInTheDocument()
    expect(screen.getByText(/Já recebido/)).toHaveTextContent('R$ 50,00')
  })

  it('should_register_a_partial_payment', async () => {
    const usuaria = userEvent.setup()
    const onSave = vi.fn()
    render(
      <ReceberPagamentoModal
        sale={venda({ payments: [], amountDue: 86 })}
        onSave={onSave}
        onClose={vi.fn()}
      />
    )

    const valor = screen.getByLabelText('Valor recebido (R$)')
    await usuaria.clear(valor)
    await usuaria.type(valor, '50')
    expect(screen.getByText(/ainda faltam/)).toHaveTextContent('R$ 36,00')
    await usuaria.click(screen.getByRole('button', { name: 'PIX' }))
    await usuaria.click(screen.getByRole('button', { name: 'Confirmar recebimento' }))

    await waitFor(() => expect(api.sales.registerPayment).toHaveBeenCalledTimes(1))
    expect(api.sales.registerPayment.mock.calls[0][0]).toEqual({
      saleId: 9,
      amount: 50,
      paymentMethod: 'pix',
      feePercentage: 0,
      receivedAt: hoje()
    })
    expect(onSave).toHaveBeenCalled()
  })

  it('should_refuse_an_amount_above_what_is_due_without_sending', async () => {
    const usuaria = userEvent.setup()
    render(<ReceberPagamentoModal sale={venda()} onSave={vi.fn()} onClose={vi.fn()} />)

    const valor = screen.getByLabelText('Valor recebido (R$)')
    await usuaria.clear(valor)
    await usuaria.type(valor, '40')
    await usuaria.click(screen.getByRole('button', { name: 'Confirmar recebimento' }))

    expect(await screen.findByText(/maior do que o que falta receber/)).toBeInTheDocument()
    expect(api.sales.registerPayment).not.toHaveBeenCalled()
  })

  it('should_show_the_refusal_sent_by_the_app', async () => {
    const usuaria = userEvent.setup()
    api.sales.registerPayment.mockRejectedValue(
      new Error('Esta venda já foi recebida por inteiro.')
    )
    render(<ReceberPagamentoModal sale={venda()} onSave={vi.fn()} onClose={vi.fn()} />)

    await usuaria.click(screen.getByRole('button', { name: 'Confirmar recebimento' }))

    expect(await screen.findByText('Esta venda já foi recebida por inteiro.')).toBeInTheDocument()
  })
})
