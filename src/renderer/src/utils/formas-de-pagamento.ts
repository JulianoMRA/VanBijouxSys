import { interpretarNumero, numeroDoArmazenamento, numeroParaArmazenamento } from './numero'
import type { PaymentMethod, ReceivedPaymentMethod } from '../types'

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  debito: 'Débito',
  credito: 'Crédito',
  areceber: 'A receber'
}

/** As formas em que o dinheiro entra na hora: as do recebimento de uma venda a receber. */
export const FORMAS_RECEBIDAS: ReceivedPaymentMethod[] = ['dinheiro', 'pix', 'debito', 'credito']

/** As formas da venda: as mesmas, mais "a receber". */
export const FORMAS_DA_VENDA: PaymentMethod[] = [...FORMAS_RECEBIDAS, 'areceber']

const semTaxa = (forma: PaymentMethod): boolean => forma === 'dinheiro' || forma === 'areceber'

/**
 * A venda e o recebimento guardam a última taxa de cada forma na mesma chave: a taxa
 * da maquininha digitada num aparece como sugestão no outro.
 */
const chaveDaTaxa = (forma: PaymentMethod): string => `lastFee_${forma}`

/** A taxa que o campo mostra ao escolher a forma: a última usada nela. */
export function taxaSugerida(forma: PaymentMethod): string {
  if (semTaxa(forma)) return '0'
  return numeroDoArmazenamento(localStorage.getItem(chaveDaTaxa(forma)))
}

/** Guarda a taxa digitada para a próxima vez. Sem taxa, a lembrada fica como estava. */
export function lembrarTaxa(forma: PaymentMethod, taxaDigitada: string): void {
  if (semTaxa(forma) || (interpretarNumero(taxaDigitada) ?? 0) <= 0) return
  localStorage.setItem(chaveDaTaxa(forma), numeroParaArmazenamento(taxaDigitada) ?? '')
}

/** O que vem entre parênteses no rótulo do campo de taxa. */
export function dicaDaTaxa(forma: PaymentMethod): string {
  if (forma === 'pix') return 'sugerido: 0,99%'
  if (forma === 'debito') return 'sugerido: 1,69%'
  return 'variável'
}
