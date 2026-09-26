import { z } from 'zod'
import { idSchema } from './comum'

export const unidadeDeInsumoSchema = z.enum(['cm', 'g', 'unidade'])

/**
 * Formato que o InsumoForm envia. Os limites são os que o formulário já garante; o
 * estoque aceita negativo porque a edição pode manter um saldo negativo já salvo.
 * `z.number()` recusa NaN e Infinity.
 */
export const novoInsumoSchema = z.object({
  name: z.string().trim().min(1),
  unit: unidadeDeInsumoSchema,
  costPerUnit: z.number().nonnegative(),
  stockQuantity: z.number(),
  minimumStock: z.number().nonnegative()
})

export const insumoAtualizadoSchema = novoInsumoSchema.extend({ id: idSchema })

/** Argumentos de cada canal de insumos, na ordem em que o preload os envia. */
export const ARGUMENTOS_INSUMOS = {
  getAll: [],
  create: [novoInsumoSchema],
  update: [insumoAtualizadoSchema],
  addStock: [idSchema, z.number().positive()],
  delete: [idSchema],
  setArchived: [idSchema, z.boolean()],
  exportCsv: [z.string(), z.string().min(1)]
} as const

export type InsumoUnit = z.infer<typeof unidadeDeInsumoSchema>
export type CreateInsumoInput = z.input<typeof novoInsumoSchema>
export type UpdateInsumoInput = z.input<typeof insumoAtualizadoSchema>

export interface Insumo {
  id: number
  name: string
  unit: InsumoUnit
  costPerUnit: number
  stockQuantity: number
  minimumStock: number
  createdAt: string
  /** Nulo = ativo. Arquivado sai dos alertas, da lista e dos seletores. */
  archivedAt: string | null
  /** Quantas variações ativas usam este insumo — alimenta o aviso ao arquivar. */
  usadoPorVariacoesAtivas: number
  /**
   * RN-05. Quantas receitas usam este insumo, de variação ativa ou arquivada: com
   * qualquer uma, a unidade não muda, porque a variação arquivada pode voltar.
   */
  usadoEmReceitas: number
}
