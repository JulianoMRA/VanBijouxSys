import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prepararAmbienteIpc, type AmbienteIpc } from '../helpers/ambiente-ipc'
import { queryAll, queryOne } from '../helpers/testDb'
import { SQL_INSUMOS_ABAIXO_DO_MINIMO } from '../../main/database/consultas-estoque'
import { criarInsumo, criarVariacao, estoqueDoInsumo } from '../helpers/estoque'

vi.mock('electron', async () => (await import('../helpers/ambiente-ipc')).electronFalso)
vi.mock('../../main/database', async () => (await import('../helpers/ambiente-ipc')).bancoFalso)

let ambiente: AmbienteIpc
let fio: number
let micanga: number

beforeEach(async () => {
  ambiente = await prepararAmbienteIpc()
  fio = await criarInsumo(ambiente, { stockQuantity: 200, minimumStock: 50, costPerUnit: 0.05 })
  micanga = await criarInsumo(ambiente, {
    name: 'Miçanga',
    unit: 'unidade',
    stockQuantity: 500,
    minimumStock: 100,
    costPerUnit: 0.1
  })
})

describe('insumos:create', () => {
  it('should_persist_every_field', async () => {
    const id = await criarInsumo(ambiente, {
      name: 'Elástico',
      stockQuantity: 300,
      minimumStock: 80,
      costPerUnit: 0.02
    })

    const insumo = queryOne(
      ambiente.banco,
      'SELECT name, unit, stock_quantity, minimum_stock, cost_per_unit FROM insumos WHERE id = ?',
      [id]
    )
    expect(insumo).toEqual({
      name: 'Elástico',
      unit: 'cm',
      stock_quantity: 300,
      minimum_stock: 80,
      cost_per_unit: 0.02
    })
  })
})

describe('insumos:update', () => {
  it('should_update_cost_and_minimum_stock', async () => {
    await ambiente.chamar('insumos:update', {
      id: fio,
      name: 'Fio de nylon',
      unit: 'cm',
      costPerUnit: 0.08,
      stockQuantity: 200,
      minimumStock: 60
    })

    const insumo = queryOne(
      ambiente.banco,
      'SELECT cost_per_unit, minimum_stock FROM insumos WHERE id = ?',
      [fio]
    )
    expect(insumo).toEqual({ cost_per_unit: 0.08, minimum_stock: 60 })
  })
})

describe('insumos:addStock', () => {
  it('should_add_the_purchased_quantity', async () => {
    await ambiente.chamar('insumos:addStock', fio, 100)

    expect(estoqueDoInsumo(ambiente, fio)).toBe(300)
  })

  it('should_reject_an_unknown_insumo', async () => {
    await expect(ambiente.chamar('insumos:addStock', 999, 1)).rejects.toThrow(
      'Insumo não encontrado.'
    )
  })
})

describe('insumos:delete', () => {
  it('should_delete_an_insumo_that_no_recipe_uses', async () => {
    await ambiente.chamar('insumos:delete', micanga)

    expect(queryAll(ambiente.banco, 'SELECT id FROM insumos')).toEqual([{ id: fio }])
  })

  it('should_refuse_to_delete_an_insumo_used_by_a_recipe', async () => {
    await criarVariacao(ambiente, { receita: [{ insumoId: fio, quantity: 5 }] })

    await expect(ambiente.chamar('insumos:delete', fio)).rejects.toThrow(
      'Este insumo não pode ser excluído porque está vinculado a variações de produtos.'
    )
  })
})

describe('alerta de reposição', () => {
  function abaixoDoMinimo(): string[] {
    return queryAll<{ name: string }>(ambiente.banco, SQL_INSUMOS_ABAIXO_DO_MINIMO).map(
      (i) => i.name
    )
  }

  it('should_flag_an_insumo_below_its_minimum', async () => {
    await ambiente.chamar('insumos:update', {
      id: fio,
      name: 'Fio de nylon',
      unit: 'cm',
      costPerUnit: 0.05,
      stockQuantity: 30,
      minimumStock: 50
    })

    expect(abaixoDoMinimo()).toEqual(['Fio de nylon'])
  })

  it('should_not_flag_insumos_at_or_above_their_minimum', () => {
    expect(abaixoDoMinimo()).toEqual([])
  })
})
