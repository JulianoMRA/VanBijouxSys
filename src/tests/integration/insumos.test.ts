import { describe, it, expect, beforeEach } from 'vitest'
import { type Database } from 'sql.js'
import { createTestDb, queryOne, queryAll } from '../helpers/testDb'

let db: Database

beforeEach(async () => {
  db = await createTestDb()
  db.run(`INSERT INTO insumos (name, unit, cost_per_unit, stock_quantity, minimum_stock) VALUES ('Fio de nylon', 'cm', 0.05, 200, 50)`)
  db.run(`INSERT INTO insumos (name, unit, cost_per_unit, stock_quantity, minimum_stock) VALUES ('Miçanga', 'unidade', 0.10, 500, 100)`)
})

describe('insumos:create', () => {
  it('should insert and retrieve insumo correctly', () => {
    db.run(`INSERT INTO insumos (name, unit, cost_per_unit, stock_quantity, minimum_stock) VALUES ('Elástico', 'cm', 0.02, 300, 80)`)

    const insumo = queryOne<{ name: string; stock_quantity: number }>(
      db, `SELECT * FROM insumos WHERE name = 'Elástico'`
    )
    expect(insumo!.name).toBe('Elástico')
    expect(insumo!.stock_quantity).toBe(300)
  })
})

describe('insumos:update', () => {
  it('should update insumo fields', () => {
    db.run(`UPDATE insumos SET cost_per_unit = 0.08, minimum_stock = 60 WHERE id = 1`)

    const insumo = queryOne<{ cost_per_unit: number; minimum_stock: number }>(
      db, 'SELECT * FROM insumos WHERE id = 1'
    )
    expect(insumo!.cost_per_unit).toBe(0.08)
    expect(insumo!.minimum_stock).toBe(60)
  })
})

describe('insumos:addStock', () => {
  it('should increase stock quantity', () => {
    db.run(`UPDATE insumos SET stock_quantity = stock_quantity + ? WHERE id = 1`, [100])

    const insumo = queryOne<{ stock_quantity: number }>(db, 'SELECT stock_quantity FROM insumos WHERE id = 1')
    expect(insumo!.stock_quantity).toBe(300)
  })

  it('should not go below zero (MAX(0) protection)', () => {
    db.run(`UPDATE insumos SET stock_quantity = MAX(0, stock_quantity - ?) WHERE id = 1`, [9999])

    const insumo = queryOne<{ stock_quantity: number }>(db, 'SELECT stock_quantity FROM insumos WHERE id = 1')
    expect(insumo!.stock_quantity).toBe(0)
  })
})

describe('insumos:delete', () => {
  it('should delete insumo that is not referenced', () => {
    db.run(`DELETE FROM insumos WHERE id = 2`)

    const insumos = queryAll(db, 'SELECT * FROM insumos')
    expect(insumos).toHaveLength(1)
  })

  it('should fail to delete insumo referenced by variation_insumos', () => {
    db.run(`INSERT INTO products (name, category_id) VALUES ('Colar', 1)`)
    db.run(`INSERT INTO product_variations (product_id, identifier) VALUES (1, 'Colar-P')`)
    const varId = (queryOne<{ id: number }>(db, 'SELECT last_insert_rowid() AS id'))!.id
    db.run(`INSERT INTO variation_insumos (variation_id, insumo_id, quantity) VALUES (?, 1, 5)`, [varId])

    expect(() => db.run(`DELETE FROM insumos WHERE id = 1`)).toThrow()
  })
})

describe('low stock query', () => {
  it('should return insumos below minimum stock', () => {
    db.run(`UPDATE insumos SET stock_quantity = 30 WHERE id = 1`) // abaixo do mínimo de 50

    const lowInsumos = queryAll<{ name: string }>(
      db, `SELECT * FROM insumos WHERE minimum_stock > 0 AND stock_quantity < minimum_stock`
    )
    expect(lowInsumos).toHaveLength(1)
    expect(lowInsumos[0].name).toBe('Fio de nylon')
  })

  it('should not flag insumos at or above minimum stock', () => {
    // Fio: 200 >= 50 ✓, Miçanga: 500 >= 100 ✓
    const lowInsumos = queryAll(
      db, `SELECT * FROM insumos WHERE minimum_stock > 0 AND stock_quantity < minimum_stock`
    )
    expect(lowInsumos).toHaveLength(0)
  })
})
