import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prepararAmbienteIpc, type AmbienteIpc } from '../helpers/ambiente-ipc'
import { criarInsumo, criarProduto, criarVariacao } from '../helpers/estoque'
import type { Category, Product } from '../../shared/ipc/produtos'

vi.mock('electron', async () => (await import('../helpers/ambiente-ipc')).electronFalso)
vi.mock('../../main/database', async () => (await import('../helpers/ambiente-ipc')).bancoFalso)

let ambiente: AmbienteIpc

beforeEach(async () => {
  ambiente = await prepararAmbienteIpc()
})

describe('categories:getAll', () => {
  it('should_list_the_seeded_categories_in_alphabetical_order', async () => {
    const categorias = await ambiente.chamar<Category[]>('categories:getAll')

    expect(categorias.map((c) => c.name)).toEqual([
      'Brinco',
      'Colar',
      'Pingente',
      'Pulseira',
      'Tiara'
    ])
  })
})

describe('products:getAll', () => {
  it('should_list_products_by_name_with_category_and_no_description', async () => {
    await criarProduto(ambiente, 'Pulseira Luar')
    await criarProduto(ambiente, 'Colar Aurora')

    const produtos = await ambiente.chamar<Product[]>('products:getAll')

    expect(produtos.map((p) => [p.name, p.categoryName, p.description, p.archivedAt])).toEqual([
      ['Colar Aurora', 'Pulseira', null, null],
      ['Pulseira Luar', 'Pulseira', null, null]
    ])
  })

  it('should_bring_each_variation_with_the_recipe_the_screens_read', async () => {
    const fio = await criarInsumo(ambiente, {
      name: 'Fio encerado',
      unit: 'cm',
      costPerUnit: 0.02,
      stockQuantity: 500
    })
    const produto = await criarProduto(ambiente, 'Colar Aurora')
    const variacao = await criarVariacao(ambiente, {
      productId: produto,
      identifier: 'Dourado',
      receita: [{ insumoId: fio, quantity: 12.5 }],
      stockQuantity: 0
    })

    const [lido] = await ambiente.chamar<Product[]>('products:getAll')

    expect(lido.variations).toHaveLength(1)
    expect(lido.variations[0]).toMatchObject({ id: variacao, identifier: 'Dourado' })
    expect(lido.variations[0].insumos).toEqual([
      expect.objectContaining({
        variationId: variacao,
        insumoId: fio,
        insumoName: 'Fio encerado',
        unit: 'cm',
        costPerUnit: 0.02,
        quantity: 12.5,
        archivedAt: null
      })
    ])
  })

  it('should_flag_a_recipe_item_whose_insumo_was_archived', async () => {
    const fio = await criarInsumo(ambiente, { stockQuantity: 500 })
    await criarVariacao(ambiente, { receita: [{ insumoId: fio, quantity: 10 }] })

    await ambiente.chamar('insumos:setArchived', fio, true)
    const [lido] = await ambiente.chamar<Product[]>('products:getAll')

    expect(lido.variations[0].insumos[0].archivedAt).not.toBeNull()
  })
})
