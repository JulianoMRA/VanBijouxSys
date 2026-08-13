import type { CashExpense, Fair, PaymentMethod, Sale } from '../types'

export type PeriodKey = 'mes' | '3meses' | '6meses' | 'ano' | 'tudo' | 'custom'

export interface DateRange {
  startDate: string
  endDate: string
}

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  debito: 'Débito',
  credito: 'Crédito',
  areceber: 'A receber'
}

export interface FairExpenseRow {
  fairId: number
  date: string
  label: string
  sub: string
  amount: number
}

export type TransactionRow =
  | {
      kind: 'income'
      id: number
      date: string
      label: string
      sub: string
      amount: number
      netAmount: number
      feeAmount: number
      paymentMethod: PaymentMethod
    }
  | {
      kind: 'expense'
      id: number
      date: string
      label: string
      sub: string
      amount: number
      raw: CashExpense
    }
  | {
      kind: 'fair-expense'
      fairId: number
      date: string
      label: string
      sub: string
      amount: number
    }

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Data local em ISO — `toISOString()` converteria para UTC e trocaria o dia à noite. */
function toIsoDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** `today` é parâmetro para o cálculo ser determinístico em teste. */
export function getPeriodDates(period: PeriodKey, today = new Date()): DateRange | null {
  if (period === 'tudo') return null
  const endDate = toIsoDay(today)

  if (period === 'mes') {
    return { startDate: `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`, endDate }
  }
  if (period === '3meses' || period === '6meses') {
    const inicio = new Date(today)
    inicio.setMonth(inicio.getMonth() - (period === '3meses' ? 3 : 6))
    return { startDate: toIsoDay(inicio), endDate }
  }
  if (period === 'ano') {
    return { startDate: `${today.getFullYear()}-01-01`, endDate }
  }
  return null
}

export function resolveDateRange(
  period: PeriodKey,
  customStart: string,
  customEnd: string,
  today = new Date()
): DateRange | null {
  if (period === 'custom') {
    return customStart && customEnd ? { startDate: customStart, endDate: customEnd } : null
  }
  return getPeriodDates(period, today)
}

/**
 * Data que vale para o caixa: a venda fiada só entra quando é recebida, e entra
 * pela data do recebimento — não pela data em que foi vendida.
 */
export function cashDateOf(sale: Pick<Sale, 'receivedAt' | 'soldAt'>): string {
  return (sale.receivedAt ?? sale.soldAt).slice(0, 10)
}

function withinRange(day: string, range: DateRange | null): boolean {
  if (!range) return true
  return day >= range.startDate && day <= range.endDate
}

/** Vendas 'A receber' pendentes não compõem o caixa. */
export function filterCashSales(sales: Sale[], range: DateRange | null): Sale[] {
  return sales.filter((s) => s.paymentMethod !== 'areceber' && withinRange(cashDateOf(s), range))
}

export function filterExpenses(expenses: CashExpense[], range: DateRange | null): CashExpense[] {
  return expenses.filter((e) => withinRange(e.expenseDate, range))
}

export function buildFairCostSub(fair: Fair): string {
  const moeda = (valor: number): string =>
    valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const partes: string[] = []
  if (fair.enrollmentCost > 0) partes.push(`Inscrição ${moeda(fair.enrollmentCost)}`)
  for (const custo of fair.additionalCosts)
    partes.push(`${custo.description} ${moeda(custo.amount)}`)

  return partes.join(' · ') || 'Sem detalhes'
}

/** Feira sem custo nenhum não vira linha de despesa. */
export function buildFairExpenses(fairs: Fair[], range: DateRange | null): FairExpenseRow[] {
  return fairs
    .flatMap((f) => {
      const total = f.enrollmentCost + f.additionalCosts.reduce((s, c) => s + c.amount, 0)
      if (total === 0) return []
      return [
        { fairId: f.id, date: f.date, label: f.name, sub: buildFairCostSub(f), amount: total }
      ]
    })
    .filter((row) => withinRange(row.date, range))
}

export function calcCashSummary(input: {
  openingBalance: number
  sales: Sale[]
  expenses: CashExpense[]
  fairExpenses: FairExpenseRow[]
}): { totalIncome: number; totalExpenses: number; currentBalance: number } {
  const totalIncome = input.sales.reduce((s, sale) => s + sale.netAmount, 0)
  const totalExpenses =
    input.expenses.reduce((s, e) => s + e.amount, 0) +
    input.fairExpenses.reduce((s, fe) => s + fe.amount, 0)

  return {
    totalIncome,
    totalExpenses,
    currentBalance: input.openingBalance + totalIncome - totalExpenses
  }
}

function saleLabel(sale: Sale): string {
  if (sale.items.length === 1) {
    return `${sale.items[0].productName} — ${sale.items[0].variationIdentifier}`
  }
  return `${sale.items.length} itens vendidos`
}

function saleSub(sale: Sale): string {
  const feira = sale.fairName ? ` · ${sale.fairName}` : ''
  const recebido = sale.receivedAt ? ' · recebido' : ''
  return `${sale.channel}${feira} · ${PAYMENT_LABELS[sale.paymentMethod]}${recebido}`
}

export function buildTransactions(
  sales: Sale[],
  expenses: CashExpense[],
  fairExpenses: FairExpenseRow[]
): TransactionRow[] {
  const incomeRows: TransactionRow[] = sales.map((s) => ({
    kind: 'income',
    id: s.id,
    date: cashDateOf(s),
    label: saleLabel(s),
    sub: saleSub(s),
    amount: s.totalAmount,
    netAmount: s.netAmount,
    feeAmount: s.feeAmount,
    paymentMethod: s.paymentMethod
  }))

  const expenseRows: TransactionRow[] = expenses.map((e) => ({
    kind: 'expense',
    id: e.id,
    date: e.expenseDate,
    label: e.description,
    sub: e.categoryName,
    amount: e.amount,
    raw: e
  }))

  const fairRows: TransactionRow[] = fairExpenses.map((fe) => ({
    kind: 'fair-expense',
    fairId: fe.fairId,
    date: fe.date,
    label: fe.label,
    sub: fe.sub,
    amount: fe.amount
  }))

  return [...incomeRows, ...expenseRows, ...fairRows].sort((a, b) =>
    b.date !== a.date ? b.date.localeCompare(a.date) : 0
  )
}
