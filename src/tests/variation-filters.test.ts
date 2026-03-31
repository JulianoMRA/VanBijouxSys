import { describe, it, expect } from 'vitest'
import { filterAndSortVariations, VariationFilterParams } from '../renderer/src/utils/variation-filters'
import type { ProductVariation } from '../renderer/src/types'

function makeVariation(overrides: Partial<ProductVariation> & { id: number; identifier: string }): ProductVariation {
  return {
    productId: 1,
    costPrice: 10,
    salePrice: 25,
    stockQuantity: 5,
    minimumStock: 3,
    laborCost: 0,
    createdAt: '2025-01-01',
    insumos: [],
    ...overrides
  }
}

const defaultParams: VariationFilterParams = {
  search: '',
  stockFilter: 'todos',
  priceMin: '',
  priceMax: '',
  sortBy: 'recente'
}

const variations: ProductVariation[] = [
  makeVariation({ id: 1, identifier: 'Rosa', salePrice: 15, stockQuantity: 0, minimumStock: 2 }),
  makeVariation({ id: 2, identifier: 'Dourado', salePrice: 30, stockQuantity: 1, minimumStock: 3 }),
  makeVariation({ id: 3, identifier: 'Azul', salePrice: 20, stockQuantity: 10, minimumStock: 5 }),
  makeVariation({ id: 4, identifier: 'Prata', salePrice: 50, stockQuantity: 5, minimumStock: 2 }),
]

describe('filterAndSortVariations', () => {
  describe('pesquisa por identificador', () => {
    it('should filter by identifier case-insensitively', () => {
      const result = filterAndSortVariations(variations, { ...defaultParams, search: 'rosa' })
      expect(result).toHaveLength(1)
      expect(result[0].identifier).toBe('Rosa')
    })

    it('should return all when search is empty', () => {
      const result = filterAndSortVariations(variations, { ...defaultParams, search: '' })
      expect(result).toHaveLength(4)
    })

    it('should match partial identifier', () => {
      const result = filterAndSortVariations(variations, { ...defaultParams, search: 'do' })
      expect(result).toHaveLength(1)
      expect(result[0].identifier).toBe('Dourado')
    })

    it('should return empty when no match', () => {
      const result = filterAndSortVariations(variations, { ...defaultParams, search: 'verde' })
      expect(result).toHaveLength(0)
    })
  })

  describe('filtro por estoque', () => {
    it('should filter sem-estoque (quantity === 0)', () => {
      const result = filterAndSortVariations(variations, { ...defaultParams, stockFilter: 'sem-estoque' })
      expect(result).toHaveLength(1)
      expect(result[0].identifier).toBe('Rosa')
    })

    it('should filter estoque-baixo (quantity > 0 and < minimum)', () => {
      const result = filterAndSortVariations(variations, { ...defaultParams, stockFilter: 'estoque-baixo' })
      expect(result).toHaveLength(1)
      expect(result[0].identifier).toBe('Dourado')
    })

    it('should filter estoque normal (quantity >= minimum)', () => {
      const result = filterAndSortVariations(variations, { ...defaultParams, stockFilter: 'normal' })
      expect(result).toHaveLength(2)
      const ids = result.map((v) => v.identifier)
      expect(ids).toContain('Azul')
      expect(ids).toContain('Prata')
    })

    it('should return all when filter is todos', () => {
      const result = filterAndSortVariations(variations, { ...defaultParams, stockFilter: 'todos' })
      expect(result).toHaveLength(4)
    })
  })

  describe('filtro por faixa de preço', () => {
    it('should filter by minimum price', () => {
      const result = filterAndSortVariations(variations, { ...defaultParams, priceMin: '25' })
      expect(result).toHaveLength(2)
      result.forEach((v) => expect(v.salePrice).toBeGreaterThanOrEqual(25))
    })

    it('should filter by maximum price', () => {
      const result = filterAndSortVariations(variations, { ...defaultParams, priceMax: '20' })
      expect(result).toHaveLength(2)
      result.forEach((v) => expect(v.salePrice).toBeLessThanOrEqual(20))
    })

    it('should filter by price range', () => {
      const result = filterAndSortVariations(variations, { ...defaultParams, priceMin: '20', priceMax: '35' })
      expect(result).toHaveLength(2)
      const ids = result.map((v) => v.identifier)
      expect(ids).toContain('Azul')
      expect(ids).toContain('Dourado')
    })

    it('should ignore empty price strings', () => {
      const result = filterAndSortVariations(variations, { ...defaultParams, priceMin: '', priceMax: '' })
      expect(result).toHaveLength(4)
    })
  })

  describe('ordenação', () => {
    it('should sort by most recent (id desc) by default', () => {
      const result = filterAndSortVariations(variations, { ...defaultParams, sortBy: 'recente' })
      expect(result.map((v) => v.id)).toEqual([4, 3, 2, 1])
    })

    it('should sort by name A→Z', () => {
      const result = filterAndSortVariations(variations, { ...defaultParams, sortBy: 'nome-az' })
      expect(result.map((v) => v.identifier)).toEqual(['Azul', 'Dourado', 'Prata', 'Rosa'])
    })

    it('should sort by name Z→A', () => {
      const result = filterAndSortVariations(variations, { ...defaultParams, sortBy: 'nome-za' })
      expect(result.map((v) => v.identifier)).toEqual(['Rosa', 'Prata', 'Dourado', 'Azul'])
    })

    it('should sort by highest price first', () => {
      const result = filterAndSortVariations(variations, { ...defaultParams, sortBy: 'preco-maior' })
      expect(result.map((v) => v.salePrice)).toEqual([50, 30, 20, 15])
    })

    it('should sort by lowest price first', () => {
      const result = filterAndSortVariations(variations, { ...defaultParams, sortBy: 'preco-menor' })
      expect(result.map((v) => v.salePrice)).toEqual([15, 20, 30, 50])
    })

    it('should sort by highest stock first', () => {
      const result = filterAndSortVariations(variations, { ...defaultParams, sortBy: 'estoque-maior' })
      expect(result.map((v) => v.stockQuantity)).toEqual([10, 5, 1, 0])
    })

    it('should sort by lowest stock first', () => {
      const result = filterAndSortVariations(variations, { ...defaultParams, sortBy: 'estoque-menor' })
      expect(result.map((v) => v.stockQuantity)).toEqual([0, 1, 5, 10])
    })
  })

  describe('filtros combinados', () => {
    it('should combine search + stock filter', () => {
      const allNormal = filterAndSortVariations(variations, {
        ...defaultParams,
        search: 'a',
        stockFilter: 'normal'
      })
      expect(allNormal).toHaveLength(2)
      expect(allNormal.map((v) => v.identifier)).toContain('Prata')
      expect(allNormal.map((v) => v.identifier)).toContain('Azul')
    })

    it('should combine price range + sorting', () => {
      const result = filterAndSortVariations(variations, {
        ...defaultParams,
        priceMin: '15',
        priceMax: '30',
        sortBy: 'preco-menor'
      })
      expect(result.map((v) => v.salePrice)).toEqual([15, 20, 30])
    })

    it('should return empty when all filters exclude everything', () => {
      const result = filterAndSortVariations(variations, {
        ...defaultParams,
        search: 'Rosa',
        stockFilter: 'normal'
      })
      expect(result).toHaveLength(0)
    })
  })
})
