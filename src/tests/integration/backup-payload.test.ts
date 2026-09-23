import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerBackupHandlers } from '../../main/ipc/backup'
import { MENSAGEM_PAYLOAD_INVALIDO } from '../../main/ipc/mensagens'
import type { RegistroDeCanais } from '../../main/ipc/canal'
import type { DependenciasDeBackup } from '../../main/servicos/backup'
import type { BackupInfo, ResultadoDaExportacao } from '../../shared/ipc/backup'
import { noFusoDaCliente } from '../helpers/fuso'

noFusoDaCliente()

type Handler = (evento: unknown, ...args: unknown[]) => unknown

let handlers: Map<string, Handler>
let dependencias: DependenciasDeBackup
let registro: {
  salvos: string[]
  restaurados: string[]
  abertos: string[]
  confirmacoes: string[]
}

function chamar<T = unknown>(canal: string, ...args: unknown[]): Promise<T> {
  const handler = handlers.get(canal)
  if (!handler) throw new Error(`canal IPC não registrado: ${canal}`)
  return Promise.resolve(handler({}, ...args)) as Promise<T>
}

beforeEach(() => {
  handlers = new Map()
  registro = { salvos: [], restaurados: [], abertos: [], confirmacoes: [] }
  dependencias = {
    perguntarOndeSalvar: async (nomePadrao) => `D:/pendrive/${nomePadrao}`,
    perguntarQualRestaurar: async (pasta) => `${pasta}/vanbijouxsys-2026-09-10.db`,
    confirmarRestauracao: async (nome) => {
      registro.confirmacoes.push(nome)
      return true
    },
    pastaDeBackups: () => 'C:/dados/backups',
    criarBackup: async (destino) => {
      registro.salvos.push(destino)
    },
    validarBackup: () => ({ ok: true }),
    restaurarBackup: async (origem) => {
      registro.restaurados.push(origem)
    },
    abrirPasta: async (caminho) => {
      registro.abertos.push(caminho)
    },
    arquivosDeBackup: () => [
      {
        caminho: 'C:/dados/backups/vanbijouxsys-2026-09-10.db',
        modificadoEm: new Date('2026-09-10T12:00:00.000Z')
      },
      {
        caminho: 'C:/dados/backups/vanbijouxsys-2026-09-09.db',
        modificadoEm: new Date('2026-09-09T12:00:00.000Z')
      }
    ]
  }

  const ipc: RegistroDeCanais = { handle: (canal, fn) => handlers.set(canal, fn as Handler) }
  registerBackupHandlers(ipc, {
    servicos: dependencias,
    versaoDoApp: () => '1.13.0',
    verificarAtualizacoes: async () => ({ atualizacaoDisponivel: false })
  })
})

describe('backup: fluxos da tela de Backup e dados', () => {
  it('should_save_the_file_the_dialog_returned', async () => {
    const resultado = await chamar<ResultadoDaExportacao>('backup:exportar')

    expect(resultado.salvo).toBe(true)
    expect(registro.salvos).toHaveLength(1)
    expect(registro.salvos[0]).toMatch(/van-bijoux-backup-\d{4}-\d{2}-\d{2}\.db$/)
  })

  it('should_suggest_the_local_date_in_the_file_name_late_at_night', async () => {
    // 23h30 de 30/09 no horário da cliente: em UTC já seria 01/10.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 30, 23, 30))
    try {
      await chamar<ResultadoDaExportacao>('backup:exportar')
    } finally {
      vi.useRealTimers()
    }

    expect(registro.salvos[0]).toMatch(/van-bijoux-backup-2026-09-30\.db$/)
  })

  it('should_write_nothing_when_the_save_dialog_is_cancelled', async () => {
    dependencias.perguntarOndeSalvar = async () => null

    expect(await chamar('backup:exportar')).toEqual({ salvo: false })
    expect(registro.salvos).toEqual([])
  })

  it('should_restore_only_after_validating_and_confirming', async () => {
    const resultado = await chamar('backup:restaurar')

    expect(resultado).toEqual({ restaurado: true })
    expect(registro.confirmacoes).toEqual(['vanbijouxsys-2026-09-10.db'])
    expect(registro.restaurados).toEqual(['C:/dados/backups/vanbijouxsys-2026-09-10.db'])
  })

  it('should_refuse_a_file_that_is_not_a_backup_with_a_message_for_the_user', async () => {
    dependencias.validarBackup = () => ({
      ok: false,
      erro: 'O arquivo não é um backup do Van Bijoux Sys.'
    })

    await expect(chamar('backup:restaurar')).rejects.toThrow(
      'O arquivo não é um backup do Van Bijoux Sys.'
    )
    expect(registro.restaurados).toEqual([])
    expect(registro.confirmacoes).toEqual([])
  })

  it('should_not_touch_the_database_when_the_warning_is_cancelled', async () => {
    dependencias.confirmarRestauracao = async () => false

    expect(await chamar('backup:restaurar')).toEqual({ restaurado: false })
    expect(registro.restaurados).toEqual([])
  })

  it('should_not_even_validate_when_no_file_is_chosen', async () => {
    dependencias.perguntarQualRestaurar = async () => null
    const validar = vi.fn(() => ({ ok: true }) as const)
    dependencias.validarBackup = validar

    expect(await chamar('backup:restaurar')).toEqual({ restaurado: false })
    expect(validar).not.toHaveBeenCalled()
  })

  it('should_report_the_folder_and_the_most_recent_backup', async () => {
    const info = await chamar<BackupInfo>('backup:info')

    expect(info).toEqual({
      pasta: 'C:/dados/backups',
      ultimoBackup: '2026-09-10T12:00:00.000Z'
    })
  })

  it('should_report_no_backup_yet_when_the_folder_is_empty', async () => {
    dependencias.arquivosDeBackup = () => []

    expect(await chamar<BackupInfo>('backup:info')).toEqual({
      pasta: 'C:/dados/backups',
      ultimoBackup: null
    })
  })

  it('should_open_the_backup_folder', async () => {
    expect(await chamar('backup:abrirPasta')).toEqual({ aberto: true })
    expect(registro.abertos).toEqual(['C:/dados/backups'])
  })

  it('should_answer_the_app_version_and_the_update_check', async () => {
    expect(await chamar('app:versao')).toBe('1.13.0')
    expect(await chamar('app:verificarAtualizacoes')).toEqual({ atualizacaoDisponivel: false })
  })
})

describe('backup: canal sem argumento recusa qualquer argumento', () => {
  it.each([
    ['backup:exportar'],
    ['backup:restaurar'],
    ['backup:info'],
    ['backup:abrirPasta'],
    ['app:versao'],
    ['app:verificarAtualizacoes']
  ])('should_refuse_an_extra_argument_on_%s', async (canal) => {
    await expect(chamar(canal, { forcar: true })).rejects.toThrow(MENSAGEM_PAYLOAD_INVALIDO)
    expect(registro.salvos).toEqual([])
    expect(registro.restaurados).toEqual([])
    expect(registro.abertos).toEqual([])
  })
})
