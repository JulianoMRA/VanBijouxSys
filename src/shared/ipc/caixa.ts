import { z } from 'zod'
import { dataIsoSchema, idSchema } from './comum'

/**
 * Formatos que a tela de Caixa e o ExpenseForm enviam. O schema garante tipo e
 * formato; o que é regra de negócio segue no repositório.
 */
export const novaCategoriaDeDespesaSchema = z.object({
  name: z.string().trim().min(1)
})

export const categoriaDeDespesaAtualizadaSchema = novaCategoriaDeDespesaSchema.extend({
  id: idSchema
})

const camposDaDespesa = {
  categoryId: idSchema,
  description: z.string().trim().min(1),
  amount: z.number().positive(),
  expenseDate: dataIsoSchema,
  notes: z.string().optional()
}

export const novaDespesaSchema = z.object(camposDaDespesa)

export const despesaAtualizadaSchema = z.object({ ...camposDaDespesa, id: idSchema })

/** A tela pede tudo; o filtro existe para relatórios por período e categoria. */
export const filtroDeDespesasSchema = z.object({
  startDate: dataIsoSchema.optional(),
  endDate: dataIsoSchema.optional(),
  categoryId: idSchema.optional()
})

export const filtroDeEstatisticasSchema = z.object({
  startDate: dataIsoSchema.optional(),
  endDate: dataIsoSchema.optional()
})

/** Quanto havia em caixa antes do app. A tela não aceita negativo. */
export const saldoDeAberturaSchema = z.number().nonnegative()

export const ARGUMENTOS_CATEGORIAS_DE_DESPESA = {
  getAll: [],
  create: [novaCategoriaDeDespesaSchema],
  update: [categoriaDeDespesaAtualizadaSchema],
  delete: [idSchema]
} as const

export const ARGUMENTOS_DESPESAS = {
  getAll: [filtroDeDespesasSchema.optional()],
  create: [novaDespesaSchema],
  update: [despesaAtualizadaSchema],
  delete: [idSchema],
  getStats: [filtroDeEstatisticasSchema.optional()]
} as const

export const ARGUMENTOS_CAIXA = {
  get: [],
  setOpeningBalance: [saldoDeAberturaSchema]
} as const

export type CreateExpenseCategoryInput = z.input<typeof novaCategoriaDeDespesaSchema>
export type UpdateExpenseCategoryInput = z.input<typeof categoriaDeDespesaAtualizadaSchema>
export type CreateCashExpenseInput = z.input<typeof novaDespesaSchema>
export type UpdateCashExpenseInput = z.input<typeof despesaAtualizadaSchema>
export type FiltroDeDespesas = z.input<typeof filtroDeDespesasSchema>
export type FiltroDeEstatisticas = z.input<typeof filtroDeEstatisticasSchema>

export interface ExpenseCategory {
  id: number
  name: string
  createdAt: string
}

export interface CashExpense {
  id: number
  categoryId: number
  categoryName: string
  description: string
  amount: number
  expenseDate: string
  notes: string | null
  createdAt: string
}

export interface CashSettings {
  id: number
  openingBalance: number
  updatedAt: string
}

export interface CashStats {
  totalExpenses: number
  totalIncome: number
  openingBalance: number
}
