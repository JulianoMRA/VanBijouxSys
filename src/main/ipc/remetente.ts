import { ehNavegacaoInterna } from '../navegacao'
import { registro } from '../registro'
import type { RegistroDeCanais } from './canal'
import { MENSAGEM_GENERICA } from './mensagens'

/** O pedaço do evento do `ipcMain` que diz de onde veio a chamada. */
export interface EventoDeCanal {
  /** Nulo quando o frame já navegou ou foi destruído. */
  senderFrame: { url: string; parent: unknown } | null
}

/** O `ipcMain` do Electron encaixa aqui; os testes passam um registro próprio. */
export interface CanaisDoElectron {
  handle(canal: string, ouvinte: (evento: EventoDeCanal, ...args: unknown[]) => unknown): void
}

/**
 * Só o documento do app, no frame principal da janela, chama os canais. O preload
 * expõe o `window.api` a qualquer página que carregue na janela: se uma navegação
 * escapasse da guarda (`ehNavegacaoInterna`), a página estranha teria o banco inteiro
 * ao alcance, inclusive restaurar backup.
 *
 * `documentoDoApp` é o primeiro documento que a janela carregou, na forma em que o
 * Chromium o registrou. Comparar com um caminho montado aqui arriscaria recusar o
 * próprio app por diferença de codificação, com acento ou espaço no nome da pasta.
 */
export function soDoDocumentoDoApp(
  ipc: CanaisDoElectron,
  documentoDoApp: () => string | null
): RegistroDeCanais {
  return {
    handle(canal, ouvinte) {
      ipc.handle(canal, (evento, ...args) => {
        const frame = evento.senderFrame
        const documento = documentoDoApp()
        const doApp =
          frame !== null &&
          frame.parent === null &&
          documento !== null &&
          ehNavegacaoInterna(documento, frame.url)

        if (!doApp) {
          registro.error(`[${canal}] chamada recusada: não veio do documento do app`, frame?.url)
          throw new Error(MENSAGEM_GENERICA)
        }
        return ouvinte(evento, ...args)
      })
    }
  }
}
