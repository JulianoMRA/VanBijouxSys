// Tipos de insumo vêm do contrato do canal, com os schemas que o main valida.
export type {
  CreateInsumoInput,
  Insumo,
  InsumoUnit,
  UpdateInsumoInput
} from '../../../shared/ipc/insumos'

// Tipos de produto e variação vêm do contrato dos canais de produtos.
export type {
  AjusteDeEstoque,
  Category,
  CreateProductInput,
  CreateVariationInput,
  DeleteVariationOptions,
  MotivoDeAjuste,
  Product,
  ProductVariation,
  UpdateProductInput,
  UpdateVariationInput,
  VariationInsumo
} from '../../../shared/ipc/produtos'

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

// Tipos de venda vêm do contrato dos canais de vendas.
export type {
  CreateSaleInput,
  CreateSaleItemInput,
  MarkSaleReceivedInput,
  PaymentMethod,
  Sale,
  SaleChannel,
  SaleItem,
  UpdateSaleInput
} from '../../../shared/ipc/vendas'

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
