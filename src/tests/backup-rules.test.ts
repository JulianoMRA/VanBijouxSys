import { describe, it, expect } from 'vitest'
import {
  carimboDeBackup,
  ehArquivoDeBackup,
  nomeDeBackup,
  selecionarParaRemover,
  temBackupDoDia
} from '../main/database/backup-rules'

describe('ehArquivoDeBackup', () => {
  it('should_accept_when_name_has_prefix_and_db_extension', () => {
    expect(ehArquivoDeBackup('vanbijouxsys-2026-08-12-101500.db')).toBe(true)
  })

  it('should_reject_the_live_database_file', () => {
    expect(ehArquivoDeBackup('vanbijouxsys.db')).toBe(false)
  })

  it('should_reject_wal_and_shm_side_files', () => {
    expect(ehArquivoDeBackup('vanbijouxsys-2026-08-12-101500.db-wal')).toBe(false)
    expect(ehArquivoDeBackup('vanbijouxsys-2026-08-12-101500.db-shm')).toBe(false)
  })

  it('should_reject_unrelated_files', () => {
    expect(ehArquivoDeBackup('notas.txt')).toBe(false)
  })
})

describe('carimboDeBackup', () => {
  it('should_use_local_date_so_backup_day_matches_the_user_day', () => {
    // 23h no fuso local: em UTC já seria o dia seguinte.
    const data = new Date(2026, 7, 12, 23, 30, 15)
    expect(carimboDeBackup(data)).toBe('2026-08-12-233015')
  })

  it('should_pad_single_digit_parts', () => {
    const data = new Date(2026, 0, 5, 9, 8, 7)
    expect(carimboDeBackup(data)).toBe('2026-01-05-090807')
  })

  it('should_build_file_name_from_stamp', () => {
    const data = new Date(2026, 7, 12, 10, 15, 0)
    expect(nomeDeBackup(data)).toBe('vanbijouxsys-2026-08-12-101500.db')
  })
})

describe('temBackupDoDia', () => {
  const hoje = new Date(2026, 7, 12, 18, 0, 0)

  it('should_detect_backup_made_earlier_the_same_day', () => {
    expect(temBackupDoDia(['vanbijouxsys-2026-08-12-080000.db'], hoje)).toBe(true)
  })

  it('should_return_false_when_only_previous_days_exist', () => {
    expect(temBackupDoDia(['vanbijouxsys-2026-08-11-235959.db'], hoje)).toBe(false)
  })

  it('should_return_false_for_empty_folder', () => {
    expect(temBackupDoDia([], hoje)).toBe(false)
  })

  it('should_ignore_files_that_are_not_backups', () => {
    expect(temBackupDoDia(['vanbijouxsys.db', 'outro-2026-08-12.db'], hoje)).toBe(false)
  })
})

describe('selecionarParaRemover', () => {
  function arquivos(quantidade: number): { caminho: string; modificadoEm: number }[] {
    return Array.from({ length: quantidade }, (_, i) => ({
      caminho: `backup-${i}.db`,
      modificadoEm: i
    }))
  }

  it('should_remove_nothing_when_below_the_limit', () => {
    expect(selecionarParaRemover(arquivos(3), 10)).toEqual([])
  })

  it('should_remove_nothing_when_exactly_at_the_limit', () => {
    expect(selecionarParaRemover(arquivos(10), 10)).toEqual([])
  })

  it('should_remove_the_oldest_beyond_the_limit', () => {
    const removidos = selecionarParaRemover(arquivos(13), 10)
    expect(removidos.map((a) => a.caminho)).toEqual(['backup-2.db', 'backup-1.db', 'backup-0.db'])
  })

  it('should_keep_the_most_recent_ones', () => {
    const removidos = selecionarParaRemover(arquivos(13), 10).map((a) => a.caminho)
    expect(removidos).not.toContain('backup-12.db')
    expect(removidos).not.toContain('backup-3.db')
  })

  it('should_not_mutate_the_received_list', () => {
    const lista = arquivos(12)
    const copia = [...lista]
    selecionarParaRemover(lista, 10)
    expect(lista).toEqual(copia)
  })
})
