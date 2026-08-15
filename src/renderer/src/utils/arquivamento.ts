import type { Insumo, Product, ProductVariation } from '../types'

interface Arquivavel {
  archivedAt: string | null
}

/** Nulo = ativo. */
export function estaArquivado(item: Arquivavel): boolean {
  return item.archivedAt !== null
}

/**
 * Uma variação está inativa quando ela própria foi arquivada ou quando o
 * produto dela foi. Arquivar o produto não escreve nas variações — é o mesmo
 * critério do SQL, e o motivo é poder desarquivar sem ressuscitar variação que
 * já estava arquivada sozinha.
 */
export function variacaoInativa(produto: Product, variacao: ProductVariation): boolean {
  return estaArquivado(produto) || estaArquivado(variacao)
}

export function variacoesAtivas(produto: Product): ProductVariation[] {
  if (estaArquivado(produto)) return []
  return produto.variations.filter((v) => !estaArquivado(v))
}

export function produtosAtivos(produtos: Product[]): Product[] {
  return produtos.filter((p) => !estaArquivado(p))
}

export function insumosAtivos(lista: Insumo[]): Insumo[] {
  return lista.filter((i) => !estaArquivado(i))
}

/**
 * Contagens que alimentam os avisos das telas. Item arquivado não entra —
 * é o ponto da funcionalidade.
 */
export function contarAlertasDeEstoque(produtos: Product[]): {
  esgotadas: number
  abaixoDoMinimo: number
} {
  const ativas = produtosAtivos(produtos).flatMap(variacoesAtivas)
  return {
    esgotadas: ativas.filter((v) => v.stockQuantity === 0).length,
    abaixoDoMinimo: ativas.filter((v) => v.stockQuantity > 0 && v.stockQuantity < v.minimumStock)
      .length
  }
}

/** Estoque somado de um produto, ignorando o que está arquivado. */
export function estoqueAtivo(produto: Product): number {
  return variacoesAtivas(produto).reduce((total, v) => total + v.stockQuantity, 0)
}
