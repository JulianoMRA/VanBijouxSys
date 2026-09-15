import { z } from 'zod'
import { registro } from '../registro'
import { ErroDeNegocio, MENSAGEM_PAYLOAD_INVALIDO, mensagemPara } from './mensagens'

/**
 * O pedaço do `ipcMain` que os canais usam. O `ipcMain` do Electron encaixa aqui, e
 * os testes passam um registro próprio sem simular o módulo `electron`.
 */
export interface RegistroDeCanais {
  handle(canal: string, listener: (evento: unknown, ...args: unknown[]) => unknown): void
}

type Argumentos<Esquemas extends readonly z.ZodType[]> = {
  -readonly [K in keyof Esquemas]: z.output<Esquemas[K]>
}

/**
 * Executa o handler com a política de erro dos canais: sempre falha por exceção,
 * nunca por valor de retorno, e o texto que chega à tela é para a usuária ler.
 */
export async function executarCanal<R>(canal: string, fn: () => R | Promise<R>): Promise<R> {
  try {
    return await fn()
  } catch (err) {
    // Recusa de negócio é esperada e já tem texto para a usuária; como `warn`,
    // não se confunde no log com a falha que precisa de investigação.
    if (err instanceof ErroDeNegocio) registro.warn(`[${canal}]`, err)
    else registro.error(`[${canal}]`, err)
    throw new Error(mensagemPara(canal, err))
  }
}

/**
 * Registra um canal que valida os argumentos antes de chamar o handler. Payload
 * fora do formato é recusado sem executar nada, e o log recebe só o caminho e o
 * tipo de cada problema, nunca os valores, que são dados do negócio.
 *
 * Os argumentos são validados como tupla: faltar um obrigatório ou sobrar um
 * argumento também é recusa. Um opcional no fim pode vir ausente ou `undefined`.
 */
export function registrarCanal<const Esquemas extends readonly z.ZodType[], R>(
  ipc: RegistroDeCanais,
  canal: string,
  esquemas: Esquemas,
  fn: (...args: Argumentos<Esquemas>) => R | Promise<R>
): void {
  const validador = z.tuple(esquemas as unknown as [z.ZodType, ...z.ZodType[]])

  ipc.handle(canal, async (_evento, ...args: unknown[]) => {
    const resultado = validador.safeParse(args)
    if (!resultado.success) {
      registro.error(
        `[${canal}] payload inválido`,
        resultado.error.issues.map((problema) => ({
          caminho: problema.path.join('.'),
          codigo: problema.code,
          mensagem: problema.message
        }))
      )
      throw new Error(MENSAGEM_PAYLOAD_INVALIDO)
    }
    return executarCanal(canal, () => fn(...(resultado.data as Argumentos<Esquemas>)))
  })
}
