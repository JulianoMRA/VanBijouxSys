import { useEffect, useState } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts'
import { ChevronDown, ChevronUp, AlertTriangle, XCircle, Trophy, Gem, Star, TrendingUp } from 'lucide-react'
import { formatCurrency } from '../utils/format'
import type { DashboardStats } from '../types'

type Period = 'month' | 'quarter' | 'halfyear' | 'year' | 'all' | 'custom'

const PERIODS: { label: string; value: Period }[] = [
  { label: 'Este mês', value: 'month' },
  { label: '3 meses', value: 'quarter' },
  { label: '6 meses', value: 'halfyear' },
  { label: 'Este ano', value: 'year' },
  { label: 'Tudo', value: 'all' },
  { label: 'Personalizado', value: 'custom' }
]

const CHANNEL_COLORS: Record<string, string> = {
  Feira: '#e44d8a',
  WhatsApp: '#10b981',
  Instagram: '#f59e0b',
  Outro: '#94a3b8'
}

const CATEGORY_COLORS: Record<string, string> = {
  Colar: '#e44d8a',
  Pulseira: '#f59e0b',
  Brinco: '#10b981',
  Tiara: '#8b5cf6',
  Pingente: '#3b82f6'
}

const CATEGORY_FALLBACK_COLORS = ['#e44d8a', '#f59e0b', '#10b981', '#8b5cf6', '#3b82f6', '#94a3b8']

function formatMonth(ym: string): string {
  const [year, month] = ym.split('-')
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${names[parseInt(month) - 1]}/${year.slice(2)}`
}

function formatDay(dateStr: string): string {
  const [, month, day] = dateStr.split('-')
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${parseInt(day)} ${names[parseInt(month) - 1]}`
}

function calcDelta(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

function DeltaBadge({ delta }: { delta: number | null }): JSX.Element | null {
  if (delta === null) return null
  const isPositive = delta >= 0
  return (
    <div
      className={`text-xs font-medium mt-1 ${isPositive ? 'text-emerald-600' : 'text-rose-500'}`}
    >
      {isPositive ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}% vs período anterior
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  accent,
  delta
}: {
  label: string
  value: string
  sub?: string
  accent?: boolean
  delta?: number | null
}): JSX.Element {
  return (
    <div className="card py-5">
      <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">{label}</p>
      <p className={`font-display text-2xl font-bold ${accent ? 'text-blush-600' : 'text-gray-800'}`}>
        {value}
      </p>
      <DeltaBadge delta={delta ?? null} />
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function InsightsPanel({ stats }: { stats: DashboardStats }): JSX.Element {
  const insights: Array<{ text: string; colorClass: string; icon: JSX.Element }> = []

  if (stats.salesByChannel.length > 0) {
    const best = stats.salesByChannel[0]
    const totalRev = stats.salesByChannel.reduce((acc, c) => acc + c.revenue, 0)
    const pct = totalRev > 0 ? ((best.revenue / totalRev) * 100).toFixed(0) : '0'
    insights.push({
      text: `${best.channel} é o canal com maior faturamento (${pct}% do total)`,
      colorClass: 'text-blush-600',
      icon: <Trophy size={14} className="text-blush-500 mt-0.5 shrink-0" />
    })
  }

  if (stats.salesByCategory.length > 0) {
    const best = stats.salesByCategory[0]
    insights.push({
      text: `${best.category} é a categoria mais vendida (${best.quantity} unidade${best.quantity !== 1 ? 's' : ''})`,
      colorClass: 'text-purple-600',
      icon: <Gem size={14} className="text-purple-400 mt-0.5 shrink-0" />
    })
  }

  const outCount = stats.outOfStock.length + stats.outOfInsumos.length
  if (outCount > 0) {
    insights.push({
      text: `${outCount} item${outCount !== 1 ? 'ns' : ''} esgotado${outCount !== 1 ? 's' : ''} — atenção ao estoque!`,
      colorClass: 'text-rose-600',
      icon: <AlertTriangle size={14} className="text-rose-500 mt-0.5 shrink-0" />
    })
  }

  const fairsWithRevenue = stats.salesByFair.filter((f) => f.revenue > 0)
  if (fairsWithRevenue.length > 0) {
    const best = fairsWithRevenue.reduce((a, b) => (a.netProfit > b.netProfit ? a : b))
    if (best.netProfit > 0) {
      insights.push({
        text: `Melhor feira: ${best.fairName} com lucro líquido de ${formatCurrency(best.netProfit)}`,
        colorClass: 'text-emerald-600',
        icon: <Star size={14} className="text-emerald-500 mt-0.5 shrink-0" />
      })
    }
  }

  if (stats.overview.totalNetRevenue > 0) {
    const margin = ((stats.overview.totalProfit / stats.overview.totalNetRevenue) * 100).toFixed(1)
    insights.push({
      text: `Margem de lucro no período: ${margin}%`,
      colorClass: 'text-gray-700',
      icon: <TrendingUp size={14} className="text-gray-400 mt-0.5 shrink-0" />
    })
  }

  if (insights.length === 0) {
    return (
      <div className="card flex items-center justify-center">
        <p className="text-sm text-gray-400 text-center">
          Registre mais vendas para ver os insights.
        </p>
      </div>
    )
  }

  return (
    <div className="card flex flex-col">
      <p className="text-sm font-semibold text-gray-700 mb-4">Insights do período</p>
      <div className="space-y-2.5">
        {insights.map((ins, i) => (
          <div key={i} className="flex items-start gap-2.5 bg-cream-50 rounded-xl px-3.5 py-3">
            {ins.icon}
            <p className={`text-sm leading-snug font-medium ${ins.colorClass}`}>{ins.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function FairCard({
  fair
}: {
  fair: DashboardStats['salesByFair'][number]
}): JSX.Element {
  const [expanded, setExpanded] = useState(false)

  const dateLabel =
    fair.endDate && fair.endDate !== fair.date
      ? `${fair.date.slice(8, 10)} a ${fair.endDate.slice(8, 10)}/${fair.date.slice(5, 7)}/${fair.date.slice(0, 4)}`
      : `${fair.date.slice(8, 10)}/${fair.date.slice(5, 7)}/${fair.date.slice(0, 4)}`

  const totalFairCost = fair.enrollmentCost + fair.additionalCosts
  const hasDailyData = fair.dailyBreakdown.length > 1

  const bestDay =
    fair.dailyBreakdown.length > 0
      ? fair.dailyBreakdown.reduce((a, b) => (a.revenue > b.revenue ? a : b))
      : null

  return (
    <div className="bg-cream-50 rounded-xl overflow-hidden">
      <div
        className={`px-4 py-3 ${hasDailyData ? 'cursor-pointer hover:bg-cream-100 transition-colors' : ''}`}
        onClick={hasDailyData ? () => setExpanded(!expanded) : undefined}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-gray-800 truncate">{fair.fairName}</p>
              {hasDailyData &&
                (expanded ? (
                  <ChevronUp size={13} className="text-gray-400 shrink-0" />
                ) : (
                  <ChevronDown size={13} className="text-gray-400 shrink-0" />
                ))}
            </div>
            <p className="text-xs text-gray-400">{dateLabel}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-semibold text-gray-800">{formatCurrency(fair.revenue)}</p>
            <p
              className={`text-xs font-medium ${fair.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}
            >
              Líquido: {formatCurrency(fair.netProfit)}
            </p>
          </div>
        </div>
        {totalFairCost > 0 && (
          <p className="text-xs text-gray-400 mt-1">
            Custo feira: {formatCurrency(totalFairCost)}
            {fair.additionalCosts > 0 &&
              ` (inscrição ${formatCurrency(fair.enrollmentCost)} + outros ${formatCurrency(fair.additionalCosts)})`}
            {' '}· Lucro bruto: {formatCurrency(fair.profit)}
          </p>
        )}
        {hasDailyData && bestDay && !expanded && (
          <p className="text-xs text-gray-400 mt-0.5">
            Melhor dia: {formatDay(bestDay.day)} ({formatCurrency(bestDay.revenue)}) · clique para ver distribuição
          </p>
        )}
      </div>

      {hasDailyData && expanded && (
        <div className="px-4 pb-4 border-t border-cream-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-3 mb-3">
            Vendas por dia
          </p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart
              data={fair.dailyBreakdown.map((d) => ({ ...d, dayLabel: formatDay(d.day) }))}
              barCategoryGap="35%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f5ede6" />
              <XAxis
                dataKey="dayLabel"
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `R$${v}`}
                width={48}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ borderRadius: '12px', border: '1px solid #edddd2', fontSize: 12 }}
              />
              <Bar dataKey="revenue" name="Faturamento" radius={[4, 4, 0, 0]}>
                {fair.dailyBreakdown.map((d) => (
                  <Cell
                    key={d.day}
                    fill={d.day === bestDay?.day ? '#e44d8a' : '#f9a8d4'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2.5 space-y-1.5">
            {fair.dailyBreakdown.map((d) => (
              <div key={d.day} className="flex justify-between items-center text-xs">
                <span
                  className={
                    d.day === bestDay?.day
                      ? 'font-semibold text-blush-600'
                      : 'text-gray-500'
                  }
                >
                  {formatDay(d.day)}
                  {d.day === bestDay?.day && (
                    <span className="ml-1 text-blush-400">(melhor dia)</span>
                  )}
                </span>
                <span
                  className={
                    d.day === bestDay?.day
                      ? 'font-semibold text-blush-600'
                      : 'text-gray-600'
                  }
                >
                  {formatCurrency(d.revenue)} · {d.salesCount} venda
                  {d.salesCount !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Dashboard(): JSX.Element {
  const [period, setPeriod] = useState<Period>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [alertsExpanded, setAlertsExpanded] = useState(true)

  async function loadStats(p: Period, from?: string, to?: string): Promise<void> {
    if (p === 'custom' && (!from || !to)) return
    setLoading(true)
    const data = await window.api.dashboard.getStats({
      period: p,
      customFrom: from,
      customTo: to
    })
    setStats(data)
    setLoading(false)
  }

  useEffect(() => {
    loadStats(period)
  }, [period])

  useEffect(() => {
    if (period === 'custom' && customFrom && customTo) {
      loadStats('custom', customFrom, customTo)
    }
  }, [customFrom, customTo])

  const empty = !stats || stats.overview.totalSales === 0
  const prev = stats?.previousOverview

  const totalOutOfStock = (stats?.outOfStock.length ?? 0) + (stats?.outOfInsumos.length ?? 0)
  const totalLowStock = (stats?.lowStock.length ?? 0) + (stats?.lowInsumos.length ?? 0)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl font-semibold text-gray-800">Dashboard</h2>
        <div className="flex gap-1.5 flex-wrap justify-end">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                period === p.value
                  ? 'bg-blush-500 text-white'
                  : 'bg-white border border-cream-300 text-gray-600 hover:bg-cream-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {period === 'custom' && (
        <div className="flex items-center gap-2 mb-5 justify-end">
          <input
            type="date"
            className="input w-auto text-sm"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
          />
          <span className="text-gray-400 text-sm">até</span>
          <input
            type="date"
            className="input w-auto text-sm"
            value={customTo}
            min={customFrom || undefined}
            onChange={(e) => setCustomTo(e.target.value)}
          />
        </div>
      )}

      {/* Alertas de estoque */}
      {stats && (totalOutOfStock > 0 || totalLowStock > 0) && (
        <div className="rounded-2xl overflow-hidden mb-5 border border-amber-200 bg-amber-50">
          <button
            onClick={() => setAlertsExpanded((v) => !v)}
            className="flex items-center justify-between w-full px-5 py-3.5 text-left hover:bg-amber-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              {totalOutOfStock > 0 && (
                <span className="flex items-center gap-1.5 text-sm font-semibold text-rose-700">
                  <XCircle size={14} className="shrink-0" />
                  {totalOutOfStock} esgotado{totalOutOfStock !== 1 ? 's' : ''}
                </span>
              )}
              {totalOutOfStock > 0 && totalLowStock > 0 && (
                <span className="text-amber-300 text-xs">·</span>
              )}
              {totalLowStock > 0 && (
                <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
                  <AlertTriangle size={14} className="shrink-0" />
                  {totalLowStock} com estoque baixo
                </span>
              )}
            </div>
            <span className="text-amber-500 text-xs font-medium ml-3 shrink-0">
              {alertsExpanded ? '▲ Recolher' : '▼ Expandir'}
            </span>
          </button>

          {alertsExpanded && (
            <div className="border-t border-amber-200">
              {totalOutOfStock > 0 && (
                <div className="px-5 py-3.5 bg-rose-50">
                  <p className="text-xs font-semibold text-rose-600 uppercase tracking-wide mb-2">
                    Sem estoque
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {stats.outOfStock.map((v) => (
                      <span
                        key={v.id}
                        className="text-xs bg-rose-100 text-rose-700 px-2.5 py-1 rounded-full font-medium"
                      >
                        {v.productName} — {v.identifier}
                      </span>
                    ))}
                    {stats.outOfInsumos.map((i) => (
                      <span
                        key={i.id}
                        className="text-xs bg-rose-100 text-rose-700 px-2.5 py-1 rounded-full font-medium"
                      >
                        {i.name} (insumo)
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {totalLowStock > 0 && (
                <div className="px-5 py-3.5">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">
                    Estoque abaixo do mínimo
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {stats.lowStock.map((v) => (
                      <span
                        key={v.id}
                        className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full"
                      >
                        {v.productName} — {v.identifier} ({v.stockQuantity}/{v.minimumStock})
                      </span>
                    ))}
                    {stats.lowInsumos.map((i) => (
                      <span
                        key={i.id}
                        className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full"
                      >
                        {i.name} ({i.stockQuantity.toLocaleString('pt-BR')}/
                        {i.minimumStock.toLocaleString('pt-BR')} {i.unit})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="card flex items-center justify-center h-40">
          <p className="text-gray-400 text-sm">Carregando…</p>
        </div>
      ) : empty ? (
        <div className="card flex flex-col items-center justify-center h-48 text-center">
          <p className="text-gray-500 text-sm">Nenhuma venda registrada neste período.</p>
          <p className="text-gray-400 text-xs mt-1">
            Registre uma venda para ver as estatísticas.
          </p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <StatCard
              label="Faturamento bruto"
              value={formatCurrency(stats!.overview.totalRevenue)}
              sub={`${stats!.overview.totalSales} venda${stats!.overview.totalSales !== 1 ? 's' : ''} · líquido ${formatCurrency(stats!.overview.totalNetRevenue)}`}
              accent
              delta={prev ? calcDelta(stats!.overview.totalRevenue, prev.totalRevenue) : null}
            />
            <StatCard
              label="Lucro"
              value={formatCurrency(stats!.overview.totalProfit)}
              sub={
                stats!.overview.totalNetRevenue > 0
                  ? `${((stats!.overview.totalProfit / stats!.overview.totalNetRevenue) * 100).toFixed(1)}% de margem`
                  : undefined
              }
              delta={prev ? calcDelta(stats!.overview.totalProfit, prev.totalProfit) : null}
            />
            <StatCard
              label="Ticket médio"
              value={formatCurrency(stats!.overview.avgTicket)}
              sub="por venda (líquido)"
              delta={prev ? calcDelta(stats!.overview.avgTicket, prev.avgTicket) : null}
            />
            <StatCard
              label="Custo total"
              value={formatCurrency(stats!.overview.totalCost)}
              sub="materiais + produção"
              delta={prev ? calcDelta(stats!.overview.totalCost, prev.totalCost) : null}
            />
          </div>

          {/* Cash Summary */}
          {stats!.cashSummary && (
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="card py-4 bg-cream-50">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                  Saldo de abertura
                </p>
                <p className="font-display text-lg font-semibold text-gray-600">
                  {formatCurrency(stats!.cashSummary.openingBalance)}
                </p>
              </div>
              <div className="card py-4 bg-emerald-50 border-emerald-200">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                  Entradas (caixa)
                </p>
                <p className="font-display text-lg font-semibold text-emerald-700">
                  {formatCurrency(stats!.cashSummary.totalIncome)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">vendas líquidas</p>
              </div>
              <div className="card py-4 bg-rose-50 border-rose-200">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                  Saídas (caixa)
                </p>
                <p className="font-display text-lg font-semibold text-rose-700">
                  {formatCurrency(stats!.cashSummary.totalExpenses)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">despesas + custos de feira</p>
              </div>
              <div
                className={`card py-4 ${stats!.cashSummary.currentBalance >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}
              >
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Saldo atual</p>
                <p
                  className={`font-display text-lg font-semibold ${stats!.cashSummary.currentBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}
                >
                  {formatCurrency(stats!.cashSummary.currentBalance)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">abertura + entradas − saídas</p>
              </div>
            </div>
          )}

          {/* Gráfico de evolução + Insights */}
          <div className="grid grid-cols-3 gap-5 mb-5">
            <div className="card col-span-2">
              <p className="text-sm font-semibold text-gray-700 mb-4">
                Faturamento e lucro por mês
              </p>
              {stats!.revenueByMonth.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  Sem dados suficientes para o gráfico.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart
                    data={stats!.revenueByMonth.map((d) => ({
                      ...d,
                      month: formatMonth(d.month)
                    }))}
                  >
                    <defs>
                      <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#e44d8a" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#e44d8a" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5ede6" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      labelStyle={{ color: '#374151' }}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #edddd2',
                        fontSize: 12
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name="Faturamento"
                      stroke="#e44d8a"
                      strokeWidth={2}
                      fill="url(#gradRevenue)"
                    />
                    <Area
                      type="monotone"
                      dataKey="profit"
                      name="Lucro"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#gradProfit)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
            <InsightsPanel stats={stats!} />
          </div>

          {/* Categoria + Canal */}
          <div className="grid grid-cols-2 gap-5 mb-5">
            <div className="card">
              <p className="text-sm font-semibold text-gray-700 mb-4">
                Faturamento por categoria
              </p>
              {stats!.salesByCategory.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Sem dados.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={stats!.salesByCategory}
                      dataKey="revenue"
                      nameKey="category"
                      cx="50%"
                      cy="45%"
                      outerRadius={75}
                      innerRadius={40}
                      paddingAngle={3}
                    >
                      {stats!.salesByCategory.map((entry, idx) => (
                        <Cell
                          key={entry.category}
                          fill={
                            CATEGORY_COLORS[entry.category] ??
                            CATEGORY_FALLBACK_COLORS[idx % CATEGORY_FALLBACK_COLORS.length]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #edddd2',
                        fontSize: 12
                      }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 11, color: '#6b7280' }}
                      formatter={(value, entry: any) =>
                        `${value} (${entry.payload.quantity} un.)`
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card">
              <p className="text-sm font-semibold text-gray-700 mb-4">Vendas por canal</p>
              {stats!.salesByChannel.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Sem dados.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={stats!.salesByChannel}
                      dataKey="revenue"
                      nameKey="channel"
                      cx="50%"
                      cy="45%"
                      outerRadius={75}
                      innerRadius={40}
                      paddingAngle={3}
                    >
                      {stats!.salesByChannel.map((entry) => (
                        <Cell
                          key={entry.channel}
                          fill={CHANNEL_COLORS[entry.channel] ?? '#94a3b8'}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #edddd2',
                        fontSize: 12
                      }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 11, color: '#6b7280' }}
                      formatter={(value, entry: any) => `${value} (${entry.payload.count}x)`}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Fluxo de caixa */}
          {stats!.cashFlow.length > 0 && (
            <div className="card mb-5">
              <p className="text-sm font-semibold text-gray-700 mb-4">
                Fluxo de caixa — Entradas vs. Saídas por mês
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={stats!.cashFlow.map((d) => ({ ...d, month: formatMonth(d.month) }))}
                  barCategoryGap="30%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5ede6" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #edddd2',
                      fontSize: 12
                    }}
                  />
                  <Legend
                    iconType="square"
                    iconSize={10}
                    wrapperStyle={{ fontSize: 11, color: '#6b7280' }}
                  />
                  <Bar dataKey="income" name="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Saídas" fill="#f87171" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top variações + Feiras */}
          <div className="grid grid-cols-2 gap-5 mb-5">
            <div className="card">
              <p className="text-sm font-semibold text-gray-700 mb-4">
                Variações mais vendidas
              </p>
              {stats!.topVariations.length === 0 ? (
                <p className="text-sm text-gray-400">Sem dados.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={stats!.topVariations.map((v) => ({
                      name: `${v.productName} — ${v.identifier}`,
                      quantity: v.quantity,
                      revenue: v.revenue
                    }))}
                    layout="vertical"
                    margin={{ left: 8, right: 16 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#f5ede6"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      axisLine={false}
                      tickLine={false}
                      width={140}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) =>
                        name === 'revenue' ? formatCurrency(value) : `${value} un.`
                      }
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #edddd2',
                        fontSize: 12
                      }}
                    />
                    <Bar
                      dataKey="quantity"
                      name="Unidades"
                      fill="#fda4af"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card">
              <p className="text-sm font-semibold text-gray-700 mb-3">Desempenho por feira</p>
              {stats!.salesByFair.filter((f) => f.revenue > 0).length === 0 ? (
                <p className="text-sm text-gray-400">Nenhuma venda vinculada a feiras.</p>
              ) : (
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {stats!.salesByFair
                    .filter((f) => f.revenue > 0)
                    .map((fair, i) => (
                      <FairCard key={i} fair={fair} />
                    ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
