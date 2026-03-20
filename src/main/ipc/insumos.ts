import { ipcMain } from 'electron'
import { eq } from 'drizzle-orm'
import { getDb } from '../database'
import { insumos } from '../database/schema'
import type { CreateInsumoInput, UpdateInsumoInput } from '../../renderer/src/types'

export function registerInsumoHandlers(): void {
  ipcMain.handle('insumos:getAll', async () => {
    const db = getDb()
    return db.select().from(insumos).orderBy(insumos.name).all()
  })

  ipcMain.handle('insumos:create', async (_event, data: CreateInsumoInput) => {
    const db = getDb()
    const result = db
      .insert(insumos)
      .values({
        name: data.name,
        unit: data.unit,
        costPerUnit: data.costPerUnit,
        stockQuantity: data.stockQuantity,
        minimumStock: data.minimumStock
      })
      .run()
    return { id: Number(result.lastInsertRowid) }
  })

  ipcMain.handle('insumos:update', async (_event, data: UpdateInsumoInput) => {
    const db = getDb()
    db.update(insumos)
      .set({
        name: data.name,
        unit: data.unit,
        costPerUnit: data.costPerUnit,
        stockQuantity: data.stockQuantity,
        minimumStock: data.minimumStock
      })
      .where(eq(insumos.id, data.id))
      .run()
    return { success: true }
  })

  ipcMain.handle('insumos:addStock', async (_event, id: number, quantity: number) => {
    const db = getDb()
    const insumo = db.select().from(insumos).where(eq(insumos.id, id)).get()
    if (!insumo) return { success: false }
    db.update(insumos)
      .set({ stockQuantity: insumo.stockQuantity + quantity })
      .where(eq(insumos.id, id))
      .run()
    return { success: true }
  })

  ipcMain.handle('insumos:delete', async (_event, id: number) => {
    const db = getDb()
    try {
      db.delete(insumos).where(eq(insumos.id, id)).run()
      return { success: true }
    } catch {
      return { success: false, error: 'insumo_in_use' }
    }
  })
}
