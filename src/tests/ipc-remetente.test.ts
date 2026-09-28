import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { MENSAGEM_GENERICA } from '../main/ipc/mensagens'
import { soDoDocumentoDoApp, type EventoDeCanal } from '../main/ipc/remetente'
import { definirRegistro, type Registro } from '../main/registro'

const APP =
  'file:///C:/Users/van/AppData/Local/Programs/van-bijoux-sys/resources/app.asar/out/renderer/index.html'

type Ouvinte = (evento: EventoDeCanal, ...args: unknown[]) => unknown

let ouvintes: Map<string, Ouvinte>
let registro: { [K in keyof Registro]: Mock<Registro[K]> }
let documentoDoApp: string | null
let handler: Mock<(evento: unknown, ...args: unknown[]) => unknown>

function doFrame(url: string, { principal = true } = {}): EventoDeCanal {
  return { senderFrame: { url, parent: principal ? null : { url: APP } } }
}

function chamar(evento: EventoDeCanal, ...args: unknown[]): Promise<unknown> {
  return Promise.resolve().then(() => ouvintes.get('products:getAll')!(evento, ...args))
}

beforeEach(() => {
  ouvintes = new Map()
  registro = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  definirRegistro(registro)
  documentoDoApp = APP
  handler = vi.fn(() => 'ok')

  const canais = soDoDocumentoDoApp(
    { handle: (canal, ouvinte) => ouvintes.set(canal, ouvinte) },
    () => documentoDoApp
  )
  canais.handle('products:getAll', handler)
})

afterEach(() => {
  definirRegistro(console)
})

describe('soDoDocumentoDoApp: chamada do app', () => {
  it('should_run_the_handler_when_the_app_document_calls_from_any_screen', async () => {
    const evento = doFrame(`${APP}#/vendas`)

    await expect(chamar(evento, 7)).resolves.toBe('ok')
    expect(handler).toHaveBeenCalledWith(evento, 7)
  })
})

describe('soDoDocumentoDoApp: chamada de fora do app', () => {
  it('should_refuse_a_call_from_another_document_loaded_in_the_window', async () => {
    // O preload roda em qualquer página que carregue na janela; se uma navegação
    // escapar da guarda, a página estranha teria o window.api inteiro.
    for (const url of [
      'https://exemplo.invalido/',
      'file:///C:/Users/van/Downloads/pagina.html',
      'data:text/html,<p>oi</p>'
    ]) {
      await expect(chamar(doFrame(url))).rejects.toThrow(MENSAGEM_GENERICA)
    }
    expect(handler).not.toHaveBeenCalled()
  })

  it('should_refuse_a_call_from_a_frame_inside_the_page', async () => {
    await expect(chamar(doFrame(APP, { principal: false }))).rejects.toThrow(MENSAGEM_GENERICA)
    expect(handler).not.toHaveBeenCalled()
  })

  it('should_refuse_a_call_whose_frame_is_already_gone', async () => {
    await expect(chamar({ senderFrame: null })).rejects.toThrow(MENSAGEM_GENERICA)
    expect(handler).not.toHaveBeenCalled()
  })

  it('should_refuse_everything_before_the_window_loads_the_app', async () => {
    documentoDoApp = null

    await expect(chamar(doFrame(APP))).rejects.toThrow(MENSAGEM_GENERICA)
    expect(handler).not.toHaveBeenCalled()
  })

  it('should_log_the_refused_channel_and_where_the_call_came_from', async () => {
    await chamar(doFrame('https://exemplo.invalido/')).catch(() => undefined)

    expect(registro.error).toHaveBeenCalledWith(
      expect.stringContaining('[products:getAll]'),
      'https://exemplo.invalido/'
    )
  })
})
