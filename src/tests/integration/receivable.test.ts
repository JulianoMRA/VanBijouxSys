import { describe, it, expect, beforeEach } from 'vitest'
import { type Database } from 'sql.js'
import { createTestDb, queryOne, queryAll } from '../helpers/testDb'

let db: Database

beforeEach(async () => {
  db = await createTestDb()
  db.run(`INSERT INTO products (name, category_id) VALUES ('Colar Rosa', 1)`)
  db.run(
    `INSERT INTO product_variations (product_id, identifier, cost_price, sale_price, stock_quantity)
     VALUES (1, 'CR-M', 5, 30, 10)`
  )
})

function insertSale(opts: {
  soldAt: string
  paymentMethod?: string
  feePercentage?: number
  feeAmount?: number
  netAmount?: number
  receivedAt?: string | null
  items: Array<{ variationId: number; qty: number; unitPrice: number; unitCost: number }>
}): number {
  const totalAmount = opts.items.reduce((s, i) => s + i.qty * i.unitPrice, 0)
  const totalCost = opts.items.reduce((s, i) => s + i.qty * i.unitCost, 0)
  const paymentMethod = opts.paymentMethod ?? 'dinheiro'
  const feePercentage = opts.feePercentage ?? 0
  const feeAmount = opts.feeAmount ?? 0
  const netAmount = opts.netAmount ?? totalAmount - feeAmount
  const receivedAt = opts.receivedAt ?? null

  db.run(
    `INSERT INTO sales
      (channel, total_amount, total_cost, payment_method, fee_percentage, fee_amount, net_amount, sold_at, received_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'WhatsApp',
      totalAmount,
      totalCost,
      paymentMethod,
      feePercentage,
      feeAmount,
      netAmount,
      opts.soldAt,
      receivedAt
    ]
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

describe("'A receber' — competência vs caixa", () => {
  it('venda A receber pendente NÃO entra em cashSummary.totalIncome', () => {
    insertSale({
      soldAt: '2026-05-10',
      paymentMethod: 'areceber',
      items: [{ variationId: 1, qty: 1, unitPrice: 30, unitCost: 5 }]
    })

    const result = queryOne<{ total: number }>(
      db,
      `SELECT COALESCE(SUM(net_amount), 0) AS total
       FROM sales
       WHERE payment_method != 'areceber'
         AND date(COALESCE(received_at, sold_at)) >= ? AND date(COALESCE(received_at, sold_at)) <= ?`,
      ['2026-05-01', '2026-05-31']
    )
    expect(result!.total).toBe(0)
  })

  it('venda A receber pendente CONTA em overview.totalRevenue/totalProfit', () => {
    insertSale({
      soldAt: '2026-05-10',
      paymentMethod: 'areceber',
      items: [{ variationId: 1, qty: 1, unitPrice: 30, unitCost: 5 }]
    })

    const result = queryOne<{ totalRevenue: number; totalProfit: number; totalSales: number }>(
      db,
      `SELECT
         COALESCE(SUM(s.total_amount), 0)              AS totalRevenue,
         COALESCE(SUM(s.net_amount - s.total_cost), 0) AS totalProfit,
         COUNT(s.id)                                    AS totalSales
       FROM sales s
       WHERE date(s.sold_at) >= ? AND date(s.sold_at) <= ?`,
      ['2026-05-01', '2026-05-31']
    )
    expect(result!.totalRevenue).toBe(30)
    expect(result!.totalProfit).toBe(25)
    expect(result!.totalSales).toBe(1)
  })

  it('overview.totalReceivable soma vendas pendentes do período', () => {
    insertSale({
      soldAt: '2026-05-10',
      paymentMethod: 'areceber',
      items: [{ variationId: 1, qty: 1, unitPrice: 30, unitCost: 5 }]
    })
    insertSale({
      soldAt: '2026-05-11',
      paymentMethod: 'areceber',
      items: [{ variationId: 1, qty: 2, unitPrice: 30, unitCost: 5 }]
    })
    insertSale({
      soldAt: '2026-05-12',
      paymentMethod: 'dinheiro',
      items: [{ variationId: 1, qty: 1, unitPrice: 30, unitCost: 5 }]
    })

    const result = queryOne<{ total: number }>(
      db,
      `SELECT COALESCE(SUM(net_amount), 0) AS total
       FROM sales
       WHERE payment_method = 'areceber'
         AND date(sold_at) >= ? AND date(sold_at) <= ?`,
      ['2026-05-01', '2026-05-31']
    )
    expect(result!.total).toBe(90) // 30 + 60
  })

  it('totalReceivable IGNORA vendas já recebidas (areceber convertida para outro método)', () => {
    insertSale({
      soldAt: '2026-05-10',
      paymentMethod: 'pix',
      receivedAt: '2026-05-20',
      items: [{ variationId: 1, qty: 1, unitPrice: 30, unitCost: 5 }]
    })
    insertSale({
      soldAt: '2026-05-11',
      paymentMethod: 'areceber',
      items: [{ variationId: 1, qty: 1, unitPrice: 30, unitCost: 5 }]
    })

    const result = queryOne<{ total: number }>(
      db,
      `SELECT COALESCE(SUM(net_amount), 0) AS total
       FROM sales
       WHERE payment_method = 'areceber'
         AND date(sold_at) >= ? AND date(sold_at) <= ?`,
      ['2026-05-01', '2026-05-31']
    )
    expect(result!.total).toBe(30) // só a pendente
  })
})

describe("'A receber' — markAsReceived e unmarkAsReceived", () => {
  it('markAsReceived: atualiza payment_method, fee, net_amount e received_at', () => {
    const saleId = insertSale({
      soldAt: '2026-05-10',
      paymentMethod: 'areceber',
      items: [{ variationId: 1, qty: 1, unitPrice: 100, unitCost: 20 }]
    })

    db.run(
      `UPDATE sales
         SET payment_method = ?, fee_percentage = ?, fee_amount = ?, net_amount = ?, received_at = ?
       WHERE id = ?`,
      ['pix', 0.99, 0.99, 99.01, '2026-05-20', saleId]
    )

    const sale = queryOne<{
      payment_method: string
      fee_amount: number
      net_amount: number
      received_at: string
    }>(db, 'SELECT payment_method, fee_amount, net_amount, received_at FROM sales WHERE id = ?', [
      saleId
    ])
    expect(sale!.payment_method).toBe('pix')
    expect(sale!.fee_amount).toBeCloseTo(0.99, 2)
    expect(sale!.net_amount).toBeCloseTo(99.01, 2)
    expect(sale!.received_at).toBe('2026-05-20')
  })

  it('unmarkAsReceived: restaura para areceber, fee=0, net=total, received_at=NULL', () => {
    const saleId = insertSale({
      soldAt: '2026-05-10',
      paymentMethod: 'pix',
      feePercentage: 0.99,
      feeAmount: 0.99,
      netAmount: 99.01,
      receivedAt: '2026-05-20',
      items: [{ variationId: 1, qty: 1, unitPrice: 100, unitCost: 20 }]
    })

    db.run(
      `UPDATE sales
         SET payment_method = 'areceber', fee_percentage = 0, fee_amount = 0, net_amount = total_amount, received_at = NULL
       WHERE id = ?`,
      [saleId]
    )

    const sale = queryOne<{
      payment_method: string
      fee_amount: number
      net_amount: number
      received_at: string | null
    }>(db, 'SELECT payment_method, fee_amount, net_amount, received_at FROM sales WHERE id = ?', [
      saleId
    ])
    expect(sale!.payment_method).toBe('areceber')
    expect(sale!.fee_amount).toBe(0)
    expect(sale!.net_amount).toBe(100)
    expect(sale!.received_at).toBeNull()
  })
})

describe("'A receber' — cashFlow agrupa por data efetiva de recebimento", () => {
  it('venda vendida em março mas recebida em maio aparece em maio no cashFlow', () => {
    // Venda em março, recebida em maio
    insertSale({
      soldAt: '2026-03-15',
      paymentMethod: 'pix',
      receivedAt: '2026-05-10',
      netAmount: 50,
      items: [{ variationId: 1, qty: 1, unitPrice: 50, unitCost: 5 }]
    })

    const cashFlow = queryAll<{ month: string; income: number }>(
      db,
      `SELECT
         strftime('%Y-%m', COALESCE(received_at, sold_at)) AS month,
         net_amount AS income
       FROM sales
       WHERE payment_method != 'areceber'
       ORDER BY month ASC`,
      []
    )
    expect(cashFlow).toHaveLength(1)
    expect(cashFlow[0]!.month).toBe('2026-05')
    expect(cashFlow[0]!.income).toBe(50)
  })

  it('venda à vista mantém mês do sold_at no cashFlow', () => {
    insertSale({
      soldAt: '2026-04-20',
      paymentMethod: 'dinheiro',
      items: [{ variationId: 1, qty: 1, unitPrice: 40, unitCost: 5 }]
    })

    const cashFlow = queryAll<{ month: string; income: number }>(
      db,
      `SELECT
         strftime('%Y-%m', COALESCE(received_at, sold_at)) AS month,
         net_amount AS income
       FROM sales
       WHERE payment_method != 'areceber'
       ORDER BY month ASC`,
      []
    )
    expect(cashFlow).toHaveLength(1)
    expect(cashFlow[0]!.month).toBe('2026-04')
  })

  it('venda areceber pendente não aparece em nenhum mês do cashFlow', () => {
    insertSale({
      soldAt: '2026-05-01',
      paymentMethod: 'areceber',
      items: [{ variationId: 1, qty: 1, unitPrice: 30, unitCost: 5 }]
    })

    const cashFlow = queryAll<{ month: string; income: number }>(
      db,
      `SELECT
         strftime('%Y-%m', COALESCE(received_at, sold_at)) AS month,
         net_amount AS income
       FROM sales
       WHERE payment_method != 'areceber'`,
      []
    )
    expect(cashFlow).toHaveLength(0)
  })
})
