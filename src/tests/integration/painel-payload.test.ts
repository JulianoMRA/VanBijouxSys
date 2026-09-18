import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prepararAmbienteIpc, type AmbienteIpc } from '../helpers/ambiente-ipc'
import { criarInsumo, criarVariacao, criarVenda } from '../helpers/estoque'
import { MENSAGEM_PAYLOAD_INVALIDO } from '../../main/ipc/mensagens'
import type { DashboardStats } from '../../shared/ipc/painel'

vi.mock('electron', async () => (await import('../helpers/ambiente-ipc')).electronFalso)
vi.mock('../../main/database', async () => (await import('../helpers/ambiente-ipc')).bancoFalso)

let ambiente: AmbienteIpc

beforeEach(async () => {
  ambiente = await prepararAmbienteIpc()
  const fio = await criarInsumo(ambiente, { stockQuantity: 500 })
  const variacao = await criarVariacao(ambiente, {
    receita: [{ insumoId: fio, quantity: 10 }],
    stockQuantity: 5,
    motivoDoEstoqueInicial: 'contagem'
  })
  await criarVenda(ambiente, {
    soldAt: '2026-05-10',
    items: [{ variationId: variacao, quantity: 2, unitPrice: 25, unitCost: 3 }]
  })
})

async function recusa(...args: unknown[]): Promise<void> {
  await expect(ambiente.chamar('dashboard:getStats', ...args)).rejects.toThrow(
    MENSAGEM_PAYLOAD_INVALIDO
  )
}

describe('painel: payloads da tela continuam aceitos', () => {
  it('should_accept_every_period_button_of_the_screen', async () => {
    for (const period of ['month', 'quarter', 'halfyear', 'year', 'all']) {
      const stats = await ambiente.chamar<DashboardStats>('dashboard:getStats', { period })
      expect(stats.overview).toBeDefined()
      expect(stats.cashSummary).toBeDefined()
    }
  })

  it('should_accept_a_custom_period_with_both_dates', async () => {
    const stats = await ambiente.chamar<DashboardStats>('dashboard:getStats', {
      period: 'custom',
      customFrom: '2026-05-01',
      customTo: '2026-05-31'
    })

    expect(stats.overview.totalRevenue).toBe(50)
    expect(stats.previousOverview).toBeNull()
  })

  it('should_accept_a_custom_period_with_only_the_start_date', async () => {
    const stats = await ambiente.chamar<DashboardStats>('dashboard:getStats', {
      period: 'custom',
      customFrom: '2026-05-01'
    })

    expect(stats.overview.totalRevenue).toBe(50)
  })
})

describe('painel: payload fora do formato é recusado', () => {
  it('should_refuse_an_unknown_period', async () => {
    await recusa({ period: 'semana' })
    await recusa({ period: '' })
  })

  it('should_refuse_a_call_without_parameters', async () => {
    await recusa()
    await recusa('month')
  })

  it('should_refuse_custom_dates_that_are_not_dates', async () => {
    await recusa({ period: 'custom', customFrom: '01/05/2026' })
    await recusa({ period: 'custom', customFrom: '2026-05-01', customTo: '2026-05-31 23:59:59' })
    await recusa({ period: 'custom', customFrom: 2026 })
  })
})

describe('painel: regra de negócio segue com a mensagem da usuária', () => {
  it('should_refuse_an_end_date_without_a_start_date', async () => {
    await expect(
      ambiente.chamar('dashboard:getStats', { period: 'custom', customTo: '2026-05-31' })
    ).rejects.toThrow('Informe a data inicial do período personalizado.')
  })
})
