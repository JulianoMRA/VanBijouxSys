import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prepararAmbienteIpc, type AmbienteIpc } from '../helpers/ambiente-ipc'
import { queryAll } from '../helpers/testDb'
import { MENSAGEM_PAYLOAD_INVALIDO } from '../../main/ipc/mensagens'
import type { Fair } from '../../shared/ipc/feiras'

vi.mock('electron', async () => (await import('../helpers/ambiente-ipc')).electronFalso)
vi.mock('../../main/database', async () => (await import('../helpers/ambiente-ipc')).bancoFalso)

let ambiente: AmbienteIpc

beforeEach(async () => {
  ambiente = await prepararAmbienteIpc()
})

function estado(): unknown {
  return ['fairs', 'fair_additional_costs'].map((t) =>
    queryAll(ambiente.banco, `SELECT * FROM ${t} ORDER BY id`)
  )
}

async function recusaSemGravar(canal: string, ...args: unknown[]): Promise<void> {
  const antes = estado()
  await expect(ambiente.chamar(canal, ...args)).rejects.toThrow(MENSAGEM_PAYLOAD_INVALIDO)
  expect(estado()).toEqual(antes)
}

/** Formato que o FairForm envia numa feira de um dia. */
const novaFeira = (): Record<string, unknown> => ({
  name: 'Feira do Bosque',
  location: 'Praça Central',
  organizer: undefined,
  date: '2026-05-16',
  endDate: undefined,
  enrollmentCost: 50,
  additionalCosts: []
})

describe('feiras: payloads das telas continuam aceitos', () => {
  it('should_create_a_one_day_fair_without_organizer_or_costs', async () => {
    await ambiente.chamar('fairs:create', novaFeira())

    const [feira] = await ambiente.chamar<Fair[]>('fairs:getAll')
    expect(feira).toMatchObject({
      name: 'Feira do Bosque',
      location: 'Praça Central',
      organizer: null,
      date: '2026-05-16',
      endDate: null,
      enrollmentCost: 50
    })
    expect(feira.additionalCosts).toEqual([])
  })

  it('should_create_a_multi_day_fair_with_organizer_and_costs', async () => {
    await ambiente.chamar('fairs:create', {
      ...novaFeira(),
      organizer: 'Associação',
      endDate: '2026-05-17',
      additionalCosts: [
        { description: 'Mesa', amount: 20 },
        { description: 'Transporte', amount: 35.5 }
      ]
    })

    const [feira] = await ambiente.chamar<Fair[]>('fairs:getAll')
    expect(feira).toMatchObject({ organizer: 'Associação', endDate: '2026-05-17' })
    expect(feira.additionalCosts.map((c) => [c.description, c.amount])).toEqual([
      ['Mesa', 20],
      ['Transporte', 35.5]
    ])
  })

  it('should_update_a_fair_replacing_its_costs_and_delete_it', async () => {
    const { id } = await ambiente.chamar<{ id: number }>('fairs:create', {
      ...novaFeira(),
      additionalCosts: [{ description: 'Mesa', amount: 20 }]
    })

    await ambiente.chamar('fairs:update', {
      ...novaFeira(),
      id: Number(id),
      enrollmentCost: 60,
      additionalCosts: [{ description: 'Estacionamento', amount: 12 }]
    })
    const [depois] = await ambiente.chamar<Fair[]>('fairs:getAll')
    expect(depois.enrollmentCost).toBe(60)
    expect(depois.additionalCosts.map((c) => c.description)).toEqual(['Estacionamento'])

    await ambiente.chamar('fairs:delete', Number(id))
    expect(await ambiente.chamar<Fair[]>('fairs:getAll')).toEqual([])
  })
})

describe('feiras: payload fora do formato é recusado sem gravar', () => {
  it('should_refuse_a_blank_name_or_location', async () => {
    await recusaSemGravar('fairs:create', { ...novaFeira(), name: '   ' })
    await recusaSemGravar('fairs:create', { ...novaFeira(), location: '' })
  })

  it('should_refuse_dates_that_are_not_dates', async () => {
    await recusaSemGravar('fairs:create', { ...novaFeira(), date: '' })
    await recusaSemGravar('fairs:create', { ...novaFeira(), date: '16/05/2026' })
    await recusaSemGravar('fairs:create', { ...novaFeira(), endDate: 'sábado' })
  })

  it('should_refuse_an_enrollment_cost_as_text_or_negative', async () => {
    await recusaSemGravar('fairs:create', { ...novaFeira(), enrollmentCost: '50,00' })
    await recusaSemGravar('fairs:create', { ...novaFeira(), enrollmentCost: -1 })
  })

  it('should_refuse_broken_additional_costs', async () => {
    await recusaSemGravar('fairs:create', { ...novaFeira(), additionalCosts: 'Mesa' })
    await recusaSemGravar('fairs:create', {
      ...novaFeira(),
      additionalCosts: [{ description: '  ', amount: 20 }]
    })
    await recusaSemGravar('fairs:create', {
      ...novaFeira(),
      additionalCosts: [{ description: 'Mesa', amount: '20,00' }]
    })
    await recusaSemGravar('fairs:create', {
      ...novaFeira(),
      additionalCosts: [{ description: 'Mesa' }]
    })
  })

  it('should_refuse_an_update_without_an_id_and_a_delete_without_a_number', async () => {
    await recusaSemGravar('fairs:update', novaFeira())
    await recusaSemGravar('fairs:delete', 'todas')
  })

  it('should_refuse_an_organizer_that_is_not_text', async () => {
    await recusaSemGravar('fairs:create', { ...novaFeira(), organizer: 42 })
  })
})
