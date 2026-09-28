import { afterEach, describe, expect, it, vi } from 'vitest'
import { prepararAmbienteIpc } from '../helpers/ambiente-ipc'
import { definirRegistro } from '../../main/registro'
import { MENSAGEM_PAYLOAD_INVALIDO } from '../../main/ipc/mensagens'

vi.mock('electron', async () => (await import('../helpers/ambiente-ipc')).electronFalso)
vi.mock('../../main/database', async () => (await import('../helpers/ambiente-ipc')).bancoFalso)

afterEach(() => {
  definirRegistro(console)
})

function registroFalso(): {
  info: ReturnType<typeof vi.fn>
  warn: ReturnType<typeof vi.fn>
  error: ReturnType<typeof vi.fn>
} {
  const registro = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  definirRegistro(registro)
  return registro
}

describe('app:registrarErroDaTela', () => {
  it('should_write_the_screen_error_to_the_app_log', async () => {
    // O app empacotado não tem console: sem este canal, erro de tela só existia na
    // janela dela, e nunca no main.log.
    const registro = registroFalso()
    const ambiente = await prepararAmbienteIpc()

    await ambiente.chamar('app:registrarErroDaTela', {
      origem: 'renderizacao',
      mensagem: "Cannot read properties of null (reading 'split')",
      detalhe: 'at formatMonth (dashboard-calculations.ts)'
    })

    expect(registro.error).toHaveBeenCalledWith(
      expect.stringContaining("Cannot read properties of null (reading 'split')"),
      expect.stringContaining('at formatMonth')
    )
  })

  it('should_refuse_a_message_too_long_for_the_log', async () => {
    registroFalso()
    const ambiente = await prepararAmbienteIpc()

    await expect(
      ambiente.chamar('app:registrarErroDaTela', { origem: 'promessa', mensagem: 'x'.repeat(2001) })
    ).rejects.toThrow(MENSAGEM_PAYLOAD_INVALIDO)
  })

  it('should_refuse_an_unknown_origin', async () => {
    registroFalso()
    const ambiente = await prepararAmbienteIpc()

    await expect(
      ambiente.chamar('app:registrarErroDaTela', { origem: 'qualquer', mensagem: 'falhou' })
    ).rejects.toThrow(MENSAGEM_PAYLOAD_INVALIDO)
  })
})
