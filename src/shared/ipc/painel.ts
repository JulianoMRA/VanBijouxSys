import { z } from 'zod'
import { dataSimplesSchema } from './comum'

/**
 * A tela do painel manda o período escolhido nos botões; `custom` vem com as duas
 * datas dos campos. O schema garante o formato; a recusa de data final sem inicial
 * continua no repositório, com a mensagem que a usuária lê.
 */
export const periodoDoPainelSchema = z.enum([
  'month',
  'quarter',
  'halfyear',
  'year',
  'all',
  'custom'
])

export const parametrosDoPainelSchema = z.object({
  period: periodoDoPainelSchema,
  customFrom: dataSimplesSchema.optional(),
  customTo: dataSimplesSchema.optional()
})

export const ARGUMENTOS_PAINEL = {
  getStats: [parametrosDoPainelSchema]
} as const

export type PeriodoDoPainel = z.infer<typeof periodoDoPainelSchema>
export type DashboardParams = z.input<typeof parametrosDoPainelSchema>

export interface DashboardStats {
  overview: {
    totalRevenue: number
    totalNetRevenue: number
    totalCost: number
    totalProfit: number
    totalSales: number
    avgTicket: number
    totalReceivable: number
  }
  previousOverview: {
    totalRevenue: number
    totalNetRevenue: number
    totalCost: number
    totalProfit: number
    totalSales: number
    avgTicket: number
  } | null
  revenueByMonth: Array<{ month: string; revenue: number; profit: number }>
  salesByChannel: Array<{ channel: string; revenue: number; profit: number; count: number }>
  salesByCategory: Array<{ category: string; revenue: number; quantity: number; count: number }>
  salesByFair: Array<{
    fairName: string
    date: string
    endDate: string | null
    revenue: number
    profit: number
    enrollmentCost: number
    additionalCosts: number
    netProfit: number
    dailyBreakdown: Array<{ day: string; revenue: number; salesCount: number }>
  }>
  topVariations: Array<{
    productName: string
    identifier: string
    quantity: number
    revenue: number
  }>
  outOfStock: Array<{
    id: number
    productName: string
    categoryName: string
    identifier: string
    stockQuantity: number
    minimumStock: number
  }>
  lowStock: Array<{
    id: number
    productName: string
    categoryName: string
    identifier: string
    stockQuantity: number
    minimumStock: number
  }>
  outOfInsumos: Array<{
    id: number
    name: string
    unit: string
    stockQuantity: number
    minimumStock: number
  }>
  lowInsumos: Array<{
    id: number
    name: string
    unit: string
    stockQuantity: number
    minimumStock: number
  }>
  cashFlow: Array<{ month: string; income: number; expenses: number }>
  cashSummary: {
    openingBalance: number
    totalIncome: number
    totalExpenses: number
    currentBalance: number
  }
}
