import type { DashboardStats } from '../types'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/** '2026-08' -> 'Ago/26' */
export function formatMonth(ym: string): string {
  const [year, month] = ym.split('-')
  return `${MESES[parseInt(month) - 1]}/${year.slice(2)}`
}

/** '2026-08-05' -> '5 Ago' */
export function formatDay(dateStr: string): string {
  const [, month, day] = dateStr.split('-')
  return `${parseInt(day)} ${MESES[parseInt(month) - 1]}`
}

/** Sem período anterior com movimento não há variação a mostrar — daí o null. */
export function calcDelta(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

export type InsightKind = 'canal' | 'categoria' | 'estoque' | 'feira' | 'margem'

export interface Insight {
  kind: InsightKind
  text: string
}

function pluralizarItens(quantidade: number): string {
  return quantidade === 1 ? 'item esgotado' : 'itens esgotados'
}

export function buildInsights(stats: DashboardStats): Insight[] {
  const insights: Insight[] = []

  if (stats.salesByChannel.length > 0) {
    // A consulta já devolve ordenado por faturamento, então o primeiro é o maior.
    const melhor = stats.salesByChannel[0]
    const total = stats.salesByChannel.reduce((acc, c) => acc + c.revenue, 0)
    const pct = total > 0 ? ((melhor.revenue / total) * 100).toFixed(0) : '0'
    insights.push({
      kind: 'canal',
      text: `${melhor.channel} é o canal com maior faturamento (${pct}% do total)`
    })
  }

  if (stats.salesByCategory.length > 0) {
    // "Mais vendida" é por unidade, não por faturamento — a lista vem ordenada
    // por receita, então pegar o primeiro item daria a categoria errada.
    const melhor = stats.salesByCategory.reduce((a, b) => (a.quantity > b.quantity ? a : b))
    const unidade = melhor.quantity === 1 ? 'unidade' : 'unidades'
    insights.push({
      kind: 'categoria',
      text: `${melhor.category} é a categoria mais vendida (${melhor.quantity} ${unidade})`
    })
  }

  const esgotados = stats.outOfStock.length + stats.outOfInsumos.length
  if (esgotados > 0) {
    insights.push({
      kind: 'estoque',
      text: `${esgotados} ${pluralizarItens(esgotados)} — atenção ao estoque!`
    })
  }

  const feirasComVenda = stats.salesByFair.filter((f) => f.revenue > 0)
  if (feirasComVenda.length > 0) {
    const melhor = feirasComVenda.reduce((a, b) => (a.netProfit > b.netProfit ? a : b))
    if (melhor.netProfit > 0) {
      insights.push({
        kind: 'feira',
        text: `Melhor feira: ${melhor.fairName} com lucro líquido de ${melhor.netProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
      })
    }
  }

  if (stats.overview.totalNetRevenue > 0) {
    const margem = ((stats.overview.totalProfit / stats.overview.totalNetRevenue) * 100).toFixed(1)
    insights.push({ kind: 'margem', text: `Margem de lucro no período: ${margem}%` })
  }

  return insights
}
