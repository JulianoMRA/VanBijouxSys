import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prepararAmbienteIpc, type AmbienteIpc } from '../helpers/ambiente-ipc'

vi.mock('electron', async () => (await import('../helpers/ambiente-ipc')).electronFalso)
vi.mock('../../main/database', async () => (await import('../helpers/ambiente-ipc')).bancoFalso)

interface Despesa {
  id: number
  categoryId: number
  categoryName: string
  description: string
  amount: number
  expenseDate: string
  notes: string | null
}

let ambiente: AmbienteIpc
let material: number

async function criarCategoria(name: string): Promise<number> {
  const { id } = await ambiente.chamar<{ id: number }>('expense-categories:create', { name })
  return Number(id)
}

async function criarDespesa(dados: Partial<Omit<Despesa, 'id' | 'categoryName'>>): Promise<number> {
  const { id } = await ambiente.chamar<{ id: number }>('cash-expenses:create', {
    categoryId: material,
    description: 'Compra de fio',
    amount: 40,
    expenseDate: '2026-05-05',
    ...dados
  })
  return Number(id)
}

beforeEach(async () => {
  ambiente = await prepararAmbienteIpc()
  material = await criarCategoria('Material')
})

describe('categorias de despesa', () => {
  it('should_list_categories_in_alphabetical_order', async () => {
    await criarCategoria('Transporte')
    await criarCategoria('Embalagem')

    const lista = await ambiente.chamar<Array<{ name: string }>>('expense-categories:getAll')

    expect(lista.map((c) => c.name)).toEqual(['Embalagem', 'Material', 'Transporte'])
  })

  it('should_refuse_a_duplicate_name_with_a_message_for_the_user', async () => {
    await expect(criarCategoria('Material')).rejects.toThrow(
      'Já existe uma categoria com esse nome.'
    )
  })

  it('should_refuse_renaming_to_an_existing_name', async () => {
    const transporte = await criarCategoria('Transporte')

    await expect(
      ambiente.chamar('expense-categories:update', { id: transporte, name: 'Material' })
    ).rejects.toThrow('Já existe uma categoria com esse nome.')
  })

  it('should_rename_a_category', async () => {
    await ambiente.chamar('expense-categories:update', { id: material, name: 'Materiais' })

    const lista = await ambiente.chamar<Array<{ name: string }>>('expense-categories:getAll')
    expect(lista.map((c) => c.name)).toEqual(['Materiais'])
  })

  it('should_refuse_deleting_a_category_with_expenses', async () => {
    await criarDespesa({})

    await expect(ambiente.chamar('expense-categories:delete', material)).rejects.toThrow(
      'Esta categoria possui despesas vinculadas. Remova as despesas antes de excluir.'
    )
    expect(await ambiente.chamar<unknown[]>('expense-categories:getAll')).toHaveLength(1)
  })

  it('should_delete_a_category_without_expenses', async () => {
    await ambiente.chamar('expense-categories:delete', material)

    expect(await ambiente.chamar<unknown[]>('expense-categories:getAll')).toEqual([])
  })
})

describe('despesas', () => {
  const listar = (filtros?: object): Promise<Despesa[]> =>
    ambiente.chamar<Despesa[]>('cash-expenses:getAll', filtros)

  it('should_store_an_expense_with_its_category_name_and_empty_notes', async () => {
    await criarDespesa({ description: 'Fecho', amount: 12.5, expenseDate: '2026-05-06' })

    expect(await listar()).toMatchObject([
      {
        categoryId: material,
        categoryName: 'Material',
        description: 'Fecho',
        amount: 12.5,
        expenseDate: '2026-05-06',
        notes: null
      }
    ])
  })

  it('should_list_the_most_recent_expense_date_first', async () => {
    await criarDespesa({ description: 'Antiga', expenseDate: '2026-04-01' })
    await criarDespesa({ description: 'Nova', expenseDate: '2026-05-20' })

    expect((await listar()).map((d) => d.description)).toEqual(['Nova', 'Antiga'])
  })

  it('should_filter_by_period_and_category', async () => {
    const transporte = await criarCategoria('Transporte')
    await criarDespesa({ description: 'Abril', expenseDate: '2026-04-30' })
    await criarDespesa({ description: 'Maio material', expenseDate: '2026-05-01' })
    await criarDespesa({
      description: 'Maio transporte',
      expenseDate: '2026-05-31',
      categoryId: transporte
    })
    await criarDespesa({ description: 'Junho', expenseDate: '2026-06-01' })

    const maio = await listar({ startDate: '2026-05-01', endDate: '2026-05-31' })
    const maioTransporte = await listar({
      startDate: '2026-05-01',
      endDate: '2026-05-31',
      categoryId: transporte
    })

    expect(maio.map((d) => d.description).sort()).toEqual(['Maio material', 'Maio transporte'])
    expect(maioTransporte.map((d) => d.description)).toEqual(['Maio transporte'])
  })

  it('should_update_every_field_and_clear_notes_left_empty', async () => {
    const transporte = await criarCategoria('Transporte')
    const despesa = await criarDespesa({ notes: 'nota antiga' })

    await ambiente.chamar('cash-expenses:update', {
      id: despesa,
      categoryId: transporte,
      description: 'Uber',
      amount: 22,
      expenseDate: '2026-05-07'
    })

    expect(await listar()).toMatchObject([
      {
        categoryName: 'Transporte',
        description: 'Uber',
        amount: 22,
        expenseDate: '2026-05-07',
        notes: null
      }
    ])
  })

  it('should_delete_an_expense', async () => {
    const despesa = await criarDespesa({})

    await ambiente.chamar('cash-expenses:delete', despesa)

    expect(await listar()).toEqual([])
  })
})

describe('saldo de abertura do caixa', () => {
  it('should_start_with_zero_opening_balance', async () => {
    const saldo = await ambiente.chamar<{ openingBalance: number }>('cash-settings:get')

    expect(saldo.openingBalance).toBe(0)
  })

  it('should_store_the_opening_balance', async () => {
    await ambiente.chamar('cash-settings:setOpeningBalance', 150.75)

    const saldo = await ambiente.chamar<{ openingBalance: number }>('cash-settings:get')
    expect(saldo.openingBalance).toBe(150.75)
  })
})
