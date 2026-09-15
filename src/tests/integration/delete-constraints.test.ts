import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prepararAmbienteIpc, type AmbienteIpc } from '../helpers/ambiente-ipc'
import { queryOne } from '../helpers/testDb'
import { criarProduto, criarVariacao, criarVenda } from '../helpers/estoque'

vi.mock('electron', async () => (await import('../helpers/ambiente-ipc')).electronFalso)
vi.mock('../../main/database', async () => (await import('../helpers/ambiente-ipc')).bancoFalso)

let ambiente: AmbienteIpc
let feira: number
let produto: number
let vendida: number
let venda: number

beforeEach(async () => {
  ambiente = await prepararAmbienteIpc()
  const criada = await ambiente.chamar<{ id: number }>('fairs:create', {
    name: 'Feira do Bosque',
    location: 'Praça',
    date: '2026-03-10',
    enrollmentCost: 0,
    additionalCosts: []
  })
  feira = Number(criada.id)
  produto = await criarProduto(ambiente, 'Colar Lua')
  vendida = await criarVariacao(ambiente, {
    productId: produto,
    receita: [],
    identifier: 'Dourado',
    costPrice: 10,
    salePrice: 40,
    stockQuantity: 5,
    motivoDoEstoqueInicial: 'contagem'
  })
  venda = await criarVenda(ambiente, {
    channel: 'Feira',
    fairId: feira,
    soldAt: '2026-03-10',
    items: [{ variationId: vendida, quantity: 1, unitPrice: 40, unitCost: 10 }]
  })
})

function contar(tabela: string): number {
  return queryOne<{ total: number }>(ambiente.banco, `SELECT COUNT(*) AS total FROM ${tabela}`)!
    .total
}

describe('exclusões bloqueadas por venda registrada', () => {
  it('should_refuse_to_delete_a_variation_that_was_sold', async () => {
    await expect(
      ambiente.chamar('variations:delete', vendida, { devolverInsumos: false })
    ).rejects.toThrow('Esta variação não pode ser excluída porque já foi vendida')

    expect(contar('product_variations')).toBe(1)
  })

  it('should_refuse_to_delete_a_product_whose_variation_was_sold', async () => {
    await expect(ambiente.chamar('products:delete', produto)).rejects.toThrow(
      'já possui vendas registradas'
    )

    expect(contar('products')).toBe(1)
  })

  it('should_refuse_to_delete_a_fair_with_sales', async () => {
    await expect(ambiente.chamar('fairs:delete', feira)).rejects.toThrow(
      'Esta feira não pode ser excluída porque já possui vendas registradas.'
    )

    expect(contar('fairs')).toBe(1)
  })

  it('should_preserve_the_sale_history_after_a_refused_delete', async () => {
    await expect(ambiente.chamar('products:delete', produto)).rejects.toThrow()

    expect(contar('sales')).toBe(1)
    expect(contar('sale_items')).toBe(1)
  })

  it('should_never_show_the_raw_constraint_error_to_the_user', async () => {
    const erro = await ambiente.chamar('products:delete', produto).catch((e: Error) => e)

    expect(erro).toBeInstanceOf(Error)
    expect((erro as Error).message).not.toMatch(/FOREIGN KEY|SqliteError/)
  })
})

describe('exclusões permitidas', () => {
  it('should_delete_a_variation_that_was_never_sold', async () => {
    const nuncaVendida = await criarVariacao(ambiente, {
      productId: produto,
      receita: [],
      identifier: 'Prateado',
      stockQuantity: 3,
      motivoDoEstoqueInicial: 'contagem'
    })

    await ambiente.chamar('variations:delete', nuncaVendida, { devolverInsumos: false })

    expect(contar('product_variations')).toBe(1)
  })

  it('should_remove_the_sale_items_when_the_sale_itself_is_deleted', async () => {
    await ambiente.chamar('sales:delete', venda)

    expect(contar('sales')).toBe(0)
    expect(contar('sale_items')).toBe(0)
  })

  it('should_delete_the_fair_once_its_sales_are_gone', async () => {
    await ambiente.chamar('sales:delete', venda)

    await ambiente.chamar('fairs:delete', feira)

    expect(contar('fairs')).toBe(0)
  })
})
