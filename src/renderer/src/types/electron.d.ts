import type {
  Category,
  Product,
  ProductVariation,
  CreateProductInput,
  UpdateProductInput,
  CreateVariationInput,
  UpdateVariationInput,
  Fair,
  CreateFairInput,
  UpdateFairInput,
  Sale,
  CreateSaleInput,
  DashboardStats,
  Insumo,
  CreateInsumoInput,
  UpdateInsumoInput,
  ExpenseCategory,
  CreateExpenseCategoryInput,
  UpdateExpenseCategoryInput,
  CashExpense,
  CreateCashExpenseInput,
  UpdateCashExpenseInput,
  CashSettings
} from '.'

declare global {
  interface Window {
    api: {
      categories: {
        getAll: () => Promise<Category[]>
      }
      products: {
        getAll: () => Promise<Product[]>
        create: (data: CreateProductInput) => Promise<{ id: number }>
        update: (data: UpdateProductInput) => Promise<{ success: boolean }>
        delete: (id: number) => Promise<{ success: boolean }>
      }
      variations: {
        create: (data: CreateVariationInput) => Promise<{ id: number }>
        update: (data: UpdateVariationInput) => Promise<{ success: boolean }>
        delete: (id: number) => Promise<{ success: boolean }>
        addStock: (id: number, quantity: number) => Promise<{ success: boolean }>
      }
      fairs: {
        getAll: () => Promise<Fair[]>
        create: (data: CreateFairInput) => Promise<{ id: number }>
        update: (data: UpdateFairInput) => Promise<{ success: boolean }>
        delete: (id: number) => Promise<{ success: boolean }>
      }
      sales: {
        getAll: () => Promise<Sale[]>
        create: (data: CreateSaleInput) => Promise<{ id: number }>
        delete: (id: number) => Promise<{ success: boolean }>
      }
      dashboard: {
        getStats: (fromDate: string | null) => Promise<DashboardStats>
      }
      insumos: {
        getAll: () => Promise<Insumo[]>
        create: (data: CreateInsumoInput) => Promise<{ id: number }>
        update: (data: UpdateInsumoInput) => Promise<{ success: boolean }>
        addStock: (id: number, quantity: number) => Promise<{ success: boolean }>
        delete: (id: number) => Promise<{ success: boolean; error?: string }>
        exportCsv: (csvContent: string, defaultFileName: string) => Promise<{ success: boolean; filePath?: string; cancelled?: boolean; error?: string }>
      }
      expenseCategories: {
        getAll: () => Promise<ExpenseCategory[]>
        create: (data: CreateExpenseCategoryInput) => Promise<{ id: number }>
        update: (data: UpdateExpenseCategoryInput) => Promise<{ success: boolean }>
        delete: (id: number) => Promise<{ success: boolean }>
      }
      cashExpenses: {
        getAll: (filters?: { startDate?: string; endDate?: string; categoryId?: number }) => Promise<CashExpense[]>
        create: (data: CreateCashExpenseInput) => Promise<{ id: number }>
        update: (data: UpdateCashExpenseInput) => Promise<{ success: boolean }>
        delete: (id: number) => Promise<{ success: boolean }>
        getStats: (filters?: { startDate?: string; endDate?: string }) => Promise<{
          totalExpenses: number
          totalIncome: number
          openingBalance: number
        }>
      }
      cashSettings: {
        get: () => Promise<CashSettings>
        setOpeningBalance: (balance: number) => Promise<{ success: boolean }>
      }
    }
  }
}
