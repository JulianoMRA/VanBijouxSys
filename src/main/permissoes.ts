import type { Session } from 'electron'

export type SessaoComPermissoes = Pick<
  Session,
  'setPermissionRequestHandler' | 'setPermissionCheckHandler'
>

/**
 * O app não usa câmera, microfone, notificação, localização, área de transferência
 * nem outra permissão do navegador, e o Electron concede todas quando ninguém
 * responde. Negar tudo tira isso de qualquer página que venha a carregar na janela.
 */
export function negarPermissoesDoNavegador(sessao: SessaoComPermissoes): void {
  sessao.setPermissionRequestHandler((_conteudo, _permissao, responder) => responder(false))
  sessao.setPermissionCheckHandler(() => false)
}
