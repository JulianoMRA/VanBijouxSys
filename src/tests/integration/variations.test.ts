import { describe, it, expect, beforeEach } from 'vitest'
import { type Database } from 'sql.js'
import { createTestDb, queryOne, queryAll } from '../helpers/testDb'

let db: Database

beforeEach(async () => {
  db = await createTestDb()
  // Semente: categoria, produto, insumo
  db.run(`INSERT INTO products (name, category_id) VALUES ('Colar Azul', 1)`)
  db.run(`INSERT INTO insumos (name, unit, cost_per_unit, stock_quantity) VALUES ('Fio de nylon', 'cm', 0.05, 100)`)
})

describe('variations:create com estoque inicial', () => {
  it('should deduct insumo stock when creating variation with initial stock', () => {
    // Cria variação com 5 peças no estoque; receita: 10 cm por peça
    db.run(`INSERT INTO product_variations (product_id, identifier, cost_price, sale_price, stock_quantity) VALUES (1, 'P-Azul-M', 5, 20, 5)`)
    const varId = (queryOne<{ id: number }>(db, 'SELECT last_insert_rowid() AS id'))!.id
    db.run(`INSERT INTO variation_insumos (variation_id, insumo_id, quantity) VALUES (?, 1, 10)`, [varId])

    // Simula a dedução: 5 peças × 10 cm = 50 cm
    db.run(`UPDATE insumos SET stock_quantity = MAX(0, stock_quantity - ?) WHERE id = 1`, [10 * 5])

    const insumo = queryOne<{ stock_quantity: number }>(db, 'SELECT stock_quantity FROM insumos WHERE id = 1')
    expect(insumo!.stock_quantity).toBe(50) // 100 - 50
  })

  it('should not go below zero when deducting more than available', () => {
    db.run(`INSERT INTO product_variations (product_id, identifier, stock_quantity) VALUES (1, 'P-Azul-G', 200)`)
    const varId = (queryOne<{ id: number }>(db, 'SELECT last_insert_rowid() AS id'))!.id
    db.run(`INSERT INTO variation_insumos (variation_id, insumo_id, quantity) VALUES (?, 1, 1)`, [varId])

    // 200 peças × 1 cm = 200 cm, mas só há 100 cm disponíveis
    db.run(`UPDATE insumos SET stock_quantity = MAX(0, stock_quantity - ?) WHERE id = 1`, [1 * 200])

    const insumo = queryOne<{ stock_quantity: number }>(db, 'SELECT stock_quantity FROM insumos WHERE id = 1')
    expect(insumo!.stock_quantity).toBe(0)
  })
})

describe('variations:addStock', () => {
  it('should increase variation stock and deduct insumos', () => {
    db.run(`INSERT INTO product_variations (product_id, identifier, stock_quantity) VALUES (1, 'P-Azul-P', 0)`)
    const varId = (queryOne<{ id: number }>(db, 'SELECT last_insert_rowid() AS id'))!.id
    db.run(`INSERT INTO variation_insumos (variation_id, insumo_id, quantity) VALUES (?, 1, 10)`, [varId])

    const qty = 3
    db.run(`UPDATE product_variations SET stock_quantity = stock_quantity + ? WHERE id = ?`, [qty, varId])
    const recipe = queryAll<{ quantity: number; insumo_id: number }>(db, 'SELECT * FROM variation_insumos WHERE variation_id = ?', [varId])
    for (const item of recipe) {
      db.run(`UPDATE insumos SET stock_quantity = MAX(0, stock_quantity - ?) WHERE id = ?`, [item.quantity * qty, item.insumo_id])
    }

    const variation = queryOne<{ stock_quantity: number }>(db, 'SELECT stock_quantity FROM product_variations WHERE id = ?', [varId])
    const insumo = queryOne<{ stock_quantity: number }>(db, 'SELECT stock_quantity FROM insumos WHERE id = 1')
    expect(variation!.stock_quantity).toBe(3)
    expect(insumo!.stock_quantity).toBe(70) // 100 - 3×10
  })

  it('should clamp insumo stock at zero when not enough available', () => {
    db.run(`INSERT INTO product_variations (product_id, identifier, stock_quantity) VALUES (1, 'P-Azul-G', 0)`)
    const varId = (queryOne<{ id: number }>(db, 'SELECT last_insert_rowid() AS id'))!.id
    db.run(`INSERT INTO variation_insumos (variation_id, insumo_id, quantity) VALUES (?, 1, 50)`, [varId])

    // Adiciona 5 peças × 50 cm = 250 cm, mas só há 100 disponíveis
    db.run(`UPDATE insumos SET stock_quantity = MAX(0, stock_quantity - ?) WHERE id = 1`, [50 * 5])

    const insumo = queryOne<{ stock_quantity: number }>(db, 'SELECT stock_quantity FROM insumos WHERE id = 1')
    expect(insumo!.stock_quantity).toBe(0)
  })
})

describe('variations:delete cascade', () => {
  it('should delete variation_insumos when variation is deleted', () => {
    db.run(`INSERT INTO product_variations (product_id, identifier) VALUES (1, 'P-Azul-P')`)
    const varId = (queryOne<{ id: number }>(db, 'SELECT last_insert_rowid() AS id'))!.id
    db.run(`INSERT INTO variation_insumos (variation_id, insumo_id, quantity) VALUES (?, 1, 10)`, [varId])

    db.run(`DELETE FROM product_variations WHERE id = ?`, [varId])

    const recipes = queryAll(db, 'SELECT * FROM variation_insumos WHERE variation_id = ?', [varId])
    expect(recipes).toHaveLength(0)
  })
})
