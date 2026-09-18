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

// Tipos de feira vêm do contrato dos canais de feiras.
export type {
  CreateFairInput,
  Fair,
  FairAdditionalCost,
  UpdateFairInput
} from '../../../shared/ipc/feiras'

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

// Tipos de caixa vêm do contrato dos canais de despesas e configurações.
export type {
  CashExpense,
  CashSettings,
  CashStats,
  CreateCashExpenseInput,
  CreateExpenseCategoryInput,
  ExpenseCategory,
  UpdateCashExpenseInput,
  UpdateExpenseCategoryInput
} from '../../../shared/ipc/caixa'

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
