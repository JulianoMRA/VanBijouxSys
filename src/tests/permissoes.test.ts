import { describe, expect, it, vi } from 'vitest'
import { negarPermissoesDoNavegador, type SessaoComPermissoes } from '../main/permissoes'

type PedidoDePermissao = Parameters<SessaoComPermissoes['setPermissionRequestHandler']>[0]
type ChecagemDePermissao = Parameters<SessaoComPermissoes['setPermissionCheckHandler']>[0]

function sessaoFalsa(): {
  sessao: SessaoComPermissoes
  pedido: () => NonNullable<PedidoDePermissao>
  checagem: () => NonNullable<ChecagemDePermissao>
} {
  let pedido: PedidoDePermissao = null
  let checagem: ChecagemDePermissao = null
  return {
    sessao: {
      setPermissionRequestHandler: (handler) => {
        pedido = handler
      },
      setPermissionCheckHandler: (handler) => {
        checagem = handler
      }
    },
    pedido: () => pedido!,
    checagem: () => checagem!
  }
}

const PERMISSOES = [
  'media',
  'geolocation',
  'notifications',
  'clipboard-read',
  'openExternal',
  'fileSystem'
] as const

describe('negarPermissoesDoNavegador', () => {
  it('should_deny_every_permission_a_page_asks_for', () => {
    // Sem handler, o Electron concede todas; o app não usa nenhuma.
    const { sessao, pedido } = sessaoFalsa()
    negarPermissoesDoNavegador(sessao)

    for (const permissao of PERMISSOES) {
      const responder = vi.fn()
      pedido()({} as never, permissao, responder, {} as never)
      expect(responder).toHaveBeenCalledWith(false)
    }
  })

  it('should_answer_no_when_a_page_checks_a_permission', () => {
    const { sessao, checagem } = sessaoFalsa()
    negarPermissoesDoNavegador(sessao)

    for (const permissao of PERMISSOES) {
      expect(checagem()(null, permissao, 'file:///', {} as never)).toBe(false)
    }
  })
})
