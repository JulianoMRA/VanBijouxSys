export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** O que as telas mostram no lugar da data de um registro antigo gravado sem ela. */
export const SEM_DATA = 'Sem data'

const DIA_ISO = /^(\d{4})-(\d{2})-(\d{2})/

/**
 * RN-14. Dia, mês e ano de uma data do banco. A hora dos registros antigos
 * ("AAAA-MM-DD HH:MM:SS") fica de fora; os gravados sem data — vendas até a 1.13 e
 * despesas até a 1.14, quando o campo podia ficar vazio — devolvem null.
 */
export function partesDaData(texto: string): { dia: string; mes: string; ano: string } | null {
  const partes = DIA_ISO.exec(texto)
  return partes ? { ano: partes[1], mes: partes[2], dia: partes[3] } : null
}

export function formatDate(dateStr: string): string {
  const partes = partesDaData(dateStr)
  return partes ? `${partes.dia}/${partes.mes}/${partes.ano}` : SEM_DATA
}

export function formatDateRange(startDate: string, endDate: string | null): string {
  if (!endDate || endDate === startDate) return formatDate(startDate)
  const [sy, sm, sd] = startDate.split('-')
  const [ey, em, ed] = endDate.split('-')
  if (sy === ey && sm === em) return `${sd} a ${ed}/${em}/${sy}`
  return `${formatDate(startDate)} a ${formatDate(endDate)}`
}

/**
 * Calcula totais de uma lista de itens de venda.
 */
export function calcSaleTotals(
  items: { quantity: number; unitPrice: number; unitCost: number }[]
): { totalAmount: number; totalCost: number; profit: number } {
  const totalAmount = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const totalCost = items.reduce((s, i) => s + i.quantity * i.unitCost, 0)
  return { totalAmount, totalCost, profit: totalAmount - totalCost }
}
