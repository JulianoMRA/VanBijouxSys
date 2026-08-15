import { describe, it, expect, beforeEach } from 'vitest'
import { type Database } from 'sql.js'
import { createTestDb, queryAll, queryOne } from '../helpers/testDb'
import {
  SQL_INSUMOS_ABAIXO_DO_MINIMO,
  SQL_INSUMOS_COM_USO,
  SQL_INSUMOS_ESGOTADOS,
  SQL_VARIACOES_ABAIXO_DO_MINIMO,
  SQL_VARIACOES_ESGOTADAS
} from '../../main/database/consultas-estoque'

let db: Database

/**
 * Cenário fixo: um produto com duas variações problemáticas (uma esgotada e
 * uma abaixo do mínimo) e um insumo esgotado. É exatamente o que polui os
 * avisos da cliente hoje.
 */
beforeEach(async () => {
  db = await createTestDb()
  db.run(`INSERT INTO products (name, category_id) VALUES ('Colar Aurora', 1)`)
  db.run(`INSERT INTO products (name, category_id) VALUES ('Pulseira Luar', 2)`)
  db.run(
    `INSERT INTO product_variations (product_id, identifier, cost_price, sale_price, stock_quantity, minimum_stock)
     VALUES (1, 'Dourado P', 10, 40, 0, 4)`
  )
  db.run(
    `INSERT INTO product_variations (product_id, identifier, cost_price, sale_price, stock_quantity, minimum_stock)
     VALUES (1, 'Rose', 10, 40, 2, 5)`
  )
  db.run(
    `INSERT INTO product_variations (product_id, identifier, cost_price, sale_price, stock_quantity, minimum_stock)
     VALUES (2, 'M', 8, 30, 9, 3)`
  )
  db.run(
    `INSERT INTO insumos (name, unit, cost_per_unit, stock_quantity, minimum_stock)
     VALUES ('Fecho lagosta', 'unidade', 0.45, 0, 50)`
  )
  db.run(
    `INSERT INTO insumos (name, unit, cost_per_unit, stock_quantity, minimum_stock)
     VALUES ('Argola 8mm', 'unidade', 0.18, 120, 300)`
  )
})

function identificadores(sql: string): string[] {
  return queryAll<{ identifier: string }>(db, sql).map((r) => r.identifier)
}

function nomes(sql: string): string[] {
  return queryAll<{ name: string }>(db, sql).map((r) => r.name)
}

function arquivar(tabela: string, id: number): void {
  db.run(`UPDATE ${tabela} SET archived_at = '2026-08-15 10:00:00' WHERE id = ${id}`)
}

function desarquivar(tabela: string, id: number): void {
  db.run(`UPDATE ${tabela} SET archived_at = NULL WHERE id = ${id}`)
}

describe('alertas de estoque com itens arquivados', () => {
  it('should_list_the_problem_items_while_nothing_is_archived', () => {
    expect(identificadores(SQL_VARIACOES_ESGOTADAS)).toEqual(['Dourado P'])
    expect(identificadores(SQL_VARIACOES_ABAIXO_DO_MINIMO)).toEqual(['Rose'])
    expect(nomes(SQL_INSUMOS_ESGOTADOS)).toEqual(['Fecho lagosta'])
    expect(nomes(SQL_INSUMOS_ABAIXO_DO_MINIMO)).toEqual(['Argola 8mm'])
  })

  it('should_drop_an_archived_variation_from_the_out_of_stock_alert', () => {
    arquivar('product_variations', 1)

    expect(identificadores(SQL_VARIACOES_ESGOTADAS)).toEqual([])
  })

  it('should_drop_an_archived_variation_from_the_low_stock_alert', () => {
    arquivar('product_variations', 2)

    expect(identificadores(SQL_VARIACOES_ABAIXO_DO_MINIMO)).toEqual([])
  })

  it('should_silence_every_variation_of_an_archived_product', () => {
    // O produto é arquivado sozinho: as variações continuam com archived_at
    // nulo e mesmo assim precisam sair dos avisos.
    arquivar('products', 1)

    expect(identificadores(SQL_VARIACOES_ESGOTADAS)).toEqual([])
    expect(identificadores(SQL_VARIACOES_ABAIXO_DO_MINIMO)).toEqual([])
    expect(
      queryOne<{ archived_at: string | null }>(
        db,
        'SELECT archived_at FROM product_variations WHERE id = 1'
      )
    ).toEqual({ archived_at: null })
  })

  it('should_drop_archived_insumos_from_both_alerts', () => {
    arquivar('insumos', 1)
    arquivar('insumos', 2)

    expect(nomes(SQL_INSUMOS_ESGOTADOS)).toEqual([])
    expect(nomes(SQL_INSUMOS_ABAIXO_DO_MINIMO)).toEqual([])
  })

  it('should_keep_alerting_for_items_that_were_not_archived', () => {
    arquivar('product_variations', 1)
    arquivar('insumos', 1)

    expect(identificadores(SQL_VARIACOES_ABAIXO_DO_MINIMO)).toEqual(['Rose'])
    expect(nomes(SQL_INSUMOS_ABAIXO_DO_MINIMO)).toEqual(['Argola 8mm'])
  })
})

describe('voltar atrás', () => {
  it('should_bring_the_alert_back_when_the_variation_is_unarchived', () => {
    arquivar('product_variations', 1)
    desarquivar('product_variations', 1)

    expect(identificadores(SQL_VARIACOES_ESGOTADAS)).toEqual(['Dourado P'])
  })

  it('should_not_resurrect_a_variation_archived_on_its_own', () => {
    // Motivo da derivação: se arquivar o produto escrevesse nas variações,
    // desarquivar traria de volta a variação que ela já tinha arquivado antes.
    arquivar('product_variations', 1)
    arquivar('products', 1)
    desarquivar('products', 1)

    expect(identificadores(SQL_VARIACOES_ESGOTADAS)).toEqual([])
    expect(identificadores(SQL_VARIACOES_ABAIXO_DO_MINIMO)).toEqual(['Rose'])
  })
})

describe('histórico e métricas', () => {
  beforeEach(() => {
    db.run(
      `INSERT INTO sales (channel, total_amount, total_cost, net_amount, sold_at)
       VALUES ('Feira', 80, 20, 80, '2026-08-10')`
    )
    db.run(
      `INSERT INTO sale_items (sale_id, variation_id, quantity, unit_price, unit_cost)
       VALUES (1, 1, 2, 40, 10)`
    )
  })

  it('should_keep_revenue_and_profit_untouched_after_archiving', () => {
    const antes = queryOne<{ revenue: number; cost: number }>(
      db,
      'SELECT SUM(total_amount) AS revenue, SUM(total_cost) AS cost FROM sales'
    )

    arquivar('product_variations', 1)
    arquivar('products', 1)

    expect(
      queryOne<{ revenue: number; cost: number }>(
        db,
        'SELECT SUM(total_amount) AS revenue, SUM(total_cost) AS cost FROM sales'
      )
    ).toEqual(antes)
  })

  it('should_still_name_an_archived_variation_in_the_sales_history', () => {
    // "Mais vendidas" e o detalhe da venda continuam mostrando o que foi
    // vendido — arquivar não é excluir.
    arquivar('product_variations', 1)

    const item = queryOne<{ productName: string; identifier: string; quantity: number }>(
      db,
      `SELECT p.name AS productName, pv.identifier, si.quantity
         FROM sale_items si
         JOIN product_variations pv ON pv.id = si.variation_id
         JOIN products p ON p.id = pv.product_id
        WHERE si.sale_id = 1`
    )

    expect(item).toEqual({ productName: 'Colar Aurora', identifier: 'Dourado P', quantity: 2 })
  })
})

describe('uso de insumo por variações ativas', () => {
  beforeEach(() => {
    db.run(`INSERT INTO variation_insumos (variation_id, insumo_id, quantity) VALUES (1, 1, 1)`)
    db.run(`INSERT INTO variation_insumos (variation_id, insumo_id, quantity) VALUES (3, 1, 2)`)
  })

  function usoDoFecho(): number {
    return queryAll<{ id: number; usadoPorVariacoesAtivas: number }>(db, SQL_INSUMOS_COM_USO).find(
      (i) => i.id === 1
    )!.usadoPorVariacoesAtivas
  }

  it('should_count_every_active_variation_using_it', () => {
    expect(usoDoFecho()).toBe(2)
  })

  it('should_ignore_variations_that_were_archived', () => {
    arquivar('product_variations', 1)

    expect(usoDoFecho()).toBe(1)
  })

  it('should_ignore_variations_whose_product_was_archived', () => {
    arquivar('products', 2)

    expect(usoDoFecho()).toBe(1)
  })

  it('should_still_list_archived_insumos_so_the_screen_can_show_them', () => {
    arquivar('insumos', 1)

    const lista = queryAll<{ id: number; archivedAt: string | null }>(db, SQL_INSUMOS_COM_USO)

    expect(lista).toHaveLength(2)
    expect(lista.find((i) => i.id === 1)!.archivedAt).toBe('2026-08-15 10:00:00')
  })
})
