import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

/**
 * O `database/backup.ts` de verdade, sobre uma pasta temporária. Só o Electron e a
 * API de backup do SQLite são trocados: a cópia vira cópia de arquivo, porque o que
 * se testa aqui é a pasta, a rotação e a ordem da restauração.
 */
const ambiente = vi.hoisted(() => ({ pasta: '' }))

vi.mock('electron', () => ({
  app: { getPath: () => ambiente.pasta, relaunch: vi.fn(), exit: vi.fn() },
  dialog: { showErrorBox: vi.fn() }
}))

vi.mock('better-sqlite3', () => ({ default: vi.fn() }))

vi.mock('../../main/database/index', async () => {
  const { copyFileSync } = await import('fs')
  const { join } = await import('path')
  const banco = (): string => join(ambiente.pasta, 'vanbijouxsys.db')
  return {
    getDbPath: banco,
    getSqlite: () => ({
      backup: async (destino: string) => {
        // A API de verdade grava em etapas: a cópia não fica pronta no mesmo tique,
        // e é nessa janela que dois avisos de atualização se cruzam.
        await new Promise((pronto) => setTimeout(pronto, 5))
        copyFileSync(banco(), destino)
      }
    }),
    closeDatabase: vi.fn()
  }
})

import { app, dialog } from 'electron'
import { closeDatabase } from '../../main/database/index'
import {
  backupAntesDaAtualizacao,
  backupDiario,
  criarBackup,
  exportarBackup,
  getBackupDir,
  restaurarBackup
} from '../../main/database/backup'
import { ehBackupDiario, nomeDeBackup } from '../../main/database/backup-rules'

function banco(): string {
  return join(ambiente.pasta, 'vanbijouxsys.db')
}

/** Arquivo na pasta de backups com conteúdo e data de modificação escolhidos. */
function backupAntigo(nome: string, conteudo: string, modificadoEm: Date): string {
  const caminho = join(getBackupDir(), nome)
  writeFileSync(caminho, conteudo)
  utimesSync(caminho, modificadoEm, modificadoEm)
  return caminho
}

/** Dez backups diários, de 1 a 10 de setembro; o conteúdo diz o dia. */
function dezDiasDeBackup(): string[] {
  return Array.from({ length: 10 }, (_, i) =>
    backupAntigo(
      nomeDeBackup(new Date(2026, 8, i + 1, 9, 0, 0)),
      `dia-${i + 1}`,
      new Date(2026, 8, i + 1, 9, 0, 0)
    )
  )
}

const naPasta = (): string[] => readdirSync(getBackupDir())

beforeEach(() => {
  ambiente.pasta = mkdtempSync(join(tmpdir(), 'vanbijoux-backup-'))
  mkdirSync(getBackupDir(), { recursive: true })
  writeFileSync(banco(), 'banco atual')
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
  rmSync(ambiente.pasta, { recursive: true, force: true })
})

describe('restaurarBackup', () => {
  it('should_restore_the_oldest_backup_of_a_full_folder_without_deleting_it_first', async () => {
    // Com a pasta cheia, o backup de segurança rodava a rotação antes da cópia e
    // apagava justamente o mais antigo — o escolhido —, com o banco já fechado.
    const [maisAntigo] = dezDiasDeBackup()

    await restaurarBackup(maisAntigo)

    expect(readFileSync(banco(), 'utf8')).toBe('dia-1')
    expect(app.relaunch).toHaveBeenCalledTimes(1)
    expect(app.exit).toHaveBeenCalledWith(0)
  })

  it('should_keep_the_current_state_in_a_backup_before_replacing_it', async () => {
    const [, segundo] = dezDiasDeBackup()

    await restaurarBackup(segundo)

    const seguranca = naPasta().find((n) => n.endsWith('-antes-de-restaurar.db'))
    expect(seguranca).toBeDefined()
    expect(readFileSync(join(getBackupDir(), seguranca!), 'utf8')).toBe('banco atual')
  })

  it('should_restore_an_event_backup_even_when_its_quota_is_full', async () => {
    // A cópia de antes de restaurar entra na mesma cota das de evento: sem copiar a
    // origem antes, a rotação apagaria a de evento mais antiga, que é a escolhida.
    const eventos = Array.from({ length: 10 }, (_, i) =>
      backupAntigo(
        nomeDeBackup(new Date(2026, 8, i + 1, 9, 0, 0), { tipo: 'migracao' }),
        `evento-${i + 1}`,
        new Date(2026, 8, i + 1, 9, 0, 0)
      )
    )

    await restaurarBackup(eventos[0])

    expect(readFileSync(banco(), 'utf8')).toBe('evento-1')
  })

  it('should_not_leave_the_temporary_copy_behind', async () => {
    const [maisAntigo] = dezDiasDeBackup()

    await restaurarBackup(maisAntigo)

    expect(readdirSync(ambiente.pasta).filter((n) => n.includes('restaurando'))).toEqual([])
  })

  it('should_not_replace_the_database_when_the_safety_backup_fails', async () => {
    // Sem o backup do estado atual, restaurar seria um caminho sem volta.
    const [maisAntigo] = dezDiasDeBackup()
    rmSync(banco())

    await expect(restaurarBackup(maisAntigo)).rejects.toThrow()
    expect(existsSync(banco())).toBe(false)
    expect(app.relaunch).not.toHaveBeenCalled()
    expect(readdirSync(ambiente.pasta).filter((n) => n.includes('restaurando'))).toEqual([])
  })

  it('should_remove_the_wal_files_of_the_replaced_database', async () => {
    // O WAL do banco antigo aplicado sobre o restaurado corromperia os dois.
    const [maisAntigo] = dezDiasDeBackup()
    writeFileSync(`${banco()}-wal`, 'wal antigo')
    writeFileSync(`${banco()}-shm`, 'shm antigo')

    await restaurarBackup(maisAntigo)

    expect(existsSync(`${banco()}-wal`)).toBe(false)
    expect(existsSync(`${banco()}-shm`)).toBe(false)
  })

  it('should_restart_with_the_current_data_when_the_swap_fails_after_closing', async () => {
    // Com o banco já fechado, parar no erro deixava a janela aberta sem banco: toda
    // tela falhava até ela fechar o app. Aqui o arquivo do banco vira uma pasta ao
    // fechar, e a troca falha como falharia com o arquivo preso por outro programa.
    const [maisAntigo] = dezDiasDeBackup()
    vi.mocked(closeDatabase).mockImplementationOnce(() => {
      rmSync(banco())
      mkdirSync(banco())
      writeFileSync(join(banco(), 'ocupado'), '')
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await restaurarBackup(maisAntigo)

    expect(dialog.showErrorBox).toHaveBeenCalledTimes(1)
    expect(app.relaunch).toHaveBeenCalledTimes(1)
    expect(app.exit).toHaveBeenCalledWith(0)
    expect(existsSync(maisAntigo)).toBe(true)
    expect(readdirSync(ambiente.pasta).filter((n) => n.includes('restaurando'))).toEqual([])
  })

  it('should_restart_without_touching_any_file_when_closing_the_database_fails', async () => {
    const [maisAntigo] = dezDiasDeBackup()
    writeFileSync(`${banco()}-wal`, 'transações ainda não gravadas no banco')
    vi.mocked(closeDatabase).mockImplementationOnce(() => {
      throw new Error('database is locked')
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await restaurarBackup(maisAntigo)

    expect(readFileSync(banco(), 'utf8')).toBe('banco atual')
    expect(readFileSync(`${banco()}-wal`, 'utf8')).toBe('transações ainda não gravadas no banco')
    expect(dialog.showErrorBox).toHaveBeenCalledTimes(1)
    expect(app.relaunch).toHaveBeenCalledTimes(1)
  })
})

describe('histórico de backups (RN-15)', () => {
  it('should_keep_ten_days_of_history_however_many_times_the_update_is_found', async () => {
    const diarios = dezDiasDeBackup()

    // Cada checagem que encontra a atualização já baixada avisa de novo.
    await backupAntesDaAtualizacao('1.16.0')
    await backupAntesDaAtualizacao('1.16.0')
    await backupAntesDaAtualizacao('1.16.0')
    await criarBackup({ tipo: 'migracao' })

    for (const caminho of diarios) expect(existsSync(caminho)).toBe(true)
    expect(naPasta().filter((n) => n.endsWith('-antes-da-1.16.0.db'))).toHaveLength(1)
    expect(naPasta().filter((n) => n.endsWith('-antes-de-migrar.db'))).toHaveLength(1)
  })

  it('should_make_a_single_backup_when_the_update_is_announced_twice_at_once', async () => {
    // Boot e clique em "Verificar atualizações" podem avisar quase juntos.
    const resultados = await Promise.all([
      backupAntesDaAtualizacao('1.16.0'),
      backupAntesDaAtualizacao('1.16.0')
    ])

    expect(resultados.filter((r) => r !== null)).toHaveLength(1)
    expect(naPasta().filter((n) => n.endsWith('-antes-da-1.16.0.db'))).toHaveLength(1)
  })

  it('should_back_up_again_for_the_next_version', async () => {
    await backupAntesDaAtualizacao('1.16.0')
    await backupAntesDaAtualizacao('1.16.1')

    expect(naPasta().filter((n) => n.includes('-antes-da-'))).toHaveLength(2)
  })

  it('should_make_the_daily_backup_once_a_day_even_after_an_update_backup', async () => {
    await backupAntesDaAtualizacao('1.16.0')

    expect(await backupDiario()).not.toBeNull()
    expect(await backupDiario()).toBeNull()
    expect(naPasta().filter(ehBackupDiario)).toHaveLength(1)
  })

  it('should_export_outside_the_folder_without_rotating_anything', async () => {
    const diarios = dezDiasDeBackup()
    const destino = join(ambiente.pasta, 'pendrive', 'van-bijoux-backup.db')

    await exportarBackup(destino)

    expect(readFileSync(destino, 'utf8')).toBe('banco atual')
    for (const caminho of diarios) expect(existsSync(caminho)).toBe(true)
  })
})
