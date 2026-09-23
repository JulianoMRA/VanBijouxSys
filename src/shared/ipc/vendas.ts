import { z } from 'zod'
import { normalizarNomeDaCliente } from '../clientes'
import { dataIsoSchema, dataSimplesSchema, idSchema } from './comum'

/**
 * Formatos que SaleForm, o modal Receber e a lista de Vendas enviam. O schema
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

/** No pagamento de uma venda a receber, a forma é a que entrou de fato. */
export const formaDePagamentoRecebidaSchema = formaDePagamentoSchema.exclude(['areceber'])

export const itemDaVendaSchema = z.object({
  variationId: idSchema,
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  /** Custo copiado da variação no momento da venda; o histórico não muda depois. */
  unitCost: z.number().nonnegative()
})

/**
 * Nome livre de quem comprou. Chega como foi digitado e sai normalizado; em
 * branco vira `null`. A obrigatoriedade na venda a receber (RN-16) é regra de
 * negócio e fica no repositório.
 */
export const nomeDaClienteSchema = z.string().max(100).nullish().transform(normalizarNomeDaCliente)

const camposDaVenda = {
  channel: canalDeVendaSchema,
  customerName: nomeDaClienteSchema,
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

/**
 * Pagamento de venda a receber (RN-17), parcial ou do que falta. A taxa em reais e
 * o líquido são calculados no repositório a partir do valor e da porcentagem.
 */
export const pagamentoSchema = z.object({
  saleId: idSchema,
  amount: z.number().positive(),
  paymentMethod: formaDePagamentoRecebidaSchema,
  feePercentage: z.number().min(0).max(100),
  receivedAt: dataSimplesSchema
})

export const ARGUMENTOS_VENDAS = {
  getAll: [],
  create: [novaVendaSchema],
  update: [vendaAtualizadaSchema],
  delete: [idSchema],
  registerPayment: [pagamentoSchema],
  deletePayment: [idSchema],
  /** Só desfaz recebimento gravado até a 1.14, na própria venda (received_at). */
  unmarkAsReceived: [idSchema]
} as const

export type SaleChannel = z.infer<typeof canalDeVendaSchema>
export type PaymentMethod = z.infer<typeof formaDePagamentoSchema>
export type ReceivedPaymentMethod = z.infer<typeof formaDePagamentoRecebidaSchema>
export type CreateSaleItemInput = z.input<typeof itemDaVendaSchema>
export type CreateSaleInput = z.input<typeof novaVendaSchema>
export type UpdateSaleInput = z.input<typeof vendaAtualizadaSchema>
export type RegisterPaymentInput = z.input<typeof pagamentoSchema>

export interface SalePayment {
  id: number
  /** Valor pago, antes da taxa. É ele que abate do que falta receber. */
  amount: number
  paymentMethod: ReceivedPaymentMethod
  feePercentage: number
  feeAmount: number
  /** O que entrou no caixa: valor menos a taxa. */
  netAmount: number
  receivedAt: string
}

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
  /** Nulo nas vendas sem cliente, inclusive todas as anteriores à migração 3. */
  customerName: string | null
  totalAmount: number
  totalCost: number
  paymentMethod: PaymentMethod
  feePercentage: number
  feeAmount: number
  netAmount: number
  soldAt: string
  /**
   * Data do recebimento gravado na própria venda, como a 1.14 fazia. Nulo nas vendas
   * pagas na hora e nas a receber, cujo recebimento fica em `payments`.
   */
  receivedAt: string | null
  items: SaleItem[]
  /** Pagamentos da venda a receber, do mais antigo para o mais recente. */
  payments: SalePayment[]
  /** RN-17. Total menos o que já foi pago, em centavos exatos; zero fora do a receber. */
  amountDue: number
}
