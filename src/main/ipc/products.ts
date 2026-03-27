import { ipcMain } from 'electron'
import { eq } from 'drizzle-orm'
import { getDb } from '../database'
import { products, productVariations, categories, variationInsumos, insumos } from '../database/schema'
import { sql } from 'drizzle-orm'
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
      const variationsWithInsumos = variations.map((v) => {
        const recipe = db
          .select({
            id: variationInsumos.id,
            variationId: variationInsumos.variationId,
            insumoId: variationInsumos.insumoId,
            insumoName: insumos.name,
            unit: insumos.unit,
            costPerUnit: insumos.costPerUnit,
            quantity: variationInsumos.quantity
          })
          .from(variationInsumos)
          .innerJoin(insumos, eq(variationInsumos.insumoId, insumos.id))
          .where(eq(variationInsumos.variationId, v.id))
          .all()
        return { ...v, insumos: recipe }
      })
      return { ...product, variations: variationsWithInsumos }
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
        minimumStock: data.minimumStock,
        laborCost: data.laborCost
      })
      .run()
    const variationId = Number(result.lastInsertRowid)
    for (const item of data.insumos ?? []) {
      db.insert(variationInsumos).values({ variationId, insumoId: item.insumoId, quantity: item.quantity }).run()
    }
    if (data.stockQuantity > 0 && (data.insumos ?? []).length > 0) {
      for (const item of data.insumos!) {
        db.update(insumos)
          .set({ stockQuantity: sql`MAX(0, stock_quantity - ${item.quantity * data.stockQuantity})` })
          .where(eq(insumos.id, item.insumoId))
          .run()
      }
    }
    return { id: variationId }
  })

  ipcMain.handle('variations:update', async (_event, data: UpdateVariationInput) => {
    const db = getDb()
    db.update(productVariations)
      .set({
        identifier: data.identifier,
        costPrice: data.costPrice,
        salePrice: data.salePrice,
        stockQuantity: data.stockQuantity,
        minimumStock: data.minimumStock,
        laborCost: data.laborCost
      })
      .where(eq(productVariations.id, data.id))
      .run()
    db.delete(variationInsumos).where(eq(variationInsumos.variationId, data.id)).run()
    for (const item of data.insumos ?? []) {
      db.insert(variationInsumos).values({ variationId: data.id, insumoId: item.insumoId, quantity: item.quantity }).run()
    }
    return { success: true }
  })

  ipcMain.handle('variations:delete', async (_event, id: number) => {
    const db = getDb()
    db.delete(productVariations).where(eq(productVariations.id, id)).run()
    return { success: true }
  })

  ipcMain.handle('variations:addStock', async (_event, id: number, quantity: number) => {
    const db = getDb()
    const variation = db.select().from(productVariations).where(eq(productVariations.id, id)).get()
    if (!variation) return { success: false }

    db.update(productVariations)
      .set({ stockQuantity: variation.stockQuantity + quantity })
      .where(eq(productVariations.id, id))
      .run()

    const recipe = db.select().from(variationInsumos).where(eq(variationInsumos.variationId, id)).all()
    for (const item of recipe) {
      db.update(insumos)
        .set({ stockQuantity: sql`MAX(0, stock_quantity - ${item.quantity * quantity})` })
        .where(eq(insumos.id, item.insumoId))
        .run()
    }

    return { success: true }
  })
}
