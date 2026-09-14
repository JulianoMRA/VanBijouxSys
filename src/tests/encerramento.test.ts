import { beforeEach, describe, expect, it } from 'vitest'
import { criarEncerramento, type DependenciasDeEncerramento } from '../main/encerramento'

const CAMINHO_DO_LOG = 'C:\\Users\\van\\AppData\\Roaming\\van-bijoux-sys\\logs\\main.log'

let chamadas: string[]
let dialogos: { titulo: string; conteudo: string }[]
let registros: { mensagem: string; erro: unknown }[]
let deps: DependenciasDeEncerramento

beforeEach(() => {
  chamadas = []
  dialogos = []
  registros = []
  deps = {
    registrar: (mensagem, erro) => {
      chamadas.push('registrar')
      registros.push({ mensagem, erro })
    },
    mostrarErro: (titulo, conteudo) => {
      chamadas.push('mostrarErro')
      dialogos.push({ titulo, conteudo })
    },
    fecharBanco: () => chamadas.push('fecharBanco'),
    sair: (codigo) => chamadas.push(`sair(${codigo})`),
    caminhoDoLog: () => CAMINHO_DO_LOG
  }
})

describe('falhaFatal', () => {
  it('should_log_warn_close_database_and_exit_with_code_1_in_this_order', () => {
    const erro = new Error('SqliteError: file is not a database')

    criarEncerramento(deps).falhaFatal('Não foi possível iniciar o aplicativo.', erro)

    expect(chamadas).toEqual(['registrar', 'mostrarErro', 'fecharBanco', 'sair(1)'])
    expect(registros[0].erro).toBe(erro)
  })

  it('should_show_reason_error_and_log_location_to_the_user', () => {
    criarEncerramento(deps).falhaFatal(
      'Não foi possível iniciar o aplicativo.',
      new Error('SqliteError: file is not a database')
    )

    const [{ conteudo }] = dialogos
    expect(conteudo).toContain('Não foi possível iniciar o aplicativo.')
    expect(conteudo).toContain('SqliteError: file is not a database')
    expect(conteudo).toContain(CAMINHO_DO_LOG)
  })

  it('should_describe_non_error_values_thrown', () => {
    criarEncerramento(deps).falhaFatal('Aconteceu um erro inesperado.', 'falha em texto')

    expect(dialogos[0].conteudo).toContain('falha em texto')
  })

  it('should_omit_log_location_when_it_cannot_be_resolved', () => {
    deps.caminhoDoLog = () => {
      throw new Error('app ainda não está pronto')
    }

    criarEncerramento(deps).falhaFatal('Aconteceu um erro inesperado.', new Error('x'))

    expect(dialogos[0].conteudo).not.toContain('registrados em')
    expect(chamadas).toContain('sair(1)')
  })

  it('should_still_close_database_and_exit_when_dialog_fails', () => {
    deps.mostrarErro = () => {
      throw new Error('dialog indisponível')
    }

    criarEncerramento(deps).falhaFatal('Aconteceu um erro inesperado.', new Error('x'))

    expect(chamadas).toEqual(['registrar', 'registrar', 'fecharBanco', 'sair(1)'])
  })

  it('should_still_exit_when_closing_database_fails', () => {
    deps.fecharBanco = () => {
      throw new Error('database is locked')
    }

    criarEncerramento(deps).falhaFatal('Aconteceu um erro inesperado.', new Error('x'))

    expect(chamadas.at(-1)).toBe('sair(1)')
    expect(registros.map((r) => (r.erro as Error).message)).toContain('database is locked')
  })

  it('should_only_log_a_second_failure_while_already_closing', () => {
    const encerramento = criarEncerramento(deps)

    encerramento.falhaFatal('Aconteceu um erro inesperado.', new Error('primeira'))
    encerramento.falhaFatal('Aconteceu um erro inesperado.', new Error('segunda'))

    expect(dialogos).toHaveLength(1)
    expect(chamadas.filter((c) => c === 'sair(1)')).toHaveLength(1)
    expect(registros.map((r) => (r.erro as Error).message)).toContain('segunda')
  })

  it('should_only_log_when_app_is_already_quitting_normally', () => {
    const encerramento = criarEncerramento(deps)

    encerramento.marcarSaidaNormal()
    encerramento.falhaFatal('Aconteceu um erro inesperado.', new Error('durante a saída'))

    expect(chamadas).toEqual(['registrar'])
  })
})

describe('rejeicaoSemTratamento', () => {
  it('should_only_log_and_keep_the_app_open', () => {
    const motivo = new Error('net::ERR_INTERNET_DISCONNECTED')

    criarEncerramento(deps).rejeicaoSemTratamento(motivo)

    expect(chamadas).toEqual(['registrar'])
    expect(registros[0].erro).toBe(motivo)
  })
})
