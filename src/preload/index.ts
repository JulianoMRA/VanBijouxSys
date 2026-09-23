import { contextBridge, ipcRenderer } from 'electron'
import { CANAIS_IPC } from '../shared/ipc/channels'
import type { CreateFairInput, UpdateFairInput } from '../shared/ipc/feiras'
import type { DashboardParams } from '../shared/ipc/painel'
import type {
  CreateCashExpenseInput,
  CreateExpenseCategoryInput,
  FiltroDeDespesas,
  FiltroDeEstatisticas,
  UpdateCashExpenseInput,
  UpdateExpenseCategoryInput
} from '../shared/ipc/caixa'
import type { CreateInsumoInput, UpdateInsumoInput } from '../shared/ipc/insumos'
import type { CreateSaleInput, RegisterPaymentInput, UpdateSaleInput } from '../shared/ipc/vendas'
import type {
  CreateProductInput,
  CreateVariationInput,
  DeleteVariationOptions,
  UpdateProductInput,
  UpdateVariationInput
} from '../shared/ipc/produtos'

/**
 * O Electron embrulha a mensagem original em "Error invoking remote method
 * 'canal': Error: ...". Sem limpar isso, o texto técnico chega à tela da cliente.
 */
function limparMensagem(err: unknown): string {
  const texto = err instanceof Error ? err.message : String(err)
  return texto.replace(/^Error invoking remote method '[^']*':\s*(?:Error:\s*)?/, '')
}

async function invoke<T>(canal: string, ...args: unknown[]): Promise<T> {
  try {
    return (await ipcRenderer.invoke(canal, ...args)) as T
  } catch (err) {
    throw new Error(limparMensagem(err))
  }
}

const api = {
  categories: {
    getAll: () => invoke(CANAIS_IPC.categories.getAll)
  },
  products: {
    getAll: () => invoke(CANAIS_IPC.products.getAll),
    create: (data: CreateProductInput) => invoke(CANAIS_IPC.products.create, data),
    update: (data: UpdateProductInput) => invoke(CANAIS_IPC.products.update, data),
    delete: (id: number) => invoke(CANAIS_IPC.products.delete, id),
    setArchived: (id: number, archived: boolean) =>
      invoke(CANAIS_IPC.products.setArchived, id, archived)
  },
  variations: {
    create: (data: CreateVariationInput) => invoke(CANAIS_IPC.variations.create, data),
    update: (data: UpdateVariationInput) => invoke(CANAIS_IPC.variations.update, data),
    delete: (id: number, opcoes?: DeleteVariationOptions) =>
      invoke(CANAIS_IPC.variations.delete, id, opcoes),
    addStock: (id: number, quantity: number) =>
      invoke(CANAIS_IPC.variations.addStock, id, quantity),
    setSalePrice: (id: number, salePrice: number) =>
      invoke(CANAIS_IPC.variations.setSalePrice, id, salePrice),
    setArchived: (id: number, archived: boolean) =>
      invoke(CANAIS_IPC.variations.setArchived, id, archived)
  },
  fairs: {
    getAll: () => invoke(CANAIS_IPC.fairs.getAll),
    create: (data: CreateFairInput) => invoke(CANAIS_IPC.fairs.create, data),
    update: (data: UpdateFairInput) => invoke(CANAIS_IPC.fairs.update, data),
    delete: (id: number) => invoke(CANAIS_IPC.fairs.delete, id)
  },
  sales: {
    getAll: () => invoke(CANAIS_IPC.sales.getAll),
    create: (data: CreateSaleInput) => invoke(CANAIS_IPC.sales.create, data),
    update: (data: UpdateSaleInput) => invoke(CANAIS_IPC.sales.update, data),
    delete: (id: number) => invoke(CANAIS_IPC.sales.delete, id),
    registerPayment: (data: RegisterPaymentInput) => invoke(CANAIS_IPC.sales.registerPayment, data),
    deletePayment: (id: number) => invoke(CANAIS_IPC.sales.deletePayment, id),
    unmarkAsReceived: (id: number) => invoke(CANAIS_IPC.sales.unmarkAsReceived, id)
  },
  dashboard: {
    getStats: (params: DashboardParams) => invoke(CANAIS_IPC.dashboard.getStats, params)
  },
  insumos: {
    getAll: () => invoke(CANAIS_IPC.insumos.getAll),
    create: (data: CreateInsumoInput) => invoke(CANAIS_IPC.insumos.create, data),
    update: (data: UpdateInsumoInput) => invoke(CANAIS_IPC.insumos.update, data),
    addStock: (id: number, quantity: number) => invoke(CANAIS_IPC.insumos.addStock, id, quantity),
    delete: (id: number) => invoke(CANAIS_IPC.insumos.delete, id),
    setArchived: (id: number, archived: boolean) =>
      invoke(CANAIS_IPC.insumos.setArchived, id, archived),
    exportCsv: (csvContent: string, defaultFileName: string) =>
      invoke(CANAIS_IPC.insumos.exportCsv, csvContent, defaultFileName)
  },
  expenseCategories: {
    getAll: () => invoke(CANAIS_IPC.expenseCategories.getAll),
    create: (data: CreateExpenseCategoryInput) => invoke(CANAIS_IPC.expenseCategories.create, data),
    update: (data: UpdateExpenseCategoryInput) => invoke(CANAIS_IPC.expenseCategories.update, data),
    delete: (id: number) => invoke(CANAIS_IPC.expenseCategories.delete, id)
  },
  cashExpenses: {
    getAll: (filters?: FiltroDeDespesas) => invoke(CANAIS_IPC.cashExpenses.getAll, filters),
    create: (data: CreateCashExpenseInput) => invoke(CANAIS_IPC.cashExpenses.create, data),
    update: (data: UpdateCashExpenseInput) => invoke(CANAIS_IPC.cashExpenses.update, data),
    delete: (id: number) => invoke(CANAIS_IPC.cashExpenses.delete, id),
    getStats: (filters?: FiltroDeEstatisticas) => invoke(CANAIS_IPC.cashExpenses.getStats, filters)
  },
  cashSettings: {
    get: () => invoke(CANAIS_IPC.cashSettings.get),
    setOpeningBalance: (balance: number) =>
      invoke(CANAIS_IPC.cashSettings.setOpeningBalance, balance)
  },
  backup: {
    exportar: () => invoke(CANAIS_IPC.backup.exportar),
    restaurar: () => invoke(CANAIS_IPC.backup.restaurar),
    info: () => invoke(CANAIS_IPC.backup.info),
    abrirPasta: () => invoke(CANAIS_IPC.backup.abrirPasta)
  },
  app: {
    versao: () => invoke(CANAIS_IPC.app.versao),
    verificarAtualizacoes: () => invoke(CANAIS_IPC.app.verificarAtualizacoes)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error — window.api não está no tipo global; acesso apenas fora do contextBridge (dev/test)
  window.api = api
}
