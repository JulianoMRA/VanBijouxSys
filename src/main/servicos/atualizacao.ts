import { z } from 'zod'
import { ErroDeNegocio } from '../ipc/mensagens'

/**
 * Fluxo de atualização com o mundo de fora por parâmetro (electron-updater,
 * diálogos, arquivo de registro), para ter teste sem abrir janela nem instalar nada.
 *
 * Em setembro de 2026 três instalações na cliente morreram no meio: o app instalava
 * ao fechar, e o notebook suspendia logo em seguida. Numa delas a versão antiga já
 * tinha sido removida, e o app ficou desinstalado. Por isso a instalação só começa
 * quando ela confirma, com o app aberto, e o boot seguinte confere se terminou.
 */

export interface ConteudoDaPergunta {
  titulo: string
  mensagem: string
  detalhe: string
  botoes: [string, string]
}

export interface ConteudoDoAviso {
  titulo: string
  mensagem: string
  detalhe?: string
}

export interface ResultadoDaChecagem {
  disponivel: boolean
  versao: string
  /** Termina quando o download acaba; null quando não há download. */
  download: Promise<unknown> | null
}

export interface DependenciasDaAtualizacao {
  versaoAtual(): string
  checar(): Promise<ResultadoDaChecagem>
  /** Fecha o app e roda o instalador, que abre o app de novo ao terminar. */
  instalar(): void
  backupAntesDaVersao(versao: string): Promise<string | null>
  /** Índice do botão escolhido; null quando não há janela para perguntar. */
  perguntar(conteudo: ConteudoDaPergunta): Promise<number | null>
  avisar(conteudo: ConteudoDoAviso): Promise<void>
  registroDaInstalacao: {
    ler(): string | null
    gravar(texto: string): void
    apagar(): void
  }
  log: {
    info(...dados: unknown[]): void
    warn(...dados: unknown[]): void
    error(...dados: unknown[]): void
  }
  agora(): Date
  esperar(ms: number): Promise<void>
}

export interface ServicoDeAtualizacao {
  /** No boot: confere a instalação anterior e procura atualização. */
  iniciar(): Promise<void>
  /** O electron-updater terminou o download da versão, ou já o tinha feito antes. */
  atualizacaoBaixada(versao: string): Promise<void>
  /** O botão "Verificar atualizações". */
  verificarAgora(): Promise<{ atualizacaoDisponivel: boolean }>
}

const versao = z.string().regex(/^\d+\.\d+\.\d+$/)
const instalacaoIniciada = z.object({
  versaoAnterior: versao,
  versaoNova: versao,
  iniciadaEm: z.string()
})

export type InstalacaoIniciada = z.infer<typeof instalacaoIniciada>

export type SituacaoDaInstalacao =
  | { tipo: 'nenhuma' }
  | { tipo: 'concluida'; de: string; para: string }
  | { tipo: 'interrompida'; versao: string; iniciadaEm: string }

/** O que o app grava logo antes de chamar o instalador. */
export function descreverInstalacao(anterior: string, nova: string, agora: Date): string {
  return JSON.stringify({
    versaoAnterior: anterior,
    versaoNova: nova,
    iniciadaEm: agora.toISOString()
  })
}

export function lerInstalacaoIniciada(texto: string): InstalacaoIniciada | null {
  try {
    const lido = instalacaoIniciada.safeParse(JSON.parse(texto))
    return lido.success ? lido.data : null
  } catch {
    return null
  }
}

/** A versão que abriu diz se o instalador chegou ao fim. */
export function conferirInstalacao(
  registro: InstalacaoIniciada | null,
  versaoAtual: string
): SituacaoDaInstalacao {
  if (!registro) return { tipo: 'nenhuma' }
  if (versaoAtual === registro.versaoNova) {
    return { tipo: 'concluida', de: registro.versaoAnterior, para: registro.versaoNova }
  }
  if (versaoAtual === registro.versaoAnterior) {
    return { tipo: 'interrompida', versao: registro.versaoNova, iniciadaEm: registro.iniciadaEm }
  }
  // Outro instalador rodou no meio: o registro não diz mais nada.
  return { tipo: 'nenhuma' }
}

function conviteParaInstalar(
  versaoNova: string,
  { interrompida, backupFeito }: { interrompida: boolean; backupFeito: boolean }
): ConteudoDaPergunta {
  const detalhe = [
    interrompida
      ? 'Da última vez, o computador provavelmente foi desligado ou suspenso durante a instalação.'
      : null,
    'O aplicativo fecha, instala a atualização e abre de novo sozinho em cerca de um minuto. ' +
      'Até ele voltar, não desligue nem suspenda o computador.',
    backupFeito ? 'O backup do banco já foi feito.' : null
  ]
  return {
    titulo: 'Atualização',
    mensagem: interrompida
      ? `A instalação da versão ${versaoNova} não terminou.`
      : `A versão ${versaoNova} está pronta para instalar.`,
    detalhe: detalhe.filter((parte) => parte !== null).join('\n\n'),
    botoes: ['Instalar agora', 'Depois']
  }
}

export function servicoDeAtualizacao(deps: DependenciasDaAtualizacao): ServicoDeAtualizacao {
  let pronta: string | null = null
  let backupFeito = false
  let conviteAberto: Promise<void> | null = null
  let anterior: SituacaoDaInstalacao = { tipo: 'nenhuma' }

  function conferirInstalacaoAnterior(): void {
    const texto = deps.registroDaInstalacao.ler()
    if (texto === null) return
    deps.registroDaInstalacao.apagar()

    anterior = conferirInstalacao(lerInstalacaoIniciada(texto), deps.versaoAtual())
    if (anterior.tipo === 'concluida') {
      deps.log.info(`[updater] atualizado de ${anterior.de} para ${anterior.para}`)
    } else if (anterior.tipo === 'interrompida') {
      deps.log.warn(
        `[updater] a instalação da versão ${anterior.versao}, iniciada em ${anterior.iniciadaEm}, não terminou`
      )
    }
  }

  async function convidar(versaoNova: string): Promise<void> {
    const interrompida = anterior.tipo === 'interrompida' && anterior.versao === versaoNova
    const escolha = await deps.perguntar(
      conviteParaInstalar(versaoNova, { interrompida, backupFeito })
    )
    if (escolha === null) {
      deps.log.warn(`[updater] versão ${versaoNova} pronta, mas sem janela para perguntar`)
      return
    }
    if (escolha !== 0) {
      deps.log.info(`[updater] instalação da versão ${versaoNova} adiada`)
      return
    }

    // Gravado antes: se o instalador morrer no meio, o próximo boot fica sabendo.
    deps.registroDaInstalacao.gravar(
      descreverInstalacao(deps.versaoAtual(), versaoNova, deps.agora())
    )
    deps.log.info(`[updater] instalação da versão ${versaoNova} confirmada`)
    deps.instalar()
  }

  /** Boot e botão podem chamar quase juntos: um convite por vez. */
  function oferecer(versaoNova: string): Promise<void> {
    if (!conviteAberto) {
      conviteAberto = convidar(versaoNova).finally(() => {
        conviteAberto = null
      })
    }
    return conviteAberto
  }

  return {
    async iniciar() {
      conferirInstalacaoAnterior()
      try {
        await deps.checar()
      } catch (err) {
        // Sem rede ou release indisponível não é erro fatal — o app segue normal.
        deps.log.error('[updater] checagem automática falhou:', err)
      }
    },

    async atualizacaoBaixada(versaoNova) {
      pronta = versaoNova
      try {
        const caminho = await deps.backupAntesDaVersao(versaoNova)
        backupFeito = true
        if (caminho) deps.log.info(`[updater] backup antes da versão ${versaoNova}: ${caminho}`)
      } catch (err) {
        deps.log.error('[updater] backup pré-atualização falhou:', err)
      }
      await oferecer(versaoNova)
    },

    async verificarAgora() {
      if (pronta) {
        await oferecer(pronta)
        return { atualizacaoDisponivel: true }
      }

      let resultado: ResultadoDaChecagem
      try {
        resultado = await deps.checar()
      } catch (err) {
        deps.log.error('[updater] checagem manual falhou:', err)
        throw new ErroDeNegocio(
          'Não foi possível verificar atualizações. Verifique a conexão com a internet e tente novamente.'
        )
      }

      if (!resultado.disponivel) {
        await deps.avisar({
          titulo: 'Atualizações',
          mensagem: `Você já está na versão mais recente (${deps.versaoAtual()}).`
        })
        return { atualizacaoDisponivel: false }
      }

      // Baixada numa abertura anterior: o aviso de pronta chega em instantes e o
      // convite dele cobre a conversa, sem um segundo diálogo por cima.
      await Promise.race([resultado.download ?? Promise.resolve(), deps.esperar(2000)]).catch(
        () => undefined
      )
      if (pronta) return { atualizacaoDisponivel: true }

      await deps.avisar({
        titulo: 'Atualização disponível',
        mensagem: `Versão ${resultado.versao} disponível (atual: ${deps.versaoAtual()}).`,
        detalhe:
          'O download acontece em segundo plano. Quando terminar, o aplicativo pergunta se pode ' +
          'instalar, e um backup do banco é feito antes.'
      })
      return { atualizacaoDisponivel: true }
    }
  }
}
