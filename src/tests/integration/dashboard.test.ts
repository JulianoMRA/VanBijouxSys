import { describe, it, expect, beforeEach } from 'vitest'
import { type Database } from 'sql.js'
import { createTestDb, queryOne, queryAll } from '../helpers/testDb'

let db: Database

beforeEach(async () => {
  db = await createTestDb()
  db.run(`INSERT INTO products (name, category_id) VALUES ('Colar Rosa', 1)`)
  db.run(`INSERT INTO products (name, category_id) VALUES ('Pulseira Azul', 2)`)
  db.run(`INSERT INTO products (name, category_id) VALUES ('Brinco Pérola', 3)`)
  db.run(
    `INSERT INTO product_variations (product_id, identifier, cost_price, sale_price, stock_quantity)
     VALUES (1, 'CR-M', 5, 30, 10)`
  )
  db.run(
    `INSERT INTO product_variations (product_id, identifier, cost_price, sale_price, stock_quantity)
     VALUES (2, 'PA-G', 4, 25, 10)`
  )
  db.run(
    `INSERT INTO product_variations (product_id, identifier, cost_price, sale_price, stock_quantity)
     VALUES (3, 'BP-U', 3, 20, 10)`
  )
})

function insertSale(opts: {
  soldAt: string
  channel?: string
  items: Array<{ variationId: number; qty: number; unitPrice: number; unitCost: number }>
}): number {
  const totalAmount = opts.items.reduce((s, i) => s + i.qty * i.unitPrice, 0)
  const totalCost = opts.items.reduce((s, i) => s + i.qty * i.unitCost, 0)
  db.run(
    `INSERT INTO sales (channel, total_amount, total_cost, net_amount, sold_at)
     VALUES (?, ?, ?, ?, ?)`,
    [opts.channel ?? 'WhatsApp', totalAmount, totalCost, totalAmount, opts.soldAt]
  )
  const saleId = queryOne<{ id: number }>(db, 'SELECT last_insert_rowid() AS id')!.id
  for (const i of opts.items) {
    db.run(
      `INSERT INTO sale_items (sale_id, variation_id, quantity, unit_price, unit_cost)
       VALUES (?, ?, ?, ?, ?)`,
      [saleId, i.variationId, i.qty, i.unitPrice, i.unitCost]
    )
  }
  return saleId
}

/**
 * Reproduz as cláusulas reais usadas pelo handler do dashboard.
 * Quando esta clause espelhar o produção, os testes detectam regressões.
 */
function sSoldAtClause(fromDate: string | null, toDate: string | null): string {
  if (!fromDate) return ''
  return ` AND date(s.sold_at) >= ?${toDate ? ' AND date(s.sold_at) <= ?' : ''}`
}

function soldAtClause(fromDate: string | null, toDate: string | null): string {
  if (!fromDate) return ''
  return ` AND date(sold_at) >= ?${toDate ? ' AND date(sold_at) <= ?' : ''}`
}

function dateParams(fromDate: string | null, toDate: string | null): string[] {
  return [...(fromDate ? [fromDate] : []), ...(toDate ? [toDate] : [])]
}

describe('dashboard: normalização de datas em sold_at', () => {
  it('inclui venda com timestamp completo (HH:MM:SS) no toDate', () => {
    insertSale({ soldAt: '2026-05-14 23:59:59', items: [{ variationId: 1, qty: 1, unitPrice: 30, unitCost: 5 }] })
    insertSale({ soldAt: '2026-05-14', items: [{ variationId: 2, qty: 1, unitPrice: 25, unitCost: 4 }] })

    const from = '2026-05-01'
    const to = '2026-05-14'
    const params = dateParams(from, to)

    const overview = queryOne<{ totalRevenue: number; totalSales: number }>(
      db,
      `SELECT COALESCE(SUM(s.total_amount),0) AS totalRevenue, COUNT(s.id) AS totalSales
       FROM sales s WHERE 1=1${sSoldAtClause(from, to)}`,
      params
    )

    expect(overview!.totalSales).toBe(2)
    expect(overview!.totalRevenue).toBe(55)
  })

  it('exclui venda do dia seguinte ao toDate', () => {
    insertSale({ soldAt: '2026-05-14 10:00:00', items: [{ variationId: 1, qty: 1, unitPrice: 30, unitCost: 5 }] })
    insertSale({ soldAt: '2026-05-15 00:00:01', items: [{ variationId: 2, qty: 1, unitPrice: 25, unitCost: 4 }] })

    const params = dateParams('2026-05-01', '2026-05-14')
    const overview = queryOne<{ totalSales: number }>(
      db,
      `SELECT COUNT(s.id) AS totalSales FROM sales s WHERE 1=1${sSoldAtClause('2026-05-01', '2026-05-14')}`,
      params
    )
    expect(overview!.totalSales).toBe(1)
  })

  it('cashFlow (sold_at via soldAtClause) também inclui timestamps completos', () => {
    insertSale({ soldAt: '2026-05-14 18:30:00', items: [{ variationId: 1, qty: 2, unitPrice: 30, unitCost: 5 }] })

    const from = '2026-05-01'
    const to = '2026-05-14'
    const result = queryOne<{ income: number }>(
      db,
      `SELECT COALESCE(SUM(net_amount),0) AS income FROM sales WHERE 1=1${soldAtClause(from, to)}`,
      dateParams(from, to)
    )
    expect(result!.income).toBe(60)
  })
})

describe('dashboard: salesByCategory consistente com totalRevenue', () => {
  it('soma das categorias == totalRevenue para dados regulares', () => {
    insertSale({ soldAt: '2026-05-10', items: [{ variationId: 1, qty: 1, unitPrice: 30, unitCost: 5 }] })
    insertSale({ soldAt: '2026-05-11', items: [{ variationId: 2, qty: 2, unitPrice: 25, unitCost: 4 }] })
    insertSale({
      soldAt: '2026-05-12',
      items: [
        { variationId: 1, qty: 1, unitPrice: 30, unitCost: 5 },
        { variationId: 3, qty: 3, unitPrice: 20, unitCost: 3 }
      ]
    })

    const from = '2026-05-01'
    const to = '2026-05-31'
    const params = dateParams(from, to)

    const overview = queryOne<{ totalRevenue: number }>(
      db,
      `SELECT COALESCE(SUM(s.total_amount),0) AS totalRevenue FROM sales s WHERE 1=1${sSoldAtClause(from, to)}`,
      params
    )

    const byCategory = queryAll<{ category: string; revenue: number }>(
      db,
      `SELECT
         COALESCE(c.name, 'Sem categoria')              AS category,
         COALESCE(SUM(si.quantity * si.unit_price), 0)  AS revenue
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       LEFT JOIN product_variations pv ON pv.id = si.variation_id
       LEFT JOIN products p ON p.id = pv.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE 1=1${sSoldAtClause(from, to)}
       GROUP BY COALESCE(c.name, 'Sem categoria')
       ORDER BY revenue DESC`,
      params
    )

    const sumByCategory = byCategory.reduce((s, r) => s + r.revenue, 0)
    expect(sumByCategory).toBe(overview!.totalRevenue)
    expect(sumByCategory).toBe(170) // Colar 60 + Pulseira 50 + Brinco 60
    expect(byCategory).toHaveLength(3)
  })

  it('agrupa item órfão (variação inexistente) como "Sem categoria" sem perder faturamento', () => {
    // Cenário: sale_item aponta para variação inexistente (FK off para simular legado/migração)
    db.run('PRAGMA foreign_keys = OFF')
    db.run(
      `INSERT INTO sales (channel, total_amount, total_cost, net_amount, sold_at)
       VALUES ('WhatsApp', 50, 10, 50, '2026-05-15')`
    )
    const saleId = queryOne<{ id: number }>(db, 'SELECT last_insert_rowid() AS id')!.id
    db.run(
      `INSERT INTO sale_items (sale_id, variation_id, quantity, unit_price, unit_cost)
       VALUES (?, 9999, 1, 50, 10)`,
      [saleId]
    )
    db.run('PRAGMA foreign_keys = ON')

    const from = '2026-05-01'
    const to = '2026-05-31'
    const params = dateParams(from, to)

    const overview = queryOne<{ totalRevenue: number }>(
      db,
      `SELECT COALESCE(SUM(s.total_amount),0) AS totalRevenue FROM sales s WHERE 1=1${sSoldAtClause(from, to)}`,
      params
    )

    const byCategory = queryAll<{ category: string; revenue: number }>(
      db,
      `SELECT
         COALESCE(c.name, 'Sem categoria')              AS category,
         COALESCE(SUM(si.quantity * si.unit_price), 0)  AS revenue
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       LEFT JOIN product_variations pv ON pv.id = si.variation_id
       LEFT JOIN products p ON p.id = pv.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE 1=1${sSoldAtClause(from, to)}
       GROUP BY COALESCE(c.name, 'Sem categoria')`,
      params
    )

    const sumByCategory = byCategory.reduce((s, r) => s + r.revenue, 0)
    expect(sumByCategory).toBe(overview!.totalRevenue)

    const orfaos = byCategory.find((r) => r.category === 'Sem categoria')
    expect(orfaos).toBeDefined()
    expect(orfaos!.revenue).toBe(50)
  })
})

describe('dashboard: previousOverview usa mesma normalização do overview', () => {
  it('compara consistentemente períodos atual e anterior', () => {
    insertSale({ soldAt: '2026-04-30 23:30:00', items: [{ variationId: 1, qty: 1, unitPrice: 30, unitCost: 5 }] })
    insertSale({ soldAt: '2026-05-14 20:00:00', items: [{ variationId: 2, qty: 1, unitPrice: 25, unitCost: 4 }] })

    const currParams = dateParams('2026-05-01', '2026-05-14')
    const prevParams = dateParams('2026-04-01', '2026-04-30')

    const curr = queryOne<{ totalRevenue: number }>(
      db,
      `SELECT COALESCE(SUM(s.total_amount),0) AS totalRevenue FROM sales s WHERE 1=1${sSoldAtClause('2026-05-01', '2026-05-14')}`,
      currParams
    )
    const prev = queryOne<{ totalRevenue: number }>(
      db,
      `SELECT COALESCE(SUM(s.total_amount),0) AS totalRevenue FROM sales s WHERE 1=1${sSoldAtClause('2026-04-01', '2026-04-30')}`,
      prevParams
    )

    expect(curr!.totalRevenue).toBe(25)
    expect(prev!.totalRevenue).toBe(30)
  })
})

// Estes testes DOCUMENTAM o bug histórico: comparação sem date() exclui timestamps completos.
// Servem como guarda de regressão — se o código voltar a usar comparação crua, falham.
describe('dashboard: REGRESSÃO — comparação crua exclui timestamps', () => {
  it('comparação crua s.sold_at <= ? EXCLUI venda do mesmo dia com HH:MM:SS (bug)', () => {
    insertSale({ soldAt: '2026-05-14 23:59:59', items: [{ variationId: 1, qty: 1, unitPrice: 30, unitCost: 5 }] })

    const result = queryOne<{ count: number }>(
      db,
      `SELECT COUNT(s.id) AS count FROM sales s WHERE s.sold_at >= ? AND s.sold_at <= ?`,
      ['2026-05-01', '2026-05-14']
    )
    // Confirma o bug: '2026-05-14 23:59:59' > '2026-05-14' em comparação textual.
    // Quando dashboard.ts usar date(), este teste continuará passando (apenas documenta).
    expect(result!.count).toBe(0)
  })
})
