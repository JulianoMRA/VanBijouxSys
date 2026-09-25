import { diaLocal, subtrairMeses } from '../../../shared/datas'
import { emCentavos } from '../../../shared/dinheiro'
import { formatCurrency, formatDate } from './format'
import type { CashExpense, Fair, PaymentMethod, Sale, SalePayment } from '../types'

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

/** `today` é parâmetro para o cálculo ser determinístico em teste. */
export function getPeriodDates(period: PeriodKey, today = new Date()): DateRange | null {
  if (period === 'tudo') return null
  const endDate = diaLocal(today)

  if (period === 'mes') {
    return { startDate: diaLocal(new Date(today.getFullYear(), today.getMonth(), 1)), endDate }
  }
  if (period === '3meses' || period === '6meses') {
    const inicio = subtrairMeses(today, period === '3meses' ? 3 : 6)
    return { startDate: diaLocal(inicio), endDate }
  }
  if (period === 'ano') {
    return { startDate: diaLocal(new Date(today.getFullYear(), 0, 1)), endDate }
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

/** Quais dias entram num recorte do caixa: os do período, ou os de antes dele. */
type FiltroDeDia = (dia: string) => boolean

const dentroDo =
  (range: DateRange | null): FiltroDeDia =>
  (dia) =>
    withinRange(dia, range)

function vendasNoCaixa(sales: Sale[], entra: FiltroDeDia): Sale[] {
  return sales.filter((s) => s.paymentMethod !== 'areceber' && entra(cashDateOf(s)))
}

/** A venda "a receber" não compõe o caixa: o que entra são os pagamentos dela. */
export function filterCashSales(sales: Sale[], range: DateRange | null): Sale[] {
  return vendasNoCaixa(sales, dentroDo(range))
}

/** Um pagamento de venda a receber, com a venda de onde ele veio. */
export interface PagamentoNoCaixa {
  sale: Sale
  payment: SalePayment
}

function pagamentosNoCaixa(sales: Sale[], entra: FiltroDeDia): PagamentoNoCaixa[] {
  return sales.flatMap((sale) =>
    sale.payments
      .filter((payment) => entra(payment.receivedAt.slice(0, 10)))
      .map((payment) => ({ sale, payment }))
  )
}

/** RN-17. Cada pagamento entra no caixa no dia em que foi recebido. */
export function filterCashPayments(sales: Sale[], range: DateRange | null): PagamentoNoCaixa[] {
  return pagamentosNoCaixa(sales, dentroDo(range))
}

function despesasNoCaixa(expenses: CashExpense[], entra: FiltroDeDia): CashExpense[] {
  return expenses.filter((e) => entra(e.expenseDate))
}

export function filterExpenses(expenses: CashExpense[], range: DateRange | null): CashExpense[] {
  return despesasNoCaixa(expenses, dentroDo(range))
}

export function buildFairCostSub(fair: Fair): string {
  const partes: string[] = []
  if (fair.enrollmentCost > 0) partes.push(`Inscrição ${formatCurrency(fair.enrollmentCost)}`)
  for (const custo of fair.additionalCosts)
    partes.push(`${custo.description} ${formatCurrency(custo.amount)}`)

  return partes.join(' · ') || 'Sem detalhes'
}

function custosDeFeira(fairs: Fair[], entra: FiltroDeDia): FairExpenseRow[] {
  return fairs
    .flatMap((f) => {
      const total = f.enrollmentCost + f.additionalCosts.reduce((s, c) => s + c.amount, 0)
      if (total === 0) return []
      return [
        { fairId: f.id, date: f.date, label: f.name, sub: buildFairCostSub(f), amount: total }
      ]
    })
    .filter((row) => entra(row.date))
}

/** Feira sem custo nenhum não vira linha de despesa. */
export function buildFairExpenses(fairs: Fair[], range: DateRange | null): FairExpenseRow[] {
  return custosDeFeira(fairs, dentroDo(range))
}

interface MovimentosDoCaixa {
  sales: Sale[]
  payments: PagamentoNoCaixa[]
  expenses: CashExpense[]
  fairExpenses: FairExpenseRow[]
}

function totais(movimentos: MovimentosDoCaixa): { entradas: number; saidas: number } {
  return {
    entradas:
      movimentos.sales.reduce((s, sale) => s + sale.netAmount, 0) +
      movimentos.payments.reduce((s, { payment }) => s + payment.netAmount, 0),
    saidas:
      movimentos.expenses.reduce((s, e) => s + e.amount, 0) +
      movimentos.fairExpenses.reduce((s, fe) => s + fe.amount, 0)
  }
}

/**
 * RN-18. O que entrou menos o que saiu antes do começo do período, pelas mesmas
 * regras do caixa; somado à abertura, é o saldo com que o período começa. Registro
 * antigo gravado sem data conta aqui: não cai em período nenhum com data, mas o
 * dinheiro dele existiu, e sem ele o saldo do mês não bateria com o de "Tudo".
 */
export function movimentoAntesDoPeriodo(
  range: DateRange | null,
  dados: { sales: Sale[]; expenses: CashExpense[]; fairs: Fair[] }
): number {
  if (!range) return 0
  const antes: FiltroDeDia = (dia) => dia < range.startDate
  const { entradas, saidas } = totais({
    sales: vendasNoCaixa(dados.sales, antes),
    payments: pagamentosNoCaixa(dados.sales, antes),
    expenses: despesasNoCaixa(dados.expenses, antes),
    fairExpenses: custosDeFeira(dados.fairs, antes)
  })
  return entradas - saidas
}

/**
 * RN-18. O saldo com que o período começa, o que entrou e saiu nele e o saldo com
 * que termina. `saldoAnterior` é o movimento de antes do período
 * (`movimentoAntesDoPeriodo`): sem ele, o "Mês" somava só a abertura cadastrada e
 * ignorava todos os meses anteriores.
 */
export function calcCashSummary(
  input: MovimentosDoCaixa & { openingBalance: number; saldoAnterior?: number }
): { startBalance: number; totalIncome: number; totalExpenses: number; currentBalance: number } {
  const { entradas, saidas } = totais(input)
  const startBalance = input.openingBalance + (input.saldoAnterior ?? 0)
  return {
    startBalance,
    totalIncome: entradas,
    totalExpenses: saidas,
    currentBalance: startBalance + entradas - saidas
  }
}

/** RN-18. Sem período, o primeiro número do caixa é a abertura cadastrada. */
export function rotuloDoSaldoInicial(range: DateRange | null): string {
  return range ? 'Saldo inicial' : 'Abertura'
}

/** RN-18. O saldo do fim do período só é o atual quando o período chega até hoje. */
export function rotuloDoSaldoFinal(range: DateRange | null, hoje = new Date()): string {
  return range && range.endDate < diaLocal(hoje)
    ? `Saldo em ${formatDate(range.endDate)}`
    : 'Saldo atual'
}

function saleLabel(sale: Sale): string {
  if (sale.items.length === 1) {
    return `${sale.items[0].productName} — ${sale.items[0].variationIdentifier}`
  }
  return `${sale.items.length} itens vendidos`
}

/** "WhatsApp · Feira do Bosque · Maria": de onde veio o dinheiro. */
function origemDaVenda(sale: Sale): string {
  const feira = sale.fairName ? ` · ${sale.fairName}` : ''
  const cliente = sale.customerName ? ` · ${sale.customerName}` : ''
  return `${sale.channel}${feira}${cliente}`
}

function saleSub(sale: Sale): string {
  const recebido = sale.receivedAt ? ' · recebido' : ''
  return `${origemDaVenda(sale)} · ${PAYMENT_LABELS[sale.paymentMethod]}${recebido}`
}

function paymentSub(sale: Sale, payment: SalePayment): string {
  const parte = payment.amount < emCentavos(sale.totalAmount) ? 'parcial' : 'recebido'
  return `${origemDaVenda(sale)} · ${PAYMENT_LABELS[payment.paymentMethod]} · ${parte}`
}

export function buildTransactions(
  sales: Sale[],
  expenses: CashExpense[],
  fairExpenses: FairExpenseRow[],
  payments: PagamentoNoCaixa[]
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

  const paymentRows: TransactionRow[] = payments.map(({ sale, payment }) => ({
    kind: 'income',
    id: payment.id,
    date: payment.receivedAt.slice(0, 10),
    label: saleLabel(sale),
    sub: paymentSub(sale, payment),
    amount: payment.amount,
    netAmount: payment.netAmount,
    feeAmount: payment.feeAmount,
    paymentMethod: payment.paymentMethod
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

  return [...incomeRows, ...paymentRows, ...expenseRows, ...fairRows].sort((a, b) =>
    b.date !== a.date ? b.date.localeCompare(a.date) : 0
  )
}
