import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prepararAmbienteIpc, type AmbienteIpc } from '../helpers/ambiente-ipc'
import { queryOne } from '../helpers/testDb'
import { criarInsumo, criarProduto, criarVariacao } from '../helpers/estoque'

vi.mock('electron', async () => (await import('../helpers/ambiente-ipc')).electronFalso)
vi.mock('../../main/database', async () => (await import('../helpers/ambiente-ipc')).bancoFalso)

const DATA_E_HORA = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/

let ambiente: AmbienteIpc

beforeEach(async () => {
  ambiente = await prepararAmbienteIpc()
})

function criadoEm(tabela: string, id: number): string {
  return queryOne<{ created_at: string }>(
    ambiente.banco,
    `SELECT created_at FROM ${tabela} WHERE id = ?`,
    [id]
  )!.created_at
}

async function criarCategoriaDeDespesa(name = 'Material'): Promise<number> {
  const { id } = await ambiente.chamar<{ id: number }>('expense-categories:create', { name })
  return Number(id)
}

async function criarDespesa(categoryId: number, description: string): Promise<number> {
  const { id } = await ambiente.chamar<{ id: number }>('cash-expenses:create', {
    categoryId,
    description,
    amount: 10,
    expenseDate: '2026-05-05'
  })
  return Number(id)
}

describe('data de criação gravada pelos handlers', () => {
  it('should_store_date_and_time_for_a_new_product', async () => {
    const produto = await criarProduto(ambiente, 'Colar')

    expect(criadoEm('products', produto)).toMatch(DATA_E_HORA)
  })

  it('should_store_date_and_time_for_a_new_variation', async () => {
    const variacao = await criarVariacao(ambiente, { receita: [] })

    expect(criadoEm('product_variations', variacao)).toMatch(DATA_E_HORA)
  })

  it('should_store_date_and_time_for_a_new_insumo', async () => {
    const insumo = await criarInsumo(ambiente, { stockQuantity: 10 })

    expect(criadoEm('insumos', insumo)).toMatch(DATA_E_HORA)
  })

  it('should_store_date_and_time_for_a_new_fair', async () => {
    const { id } = await ambiente.chamar<{ id: number }>('fairs:create', {
      name: 'Feira',
      location: 'Praça',
      date: '2026-05-16',
      enrollmentCost: 0,
      additionalCosts: []
    })

    expect(criadoEm('fairs', Number(id))).toMatch(DATA_E_HORA)
  })

  it('should_store_date_and_time_for_a_new_expense_category_and_expense', async () => {
    const categoria = await criarCategoriaDeDespesa()
    const despesa = await criarDespesa(categoria, 'Fio')

    expect(criadoEm('expense_categories', categoria)).toMatch(DATA_E_HORA)
    expect(criadoEm('cash_expenses', despesa)).toMatch(DATA_E_HORA)
  })
})

describe('ordem das despesas do mesmo dia', () => {
  const descricoes = async (): Promise<string[]> =>
    (await ambiente.chamar<Array<{ description: string }>>('cash-expenses:getAll')).map(
      (d) => d.description
    )

  it('should_list_the_last_registered_expense_first_within_the_same_day', async () => {
    const categoria = await criarCategoriaDeDespesa()
    await criarDespesa(categoria, 'Primeira')
    await criarDespesa(categoria, 'Segunda')
    await criarDespesa(categoria, 'Terceira')

    expect(await descricoes()).toEqual(['Terceira', 'Segunda', 'Primeira'])
  })

  it('should_keep_that_order_next_to_an_old_expense_saved_with_the_literal_text', async () => {
    // Banco da usuária: despesas criadas antes da correção têm o texto
    // 'CURRENT_TIMESTAMP' em created_at, e ele não pode passar à frente das novas.
    const categoria = await criarCategoriaDeDespesa()
    ambiente.banco.run(
      `INSERT INTO cash_expenses (category_id, description, amount, expense_date, created_at)
       VALUES (?, 'Antiga', 10, '2026-05-05', 'CURRENT_TIMESTAMP')`,
      [categoria]
    )
    await criarDespesa(categoria, 'Nova')

    expect(await descricoes()).toEqual(['Nova', 'Antiga'])
  })
})
