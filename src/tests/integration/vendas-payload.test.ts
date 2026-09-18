import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prepararAmbienteIpc, type AmbienteIpc } from '../helpers/ambiente-ipc'
import { queryAll } from '../helpers/testDb'
import { criarInsumo, criarProduto, criarVariacao, criarVenda } from '../helpers/estoque'
import { MENSAGEM_PAYLOAD_INVALIDO } from '../../main/ipc/mensagens'
import type { Sale } from '../../shared/ipc/vendas'

vi.mock('electron', async () => (await import('../helpers/ambiente-ipc')).electronFalso)
vi.mock('../../main/database', async () => (await import('../helpers/ambiente-ipc')).bancoFalso)

let ambiente: AmbienteIpc
let variacao: number
let feira: number

beforeEach(async () => {
  ambiente = await prepararAmbienteIpc()
  const fio = await criarInsumo(ambiente, { stockQuantity: 1000 })
  const produto = await criarProduto(ambiente, 'Colar')
  variacao = await criarVariacao(ambiente, {
    productId: produto,
    receita: [{ insumoId: fio, quantity: 10 }],
    stockQuantity: 10,
    motivoDoEstoqueInicial: 'producao'
  })
  const { id } = await ambiente.chamar<{ id: number }>('fairs:create', {
    name: 'Feira de Natal',
    location: 'Praça',
    date: '2026-12-05',
    enrollmentCost: 0,
    additionalCosts: []
  })
  feira = Number(id)
})

function estado(): unknown {
  return ['sales', 'sale_items', 'product_variations', 'insumos'].map((t) =>
    queryAll(ambiente.banco, `SELECT * FROM ${t} ORDER BY id`)
  )
}

async function recusaSemGravar(canal: string, ...args: unknown[]): Promise<void> {
  const antes = estado()
  await expect(ambiente.chamar(canal, ...args)).rejects.toThrow(MENSAGEM_PAYLOAD_INVALIDO)
  expect(estado()).toEqual(antes)
}

/** Formato que o SaleForm envia numa venda pelo WhatsApp. */
const novaVenda = (): Record<string, unknown> => ({
  channel: 'WhatsApp',
  fairId: undefined,
  soldAt: '2026-09-10',
  paymentMethod: 'pix',
  feePercentage: 1.2,
  feeAmount: 0.6,
  netAmount: 49.4,
  items: [{ variationId: variacao, quantity: 2, unitPrice: 25, unitCost: 3 }]
})

/** Formato que o MarkReceivedModal envia. */
const recebimento = (id: number): Record<string, unknown> => ({
  id,
  paymentMethod: 'dinheiro',
  feePercentage: 0,
  feeAmount: 0,
  netAmount: 50,
  receivedAt: '2026-09-12'
})

describe('vendas: payloads das telas continuam aceitos', () => {
  it('should_create_a_sale_with_the_form_payload', async () => {
    const { id } = await ambiente.chamar<{ id: number }>('sales:create', novaVenda())

    const [venda] = await ambiente.chamar<Sale[]>('sales:getAll')
    expect(venda).toMatchObject({
      id: Number(id),
      channel: 'WhatsApp',
      fairId: null,
      paymentMethod: 'pix',
      totalAmount: 50,
      totalCost: 6,
      netAmount: 49.4,
      soldAt: '2026-09-10'
    })
    expect(venda.items).toHaveLength(1)
  })

  it('should_accept_the_date_with_time_that_old_sales_carry', async () => {
    await ambiente.chamar('sales:create', { ...novaVenda(), soldAt: '2026-05-14 23:59:59' })

    expect((await ambiente.chamar<Sale[]>('sales:getAll'))[0]).toMatchObject({
      soldAt: '2026-05-14 23:59:59'
    })
  })

  it('should_create_a_fair_sale_and_update_it', async () => {
    const { id } = await ambiente.chamar<{ id: number }>('sales:create', {
      ...novaVenda(),
      channel: 'Feira',
      fairId: feira,
      paymentMethod: 'dinheiro',
      feePercentage: 0,
      feeAmount: 0,
      netAmount: 50
    })

    await ambiente.chamar('sales:update', {
      ...novaVenda(),
      id: Number(id),
      channel: 'Feira',
      fairId: feira,
      paymentMethod: 'dinheiro',
      feePercentage: 0,
      feeAmount: 0,
      netAmount: 75,
      items: [{ variationId: variacao, quantity: 3, unitPrice: 25, unitCost: 3 }]
    })

    const [venda] = await ambiente.chamar<Sale[]>('sales:getAll')
    expect(venda).toMatchObject({ fairId: feira, fairName: 'Feira de Natal', totalAmount: 75 })
  })

  it('should_accept_marking_and_unmarking_a_receivable_sale', async () => {
    const { id } = await ambiente.chamar<{ id: number }>('sales:create', {
      ...novaVenda(),
      paymentMethod: 'areceber',
      feePercentage: 0,
      feeAmount: 0,
      netAmount: 50
    })

    await ambiente.chamar('sales:markAsReceived', recebimento(Number(id)))
    expect((await ambiente.chamar<Sale[]>('sales:getAll'))[0]).toMatchObject({
      paymentMethod: 'dinheiro',
      receivedAt: '2026-09-12'
    })

    await ambiente.chamar('sales:unmarkAsReceived', Number(id))
    expect((await ambiente.chamar<Sale[]>('sales:getAll'))[0]).toMatchObject({
      paymentMethod: 'areceber',
      receivedAt: null
    })
  })

  it('should_accept_deleting_a_sale_by_id', async () => {
    const venda = await criarVenda(ambiente, {
      items: [{ variationId: variacao, quantity: 1, unitPrice: 25, unitCost: 3 }]
    })

    await ambiente.chamar('sales:delete', venda)

    expect(await ambiente.chamar<Sale[]>('sales:getAll')).toEqual([])
  })
})

describe('vendas: payload fora do formato é recusado sem gravar', () => {
  it('should_refuse_an_unknown_channel_or_payment_method', async () => {
    await recusaSemGravar('sales:create', { ...novaVenda(), channel: 'Shopee' })
    await recusaSemGravar('sales:create', { ...novaVenda(), paymentMethod: 'boleto' })
  })

  it('should_refuse_a_sale_date_that_is_not_a_plain_date', async () => {
    await recusaSemGravar('sales:create', { ...novaVenda(), soldAt: '' })
    await recusaSemGravar('sales:create', { ...novaVenda(), soldAt: '10/09/2026' })
    await recusaSemGravar('sales:create', { ...novaVenda(), soldAt: '2026-09-10T12:00:00Z' })
  })

  it('should_refuse_a_fair_sent_as_text', async () => {
    await recusaSemGravar('sales:create', { ...novaVenda(), channel: 'Feira', fairId: 'Natal' })
  })

  it('should_refuse_a_sale_without_items', async () => {
    await recusaSemGravar('sales:create', { ...novaVenda(), items: [] })
    await recusaSemGravar('sales:create', { ...novaVenda(), items: 'Colar' })
  })

  it('should_refuse_items_with_fractional_or_zero_quantity', async () => {
    await recusaSemGravar('sales:create', {
      ...novaVenda(),
      items: [{ variationId: variacao, quantity: 1.5, unitPrice: 25, unitCost: 3 }]
    })
    await recusaSemGravar('sales:create', {
      ...novaVenda(),
      items: [{ variationId: variacao, quantity: 0, unitPrice: 25, unitCost: 3 }]
    })
  })

  it('should_refuse_prices_sent_as_text_or_negative', async () => {
    await recusaSemGravar('sales:create', {
      ...novaVenda(),
      items: [{ variationId: variacao, quantity: 1, unitPrice: '25,00', unitCost: 3 }]
    })
    await recusaSemGravar('sales:create', {
      ...novaVenda(),
      items: [{ variationId: variacao, quantity: 1, unitPrice: 25, unitCost: -3 }]
    })
  })

  it('should_refuse_an_item_without_a_variation', async () => {
    await recusaSemGravar('sales:create', {
      ...novaVenda(),
      items: [{ quantity: 1, unitPrice: 25, unitCost: 3 }]
    })
  })

  it('should_refuse_a_fee_outside_zero_to_one_hundred', async () => {
    await recusaSemGravar('sales:create', { ...novaVenda(), feePercentage: 120 })
    await recusaSemGravar('sales:create', { ...novaVenda(), feePercentage: -1 })
    await recusaSemGravar('sales:create', { ...novaVenda(), feeAmount: '0,60' })
  })

  it('should_refuse_updating_without_an_id', async () => {
    const venda = await criarVenda(ambiente, {
      items: [{ variationId: variacao, quantity: 1, unitPrice: 25, unitCost: 3 }]
    })
    await recusaSemGravar('sales:update', novaVenda())
    await recusaSemGravar('sales:update', { ...novaVenda(), id: String(venda) })
  })

  it('should_refuse_receiving_a_sale_as_areceber_or_without_a_date', async () => {
    const venda = await criarVenda(ambiente, {
      paymentMethod: 'areceber',
      items: [{ variationId: variacao, quantity: 1, unitPrice: 25, unitCost: 3 }]
    })
    await recusaSemGravar('sales:markAsReceived', {
      ...recebimento(venda),
      paymentMethod: 'areceber'
    })
    await recusaSemGravar('sales:markAsReceived', { ...recebimento(venda), receivedAt: '' })
    await recusaSemGravar('sales:markAsReceived', { ...recebimento(venda), id: undefined })
  })

  it('should_refuse_delete_and_unmark_with_something_that_is_not_an_id', async () => {
    await recusaSemGravar('sales:delete', 'todas')
    await recusaSemGravar('sales:delete', 0)
    await recusaSemGravar('sales:unmarkAsReceived', '1')
  })
})
