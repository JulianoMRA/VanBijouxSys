import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prepararAmbienteIpc, type AmbienteIpc } from '../helpers/ambiente-ipc'
import { criarVariacao, criarVenda } from '../helpers/estoque'
import type { Sale } from '../../shared/ipc/vendas'

vi.mock('electron', async () => (await import('../helpers/ambiente-ipc')).electronFalso)
vi.mock('../../main/database', async () => (await import('../helpers/ambiente-ipc')).bancoFalso)

let ambiente: AmbienteIpc
let variacao: number

beforeEach(async () => {
  ambiente = await prepararAmbienteIpc()
  variacao = await criarVariacao(ambiente, {
    receita: [],
    stockQuantity: 10,
    motivoDoEstoqueInicial: 'contagem'
  })
})

const itens = (): Array<{
  variationId: number
  quantity: number
  unitPrice: number
  unitCost: number
}> => [{ variationId: variacao, quantity: 1, unitPrice: 86, unitCost: 20 }]

/** Mesmo formato que o SaleForm envia ao salvar uma edição. */
const edicao = (id: number, dados: Record<string, unknown> = {}): Record<string, unknown> => ({
  id,
  channel: 'WhatsApp',
  soldAt: '2026-09-20',
  paymentMethod: 'dinheiro',
  feePercentage: 0,
  feeAmount: 0,
  netAmount: 86,
  items: itens(),
  ...dados
})

async function clienteDaVenda(): Promise<string | null> {
  const [venda] = await ambiente.chamar<Sale[]>('sales:getAll')
  return venda.customerName
}

describe('cliente da venda: gravação', () => {
  it('should_store_the_name_without_extra_spaces', async () => {
    await criarVenda(ambiente, { customerName: '  Maria   da Silva ', items: itens() })

    expect(await clienteDaVenda()).toBe('Maria da Silva')
  })

  it('should_list_a_sale_without_customer_as_null', async () => {
    await criarVenda(ambiente, { customerName: undefined, items: itens() })

    expect(await clienteDaVenda()).toBeNull()
  })

  it('should_store_a_blank_name_as_no_customer', async () => {
    await criarVenda(ambiente, { customerName: '   ', items: itens() })

    expect(await clienteDaVenda()).toBeNull()
  })

  it('should_change_the_name_when_the_sale_is_edited', async () => {
    const venda = await criarVenda(ambiente, { customerName: 'Maria', items: itens() })

    await ambiente.chamar('sales:update', edicao(venda, { customerName: 'Maria Souza' }))

    expect(await clienteDaVenda()).toBe('Maria Souza')
  })

  it('should_clear_the_name_when_it_is_erased_on_edit', async () => {
    const venda = await criarVenda(ambiente, { customerName: 'Maria', items: itens() })

    await ambiente.chamar('sales:update', edicao(venda, { customerName: '' }))

    expect(await clienteDaVenda()).toBeNull()
  })
})
