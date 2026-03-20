import { ipcMain } from 'electron'
import { eq } from 'drizzle-orm'
import { getDb } from '../database'
import { products, productVariations, categories } from '../database/schema'
import type {
  CreateProductInput,
  UpdateProductInput,
  CreateVariationInput,
  UpdateVariationInput
} from '../../renderer/src/types'

export function registerProductHandlers(): void {
  ipcMain.handle('categories:getAll', async () => {
    const db = getDb()
    return db.select().from(categories).orderBy(categories.name).all()
  })

  ipcMain.handle('products:getAll', async () => {
    const db = getDb()

    const rows = db
      .select({
        id: products.id,
        name: products.name,
        categoryId: products.categoryId,
        categoryName: categories.name,
        description: products.description,
        createdAt: products.createdAt
      })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .orderBy(products.name)
      .all()

    return rows.map((product) => {
      const variations = db
        .select()
        .from(productVariations)
        .where(eq(productVariations.productId, product.id))
        .all()
      return { ...product, variations }
    })
  })

  ipcMain.handle('products:create', async (_event, data: CreateProductInput) => {
    const db = getDb()
    const result = db
      .insert(products)
      .values({
        name: data.name,
        categoryId: data.categoryId,
        description: data.description ?? null
      })
      .run()
    return { id: result.lastInsertRowid }
  })

  ipcMain.handle('products:update', async (_event, data: UpdateProductInput) => {
    const db = getDb()
    db.update(products)
      .set({
        name: data.name,
        categoryId: data.categoryId,
        description: data.description ?? null
      })
      .where(eq(products.id, data.id))
      .run()
    return { success: true }
  })

  ipcMain.handle('products:delete', async (_event, id: number) => {
    const db = getDb()
    db.delete(products).where(eq(products.id, id)).run()
    return { success: true }
  })

  ipcMain.handle('variations:create', async (_event, data: CreateVariationInput) => {
    const db = getDb()
    const result = db
      .insert(productVariations)
      .values({
        productId: data.productId,
        identifier: data.identifier,
        costPrice: data.costPrice,
        salePrice: data.salePrice,
        stockQuantity: data.stockQuantity,
        minimumStock: data.minimumStock
      })
      .run()
    return { id: result.lastInsertRowid }
  })

  ipcMain.handle('variations:update', async (_event, data: UpdateVariationInput) => {
    const db = getDb()
    db.update(productVariations)
      .set({
        identifier: data.identifier,
        costPrice: data.costPrice,
        salePrice: data.salePrice,
        stockQuantity: data.stockQuantity,
        minimumStock: data.minimumStock
      })
      .where(eq(productVariations.id, data.id))
      .run()
    return { success: true }
  })

  ipcMain.handle('variations:delete', async (_event, id: number) => {
    const db = getDb()
    db.delete(productVariations).where(eq(productVariations.id, id)).run()
    return { success: true }
  })

  ipcMain.handle('variations:addStock', async (_event, id: number, quantity: number) => {
    const db = getDb()
    const variation = db
      .select()
      .from(productVariations)
      .where(eq(productVariations.id, id))
      .get()
    if (!variation) return { success: false }
    db.update(productVariations)
      .set({ stockQuantity: variation.stockQuantity + quantity })
      .where(eq(productVariations.id, id))
      .run()
    return { success: true }
  })
}
