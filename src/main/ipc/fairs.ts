import { ipcMain } from 'electron'
import { eq } from 'drizzle-orm'
import { getDb } from '../database'
import { fairs } from '../database/schema'

export interface CreateFairInput {
  name: string
  location: string
  organizer?: string
  date: string
  enrollmentCost: number
}

export interface UpdateFairInput extends CreateFairInput {
  id: number
}

export function registerFairHandlers(): void {
  ipcMain.handle('fairs:getAll', async () => {
    const db = getDb()
    return db.select().from(fairs).orderBy(fairs.date).all()
  })

  ipcMain.handle('fairs:create', async (_event, data: CreateFairInput) => {
    const db = getDb()
    const result = db
      .insert(fairs)
      .values({
        name: data.name,
        location: data.location,
        organizer: data.organizer ?? null,
        date: data.date,
        enrollmentCost: data.enrollmentCost
      })
      .run()
    return { id: result.lastInsertRowid }
  })

  ipcMain.handle('fairs:update', async (_event, data: UpdateFairInput) => {
    const db = getDb()
    db.update(fairs)
      .set({
        name: data.name,
        location: data.location,
        organizer: data.organizer ?? null,
        date: data.date,
        enrollmentCost: data.enrollmentCost
      })
      .where(eq(fairs.id, data.id))
      .run()
    return { success: true }
  })

  ipcMain.handle('fairs:delete', async (_event, id: number) => {
    const db = getDb()
    db.delete(fairs).where(eq(fairs.id, id)).run()
    return { success: true }
  })
}
