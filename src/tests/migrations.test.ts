import { describe, it, expect } from 'vitest'
import { MIGRACOES, migracoesPendentes, versaoAlvo } from '../main/database/migrations'

describe('catálogo de migrações', () => {
  it('should_not_repeat_a_version_number', () => {
    const versoes = MIGRACOES.map((m) => m.versao)
    expect(new Set(versoes).size).toBe(versoes.length)
  })

  it('should_be_numbered_sequentially_from_one', () => {
    // Buraco na sequência faria uma migração ser pulada em bancos intermediários.
    const versoes = MIGRACOES.map((m) => m.versao).sort((a, b) => a - b)
    expect(versoes).toEqual(versoes.map((_, i) => i + 1))
  })

  it('should_name_every_migration', () => {
    for (const m of MIGRACOES) {
      expect(m.nome.trim().length).toBeGreaterThan(0)
    }
  })

  it('should_report_the_highest_version_as_target', () => {
    expect(versaoAlvo()).toBe(Math.max(...MIGRACOES.map((m) => m.versao)))
  })
})

describe('migracoesPendentes', () => {
  it('should_return_everything_for_a_brand_new_database', () => {
    expect(migracoesPendentes(0)).toHaveLength(MIGRACOES.length)
  })

  it('should_return_nothing_when_already_up_to_date', () => {
    expect(migracoesPendentes(versaoAlvo())).toEqual([])
  })

  it('should_skip_versions_already_applied', () => {
    const pendentes = migracoesPendentes(1)
    expect(pendentes.every((m) => m.versao > 1)).toBe(true)
  })

  it('should_return_them_in_ascending_order', () => {
    const versoes = migracoesPendentes(0).map((m) => m.versao)
    expect(versoes).toEqual([...versoes].sort((a, b) => a - b))
  })

  it('should_treat_a_future_version_as_nothing_to_do', () => {
    // Banco tocado por uma versão mais nova do app: não inventar migração.
    expect(migracoesPendentes(versaoAlvo() + 5)).toEqual([])
  })
})
