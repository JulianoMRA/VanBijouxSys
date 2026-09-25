import type { ErroDaTela } from '../types'

/** Os mesmos limites do schema do canal: acima deles, o main recusaria. */
const LIMITE_DA_MENSAGEM = 2000
const LIMITE_DO_DETALHE = 8000
/** Um erro repetido em laço não pode encher o log: depois disso, a tela para de mandar. */
const LIMITE_POR_SESSAO = 50

let enviados = 0

/**
 * Manda o erro da tela para o log do app (`main.log`): o app empacotado não tem
 * console, e sem isto o erro só existia na janela dela. Registrar não pode virar outro
 * erro, então a falha do próprio canal é engolida.
 */
export function registrarErroDaTela(
  origem: ErroDaTela['origem'],
  erro: unknown,
  extra?: string
): void {
  if (enviados >= LIMITE_POR_SESSAO) return
  enviados += 1

  const mensagem = (erro instanceof Error ? erro.message : String(erro)).slice(
    0,
    LIMITE_DA_MENSAGEM
  )
  const detalhe = [erro instanceof Error ? erro.stack : undefined, extra]
    .filter(Boolean)
    .join('\n')
    .slice(0, LIMITE_DO_DETALHE)

  try {
    window.api.app
      .registrarErroDaTela({ origem, mensagem, detalhe: detalhe || undefined })
      .catch(() => undefined)
  } catch {
    // Sem a ponte do preload (harness de preview antigo), não há onde registrar.
  }
}
