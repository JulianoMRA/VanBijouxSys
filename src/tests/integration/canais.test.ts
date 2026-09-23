import { describe, expect, it, vi } from 'vitest'
import { prepararAmbienteIpc } from '../helpers/ambiente-ipc'
import { CANAIS_IPC } from '../../shared/ipc/channels'

vi.mock('electron', async () => (await import('../helpers/ambiente-ipc')).electronFalso)
vi.mock('../../main/database', async () => (await import('../helpers/ambiente-ipc')).bancoFalso)
describe('canais IPC', () => {
  it('should_register_exactly_the_channels_the_preload_knows', async () => {
    const ambiente = await prepararAmbienteIpc()

    const conhecidos = Object.values(CANAIS_IPC).flatMap((grupo) => Object.values(grupo))

    expect([...ambiente.canais()].sort()).toEqual([...conhecidos].sort())
    // 47 até a 1.14; o recebimento em pagamentos troca markAsReceived por
    // registerPayment e deletePayment.
    expect(conhecidos).toHaveLength(48)
  })
})
