import { z } from 'zod'
import { dataIsoSchema, idSchema } from './comum'

/**
 * Formatos que o FairForm e a tela de Feiras enviam. O schema garante tipo e
 * formato; as mensagens que a usuária já lê (nome, local, data de início e
 * valores inválidos) continuam no formulário, antes da chamada.
 */
export const custoAdicionalSchema = z.object({
  description: z.string().trim().min(1),
  amount: z.number().nonnegative()
})

const camposDaFeira = {
  name: z.string().trim().min(1),
  location: z.string().trim().min(1),
  organizer: z.string().optional(),
  date: dataIsoSchema,
  /** Só vem quando a feira dura mais de um dia. */
  endDate: dataIsoSchema.optional(),
  enrollmentCost: z.number().nonnegative(),
  /** Obrigatória: o update substitui a lista inteira pelo que vier aqui. */
  additionalCosts: z.array(custoAdicionalSchema)
}

export const novaFeiraSchema = z.object(camposDaFeira)

export const feiraAtualizadaSchema = z.object({ ...camposDaFeira, id: idSchema })

export const ARGUMENTOS_FEIRAS = {
  getAll: [],
  create: [novaFeiraSchema],
  update: [feiraAtualizadaSchema],
  delete: [idSchema]
} as const

export type CreateFairInput = z.input<typeof novaFeiraSchema>
export type UpdateFairInput = z.input<typeof feiraAtualizadaSchema>

export interface FairAdditionalCost {
  /** Ausentes no que a tela monta; presentes no que vem do banco. */
  id?: number
  fairId?: number
  description: string
  amount: number
}

export interface Fair {
  id: number
  name: string
  location: string
  organizer: string | null
  date: string
  /** Nulo em feira de um dia só. */
  endDate: string | null
  enrollmentCost: number
  additionalCosts: FairAdditionalCost[]
  createdAt: string
}
