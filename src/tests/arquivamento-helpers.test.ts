import { describe, it, expect } from 'vitest'
import {
  contarAlertasDeEstoque,
  estaArquivado,
  estoqueAtivo,
  insumosAtivos,
  mensagemDeArquivamento,
  opcoesComSelecionados,
  produtosAtivos,
  variacaoInativa,
  variacoesAtivas
} from '../renderer/src/utils/arquivamento'
import type { Insumo, Product, ProductVariation } from '../renderer/src/types'

function variacao(over: Partial<ProductVariation> = {}): ProductVariation {
  return {
    id: 1,
    productId: 1,
    identifier: 'Dourado P',
    costPrice: 10,
    salePrice: 40,
    stockQuantity: 5,
    minimumStock: 3,
    laborCost: 0,
    createdAt: '2026-01-01',
    archivedAt: null,
    insumos: [],
    ...over
  }
}

function produto(over: Partial<Product> = {}): Product {
  return {
    id: 1,
    name: 'Colar Aurora',
    categoryId: 1,
    categoryName: 'Colares',
    description: null,
    createdAt: '2026-01-01',
    archivedAt: null,
    variations: [],
    ...over
  }
}

function insumo(over: Partial<Insumo> = {}): Insumo {
  return {
    id: 1,
    name: 'Fecho lagosta',
    unit: 'unidade',
    costPerUnit: 0.45,
    stockQuantity: 0,
    minimumStock: 50,
    createdAt: '2026-01-01',
    archivedAt: null,
    usadoPorVariacoesAtivas: 0,
    ...over
  }
}

describe('estaArquivado', () => {
  it('should_treat_null_as_active', () => {
    expect(estaArquivado(produto())).toBe(false)
  })

  it('should_treat_a_date_as_archived', () => {
    expect(estaArquivado(produto({ archivedAt: '2026-08-15 10:00:00' }))).toBe(true)
  })
})

describe('variação inativa por derivação', () => {
  it('should_be_inactive_when_the_variation_itself_is_archived', () => {
    const v = variacao({ archivedAt: '2026-08-15 10:00:00' })

    expect(variacaoInativa(produto({ variations: [v] }), v)).toBe(true)
  })

  it('should_be_inactive_when_only_the_product_is_archived', () => {
    const v = variacao()
    const p = produto({ archivedAt: '2026-08-15 10:00:00', variations: [v] })

    expect(variacaoInativa(p, v)).toBe(true)
    expect(v.archivedAt).toBeNull()
  })

  it('should_return_no_active_variations_for_an_archived_product', () => {
    const p = produto({
      archivedAt: '2026-08-15 10:00:00',
      variations: [variacao(), variacao({ id: 2 })]
    })

    expect(variacoesAtivas(p)).toEqual([])
  })

  it('should_keep_the_variations_that_are_not_archived', () => {
    const ativa = variacao({ id: 1 })
    const arquivada = variacao({ id: 2, archivedAt: '2026-08-15 10:00:00' })

    expect(variacoesAtivas(produto({ variations: [ativa, arquivada] }))).toEqual([ativa])
  })
})

describe('contagem de alertas', () => {
  const esgotada = variacao({ id: 1, stockQuantity: 0, minimumStock: 4 })
  const baixa = variacao({ id: 2, stockQuantity: 2, minimumStock: 5 })
  const normal = variacao({ id: 3, stockQuantity: 9, minimumStock: 3 })

  it('should_count_every_problem_variation_when_nothing_is_archived', () => {
    const p = produto({ variations: [esgotada, baixa, normal] })

    expect(contarAlertasDeEstoque([p])).toEqual({ esgotadas: 1, abaixoDoMinimo: 1 })
  })

  it('should_ignore_an_archived_variation', () => {
    const p = produto({
      variations: [{ ...esgotada, archivedAt: '2026-08-15 10:00:00' }, baixa, normal]
    })

    expect(contarAlertasDeEstoque([p])).toEqual({ esgotadas: 0, abaixoDoMinimo: 1 })
  })

  it('should_ignore_every_variation_of_an_archived_product', () => {
    const p = produto({
      archivedAt: '2026-08-15 10:00:00',
      variations: [esgotada, baixa, normal]
    })

    expect(contarAlertasDeEstoque([p])).toEqual({ esgotadas: 0, abaixoDoMinimo: 0 })
  })

  it('should_not_count_a_variation_at_or_above_the_minimum', () => {
    const noMinimo = variacao({ id: 4, stockQuantity: 3, minimumStock: 3 })

    expect(contarAlertasDeEstoque([produto({ variations: [noMinimo] })])).toEqual({
      esgotadas: 0,
      abaixoDoMinimo: 0
    })
  })
})

describe('opções de seletor', () => {
  const arquivado = '2026-08-15 10:00:00'

  it('should_offer_only_the_active_ones_by_default', () => {
    const lista = [insumo({ id: 1 }), insumo({ id: 2, archivedAt: arquivado })]

    expect(opcoesComSelecionados(lista, []).map((i) => i.id)).toEqual([1])
  })

  it('should_keep_an_archived_item_that_is_already_selected', () => {
    // Editar uma venda antiga com variação arquivada depois: sem esta regra o
    // item sumiria da lista e a venda seria salva sem ele.
    const lista = [insumo({ id: 1 }), insumo({ id: 2, archivedAt: arquivado })]

    expect(opcoesComSelecionados(lista, [2]).map((i) => i.id)).toEqual([1, 2])
  })

  it('should_not_duplicate_an_active_item_that_is_selected', () => {
    const lista = [insumo({ id: 1 }), insumo({ id: 2 })]

    expect(opcoesComSelecionados(lista, [1, 2]).map((i) => i.id)).toEqual([1, 2])
  })

  it('should_ignore_selected_ids_that_are_not_in_the_list', () => {
    const lista = [insumo({ id: 1, archivedAt: arquivado })]

    expect(opcoesComSelecionados(lista, [99])).toEqual([])
  })
})

describe('aviso ao arquivar insumo', () => {
  it('should_use_the_singular_for_a_single_variation', () => {
    const msg = mensagemDeArquivamento(insumo({ usadoPorVariacoesAtivas: 1 }), 'un.')

    expect(msg).toContain('é usado em 1 variação ativa.')
  })

  it('should_use_the_plural_for_more_than_one', () => {
    const msg = mensagemDeArquivamento(insumo({ usadoPorVariacoesAtivas: 3 }), 'un.')

    expect(msg).toContain('é usado em 3 variações ativas.')
  })

  it('should_mention_the_remaining_stock_with_its_unit', () => {
    const msg = mensagemDeArquivamento(insumo({ stockQuantity: 1800 }), 'cm')

    expect(msg).toContain('ainda tem 1.800 cm em estoque.')
  })

  it('should_join_both_reasons_when_they_apply_together', () => {
    const msg = mensagemDeArquivamento(
      insumo({ usadoPorVariacoesAtivas: 2, stockQuantity: 120 }),
      'un.'
    )

    expect(msg).toContain('é usado em 2 variações ativas e ainda tem 120 un. em estoque.')
  })
})

describe('estoque e listas', () => {
  it('should_sum_only_the_active_variations', () => {
    const p = produto({
      variations: [
        variacao({ id: 1, stockQuantity: 4 }),
        variacao({ id: 2, stockQuantity: 6, archivedAt: '2026-08-15 10:00:00' })
      ]
    })

    expect(estoqueAtivo(p)).toBe(4)
  })

  it('should_drop_archived_products_and_insumos_from_the_lists', () => {
    const arquivado = '2026-08-15 10:00:00'

    expect(produtosAtivos([produto({ id: 1 }), produto({ id: 2, archivedAt: arquivado })])).toEqual(
      [produto({ id: 1 })]
    )
    expect(insumosAtivos([insumo({ id: 1 }), insumo({ id: 2, archivedAt: arquivado })])).toEqual([
      insumo({ id: 1 })
    ])
  })
})
