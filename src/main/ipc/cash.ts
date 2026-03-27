import { ipcMain } from 'electron'
import { eq } from 'drizzle-orm'
import { getDb, getSqlite } from '../database'
import { expenseCategories, cashExpenses, cashSettings } from '../database/schema'
import type {
  CreateExpenseCategoryInput,
  UpdateExpenseCategoryInput,
  CreateCashExpenseInput,
  UpdateCashExpenseInput
} from '../../renderer/src/types'

export function registerCashHandlers(): void {
  // ── Categorias de despesa ────────────────────────────────────────────────

  ipcMain.handle('expense-categories:getAll', async () => {
    const db = getDb()
    return db.select().from(expenseCategories).orderBy(expenseCategories.name).all()
  })

  ipcMain.handle('expense-categories:create', async (_event, data: CreateExpenseCategoryInput) => {
    const db = getDb()
    const result = db.insert(expenseCategories).values({ name: data.name }).run()
    return { id: result.lastInsertRowid }
  })

  ipcMain.handle('expense-categories:update', async (_event, data: UpdateExpenseCategoryInput) => {
    const db = getDb()
    db.update(expenseCategories).set({ name: data.name }).where(eq(expenseCategories.id, data.id)).run()
    return { success: true }
  })

  ipcMain.handle('expense-categories:delete', async (_event, id: number) => {
    const sqlite = getSqlite()
    const linked = sqlite
      .prepare('SELECT COUNT(*) as count FROM cash_expenses WHERE category_id = ?')
      .get(id) as { count: number }
    if (linked.count > 0) {
      throw new Error('Categoria possui despesas vinculadas. Remova as despesas antes de excluir.')
    }
    const db = getDb()
    db.delete(expenseCategories).where(eq(expenseCategories.id, id)).run()
    return { success: true }
  })

  // ── Despesas ─────────────────────────────────────────────────────────────

  ipcMain.handle('cash-expenses:getAll', async (_event, filters?: { startDate?: string; endDate?: string; categoryId?: number }) => {
    const sqlite = getSqlite()

    let query = `
      SELECT
        e.id,
        e.category_id as categoryId,
        c.name as categoryName,
        e.description,
        e.amount,
        e.expense_date as expenseDate,
        e.notes,
        e.created_at as createdAt
      FROM cash_expenses e
      INNER JOIN expense_categories c ON e.category_id = c.id
      WHERE 1=1
    `
    const params: (string | number)[] = []

    if (filters?.startDate) {
      query += ' AND e.expense_date >= ?'
      params.push(filters.startDate)
    }
    if (filters?.endDate) {
      query += ' AND e.expense_date <= ?'
      params.push(filters.endDate)
    }
    if (filters?.categoryId) {
      query += ' AND e.category_id = ?'
      params.push(filters.categoryId)
    }

    query += ' ORDER BY e.expense_date DESC, e.created_at DESC'

    return sqlite.prepare(query).all(...params)
  })

  ipcMain.handle('cash-expenses:create', async (_event, data: CreateCashExpenseInput) => {
    const db = getDb()
    const result = db
      .insert(cashExpenses)
      .values({
        categoryId: data.categoryId,
        description: data.description,
        amount: data.amount,
        expenseDate: data.expenseDate,
        notes: data.notes ?? null
      })
      .run()
    return { id: result.lastInsertRowid }
  })

  ipcMain.handle('cash-expenses:update', async (_event, data: UpdateCashExpenseInput) => {
    const db = getDb()
    db
      .update(cashExpenses)
      .set({
        categoryId: data.categoryId,
        description: data.description,
        amount: data.amount,
        expenseDate: data.expenseDate,
        notes: data.notes ?? null
      })
      .where(eq(cashExpenses.id, data.id))
      .run()
    return { success: true }
  })

  ipcMain.handle('cash-expenses:delete', async (_event, id: number) => {
    const db = getDb()
    db.delete(cashExpenses).where(eq(cashExpenses.id, id)).run()
    return { success: true }
  })

  ipcMain.handle('cash-expenses:getStats', async (_event, filters?: { startDate?: string; endDate?: string }) => {
    const sqlite = getSqlite()

    let expenseQuery = 'SELECT COALESCE(SUM(amount), 0) as total FROM cash_expenses WHERE 1=1'
    const params: string[] = []

    if (filters?.startDate) {
      expenseQuery += ' AND expense_date >= ?'
      params.push(filters.startDate)
    }
    if (filters?.endDate) {
      expenseQuery += ' AND expense_date <= ?'
      params.push(filters.endDate)
    }

    const expenseResult = sqlite.prepare(expenseQuery).get(...params) as { total: number }

    let incomeQuery = 'SELECT COALESCE(SUM(net_amount), 0) as total FROM sales WHERE 1=1'
    const incomeParams: string[] = []

    if (filters?.startDate) {
      incomeQuery += ' AND sold_at >= ?'
      incomeParams.push(filters.startDate)
    }
    if (filters?.endDate) {
      incomeQuery += ' AND sold_at <= ?'
      incomeParams.push(filters.endDate)
    }

    const incomeResult = sqlite.prepare(incomeQuery).get(...incomeParams) as { total: number }

    const settings = sqlite.prepare('SELECT opening_balance FROM cash_settings WHERE id = 1').get() as { opening_balance: number }

    return {
      totalExpenses: expenseResult.total,
      totalIncome: incomeResult.total,
      openingBalance: settings?.opening_balance ?? 0
    }
  })

  // ── Configurações do caixa ───────────────────────────────────────────────

  ipcMain.handle('cash-settings:get', async () => {
    const db = getDb()
    return db.select().from(cashSettings).where(eq(cashSettings.id, 1)).get()
  })

  ipcMain.handle('cash-settings:setOpeningBalance', async (_event, balance: number) => {
    const sqlite = getSqlite()
    const now = new Date().toISOString()
    sqlite
      .prepare('UPDATE cash_settings SET opening_balance = ?, updated_at = ? WHERE id = 1')
      .run(balance, now)
    return { success: true }
  })
}
