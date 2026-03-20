import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique()
})

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  categoryId: integer('category_id')
    .notNull()
    .references(() => categories.id),
  description: text('description'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP')
})

export const productVariations = sqliteTable('product_variations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  identifier: text('identifier').notNull(),
  costPrice: real('cost_price').notNull().default(0),
  salePrice: real('sale_price').notNull().default(0),
  stockQuantity: integer('stock_quantity').notNull().default(0),
  minimumStock: integer('minimum_stock').notNull().default(1),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP')
})

export const fairs = sqliteTable('fairs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  location: text('location').notNull(),
  organizer: text('organizer'),
  date: text('date').notNull(),
  endDate: text('end_date'),
  enrollmentCost: real('enrollment_cost').notNull().default(0),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP')
})

export const fairAdditionalCosts = sqliteTable('fair_additional_costs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fairId: integer('fair_id')
    .notNull()
    .references(() => fairs.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  amount: real('amount').notNull().default(0)
})

export const insumos = sqliteTable('insumos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  unit: text('unit').notNull(),
  costPerUnit: real('cost_per_unit').notNull().default(0),
  stockQuantity: real('stock_quantity').notNull().default(0),
  minimumStock: real('minimum_stock').notNull().default(0),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP')
})

export const variationInsumos = sqliteTable('variation_insumos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  variationId: integer('variation_id')
    .notNull()
    .references(() => productVariations.id, { onDelete: 'cascade' }),
  insumoId: integer('insumo_id')
    .notNull()
    .references(() => insumos.id),
  quantity: real('quantity').notNull().default(0)
})

export const sales = sqliteTable('sales', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  channel: text('channel').notNull(),
  fairId: integer('fair_id').references(() => fairs.id),
  totalAmount: real('total_amount').notNull(),
  totalCost: real('total_cost').notNull(),
  soldAt: text('sold_at').notNull().default('CURRENT_TIMESTAMP')
})

export const saleItems = sqliteTable('sale_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  saleId: integer('sale_id')
    .notNull()
    .references(() => sales.id, { onDelete: 'cascade' }),
  variationId: integer('variation_id')
    .notNull()
    .references(() => productVariations.id),
  quantity: integer('quantity').notNull(),
  unitPrice: real('unit_price').notNull(),
  unitCost: real('unit_cost').notNull()
})
