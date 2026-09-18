import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prepararAmbienteIpc, type AmbienteIpc } from '../helpers/ambiente-ipc'
import { queryOne } from '../helpers/testDb'
import { criarVariacao, criarVenda } from '../helpers/estoque'
import type { DashboardStats } from '../../shared/ipc/painel'
import type { CreateFairInput } from '../../renderer/src/types'

vi.mock('electron', async () => (await import('../helpers/ambiente-ipc')).electronFalso)
vi.mock('../../main/database', async () => (await import('../helpers/ambiente-ipc')).bancoFalso)

interface Feira {
  id: number
  name: string
  location: string
  organizer: string | null
  date: string
  endDate: string | null
  enrollmentCost: number
  additionalCosts: Array<{ description: string; amount: number }>
}

let ambiente: AmbienteIpc

async function criarFeira(dados: Partial<CreateFairInput> = {}): Promise<number> {
  const { id } = await ambiente.chamar<{ id: number }>('fairs:create', {
    name: 'Feira do Bosque',
    location: 'Praça',
    date: '2026-05-16',
    enrollmentCost: 50,
    additionalCosts: [],
    ...dados
  })
  return Number(id)
}

const listar = (): Promise<Feira[]> => ambiente.chamar<Feira[]>('fairs:getAll')

beforeEach(async () => {
  ambiente = await prepararAmbienteIpc()
})

describe('fairs:create e fairs:getAll', () => {
  it('should_store_the_fair_with_its_additional_costs', async () => {
    await criarFeira({
      organizer: 'Associação',
      endDate: '2026-05-17',
      additionalCosts: [
        { description: 'Mesa', amount: 20 },
        { description: 'Transporte', amount: 35.5 }
      ]
    })

    expect(await listar()).toMatchObject([
      {
        name: 'Feira do Bosque',
        location: 'Praça',
        organizer: 'Associação',
        date: '2026-05-16',
        endDate: '2026-05-17',
        enrollmentCost: 50,
        additionalCosts: [
          { description: 'Mesa', amount: 20 },
          { description: 'Transporte', amount: 35.5 }
        ]
      }
    ])
  })

  it('should_store_missing_organizer_and_end_date_as_null', async () => {
    await criarFeira()

    expect(await listar()).toMatchObject([{ organizer: null, endDate: null, additionalCosts: [] }])
  })

  it('should_list_fairs_by_date', async () => {
    await criarFeira({ name: 'Junho', date: '2026-06-06' })
    await criarFeira({ name: 'Abril', date: '2026-04-04' })

    expect((await listar()).map((f) => f.name)).toEqual(['Abril', 'Junho'])
  })
})

describe('fairs:update', () => {
  it('should_replace_the_additional_costs_instead_of_appending', async () => {
    const feira = await criarFeira({ additionalCosts: [{ description: 'Mesa', amount: 20 }] })

    await ambiente.chamar('fairs:update', {
      id: feira,
      name: 'Feira do Bosque',
      location: 'Praça nova',
      date: '2026-05-16',
      enrollmentCost: 60,
      additionalCosts: [
        { description: 'Mesa', amount: 25 },
        { description: 'Toldo', amount: 40 }
      ]
    })

    const [salva] = await listar()
    expect(salva).toMatchObject({ location: 'Praça nova', enrollmentCost: 60 })
    expect(salva.additionalCosts.map((c) => [c.description, c.amount])).toEqual([
      ['Mesa', 25],
      ['Toldo', 40]
    ])
  })

  it('should_clear_organizer_and_end_date_when_they_are_removed', async () => {
    const feira = await criarFeira({ organizer: 'Associação', endDate: '2026-05-17' })

    await ambiente.chamar('fairs:update', {
      id: feira,
      name: 'Feira do Bosque',
      location: 'Praça',
      date: '2026-05-16',
      enrollmentCost: 50,
      additionalCosts: []
    })

    expect(await listar()).toMatchObject([{ organizer: null, endDate: null }])
  })
})

describe('fairs:delete', () => {
  it('should_take_the_additional_costs_along_with_the_fair', async () => {
    const feira = await criarFeira({ additionalCosts: [{ description: 'Mesa', amount: 20 }] })

    await ambiente.chamar('fairs:delete', feira)

    expect(await listar()).toEqual([])
    expect(
      queryOne<{ n: number }>(ambiente.banco, 'SELECT COUNT(*) AS n FROM fair_additional_costs')!.n
    ).toBe(0)
  })
})

describe('feira no painel', () => {
  it('should_subtract_enrollment_and_additional_costs_from_the_fair_profit', async () => {
    const variacao = await criarVariacao(ambiente, {
      receita: [],
      stockQuantity: 10,
      motivoDoEstoqueInicial: 'contagem'
    })
    const feira = await criarFeira({
      date: '2026-05-16',
      endDate: '2026-05-17',
      enrollmentCost: 50,
      additionalCosts: [{ description: 'Mesa', amount: 20 }]
    })
    await criarVenda(ambiente, {
      channel: 'Feira',
      fairId: feira,
      soldAt: '2026-05-16',
      items: [{ variationId: variacao, quantity: 4, unitPrice: 30, unitCost: 5 }]
    })
    await criarVenda(ambiente, {
      channel: 'Feira',
      fairId: feira,
      soldAt: '2026-05-17',
      items: [{ variationId: variacao, quantity: 1, unitPrice: 30, unitCost: 5 }]
    })

    const painel = await ambiente.chamar<DashboardStats>('dashboard:getStats', {
      period: 'custom',
      customFrom: '2026-05-01',
      customTo: '2026-05-31'
    })

    expect(painel.salesByFair).toMatchObject([
      {
        fairName: 'Feira do Bosque',
        revenue: 150,
        profit: 125,
        enrollmentCost: 50,
        additionalCosts: 20,
        netProfit: 55,
        dailyBreakdown: [
          { day: '2026-05-16', revenue: 120, salesCount: 1 },
          { day: '2026-05-17', revenue: 30, salesCount: 1 }
        ]
      }
    ])
    expect(painel.cashSummary.totalExpenses).toBe(70)
    expect(painel.cashFlow).toEqual([{ month: '2026-05', income: 150, expenses: 70 }])
  })
})
