import { ipcMain } from 'electron'
import { registro } from '../registro'
import { ErroDeNegocio, mensagemPara } from './mensagens'

export { ErroDeNegocio } from './mensagens'

/**
 * Registra um handler IPC que sempre falha por exceção, nunca por valor de
 * retorno. Handlers que devolviam `{ success: false }` faziam o `catch` do
 * renderer nunca disparar, e a operação falhava sem nenhum aviso na tela.
 */
export function handleIpc<Args extends unknown[], R>(
  canal: string,
  fn: (...args: Args) => R | Promise<R>
): void {
  ipcMain.handle(canal, async (_event, ...args) => {
    try {
      return await fn(...(args as Args))
    } catch (err) {
      // Recusa de negócio é esperada e já tem texto para a usuária; como `warn`,
      // não se confunde no log com a falha que precisa de investigação.
      if (err instanceof ErroDeNegocio) registro.warn(`[${canal}]`, err)
      else registro.error(`[${canal}]`, err)
      throw new Error(mensagemPara(canal, err))
    }
  })
}
