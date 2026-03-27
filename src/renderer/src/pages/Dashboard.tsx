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
import type { DashboardStats } from '../types'

type Period = 'month' | 'quarter' | 'halfyear' | 'year' | 'all'

const PERIODS: { label: string; value: Period }[] = [
  { label: 'Este mês', value: 'month' },
  { label: '3 meses', value: 'quarter' },
  { label: '6 meses', value: 'halfyear' },
  { label: 'Este ano', value: 'year' },
  { label: 'Tudo', value: 'all' }
]

const CHANNEL_COLORS: Record<string, string> = {
  Feira: '#e44d8a',
  WhatsApp: '#10b981',
  Instagram: '#f59e0b',
  Outro: '#94a3b8'
}

function fromDateForPeriod(period: Period): string | null {
  const now = new Date()
  if (period === 'all') return null
  if (period === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  }
  if (period === 'quarter') {
    const d = new Date(now)
    d.setMonth(d.getMonth() - 3)
    return d.toISOString().slice(0, 10)
  }
  if (period === 'halfyear') {
    const d = new Date(now)
    d.setMonth(d.getMonth() - 6)
    return d.toISOString().slice(0, 10)
  }
  return new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10)
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatMonth(ym: string): string {
  const [year, month] = ym.split('-')
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${names[parseInt(month) - 1]}/${year.slice(2)}`
}

function StatCard({
  label,
  value,
  sub,
  accent
}: {
  label: string
  value: string
  sub?: string
  accent?: boolean
}): JSX.Element {
  return (
    <div className="card py-5">
      <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">{label}</p>
      <p className={`font-display text-2xl font-bold ${accent ? 'text-blush-600' : 'text-gray-800'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function Dashboard(): JSX.Element {
  const [period, setPeriod] = useState<Period>('month')
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadStats(p: Period): Promise<void> {
    setLoading(true)
    const data = await window.api.dashboard.getStats(fromDateForPeriod(p))
    setStats(data)
    setLoading(false)
  }

  useEffect(() => {
    loadStats(period)
  }, [period])

  const empty = !stats || stats.overview.totalSales === 0

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl font-semibold text-gray-800">Dashboard</h2>
        <div className="flex gap-1.5">
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

      {/* Alertas de estoque */}
      {stats && (stats.lowStock.length > 0 || stats.lowInsumos.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-5 space-y-3">
          {stats.lowStock.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-amber-800 mb-2">
                ⚠ {stats.lowStock.length} {stats.lowStock.length !== 1 ? 'variações' : 'variação'} com estoque baixo
              </p>
              <div className="flex flex-wrap gap-2">
                {stats.lowStock.map((v) => (
                  <span key={v.id} className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
                    {v.productName} — {v.identifier} ({v.stockQuantity}/{v.minimumStock})
                  </span>
                ))}
              </div>
            </div>
          )}
          {stats.lowInsumos.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-amber-800 mb-2">
                ⚠ {stats.lowInsumos.length} insumo{stats.lowInsumos.length !== 1 ? 's' : ''} com estoque baixo
              </p>
              <div className="flex flex-wrap gap-2">
                {stats.lowInsumos.map((i) => (
                  <span key={i.id} className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
                    {i.name} ({i.stockQuantity.toLocaleString('pt-BR')}/{i.minimumStock.toLocaleString('pt-BR')} {i.unit})
                  </span>
                ))}
              </div>
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
          <p className="text-gray-400 text-xs mt-1">Registre uma venda para ver as estatísticas.</p>
        </div>
      ) : (
        <>
          {/* Cards de visão geral */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <StatCard
              label="Faturamento bruto"
              value={formatCurrency(stats!.overview.totalRevenue)}
              sub={`líquido ${formatCurrency(stats!.overview.totalNetRevenue)} · ${stats!.overview.totalSales} venda${stats!.overview.totalSales !== 1 ? 's' : ''}`}
              accent
            />
            <StatCard
              label="Lucro"
              value={formatCurrency(stats!.overview.totalProfit)}
              sub={
                stats!.overview.totalNetRevenue > 0
                  ? `${((stats!.overview.totalProfit / stats!.overview.totalNetRevenue) * 100).toFixed(1)}% de margem`
                  : undefined
              }
            />
            <StatCard
              label="Ticket médio"
              value={formatCurrency(stats!.overview.avgTicket)}
              sub="por venda"
            />
            <StatCard
              label="Custo total"
              value={formatCurrency(stats!.overview.totalCost)}
              sub="materiais + produção"
            />
          </div>

          {/* Card de saldo do caixa */}
          {stats!.cashSummary && (
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="card py-4 bg-cream-50">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Saldo de abertura</p>
                <p className="font-display text-lg font-semibold text-gray-600">{formatCurrency(stats!.cashSummary.openingBalance)}</p>
              </div>
              <div className="card py-4 bg-emerald-50 border-emerald-200">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Entradas (caixa)</p>
                <p className="font-display text-lg font-semibold text-emerald-700">{formatCurrency(stats!.cashSummary.totalIncome)}</p>
                <p className="text-xs text-gray-400 mt-0.5">vendas líquidas</p>
              </div>
              <div className="card py-4 bg-rose-50 border-rose-200">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Saídas (caixa)</p>
                <p className="font-display text-lg font-semibold text-rose-700">{formatCurrency(stats!.cashSummary.totalExpenses)}</p>
                <p className="text-xs text-gray-400 mt-0.5">despesas registradas</p>
              </div>
              <div className={`card py-4 ${stats!.cashSummary.currentBalance >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Saldo atual</p>
                <p className={`font-display text-lg font-semibold ${stats!.cashSummary.currentBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {formatCurrency(stats!.cashSummary.currentBalance)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">abertura + entradas − saídas</p>
              </div>
            </div>
          )}

          {/* Gráfico de receita por mês + canal */}
          <div className="grid grid-cols-3 gap-5 mb-5">
            {/* Receita ao longo do tempo */}
            <div className="card col-span-2">
              <p className="text-sm font-semibold text-gray-700 mb-4">Faturamento e lucro por mês</p>
              {stats!.revenueByMonth.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Sem dados suficientes para o gráfico.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={stats!.revenueByMonth.map((d) => ({ ...d, month: formatMonth(d.month) }))}>
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
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} labelStyle={{ color: '#374151' }} contentStyle={{ borderRadius: '12px', border: '1px solid #edddd2', fontSize: 12 }} />
                    <Area type="monotone" dataKey="revenue" name="Faturamento" stroke="#e44d8a" strokeWidth={2} fill="url(#gradRevenue)" />
                    <Area type="monotone" dataKey="profit" name="Lucro" stroke="#10b981" strokeWidth={2} fill="url(#gradProfit)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Por canal */}
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
                        <Cell key={entry.channel} fill={CHANNEL_COLORS[entry.channel] ?? '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: '12px', border: '1px solid #edddd2', fontSize: 12 }} />
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

          {/* Gráfico de fluxo de caixa */}
          {stats!.cashFlow.length > 0 && (
            <div className="card mb-5">
              <p className="text-sm font-semibold text-gray-700 mb-4">Fluxo de caixa — Entradas vs. Saídas por mês</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats!.cashFlow.map((d) => ({ ...d, month: formatMonth(d.month) }))} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5ede6" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: '12px', border: '1px solid #edddd2', fontSize: 12 }} />
                  <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 11, color: '#6b7280' }} />
                  <Bar dataKey="income" name="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Saídas" fill="#f87171" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top variações + Feiras */}
          <div className="grid grid-cols-2 gap-5 mb-5">
            {/* Mais vendidas */}
            <div className="card">
              <p className="text-sm font-semibold text-gray-700 mb-4">Variações mais vendidas</p>
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5ede6" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} width={140} />
                    <Tooltip formatter={(value: number, name: string) => name === 'revenue' ? formatCurrency(value) : `${value} un.`} contentStyle={{ borderRadius: '12px', border: '1px solid #edddd2', fontSize: 12 }} />
                    <Bar dataKey="quantity" name="Unidades" fill="#fda4af" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Por feira */}
            <div className="card">
              <p className="text-sm font-semibold text-gray-700 mb-3">Desempenho por feira</p>
              {stats!.salesByFair.filter((f) => f.revenue > 0).length === 0 ? (
                <p className="text-sm text-gray-400">Nenhuma venda vinculada a feiras.</p>
              ) : (
                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  {stats!.salesByFair
                    .filter((f) => f.revenue > 0)
                    .map((fair, i) => {
                      const dateLabel = fair.endDate && fair.endDate !== fair.date
                        ? `${fair.date.slice(8, 10)} a ${fair.endDate.slice(8, 10)}/${fair.date.slice(5, 7)}/${fair.date.slice(0, 4)}`
                        : `${fair.date.slice(8, 10)}/${fair.date.slice(5, 7)}/${fair.date.slice(0, 4)}`
                      const totalFairCost = fair.enrollmentCost + fair.additionalCosts
                      return (
                        <div key={i} className="bg-cream-50 rounded-xl px-4 py-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{fair.fairName}</p>
                              <p className="text-xs text-gray-400">{dateLabel}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-semibold text-gray-800">{formatCurrency(fair.revenue)}</p>
                              <p className={`text-xs font-medium ${fair.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                Líquido: {formatCurrency(fair.netProfit)}
                              </p>
                            </div>
                          </div>
                          {totalFairCost > 0 && (
                            <p className="text-xs text-gray-400 mt-1">
                              Custo feira: {formatCurrency(totalFairCost)}
                              {fair.additionalCosts > 0 && ` (inscrição ${formatCurrency(fair.enrollmentCost)} + outros ${formatCurrency(fair.additionalCosts)})`}
                              {' '}· Lucro bruto: {formatCurrency(fair.profit)}
                            </p>
                          )}
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
