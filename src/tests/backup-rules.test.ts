import { describe, it, expect } from 'vitest'
import {
  carimboDeBackup,
  ehArquivoDeBackup,
  ehBackupDiario,
  MAX_BACKUPS_DE_EVENTO,
  MAX_BACKUPS_DIARIOS,
  nomeDeBackup,
  selecionarParaRemover,
  temBackupAntesDaVersao,
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

describe('nomeDeBackup com motivo', () => {
  const data = new Date(2026, 8, 23, 18, 12, 38)

  it('should_say_which_version_the_update_backup_precedes', () => {
    expect(nomeDeBackup(data, { tipo: 'atualizacao', versao: '1.16.0' })).toBe(
      'vanbijouxsys-2026-09-23-181238-antes-da-1.16.0.db'
    )
  })

  it('should_name_the_migration_and_restore_backups', () => {
    expect(nomeDeBackup(data, { tipo: 'migracao' })).toBe(
      'vanbijouxsys-2026-09-23-181238-antes-de-migrar.db'
    )
    expect(nomeDeBackup(data, { tipo: 'restauracao' })).toBe(
      'vanbijouxsys-2026-09-23-181238-antes-de-restaurar.db'
    )
  })

  it('should_keep_an_odd_version_from_escaping_the_file_name', () => {
    expect(nomeDeBackup(data, { tipo: 'atualizacao', versao: '1.16.0/../x' })).toBe(
      'vanbijouxsys-2026-09-23-181238-antes-da-1.16.0-..-x.db'
    )
  })
})

describe('ehBackupDiario', () => {
  it('should_recognize_the_daily_backup_name', () => {
    expect(ehBackupDiario('vanbijouxsys-2026-09-22-182402.db')).toBe(true)
  })

  it('should_not_count_backups_made_before_an_update_migration_or_restore', () => {
    expect(ehBackupDiario('vanbijouxsys-2026-09-23-133155-antes-da-1.15.1.db')).toBe(false)
    expect(ehBackupDiario('vanbijouxsys-2026-09-23-181238-antes-de-migrar.db')).toBe(false)
    expect(ehBackupDiario('vanbijouxsys-2026-09-23-181238-antes-de-restaurar.db')).toBe(false)
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

  it('should_not_let_an_update_backup_stand_in_for_the_daily_one', () => {
    // A cópia de antes da atualização tem cota própria; se contasse como a do dia,
    // aquele dia ficaria fora do histórico diário.
    expect(temBackupDoDia(['vanbijouxsys-2026-08-12-080000-antes-da-1.16.0.db'], hoje)).toBe(false)
  })
})

describe('temBackupAntesDaVersao', () => {
  const nomes = [
    'vanbijouxsys-2026-09-22-182402.db',
    'vanbijouxsys-2026-09-23-133155-antes-da-1.15.1.db'
  ]

  it('should_find_the_backup_already_made_for_the_version', () => {
    expect(temBackupAntesDaVersao(nomes, '1.15.1')).toBe(true)
  })

  it('should_not_confuse_versions_that_share_a_prefix', () => {
    expect(temBackupAntesDaVersao(nomes, '1.15.10')).toBe(false)
    expect(temBackupAntesDaVersao(nomes, '1.15')).toBe(false)
  })
})

describe('selecionarParaRemover', () => {
  /** Backups diários de dias seguidos de setembro, do dia 1 em diante. */
  function diarios(quantidade: number): { caminho: string; modificadoEm: number }[] {
    return Array.from({ length: quantidade }, (_, i) => {
      const dia = String(i + 1).padStart(2, '0')
      return {
        caminho: `C:\\dados\\backups\\vanbijouxsys-2026-09-${dia}-090000.db`,
        modificadoEm: i
      }
    })
  }

  function antesDaAtualizacao(
    quantidade: number,
    desde = 100
  ): { caminho: string; modificadoEm: number }[] {
    return Array.from({ length: quantidade }, (_, i) => ({
      caminho: `C:\\dados\\backups\\vanbijouxsys-2026-09-23-1331${String(i).padStart(2, '0')}-antes-da-1.15.${i}.db`,
      modificadoEm: desde + i
    }))
  }

  const nomes = (lista: { caminho: string }[]): string[] =>
    lista.map((a) => a.caminho.split('\\').pop() ?? a.caminho)

  it('should_remove_nothing_when_below_the_limit', () => {
    expect(selecionarParaRemover(diarios(3))).toEqual([])
  })

  it('should_remove_nothing_when_exactly_at_the_limit', () => {
    expect(selecionarParaRemover(diarios(MAX_BACKUPS_DIARIOS))).toEqual([])
  })

  it('should_remove_the_oldest_daily_backups_beyond_ten_days', () => {
    const removidos = selecionarParaRemover(diarios(13))
    expect(nomes(removidos)).toEqual([
      'vanbijouxsys-2026-09-03-090000.db',
      'vanbijouxsys-2026-09-02-090000.db',
      'vanbijouxsys-2026-09-01-090000.db'
    ])
  })

  it('should_keep_ten_days_of_history_however_many_update_backups_pile_up', () => {
    // O que aconteceu na cliente: cada checagem de atualização gravava uma cópia, e
    // as dez vagas passaram a ser de cópias repetidas de um dia só.
    const lista = [...diarios(10), ...antesDaAtualizacao(15)]

    const removidos = nomes(selecionarParaRemover(lista))

    expect(removidos.filter((n) => ehBackupDiario(n))).toEqual([])
    expect(removidos).toHaveLength(15 - MAX_BACKUPS_DE_EVENTO)
  })

  it('should_remove_the_oldest_event_backups_beyond_their_own_limit', () => {
    const removidos = nomes(selecionarParaRemover(antesDaAtualizacao(MAX_BACKUPS_DE_EVENTO + 2)))
    expect(removidos).toEqual([
      'vanbijouxsys-2026-09-23-133101-antes-da-1.15.1.db',
      'vanbijouxsys-2026-09-23-133100-antes-da-1.15.0.db'
    ])
  })

  it('should_never_touch_files_the_app_did_not_name', () => {
    // Um arquivo que a usuária guardou na pasta não entra em cota nenhuma.
    const lista = [
      ...diarios(12),
      { caminho: 'C:\\dados\\backups\\vanbijouxsys-copia-da-van.db', modificadoEm: -1 }
    ]
    expect(nomes(selecionarParaRemover(lista))).not.toContain('vanbijouxsys-copia-da-van.db')
  })

  it('should_not_mutate_the_received_list', () => {
    const lista = diarios(12)
    const copia = [...lista]
    selecionarParaRemover(lista)
    expect(lista).toEqual(copia)
  })
})
