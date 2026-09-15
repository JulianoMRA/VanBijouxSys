import type { InsumoUnit } from '../../../shared/ipc/insumos'

// Tipos de insumo vêm do contrato do canal, com os schemas que o main valida.
export type {
  CreateInsumoInput,
  Insumo,
  InsumoUnit,
  UpdateInsumoInput
} from '../../../shared/ipc/insumos'

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

export interface Category {
  id: number
  name: string
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

export type CreateProductInput = {
  name: string
  categoryId: number
  description?: string
}

export type UpdateProductInput = CreateProductInput & { id: number }

/**
 * Por que o estoque de peças mudou. Só `producao` mexe nos insumos: peças a mais
 * consomem a receita, peças a menos devolvem. `contagem` corrige o número sem
 * tocar neles — peças que já estavam prontas, perdidas ou contadas errado.
 */
export type MotivoDeAjuste = 'producao' | 'contagem'

export interface AjusteDeEstoque {
  novoEstoque: number
  motivo: MotivoDeAjuste
}

export type CreateVariationInput = {
  productId: number
  identifier: string
  costPrice: number
  salePrice: number
  stockQuantity: number
  /** Só tem efeito com estoque inicial acima de zero. */
  motivoDoEstoqueInicial: MotivoDeAjuste
  minimumStock: number
  laborCost: number
  /** Obrigatória: o update substitui a receita inteira pelo que vier aqui. */
  insumos: { insumoId: number; quantity: number }[]
}

export type UpdateVariationInput = Omit<
  CreateVariationInput,
  'stockQuantity' | 'motivoDoEstoqueInicial'
> & {
  id: number
  /** Ausente quando o estoque não mudou no formulário. */
  ajusteDeEstoque?: AjusteDeEstoque
}

export interface DeleteVariationOptions {
  /** Devolve aos insumos o que a receita usa para as peças em estoque. */
  devolverInsumos: boolean
}

export interface FairAdditionalCost {
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
  endDate: string | null
  enrollmentCost: number
  additionalCosts: FairAdditionalCost[]
  createdAt: string
}

export type CreateFairInput = {
  name: string
  location: string
  organizer?: string
  date: string
  endDate?: string
  enrollmentCost: number
  additionalCosts: { description: string; amount: number }[]
}

export type UpdateFairInput = CreateFairInput & { id: number }

export type SaleChannel = 'Feira' | 'WhatsApp' | 'Instagram' | 'Outro'

export type PaymentMethod = 'dinheiro' | 'pix' | 'debito' | 'credito' | 'areceber'

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
  receivedAt: string | null
  items: SaleItem[]
}

export interface MarkSaleReceivedInput {
  id: number
  paymentMethod: Exclude<PaymentMethod, 'areceber'>
  feePercentage: number
  feeAmount: number
  netAmount: number
  receivedAt: string
}

export interface CreateSaleItemInput {
  variationId: number
  quantity: number
  unitPrice: number
  unitCost: number
}

export interface CreateSaleInput {
  channel: SaleChannel
  fairId?: number
  soldAt: string
  paymentMethod: PaymentMethod
  feePercentage: number
  feeAmount: number
  netAmount: number
  items: CreateSaleItemInput[]
}

export type UpdateSaleInput = CreateSaleInput & { id: number }

export interface ExpenseCategory {
  id: number
  name: string
  createdAt: string
}

export type CreateExpenseCategoryInput = {
  name: string
}

export type UpdateExpenseCategoryInput = CreateExpenseCategoryInput & { id: number }

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

export type CreateCashExpenseInput = {
  categoryId: number
  description: string
  amount: number
  expenseDate: string
  notes?: string
}

export type UpdateCashExpenseInput = CreateCashExpenseInput & { id: number }

export interface CashSettings {
  id: number
  openingBalance: number
  updatedAt: string
}

export interface CashSummary {
  openingBalance: number
  totalIncome: number
  totalExpenses: number
  currentBalance: number
}

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
