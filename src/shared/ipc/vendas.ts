import { z } from 'zod'
import { idSchema } from './comum'

/**
 * Formatos que SaleForm, MarkReceivedModal e a lista de Vendas enviam. O schema
 * garante tipo e formato; o que é regra de negócio segue no repositório.
 */
export const canalDeVendaSchema = z.enum(['Feira', 'WhatsApp', 'Instagram', 'Outro'])

export const formaDePagamentoSchema = z.enum([
  'dinheiro',
  'pix',
  'debito',
  'credito',
  /** Venda fiada: entra no total, mas fica fora do caixa até ser recebida. */
  'areceber'
])

/** Ao marcar como recebida, a forma escolhida é a que entrou de fato. */
export const formaDePagamentoRecebidaSchema = formaDePagamentoSchema.exclude(['areceber'])

/**
 * `AAAA-MM-DD`, como os campos `<input type="date">` mandam, ou com a hora que o
 * próprio SQLite gravou (`AAAA-MM-DD HH:MM:SS`) nas vendas antigas, que o painel
 * ainda lê. O texto vai direto para o banco e é comparado como texto nos
 * relatórios, então formato errado estraga mês, feira e contas a receber.
 */
export const dataIsoSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/)

export const itemDaVendaSchema = z.object({
  variationId: idSchema,
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  /** Custo copiado da variação no momento da venda; o histórico não muda depois. */
  unitCost: z.number().nonnegative()
})

const camposDaVenda = {
  channel: canalDeVendaSchema,
  /** Só vem preenchido quando o canal é Feira. */
  fairId: idSchema.optional(),
  soldAt: dataIsoSchema,
  paymentMethod: formaDePagamentoSchema,
  feePercentage: z.number().min(0).max(100),
  feeAmount: z.number().nonnegative(),
  /** Total menos a taxa. Calculado na tela e conferido aqui só como número. */
  netAmount: z.number(),
  items: z.array(itemDaVendaSchema).min(1)
}

export const novaVendaSchema = z.object(camposDaVenda)

export const vendaAtualizadaSchema = z.object({ ...camposDaVenda, id: idSchema })

export const recebimentoSchema = z.object({
  id: idSchema,
  paymentMethod: formaDePagamentoRecebidaSchema,
  feePercentage: z.number().min(0).max(100),
  feeAmount: z.number().nonnegative(),
  netAmount: z.number(),
  receivedAt: dataIsoSchema
})

export const ARGUMENTOS_VENDAS = {
  getAll: [],
  create: [novaVendaSchema],
  update: [vendaAtualizadaSchema],
  delete: [idSchema],
  markAsReceived: [recebimentoSchema],
  unmarkAsReceived: [idSchema]
} as const

export type SaleChannel = z.infer<typeof canalDeVendaSchema>
export type PaymentMethod = z.infer<typeof formaDePagamentoSchema>
export type CreateSaleItemInput = z.input<typeof itemDaVendaSchema>
export type CreateSaleInput = z.input<typeof novaVendaSchema>
export type UpdateSaleInput = z.input<typeof vendaAtualizadaSchema>
export type MarkSaleReceivedInput = z.input<typeof recebimentoSchema>

export interface SaleItem {
  id: number
  variationId: number
  variationIdentifier: string
  productName: string
  quantity: number
  unitPrice: number
  unitCost: number
}

export interface Sale {
  id: number
  channel: SaleChannel
  fairId: number | null
  fairName: string | null
  totalAmount: number
  totalCost: number
  paymentMethod: PaymentMethod
  feePercentage: number
  feeAmount: number
  netAmount: number
  soldAt: string
  /** Nulo enquanto a venda a receber não foi paga. */
  receivedAt: string | null
  items: SaleItem[]
}
