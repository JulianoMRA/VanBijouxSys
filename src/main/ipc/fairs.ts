import { eq } from 'drizzle-orm'
import { getDb, getSqlite } from '../database'
import { fairs, fairAdditionalCosts } from '../database/schema'
import { handleIpc } from './handle'

export interface CreateFairInput {
  name: string
  location: string
  organizer?: string
  date: string
  endDate?: string
  enrollmentCost: number
  additionalCosts: { description: string; amount: number }[]
}

export interface UpdateFairInput extends CreateFairInput {
  id: number
}

export function registerFairHandlers(): void {
  handleIpc('fairs:getAll', () => {
    const db = getDb()
    const fairsList = db.select().from(fairs).orderBy(fairs.date).all()
    return fairsList.map((fair) => {
      const costs = db
        .select()
        .from(fairAdditionalCosts)
        .where(eq(fairAdditionalCosts.fairId, fair.id))
        .all()
      return { ...fair, additionalCosts: costs }
    })
  })

  handleIpc('fairs:create', (data: CreateFairInput) => {
    const sqlite = getSqlite()
    const db = getDb()

    const criar = sqlite.transaction(() => {
      const result = db
        .insert(fairs)
        .values({
          name: data.name,
          location: data.location,
          organizer: data.organizer ?? null,
          date: data.date,
          endDate: data.endDate ?? null,
          enrollmentCost: data.enrollmentCost
        })
        .run()
      const fairId = Number(result.lastInsertRowid)

      for (const cost of data.additionalCosts ?? []) {
        db.insert(fairAdditionalCosts)
          .values({ fairId, description: cost.description, amount: cost.amount })
          .run()
      }

      return { id: fairId }
    })

    return criar()
  })

  handleIpc('fairs:update', (data: UpdateFairInput) => {
    const sqlite = getSqlite()
    const db = getDb()

    const atualizar = sqlite.transaction(() => {
      db.update(fairs)
        .set({
          name: data.name,
          location: data.location,
          organizer: data.organizer ?? null,
          date: data.date,
          endDate: data.endDate ?? null,
          enrollmentCost: data.enrollmentCost
        })
        .where(eq(fairs.id, data.id))
        .run()

      db.delete(fairAdditionalCosts).where(eq(fairAdditionalCosts.fairId, data.id)).run()
      for (const cost of data.additionalCosts ?? []) {
        db.insert(fairAdditionalCosts)
          .values({ fairId: data.id, description: cost.description, amount: cost.amount })
          .run()
      }
    })

    atualizar()
    return { success: true }
  })

  handleIpc('fairs:delete', (id: number) => {
    const db = getDb()
    db.delete(fairs).where(eq(fairs.id, id)).run()
    return { success: true }
  })
}
