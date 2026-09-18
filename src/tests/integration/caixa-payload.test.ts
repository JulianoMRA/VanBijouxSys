import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prepararAmbienteIpc, type AmbienteIpc } from '../helpers/ambiente-ipc'
import { queryAll } from '../helpers/testDb'
import { MENSAGEM_PAYLOAD_INVALIDO } from '../../main/ipc/mensagens'
import type { CashExpense, CashSettings, ExpenseCategory } from '../../shared/ipc/caixa'

vi.mock('electron', async () => (await import('../helpers/ambiente-ipc')).electronFalso)
vi.mock('../../main/database', async () => (await import('../helpers/ambiente-ipc')).bancoFalso)

let ambiente: AmbienteIpc
let material: number

beforeEach(async () => {
  ambiente = await prepararAmbienteIpc()
  const { id } = await ambiente.chamar<{ id: number }>('expense-categories:create', {
    name: 'Material'
  })
  material = Number(id)
})

function estado(): unknown {
  return ['expense_categories', 'cash_expenses', 'cash_settings'].map((t) =>
    queryAll(ambiente.banco, `SELECT * FROM ${t} ORDER BY id`)
  )
}

async function recusaSemGravar(canal: string, ...args: unknown[]): Promise<void> {
  const antes = estado()
  await expect(ambiente.chamar(canal, ...args)).rejects.toThrow(MENSAGEM_PAYLOAD_INVALIDO)
  expect(estado()).toEqual(antes)
}

/** Formato que o ExpenseForm envia. */
const novaDespesa = (): Record<string, unknown> => ({
  categoryId: material,
  description: 'Compra de fio',
  amount: 40.5,
  expenseDate: '2026-05-05',
  notes: undefined
})

describe('caixa: payloads das telas continuam aceitos', () => {
  it('should_create_and_update_a_category', async () => {
    await ambiente.chamar('expense-categories:update', { id: material, name: 'Materiais' })

    const lista = await ambiente.chamar<ExpenseCategory[]>('expense-categories:getAll')
    expect(lista.map((c) => c.name)).toEqual(['Materiais'])
  })

  it('should_create_an_expense_with_and_without_notes', async () => {
    await ambiente.chamar('cash-expenses:create', novaDespesa())
    await ambiente.chamar('cash-expenses:create', {
      ...novaDespesa(),
      description: 'Feira',
      notes: 'pago em dinheiro'
    })

    const despesas = await ambiente.chamar<CashExpense[]>('cash-expenses:getAll')
    expect(despesas.map((d) => [d.description, d.notes, d.amount, d.categoryName])).toEqual([
      ['Feira', 'pago em dinheiro', 40.5, 'Material'],
      ['Compra de fio', null, 40.5, 'Material']
    ])
  })

  it('should_accept_the_screen_filters_and_no_filter_at_all', async () => {
    await ambiente.chamar('cash-expenses:create', novaDespesa())
    await ambiente.chamar('cash-expenses:create', {
      ...novaDespesa(),
      description: 'Junho',
      expenseDate: '2026-06-10'
    })

    expect(await ambiente.chamar<CashExpense[]>('cash-expenses:getAll')).toHaveLength(2)
    expect(await ambiente.chamar<CashExpense[]>('cash-expenses:getAll', undefined)).toHaveLength(2)
    const doMes = await ambiente.chamar<CashExpense[]>('cash-expenses:getAll', {
      startDate: '2026-05-01',
      endDate: '2026-05-31',
      categoryId: material
    })
    expect(doMes.map((d) => d.description)).toEqual(['Compra de fio'])
  })

  it('should_accept_updating_and_deleting_an_expense', async () => {
    const { id } = await ambiente.chamar<{ id: number }>('cash-expenses:create', novaDespesa())

    await ambiente.chamar('cash-expenses:update', {
      ...novaDespesa(),
      id: Number(id),
      amount: 12,
      notes: 'corrigido'
    })
    const [depois] = await ambiente.chamar<CashExpense[]>('cash-expenses:getAll')
    expect(depois).toMatchObject({ amount: 12, notes: 'corrigido' })

    await ambiente.chamar('cash-expenses:delete', Number(id))
    expect(await ambiente.chamar<CashExpense[]>('cash-expenses:getAll')).toEqual([])
  })

  it('should_accept_the_opening_balance_the_screen_sends', async () => {
    await ambiente.chamar('cash-settings:setOpeningBalance', 150.75)

    const config = await ambiente.chamar<CashSettings>('cash-settings:get')
    expect(config.openingBalance).toBe(150.75)
  })

  it('should_accept_the_stats_channel_with_and_without_a_period', async () => {
    await ambiente.chamar('cash-expenses:create', novaDespesa())

    expect(await ambiente.chamar('cash-expenses:getStats')).toMatchObject({ totalExpenses: 40.5 })
    expect(
      await ambiente.chamar('cash-expenses:getStats', {
        startDate: '2026-06-01',
        endDate: '2026-06-30'
      })
    ).toMatchObject({ totalExpenses: 0 })
  })
})

describe('caixa: payload fora do formato é recusado sem gravar', () => {
  it('should_refuse_a_category_with_a_blank_name_or_without_an_id', async () => {
    await recusaSemGravar('expense-categories:create', { name: '   ' })
    await recusaSemGravar('expense-categories:update', { name: 'Sem id' })
    await recusaSemGravar('expense-categories:delete', 'Material')
  })

  it('should_refuse_an_expense_without_a_category_or_with_a_blank_description', async () => {
    await recusaSemGravar('cash-expenses:create', { ...novaDespesa(), categoryId: 'Material' })
    await recusaSemGravar('cash-expenses:create', { ...novaDespesa(), description: '  ' })
  })

  it('should_refuse_an_amount_sent_as_text_zero_or_negative', async () => {
    await recusaSemGravar('cash-expenses:create', { ...novaDespesa(), amount: '40,50' })
    await recusaSemGravar('cash-expenses:create', { ...novaDespesa(), amount: 0 })
    await recusaSemGravar('cash-expenses:create', { ...novaDespesa(), amount: -40 })
  })

  it('should_refuse_an_expense_date_that_is_not_a_date', async () => {
    await recusaSemGravar('cash-expenses:create', { ...novaDespesa(), expenseDate: '' })
    await recusaSemGravar('cash-expenses:create', { ...novaDespesa(), expenseDate: '05/05/2026' })
  })

  it('should_refuse_notes_that_are_not_text', async () => {
    await recusaSemGravar('cash-expenses:create', { ...novaDespesa(), notes: 12 })
  })

  it('should_refuse_updating_an_expense_without_an_id', async () => {
    await recusaSemGravar('cash-expenses:update', novaDespesa())
    await recusaSemGravar('cash-expenses:delete', '1')
  })

  it('should_refuse_a_filter_with_a_broken_date_or_category', async () => {
    await recusaSemGravar('cash-expenses:getAll', { startDate: 'maio' })
    await recusaSemGravar('cash-expenses:getAll', { categoryId: 0 })
    await recusaSemGravar('cash-expenses:getStats', { endDate: '2026-13' })
  })

  it('should_refuse_an_opening_balance_that_is_text_or_negative', async () => {
    await recusaSemGravar('cash-settings:setOpeningBalance', '150,75')
    await recusaSemGravar('cash-settings:setOpeningBalance', -10)
  })
})
