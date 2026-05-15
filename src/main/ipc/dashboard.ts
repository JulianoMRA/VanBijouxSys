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
    totalReceivable: number
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

type Period = 'month' | 'quarter' | 'halfyear' | 'year' | 'all' | 'custom'

interface DashboardParams {
  period: Period
  customFrom?: string
  customTo?: string
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function computePeriodDates(period: Exclude<Period, 'custom'>): {
  fromDate: string | null
  toDate: string | null
  prevFromDate: string | null
  prevToDate: string | null
} {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)

  if (period === 'all') {
    return { fromDate: null, toDate: null, prevFromDate: null, prevToDate: null }
  }

  if (period === 'month') {
    const fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    const prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevTo = new Date(now.getFullYear(), now.getMonth(), 0)
    return {
      fromDate,
      toDate: today,
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
      toDate: today,
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
      toDate: today,
      prevFromDate: prevFrom.toISOString().slice(0, 10),
      prevToDate: prevTo.toISOString().slice(0, 10)
    }
  }

  // year
  const fromDate = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10)
  const prevFromDate = new Date(now.getFullYear() - 1, 0, 1).toISOString().slice(0, 10)
  const prevToDate = new Date(now.getFullYear() - 1, 11, 31).toISOString().slice(0, 10)
  return { fromDate, toDate: today, prevFromDate, prevToDate }
}

export function registerDashboardHandlers(): void {
  ipcMain.handle('dashboard:getStats', async (_event, params: DashboardParams) => {
    try {
      const sqlite = getSqlite()

      let fromDate: string | null
      let toDate: string | null
      let prevFromDate: string | null
      let prevToDate: string | null

      if (params.period === 'custom') {
        fromDate = params.customFrom ?? null
        toDate = params.customTo ?? null
        prevFromDate = null
        prevToDate = null
      } else {
        ;({ fromDate, toDate, prevFromDate, prevToDate } = computePeriodDates(params.period))
      }

      if (fromDate && !ISO_DATE.test(fromDate)) throw new Error('Invalid fromDate format')
      if (toDate && !ISO_DATE.test(toDate)) throw new Error('Invalid toDate format')

      // Cláusulas com date() para normalizar timestamps completos legados.
      const sSoldAtClause = fromDate
        ? ` AND date(s.sold_at) >= ?${toDate ? ' AND date(s.sold_at) <= ?' : ''}`
        : ''
      const soldAtClause = fromDate
        ? ` AND date(sold_at) >= ?${toDate ? ' AND date(sold_at) <= ?' : ''}`
        : ''
      const expenseDateClause = fromDate
        ? ` AND date(expense_date) >= ?${toDate ? ' AND date(expense_date) <= ?' : ''}`
        : ''
      const fDateClause = fromDate
        ? ` AND date(f.date) >= ?${toDate ? ' AND date(f.date) <= ?' : ''}`
        : ''
      const prevSoldAtClause =
        prevFromDate && prevToDate
          ? ` AND date(s.sold_at) >= ? AND date(s.sold_at) <= ?`
          : ''

      const dateParams: string[] = [
        ...(fromDate ? [fromDate] : []),
        ...(toDate ? [toDate] : [])
      ]
      const prevDateParams: string[] =
        prevFromDate && prevToDate ? [prevFromDate, prevToDate] : []

      const overviewBase = sqlite
        .prepare(
          `SELECT
            COALESCE(SUM(s.total_amount), 0)              AS totalRevenue,
            COALESCE(SUM(s.net_amount), 0)                AS totalNetRevenue,
            COALESCE(SUM(s.total_cost), 0)                AS totalCost,
            COALESCE(SUM(s.net_amount - s.total_cost), 0) AS totalProfit,
            COUNT(s.id)                                    AS totalSales,
            COALESCE(AVG(s.net_amount), 0)                AS avgTicket
           FROM sales s
           WHERE 1=1${sSoldAtClause}`
        )
        .get(...dateParams) as Omit<DashboardStats['overview'], 'totalReceivable'>

      const receivable = sqlite
        .prepare(
          `SELECT COALESCE(SUM(s.net_amount), 0) AS totalReceivable
           FROM sales s
           WHERE s.payment_method = 'areceber'${sSoldAtClause}`
        )
        .get(...dateParams) as { totalReceivable: number }

      const overview: DashboardStats['overview'] = { ...overviewBase, totalReceivable: receivable.totalReceivable }

      let previousOverview: DashboardStats['previousOverview'] = null
      if (prevSoldAtClause) {
        previousOverview = sqlite
          .prepare(
            `SELECT
              COALESCE(SUM(s.total_amount), 0)              AS totalRevenue,
              COALESCE(SUM(s.net_amount), 0)                AS totalNetRevenue,
              COALESCE(SUM(s.total_cost), 0)                AS totalCost,
              COALESCE(SUM(s.net_amount - s.total_cost), 0) AS totalProfit,
              COUNT(s.id)                                    AS totalSales,
              COALESCE(AVG(s.net_amount), 0)                AS avgTicket
             FROM sales s
             WHERE 1=1${prevSoldAtClause}`
          )
          .get(...prevDateParams) as NonNullable<DashboardStats['previousOverview']>
      }

      const revenueByMonth = sqlite
        .prepare(
          `SELECT
            strftime('%Y-%m', s.sold_at)                  AS month,
            COALESCE(SUM(s.total_amount), 0)              AS revenue,
            COALESCE(SUM(s.net_amount - s.total_cost), 0) AS profit
           FROM sales s
           WHERE 1=1${sSoldAtClause}
           GROUP BY month
           ORDER BY month ASC`
        )
        .all(...dateParams) as DashboardStats['revenueByMonth']

      const salesByChannel = sqlite
        .prepare(
          `SELECT
            s.channel,
            COALESCE(SUM(s.total_amount), 0)              AS revenue,
            COALESCE(SUM(s.net_amount - s.total_cost), 0) AS profit,
            COUNT(s.id)                                    AS count
           FROM sales s
           WHERE 1=1${sSoldAtClause}
           GROUP BY s.channel
           ORDER BY revenue DESC`
        )
        .all(...dateParams) as DashboardStats['salesByChannel']

      // LEFT JOIN + COALESCE garante que itens sem categoria (variação removida etc.)
      // ainda contam para o total, mantendo SUM(salesByCategory.revenue) === overview.totalRevenue.
      const salesByCategory = sqlite
        .prepare(
          `SELECT
            COALESCE(c.name, 'Sem categoria')              AS category,
            COALESCE(SUM(si.quantity * si.unit_price), 0) AS revenue,
            COALESCE(SUM(si.quantity), 0)                  AS quantity,
            COUNT(DISTINCT s.id)                           AS count
           FROM sale_items si
           JOIN sales s ON s.id = si.sale_id
           LEFT JOIN product_variations pv ON pv.id = si.variation_id
           LEFT JOIN products p ON p.id = pv.product_id
           LEFT JOIN categories c ON c.id = p.category_id
           WHERE 1=1${sSoldAtClause}
           GROUP BY COALESCE(c.name, 'Sem categoria')
           ORDER BY revenue DESC`
        )
        .all(...dateParams) as DashboardStats['salesByCategory']

      // fairDateClause usa s.sold_at dentro do LEFT JOIN; date() para consistência.
      const fairJoinClause = fromDate
        ? ` AND date(s.sold_at) >= ?${toDate ? ' AND date(s.sold_at) <= ?' : ''}`
        : ''

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
            COALESCE(SUM(s.net_amount - s.total_cost), 0) AS profit,
            COALESCE(SUM(s.net_amount - s.total_cost), 0)
              - f.enrollment_cost
              - COALESCE((SELECT SUM(fac.amount) FROM fair_additional_costs fac WHERE fac.fair_id = f.id), 0) AS netProfit
           FROM fairs f
           LEFT JOIN sales s ON s.fair_id = f.id${fairJoinClause}
           GROUP BY f.id
           ORDER BY f.date DESC`
        )
        .all(...dateParams) as Array<{
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
           WHERE fair_id IS NOT NULL${soldAtClause}
           GROUP BY fair_id, day
           ORDER BY fair_id, day ASC`
        )
        .all(...dateParams) as Array<{ fairId: number; day: string; revenue: number; salesCount: number }>

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
           WHERE 1=1${sSoldAtClause}
           GROUP BY si.variation_id
           ORDER BY quantity DESC
           LIMIT 8`
        )
        .all(...dateParams) as DashboardStats['topVariations']

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

      // Vendas 'A receber' pendentes (received_at IS NULL) NÃO entram no caixa.
      // Data efetiva de entrada = COALESCE(received_at, sold_at) — vendas liquidadas
      // depois (fiado) aparecem no mês do recebimento, não da venda.
      const cashIncomeClause = fromDate
        ? ` AND date(COALESCE(received_at, sold_at)) >= ?${toDate ? ' AND date(COALESCE(received_at, sold_at)) <= ?' : ''}`
        : ''

      const cashFlowParams: string[] = [...dateParams, ...dateParams, ...dateParams]

      const cashFlow = sqlite
        .prepare(
          `SELECT
            month,
            COALESCE(SUM(income), 0)   AS income,
            COALESCE(SUM(expenses), 0) AS expenses
           FROM (
             SELECT strftime('%Y-%m', COALESCE(received_at, sold_at)) AS month, net_amount AS income, 0 AS expenses
             FROM sales WHERE payment_method != 'areceber'${cashIncomeClause}
             UNION ALL
             SELECT strftime('%Y-%m', expense_date) AS month, 0 AS income, amount AS expenses
             FROM cash_expenses WHERE 1=1${expenseDateClause}
             UNION ALL
             SELECT strftime('%Y-%m', f.date) AS month, 0 AS income,
               f.enrollment_cost + COALESCE((SELECT SUM(fac.amount) FROM fair_additional_costs fac WHERE fac.fair_id = f.id), 0) AS expenses
             FROM fairs f
             WHERE (f.enrollment_cost > 0 OR EXISTS (SELECT 1 FROM fair_additional_costs fac WHERE fac.fair_id = f.id))${fDateClause}
           )
           GROUP BY month
           ORDER BY month ASC`
        )
        .all(...cashFlowParams) as DashboardStats['cashFlow']

      const cashSettings = sqlite
        .prepare('SELECT opening_balance FROM cash_settings WHERE id = 1')
        .get() as { opening_balance: number } | undefined

      const cashIncomeTotal = sqlite
        .prepare(
          `SELECT COALESCE(SUM(net_amount), 0) AS total
           FROM sales
           WHERE payment_method != 'areceber'${cashIncomeClause}`
        )
        .get(...dateParams) as { total: number }

      const cashExpensesTotal = sqlite
        .prepare(
          `SELECT COALESCE(SUM(amount), 0) AS total FROM cash_expenses WHERE 1=1${expenseDateClause}`
        )
        .get(...dateParams) as { total: number }

      const fairCostsTotal = sqlite
        .prepare(
          `SELECT COALESCE(SUM(f.enrollment_cost + COALESCE((SELECT SUM(fac.amount) FROM fair_additional_costs fac WHERE fac.fair_id = f.id), 0)), 0) AS total
           FROM fairs f WHERE 1=1${fDateClause}`
        )
        .get(...dateParams) as { total: number }

      const totalExpenses = cashExpensesTotal.total + fairCostsTotal.total
      const openingBalance = cashSettings?.opening_balance ?? 0
      const cashSummary = {
        openingBalance,
        totalIncome: cashIncomeTotal.total,
        totalExpenses,
        currentBalance: openingBalance + cashIncomeTotal.total - totalExpenses
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
    } catch (err) {
      console.error('[dashboard:getStats]', err)
      return { success: false, error: String(err) }
    }
  })
}
