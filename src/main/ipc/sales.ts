import { ipcMain } from 'electron'
import { eq } from 'drizzle-orm'
import { getDb, getSqlite } from '../database'
import { sales, saleItems, productVariations, fairs } from '../database/schema'
import type { CreateSaleInput } from '../../renderer/src/types'

export function registerSaleHandlers(): void {
  ipcMain.handle('sales:getAll', async () => {
    const db = getDb()

    const allSales = db
      .select({
        id: sales.id,
        channel: sales.channel,
        fairId: sales.fairId,
        fairName: fairs.name,
        totalAmount: sales.totalAmount,
        totalCost: sales.totalCost,
        soldAt: sales.soldAt
      })
      .from(sales)
      .leftJoin(fairs, eq(sales.fairId, fairs.id))
      .orderBy(sales.soldAt)
      .all()
      .reverse()

    return allSales.map((sale) => {
      const items = db
        .select({
          id: saleItems.id,
          variationId: saleItems.variationId,
          variationIdentifier: productVariations.identifier,
          quantity: saleItems.quantity,
          unitPrice: saleItems.unitPrice,
          unitCost: saleItems.unitCost
        })
        .from(saleItems)
        .innerJoin(productVariations, eq(saleItems.variationId, productVariations.id))
        .where(eq(saleItems.saleId, sale.id))
        .all()

      return { ...sale, items }
    })
  })

  ipcMain.handle('sales:create', async (_event, data: CreateSaleInput) => {
    const sqlite = getSqlite()

    const totalAmount = data.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
    const totalCost = data.items.reduce((s, i) => s + i.quantity * i.unitCost, 0)

    const createSale = sqlite.transaction(() => {
      const saleResult = sqlite
        .prepare(
          `INSERT INTO sales (channel, fair_id, total_amount, total_cost, sold_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(
          data.channel,
          data.fairId ?? null,
          totalAmount,
          totalCost,
          data.soldAt
        )

      const saleId = saleResult.lastInsertRowid

      for (const item of data.items) {
        sqlite
          .prepare(
            `INSERT INTO sale_items (sale_id, variation_id, quantity, unit_price, unit_cost)
             VALUES (?, ?, ?, ?, ?)`
          )
          .run(saleId, item.variationId, item.quantity, item.unitPrice, item.unitCost)

        sqlite
          .prepare(
            `UPDATE product_variations
             SET stock_quantity = stock_quantity - ?
             WHERE id = ?`
          )
          .run(item.quantity, item.variationId)
      }

      return { id: saleId }
    })

    return createSale()
  })

  ipcMain.handle('sales:delete', async (_event, id: number) => {
    const sqlite = getSqlite()

    const deleteSale = sqlite.transaction(() => {
      const items = sqlite
        .prepare(`SELECT variation_id, quantity FROM sale_items WHERE sale_id = ?`)
        .all(id) as { variation_id: number; quantity: number }[]

      for (const item of items) {
        sqlite
          .prepare(
            `UPDATE product_variations
             SET stock_quantity = stock_quantity + ?
             WHERE id = ?`
          )
          .run(item.quantity, item.variation_id)
      }

      sqlite.prepare(`DELETE FROM sales WHERE id = ?`).run(id)
    })

    deleteSale()
    return { success: true }
  })
}
