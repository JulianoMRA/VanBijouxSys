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

/**
 * Opções de um seletor: o que está ativo, mais o que já estava escolhido.
 *
 * A segunda parte não é detalhe. Sem ela, editar uma venda antiga que contém
 * uma variação arquivada depois faria o item sumir da lista — e a venda seria
 * salva sem ele, em silêncio.
 */
export function opcoesComSelecionados<T extends Arquivavel & { id: number }>(
  todos: T[],
  jaSelecionados: number[]
): T[] {
  return todos.filter((item) => !estaArquivado(item) || jaSelecionados.includes(item.id))
}

/**
 * Arquivar insumo em uso é permitido — ela decide. Mas não em silêncio: o
 * texto diz o que ainda depende dele antes de confirmar.
 */
export function mensagemDeArquivamento(insumo: Insumo, unidade: string): string {
  const partes: string[] = []

  const usos = insumo.usadoPorVariacoesAtivas
  if (usos > 0) {
    partes.push(
      `é usado em ${usos} variaç${usos !== 1 ? 'ões' : 'ão'} ativa${usos !== 1 ? 's' : ''}`
    )
  }
  if (insumo.stockQuantity > 0) {
    partes.push(`ainda tem ${insumo.stockQuantity.toLocaleString('pt-BR')} ${unidade} em estoque`)
  }

  return `"${insumo.name}" ${partes.join(' e ')}. Arquivar tira ele dos avisos e dos seletores de receita; as receitas que já usam continuam valendo, e dá para desarquivar depois.`
}

/** Estoque somado de um produto, ignorando o que está arquivado. */
export function estoqueAtivo(produto: Product): number {
  return variacoesAtivas(produto).reduce((total, v) => total + v.stockQuantity, 0)
}
