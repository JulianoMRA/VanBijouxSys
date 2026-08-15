import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  CreateProductInput,
  UpdateProductInput,
  CreateVariationInput,
  UpdateVariationInput,
  CreateFairInput,
  UpdateFairInput,
  CreateSaleInput,
  UpdateSaleInput,
  MarkSaleReceivedInput,
  CreateInsumoInput,
  UpdateInsumoInput,
  CreateExpenseCategoryInput,
  UpdateExpenseCategoryInput,
  CreateCashExpenseInput,
  UpdateCashExpenseInput
} from '../renderer/src/types'

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
    getAll: () => invoke('categories:getAll')
  },
  products: {
    getAll: () => invoke('products:getAll'),
    create: (data: CreateProductInput) => invoke('products:create', data),
    update: (data: UpdateProductInput) => invoke('products:update', data),
    delete: (id: number) => invoke('products:delete', id),
    setArchived: (id: number, archived: boolean) => invoke('products:setArchived', id, archived)
  },
  variations: {
    create: (data: CreateVariationInput) => invoke('variations:create', data),
    update: (data: UpdateVariationInput) => invoke('variations:update', data),
    delete: (id: number) => invoke('variations:delete', id),
    addStock: (id: number, quantity: number) => invoke('variations:addStock', id, quantity),
    setArchived: (id: number, archived: boolean) => invoke('variations:setArchived', id, archived)
  },
  fairs: {
    getAll: () => invoke('fairs:getAll'),
    create: (data: CreateFairInput) => invoke('fairs:create', data),
    update: (data: UpdateFairInput) => invoke('fairs:update', data),
    delete: (id: number) => invoke('fairs:delete', id)
  },
  sales: {
    getAll: () => invoke('sales:getAll'),
    create: (data: CreateSaleInput) => invoke('sales:create', data),
    update: (data: UpdateSaleInput) => invoke('sales:update', data),
    delete: (id: number) => invoke('sales:delete', id),
    markAsReceived: (data: MarkSaleReceivedInput) => invoke('sales:markAsReceived', data),
    unmarkAsReceived: (id: number) => invoke('sales:unmarkAsReceived', id)
  },
  dashboard: {
    getStats: (params: { period: string; customFrom?: string; customTo?: string }) =>
      invoke('dashboard:getStats', params)
  },
  insumos: {
    getAll: () => invoke('insumos:getAll'),
    create: (data: CreateInsumoInput) => invoke('insumos:create', data),
    update: (data: UpdateInsumoInput) => invoke('insumos:update', data),
    addStock: (id: number, quantity: number) => invoke('insumos:addStock', id, quantity),
    delete: (id: number) => invoke('insumos:delete', id),
    setArchived: (id: number, archived: boolean) => invoke('insumos:setArchived', id, archived),
    exportCsv: (csvContent: string, defaultFileName: string) =>
      invoke('insumos:exportCsv', csvContent, defaultFileName)
  },
  expenseCategories: {
    getAll: () => invoke('expense-categories:getAll'),
    create: (data: CreateExpenseCategoryInput) => invoke('expense-categories:create', data),
    update: (data: UpdateExpenseCategoryInput) => invoke('expense-categories:update', data),
    delete: (id: number) => invoke('expense-categories:delete', id)
  },
  cashExpenses: {
    getAll: (filters?: { startDate?: string; endDate?: string; categoryId?: number }) =>
      invoke('cash-expenses:getAll', filters),
    create: (data: CreateCashExpenseInput) => invoke('cash-expenses:create', data),
    update: (data: UpdateCashExpenseInput) => invoke('cash-expenses:update', data),
    delete: (id: number) => invoke('cash-expenses:delete', id),
    getStats: (filters?: { startDate?: string; endDate?: string }) =>
      invoke('cash-expenses:getStats', filters)
  },
  cashSettings: {
    get: () => invoke('cash-settings:get'),
    setOpeningBalance: (balance: number) => invoke('cash-settings:setOpeningBalance', balance)
  },
  backup: {
    exportar: () => invoke('backup:exportar'),
    restaurar: () => invoke('backup:restaurar'),
    info: () => invoke('backup:info'),
    abrirPasta: () => invoke('backup:abrirPasta')
  },
  app: {
    versao: () => invoke('app:versao'),
    verificarAtualizacoes: () => invoke('app:verificarAtualizacoes')
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error — window.electron não está no tipo global; acesso apenas fora do contextBridge (dev/test)
  window.electron = electronAPI
  // @ts-expect-error — window.api não está no tipo global; acesso apenas fora do contextBridge (dev/test)
  window.api = api
}
