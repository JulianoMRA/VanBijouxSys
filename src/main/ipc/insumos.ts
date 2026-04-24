import { ipcMain, dialog } from 'electron'
import { writeFileSync } from 'fs'
import { eq, sql } from 'drizzle-orm'
import { getDb } from '../database'
import { insumos } from '../database/schema'
import type { CreateInsumoInput, UpdateInsumoInput } from '../../renderer/src/types'

export function registerInsumoHandlers(): void {
  ipcMain.handle('insumos:getAll', async () => {
    try {
      const db = getDb()
      return db.select().from(insumos).orderBy(insumos.name).all()
    } catch (err) {
      console.error('[insumos:getAll]', err)
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('insumos:create', async (_event, data: CreateInsumoInput) => {
    try {
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
    } catch (err) {
      console.error('[insumos:create]', err)
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('insumos:update', async (_event, data: UpdateInsumoInput) => {
    try {
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
    } catch (err) {
      console.error('[insumos:update]', err)
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('insumos:addStock', async (_event, id: number, quantity: number) => {
    try {
      const db = getDb()
      const result = db
        .update(insumos)
        .set({ stockQuantity: sql`stock_quantity + ${quantity}` })
        .where(eq(insumos.id, id))
        .run()
      return { success: result.changes > 0 }
    } catch (err) {
      console.error('[insumos:addStock]', err)
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('insumos:delete', async (_event, id: number) => {
    try {
      const db = getDb()
      db.delete(insumos).where(eq(insumos.id, id)).run()
      return { success: true }
    } catch {
      return { success: false, error: 'insumo_in_use' }
    }
  })

  ipcMain.handle('insumos:exportCsv', async (_event, csvContent: string, defaultFileName: string) => {
    try {
      const result = await dialog.showSaveDialog({
        defaultPath: defaultFileName,
        filters: [{ name: 'CSV (Excel)', extensions: ['csv'] }]
      })
      if (result.canceled || !result.filePath) return { success: false, canceled: true }
      writeFileSync(result.filePath, '﻿' + csvContent, 'utf8')
      return { success: true }
    } catch (err) {
      console.error('[insumos:exportCsv]', err)
      return { success: false, error: String(err) }
    }
  })
}
