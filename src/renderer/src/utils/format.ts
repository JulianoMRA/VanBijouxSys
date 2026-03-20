export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
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
