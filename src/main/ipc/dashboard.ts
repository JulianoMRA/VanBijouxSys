import { ipcMain } from 'electron'
import { getSqlite } from '../database'

export interface DashboardStats {
  overview: {
    totalRevenue: number
    totalCost: number
    totalProfit: number
    totalSales: number
    avgTicket: number
  }
  revenueByMonth: Array<{ month: string; revenue: number; profit: number }>
  salesByChannel: Array<{ channel: string; revenue: number; profit: number; count: number }>
  salesByFair: Array<{
    fairName: string
    date: string
    revenue: number
    profit: number
    enrollmentCost: number
    netProfit: number
  }>
  topVariations: Array<{
    productName: string
    identifier: string
    quantity: number
    revenue: number
  }>
  lowStock: Array<{
    id: number
    productName: string
    categoryName: string
    identifier: string
    stockQuantity: number
    minimumStock: number
  }>
}

export function registerDashboardHandlers(): void {
  ipcMain.handle('dashboard:getStats', async (_event, fromDate: string | null) => {
    const sqlite = getSqlite()

    const dateFilter = fromDate ? `AND s.sold_at >= '${fromDate}'` : ''

    const overview = sqlite
      .prepare(
        `SELECT
          COALESCE(SUM(s.total_amount), 0)                    AS totalRevenue,
          COALESCE(SUM(s.total_cost),   0)                    AS totalCost,
          COALESCE(SUM(s.total_amount - s.total_cost), 0)     AS totalProfit,
          COUNT(s.id)                                          AS totalSales,
          COALESCE(AVG(s.total_amount), 0)                    AS avgTicket
         FROM sales s
         WHERE 1=1 ${dateFilter}`
      )
      .get() as DashboardStats['overview']

    const revenueByMonth = sqlite
      .prepare(
        `SELECT
          strftime('%Y-%m', s.sold_at)                        AS month,
          COALESCE(SUM(s.total_amount), 0)                    AS revenue,
          COALESCE(SUM(s.total_amount - s.total_cost), 0)     AS profit
         FROM sales s
         WHERE 1=1 ${dateFilter}
         GROUP BY month
         ORDER BY month ASC`
      )
      .all() as DashboardStats['revenueByMonth']

    const salesByChannel = sqlite
      .prepare(
        `SELECT
          s.channel,
          COALESCE(SUM(s.total_amount), 0)                    AS revenue,
          COALESCE(SUM(s.total_amount - s.total_cost), 0)     AS profit,
          COUNT(s.id)                                          AS count
         FROM sales s
         WHERE 1=1 ${dateFilter}
         GROUP BY s.channel
         ORDER BY revenue DESC`
      )
      .all() as DashboardStats['salesByChannel']

    const salesByFair = sqlite
      .prepare(
        `SELECT
          f.name                                               AS fairName,
          f.date,
          f.enrollment_cost                                    AS enrollmentCost,
          COALESCE(SUM(s.total_amount), 0)                    AS revenue,
          COALESCE(SUM(s.total_amount - s.total_cost), 0)     AS profit,
          COALESCE(SUM(s.total_amount - s.total_cost), 0) - f.enrollment_cost AS netProfit
         FROM fairs f
         LEFT JOIN sales s ON s.fair_id = f.id ${dateFilter ? `AND s.sold_at >= '${fromDate}'` : ''}
         GROUP BY f.id
         ORDER BY f.date DESC`
      )
      .all() as DashboardStats['salesByFair']

    const topVariations = sqlite
      .prepare(
        `SELECT
          p.name                                               AS productName,
          pv.identifier,
          COALESCE(SUM(si.quantity), 0)                       AS quantity,
          COALESCE(SUM(si.quantity * si.unit_price), 0)       AS revenue
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         JOIN product_variations pv ON pv.id = si.variation_id
         JOIN products p ON p.id = pv.product_id
         WHERE 1=1 ${dateFilter}
         GROUP BY si.variation_id
         ORDER BY quantity DESC
         LIMIT 8`
      )
      .all() as DashboardStats['topVariations']

    const lowStock = sqlite
      .prepare(
        `SELECT
          pv.id,
          p.name                                               AS productName,
          c.name                                               AS categoryName,
          pv.identifier,
          pv.stock_quantity                                    AS stockQuantity,
          pv.minimum_stock                                     AS minimumStock
         FROM product_variations pv
         JOIN products p ON p.id = pv.product_id
         JOIN categories c ON c.id = p.category_id
         WHERE pv.stock_quantity < pv.minimum_stock
         ORDER BY (pv.stock_quantity - pv.minimum_stock) ASC`
      )
      .all() as DashboardStats['lowStock']

    return { overview, revenueByMonth, salesByChannel, salesByFair, topVariations, lowStock }
  })
}
