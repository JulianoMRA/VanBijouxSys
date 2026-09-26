import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReceberPagamentoModal from '../../renderer/src/components/sales/ReceberPagamentoModal'
import SaleForm from '../../renderer/src/components/sales/SaleForm'
import type { Product } from '../../shared/ipc/produtos'
import type { Sale } from '../../shared/ipc/vendas'
import { instalarApiFalsa, variacaoFalsa, type ApiFalsa } from './ajuda/api-falsa'

let api: ApiFalsa

const produto = (): Product => ({
  id: 1,
  name: 'Colar Aurora',
  categoryId: 1,
  categoryName: 'Colar',
  description: null,
  createdAt: '2026-05-01',
  archivedAt: null,
  variations: [variacaoFalsa({ id: 10, costPrice: 3, salePrice: 25, stockQuantity: 4 })]
})

/** Venda a receber de R$ 86,00 da Maria, sem pagamento. */
const vendaAReceber = (): Sale => ({
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
  payments: [],
  amountDue: 86
})

type Usuaria = ReturnType<typeof userEvent.setup>

beforeEach(() => {
  api = instalarApiFalsa()
  api.products.getAll.mockResolvedValue([produto()])
  api.fairs.getAll.mockResolvedValue([])
  localStorage.clear()
})

async function digitarTaxa(usuaria: Usuaria, taxa: string): Promise<void> {
  const campo = screen.getByLabelText(/^Taxa/)
  await usuaria.clear(campo)
  if (taxa) await usuaria.type(campo, taxa)
}

async function receberNoCredito(usuaria: Usuaria, taxa: string): Promise<void> {
  const { unmount } = render(
    <ReceberPagamentoModal sale={vendaAReceber()} onSave={vi.fn()} onClose={vi.fn()} />
  )
  await usuaria.click(screen.getByRole('button', { name: 'Crédito' }))
  await digitarTaxa(usuaria, taxa)
  const chamadas = api.sales.registerPayment.mock.calls.length
  await usuaria.click(screen.getByRole('button', { name: 'Confirmar recebimento' }))
  await waitFor(() => expect(api.sales.registerPayment.mock.calls.length).toBe(chamadas + 1))
  unmount()
}

async function taxaSugeridaNoRecebimento(usuaria: Usuaria): Promise<string> {
  render(<ReceberPagamentoModal sale={vendaAReceber()} onSave={vi.fn()} onClose={vi.fn()} />)
  await usuaria.click(screen.getByRole('button', { name: 'Crédito' }))
  return (screen.getByLabelText(/^Taxa/) as HTMLInputElement).value
}

describe('taxa lembrada por forma de pagamento', () => {
  // A venda e o recebimento guardam a última taxa de cada forma no mesmo lugar: a
  // taxa da maquininha digitada num aparece como sugestão no outro.
  it('should_suggest_in_a_new_sale_the_fee_typed_when_receiving_a_payment', async () => {
    const usuaria = userEvent.setup()
    await receberNoCredito(usuaria, '3,49')

    render(<SaleForm onSave={vi.fn()} onClose={vi.fn()} />)
    await screen.findByLabelText('Produto')
    await usuaria.click(screen.getByRole('button', { name: 'Crédito' }))

    expect(screen.getByLabelText(/^Taxa/)).toHaveValue('3,49')
  })

  it('should_suggest_when_receiving_the_fee_typed_in_a_sale', async () => {
    const usuaria = userEvent.setup()
    const { unmount } = render(<SaleForm onSave={vi.fn()} onClose={vi.fn()} />)
    await usuaria.click(await screen.findByRole('button', { name: 'WhatsApp' }))
    await usuaria.selectOptions(screen.getByLabelText('Produto'), '1')
    await usuaria.selectOptions(screen.getByLabelText('Variação'), '10')
    await usuaria.click(screen.getByRole('button', { name: 'Crédito' }))
    await digitarTaxa(usuaria, '4,2')
    await usuaria.click(screen.getByRole('button', { name: 'Registrar venda' }))
    await waitFor(() => expect(api.sales.create).toHaveBeenCalledTimes(1))
    unmount()

    expect(await taxaSugeridaNoRecebimento(usuaria)).toBe('4,2')
  })

  it('should_keep_the_remembered_fee_when_a_payment_goes_without_fee', async () => {
    const usuaria = userEvent.setup()
    await receberNoCredito(usuaria, '3,49')
    await receberNoCredito(usuaria, '')

    expect(await taxaSugeridaNoRecebimento(usuaria)).toBe('3,49')
  })
})
