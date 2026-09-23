import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SaleForm from '../../renderer/src/components/sales/SaleForm'
import { MENSAGEM_CLIENTE_OBRIGATORIA } from '../../shared/clientes'
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

/** Venda antiga, com custo de 2 no item: o produto hoje custa 3. */
const vendaAntiga = (): Sale => ({
  id: 5,
  channel: 'WhatsApp',
  fairId: null,
  fairName: null,
  customerName: null,
  totalAmount: 25,
  totalCost: 2,
  paymentMethod: 'pix',
  feePercentage: 0,
  feeAmount: 0,
  netAmount: 25,
  soldAt: '2026-05-10',
  receivedAt: null,
  items: [
    {
      id: 100,
      variationId: 10,
      variationIdentifier: 'Rosa',
      productName: 'Colar Aurora',
      quantity: 1,
      unitPrice: 25,
      unitCost: 2
    }
  ],
  payments: [],
  amountDue: 0
})

/** Venda a receber de R$ 86,00 da Maria, com R$ 50,00 já pagos no PIX. */
const vendaComPagamento = (): Sale => ({
  ...vendaAntiga(),
  customerName: 'Maria',
  paymentMethod: 'areceber',
  totalAmount: 86,
  netAmount: 86,
  items: [{ ...vendaAntiga().items[0], unitPrice: 86 }],
  payments: [
    {
      id: 1,
      amount: 50,
      paymentMethod: 'pix',
      feePercentage: 0,
      feeAmount: 0,
      netAmount: 50,
      receivedAt: '2026-05-12'
    }
  ],
  amountDue: 36
})

beforeEach(() => {
  api = instalarApiFalsa()
  api.products.getAll.mockResolvedValue([produto()])
  api.fairs.getAll.mockResolvedValue([])
  localStorage.clear()
})

async function escolherItem(usuaria: ReturnType<typeof userEvent.setup>): Promise<void> {
  await usuaria.selectOptions(await screen.findByLabelText('Produto'), '1')
  await usuaria.selectOptions(screen.getByLabelText('Variação'), '10')
}

describe('SaleForm: custo do item', () => {
  it('should_keep_the_cost_recorded_in_the_sale_when_editing_an_old_one', async () => {
    const usuaria = userEvent.setup()
    render(<SaleForm sale={vendaAntiga()} onSave={vi.fn()} onClose={vi.fn()} />)
    await screen.findByDisplayValue('25')

    await usuaria.click(screen.getByRole('button', { name: /Salvar/ }))

    await waitFor(() => expect(api.sales.update).toHaveBeenCalledTimes(1))
    // O custo de hoje é 3; a venda antiga guarda 2, e é ele que vale.
    expect(api.sales.update.mock.calls[0][0].items).toEqual([
      { variationId: 10, quantity: 1, unitPrice: 25, unitCost: 2 }
    ])
  })

  it('should_use_todays_cost_for_an_item_added_now', async () => {
    const usuaria = userEvent.setup()
    render(<SaleForm onSave={vi.fn()} onClose={vi.fn()} />)
    await screen.findByLabelText('Produto')

    await usuaria.click(screen.getByRole('button', { name: 'WhatsApp' }))
    await escolherItem(usuaria)
    await usuaria.click(screen.getByRole('button', { name: 'Registrar venda' }))

    await waitFor(() => expect(api.sales.create).toHaveBeenCalledTimes(1))
    expect(api.sales.create.mock.calls[0][0].items).toEqual([
      { variationId: 10, quantity: 1, unitPrice: 25, unitCost: 3 }
    ])
  })
})

describe('SaleForm: conferências antes de salvar', () => {
  it('should_refuse_an_empty_sale_date', async () => {
    const usuaria = userEvent.setup()
    render(<SaleForm onSave={vi.fn()} onClose={vi.fn()} />)
    await screen.findByLabelText('Produto')

    await usuaria.click(screen.getByRole('button', { name: 'WhatsApp' }))
    await escolherItem(usuaria)
    await usuaria.clear(screen.getByLabelText('Data da venda'))
    await usuaria.click(screen.getByRole('button', { name: 'Registrar venda' }))

    expect(await screen.findByText('Informe a data da venda.')).toBeInTheDocument()
    expect(api.sales.create).not.toHaveBeenCalled()
  })

  it('should_require_the_fair_when_the_channel_is_a_fair', async () => {
    const usuaria = userEvent.setup()
    render(<SaleForm onSave={vi.fn()} onClose={vi.fn()} />)
    await screen.findByLabelText('Produto')

    await escolherItem(usuaria)
    await usuaria.click(screen.getByRole('button', { name: 'Registrar venda' }))

    expect(await screen.findByText('Selecione a feira correspondente.')).toBeInTheDocument()
    expect(api.sales.create).not.toHaveBeenCalled()
  })
})

describe('SaleForm: cliente', () => {
  it('should_require_the_customer_for_a_receivable_sale', async () => {
    const usuaria = userEvent.setup()
    render(<SaleForm onSave={vi.fn()} onClose={vi.fn()} />)
    await screen.findByLabelText('Produto')

    await usuaria.click(screen.getByRole('button', { name: 'WhatsApp' }))
    await escolherItem(usuaria)
    await usuaria.click(screen.getByRole('button', { name: 'A receber' }))
    await usuaria.click(screen.getByRole('button', { name: 'Registrar venda' }))

    expect(await screen.findByText(MENSAGEM_CLIENTE_OBRIGATORIA)).toBeInTheDocument()
    expect(api.sales.create).not.toHaveBeenCalled()
  })

  it('should_send_the_customer_without_extra_spaces', async () => {
    const usuaria = userEvent.setup()
    render(<SaleForm onSave={vi.fn()} onClose={vi.fn()} />)
    await screen.findByLabelText('Produto')

    await usuaria.click(screen.getByRole('button', { name: 'WhatsApp' }))
    await usuaria.type(screen.getByLabelText('Cliente'), '  Maria  Souza ')
    await escolherItem(usuaria)
    await usuaria.click(screen.getByRole('button', { name: 'A receber' }))
    await usuaria.click(screen.getByRole('button', { name: 'Registrar venda' }))

    await waitFor(() => expect(api.sales.create).toHaveBeenCalledTimes(1))
    expect(api.sales.create.mock.calls[0][0]).toMatchObject({
      paymentMethod: 'areceber',
      customerName: 'Maria Souza'
    })
  })

  it('should_suggest_the_names_already_used', async () => {
    render(<SaleForm sugestoesDeClientes={['Ana', 'Maria']} onSave={vi.fn()} onClose={vi.fn()} />)

    const campo = await screen.findByLabelText('Cliente')
    const lista = document.getElementById(campo.getAttribute('list') ?? '')

    expect(
      Array.from(lista?.querySelectorAll('option') ?? []).map((o) => o.getAttribute('value'))
    ).toEqual(['Ana', 'Maria'])
  })

  it('should_keep_the_customer_when_editing_a_sale', async () => {
    const usuaria = userEvent.setup()
    render(
      <SaleForm
        sale={{ ...vendaAntiga(), customerName: 'Maria' }}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    )
    await screen.findByDisplayValue('25')

    expect(screen.getByLabelText('Cliente')).toHaveValue('Maria')
    await usuaria.click(screen.getByRole('button', { name: /Salvar/ }))

    await waitFor(() => expect(api.sales.update).toHaveBeenCalledTimes(1))
    expect(api.sales.update.mock.calls[0][0]).toMatchObject({ customerName: 'Maria' })
  })
})

describe('SaleForm: venda com pagamento registrado', () => {
  it('should_lock_the_payment_method_while_there_are_payments', async () => {
    render(<SaleForm sale={vendaComPagamento()} onSave={vi.fn()} onClose={vi.fn()} />)
    await screen.findByDisplayValue('86')

    expect(screen.getByRole('button', { name: 'PIX' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'A receber' })).toBeEnabled()
    expect(screen.getByText(/a forma continua "A receber"/)).toBeInTheDocument()
  })

  it('should_refuse_a_total_below_what_was_already_received', async () => {
    const usuaria = userEvent.setup()
    render(<SaleForm sale={vendaComPagamento()} onSave={vi.fn()} onClose={vi.fn()} />)
    const preco = await screen.findByDisplayValue('86')

    await usuaria.clear(preco)
    await usuaria.type(preco, '40')
    await usuaria.click(screen.getByRole('button', { name: /Salvar/ }))

    expect(await screen.findByText(/abaixo do que já foi recebido/)).toBeInTheDocument()
    expect(api.sales.update).not.toHaveBeenCalled()
  })

  it('should_show_the_refusal_sent_by_the_app', async () => {
    const usuaria = userEvent.setup()
    api.sales.update.mockRejectedValue(
      new Error('A data da venda não pode ficar depois de um pagamento já registrado.')
    )
    render(<SaleForm sale={vendaComPagamento()} onSave={vi.fn()} onClose={vi.fn()} />)
    await screen.findByDisplayValue('86')

    await usuaria.click(screen.getByRole('button', { name: /Salvar/ }))

    expect(
      await screen.findByText(
        'A data da venda não pode ficar depois de um pagamento já registrado.'
      )
    ).toBeInTheDocument()
  })
})

describe('SaleForm: aviso de estoque', () => {
  it('should_warn_when_selling_more_than_the_registered_stock', async () => {
    const usuaria = userEvent.setup()
    render(<SaleForm onSave={vi.fn()} onClose={vi.fn()} />)
    await screen.findByLabelText('Produto')

    await escolherItem(usuaria)
    const quantidade = screen.getByLabelText('Qtd.')
    await usuaria.clear(quantidade)
    await usuaria.type(quantidade, '6')

    expect(await screen.findByText(/O estoque registrado é 4 un\./)).toBeInTheDocument()
    expect(screen.getByText(/vai ficar em/)).toHaveTextContent('-2')
  })

  it('should_not_warn_when_the_quantity_fits_the_stock', async () => {
    const usuaria = userEvent.setup()
    render(<SaleForm onSave={vi.fn()} onClose={vi.fn()} />)
    await screen.findByLabelText('Produto')

    await escolherItem(usuaria)

    expect(screen.queryByText(/O estoque registrado é/)).not.toBeInTheDocument()
  })
})
