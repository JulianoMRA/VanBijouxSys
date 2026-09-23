import { describe, it, expect } from 'vitest'
import {
  conferirInstalacao,
  descreverInstalacao,
  lerInstalacaoIniciada,
  servicoDeAtualizacao,
  type ConteudoDaPergunta,
  type ConteudoDoAviso,
  type DependenciasDaAtualizacao,
  type ResultadoDaChecagem
} from '../main/servicos/atualizacao'
import { ErroDeNegocio } from '../main/ipc/mensagens'

interface Opcoes {
  versao?: string
  registro?: string | null
  /** Botão escolhido em cada pergunta, na ordem; sem resposta, "Depois". */
  respostas?: Array<number | null>
  checar?: () => Promise<ResultadoDaChecagem>
  backup?: (versao: string) => Promise<string | null>
  perguntaDemorada?: boolean
  /** A espera curta do botão de fato espera, em vez de passar direto. */
  esperaDeVerdade?: boolean
}

function montar(opcoes: Opcoes = {}) {
  const perguntas: ConteudoDaPergunta[] = []
  const avisos: ConteudoDoAviso[] = []
  const logs: string[] = []
  const eventos: string[] = []
  let registro: string | null = opcoes.registro ?? null
  let checagens = 0
  const respostas = [...(opcoes.respostas ?? [])]

  const deps: DependenciasDaAtualizacao = {
    versaoAtual: () => opcoes.versao ?? '1.16.0',
    checar: async () => {
      checagens++
      return opcoes.checar
        ? opcoes.checar()
        : { disponivel: false, versao: opcoes.versao ?? '1.16.0', download: null }
    },
    instalar: () => {
      eventos.push(registro === null ? 'instalar sem registro' : 'instalar')
    },
    backupAntesDaVersao:
      opcoes.backup ?? (async (versao) => `C:\\backups\\vanbijouxsys-antes-da-${versao}.db`),
    perguntar: async (conteudo) => {
      perguntas.push(conteudo)
      if (opcoes.perguntaDemorada) await new Promise((pronto) => setTimeout(pronto, 10))
      return respostas.length > 0 ? respostas.shift()! : 1
    },
    avisar: async (conteudo) => {
      avisos.push(conteudo)
    },
    registroDaInstalacao: {
      ler: () => registro,
      gravar: (texto) => {
        registro = texto
        eventos.push('gravar registro')
      },
      apagar: () => {
        registro = null
      }
    },
    log: {
      info: (...dados) => logs.push(['info', ...dados].join(' ')),
      warn: (...dados) => logs.push(['warn', ...dados].join(' ')),
      error: (...dados) => logs.push(['error', ...dados].join(' '))
    },
    agora: () => new Date('2026-09-24T12:00:00.000Z'),
    esperar: async () => {
      if (opcoes.esperaDeVerdade) await new Promise((pronto) => setTimeout(pronto, 50))
    }
  }

  return {
    servico: servicoDeAtualizacao(deps),
    perguntas,
    avisos,
    logs,
    eventos,
    registro: () => registro,
    checagens: () => checagens
  }
}

describe('registro da instalação', () => {
  it('should_read_back_what_was_written_before_the_installer', () => {
    const texto = descreverInstalacao('1.16.0', '1.17.0', new Date('2026-09-24T12:00:00.000Z'))
    expect(lerInstalacaoIniciada(texto)).toEqual({
      versaoAnterior: '1.16.0',
      versaoNova: '1.17.0',
      iniciadaEm: '2026-09-24T12:00:00.000Z'
    })
  })

  it('should_ignore_a_broken_or_foreign_file', () => {
    expect(lerInstalacaoIniciada('{ quebrado')).toBeNull()
    expect(lerInstalacaoIniciada('{"versaoNova":"1.17.0"}')).toBeNull()
    expect(
      lerInstalacaoIniciada('{"versaoAnterior":"x","versaoNova":"1.17.0","iniciadaEm":"hoje"}')
    ).toBeNull()
  })

  it('should_tell_a_finished_installation_from_an_interrupted_one', () => {
    const registro = { versaoAnterior: '1.16.0', versaoNova: '1.17.0', iniciadaEm: 'ontem' }
    expect(conferirInstalacao(registro, '1.17.0')).toEqual({
      tipo: 'concluida',
      de: '1.16.0',
      para: '1.17.0'
    })
    expect(conferirInstalacao(registro, '1.16.0')).toEqual({
      tipo: 'interrompida',
      versao: '1.17.0',
      iniciadaEm: 'ontem'
    })
  })

  it('should_draw_no_conclusion_when_another_version_is_running', () => {
    // Outro instalador rodou no meio: o registro não diz mais nada.
    const registro = { versaoAnterior: '1.16.0', versaoNova: '1.17.0', iniciadaEm: 'ontem' }
    expect(conferirInstalacao(registro, '1.18.0')).toEqual({ tipo: 'nenhuma' })
    expect(conferirInstalacao(null, '1.17.0')).toEqual({ tipo: 'nenhuma' })
  })
})

describe('convite para instalar', () => {
  it('should_ask_instead_of_installing_by_itself', async () => {
    // Instalar ao fechar deixava o instalador sozinho, e o notebook suspenso o matava.
    const { servico, perguntas, eventos, registro } = montar({ respostas: [1] })

    await servico.atualizacaoBaixada('1.17.0')

    expect(perguntas).toHaveLength(1)
    expect(perguntas[0].mensagem).toContain('1.17.0')
    expect(perguntas[0].botoes).toEqual(['Instalar agora', 'Depois'])
    expect(eventos).toEqual([])
    expect(registro()).toBeNull()
  })

  it('should_warn_not_to_turn_off_or_suspend_the_computer', async () => {
    const { servico, perguntas } = montar()

    await servico.atualizacaoBaixada('1.17.0')

    expect(perguntas[0].detalhe).toContain('não desligue nem suspenda o computador')
  })

  it('should_record_the_installation_before_calling_the_installer', async () => {
    const { servico, eventos, registro } = montar({ respostas: [0] })

    await servico.atualizacaoBaixada('1.17.0')

    expect(eventos).toEqual(['gravar registro', 'instalar'])
    expect(lerInstalacaoIniciada(registro()!)).toMatchObject({
      versaoAnterior: '1.16.0',
      versaoNova: '1.17.0'
    })
  })

  it('should_ask_once_when_two_notices_arrive_together', async () => {
    // Boot e clique em "Verificar atualizações" podem avisar quase juntos.
    const { servico, perguntas } = montar({ perguntaDemorada: true })

    await Promise.all([servico.atualizacaoBaixada('1.17.0'), servico.atualizacaoBaixada('1.17.0')])

    expect(perguntas).toHaveLength(1)
  })

  it('should_mention_the_backup_only_when_it_was_made', async () => {
    const comBackup = montar()
    await comBackup.servico.atualizacaoBaixada('1.17.0')
    expect(comBackup.perguntas[0].detalhe).toContain('backup do banco já foi feito')

    const semBackup = montar({
      backup: async () => {
        throw new Error('disco cheio')
      }
    })
    await semBackup.servico.atualizacaoBaixada('1.17.0')
    expect(semBackup.perguntas[0].detalhe).not.toContain('backup')
    expect(semBackup.logs.some((l) => l.startsWith('error') && l.includes('backup'))).toBe(true)
  })

  it('should_not_install_when_there_is_no_window_to_ask', async () => {
    const { servico, eventos, logs } = montar({ respostas: [null] })

    await servico.atualizacaoBaixada('1.17.0')

    expect(eventos).toEqual([])
    expect(logs.some((l) => l.includes('sem janela'))).toBe(true)
  })
})

describe('instalação anterior', () => {
  it('should_warn_that_the_previous_installation_did_not_finish', async () => {
    const registro = descreverInstalacao('1.16.0', '1.17.0', new Date('2026-09-23T21:07:06.000Z'))
    const { servico, perguntas, logs, registro: atual } = montar({ versao: '1.16.0', registro })

    await servico.iniciar()
    await servico.atualizacaoBaixada('1.17.0')

    expect(logs.some((l) => l.startsWith('warn') && l.includes('não terminou'))).toBe(true)
    expect(atual()).toBeNull()
    expect(perguntas[0].mensagem).toContain('não terminou')
    expect(perguntas[0].detalhe).toContain('desligado ou suspenso durante a instalação')
  })

  it('should_log_a_finished_installation_and_forget_it', async () => {
    const registro = descreverInstalacao('1.15.1', '1.16.0', new Date())
    const { servico, logs, registro: atual } = montar({ versao: '1.16.0', registro })

    await servico.iniciar()

    expect(logs.some((l) => l.includes('atualizado de 1.15.1 para 1.16.0'))).toBe(true)
    expect(atual()).toBeNull()
  })

  it('should_keep_the_app_running_when_the_automatic_check_fails', async () => {
    const { servico, logs } = montar({
      checar: async () => {
        throw new Error('net::ERR_INTERNET_DISCONNECTED')
      }
    })

    await expect(servico.iniciar()).resolves.toBeUndefined()
    expect(logs.some((l) => l.startsWith('error') && l.includes('checagem automática'))).toBe(true)
  })
})

describe('botão "Verificar atualizações"', () => {
  it('should_offer_the_downloaded_update_again_without_checking', async () => {
    const { servico, perguntas, checagens } = montar({ respostas: [1, 0] })
    await servico.atualizacaoBaixada('1.17.0')

    expect(await servico.verificarAgora()).toEqual({ atualizacaoDisponivel: true })
    expect(perguntas).toHaveLength(2)
    expect(checagens()).toBe(0)
  })

  it('should_say_it_is_up_to_date_when_there_is_nothing_new', async () => {
    const { servico, avisos } = montar()

    expect(await servico.verificarAgora()).toEqual({ atualizacaoDisponivel: false })
    expect(avisos[0].mensagem).toContain('versão mais recente (1.16.0)')
  })

  it('should_say_the_download_is_under_way_and_that_it_will_ask', async () => {
    const { servico, avisos } = montar({
      checar: async () => ({ disponivel: true, versao: '1.17.0', download: new Promise(() => {}) })
    })

    expect(await servico.verificarAgora()).toEqual({ atualizacaoDisponivel: true })
    expect(avisos[0].mensagem).toContain('1.17.0')
    expect(avisos[0].detalhe).toContain('pergunta se pode instalar')
  })

  it('should_not_stack_a_second_dialog_when_the_update_was_already_downloaded', async () => {
    // Baixada numa abertura anterior: a checagem termina e, logo depois, o
    // electron-updater confere o arquivo e avisa que está pronta. O convite desse
    // aviso já cobre a conversa.
    let baixando: Promise<void> | undefined
    const montado: ReturnType<typeof montar> = montar({
      respostas: [1],
      esperaDeVerdade: true,
      checar: async () => {
        baixando = new Promise((pronto) => setTimeout(pronto, 1)).then(() =>
          montado.servico.atualizacaoBaixada('1.17.0')
        )
        return { disponivel: true, versao: '1.17.0', download: baixando }
      }
    })

    await montado.servico.verificarAgora()
    await baixando

    expect(montado.avisos).toEqual([])
    expect(montado.perguntas).toHaveLength(1)
  })

  it('should_explain_a_failed_check_in_words_the_user_understands', async () => {
    // Um Error comum virava, no canal, a mensagem genérica "Tente novamente".
    const { servico } = montar({
      checar: async () => {
        throw new Error('net::ERR_INTERNET_DISCONNECTED')
      }
    })

    const falha = servico.verificarAgora()

    await expect(falha).rejects.toBeInstanceOf(ErroDeNegocio)
    await expect(falha).rejects.toThrow('conexão com a internet')
  })
})
