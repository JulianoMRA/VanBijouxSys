import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prepararAmbienteIpc, type AmbienteIpc } from '../helpers/ambiente-ipc'
import { queryAll, queryOne } from '../helpers/testDb'
import {
  SQL_INSUMOS_ABAIXO_DO_MINIMO,
  SQL_INSUMOS_ESGOTADOS
} from '../../main/database/consultas-estoque'
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

describe('insumos:update trocando a unidade', () => {
  function salvar(id: number, dados: Record<string, unknown>): Promise<unknown> {
    return ambiente.chamar('insumos:update', {
      id,
      name: 'Fio de nylon',
      unit: 'cm',
      costPerUnit: 0.05,
      stockQuantity: 200,
      minimumStock: 50,
      ...dados
    })
  }

  function unidade(id: number): string {
    return queryOne<{ unit: string }>(ambiente.banco, 'SELECT unit FROM insumos WHERE id = ?', [
      id
    ])!.unit
  }

  it('should_refuse_when_a_recipe_uses_the_insumo', async () => {
    await criarVariacao(ambiente, { receita: [{ insumoId: fio, quantity: 20 }] })

    await expect(salvar(fio, { unit: 'g', stockQuantity: 0 })).rejects.toThrow(
      'A unidade não pode mudar: este insumo está em 1 receita'
    )
    expect(unidade(fio)).toBe('cm')
  })

  it('should_refuse_even_when_only_an_archived_variation_uses_it', async () => {
    const variacao = await criarVariacao(ambiente, { receita: [{ insumoId: fio, quantity: 20 }] })
    await ambiente.chamar('variations:setArchived', variacao, true)

    await expect(salvar(fio, { unit: 'g', stockQuantity: 0 })).rejects.toThrow(
      'A unidade não pode mudar'
    )
  })

  it('should_refuse_when_there_is_stock_and_it_was_not_recounted_in_the_new_unit', async () => {
    await expect(salvar(fio, { unit: 'g' })).rejects.toThrow(
      'Para trocar a unidade, informe também o estoque atual na unidade nova.'
    )
    expect(unidade(fio)).toBe('cm')
  })

  it('should_accept_when_the_stock_is_recounted_in_the_new_unit', async () => {
    await salvar(fio, { unit: 'g', stockQuantity: 35 })

    expect(unidade(fio)).toBe('g')
    expect(estoqueDoInsumo(ambiente, fio)).toBe(35)
  })

  it('should_accept_on_an_unused_insumo_without_stock', async () => {
    const cola = await criarInsumo(ambiente, { name: 'Cola', stockQuantity: 0 })

    await salvar(cola, { name: 'Cola', unit: 'g', stockQuantity: 0 })

    expect(unidade(cola)).toBe('g')
  })
})

describe('insumos:getAll: uso em receitas (RN-05)', () => {
  // A tela trava a unidade pelo que a lista informa; contando só variação ativa, ela
  // deixava escolher outra unidade para um insumo de receita arquivada, e o app
  // recusava só ao salvar.
  type Uso = { usadoPorVariacoesAtivas: number; usadoEmReceitas: number }

  async function usoDo(id: number): Promise<Uso> {
    const lista = await ambiente.chamar<Array<Uso & { id: number }>>('insumos:getAll')
    const { usadoPorVariacoesAtivas, usadoEmReceitas } = lista.find((i) => i.id === id)!
    return { usadoPorVariacoesAtivas, usadoEmReceitas }
  }

  it('should_count_every_recipe_including_archived_variations_and_products', async () => {
    const ativa = await criarVariacao(ambiente, { receita: [{ insumoId: fio, quantity: 20 }] })
    const arquivada = await criarVariacao(ambiente, { receita: [{ insumoId: fio, quantity: 5 }] })
    await ambiente.chamar('variations:setArchived', arquivada, true)
    const deProdutoArquivado = await criarVariacao(ambiente, {
      receita: [{ insumoId: fio, quantity: 1 }]
    })
    const produto = queryOne<{ product_id: number }>(
      ambiente.banco,
      'SELECT product_id FROM product_variations WHERE id = ?',
      [deProdutoArquivado]
    )!.product_id
    await ambiente.chamar('products:setArchived', produto, true)

    expect(ativa).toBeGreaterThan(0)
    expect(await usoDo(fio)).toEqual({ usadoPorVariacoesAtivas: 1, usadoEmReceitas: 3 })
  })

  it('should_report_no_use_for_an_insumo_outside_every_recipe', async () => {
    expect(await usoDo(micanga)).toEqual({ usadoPorVariacoesAtivas: 0, usadoEmReceitas: 0 })
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

  it('should_round_fractional_purchases_to_four_decimals', async () => {
    const cola = await criarInsumo(ambiente, { name: 'Cola', unit: 'g', stockQuantity: 0.1 })

    await ambiente.chamar('insumos:addStock', cola, 0.2)

    expect(estoqueDoInsumo(ambiente, cola)).toBe(0.3)
  })

  it('should_bring_a_negative_balance_back_by_the_purchased_quantity', async () => {
    const variacao = await criarVariacao(ambiente, { receita: [{ insumoId: fio, quantity: 50 }] })
    await ambiente.chamar('variations:addStock', variacao, 5)

    await ambiente.chamar('insumos:addStock', fio, 100)

    expect(estoqueDoInsumo(ambiente, fio)).toBe(50)
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

  it('should_list_a_negative_insumo_as_out_of_stock_and_not_as_low', async () => {
    const variacao = await criarVariacao(ambiente, { receita: [{ insumoId: fio, quantity: 50 }] })
    await ambiente.chamar('variations:addStock', variacao, 5)

    const esgotados = queryAll<{ name: string }>(ambiente.banco, SQL_INSUMOS_ESGOTADOS)
    expect(esgotados.map((i) => i.name)).toEqual(['Fio de nylon'])
    expect(abaixoDoMinimo()).toEqual([])
  })

  it('should_not_flag_insumos_at_or_above_their_minimum', () => {
    expect(abaixoDoMinimo()).toEqual([])
  })

  it('should_list_an_insumo_without_minimum_as_out_of_stock_when_it_runs_out', async () => {
    // A tela de Estoque e o contador da barra lateral já contavam esse insumo como
    // esgotado; só o Painel exigia mínimo definido e deixava de avisar.
    await criarInsumo(ambiente, { name: 'Cola', unit: 'g', stockQuantity: 0, minimumStock: 0 })

    const esgotados = queryAll<{ name: string }>(ambiente.banco, SQL_INSUMOS_ESGOTADOS)
    expect(esgotados.map((i) => i.name)).toEqual(['Cola'])
    expect(abaixoDoMinimo()).toEqual([])
  })
})
