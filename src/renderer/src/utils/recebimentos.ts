import { emCentavos } from '../../../shared/dinheiro'
import { PAYMENT_LABELS } from './formas-de-pagamento'
import { formatCurrency, formatDate } from './format'
import type { PaymentMethod, Sale } from '../types'

/** RN-17. A venda fica pendente enquanto falta alguma coisa a receber. */
export function estaPendente(venda: Sale): boolean {
  return venda.amountDue > 0
}

/** O que já foi pago, antes das taxas: é esse valor que abate da dívida. */
export function totalRecebido(venda: Sale): number {
  return emCentavos(venda.payments.reduce((soma, pagamento) => soma + pagamento.amount, 0))
}

export function somaDoQueFalta(vendas: Sale[]): number {
  return emCentavos(vendas.reduce((soma, venda) => soma + venda.amountDue, 0))
}

/** "Crédito (3,49%) · taxa − R$ 3,00" ou "PIX · sem taxa". */
function formaComTaxa(forma: PaymentMethod, porcentagem: number, taxa: number): string {
  const rotulo = PAYMENT_LABELS[forma]
  if (porcentagem > 0) {
    return `${rotulo} (${porcentagem.toLocaleString('pt-BR')}%) · taxa − ${formatCurrency(taxa)}`
  }
  return `${rotulo} · sem taxa`
}

/**
 * A linha de pagamento de cada venda na lista: "A receber · pago R$ 50,00 · falta
 * R$ 36,00", "Recebida em 2 pagamentos · quitada em 05/10/2026" ou "PIX · sem taxa".
 */
export function descreverPagamento(venda: Sale): string {
  const { payments } = venda

  if (estaPendente(venda)) {
    if (payments.length === 0) return 'A receber · ainda não entrou no caixa'
    return `A receber · pago ${formatCurrency(totalRecebido(venda))} · falta ${formatCurrency(venda.amountDue)}`
  }
  if (payments.length === 1) {
    const [pagamento] = payments
    const forma = formaComTaxa(
      pagamento.paymentMethod,
      pagamento.feePercentage,
      pagamento.feeAmount
    )
    return `${forma} · recebido em ${formatDate(pagamento.receivedAt)}`
  }
  if (payments.length > 1) {
    const ultimo = payments[payments.length - 1]
    return `Recebida em ${payments.length} pagamentos · quitada em ${formatDate(ultimo.receivedAt)}`
  }

  const forma = formaComTaxa(venda.paymentMethod, venda.feePercentage, venda.feeAmount)
  return venda.receivedAt ? `${forma} · recebido em ${formatDate(venda.receivedAt)}` : forma
}
