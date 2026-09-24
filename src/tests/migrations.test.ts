import { describe, it, expect, vi } from 'vitest'
import { type Database } from 'sql.js'
import {
  aplicarMigracoes,
  atualizarEsquema,
  BancoMaisNovoQueOApp,
  MIGRACOES,
  migracoesPendentes,
  versaoAlvo,
  versaoAtual
} from '../main/database/migrations'
import { asMigrationTarget, createEmptyDb, queryAll, queryOne } from './helpers/testDb'

type AlvoDeMigracao = Parameters<(typeof MIGRACOES)[number]['aplicar']>[0]

function alvo(db: Database): AlvoDeMigracao {
  return asMigrationTarget(db) as unknown as AlvoDeMigracao
}

function colunas(db: Database, tabela: string): string[] {
  return queryAll<{ name: string }>(db, `PRAGMA table_info(${tabela})`).map((c) => c.name)
}

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

describe('aplicação das migrações num banco de verdade', () => {
  it('should_build_the_whole_schema_from_an_empty_database', async () => {
    const db = await createEmptyDb()

    const aplicadas = aplicarMigracoes(alvo(db))

    expect(aplicadas).toEqual(MIGRACOES.map((m) => m.versao))
    expect(versaoAtual(alvo(db))).toBe(versaoAlvo())
  })

  it('should_do_nothing_when_the_database_is_already_current', async () => {
    const db = await createEmptyDb()
    aplicarMigracoes(alvo(db))

    expect(aplicarMigracoes(alvo(db))).toEqual([])
  })

  it('should_add_archived_at_to_products_variations_and_insumos', async () => {
    const db = await createEmptyDb()

    aplicarMigracoes(alvo(db))

    expect(colunas(db, 'products')).toContain('archived_at')
    expect(colunas(db, 'product_variations')).toContain('archived_at')
    expect(colunas(db, 'insumos')).toContain('archived_at')
  })

  it('should_keep_rows_created_before_the_column_existed', async () => {
    // O banco da cliente já existe: a migração não pode perder linha nem
    // arquivar nada sem ela pedir.
    const db = await createEmptyDb()
    const migracaoInicial = MIGRACOES.find((m) => m.versao === 1)!
    migracaoInicial.aplicar(alvo(db))
    db.run(`INSERT INTO products (name, category_id) VALUES ('Colar Aurora', 1)`)
    db.run(
      `INSERT INTO product_variations (product_id, identifier, stock_quantity)
       VALUES (1, 'Dourado P', 4)`
    )
    db.run(
      `INSERT INTO insumos (name, unit, stock_quantity) VALUES ('Fecho lagosta', 'unidade', 7)`
    )

    MIGRACOES.find((m) => m.versao === 2)!.aplicar(alvo(db))

    const produto = queryOne<{ name: string; archived_at: string | null }>(
      db,
      'SELECT name, archived_at FROM products WHERE id = 1'
    )
    const variacao = queryOne<{ stock_quantity: number; archived_at: string | null }>(
      db,
      'SELECT stock_quantity, archived_at FROM product_variations WHERE id = 1'
    )
    const insumo = queryOne<{ stock_quantity: number; archived_at: string | null }>(
      db,
      'SELECT stock_quantity, archived_at FROM insumos WHERE id = 1'
    )

    expect(produto).toEqual({ name: 'Colar Aurora', archived_at: null })
    expect(variacao).toEqual({ stock_quantity: 4, archived_at: null })
    expect(insumo).toEqual({ stock_quantity: 7, archived_at: null })
  })

  it('should_not_fail_when_the_archiving_migration_runs_twice', async () => {
    // Reaplicar acontece quando uma migração posterior falha e o boot repete a
    // sequência: ALTER TABLE repetido derrubaria o app na abertura.
    const db = await createEmptyDb()
    const arquivamento = MIGRACOES.find((m) => m.versao === 2)!
    aplicarMigracoes(alvo(db))

    expect(() => arquivamento.aplicar(alvo(db))).not.toThrow()
    expect(colunas(db, 'products').filter((c) => c === 'archived_at')).toHaveLength(1)
  })

  it('should_add_the_customer_to_sales_without_touching_existing_sales', async () => {
    // As vendas lançadas antes da versão 3 continuam iguais e ficam sem cliente.
    const db = await createEmptyDb()
    for (const migracao of MIGRACOES.filter((m) => m.versao < 3)) migracao.aplicar(alvo(db))
    db.run(
      `INSERT INTO sales (channel, total_amount, total_cost, payment_method, net_amount, sold_at)
       VALUES ('WhatsApp', 86, 20, 'areceber', 86, '2026-09-20')`
    )
    const antes = queryOne(db, 'SELECT * FROM sales WHERE id = 1')

    MIGRACOES.find((m) => m.versao === 3)!.aplicar(alvo(db))

    expect(queryOne(db, 'SELECT * FROM sales WHERE id = 1')).toEqual({
      ...antes,
      customer_name: null
    })
  })

  it('should_not_fail_when_the_customer_migration_runs_twice', async () => {
    const db = await createEmptyDb()
    aplicarMigracoes(alvo(db))

    expect(() => MIGRACOES.find((m) => m.versao === 3)!.aplicar(alvo(db))).not.toThrow()
    expect(colunas(db, 'sales').filter((c) => c === 'customer_name')).toHaveLength(1)
  })

  it('should_create_the_payments_table_without_touching_existing_sales', async () => {
    // Venda recebida pela versão antiga: forma, taxa, líquido e data ficam na linha
    // dela, e continuam iguais depois da migração.
    const db = await createEmptyDb()
    for (const migracao of MIGRACOES.filter((m) => m.versao < 4)) migracao.aplicar(alvo(db))
    db.run(
      `INSERT INTO sales (channel, total_amount, total_cost, payment_method, fee_amount,
         net_amount, sold_at, received_at)
       VALUES ('WhatsApp', 86, 20, 'pix', 0.85, 85.15, '2026-09-20', '2026-09-22')`
    )
    const antes = queryAll(db, 'SELECT * FROM sales')

    MIGRACOES.find((m) => m.versao === 4)!.aplicar(alvo(db))

    expect(queryAll(db, 'SELECT * FROM sales')).toEqual(antes)
    expect(queryAll(db, 'SELECT * FROM sale_payments')).toEqual([])
  })

  it('should_not_fail_when_the_payments_migration_runs_twice', async () => {
    const db = await createEmptyDb()
    aplicarMigracoes(alvo(db))

    expect(() => MIGRACOES.find((m) => m.versao === 4)!.aplicar(alvo(db))).not.toThrow()
  })

  it('should_delete_the_payments_together_with_their_sale', async () => {
    const db = await createEmptyDb()
    aplicarMigracoes(alvo(db))
    db.run(
      `INSERT INTO sales (channel, total_amount, total_cost, payment_method, sold_at)
       VALUES ('WhatsApp', 86, 20, 'areceber', '2026-09-20')`
    )
    db.run(
      `INSERT INTO sale_payments (sale_id, amount, payment_method, net_amount, received_at)
       VALUES (1, 50, 'pix', 50, '2026-09-22')`
    )

    db.run('DELETE FROM sales WHERE id = 1')

    expect(queryAll(db, 'SELECT * FROM sale_payments')).toEqual([])
  })
})

describe('atualizarEsquema (o que o boot faz com o schema)', () => {
  it('should_refuse_a_database_migrated_by_a_newer_version_of_the_app', async () => {
    // Instalador antigo rodado por cima do app atual: a 1.7.1 abriu na cliente um
    // banco migrado pela 1.11 e gravou nele com as regras antigas.
    const db = await createEmptyDb()
    aplicarMigracoes(alvo(db))
    db.run(`PRAGMA user_version = ${versaoAlvo() + 1}`)
    const antesDeMigrar = vi.fn(async () => {})

    await expect(
      atualizarEsquema(alvo(db), { bancoJaExistia: true, antesDeMigrar })
    ).rejects.toBeInstanceOf(BancoMaisNovoQueOApp)
    expect(antesDeMigrar).not.toHaveBeenCalled()
    expect(versaoAtual(alvo(db))).toBe(versaoAlvo() + 1)
  })

  it('should_tell_the_user_what_happened_and_how_to_get_back', () => {
    const erro = new BancoMaisNovoQueOApp(7, 4)

    expect(erro.versaoDoBanco).toBe(7)
    expect(erro.versaoConhecida).toBe(4)
    expect(erro.message).toContain('versão mais nova')
    expect(erro.message).toContain('Nenhum dado foi alterado')
    expect(erro.message).toContain('releases/latest')
  })

  it('should_back_up_an_existing_database_before_touching_the_schema', async () => {
    const db = await createEmptyDb()
    const versaoNoBackup: number[] = []
    const antesDeMigrar = vi.fn(async () => {
      versaoNoBackup.push(versaoAtual(alvo(db)))
    })

    const aplicadas = await atualizarEsquema(alvo(db), { bancoJaExistia: true, antesDeMigrar })

    expect(aplicadas).toEqual(MIGRACOES.map((m) => m.versao))
    expect(antesDeMigrar).toHaveBeenCalledTimes(1)
    expect(versaoNoBackup).toEqual([0])
  })

  it('should_not_back_up_a_brand_new_database', async () => {
    const db = await createEmptyDb()
    const antesDeMigrar = vi.fn(async () => {})

    await atualizarEsquema(alvo(db), { bancoJaExistia: false, antesDeMigrar })

    expect(antesDeMigrar).not.toHaveBeenCalled()
    expect(versaoAtual(alvo(db))).toBe(versaoAlvo())
  })

  it('should_neither_back_up_nor_migrate_a_current_database', async () => {
    const db = await createEmptyDb()
    aplicarMigracoes(alvo(db))
    const antesDeMigrar = vi.fn(async () => {})

    expect(await atualizarEsquema(alvo(db), { bancoJaExistia: true, antesDeMigrar })).toEqual([])
    expect(antesDeMigrar).not.toHaveBeenCalled()
  })

  it('should_not_migrate_when_the_backup_before_it_fails', async () => {
    // Sem a cópia não há volta: melhor não abrir do que migrar sem rede de proteção.
    const db = await createEmptyDb()
    const antesDeMigrar = vi.fn(async () => {
      throw new Error('disco cheio')
    })

    await expect(
      atualizarEsquema(alvo(db), { bancoJaExistia: true, antesDeMigrar })
    ).rejects.toThrow('disco cheio')
    expect(versaoAtual(alvo(db))).toBe(0)
  })
})
