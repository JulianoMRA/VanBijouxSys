import { ipcMain } from 'electron'
import { getSqlite } from '../database'

export interface DashboardStats {
  overview: {
    totalRevenue: number
    totalNetRevenue: number
    totalCost: number
    totalProfit: number
    totalSales: number
    avgTicket: number
  }
  previousOverview: {
    totalRevenue: number
    totalNetRevenue: number
    totalCost: number
    totalProfit: number
    totalSales: number
    avgTicket: number
  } | null
  revenueByMonth: Array<{ month: string; revenue: number; profit: number }>
  salesByChannel: Array<{ channel: string; revenue: number; profit: number; count: number }>
  salesByCategory: Array<{ category: string; revenue: number; quantity: number; count: number }>
  salesByFair: Array<{
    fairName: string
    date: string
    endDate: string | null
    revenue: number
    profit: number
    enrollmentCost: number
    additionalCosts: number
    netProfit: number
    dailyBreakdown: Array<{ day: string; revenue: number; salesCount: number }>
  }>
  topVariations: Array<{
    productName: string
    identifier: string
    quantity: number
    revenue: number
  }>
  outOfStock: Array<{
    id: number
    productName: string
    categoryName: string
    identifier: string
    stockQuantity: number
    minimumStock: number
  }>
  lowStock: Array<{
    id: number
    productName: string
    categoryName: string
    identifier: string
    stockQuantity: number
    minimumStock: number
  }>
  outOfInsumos: Array<{
    id: number
    name: string
    unit: string
    stockQuantity: number
    minimumStock: number
  }>
  lowInsumos: Array<{
    id: number
    name: string
    unit: string
    stockQuantity: number
    minimumStock: number
  }>
  cashFlow: Array<{ month: string; income: number; expenses: number }>
  cashSummary: {
    openingBalance: number
    totalIncome: number
    totalExpenses: number
    currentBalance: number
  }
}

type Period = 'month' | 'quarter' | 'halfyear' | 'year' | 'all'

function computePeriodDates(period: Period): {
  fromDate: string | null
  prevFromDate: string | null
  prevToDate: string | null
} {
  const now = new Date()

  if (period === 'all') {
    return { fromDate: null, prevFromDate: null, prevToDate: null }
  }

  if (period === 'month') {
    const fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    const prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevTo = new Date(now.getFullYear(), now.getMonth(), 0)
    return {
      fromDate,
      prevFromDate: prevFrom.toISOString().slice(0, 10),
      prevToDate: prevTo.toISOString().slice(0, 10)
    }
  }

  if (period === 'quarter') {
    const from = new Date(now)
    from.setMonth(from.getMonth() - 3)
    const prevFrom = new Date(now)
    prevFrom.setMonth(prevFrom.getMonth() - 6)
    const prevTo = new Date(from)
    prevTo.setDate(prevTo.getDate() - 1)
    return {
      fromDate: from.toISOString().slice(0, 10),
      prevFromDate: prevFrom.toISOString().slice(0, 10),
      prevToDate: prevTo.toISOString().slice(0, 10)
    }
  }

  if (period === 'halfyear') {
    const from = new Date(now)
    from.setMonth(from.getMonth() - 6)
    const prevFrom = new Date(now)
    prevFrom.setMonth(prevFrom.getMonth() - 12)
    const prevTo = new Date(from)
    prevTo.setDate(prevTo.getDate() - 1)
    return {
      fromDate: from.toISOString().slice(0, 10),
      prevFromDate: prevFrom.toISOString().slice(0, 10),
      prevToDate: prevTo.toISOString().slice(0, 10)
    }
  }

  // year
  const fromDate = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10)
  const prevFromDate = new Date(now.getFullYear() - 1, 0, 1).toISOString().slice(0, 10)
  const prevToDate = new Date(now.getFullYear() - 1, 11, 31).toISOString().slice(0, 10)
  return { fromDate, prevFromDate, prevToDate }
}

export function registerDashboardHandlers(): void {
  ipcMain.handle('dashboard:getStats', async (_event, period: Period) => {
    const sqlite = getSqlite()
    const { fromDate, prevFromDate, prevToDate } = computePeriodDates(period)

    const dateFilter = fromDate ? `AND s.sold_at >= '${fromDate}'` : ''
    const prevDateFilter =
      prevFromDate && prevToDate
        ? `AND date(s.sold_at) >= '${prevFromDate}' AND date(s.sold_at) <= '${prevToDate}'`
        : null

    const overview = sqlite
      .prepare(
        `SELECT
          COALESCE(SUM(s.total_amount), 0)              AS totalRevenue,
          COALESCE(SUM(s.net_amount), 0)                AS totalNetRevenue,
          COALESCE(SUM(s.total_cost), 0)                AS totalCost,
          COALESCE(SUM(s.net_amount - s.total_cost), 0) AS totalProfit,
          COUNT(s.id)                                    AS totalSales,
          COALESCE(AVG(s.total_amount), 0)              AS avgTicket
         FROM sales s
         WHERE 1=1 ${dateFilter}`
      )
      .get() as DashboardStats['overview']

    let previousOverview: DashboardStats['previousOverview'] = null
    if (prevDateFilter) {
      previousOverview = sqlite
        .prepare(
          `SELECT
            COALESCE(SUM(s.total_amount), 0)              AS totalRevenue,
            COALESCE(SUM(s.net_amount), 0)                AS totalNetRevenue,
            COALESCE(SUM(s.total_cost), 0)                AS totalCost,
            COALESCE(SUM(s.net_amount - s.total_cost), 0) AS totalProfit,
            COUNT(s.id)                                    AS totalSales,
            COALESCE(AVG(s.total_amount), 0)              AS avgTicket
           FROM sales s
           WHERE 1=1 ${prevDateFilter}`
        )
        .get() as DashboardStats['overview']
    }

    const revenueByMonth = sqlite
      .prepare(
        `SELECT
          strftime('%Y-%m', s.sold_at)                  AS month,
          COALESCE(SUM(s.total_amount), 0)              AS revenue,
          COALESCE(SUM(s.net_amount - s.total_cost), 0) AS profit
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
          COALESCE(SUM(s.total_amount), 0)              AS revenue,
          COALESCE(SUM(s.net_amount - s.total_cost), 0) AS profit,
          COUNT(s.id)                                    AS count
         FROM sales s
         WHERE 1=1 ${dateFilter}
         GROUP BY s.channel
         ORDER BY revenue DESC`
      )
      .all() as DashboardStats['salesByChannel']

    const salesByCategory = sqlite
      .prepare(
        `SELECT
          c.name                                         AS category,
          COALESCE(SUM(si.quantity * si.unit_price), 0) AS revenue,
          COALESCE(SUM(si.quantity), 0)                  AS quantity,
          COUNT(DISTINCT s.id)                           AS count
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         JOIN product_variations pv ON pv.id = si.variation_id
         JOIN products p ON p.id = pv.product_id
         JOIN categories c ON c.id = p.category_id
         WHERE 1=1 ${dateFilter}
         GROUP BY c.id
         ORDER BY revenue DESC`
      )
      .all() as DashboardStats['salesByCategory']

    const fairDateFilter = fromDate ? `AND s.sold_at >= '${fromDate}'` : ''

    const salesByFairRaw = sqlite
      .prepare(
        `SELECT
          f.id                                           AS fairId,
          f.name                                         AS fairName,
          f.date,
          f.end_date                                     AS endDate,
          f.enrollment_cost                              AS enrollmentCost,
          COALESCE((SELECT SUM(fac.amount) FROM fair_additional_costs fac WHERE fac.fair_id = f.id), 0) AS additionalCosts,
          COALESCE(SUM(s.total_amount), 0)              AS revenue,
          COALESCE(SUM(s.total_amount - s.total_cost), 0) AS profit,
          COALESCE(SUM(s.total_amount - s.total_cost), 0)
            - f.enrollment_cost
            - COALESCE((SELECT SUM(fac.amount) FROM fair_additional_costs fac WHERE fac.fair_id = f.id), 0) AS netProfit
         FROM fairs f
         LEFT JOIN sales s ON s.fair_id = f.id ${fairDateFilter}
         GROUP BY f.id
         ORDER BY f.date DESC`
      )
      .all() as Array<{
        fairId: number
        fairName: string
        date: string
        endDate: string | null
        revenue: number
        profit: number
        enrollmentCost: number
        additionalCosts: number
        netProfit: number
      }>

    const fairDailyRaw = sqlite
      .prepare(
        `SELECT
          fair_id                          AS fairId,
          date(sold_at)                    AS day,
          COALESCE(SUM(total_amount), 0)   AS revenue,
          COUNT(id)                        AS salesCount
         FROM sales
         WHERE fair_id IS NOT NULL${fromDate ? ` AND sold_at >= '${fromDate}'` : ''}
         GROUP BY fair_id, day
         ORDER BY fair_id, day ASC`
      )
      .all() as Array<{ fairId: number; day: string; revenue: number; salesCount: number }>

    const salesByFair: DashboardStats['salesByFair'] = salesByFairRaw.map((fair) => ({
      fairName: fair.fairName,
      date: fair.date,
      endDate: fair.endDate,
      revenue: fair.revenue,
      profit: fair.profit,
      enrollmentCost: fair.enrollmentCost,
      additionalCosts: fair.additionalCosts,
      netProfit: fair.netProfit,
      dailyBreakdown: fairDailyRaw
        .filter((d) => d.fairId === fair.fairId)
        .map((d) => ({ day: d.day, revenue: d.revenue, salesCount: d.salesCount }))
    }))

    const topVariations = sqlite
      .prepare(
        `SELECT
          p.name                                         AS productName,
          pv.identifier,
          COALESCE(SUM(si.quantity), 0)                  AS quantity,
          COALESCE(SUM(si.quantity * si.unit_price), 0)  AS revenue
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

    const outOfStock = sqlite
      .prepare(
        `SELECT
          pv.id,
          p.name    AS productName,
          c.name    AS categoryName,
          pv.identifier,
          pv.stock_quantity  AS stockQuantity,
          pv.minimum_stock   AS minimumStock
         FROM product_variations pv
         JOIN products p ON p.id = pv.product_id
         JOIN categories c ON c.id = p.category_id
         WHERE pv.stock_quantity = 0
         ORDER BY p.name, pv.identifier`
      )
      .all() as DashboardStats['outOfStock']

    const lowStock = sqlite
      .prepare(
        `SELECT
          pv.id,
          p.name    AS productName,
          c.name    AS categoryName,
          pv.identifier,
          pv.stock_quantity  AS stockQuantity,
          pv.minimum_stock   AS minimumStock
         FROM product_variations pv
         JOIN products p ON p.id = pv.product_id
         JOIN categories c ON c.id = p.category_id
         WHERE pv.stock_quantity > 0 AND pv.stock_quantity < pv.minimum_stock
         ORDER BY (pv.stock_quantity - pv.minimum_stock) ASC`
      )
      .all() as DashboardStats['lowStock']

    const outOfInsumos = sqlite
      .prepare(
        `SELECT id, name, unit,
          stock_quantity AS stockQuantity,
          minimum_stock  AS minimumStock
         FROM insumos
         WHERE minimum_stock > 0 AND stock_quantity = 0
         ORDER BY name`
      )
      .all() as DashboardStats['outOfInsumos']

    const lowInsumos = sqlite
      .prepare(
        `SELECT id, name, unit,
          stock_quantity AS stockQuantity,
          minimum_stock  AS minimumStock
         FROM insumos
         WHERE minimum_stock > 0 AND stock_quantity > 0 AND stock_quantity < minimum_stock
         ORDER BY (stock_quantity - minimum_stock) ASC`
      )
      .all() as DashboardStats['lowInsumos']

    const salesDateFilter = fromDate ? `AND sold_at >= '${fromDate}'` : ''
    const expenseDateFilter = fromDate ? `AND expense_date >= '${fromDate}'` : ''

    const cashFlow = sqlite
      .prepare(
        `SELECT
          month,
          COALESCE(SUM(income), 0)   AS income,
          COALESCE(SUM(expenses), 0) AS expenses
         FROM (
           SELECT strftime('%Y-%m', sold_at) AS month, net_amount AS income, 0 AS expenses
           FROM sales WHERE 1=1 ${salesDateFilter}
           UNION ALL
           SELECT strftime('%Y-%m', expense_date) AS month, 0 AS income, amount AS expenses
           FROM cash_expenses WHERE 1=1 ${expenseDateFilter}
         )
         GROUP BY month
         ORDER BY month ASC`
      )
      .all() as DashboardStats['cashFlow']

    const cashSettings = sqlite
      .prepare('SELECT opening_balance FROM cash_settings WHERE id = 1')
      .get() as { opening_balance: number } | undefined

    const cashIncomeTotal = sqlite
      .prepare(`SELECT COALESCE(SUM(net_amount), 0) AS total FROM sales WHERE 1=1 ${salesDateFilter}`)
      .get() as { total: number }

    const cashExpensesTotal = sqlite
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM cash_expenses WHERE 1=1 ${expenseDateFilter}`
      )
      .get() as { total: number }

    const openingBalance = cashSettings?.opening_balance ?? 0
    const cashSummary = {
      openingBalance,
      totalIncome: cashIncomeTotal.total,
      totalExpenses: cashExpensesTotal.total,
      currentBalance: openingBalance + cashIncomeTotal.total - cashExpensesTotal.total
    }

    return {
      overview,
      previousOverview,
      revenueByMonth,
      salesByChannel,
      salesByCategory,
      salesByFair,
      topVariations,
      outOfStock,
      lowStock,
      outOfInsumos,
      lowInsumos,
      cashFlow,
      cashSummary
    }
  })
}
