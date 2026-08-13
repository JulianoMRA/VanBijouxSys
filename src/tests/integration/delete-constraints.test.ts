import { describe, it, expect, beforeEach } from 'vitest'
import { type Database } from 'sql.js'
import { createTestDb, queryOne } from '../helpers/testDb'
import { mensagemPara } from '../../main/ipc/mensagens'

let db: Database

beforeEach(async () => {
  db = await createTestDb()
  db.run(`INSERT INTO fairs (name, location, date) VALUES ('Feira do Bosque', 'Praça', '2026-03-10')`)
  db.run(`INSERT INTO products (name, category_id) VALUES ('Colar Lua', 1)`)
  db.run(
    `INSERT INTO product_variations (product_id, identifier, cost_price, sale_price, stock_quantity)
     VALUES (1, 'Dourado', 10, 40, 5)`
  )
  db.run(
    `INSERT INTO sales (channel, fair_id, total_amount, total_cost, sold_at)
     VALUES ('Feira', 1, 40, 10, '2026-03-10')`
  )
  db.run(
    `INSERT INTO sale_items (sale_id, variation_id, quantity, unit_price, unit_cost)
     VALUES (1, 1, 1, 40, 10)`
  )
})

function excluir(sql: string): Error | null {
  try {
    db.run(sql)
    return null
  } catch (err) {
    return err as Error
  }
}

function contar(tabela: string): number {
  return queryOne<{ total: number }>(db, `SELECT COUNT(*) AS total FROM ${tabela}`)!.total
}

describe('exclusões bloqueadas por venda registrada', () => {
  it('should_refuse_to_delete_a_variation_that_was_sold', () => {
    const erro = excluir('DELETE FROM product_variations WHERE id = 1')

    expect(erro).not.toBeNull()
    expect(erro!.message).toMatch(/FOREIGN KEY constraint failed/)
    expect(contar('product_variations')).toBe(1)
  })

  it('should_refuse_to_delete_a_product_whose_variation_was_sold', () => {
    const erro = excluir('DELETE FROM products WHERE id = 1')

    expect(erro).not.toBeNull()
    expect(contar('products')).toBe(1)
  })

  it('should_refuse_to_delete_a_fair_with_sales', () => {
    const erro = excluir('DELETE FROM fairs WHERE id = 1')

    expect(erro).not.toBeNull()
    expect(contar('fairs')).toBe(1)
  })

  it('should_preserve_the_sale_history_after_a_refused_delete', () => {
    excluir('DELETE FROM products WHERE id = 1')

    expect(contar('sales')).toBe(1)
    expect(contar('sale_items')).toBe(1)
  })

  it('should_translate_the_constraint_error_into_a_message_for_the_user', () => {
    const erro = excluir('DELETE FROM products WHERE id = 1')

    const mensagem = mensagemPara('products:delete', erro)
    expect(mensagem).toContain('vendas registradas')
    expect(mensagem).not.toMatch(/FOREIGN KEY/)
  })

  it('should_allow_deleting_a_variation_that_was_never_sold', () => {
    db.run(
      `INSERT INTO product_variations (product_id, identifier, cost_price, sale_price, stock_quantity)
       VALUES (1, 'Prateado', 10, 40, 3)`
    )

    const erro = excluir('DELETE FROM product_variations WHERE id = 2')

    expect(erro).toBeNull()
    expect(contar('product_variations')).toBe(1)
  })

  it('should_cascade_sale_items_when_the_sale_itself_is_deleted', () => {
    const erro = excluir('DELETE FROM sales WHERE id = 1')

    expect(erro).toBeNull()
    expect(contar('sale_items')).toBe(0)
  })
})
