import { describe, it, expect, beforeEach } from 'vitest'
import { type Database } from 'sql.js'
import { createTestDb, queryOne, queryAll } from '../helpers/testDb'

let db: Database

beforeEach(async () => {
  db = await createTestDb()
  db.run(`INSERT INTO products (name, category_id) VALUES ('Pulseira Rosa', 2)`)
  db.run(`INSERT INTO product_variations (product_id, identifier, cost_price, sale_price, stock_quantity) VALUES (1, 'P-Rosa-M', 10, 35, 10)`)
})

function createSale(variationId: number, qty: number, unitPrice: number, unitCost: number): number {
  const totalAmount = qty * unitPrice
  const totalCost = qty * unitCost

  db.run(
    `INSERT INTO sales (channel, total_amount, total_cost, sold_at) VALUES ('WhatsApp', ?, ?, '2025-03-15')`,
    [totalAmount, totalCost]
  )
  const saleId = (queryOne<{ id: number }>(db, 'SELECT last_insert_rowid() AS id'))!.id

  db.run(
    `INSERT INTO sale_items (sale_id, variation_id, quantity, unit_price, unit_cost) VALUES (?, ?, ?, ?, ?)`,
    [saleId, variationId, qty, unitPrice, unitCost]
  )
  db.run(
    `UPDATE product_variations SET stock_quantity = MAX(0, stock_quantity - ?) WHERE id = ?`,
    [qty, variationId]
  )

  return saleId
}

describe('sales:create', () => {
  it('should decrease variation stock on sale', () => {
    createSale(1, 3, 35, 10)

    const v = queryOne<{ stock_quantity: number }>(db, 'SELECT stock_quantity FROM product_variations WHERE id = 1')
    expect(v!.stock_quantity).toBe(7) // 10 - 3
  })

  it('should clamp stock at zero when selling more than available', () => {
    createSale(1, 20, 35, 10) // 20 > 10 disponíveis

    const v = queryOne<{ stock_quantity: number }>(db, 'SELECT stock_quantity FROM product_variations WHERE id = 1')
    expect(v!.stock_quantity).toBe(0)
  })

  it('should persist sale and sale items', () => {
    const saleId = createSale(1, 2, 35, 10)

    const sale = queryOne<{ total_amount: number; total_cost: number }>(db, 'SELECT * FROM sales WHERE id = ?', [saleId])
    expect(sale!.total_amount).toBe(70)
    expect(sale!.total_cost).toBe(20)

    const items = queryAll(db, 'SELECT * FROM sale_items WHERE sale_id = ?', [saleId])
    expect(items).toHaveLength(1)
  })
})

describe('sales:delete', () => {
  it('should restore variation stock on delete', () => {
    const saleId = createSale(1, 3, 35, 10)

    // Restaura estoque (mesma lógica do handler)
    const items = queryAll<{ variation_id: number; quantity: number }>(
      db, 'SELECT variation_id, quantity FROM sale_items WHERE sale_id = ?', [saleId]
    )
    for (const item of items) {
      db.run(`UPDATE product_variations SET stock_quantity = stock_quantity + ? WHERE id = ?`, [item.quantity, item.variation_id])
    }
    db.run(`DELETE FROM sales WHERE id = ?`, [saleId])

    const v = queryOne<{ stock_quantity: number }>(db, 'SELECT stock_quantity FROM product_variations WHERE id = 1')
    expect(v!.stock_quantity).toBe(10) // voltou ao original
  })

  it('should cascade delete sale_items when sale is deleted', () => {
    const saleId = createSale(1, 2, 35, 10)
    db.run(`DELETE FROM sales WHERE id = ?`, [saleId])

    const items = queryAll(db, 'SELECT * FROM sale_items WHERE sale_id = ?', [saleId])
    expect(items).toHaveLength(0)
  })

  it('should not affect other sales stock when deleting one', () => {
    createSale(1, 2, 35, 10)   // estoque: 8
    const saleId2 = createSale(1, 1, 35, 10) // estoque: 7

    // Deleta só a segunda venda
    const items = queryAll<{ variation_id: number; quantity: number }>(
      db, 'SELECT variation_id, quantity FROM sale_items WHERE sale_id = ?', [saleId2]
    )
    for (const item of items) {
      db.run(`UPDATE product_variations SET stock_quantity = stock_quantity + ? WHERE id = ?`, [item.quantity, item.variation_id])
    }
    db.run(`DELETE FROM sales WHERE id = ?`, [saleId2])

    const v = queryOne<{ stock_quantity: number }>(db, 'SELECT stock_quantity FROM product_variations WHERE id = 1')
    expect(v!.stock_quantity).toBe(8) // restaurou 1 da segunda venda, mas não a primeira
  })
})
