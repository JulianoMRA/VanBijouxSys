export type InsumoUnit = 'cm' | 'g' | 'unidade'

export interface Insumo {
  id: number
  name: string
  unit: InsumoUnit
  costPerUnit: number
  stockQuantity: number
  minimumStock: number
  createdAt: string
}

export interface VariationInsumo {
  id: number
  variationId: number
  insumoId: number
  insumoName: string
  unit: InsumoUnit
  costPerUnit: number
  quantity: number
}

export type CreateInsumoInput = {
  name: string
  unit: InsumoUnit
  costPerUnit: number
  stockQuantity: number
  minimumStock: number
}

export type UpdateInsumoInput = CreateInsumoInput & { id: number }

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
  insumos: VariationInsumo[]
}

export interface Product {
  id: number
  name: string
  categoryId: number
  categoryName: string
  description: string | null
  createdAt: string
  variations: ProductVariation[]
}

export type CreateProductInput = {
  name: string
  categoryId: number
  description?: string
}

export type UpdateProductInput = CreateProductInput & { id: number }

export type CreateVariationInput = {
  productId: number
  identifier: string
  costPrice: number
  salePrice: number
  stockQuantity: number
  minimumStock: number
  laborCost: number
  insumos?: { insumoId: number; quantity: number }[]
}

export type UpdateVariationInput = CreateVariationInput & { id: number }

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

export type PaymentMethod = 'dinheiro' | 'pix' | 'debito' | 'credito'

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
  items: SaleItem[]
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
  }
  revenueByMonth: Array<{ month: string; revenue: number; profit: number }>
  salesByChannel: Array<{ channel: string; revenue: number; profit: number; count: number }>
  salesByFair: Array<{
    fairName: string
    date: string
    endDate: string | null
    revenue: number
    profit: number
    enrollmentCost: number
    additionalCosts: number
    netProfit: number
  }>
  topVariations: Array<{
    productName: string
    identifier: string
    quantity: number
    revenue: number
  }>
  lowStock: Array<{
    id: number
    productName: string
    categoryName: string
    identifier: string
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
