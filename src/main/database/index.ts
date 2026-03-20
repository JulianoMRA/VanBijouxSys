import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import * as schema from './schema'

let db: ReturnType<typeof drizzle>
let sqliteInstance: InstanceType<typeof Database>

export function initDatabase(): void {
  const dbPath = join(app.getPath('userData'), 'vanbijouxsys.db')
  const sqlite = new Database(dbPath)
  sqliteInstance = sqlite

  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  db = drizzle(sqlite, { schema })

  runMigrations(sqlite)
}

function runMigrations(sqlite: InstanceType<typeof Database>): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      description TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS product_variations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      identifier TEXT NOT NULL,
      cost_price REAL NOT NULL DEFAULT 0,
      sale_price REAL NOT NULL DEFAULT 0,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      minimum_stock INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fairs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      organizer TEXT,
      date TEXT NOT NULL,
      enrollment_cost REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel TEXT NOT NULL,
      fair_id INTEGER REFERENCES fairs(id),
      total_amount REAL NOT NULL,
      total_cost REAL NOT NULL,
      sold_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      variation_id INTEGER NOT NULL REFERENCES product_variations(id),
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      unit_cost REAL NOT NULL
    );

    INSERT OR IGNORE INTO categories (name) VALUES
      ('Colar'),
      ('Pulseira'),
      ('Brinco'),
      ('Tiara'),
      ('Pingente');

    CREATE TABLE IF NOT EXISTS insumos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      cost_per_unit REAL NOT NULL DEFAULT 0,
      stock_quantity REAL NOT NULL DEFAULT 0,
      minimum_stock REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS variation_insumos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      variation_id INTEGER NOT NULL REFERENCES product_variations(id) ON DELETE CASCADE,
      insumo_id INTEGER NOT NULL REFERENCES insumos(id),
      quantity REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS fair_additional_costs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fair_id INTEGER NOT NULL REFERENCES fairs(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0
    );
  `)

  const fairColumns = sqlite.prepare('PRAGMA table_info(fairs)').all() as Array<{ name: string }>
  if (!fairColumns.some((c) => c.name === 'end_date')) {
    sqlite.exec('ALTER TABLE fairs ADD COLUMN end_date TEXT')
  }
}

export function getDb(): ReturnType<typeof drizzle> {
  return db
}

export function getSqlite(): InstanceType<typeof Database> {
  return sqliteInstance
}
