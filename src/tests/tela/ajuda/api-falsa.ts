import { vi } from 'vitest'
import type { Insumo } from '../../../shared/ipc/insumos'
import type { DashboardStats } from '../../../shared/ipc/painel'
import type { ProductVariation } from '../../../shared/ipc/produtos'

/**
 * `window.api` de mentira para os testes de tela. Só os canais que a tela em
 * teste chama são preenchidos; qualquer outro estoura, em vez de devolver
 * `undefined` e fazer o teste passar por engano.
 */
export interface ApiFalsa {
  insumos: {
    getAll: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    addStock: ReturnType<typeof vi.fn>
  }
  variations: {
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    setSalePrice: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    addStock: ReturnType<typeof vi.fn>
  }
  products: { getAll: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> }
  sales: {
    getAll: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    registerPayment: ReturnType<typeof vi.fn>
    deletePayment: ReturnType<typeof vi.fn>
  }
  fairs: { getAll: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> }
  dashboard: { getStats: ReturnType<typeof vi.fn> }
  cashExpenses: { getAll: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> }
  expenseCategories: { getAll: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> }
  cashSettings: {
    get: ReturnType<typeof vi.fn>
    setOpeningBalance: ReturnType<typeof vi.fn>
  }
  app: { registrarErroDaTela: ReturnType<typeof vi.fn> }
}

/** Painel de um período sem venda nenhuma; o teste sobrescreve o que precisa. */
export const painelFalso = (dados: Partial<DashboardStats> = {}): DashboardStats => ({
  overview: {
    totalRevenue: 0,
    totalNetRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    totalSales: 0,
    avgTicket: 0,
    totalReceivable: 0
  },
  previousOverview: null,
  revenueByMonth: [],
  salesByChannel: [],
  salesByCategory: [],
  salesByFair: [],
  topVariations: [],
  outOfStock: [],
  lowStock: [],
  outOfInsumos: [],
  lowInsumos: [],
  cashFlow: [],
  cashSummary: {
    openingBalance: 0,
    startBalance: 0,
    totalIncome: 0,
    totalExpenses: 0,
    currentBalance: 0
  },
  ...dados
})

export function instalarApiFalsa(): ApiFalsa {
  const api: ApiFalsa = {
    insumos: {
      getAll: vi.fn(async () => []),
      create: vi.fn(async () => ({ id: 1 })),
      update: vi.fn(async () => ({ success: true })),
      addStock: vi.fn(async () => ({ success: true }))
    },
    variations: {
      create: vi.fn(async () => ({ id: 1 })),
      update: vi.fn(async () => ({ success: true })),
      setSalePrice: vi.fn(async () => ({ success: true })),
      delete: vi.fn(async () => ({ success: true })),
      addStock: vi.fn(async () => ({ success: true }))
    },
    products: { getAll: vi.fn(async () => []), create: vi.fn(async () => ({ id: 1 })) },
    sales: {
      getAll: vi.fn(async () => []),
      create: vi.fn(async () => ({ id: 1 })),
      update: vi.fn(async () => ({ success: true })),
      registerPayment: vi.fn(async () => ({ id: 1 })),
      deletePayment: vi.fn(async () => ({ success: true }))
    },
    fairs: { getAll: vi.fn(async () => []), create: vi.fn(async () => ({ id: 1 })) },
    dashboard: { getStats: vi.fn(async () => painelFalso()) },
    cashExpenses: { getAll: vi.fn(async () => []), create: vi.fn(async () => ({ id: 1 })) },
    expenseCategories: { getAll: vi.fn(async () => []), create: vi.fn(async () => ({ id: 1 })) },
    cashSettings: {
      get: vi.fn(async () => ({ id: 1, openingBalance: 0, updatedAt: '2026-01-01 00:00:00' })),
      setOpeningBalance: vi.fn(async () => ({ success: true }))
    },
    app: { registrarErroDaTela: vi.fn(async () => ({ registrado: true })) }
  }
  Object.defineProperty(window, 'api', { value: api, configurable: true, writable: true })
  return api
}

export const insumoFalso = (dados: Partial<Insumo> = {}): Insumo => ({
  id: 1,
  name: 'Fio de nylon',
  unit: 'cm',
  costPerUnit: 0.02,
  stockQuantity: 500,
  minimumStock: 0,
  createdAt: '2026-05-01',
  archivedAt: null,
  usadoPorVariacoesAtivas: 0,
  ...dados
})

export const variacaoFalsa = (dados: Partial<ProductVariation> = {}): ProductVariation => ({
  id: 10,
  productId: 1,
  identifier: 'Rosa',
  costPrice: 3,
  salePrice: 25,
  stockQuantity: 4,
  minimumStock: 1,
  laborCost: 0,
  createdAt: '2026-05-01',
  archivedAt: null,
  insumos: [],
  ...dados
})
