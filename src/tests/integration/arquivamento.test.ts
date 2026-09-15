import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prepararAmbienteIpc, type AmbienteIpc } from '../helpers/ambiente-ipc'
import { queryOne } from '../helpers/testDb'
import { criarInsumo, criarProduto, criarVariacao, criarVenda } from '../helpers/estoque'
import type { DashboardStats } from '../../main/ipc/dashboard'

vi.mock('electron', async () => (await import('../helpers/ambiente-ipc')).electronFalso)
vi.mock('../../main/database', async () => (await import('../helpers/ambiente-ipc')).bancoFalso)

let ambiente: AmbienteIpc
let aurora: number
let luar: number
let douradoP: number
let rose: number
let fecho: number
let argola: number

/**
 * Cenário fixo: um produto com duas variações problemáticas (uma esgotada e uma
 * abaixo do mínimo) e um insumo esgotado. É exatamente o que polui os avisos da
 * cliente. Estoque inicial como "contagem", para nenhuma receita mexer nos insumos.
 */
beforeEach(async () => {
  ambiente = await prepararAmbienteIpc()
  aurora = await criarProduto(ambiente, 'Colar Aurora')
  luar = await criarProduto(ambiente, 'Pulseira Luar')
  fecho = await criarInsumo(ambiente, {
    name: 'Fecho lagosta',
    unit: 'unidade',
    costPerUnit: 0.45,
    stockQuantity: 0,
    minimumStock: 50
  })
  argola = await criarInsumo(ambiente, {
    name: 'Argola 8mm',
    unit: 'unidade',
    costPerUnit: 0.18,
    stockQuantity: 120,
    minimumStock: 300
  })
  const variacao = (
    productId: number,
    identifier: string,
    stockQuantity: number,
    minimumStock: number,
    receita: Array<{ insumoId: number; quantity: number }> = []
  ): Promise<number> =>
    criarVariacao(ambiente, {
      productId,
      identifier,
      costPrice: 10,
      salePrice: 40,
      stockQuantity,
      minimumStock,
      motivoDoEstoqueInicial: 'contagem',
      receita
    })
  douradoP = await variacao(aurora, 'Dourado P', 0, 4, [{ insumoId: fecho, quantity: 1 }])
  rose = await variacao(aurora, 'Rose', 2, 5)
  await variacao(luar, 'M', 9, 3, [{ insumoId: fecho, quantity: 2 }])
})

async function alertas(): Promise<{
  esgotadas: string[]
  abaixo: string[]
  insumosEsgotados: string[]
  insumosAbaixo: string[]
}> {
  const painel = await ambiente.chamar<DashboardStats>('dashboard:getStats', { period: 'all' })
  return {
    esgotadas: painel.outOfStock.map((v) => v.identifier),
    abaixo: painel.lowStock.map((v) => v.identifier),
    insumosEsgotados: painel.outOfInsumos.map((i) => i.name),
    insumosAbaixo: painel.lowInsumos.map((i) => i.name)
  }
}

const arquivar = (canal: string, id: number, arquivado = true): Promise<unknown> =>
  ambiente.chamar(canal, id, arquivado)

describe('alertas de estoque com itens arquivados', () => {
  it('should_list_the_problem_items_while_nothing_is_archived', async () => {
    expect(await alertas()).toEqual({
      esgotadas: ['Dourado P'],
      abaixo: ['Rose'],
      insumosEsgotados: ['Fecho lagosta'],
      insumosAbaixo: ['Argola 8mm']
    })
  })

  it('should_drop_an_archived_variation_from_the_out_of_stock_alert', async () => {
    await arquivar('variations:setArchived', douradoP)

    expect((await alertas()).esgotadas).toEqual([])
  })

  it('should_drop_an_archived_variation_from_the_low_stock_alert', async () => {
    await arquivar('variations:setArchived', rose)

    expect((await alertas()).abaixo).toEqual([])
  })

  it('should_silence_every_variation_of_an_archived_product', async () => {
    // O produto é arquivado sozinho: as variações continuam com archived_at nulo
    // e mesmo assim precisam sair dos avisos.
    await arquivar('products:setArchived', aurora)

    const { esgotadas, abaixo } = await alertas()
    expect(esgotadas).toEqual([])
    expect(abaixo).toEqual([])
    expect(
      queryOne(ambiente.banco, 'SELECT archived_at FROM product_variations WHERE id = ?', [
        douradoP
      ])
    ).toEqual({ archived_at: null })
  })

  it('should_drop_archived_insumos_from_both_alerts', async () => {
    await arquivar('insumos:setArchived', fecho)
    await arquivar('insumos:setArchived', argola)

    const { insumosEsgotados, insumosAbaixo } = await alertas()
    expect(insumosEsgotados).toEqual([])
    expect(insumosAbaixo).toEqual([])
  })

  it('should_keep_alerting_for_items_that_were_not_archived', async () => {
    await arquivar('variations:setArchived', douradoP)
    await arquivar('insumos:setArchived', fecho)

    const { abaixo, insumosAbaixo } = await alertas()
    expect(abaixo).toEqual(['Rose'])
    expect(insumosAbaixo).toEqual(['Argola 8mm'])
  })
})

describe('voltar atrás', () => {
  it('should_bring_the_alert_back_when_the_variation_is_unarchived', async () => {
    await arquivar('variations:setArchived', douradoP)
    await arquivar('variations:setArchived', douradoP, false)

    expect((await alertas()).esgotadas).toEqual(['Dourado P'])
  })

  it('should_not_resurrect_a_variation_archived_on_its_own', async () => {
    // Motivo da derivação: se arquivar o produto escrevesse nas variações,
    // desarquivar traria de volta a variação que ela já tinha arquivado antes.
    await arquivar('variations:setArchived', douradoP)
    await arquivar('products:setArchived', aurora)
    await arquivar('products:setArchived', aurora, false)

    const { esgotadas, abaixo } = await alertas()
    expect(esgotadas).toEqual([])
    expect(abaixo).toEqual(['Rose'])
  })
})

describe('histórico e métricas', () => {
  beforeEach(async () => {
    await ambiente.chamar('variations:addStock', douradoP, 2)
    await criarVenda(ambiente, {
      channel: 'Feira',
      soldAt: '2026-08-10',
      items: [{ variationId: douradoP, quantity: 2, unitPrice: 40, unitCost: 10 }]
    })
  })

  it('should_keep_revenue_and_profit_untouched_after_archiving', async () => {
    const antes = (await ambiente.chamar<DashboardStats>('dashboard:getStats', { period: 'all' }))
      .overview

    await arquivar('variations:setArchived', douradoP)
    await arquivar('products:setArchived', aurora)

    const depois = (await ambiente.chamar<DashboardStats>('dashboard:getStats', { period: 'all' }))
      .overview
    expect(depois).toEqual(antes)
    expect(depois.totalRevenue).toBe(80)
  })

  it('should_still_name_an_archived_variation_in_the_sales_history', async () => {
    // "Mais vendidas" e o detalhe da venda continuam mostrando o que foi vendido:
    // arquivar não é excluir.
    await arquivar('variations:setArchived', douradoP)
    await arquivar('products:setArchived', aurora)

    const [venda] = await ambiente.chamar<
      Array<{
        items: Array<{ productName: string; variationIdentifier: string; quantity: number }>
      }>
    >('sales:getAll')
    const painel = await ambiente.chamar<DashboardStats>('dashboard:getStats', { period: 'all' })

    expect(venda.items).toMatchObject([
      { productName: 'Colar Aurora', variationIdentifier: 'Dourado P', quantity: 2 }
    ])
    expect(painel.topVariations).toMatchObject([
      { productName: 'Colar Aurora', identifier: 'Dourado P', quantity: 2 }
    ])
  })
})

describe('uso de insumo por variações ativas', () => {
  async function insumo(
    id: number
  ): Promise<{ usadoPorVariacoesAtivas: number; archivedAt: string | null }> {
    const lista =
      await ambiente.chamar<
        Array<{ id: number; usadoPorVariacoesAtivas: number; archivedAt: string | null }>
      >('insumos:getAll')
    return lista.find((i) => i.id === id)!
  }

  it('should_count_every_active_variation_using_it', async () => {
    expect((await insumo(fecho)).usadoPorVariacoesAtivas).toBe(2)
  })

  it('should_ignore_variations_that_were_archived', async () => {
    await arquivar('variations:setArchived', douradoP)

    expect((await insumo(fecho)).usadoPorVariacoesAtivas).toBe(1)
  })

  it('should_ignore_variations_whose_product_was_archived', async () => {
    await arquivar('products:setArchived', luar)

    expect((await insumo(fecho)).usadoPorVariacoesAtivas).toBe(1)
  })

  it('should_still_list_archived_insumos_so_the_screen_can_show_them', async () => {
    await arquivar('insumos:setArchived', fecho)

    const lista = await ambiente.chamar<Array<{ id: number }>>('insumos:getAll')
    expect(lista).toHaveLength(2)
    expect((await insumo(fecho)).archivedAt).not.toBeNull()
    expect((await insumo(argola)).archivedAt).toBeNull()
  })
})
