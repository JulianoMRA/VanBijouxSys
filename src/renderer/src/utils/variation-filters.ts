import type { ProductVariation } from '../types'

export type VariationSortOption =
  | 'recente'
  | 'nome-az'
  | 'nome-za'
  | 'preco-maior'
  | 'preco-menor'
  | 'estoque-maior'
  | 'estoque-menor'

export type VariationStockFilter = 'todos' | 'sem-estoque' | 'estoque-baixo' | 'normal'

export interface VariationFilterParams {
  search: string
  stockFilter: VariationStockFilter
  priceMin: string
  priceMax: string
  sortBy: VariationSortOption
}

export function filterAndSortVariations(
  variations: ProductVariation[],
  params: VariationFilterParams
): ProductVariation[] {
  const { search, stockFilter, priceMin, priceMax, sortBy } = params
  const parsedMin = priceMin === '' ? null : Number(priceMin)
  const parsedMax = priceMax === '' ? null : Number(priceMax)

  const result = variations.filter((v) => {
    const matchesSearch = v.identifier.toLowerCase().includes(search.toLowerCase())

    let matchesStock = true
    if (stockFilter === 'sem-estoque') matchesStock = v.stockQuantity === 0
    else if (stockFilter === 'estoque-baixo') matchesStock = v.stockQuantity > 0 && v.stockQuantity < v.minimumStock
    else if (stockFilter === 'normal') matchesStock = v.stockQuantity >= v.minimumStock

    const matchesPriceMin = parsedMin === null || v.salePrice >= parsedMin
    const matchesPriceMax = parsedMax === null || v.salePrice <= parsedMax

    return matchesSearch && matchesStock && matchesPriceMin && matchesPriceMax
  })

  return [...result].sort((a, b) => {
    switch (sortBy) {
      case 'nome-az': return a.identifier.localeCompare(b.identifier, 'pt-BR')
      case 'nome-za': return b.identifier.localeCompare(a.identifier, 'pt-BR')
      case 'preco-maior': return b.salePrice - a.salePrice
      case 'preco-menor': return a.salePrice - b.salePrice
      case 'estoque-maior': return b.stockQuantity - a.stockQuantity
      case 'estoque-menor': return a.stockQuantity - b.stockQuantity
      case 'recente': return b.id - a.id
      default: return 0
    }
  })
}
