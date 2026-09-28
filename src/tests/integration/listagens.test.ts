import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prepararAmbienteIpc, type AmbienteIpc } from '../helpers/ambiente-ipc'
import { criarInsumo, criarProduto, criarVariacao, criarVenda } from '../helpers/estoque'
import { receber } from '../helpers/recebimentos'
import type { Product } from '../../shared/ipc/produtos'
import type { Sale } from '../../shared/ipc/vendas'

vi.mock('electron', async () => (await import('../helpers/ambiente-ipc')).electronFalso)
vi.mock('../../main/database', async () => (await import('../helpers/ambiente-ipc')).bancoFalso)

let ambiente: AmbienteIpc
let fio: number
let argola: number
let rosa: number
let azul: number
let pulseira: number

beforeEach(async () => {
  ambiente = await prepararAmbienteIpc()
  fio = await criarInsumo(ambiente, { name: 'Fio', stockQuantity: 1000 })
  argola = await criarInsumo(ambiente, { name: 'Argola', unit: 'unidade', stockQuantity: 1000 })
  pulseira = await criarProduto(ambiente, 'Pulseira')
  rosa = await criarVariacao(ambiente, {
    productId: pulseira,
    identifier: 'Rosa',
    receita: [{ insumoId: fio, quantity: 20 }]
  })
  azul = await criarVariacao(ambiente, {
    productId: pulseira,
    identifier: 'Azul',
    receita: [{ insumoId: fio, quantity: 30 }]
  })
})

/** Consultas que o banco preparou enquanto a chamada rodava. */
async function consultasDe(chamada: () => Promise<unknown>): Promise<number> {
  const preparar = vi.spyOn(ambiente.banco, 'prepare')
  try {
    await chamada()
    return preparar.mock.calls.length
  } finally {
    preparar.mockRestore()
  }
}

const umItem = (variationId: number, unitPrice = 25): Parameters<typeof criarVenda>[1] => ({
  items: [{ variationId, quantity: 1, unitPrice, unitCost: 3 }]
})

describe('listagens: o número de consultas não cresce com o histórico', () => {
  // Cada venda buscava os próprios itens e pagamentos, e sem índice em sale_items a
  // busca varria a tabela inteira: com 5.000 vendas, a lista levava quase 2 s no
  // SQLite real, com o processo principal parado.
  it('should_list_sales_with_the_same_number_of_queries_whatever_their_count', async () => {
    await criarVenda(ambiente, umItem(rosa))
    const comUmaVenda = await consultasDe(() => ambiente.chamar('sales:getAll'))

    for (let i = 0; i < 9; i++) await criarVenda(ambiente, umItem(i % 2 ? rosa : azul))
    const comDezVendas = await consultasDe(() => ambiente.chamar('sales:getAll'))

    expect(comDezVendas).toBe(comUmaVenda)
  })

  it('should_list_products_with_the_same_number_of_queries_whatever_their_count', async () => {
    const comUmProduto = await consultasDe(() => ambiente.chamar('products:getAll'))

    for (let i = 0; i < 5; i++) {
      await criarVariacao(ambiente, {
        identifier: `V${i}`,
        receita: [{ insumoId: fio, quantity: 1 }]
      })
    }
    const comSeisProdutos = await consultasDe(() => ambiente.chamar('products:getAll'))

    expect(comSeisProdutos).toBe(comUmProduto)
  })
})

describe('listagens: cada registro com o que é dele, na ordem de lançamento', () => {
  it('should_keep_each_sale_with_its_own_items_and_payments', async () => {
    const primeira = await criarVenda(ambiente, {
      customerName: 'Ana',
      paymentMethod: 'areceber',
      items: [
        { variationId: azul, quantity: 1, unitPrice: 40, unitCost: 3 },
        { variationId: rosa, quantity: 2, unitPrice: 25, unitCost: 3 }
      ]
    })
    const segunda = await criarVenda(ambiente, {
      customerName: 'Bia',
      paymentMethod: 'areceber',
      items: [{ variationId: rosa, quantity: 1, unitPrice: 30, unitCost: 3 }]
    })
    // Pagamentos intercalados entre as duas vendas, e um deles lançado fora da ordem das datas.
    await receber(ambiente, primeira, { amount: 10, receivedAt: '2026-09-23' })
    await receber(ambiente, segunda, { amount: 5, receivedAt: '2026-09-22' })
    await receber(ambiente, primeira, { amount: 20, receivedAt: '2026-09-22' })

    const vendas = await ambiente.chamar<Sale[]>('sales:getAll')
    const venda = (id: number): Sale => vendas.find((v) => v.id === id)!

    expect(venda(primeira).items.map((i) => [i.variationIdentifier, i.quantity])).toEqual([
      ['Azul', 1],
      ['Rosa', 2]
    ])
    expect(venda(segunda).items.map((i) => [i.variationIdentifier, i.quantity])).toEqual([
      ['Rosa', 1]
    ])
    expect(venda(primeira).payments.map((p) => [p.receivedAt, p.amount])).toEqual([
      ['2026-09-22', 20],
      ['2026-09-23', 10]
    ])
    expect(venda(segunda).payments.map((p) => p.amount)).toEqual([5])
    expect(venda(primeira).amountDue).toBe(60)
    expect(venda(segunda).amountDue).toBe(25)
  })

  it('should_list_a_sale_without_payments_with_an_empty_list', async () => {
    await criarVenda(ambiente, umItem(rosa))

    const [venda] = await ambiente.chamar<Sale[]>('sales:getAll')

    expect(venda.payments).toEqual([])
    expect(venda.items).toHaveLength(1)
  })

  it('should_keep_each_variation_with_its_own_recipe', async () => {
    await ambiente.chamar('variations:update', {
      id: rosa,
      productId: pulseira,
      identifier: 'Rosa',
      costPrice: 3,
      salePrice: 25,
      minimumStock: 1,
      laborCost: 0,
      insumos: [
        { insumoId: argola, quantity: 2 },
        { insumoId: fio, quantity: 20 }
      ]
    })
    const vazio = await criarProduto(ambiente, 'Colar sem variação')

    const produtos = await ambiente.chamar<Product[]>('products:getAll')
    const produto = produtos.find((p) => p.id === pulseira)!
    const receita = (identificador: string): Array<[string, number]> =>
      produto.variations
        .find((v) => v.identifier === identificador)!
        .insumos.map((i) => [i.insumoName, i.quantity])

    expect(produto.variations.map((v) => v.identifier)).toEqual(['Rosa', 'Azul'])
    expect(receita('Rosa')).toEqual([
      ['Argola', 2],
      ['Fio', 20]
    ])
    expect(receita('Azul')).toEqual([['Fio', 30]])
    expect(produtos.find((p) => p.id === vazio)!.variations).toEqual([])
  })
})
