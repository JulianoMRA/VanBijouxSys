import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi, type Mock } from 'vitest'
import { z } from 'zod'
import { registrarCanal, type RegistroDeCanais } from '../main/ipc/canal'
import { ErroDeNegocio, MENSAGEM_GENERICA, MENSAGEM_PAYLOAD_INVALIDO } from '../main/ipc/mensagens'
import { definirRegistro, type Registro } from '../main/registro'

type Handler = (evento: unknown, ...args: unknown[]) => unknown

let handlers: Map<string, Handler>
let ipc: { handle: (canal: string, fn: Handler) => void }
let registro: { [K in keyof Registro]: Mock<Registro[K]> }

function chamar(canal: string, ...args: unknown[]): Promise<unknown> {
  return Promise.resolve(handlers.get(canal)!({}, ...args))
}

beforeEach(() => {
  handlers = new Map()
  ipc = { handle: (canal, fn) => handlers.set(canal, fn) }
  registro = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  definirRegistro(registro)
})

afterEach(() => {
  definirRegistro(console)
})

const insumo = z.object({ nome: z.string().trim().min(1), quantidade: z.number().finite() })

describe('registrarCanal: argumentos válidos', () => {
  it('should_call_the_handler_with_the_parsed_arguments', async () => {
    const fn = vi.fn((dados: z.output<typeof insumo>) => dados)
    registrarCanal(ipc, 'insumos:create', [insumo], fn)

    await expect(chamar('insumos:create', { nome: '  Fio  ', quantidade: 3 })).resolves.toEqual({
      nome: 'Fio',
      quantidade: 3
    })
  })

  it('should_infer_the_handler_argument_types_from_the_schemas', () => {
    registrarCanal(ipc, 'insumos:addStock', [z.number().int(), z.number()], (id, quantidade) => {
      expectTypeOf(id).toEqualTypeOf<number>()
      expectTypeOf(quantidade).toEqualTypeOf<number>()
      return null
    })
  })

  it('should_accept_a_channel_without_arguments', async () => {
    registrarCanal(ipc, 'insumos:getAll', [], () => ['ok'])

    await expect(chamar('insumos:getAll')).resolves.toEqual(['ok'])
  })

  it('should_accept_a_trailing_optional_argument_missing_or_undefined', async () => {
    const filtros = z.object({ inicio: z.string() }).optional()
    registrarCanal(ipc, 'cash-expenses:getAll', [filtros], (f) => f ?? 'sem filtro')

    await expect(chamar('cash-expenses:getAll')).resolves.toBe('sem filtro')
    await expect(chamar('cash-expenses:getAll', undefined)).resolves.toBe('sem filtro')
    await expect(chamar('cash-expenses:getAll', { inicio: '2026-05-01' })).resolves.toEqual({
      inicio: '2026-05-01'
    })
  })
})

describe('registrarCanal: payload inválido', () => {
  it('should_refuse_without_calling_the_handler', async () => {
    const fn = vi.fn()
    registrarCanal(ipc, 'insumos:create', [insumo], fn)

    await expect(chamar('insumos:create', { nome: 'Fio', quantidade: '3' })).rejects.toThrow(
      MENSAGEM_PAYLOAD_INVALIDO
    )
    expect(fn).not.toHaveBeenCalled()
  })

  it('should_log_the_failing_fields_as_error_without_the_values', async () => {
    registrarCanal(ipc, 'insumos:create', [insumo], vi.fn())

    await chamar('insumos:create', { nome: 'Fio secreto', quantidade: Number.NaN }).catch(() => {})

    expect(registro.error).toHaveBeenCalledTimes(1)
    const [mensagem, detalhe] = registro.error.mock.calls[0]
    expect(mensagem).toBe('[insumos:create] payload inválido')
    expect(detalhe).toEqual([expect.objectContaining({ caminho: '0.quantidade' })])
    expect(JSON.stringify(detalhe)).not.toContain('Fio secreto')
  })

  it('should_refuse_extra_arguments', async () => {
    const fn = vi.fn()
    registrarCanal(ipc, 'insumos:delete', [z.number().int()], fn)

    await expect(chamar('insumos:delete', 1, 'sobrando')).rejects.toThrow(MENSAGEM_PAYLOAD_INVALIDO)
    expect(fn).not.toHaveBeenCalled()
  })

  it('should_refuse_a_missing_required_argument', async () => {
    const fn = vi.fn()
    registrarCanal(ipc, 'insumos:delete', [z.number().int()], fn)

    await expect(chamar('insumos:delete')).rejects.toThrow(MENSAGEM_PAYLOAD_INVALIDO)
    expect(fn).not.toHaveBeenCalled()
  })
})

describe('registrarCanal: falha dentro do handler', () => {
  it('should_keep_a_business_refusal_as_warning_with_its_own_message', async () => {
    const recusa = new ErroDeNegocio('Este insumo está em uso.')
    registrarCanal(ipc, 'insumos:delete', [z.number()], () => {
      throw recusa
    })

    await expect(chamar('insumos:delete', 1)).rejects.toThrow('Este insumo está em uso.')
    expect(registro.warn).toHaveBeenCalledWith('[insumos:delete]', recusa)
    expect(registro.error).not.toHaveBeenCalled()
  })

  it('should_translate_an_unexpected_error_into_the_generic_message', async () => {
    const falha = new Error('SqliteError: disk I/O error')
    registrarCanal(ipc, 'insumos:delete', [z.number()], async () => {
      throw falha
    })

    await expect(chamar('insumos:delete', 1)).rejects.toThrow(MENSAGEM_GENERICA)
    expect(registro.error).toHaveBeenCalledWith('[insumos:delete]', falha)
  })
})

describe('registrarCanal: tipo do registro', () => {
  it('should_accept_the_electron_ipc_main_as_the_channel_registry', () => {
    expectTypeOf<import('electron').IpcMain>().toExtend<RegistroDeCanais>()
  })
})
