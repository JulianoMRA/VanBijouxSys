import { z } from 'zod'
import { idSchema } from './comum'
import type { InsumoUnit } from './insumos'

/**
 * Formatos que ProductForm, VariationForm, AddStockForm, Products e PriceCalculator
 * enviam. O schema garante tipo e formato; regra que já tinha mensagem própria
 * para a usuária (estoque de peças inteiro e não negativo, preço não negativo)
 * continua no repositório, com o mesmo texto.
 */
export const novoProdutoSchema = z.object({
  name: z.string().trim().min(1),
  categoryId: idSchema,
  description: z.string().optional()
})

export const produtoAtualizadoSchema = novoProdutoSchema.extend({ id: idSchema })

/**
 * Por que o estoque de peças mudou. Só `producao` mexe nos insumos: peças a mais
 * consomem a receita, peças a menos devolvem. `contagem` corrige o número sem
 * tocar neles — peças que já estavam prontas, perdidas ou contadas errado.
 */
export const motivoDeAjusteSchema = z.enum(['producao', 'contagem'])

export const itemDeReceitaSchema = z.object({
  insumoId: idSchema,
  quantity: z.number().positive()
})

const camposDaVariacao = {
  productId: idSchema,
  identifier: z.string().trim().min(1),
  costPrice: z.number().nonnegative(),
  salePrice: z.number().nonnegative(),
  minimumStock: z.number().int().nonnegative(),
  laborCost: z.number().nonnegative(),
  /** Obrigatória: o update substitui a receita inteira pelo que vier aqui. */
  insumos: z.array(itemDeReceitaSchema)
}

export const novaVariacaoSchema = z.object({
  ...camposDaVariacao,
  stockQuantity: z.number(),
  /** Só tem efeito com estoque inicial acima de zero. */
  motivoDoEstoqueInicial: motivoDeAjusteSchema
})

export const ajusteDeEstoqueSchema = z.object({
  novoEstoque: z.number(),
  motivo: motivoDeAjusteSchema
})

export const variacaoAtualizadaSchema = z.object({
  ...camposDaVariacao,
  id: idSchema,
  /** Ausente quando o estoque não mudou no formulário. */
  ajusteDeEstoque: ajusteDeEstoqueSchema.optional()
})

export const opcoesDeExclusaoSchema = z.object({
  /** Devolve aos insumos o que a receita usa para as peças em estoque. */
  devolverInsumos: z.boolean()
})

export const ARGUMENTOS_CATEGORIAS = {
  getAll: []
} as const

export const ARGUMENTOS_PRODUTOS = {
  getAll: [],
  create: [novoProdutoSchema],
  update: [produtoAtualizadoSchema],
  delete: [idSchema],
  setArchived: [idSchema, z.boolean()]
} as const

export const ARGUMENTOS_VARIACOES = {
  create: [novaVariacaoSchema],
  update: [variacaoAtualizadaSchema],
  delete: [idSchema, opcoesDeExclusaoSchema.optional()],
  addStock: [idSchema, z.number().int().positive()],
  setSalePrice: [idSchema, z.number()],
  setArchived: [idSchema, z.boolean()]
} as const

export type CreateProductInput = z.input<typeof novoProdutoSchema>
export type UpdateProductInput = z.input<typeof produtoAtualizadoSchema>
export type MotivoDeAjuste = z.infer<typeof motivoDeAjusteSchema>
export type AjusteDeEstoque = z.input<typeof ajusteDeEstoqueSchema>
export type CreateVariationInput = z.input<typeof novaVariacaoSchema>
export type UpdateVariationInput = z.input<typeof variacaoAtualizadaSchema>
export type DeleteVariationOptions = z.input<typeof opcoesDeExclusaoSchema>

export interface Category {
  id: number
  name: string
}

export interface VariationInsumo {
  id: number
  variationId: number
  insumoId: number
  insumoName: string
  unit: InsumoUnit
  costPerUnit: number
  quantity: number
  /** Arquivamento do insumo em si, não do vínculo com a variação. */
  archivedAt: string | null
}

export interface ProductVariation {
  id: number
  productId: number
  identifier: string
  costPrice: number
  salePrice: number
  stockQuantity: number
  minimumStock: number
  laborCost: number
  createdAt: string
  /** Nulo = ativa. O produto arquivado também inativa a variação. */
  archivedAt: string | null
  insumos: VariationInsumo[]
}

export interface Product {
  id: number
  name: string
  categoryId: number
  categoryName: string
  description: string | null
  createdAt: string
  /** Nulo = ativo. Arquivar o produto inativa as variações por derivação. */
  archivedAt: string | null
  variations: ProductVariation[]
}
