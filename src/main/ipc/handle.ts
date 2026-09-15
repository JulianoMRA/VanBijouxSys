import { ipcMain } from 'electron'
import { executarCanal } from './canal'

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
  ipcMain.handle(canal, (_event, ...args) => executarCanal(canal, () => fn(...(args as Args))))
}
