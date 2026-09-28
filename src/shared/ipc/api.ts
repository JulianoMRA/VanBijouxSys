import type {
  BackupInfo,
  ErroDaTela,
  ResultadoDaExportacao,
  ResultadoDaRestauracao
} from './backup'
import type {
  CashExpense,
  CashSettings,
  CreateCashExpenseInput,
  CreateExpenseCategoryInput,
  ExpenseCategory,
  FiltroDeDespesas,
  UpdateCashExpenseInput,
  UpdateExpenseCategoryInput
} from './caixa'
import type { CreateFairInput, Fair, UpdateFairInput } from './feiras'
import type { CreateInsumoInput, Insumo, UpdateInsumoInput } from './insumos'
import type { DashboardParams, DashboardStats } from './painel'
import type {
  Category,
  CreateProductInput,
  CreateVariationInput,
  DeleteVariationOptions,
  Product,
  UpdateProductInput,
  UpdateVariationInput
} from './produtos'
import type { CreateSaleInput, RegisterPaymentInput, Sale, UpdateSaleInput } from './vendas'

type Ok = Promise<{ success: boolean }>
type Criado = Promise<{ id: number }>

/**
 * O `window.api` que o preload expõe, numa declaração só: o preload é conferido contra
 * ela e o renderer a usa como tipo global. As entradas são as dos schemas de cada
 * canal; as saídas, o que os handlers do processo principal devolvem.
 */
export interface ApiDoApp {
  categories: {
    getAll: () => Promise<Category[]>
  }
  products: {
    getAll: () => Promise<Product[]>
    create: (data: CreateProductInput) => Criado
    update: (data: UpdateProductInput) => Ok
    delete: (id: number) => Ok
    setArchived: (id: number, archived: boolean) => Ok
  }
  variations: {
    create: (data: CreateVariationInput) => Criado
    update: (data: UpdateVariationInput) => Ok
    delete: (id: number, opcoes?: DeleteVariationOptions) => Ok
    addStock: (id: number, quantity: number) => Ok
    setSalePrice: (id: number, salePrice: number) => Ok
    setArchived: (id: number, archived: boolean) => Ok
  }
  fairs: {
    getAll: () => Promise<Fair[]>
    create: (data: CreateFairInput) => Criado
    update: (data: UpdateFairInput) => Ok
    delete: (id: number) => Ok
  }
  sales: {
    getAll: () => Promise<Sale[]>
    create: (data: CreateSaleInput) => Criado
    update: (data: UpdateSaleInput) => Ok
    delete: (id: number) => Ok
    registerPayment: (data: RegisterPaymentInput) => Criado
    deletePayment: (id: number) => Ok
    unmarkAsReceived: (id: number) => Ok
  }
  dashboard: {
    getStats: (params: DashboardParams) => Promise<DashboardStats>
  }
  insumos: {
    getAll: () => Promise<Insumo[]>
    create: (data: CreateInsumoInput) => Criado
    update: (data: UpdateInsumoInput) => Ok
    addStock: (id: number, quantity: number) => Ok
    delete: (id: number) => Ok
    setArchived: (id: number, archived: boolean) => Ok
    exportCsv: (
      csvContent: string,
      defaultFileName: string
    ) => Promise<{ salvo: boolean; caminho?: string }>
  }
  expenseCategories: {
    getAll: () => Promise<ExpenseCategory[]>
    create: (data: CreateExpenseCategoryInput) => Criado
    update: (data: UpdateExpenseCategoryInput) => Ok
    delete: (id: number) => Ok
  }
  cashExpenses: {
    getAll: (filters?: FiltroDeDespesas) => Promise<CashExpense[]>
    create: (data: CreateCashExpenseInput) => Criado
    update: (data: UpdateCashExpenseInput) => Ok
    delete: (id: number) => Ok
  }
  cashSettings: {
    get: () => Promise<CashSettings>
    setOpeningBalance: (balance: number) => Ok
  }
  backup: {
    exportar: () => Promise<ResultadoDaExportacao>
    restaurar: () => Promise<ResultadoDaRestauracao>
    info: () => Promise<BackupInfo>
    abrirPasta: () => Promise<{ aberto: boolean }>
  }
  app: {
    versao: () => Promise<string>
    verificarAtualizacoes: () => Promise<{ atualizacaoDisponivel: boolean }>
    registrarErroDaTela: (erro: ErroDaTela) => Promise<{ registrado: boolean }>
  }
}
