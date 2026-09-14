export interface DependenciasDeEncerramento {
  registrar: (mensagem: string, erro: unknown) => void
  mostrarErro: (titulo: string, conteudo: string) => void
  fecharBanco: () => void
  sair: (codigo: number) => void
  caminhoDoLog: () => string
}

export interface Encerramento {
  falhaFatal: (motivo: string, erro: unknown) => void
  rejeicaoSemTratamento: (motivo: unknown) => void
  marcarSaidaNormal: () => void
}

const TITULO = 'O Van Bijoux Sys precisa fechar'

function descrever(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

/**
 * Política de falha do processo principal, sem depender do Electron para ter teste.
 *
 * Falha fatal (boot ou exceção síncrona não capturada) grava no log, avisa, fecha o
 * banco e sai: seguir com o processo que escreve no banco em estado desconhecido é
 * pior do que perder o que estava digitado. Cada passo é protegido, porque um
 * diálogo que falha não pode impedir o banco de fechar.
 *
 * Rejeição sem tratamento só grava no log. Ela vem de caminho assíncrono de
 * biblioteca — o download do electron-updater rejeita sem `catch` quando a rede
 * cai — e fechar o app por isso tiraria a usuária do trabalho sem motivo.
 */
export function criarEncerramento(deps: DependenciasDeEncerramento): Encerramento {
  let encerrando = false

  function tentar(descricao: string, passo: () => void): void {
    try {
      passo()
    } catch (erro) {
      deps.registrar(`[main] ${descricao} falhou durante o encerramento`, erro)
    }
  }

  function conteudo(motivo: string, erro: unknown): string {
    const partes = [motivo, descrever(erro)]
    try {
      partes.push(`Os detalhes ficaram registrados em:\n${deps.caminhoDoLog()}`)
    } catch {
      // Sem caminho do log, o diálogo ainda precisa sair.
    }
    return partes.join('\n\n')
  }

  return {
    falhaFatal(motivo, erro) {
      if (encerrando) {
        deps.registrar(`[main] ${motivo} (já encerrando)`, erro)
        return
      }
      encerrando = true

      deps.registrar(`[main] ${motivo}`, erro)
      tentar('diálogo de erro', () => deps.mostrarErro(TITULO, conteudo(motivo, erro)))
      tentar('fechar o banco', deps.fecharBanco)
      deps.sair(1)
    },

    rejeicaoSemTratamento(motivo) {
      deps.registrar('[main] promise rejeitada sem tratamento', motivo)
    },

    marcarSaidaNormal() {
      encerrando = true
    }
  }
}
