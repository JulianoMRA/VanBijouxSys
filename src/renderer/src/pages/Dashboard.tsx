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
  { label: 'Este mês',     value: 'month' },
  { label: '3 meses',      value: 'quarter' },
  { label: '6 meses',      value: 'halfyear' },
  { label: 'Este ano',     value: 'year' },
  { label: 'Tudo',         value: 'all' },
  { label: 'Personalizado',value: 'custom' }
]

const CHANNEL_COLORS: Record<string, string> = {
  Feira:     '#b5623a',
  WhatsApp:  '#5c7a3f',
  Instagram: '#a67227',
  Outro:     '#9b8f86'
}

const CATEGORY_COLORS: Record<string, string> = {
  Colar:    '#b5623a',
  Pulseira: '#a67227',
  Brinco:   '#5c7a3f',
  Tiara:    '#8c4a30',
  Pingente: '#6b5f58'
}

const CATEGORY_FALLBACK_COLORS = ['#b5623a', '#a67227', '#5c7a3f', '#8c4a30', '#6b5f58', '#9b8f86']

const TOOLTIP_STYLE = {
  borderRadius: '6px',
  border: '1px solid var(--hairline)',
  background: 'var(--surface)',
  fontSize: 12,
  color: 'var(--ink-2)'
}

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
    <div className={`kpi-delta ${isPositive ? 'up' : 'down'}`}>
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
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value${accent ? ' kpi-value-accent' : ''}`}>{value}</div>
      <DeltaBadge delta={delta ?? null} />
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  )
}

function InsightsPanel({ stats }: { stats: DashboardStats }): JSX.Element {
  const insights: Array<{ text: string; bad?: boolean; icon: JSX.Element }> = []

  if (stats.salesByChannel.length > 0) {
    const best = stats.salesByChannel[0]
    const totalRev = stats.salesByChannel.reduce((acc, c) => acc + c.revenue, 0)
    const pct = totalRev > 0 ? ((best.revenue / totalRev) * 100).toFixed(0) : '0'
    insights.push({
      text: `${best.channel} é o canal com maior faturamento (${pct}% do total)`,
      icon: <Trophy size={14} />
    })
  }

  if (stats.salesByCategory.length > 0) {
    const best = stats.salesByCategory[0]
    insights.push({
      text: `${best.category} é a categoria mais vendida (${best.quantity} unidade${best.quantity !== 1 ? 's' : ''})`,
      icon: <Gem size={14} />
    })
  }

  const outCount = stats.outOfStock.length + stats.outOfInsumos.length
  if (outCount > 0) {
    insights.push({
      text: `${outCount} item${outCount !== 1 ? 'ns' : ''} esgotado${outCount !== 1 ? 's' : ''} — atenção ao estoque!`,
      bad: true,
      icon: <AlertTriangle size={14} />
    })
  }

  const fairsWithRevenue = stats.salesByFair.filter((f) => f.revenue > 0)
  if (fairsWithRevenue.length > 0) {
    const best = fairsWithRevenue.reduce((a, b) => (a.netProfit > b.netProfit ? a : b))
    if (best.netProfit > 0) {
      insights.push({
        text: `Melhor feira: ${best.fairName} com lucro líquido de ${formatCurrency(best.netProfit)}`,
        icon: <Star size={14} />
      })
    }
  }

  if (stats.overview.totalNetRevenue > 0) {
    const margin = ((stats.overview.totalProfit / stats.overview.totalNetRevenue) * 100).toFixed(1)
    insights.push({
      text: `Margem de lucro no período: ${margin}%`,
      icon: <TrendingUp size={14} />
    })
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="section-title">Insights do período</div>
      {insights.length === 0 ? (
        <div className="empty-state" style={{ padding: '20px 0' }}>
          <p>Registre mais vendas para ver os insights.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {insights.map((ins, i) => (
            <div key={i} className={`insight-row${ins.bad ? ' bad' : ''}`}>
              <span className="insight-icon">{ins.icon}</span>
              <span>{ins.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FairCard({ fair }: { fair: DashboardStats['salesByFair'][number] }): JSX.Element {
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
    <div className="soft" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{ padding: '12px 14px', cursor: hasDailyData ? 'pointer' : 'default' }}
        onClick={hasDailyData ? () => setExpanded(!expanded) : undefined}
      >
        <div className="flex items-center justify-between gap-2">
          <div style={{ minWidth: 0 }}>
            <div className="flex items-center gap-2">
              <span className="product-name" style={{ fontSize: 13 }}>{fair.fairName}</span>
              {hasDailyData && (expanded
                ? <ChevronUp size={13} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />
                : <ChevronDown size={13} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />
              )}
            </div>
            <div className="text-xs text-dim mt-1">{dateLabel}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div className="price-main" style={{ fontSize: 13 }}>{formatCurrency(fair.revenue)}</div>
            <div
              className="text-xs mt-1"
              style={{ color: fair.netProfit >= 0 ? 'var(--good)' : 'var(--bad)', fontWeight: 500 }}
            >
              Líquido: {formatCurrency(fair.netProfit)}
            </div>
          </div>
        </div>
        {totalFairCost > 0 && (
          <div className="text-xs text-dim mt-1">
            Custo: {formatCurrency(totalFairCost)}
            {fair.additionalCosts > 0 &&
              ` (inscrição ${formatCurrency(fair.enrollmentCost)} + outros ${formatCurrency(fair.additionalCosts)})`}
            {' '}· Lucro bruto: {formatCurrency(fair.profit)}
          </div>
        )}
        {hasDailyData && bestDay && !expanded && (
          <div className="text-xs text-dim mt-1">
            Melhor dia: {formatDay(bestDay.day)} ({formatCurrency(bestDay.revenue)}) · clique para ver
          </div>
        )}
      </div>

      {hasDailyData && expanded && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--hairline-soft)' }}>
          <div className="alerts-section-label" style={{ paddingTop: 12 }}>Vendas por dia</div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart
              data={fair.dailyBreakdown.map((d) => ({ ...d, dayLabel: formatDay(d.day) }))}
              barCategoryGap="35%"
            >
              <CartesianGrid strokeDasharray="2 3" stroke="var(--hairline-soft)" />
              <XAxis dataKey="dayLabel" tick={{ fontSize: 10, fill: 'var(--ink-4)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--ink-4)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} width={48} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="revenue" name="Faturamento" radius={[3, 3, 0, 0]}>
                {fair.dailyBreakdown.map((d) => (
                  <Cell key={d.day} fill={d.day === bestDay?.day ? 'var(--accent)' : 'var(--accent-soft)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fair.dailyBreakdown.map((d) => (
              <div key={d.day} className="flex justify-between items-center text-xs">
                <span style={{ color: d.day === bestDay?.day ? 'var(--accent)' : 'var(--ink-3)', fontWeight: d.day === bestDay?.day ? 500 : 400 }}>
                  {formatDay(d.day)}{d.day === bestDay?.day && <span style={{ color: 'var(--ink-4)', marginLeft: 4 }}>(melhor dia)</span>}
                </span>
                <span style={{ color: d.day === bestDay?.day ? 'var(--accent)' : 'var(--ink-2)', fontWeight: d.day === bestDay?.day ? 500 : 400 }}>
                  {formatCurrency(d.revenue)} · {d.salesCount} venda{d.salesCount !== 1 ? 's' : ''}
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
  const [errorMessage, setErrorMessage] = useState('')
  const [alertsExpanded, setAlertsExpanded] = useState(true)

  async function loadStats(p: Period, from?: string, to?: string): Promise<void> {
    if (p === 'custom' && (!from || !to)) return
    setLoading(true)
    try {
      const data = await window.api.dashboard.getStats({ period: p, customFrom: from, customTo: to })
      setStats(data)
    } catch (err) {
      setErrorMessage('Erro ao carregar estatísticas.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadStats(period) }, [period])

  useEffect(() => {
    if (period === 'custom' && customFrom && customTo) loadStats('custom', customFrom, customTo)
  }, [customFrom, customTo])

  const empty = !stats || stats.overview.totalSales === 0
  const prev = stats?.previousOverview
  const totalOutOfStock = (stats?.outOfStock.length ?? 0) + (stats?.outOfInsumos.length ?? 0)
  const totalLowStock   = (stats?.lowStock.length ?? 0)   + (stats?.lowInsumos.length ?? 0)

  return (
    <div>
      {/* Page header */}
      <div className="page-head">
        <div className="page-title-block">
          <div className="page-kicker">Visão geral</div>
          <h1 className="page-title">Dashboard</h1>
        </div>
        <div className="segmented">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              className={period === p.value ? 'active' : ''}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {errorMessage && (
        <div className="alert-bar" style={{ marginBottom: 16 }}>
          <span style={{ flex: 1 }}>{errorMessage}</span>
          <button className="icon-btn" onClick={() => setErrorMessage('')} style={{ fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      )}

      {period === 'custom' && (
        <div className="flex items-center gap-3 mb-5" style={{ justifyContent: 'flex-end' }}>
          <input type="date" className="input" style={{ width: 'auto' }} value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          <span style={{ color: 'var(--ink-4)', fontSize: 13 }}>até</span>
          <input type="date" className="input" style={{ width: 'auto' }} value={customTo} min={customFrom || undefined} onChange={(e) => setCustomTo(e.target.value)} />
        </div>
      )}

      {/* Alertas de estoque */}
      {stats && (totalOutOfStock > 0 || totalLowStock > 0) && (
        <div className="alerts-panel">
          <button className="alerts-head" onClick={() => setAlertsExpanded((v) => !v)}>
            <div className="flex items-center gap-3">
              {totalOutOfStock > 0 && (
                <span className="alert-tag bad">
                  <XCircle size={13} />
                  {totalOutOfStock} esgotado{totalOutOfStock !== 1 ? 's' : ''}
                </span>
              )}
              {totalLowStock > 0 && (
                <span className="alert-tag warn">
                  <AlertTriangle size={13} />
                  {totalLowStock} com estoque baixo
                </span>
              )}
              <span className="alerts-title">Alertas de estoque</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--warn)', fontWeight: 500 }}>
              {alertsExpanded ? '▲ Recolher' : '▼ Expandir'}
            </span>
          </button>

          {alertsExpanded && (
            <div className="alerts-body">
              {totalOutOfStock > 0 && (
                <div className="alerts-section">
                  <div className="alerts-section-label">Sem estoque</div>
                  <div className="chips">
                    {stats.outOfStock.map((v) => (
                      <span key={v.id} className="chip-alert bad">
                        {v.productName} — {v.identifier}
                      </span>
                    ))}
                    {stats.outOfInsumos.map((i) => (
                      <span key={i.id} className="chip-alert bad">
                        {i.name} <em>(insumo)</em>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {totalLowStock > 0 && (
                <div className="alerts-section">
                  <div className="alerts-section-label">Estoque abaixo do mínimo</div>
                  <div className="chips">
                    {stats.lowStock.map((v) => (
                      <span key={v.id} className="chip-alert warn">
                        {v.productName} — {v.identifier} <em>({v.stockQuantity}/{v.minimumStock})</em>
                      </span>
                    ))}
                    {stats.lowInsumos.map((i) => (
                      <span key={i.id} className="chip-alert warn">
                        {i.name} <em>({i.stockQuantity.toLocaleString('pt-BR')}/{i.minimumStock.toLocaleString('pt-BR')} {i.unit})</em>
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
        <div className="card flex items-center justify-center" style={{ height: 160 }}>
          <span style={{ color: 'var(--ink-4)', fontSize: 13 }}>Carregando…</span>
        </div>
      ) : empty ? (
        <div className="empty-state">
          <h3>Nenhuma venda registrada</h3>
          <p>Registre uma venda para ver as estatísticas neste período.</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid-4 mb-4">
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
              sub={stats!.overview.totalNetRevenue > 0
                ? `${((stats!.overview.totalProfit / stats!.overview.totalNetRevenue) * 100).toFixed(1)}% de margem`
                : undefined}
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

          {/* Cash summary */}
          {stats!.cashSummary && (
            <div className="cash-strip mb-5">
              <div className="cash-strip-cell">
                <div className="kpi-label">Saldo de abertura</div>
                <div className="cash-strip-value">{formatCurrency(stats!.cashSummary.openingBalance)}</div>
              </div>
              <div className="cash-strip-cell good">
                <div className="kpi-label">Entradas (caixa)</div>
                <div className="cash-strip-value">{formatCurrency(stats!.cashSummary.totalIncome)}</div>
                <div className="cash-strip-sub">vendas líquidas</div>
              </div>
              <div className="cash-strip-cell bad">
                <div className="kpi-label">Saídas (caixa)</div>
                <div className="cash-strip-value">{formatCurrency(stats!.cashSummary.totalExpenses)}</div>
                <div className="cash-strip-sub">despesas + custos de feira</div>
              </div>
              <div className={`cash-strip-cell emphasize ${stats!.cashSummary.currentBalance >= 0 ? 'good' : 'bad'}`}>
                <div className="kpi-label">Saldo atual</div>
                <div className="cash-strip-value">{formatCurrency(stats!.cashSummary.currentBalance)}</div>
                <div className="cash-strip-sub">abertura + entradas − saídas</div>
              </div>
            </div>
          )}

          {/* Evolução + Insights */}
          <div className="grid-dashboard-2-1">
            <div className="card">
              <div className="section-title">Faturamento e lucro por mês</div>
              {stats!.revenueByMonth.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px 0' }}>
                  <p>Sem dados suficientes para o gráfico.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={stats!.revenueByMonth.map((d) => ({ ...d, month: formatMonth(d.month) }))}>
                    <defs>
                      <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#b5623a" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#b5623a" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#5c7a3f" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#5c7a3f" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 3" stroke="var(--hairline-soft)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--ink-4)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--ink-4)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} labelStyle={{ color: 'var(--ink)' }} contentStyle={TOOLTIP_STYLE} />
                    <Area type="monotone" dataKey="revenue" name="Faturamento" stroke="#b5623a" strokeWidth={1.5} fill="url(#gradRevenue)" />
                    <Area type="monotone" dataKey="profit"  name="Lucro"       stroke="#5c7a3f" strokeWidth={1.5} fill="url(#gradProfit)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
            <InsightsPanel stats={stats!} />
          </div>

          {/* Categoria + Canal */}
          <div className="grid-dashboard-2">
            <div className="card">
              <div className="section-title">Faturamento por categoria</div>
              {stats!.salesByCategory.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px 0' }}><p>Sem dados.</p></div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={stats!.salesByCategory} dataKey="revenue" nameKey="category" cx="50%" cy="45%" outerRadius={75} innerRadius={40} paddingAngle={3}>
                      {stats!.salesByCategory.map((entry, idx) => (
                        <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] ?? CATEGORY_FALLBACK_COLORS[idx % CATEGORY_FALLBACK_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={TOOLTIP_STYLE} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: 'var(--ink-4)' }} formatter={(value, entry: any) => `${value} (${entry.payload.quantity} un.)`} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card">
              <div className="section-title">Vendas por canal</div>
              {stats!.salesByChannel.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px 0' }}><p>Sem dados.</p></div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={stats!.salesByChannel} dataKey="revenue" nameKey="channel" cx="50%" cy="45%" outerRadius={75} innerRadius={40} paddingAngle={3}>
                      {stats!.salesByChannel.map((entry) => (
                        <Cell key={entry.channel} fill={CHANNEL_COLORS[entry.channel] ?? '#9b8f86'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={TOOLTIP_STYLE} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: 'var(--ink-4)' }} formatter={(value, entry: any) => `${value} (${entry.payload.count}x)`} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Fluxo de caixa */}
          {stats!.cashFlow.length > 0 && (
            <div className="card mt-4">
              <div className="section-title">Fluxo de caixa — Entradas vs. Saídas por mês</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats!.cashFlow.map((d) => ({ ...d, month: formatMonth(d.month) }))} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="2 3" stroke="var(--hairline-soft)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--ink-4)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--ink-4)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={TOOLTIP_STYLE} />
                  <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 11, color: 'var(--ink-4)' }} />
                  <Bar dataKey="income"   name="Entradas" fill="#5c7a3f" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expenses" name="Saídas"   fill="#9a3a2a" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top variações + Feiras */}
          <div className="grid-dashboard-2 mt-4">
            <div className="card">
              <div className="section-title">Variações mais vendidas</div>
              {stats!.topVariations.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px 0' }}><p>Sem dados.</p></div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={stats!.topVariations.map((v) => ({ name: `${v.productName} — ${v.identifier}`, quantity: v.quantity, revenue: v.revenue }))}
                    layout="vertical"
                    margin={{ left: 8, right: 16 }}
                  >
                    <CartesianGrid strokeDasharray="2 3" stroke="var(--hairline-soft)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--ink-4)' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--ink-3)' }} axisLine={false} tickLine={false} width={140} />
                    <Tooltip formatter={(value: number, name: string) => name === 'revenue' ? formatCurrency(value) : `${value} un.`} contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="quantity" name="Unidades" fill="var(--accent-soft)" radius={[0, 3, 3, 0]}>
                      {stats!.topVariations.map((_, idx) => (
                        <Cell key={idx} fill={idx === 0 ? 'var(--accent)' : 'var(--accent-soft)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card">
              <div className="section-title">Desempenho por feira</div>
              {stats!.salesByFair.filter((f) => f.revenue > 0).length === 0 ? (
                <div className="empty-state" style={{ padding: '20px 0' }}>
                  <p>Nenhuma venda vinculada a feiras.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
                  {stats!.salesByFair.filter((f) => f.revenue > 0).map((fair, i) => (
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
