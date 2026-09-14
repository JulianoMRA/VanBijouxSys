import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { ErroDeNegocio, handleIpc } from '../main/ipc/handle'
import { MENSAGEM_GENERICA } from '../main/ipc/mensagens'
import { definirRegistro, type Registro } from '../main/registro'

type Handler = (...args: unknown[]) => unknown

const { handlers } = vi.hoisted(() => ({ handlers: new Map<string, Handler>() }))

vi.mock('electron', () => ({
  ipcMain: { handle: (canal: string, fn: Handler) => handlers.set(canal, fn) }
}))

function chamar(canal: string, ...args: unknown[]): Promise<unknown> {
  const handler = handlers.get(canal)
  if (!handler) throw new Error(`canal IPC não registrado: ${canal}`)
  return Promise.resolve(handler({}, ...args))
}

let registro: { [K in keyof Registro]: Mock<Registro[K]> }

beforeEach(() => {
  handlers.clear()
  registro = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  definirRegistro(registro)
})

afterEach(() => {
  definirRegistro(console)
})

describe('handleIpc', () => {
  it('should_log_channel_and_original_error_when_handler_fails_unexpectedly', async () => {
    const falha = new Error('SqliteError: disk I/O error')
    handleIpc('sales:create', () => {
      throw falha
    })

    await expect(chamar('sales:create')).rejects.toThrow(MENSAGEM_GENERICA)

    expect(registro.error).toHaveBeenCalledWith('[sales:create]', falha)
    expect(registro.warn).not.toHaveBeenCalled()
  })

  it('should_log_business_refusal_as_warning_not_error', async () => {
    const recusa = new ErroDeNegocio('O arquivo não é um backup do Van Bijoux Sys.')
    handleIpc('backup:restaurar', async () => {
      throw recusa
    })

    await expect(chamar('backup:restaurar')).rejects.toThrow(recusa.message)

    expect(registro.warn).toHaveBeenCalledWith('[backup:restaurar]', recusa)
    expect(registro.error).not.toHaveBeenCalled()
  })

  it('should_not_log_when_handler_succeeds', async () => {
    handleIpc('insumos:list', (filtro: unknown) => ({ filtro }))

    await expect(chamar('insumos:list', 'ativos')).resolves.toEqual({ filtro: 'ativos' })

    expect(registro.error).not.toHaveBeenCalled()
    expect(registro.warn).not.toHaveBeenCalled()
  })
})
