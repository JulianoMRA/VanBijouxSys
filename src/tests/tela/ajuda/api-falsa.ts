import { vi } from 'vitest'
import type { Insumo } from '../../../shared/ipc/insumos'
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
  }
  variations: {
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    setSalePrice: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
  }
  products: { getAll: ReturnType<typeof vi.fn> }
  sales: {
    getAll: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    registerPayment: ReturnType<typeof vi.fn>
    deletePayment: ReturnType<typeof vi.fn>
  }
  fairs: { getAll: ReturnType<typeof vi.fn> }
}

export function instalarApiFalsa(): ApiFalsa {
  const api: ApiFalsa = {
    insumos: {
      getAll: vi.fn(async () => []),
      create: vi.fn(async () => ({ id: 1 })),
      update: vi.fn(async () => ({ success: true }))
    },
    variations: {
      create: vi.fn(async () => ({ id: 1 })),
      update: vi.fn(async () => ({ success: true })),
      setSalePrice: vi.fn(async () => ({ success: true })),
      delete: vi.fn(async () => ({ success: true }))
    },
    products: { getAll: vi.fn(async () => []) },
    sales: {
      getAll: vi.fn(async () => []),
      create: vi.fn(async () => ({ id: 1 })),
      update: vi.fn(async () => ({ success: true })),
      registerPayment: vi.fn(async () => ({ id: 1 })),
      deletePayment: vi.fn(async () => ({ success: true }))
    },
    fairs: { getAll: vi.fn(async () => []) }
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
