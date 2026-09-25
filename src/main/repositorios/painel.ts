import type { ConexaoBanco } from '../database/conexao'
import {
  SQL_INSUMOS_ABAIXO_DO_MINIMO,
  SQL_INSUMOS_ESGOTADOS,
  SQL_VARIACOES_ABAIXO_DO_MINIMO,
  SQL_VARIACOES_ESGOTADAS
} from '../database/consultas-estoque'
import { ErroDeNegocio } from '../ipc/mensagens'
import { diaLocal, subtrairMeses } from '../../shared/datas'
import { emCentavos } from '../../shared/dinheiro'
import type { DashboardParams, DashboardStats, PeriodoDoPainel } from '../../shared/ipc/painel'

/**
 * Os limites do período no dia da cliente. Com `toISOString()`, depois das 21h o
 * período terminava amanhã e o trimestre começava um dia depois do certo.
 * `now` é parâmetro para o cálculo ser determinístico em teste.
 */
export function computePeriodDates(
  period: Exclude<PeriodoDoPainel, 'custom'>,
  now = new Date()
): {
  fromDate: string | null
  toDate: string | null
  prevFromDate: string | null
  prevToDate: string | null
} {
  const today = diaLocal(now)

  if (period === 'all') {
    return { fromDate: null, toDate: null, prevFromDate: null, prevToDate: null }
  }

  if (period === 'month') {
    const fromDate = diaLocal(new Date(now.getFullYear(), now.getMonth(), 1))
    const prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevTo = new Date(now.getFullYear(), now.getMonth(), 0)
    return {
      fromDate,
      toDate: today,
      prevFromDate: diaLocal(prevFrom),
      prevToDate: diaLocal(prevTo)
    }
  }

  if (period === 'quarter') {
    const from = subtrairMeses(now, 3)
    const prevFrom = subtrairMeses(now, 6)
    const prevTo = new Date(from)
    prevTo.setDate(prevTo.getDate() - 1)
    return {
      fromDate: diaLocal(from),
      toDate: today,
      prevFromDate: diaLocal(prevFrom),
      prevToDate: diaLocal(prevTo)
    }
  }

  if (period === 'halfyear') {
    const from = subtrairMeses(now, 6)
    const prevFrom = subtrairMeses(now, 12)
    const prevTo = new Date(from)
    prevTo.setDate(prevTo.getDate() - 1)
    return {
      fromDate: diaLocal(from),
      toDate: today,
      prevFromDate: diaLocal(prevFrom),
      prevToDate: diaLocal(prevTo)
    }
  }

  // year
  const fromDate = diaLocal(new Date(now.getFullYear(), 0, 1))
  const prevFromDate = diaLocal(new Date(now.getFullYear() - 1, 0, 1))
  const prevToDate = diaLocal(new Date(now.getFullYear() - 1, 11, 31))
  return { fromDate, toDate: today, prevFromDate, prevToDate }
}

export interface RepositorioDoPainel {
  estatisticas(params: DashboardParams): DashboardStats
}

/** O trecho do WHERE que recorta o período numa coluna de data, e os valores dele. */
interface Recorte {
  clausula: string
  parametros: string[]
}

/**
 * RN-14: `date()` normaliza o registro antigo que guarda hora, para ele entrar no dia
 * certo. Sem data inicial não há recorte. A coluna é sempre um trecho fixo deste
 * arquivo; as datas vão por parâmetro.
 */
function recorteDeDatas(coluna: string, de: string | null, ate: string | null): Recorte {
  if (!de) return { clausula: '', parametros: [] }
  if (!ate) return { clausula: ` AND date(${coluna}) >= ?`, parametros: [de] }
  return {
    clausula: ` AND date(${coluna}) >= ? AND date(${coluna}) <= ?`,
    parametros: [de, ate]
  }
}

/** Os custos de uma feira `f` além da inscrição. */
const CUSTOS_ADICIONAIS_DA_FEIRA =
  'COALESCE((SELECT SUM(fac.amount) FROM fair_additional_costs fac WHERE fac.fair_id = f.id), 0)'

/**
 * Só leitura: junta as consultas do painel num lugar só. O recorte de datas usa
 * `date(...)` em toda cláusula, para registro antigo que guarda hora entrar no
 * período certo.
 */
export function repositorioDoPainel({ sqlite }: ConexaoBanco): RepositorioDoPainel {
  /** Faturamento, custo, lucro e ticket das vendas do recorte: do período e do anterior. */
  function resumoDasVendas(recorte: Recorte): NonNullable<DashboardStats['previousOverview']> {
    return sqlite
      .prepare(
        `SELECT
          COALESCE(SUM(s.total_amount), 0)              AS totalRevenue,
          COALESCE(SUM(s.net_amount), 0)                AS totalNetRevenue,
          COALESCE(SUM(s.total_cost), 0)                AS totalCost,
          COALESCE(SUM(s.net_amount - s.total_cost), 0) AS totalProfit,
          COUNT(s.id)                                    AS totalSales,
          COALESCE(AVG(s.total_amount), 0)              AS avgTicket
         FROM sales s
         WHERE 1=1${recorte.clausula}`
      )
      .get(...recorte.parametros) as NonNullable<DashboardStats['previousOverview']>
  }

  return {
    estatisticas(params) {
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

      // Cada cláusula de data depende de fromDate; um toDate solto geraria mais
      // parâmetros do que placeholders e a consulta quebraria.
      if (toDate && !fromDate) {
        throw new ErroDeNegocio('Informe a data inicial do período personalizado.')
      }

      const vendas = recorteDeDatas('s.sold_at', fromDate, toDate)
      const vendasDaTabela = recorteDeDatas('sold_at', fromDate, toDate)
      const despesas = recorteDeDatas('expense_date', fromDate, toDate)
      const feiras = recorteDeDatas('f.date', fromDate, toDate)
      // Vendas 'A receber' pendentes (received_at IS NULL) NÃO entram no caixa.
      // Data efetiva de entrada = COALESCE(received_at, sold_at) — vendas liquidadas
      // depois (fiado) aparecem no mês do recebimento, não da venda.
      const entradas = recorteDeDatas('COALESCE(received_at, sold_at)', fromDate, toDate)
      // RN-17: o pagamento de venda a receber entra no caixa no dia em que foi recebido.
      const pagamentos = recorteDeDatas('received_at', fromDate, toDate)

      // RN-17: o que falta receber é o total menos o que já foi pago. O arredondamento
      // em centavos tira o resíduo de ponto flutuante de uma venda que já fechou.
      const receivable = sqlite
        .prepare(
          `SELECT COALESCE(SUM(s.total_amount - COALESCE(
             (SELECT SUM(p.amount) FROM sale_payments p WHERE p.sale_id = s.id), 0)), 0)
             AS totalReceivable
           FROM sales s
           WHERE s.payment_method = 'areceber'${vendas.clausula}`
        )
        .get(...vendas.parametros) as { totalReceivable: number }

      const overview: DashboardStats['overview'] = {
        ...resumoDasVendas(vendas),
        totalReceivable: emCentavos(receivable.totalReceivable)
      }

      const previousOverview: DashboardStats['previousOverview'] =
        prevFromDate && prevToDate
          ? resumoDasVendas(recorteDeDatas('s.sold_at', prevFromDate, prevToDate))
          : null

      const revenueByMonth = sqlite
        .prepare(
          `SELECT
            strftime('%Y-%m', s.sold_at)                  AS month,
            COALESCE(SUM(s.total_amount), 0)              AS revenue,
            COALESCE(SUM(s.net_amount - s.total_cost), 0) AS profit
           FROM sales s
           WHERE 1=1${vendas.clausula}
           GROUP BY month
           ORDER BY month ASC`
        )
        .all(...vendas.parametros) as DashboardStats['revenueByMonth']

      const salesByChannel = sqlite
        .prepare(
          `SELECT
            s.channel,
            COALESCE(SUM(s.total_amount), 0)              AS revenue,
            COALESCE(SUM(s.net_amount - s.total_cost), 0) AS profit,
            COUNT(s.id)                                    AS count
           FROM sales s
           WHERE 1=1${vendas.clausula}
           GROUP BY s.channel
           ORDER BY revenue DESC`
        )
        .all(...vendas.parametros) as DashboardStats['salesByChannel']

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
           WHERE 1=1${vendas.clausula}
           GROUP BY COALESCE(c.name, 'Sem categoria')
           ORDER BY revenue DESC`
        )
        .all(...vendas.parametros) as DashboardStats['salesByCategory']

      // O recorte das vendas fica dentro do LEFT JOIN: feira sem venda no período
      // continua na lista, com faturamento zero.
      const salesByFairRaw = sqlite
        .prepare(
          `SELECT
            f.id                                           AS fairId,
            f.name                                         AS fairName,
            f.date,
            f.end_date                                     AS endDate,
            f.enrollment_cost                              AS enrollmentCost,
            ${CUSTOS_ADICIONAIS_DA_FEIRA} AS additionalCosts,
            COALESCE(SUM(s.total_amount), 0)              AS revenue,
            COALESCE(SUM(s.net_amount - s.total_cost), 0) AS profit,
            COALESCE(SUM(s.net_amount - s.total_cost), 0)
              - f.enrollment_cost
              - ${CUSTOS_ADICIONAIS_DA_FEIRA} AS netProfit
           FROM fairs f
           LEFT JOIN sales s ON s.fair_id = f.id${vendas.clausula}
           GROUP BY f.id
           ORDER BY f.date DESC`
        )
        .all(...vendas.parametros) as Array<{
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
           WHERE fair_id IS NOT NULL${vendasDaTabela.clausula}
           GROUP BY fair_id, day
           ORDER BY fair_id, day ASC`
        )
        .all(...vendasDaTabela.parametros) as Array<{
        fairId: number
        day: string
        revenue: number
        salesCount: number
      }>

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
           WHERE 1=1${vendas.clausula}
           GROUP BY si.variation_id
           ORDER BY quantity DESC
           LIMIT 8`
        )
        .all(...vendas.parametros) as DashboardStats['topVariations']

      const outOfStock = sqlite
        .prepare(SQL_VARIACOES_ESGOTADAS)
        .all() as DashboardStats['outOfStock']

      const lowStock = sqlite
        .prepare(SQL_VARIACOES_ABAIXO_DO_MINIMO)
        .all() as DashboardStats['lowStock']

      const outOfInsumos = sqlite
        .prepare(SQL_INSUMOS_ESGOTADOS)
        .all() as DashboardStats['outOfInsumos']

      const lowInsumos = sqlite
        .prepare(SQL_INSUMOS_ABAIXO_DO_MINIMO)
        .all() as DashboardStats['lowInsumos']

      const cashFlow = sqlite
        .prepare(
          `SELECT
            month,
            COALESCE(SUM(income), 0)   AS income,
            COALESCE(SUM(expenses), 0) AS expenses
           FROM (
             SELECT strftime('%Y-%m', COALESCE(received_at, sold_at)) AS month, net_amount AS income, 0 AS expenses
             FROM sales WHERE payment_method != 'areceber'${entradas.clausula}
             UNION ALL
             SELECT strftime('%Y-%m', received_at) AS month, net_amount AS income, 0 AS expenses
             FROM sale_payments WHERE 1=1${pagamentos.clausula}
             UNION ALL
             SELECT strftime('%Y-%m', expense_date) AS month, 0 AS income, amount AS expenses
             FROM cash_expenses WHERE 1=1${despesas.clausula}
             UNION ALL
             SELECT strftime('%Y-%m', f.date) AS month, 0 AS income,
               f.enrollment_cost + ${CUSTOS_ADICIONAIS_DA_FEIRA} AS expenses
             FROM fairs f
             WHERE (f.enrollment_cost > 0 OR EXISTS (SELECT 1 FROM fair_additional_costs fac WHERE fac.fair_id = f.id))${feiras.clausula}
           )
           GROUP BY month
           ORDER BY month ASC`
        )
        .all(
          ...entradas.parametros,
          ...pagamentos.parametros,
          ...despesas.parametros,
          ...feiras.parametros
        ) as DashboardStats['cashFlow']

      const cashSettings = sqlite
        .prepare('SELECT opening_balance FROM cash_settings WHERE id = 1')
        .get() as { opening_balance: number } | undefined

      const cashIncomeTotal = sqlite
        .prepare(
          `SELECT
             (SELECT COALESCE(SUM(net_amount), 0) FROM sales
              WHERE payment_method != 'areceber'${entradas.clausula})
             + (SELECT COALESCE(SUM(net_amount), 0) FROM sale_payments
                WHERE 1=1${pagamentos.clausula}) AS total`
        )
        .get(...entradas.parametros, ...pagamentos.parametros) as { total: number }

      const cashExpensesTotal = sqlite
        .prepare(
          `SELECT COALESCE(SUM(amount), 0) AS total FROM cash_expenses WHERE 1=1${despesas.clausula}`
        )
        .get(...despesas.parametros) as { total: number }

      const fairCostsTotal = sqlite
        .prepare(
          `SELECT COALESCE(SUM(f.enrollment_cost + ${CUSTOS_ADICIONAIS_DA_FEIRA}), 0) AS total
           FROM fairs f WHERE 1=1${feiras.clausula}`
        )
        .get(...feiras.parametros) as { total: number }

      // RN-18: o caixa do período começa na abertura mais tudo o que entrou e saiu antes
      // dele, pelas mesmas regras das entradas e saídas acima. Registro antigo sem data
      // conta como anterior: não cai em período nenhum com data, mas o dinheiro existiu,
      // e sem ele o saldo do mês não bateria com o de "Tudo".
      const antesDoPeriodo = fromDate
        ? (
            sqlite
              .prepare(
                `SELECT
                   (SELECT COALESCE(SUM(net_amount), 0) FROM sales
                    WHERE payment_method != 'areceber'
                      AND COALESCE(date(COALESCE(received_at, sold_at)), '') < ?)
                   + (SELECT COALESCE(SUM(net_amount), 0) FROM sale_payments
                      WHERE COALESCE(date(received_at), '') < ?)
                   - (SELECT COALESCE(SUM(amount), 0) FROM cash_expenses
                      WHERE COALESCE(date(expense_date), '') < ?)
                   - (SELECT COALESCE(SUM(f.enrollment_cost + ${CUSTOS_ADICIONAIS_DA_FEIRA}), 0)
                      FROM fairs f WHERE COALESCE(date(f.date), '') < ?) AS saldo`
              )
              .get(fromDate, fromDate, fromDate, fromDate) as { saldo: number }
          ).saldo
        : 0

      const totalExpenses = cashExpensesTotal.total + fairCostsTotal.total
      const openingBalance = cashSettings?.opening_balance ?? 0
      const startBalance = openingBalance + antesDoPeriodo
      const cashSummary = {
        openingBalance,
        startBalance,
        totalIncome: cashIncomeTotal.total,
        totalExpenses,
        currentBalance: startBalance + cashIncomeTotal.total - totalExpenses
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
    }
  }
}
