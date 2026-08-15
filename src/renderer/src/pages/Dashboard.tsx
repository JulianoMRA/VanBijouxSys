import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { formatCurrency } from '../utils/format'
import { buildInsights, calcDelta, formatDay, formatMonth } from '../utils/dashboard-calculations'
import type { DashboardStats } from '../types'

type Period = 'month' | 'quarter' | 'halfyear' | 'year' | 'all' | 'custom'

const PERIODS: { label: string; value: Period }[] = [
  { label: 'Mês', value: 'month' },
  { label: '3M', value: 'quarter' },
  { label: '6M', value: 'halfyear' },
  { label: 'Ano', value: 'year' },
  { label: 'Tudo', value: 'all' },
  { label: 'Personalizado', value: 'custom' }
]

const PERIOD_CAPTIONS: Record<Period, string> = {
  month: 'Este mês',
  quarter: 'Últimos 3 meses',
  halfyear: 'Últimos 6 meses',
  year: 'Este ano',
  all: 'Todo o período',
  custom: 'Período personalizado'
}

const CHANNEL_COLORS: Record<string, string> = {
  Feira: '#8b3a5c',
  WhatsApp: '#c9a15f',
  Instagram: '#8a7a7d',
  Outro: '#d5c8c2'
}

const SERIES_COLORS = ['#8b3a5c', '#c9a15f', '#8a7a7d', '#5d8f76', '#a4718a', '#d5c8c2']

const TOOLTIP_STYLE = {
  borderRadius: '10px',
  border: '1px solid #eae1dc',
  background: '#fffdfc',
  fontSize: 12,
  color: '#241419'
}

const AXIS_TICK = { fontSize: 11, fill: '#b09b96' }

function tituloDoPeriodo(period: Period): string {
  if (period !== 'month') return 'Visão do período'
  return 'Visão do mês'
}

function etiquetaDoPeriodo(period: Period): string {
  if (period !== 'month') return PERIOD_CAPTIONS[period]
  const agora = new Date()
  const mes = agora.toLocaleDateString('pt-BR', { month: 'long' })
  return `${mes} ${agora.getFullYear()}`
}

function Delta({ valor, comFundo = false }: { valor: number | null; comFundo?: boolean }) {
  if (valor === null) return null
  const positivo = valor >= 0
  const cor = positivo ? 'text-sage-500' : 'text-clay-500'
  const fundo = comFundo
    ? `${positivo ? 'bg-sage-100' : 'bg-clay-100'} px-2 py-[3px] rounded-md`
    : ''
  return (
    <span className={`text-aux font-semibold ${cor} ${fundo}`} title="vs. período anterior">
      {positivo ? '↑' : '↓'} {Math.abs(valor).toFixed(1)}%
    </span>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }): JSX.Element {
  return <p className="text-sm font-semibold text-ink-900 mb-4">{children}</p>
}

function EmptyHint({ children }: { children: React.ReactNode }): JSX.Element {
  return <p className="text-body text-ink-300 py-6 text-center">{children}</p>
}

function AlertStrip({ stats }: { stats: DashboardStats }): JSX.Element | null {
  const [aberto, setAberto] = useState(false)

  const esgotados = stats.outOfStock.length + stats.outOfInsumos.length
  const baixos = stats.lowStock.length + stats.lowInsumos.length
  if (esgotados === 0 && baixos === 0) return null

  const criticos = new Set([
    ...stats.outOfStock.map((v) => `${v.productName}|${v.identifier}`),
    ...stats.lowStock.map((v) => `${v.productName}|${v.identifier}`)
  ])
  // A variação mais vendida que está na lista dá o motivo para olhar agora.
  const destaque = stats.topVariations.find((v) => criticos.has(`${v.productName}|${v.identifier}`))

  const partes: string[] = []
  if (esgotados > 0) partes.push(`${esgotados} esgotado${esgotados !== 1 ? 's' : ''}`)
  if (baixos > 0) partes.push(`${baixos} com estoque baixo`)

  return (
    <div className="mb-[22px] rounded-[11px] border border-honey-200 bg-honey-100">
      <button
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center gap-3.5 px-4 py-3 text-left"
      >
        <span className="shrink-0 rounded-md bg-honey-200 px-2.5 py-[3px] text-micro font-bold text-honey-500">
          ATENÇÃO
        </span>
        <p className="text-body text-honey-600">
          <strong className="font-semibold">{partes.join(' e ')}</strong>
          {destaque &&
            ` — ${destaque.productName} ${destaque.identifier} é a mais vendida da lista.`}
        </p>
        <span className="ml-auto flex shrink-0 items-center gap-1 text-body font-semibold text-wine-500">
          {aberto ? 'Recolher' : 'Ver itens'}
          {aberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {aberto && (
        <div className="space-y-3.5 border-t border-honey-200 px-4 py-3.5">
          {esgotados > 0 && (
            <div>
              <p className="label mb-2 text-honey-500">Sem estoque</p>
              <div className="flex flex-wrap gap-2">
                {stats.outOfStock.map((v) => (
                  <span
                    key={v.id}
                    className="rounded-md bg-clay-100 px-2 py-1 text-micro font-medium text-clay-500"
                  >
                    {v.productName} — {v.identifier}
                  </span>
                ))}
                {stats.outOfInsumos.map((i) => (
                  <span
                    key={i.id}
                    className="rounded-md bg-clay-100 px-2 py-1 text-micro font-medium text-clay-500"
                  >
                    {i.name} (insumo)
                  </span>
                ))}
              </div>
            </div>
          )}
          {baixos > 0 && (
            <div>
              <p className="label mb-2 text-honey-500">Abaixo do mínimo</p>
              <div className="flex flex-wrap gap-2">
                {stats.lowStock.map((v) => (
                  <span
                    key={v.id}
                    className="rounded-md bg-bone-50 px-2 py-1 text-micro text-honey-600"
                  >
                    {v.productName} — {v.identifier} ({v.stockQuantity}/{v.minimumStock})
                  </span>
                ))}
                {stats.lowInsumos.map((i) => (
                  <span
                    key={i.id}
                    className="rounded-md bg-bone-50 px-2 py-1 text-micro text-honey-600"
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
  )
}

function DistribuicaoCard({
  titulo,
  itens
}: {
  titulo: string
  itens: { nome: string; valor: string; pct: number; cor: string }[]
}): JSX.Element {
  return (
    <div className="card">
      <SectionTitle>{titulo}</SectionTitle>
      {itens.length === 0 ? (
        <EmptyHint>Sem dados no período.</EmptyHint>
      ) : (
        <div className="flex flex-col gap-3.5">
          {itens.map((item) => (
            <div key={item.nome}>
              <div className="mb-1.5 flex justify-between text-micro">
                <span className="font-medium text-ink-800">{item.nome}</span>
                <span className="tabular-nums text-ink-400">{item.valor}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-bone-300">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${item.pct}%`, background: item.cor }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FairCard({ fair }: { fair: DashboardStats['salesByFair'][number] }): JSX.Element {
  const [expandido, setExpandido] = useState(false)

  const periodo =
    fair.endDate && fair.endDate !== fair.date
      ? `${fair.date.slice(8, 10)} a ${fair.endDate.slice(8, 10)}/${fair.date.slice(5, 7)}/${fair.date.slice(0, 4)}`
      : `${fair.date.slice(8, 10)}/${fair.date.slice(5, 7)}/${fair.date.slice(0, 4)}`

  const custoTotal = fair.enrollmentCost + fair.additionalCosts
  const temDetalhe = fair.dailyBreakdown.length > 1
  const melhorDia =
    fair.dailyBreakdown.length > 0
      ? fair.dailyBreakdown.reduce((a, b) => (a.revenue > b.revenue ? a : b))
      : null

  return (
    <div className="overflow-hidden rounded-control border border-bone-300 bg-bone-100">
      <div
        className={`px-4 py-3 ${temDetalhe ? 'cursor-pointer hover:bg-bone-200 transition-colors' : ''}`}
        onClick={temDetalhe ? () => setExpandido(!expandido) : undefined}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-body font-medium text-ink-900">{fair.fairName}</p>
              {temDetalhe &&
                (expandido ? (
                  <ChevronUp size={13} className="shrink-0 text-ink-200" />
                ) : (
                  <ChevronDown size={13} className="shrink-0 text-ink-200" />
                ))}
            </div>
            <p className="text-micro text-ink-300">{periodo}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-body font-semibold tabular-nums text-ink-900">
              {formatCurrency(fair.revenue)}
            </p>
            <p
              className={`text-micro font-medium tabular-nums ${fair.netProfit >= 0 ? 'text-sage-500' : 'text-clay-500'}`}
            >
              Líquido: {formatCurrency(fair.netProfit)}
            </p>
          </div>
        </div>
        {custoTotal > 0 && (
          <p className="mt-1 text-micro text-ink-300">
            Custo feira: {formatCurrency(custoTotal)}
            {fair.additionalCosts > 0 &&
              ` (inscrição ${formatCurrency(fair.enrollmentCost)} + outros ${formatCurrency(fair.additionalCosts)})`}{' '}
            · Lucro bruto: {formatCurrency(fair.profit)}
          </p>
        )}
        {temDetalhe && melhorDia && !expandido && (
          <p className="mt-0.5 text-micro text-ink-300">
            Melhor dia: {formatDay(melhorDia.day)} ({formatCurrency(melhorDia.revenue)}) · clique
            para ver a distribuição
          </p>
        )}
      </div>

      {temDetalhe && expandido && (
        <div className="border-t border-bone-300 px-4 pb-4">
          <p className="label mb-3 mt-3">Vendas por dia</p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart
              data={fair.dailyBreakdown.map((d) => ({ ...d, dayLabel: formatDay(d.day) }))}
              barCategoryGap="35%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f2ebe7" vertical={false} />
              <XAxis dataKey="dayLabel" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `R$${v}`}
                width={48}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={TOOLTIP_STYLE}
                cursor={{ fill: '#f2ebe7' }}
              />
              <Bar dataKey="revenue" name="Faturamento" radius={[4, 4, 0, 0]}>
                {fair.dailyBreakdown.map((d) => (
                  <Cell key={d.day} fill={d.day === melhorDia?.day ? '#8b3a5c' : '#dcbccb'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
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
  const [erro, setErro] = useState('')

  async function loadStats(p: Period, from?: string, to?: string): Promise<void> {
    if (p === 'custom' && (!from || !to)) return
    setLoading(true)
    setErro('')
    try {
      const data = await window.api.dashboard.getStats({
        period: p,
        customFrom: from,
        customTo: to
      })
      setStats(data)
    } catch (err) {
      setStats(null)
      setErro(err instanceof Error ? err.message : 'Não foi possível carregar o dashboard.')
    } finally {
      setLoading(false)
    }
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
  const margem =
    stats && stats.overview.totalNetRevenue > 0
      ? (stats.overview.totalProfit / stats.overview.totalNetRevenue) * 100
      : null

  const canalTotal = stats?.salesByChannel.reduce((acc, c) => acc + c.revenue, 0) ?? 0
  const categoriaTotal = stats?.salesByCategory.reduce((acc, c) => acc + c.revenue, 0) ?? 0
  const insights = stats ? buildInsights(stats) : []

  return (
    <div className="pb-10">
      <div className="sticky top-0 z-10 border-b border-bone-400 bg-bone-200 px-8 pb-3.5 pt-[26px]">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="label mb-1">{etiquetaDoPeriodo(period)}</p>
            <h2 className="font-display text-[30px] font-semibold leading-none text-ink-900">
              {tituloDoPeriodo(period)}
            </h2>
          </div>
          <div className="flex gap-0.5 rounded-control bg-bone-400 p-[3px]">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`rounded-[7px] px-3 py-[5px] text-aux transition-colors ${
                  period === p.value
                    ? 'bg-bone-50 font-semibold text-ink-900 shadow-raised'
                    : 'font-medium text-ink-500 hover:text-ink-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {period === 'custom' && (
          <div className="mt-3 flex items-center justify-end gap-2">
            <input
              type="date"
              className="input w-auto"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
            <span className="text-body text-ink-400">até</span>
            <input
              type="date"
              className="input w-auto"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="px-8 pt-[22px]">
        {erro && (
          <div className="mb-[22px] flex items-start justify-between gap-3 rounded-[11px] border border-bone-500 bg-clay-100 px-4 py-3">
            <p className="text-body text-clay-600">{erro}</p>
            <button
              onClick={() => setErro('')}
              className="shrink-0 text-lg leading-none text-clay-500 hover:text-clay-600"
            >
              ×
            </button>
          </div>
        )}

        {stats && <AlertStrip stats={stats} />}

        {loading ? (
          <div className="card flex h-40 items-center justify-center">
            <p className="text-body text-ink-300">Carregando…</p>
          </div>
        ) : empty ? (
          <div className="card flex h-48 flex-col items-center justify-center text-center">
            <p className="text-body text-ink-600">Nenhuma venda registrada neste período.</p>
            <p className="mt-1 text-micro text-ink-300">
              Registre uma venda para ver as estatísticas.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-3.5 grid grid-cols-[1.35fr_1fr_1fr] gap-3.5">
              <div className="card">
                <p className="label">Faturamento</p>
                <p className="text-[40px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-ink-900">
                  {formatCurrency(stats!.overview.totalRevenue)}
                </p>
                <div className="mt-3 flex items-center gap-2.5">
                  <Delta
                    valor={prev ? calcDelta(stats!.overview.totalRevenue, prev.totalRevenue) : null}
                    comFundo
                  />
                  <span className="text-aux text-ink-400">
                    {stats!.overview.totalSales} venda{stats!.overview.totalSales !== 1 ? 's' : ''}{' '}
                    · líquido {formatCurrency(stats!.overview.totalNetRevenue)}
                  </span>
                </div>
              </div>

              <div className="card">
                <p className="label">Lucro</p>
                <p className="text-[30px] font-semibold leading-none tracking-[-0.025em] tabular-nums text-ink-900">
                  {formatCurrency(stats!.overview.totalProfit)}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <Delta
                    valor={prev ? calcDelta(stats!.overview.totalProfit, prev.totalProfit) : null}
                  />
                  {margem !== null && (
                    <span className="text-aux text-ink-400">margem {margem.toFixed(1)}%</span>
                  )}
                </div>
                {margem !== null && (
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-bone-300">
                    <div
                      className="h-full bg-wine-500"
                      style={{ width: `${Math.min(Math.max(margem, 0), 100)}%` }}
                    />
                  </div>
                )}
              </div>

              <div className="card flex flex-col gap-4">
                <div>
                  <p className="label">Ticket médio</p>
                  <p className="text-xl font-semibold tabular-nums text-ink-900">
                    {formatCurrency(stats!.overview.avgTicket)}{' '}
                    <Delta
                      valor={prev ? calcDelta(stats!.overview.avgTicket, prev.avgTicket) : null}
                    />
                  </p>
                </div>
                <div className="h-px bg-bone-300" />
                <div>
                  <p className="label">Custo total</p>
                  <p className="text-xl font-semibold tabular-nums text-ink-900">
                    {formatCurrency(stats!.overview.totalCost)}{' '}
                    <Delta
                      valor={prev ? calcDelta(stats!.overview.totalCost, prev.totalCost) : null}
                    />
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-3.5 grid grid-cols-3 gap-3.5">
              <div className="card col-span-2">
                <div className="mb-4 flex items-baseline justify-between">
                  <p className="text-sm font-semibold text-ink-900">Faturamento e lucro</p>
                  <div className="flex gap-3.5 text-micro text-ink-400">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm bg-wine-500" />
                      Faturamento
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm bg-gold-300" />
                      Lucro
                    </span>
                  </div>
                </div>
                {stats!.revenueByMonth.length === 0 ? (
                  <EmptyHint>Sem dados suficientes para o gráfico.</EmptyHint>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={stats!.revenueByMonth.map((d) => ({
                        ...d,
                        month: formatMonth(d.month)
                      }))}
                      barCategoryGap="28%"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f2ebe7" vertical={false} />
                      <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={AXIS_TICK}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                        width={52}
                      />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={TOOLTIP_STYLE}
                        cursor={{ fill: '#f2ebe7' }}
                      />
                      <Bar
                        dataKey="revenue"
                        name="Faturamento"
                        fill="#8b3a5c"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar dataKey="profit" name="Lucro" fill="#e2c48f" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="card">
                <SectionTitle>O que puxou o período</SectionTitle>
                {insights.length === 0 ? (
                  <EmptyHint>Registre mais vendas para ver os destaques.</EmptyHint>
                ) : (
                  <div className="flex flex-col">
                    {insights.map((ins, i, lista) => (
                      <p
                        key={ins.kind}
                        className={`py-2.5 text-body leading-snug text-ink-800 ${
                          i < lista.length - 1 ? 'border-b border-bone-300' : ''
                        }`}
                      >
                        {ins.text}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mb-3.5 grid grid-cols-3 gap-3.5">
              <div className="card">
                <SectionTitle>Caixa do período</SectionTitle>
                <div className="flex flex-col gap-2.5">
                  <div className="flex justify-between text-body text-ink-600">
                    <span>Abertura</span>
                    <span className="tabular-nums text-ink-800">
                      {formatCurrency(stats!.cashSummary.openingBalance)}
                    </span>
                  </div>
                  <div className="flex justify-between text-body text-ink-600">
                    <span>Entradas</span>
                    <span className="font-semibold tabular-nums text-sage-500">
                      + {formatCurrency(stats!.cashSummary.totalIncome)}
                    </span>
                  </div>
                  <div className="flex justify-between text-body text-ink-600">
                    <span>Saídas</span>
                    <span className="font-semibold tabular-nums text-clay-500">
                      − {formatCurrency(stats!.cashSummary.totalExpenses)}
                    </span>
                  </div>
                  <div className="h-px bg-bone-300" />
                  <div className="flex items-baseline justify-between">
                    <span className="text-body font-semibold text-ink-900">Saldo atual</span>
                    <span
                      className={`text-[19px] font-semibold tabular-nums ${
                        stats!.cashSummary.currentBalance >= 0 ? 'text-ink-900' : 'text-clay-500'
                      }`}
                    >
                      {formatCurrency(stats!.cashSummary.currentBalance)}
                    </span>
                  </div>
                  {stats!.overview.totalReceivable > 0 && (
                    <p className="rounded-control bg-honey-100 px-3 py-2 text-aux text-honey-600">
                      {formatCurrency(stats!.overview.totalReceivable)} a receber ainda não entraram
                      no caixa
                    </p>
                  )}
                </div>
              </div>

              <DistribuicaoCard
                titulo="Canais"
                itens={stats!.salesByChannel.map((c) => ({
                  nome: c.channel,
                  valor: formatCurrency(c.revenue),
                  pct: canalTotal > 0 ? (c.revenue / canalTotal) * 100 : 0,
                  cor: CHANNEL_COLORS[c.channel] ?? '#d5c8c2'
                }))}
              />

              <div className="card">
                <SectionTitle>Mais vendidas</SectionTitle>
                {stats!.topVariations.length === 0 ? (
                  <EmptyHint>Sem dados no período.</EmptyHint>
                ) : (
                  <div className="flex flex-col">
                    {stats!.topVariations.map((v, i, lista) => (
                      <div
                        key={`${v.productName}-${v.identifier}`}
                        className={`flex items-center gap-3 py-2 ${
                          i < lista.length - 1 ? 'border-b border-bone-300' : ''
                        }`}
                      >
                        <span className="w-3.5 text-micro font-bold tabular-nums text-ink-200">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-body text-ink-800">
                          {v.productName} — {v.identifier}
                        </span>
                        <span className="text-micro font-semibold tabular-nums text-ink-900">
                          {v.quantity} un.
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mb-3.5 grid grid-cols-3 gap-3.5">
              <DistribuicaoCard
                titulo="Categorias"
                itens={stats!.salesByCategory.map((c, i) => ({
                  nome: `${c.category} · ${c.quantity} un.`,
                  valor: formatCurrency(c.revenue),
                  pct: categoriaTotal > 0 ? (c.revenue / categoriaTotal) * 100 : 0,
                  cor: SERIES_COLORS[i % SERIES_COLORS.length]
                }))}
              />

              <div className="card col-span-2">
                <SectionTitle>Entradas e saídas por mês</SectionTitle>
                {stats!.cashFlow.length === 0 ? (
                  <EmptyHint>Sem movimentação registrada.</EmptyHint>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={stats!.cashFlow.map((d) => ({ ...d, month: formatMonth(d.month) }))}
                      barCategoryGap="28%"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f2ebe7" vertical={false} />
                      <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={AXIS_TICK}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                        width={52}
                      />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={TOOLTIP_STYLE}
                        cursor={{ fill: '#f2ebe7' }}
                      />
                      <Bar dataKey="income" name="Entradas" fill="#5d8f76" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" name="Saídas" fill="#c98b2e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="card">
              <SectionTitle>Desempenho por feira</SectionTitle>
              {stats!.salesByFair.filter((f) => f.revenue > 0).length === 0 ? (
                <EmptyHint>Nenhuma venda vinculada a feiras.</EmptyHint>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {stats!.salesByFair
                    .filter((f) => f.revenue > 0)
                    .map((fair, i) => (
                      <FairCard key={i} fair={fair} />
                    ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
