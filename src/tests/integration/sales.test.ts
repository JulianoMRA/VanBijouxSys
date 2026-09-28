import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prepararAmbienteIpc, type AmbienteIpc } from '../helpers/ambiente-ipc'
import { queryAll, queryOne } from '../helpers/testDb'
import { SQL_VARIACOES_ESGOTADAS } from '../../main/database/consultas-estoque'
import {
  criarInsumo,
  criarVariacao,
  criarVenda,
  estoqueDaVariacao,
  estoqueDoInsumo,
  registrarVenda
} from '../helpers/estoque'

vi.mock('electron', async () => (await import('../helpers/ambiente-ipc')).electronFalso)
vi.mock('../../main/database', async () => (await import('../helpers/ambiente-ipc')).bancoFalso)

let ambiente: AmbienteIpc
let fio: number
let variacao: number

beforeEach(async () => {
  ambiente = await prepararAmbienteIpc()
  fio = await criarInsumo(ambiente, { stockQuantity: 1000 })
  variacao = await criarVariacao(ambiente, { receita: [{ insumoId: fio, quantity: 20 }] })
  await ambiente.chamar('variations:addStock', variacao, 10)
})

describe('sales:create', () => {
  it('should_decrease_variation_stock_by_the_quantity_sold', async () => {
    await registrarVenda(ambiente, [{ variationId: variacao, quantity: 3 }])

    expect(estoqueDaVariacao(ambiente, variacao)).toBe(7)
  })

  it('should_persist_the_sale_with_totals_and_items', async () => {
    const venda = await registrarVenda(ambiente, [
      { variationId: variacao, quantity: 2, unitCost: 10 }
    ])

    const registro = queryOne<{ total_amount: number; total_cost: number }>(
      ambiente.banco,
      'SELECT total_amount, total_cost FROM sales WHERE id = ?',
      [venda]
    )
    expect(registro).toEqual({ total_amount: 50, total_cost: 20 })
    expect(
      queryAll(ambiente.banco, 'SELECT * FROM sale_items WHERE sale_id = ?', [venda])
    ).toHaveLength(1)
  })

  it('should_not_touch_insumos_because_they_were_deducted_at_production', async () => {
    await registrarVenda(ambiente, [{ variationId: variacao, quantity: 10 }])

    expect(estoqueDoInsumo(ambiente, fio)).toBe(800)
  })

  it('should_go_negative_when_selling_more_than_the_registered_stock', async () => {
    await registrarVenda(ambiente, [{ variationId: variacao, quantity: 13 }])

    expect(estoqueDaVariacao(ambiente, variacao)).toBe(-3)
  })

  it('should_net_out_the_deficit_when_the_missing_production_is_registered', async () => {
    await registrarVenda(ambiente, [{ variationId: variacao, quantity: 13 }])

    await ambiente.chamar('variations:addStock', variacao, 3)

    expect(estoqueDaVariacao(ambiente, variacao)).toBe(0)
    expect(estoqueDoInsumo(ambiente, fio)).toBe(1000 - 13 * 20)
  })

  it('should_list_an_oversold_variation_as_out_of_stock', async () => {
    await registrarVenda(ambiente, [{ variationId: variacao, quantity: 13 }])

    expect(queryAll(ambiente.banco, SQL_VARIACOES_ESGOTADAS)).toHaveLength(1)
  })
})

describe('sales:delete', () => {
  it('should_return_the_sold_quantity_to_the_variation', async () => {
    const venda = await registrarVenda(ambiente, [{ variationId: variacao, quantity: 3 }])

    await ambiente.chamar('sales:delete', venda)

    expect(estoqueDaVariacao(ambiente, variacao)).toBe(10)
  })

  it('should_delete_the_items_together_with_the_sale', async () => {
    const venda = await registrarVenda(ambiente, [{ variationId: variacao, quantity: 2 }])

    await ambiente.chamar('sales:delete', venda)

    expect(
      queryAll(ambiente.banco, 'SELECT * FROM sale_items WHERE sale_id = ?', [venda])
    ).toHaveLength(0)
  })

  it('should_restore_only_the_deleted_sale', async () => {
    await registrarVenda(ambiente, [{ variationId: variacao, quantity: 2 }])
    const segunda = await registrarVenda(ambiente, [{ variationId: variacao, quantity: 1 }])

    await ambiente.chamar('sales:delete', segunda)

    expect(estoqueDaVariacao(ambiente, variacao)).toBe(8)
  })

  it('should_restore_exactly_the_previous_stock_when_an_oversold_sale_is_deleted', async () => {
    const venda = await registrarVenda(ambiente, [{ variationId: variacao, quantity: 13 }])

    await ambiente.chamar('sales:delete', venda)

    expect(estoqueDaVariacao(ambiente, variacao)).toBe(10)
  })
})

describe('sales:update', () => {
  it('should_restore_the_old_items_before_applying_the_new_ones', async () => {
    const venda = await registrarVenda(ambiente, [{ variationId: variacao, quantity: 3 }])

    await ambiente.chamar('sales:update', {
      id: venda,
      channel: 'WhatsApp',
      soldAt: '2026-09-10',
      paymentMethod: 'pix',
      feePercentage: 0,
      items: [{ variationId: variacao, quantity: 5, unitPrice: 25, unitCost: 3 }]
    })

    expect(estoqueDaVariacao(ambiente, variacao)).toBe(5)
  })

  it('should_keep_the_balance_exact_when_an_oversold_sale_is_edited', async () => {
    const venda = await registrarVenda(ambiente, [{ variationId: variacao, quantity: 13 }])

    await ambiente.chamar('sales:update', {
      id: venda,
      channel: 'WhatsApp',
      soldAt: '2026-09-10',
      paymentMethod: 'pix',
      feePercentage: 0,
      items: [{ variationId: variacao, quantity: 12, unitPrice: 25, unitCost: 3 }]
    })

    expect(estoqueDaVariacao(ambiente, variacao)).toBe(-2)
  })
})

describe('sales:getAll', () => {
  it('should_list_the_newest_sale_first_and_break_ties_by_registration_order', async () => {
    const antiga = await criarVenda(ambiente, {
      soldAt: '2026-09-09',
      items: [{ variationId: variacao, quantity: 1, unitPrice: 25, unitCost: 3 }]
    })
    const primeiraDoDia = await criarVenda(ambiente, {
      soldAt: '2026-09-10',
      items: [{ variationId: variacao, quantity: 1, unitPrice: 25, unitCost: 3 }]
    })
    const segundaDoDia = await criarVenda(ambiente, {
      soldAt: '2026-09-10',
      items: [{ variationId: variacao, quantity: 1, unitPrice: 25, unitCost: 3 }]
    })

    const vendas = await ambiente.chamar<Array<{ id: number }>>('sales:getAll')

    expect(vendas.map((v) => v.id)).toEqual([segundaDoDia, primeiraDoDia, antiga])
  })

  it('should_name_the_product_and_the_variation_of_each_item', async () => {
    await criarVenda(ambiente, {
      items: [{ variationId: variacao, quantity: 2, unitPrice: 25, unitCost: 3 }]
    })

    const [venda] = await ambiente.chamar<Array<{ items: unknown[] }>>('sales:getAll')

    expect(venda.items).toEqual([
      expect.objectContaining({
        variationId: variacao,
        productName: 'Pulseira',
        variationIdentifier: 'Rosa',
        quantity: 2,
        unitPrice: 25,
        unitCost: 3
      })
    ])
  })
})
