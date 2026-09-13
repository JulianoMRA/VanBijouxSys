import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prepararAmbienteIpc, type AmbienteIpc } from '../helpers/ambiente-ipc'
import {
  criarInsumo,
  criarVariacao,
  estoqueDaVariacao,
  estoqueDoInsumo,
  itensDaReceita
} from '../helpers/estoque'

vi.mock('electron', async () => (await import('../helpers/ambiente-ipc')).electronFalso)
vi.mock('../../main/database', async () => (await import('../helpers/ambiente-ipc')).bancoFalso)

let ambiente: AmbienteIpc
let fio: number

beforeEach(async () => {
  ambiente = await prepararAmbienteIpc()
  fio = await criarInsumo(ambiente, { stockQuantity: 100 })
})

describe('variations:create', () => {
  it('should_deduct_recipe_times_initial_stock_when_created_with_stock', async () => {
    await criarVariacao(ambiente, { stockQuantity: 5, receita: [{ insumoId: fio, quantity: 10 }] })

    expect(estoqueDoInsumo(ambiente, fio)).toBe(50)
  })

  it('should_not_touch_insumos_when_created_without_stock', async () => {
    const variacao = await criarVariacao(ambiente, { receita: [{ insumoId: fio, quantity: 10 }] })

    expect(estoqueDoInsumo(ambiente, fio)).toBe(100)
    expect(itensDaReceita(ambiente, variacao)).toBe(1)
  })

  it('should_clamp_insumo_at_zero_when_initial_stock_needs_more_than_available', async () => {
    await criarVariacao(ambiente, { stockQuantity: 200, receita: [{ insumoId: fio, quantity: 1 }] })

    expect(estoqueDoInsumo(ambiente, fio)).toBe(0)
  })
})

describe('variations:addStock', () => {
  it('should_add_pieces_and_deduct_recipe_times_quantity', async () => {
    const variacao = await criarVariacao(ambiente, { receita: [{ insumoId: fio, quantity: 10 }] })

    await ambiente.chamar('variations:addStock', variacao, 3)

    expect(estoqueDaVariacao(ambiente, variacao)).toBe(3)
    expect(estoqueDoInsumo(ambiente, fio)).toBe(70)
  })

  it('should_clamp_insumo_at_zero_when_production_needs_more_than_available', async () => {
    const variacao = await criarVariacao(ambiente, { receita: [{ insumoId: fio, quantity: 50 }] })

    await ambiente.chamar('variations:addStock', variacao, 5)

    expect(estoqueDoInsumo(ambiente, fio)).toBe(0)
  })

  it('should_reject_an_unknown_variation', async () => {
    await expect(ambiente.chamar('variations:addStock', 999, 1)).rejects.toThrow(
      'Variação não encontrada.'
    )
  })
})

describe('variations:delete', () => {
  it('should_delete_the_recipe_together_with_the_variation', async () => {
    const variacao = await criarVariacao(ambiente, { receita: [{ insumoId: fio, quantity: 10 }] })

    await ambiente.chamar('variations:delete', variacao)

    expect(itensDaReceita(ambiente, variacao)).toBe(0)
  })
})
