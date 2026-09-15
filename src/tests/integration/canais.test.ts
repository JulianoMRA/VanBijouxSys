import { describe, expect, it, vi } from 'vitest'
import { prepararAmbienteIpc } from '../helpers/ambiente-ipc'
import { CANAIS_IPC } from '../../shared/ipc/channels'

vi.mock('electron', async () => (await import('../helpers/ambiente-ipc')).electronFalso)
vi.mock('../../main/database', async () => (await import('../helpers/ambiente-ipc')).bancoFalso)
// O backup só é registrado aqui; atualizar e copiar o banco não fazem parte deste teste.
vi.mock('../../main/updater', () => ({ verificarAtualizacoesManual: vi.fn() }))
vi.mock('../../main/database/backup', () => ({
  criarBackup: vi.fn(),
  getBackupDir: vi.fn(),
  restaurarBackup: vi.fn(),
  validarBackup: vi.fn()
}))

describe('canais IPC', () => {
  it('should_register_exactly_the_channels_the_preload_knows', async () => {
    const ambiente = await prepararAmbienteIpc()
    const { registerBackupHandlers } = await import('../../main/ipc/backup')
    registerBackupHandlers()

    const conhecidos = Object.values(CANAIS_IPC).flatMap((grupo) => Object.values(grupo))

    expect([...ambiente.canais()].sort()).toEqual([...conhecidos].sort())
    expect(conhecidos).toHaveLength(47)
  })
})
