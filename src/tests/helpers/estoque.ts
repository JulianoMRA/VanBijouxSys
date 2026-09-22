import type { AmbienteIpc } from './ambiente-ipc'
import { queryOne } from './testDb'
import type {
  CreateInsumoInput,
  CreateSaleInput,
  CreateVariationInput
} from '../../renderer/src/types'

type ItemDeReceita = { insumoId: number; quantity: number }

export async function criarInsumo(
  ambiente: AmbienteIpc,
  dados: Partial<CreateInsumoInput> & { stockQuantity: number }
): Promise<number> {
  const { id } = await ambiente.chamar<{ id: number }>('insumos:create', {
    name: 'Fio de nylon',
    unit: 'cm',
    costPerUnit: 0.012,
    minimumStock: 0,
    ...dados
  })
  return id
}

export async function criarProduto(ambiente: AmbienteIpc, nome = 'Pulseira'): Promise<number> {
  const { id } = await ambiente.chamar<{ id: number }>('products:create', {
    name: nome,
    categoryId: 2
  })
  return Number(id)
}

export async function criarVariacao(
  ambiente: AmbienteIpc,
  dados: { receita: ItemDeReceita[] } & Partial<CreateVariationInput>
): Promise<number> {
  const productId = dados.productId ?? (await criarProduto(ambiente))
  const { receita, ...resto } = dados
  const { id } = await ambiente.chamar<{ id: number }>('variations:create', {
    identifier: 'Rosa',
    costPrice: 3,
    salePrice: 25,
    stockQuantity: 0,
    motivoDoEstoqueInicial: 'producao',
    minimumStock: 1,
    laborCost: 0,
    ...resto,
    productId,
    insumos: receita
  })
  return id
}

/** Mesmo payload que o formulário de venda envia. */
export async function registrarVenda(
  ambiente: AmbienteIpc,
  itens: Array<{ variationId: number; quantity: number; unitCost?: number }>
): Promise<number> {
  const items = itens.map((i) => ({ unitPrice: 25, unitCost: 3, ...i }))
  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const { id } = await ambiente.chamar<{ id: number }>('sales:create', {
    channel: 'WhatsApp',
    soldAt: '2026-09-10',
    paymentMethod: 'pix',
    feePercentage: 0,
    feeAmount: 0,
    netAmount: total,
    items
  })
  return Number(id)
}

/**
 * Venda com data, canal e pagamento escolhidos; o líquido padrão é o total sem taxa.
 * A cliente padrão existe porque venda a receber sem nome é recusada (RN-16); para
 * uma venda sem cliente, passe `customerName: undefined`.
 */
export async function criarVenda(
  ambiente: AmbienteIpc,
  dados: Partial<Omit<CreateSaleInput, 'items'>> & {
    items: Array<{ variationId: number; quantity: number; unitPrice: number; unitCost: number }>
  }
): Promise<number> {
  const total = dados.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const { id } = await ambiente.chamar<{ id: number }>('sales:create', {
    channel: 'WhatsApp',
    customerName: 'Maria',
    soldAt: '2026-05-10',
    paymentMethod: 'dinheiro',
    feePercentage: 0,
    feeAmount: 0,
    netAmount: total - (dados.feeAmount ?? 0),
    ...dados
  })
  return Number(id)
}

export function estoqueDoInsumo(ambiente: AmbienteIpc, id: number): number {
  return queryOne<{ s: number }>(
    ambiente.banco,
    'SELECT stock_quantity s FROM insumos WHERE id = ?',
    [id]
  )!.s
}

export function estoqueDaVariacao(ambiente: AmbienteIpc, id: number): number {
  return queryOne<{ s: number }>(
    ambiente.banco,
    'SELECT stock_quantity s FROM product_variations WHERE id = ?',
    [id]
  )!.s
}

export function itensDaReceita(ambiente: AmbienteIpc, variacaoId: number): number {
  return queryOne<{ n: number }>(
    ambiente.banco,
    'SELECT COUNT(*) n FROM variation_insumos WHERE variation_id = ?',
    [variacaoId]
  )!.n
}
