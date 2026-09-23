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
  app: { getPath: () => ambiente.pasta, relaunch: vi.fn(), exit: vi.fn() }
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

import {
  backupAntesDaAtualizacao,
  backupDiario,
  criarBackup,
  exportarBackup,
  getBackupDir
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
  rmSync(ambiente.pasta, { recursive: true, force: true })
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
