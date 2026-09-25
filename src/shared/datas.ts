/**
 * O dia no fuso da máquina, em AAAA-MM-DD. `toISOString()` converte para UTC, e no
 * horário da cliente (UTC-3) ele já devolve o dia seguinte a partir das 21h.
 */
export function diaLocal(data: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`
}

/**
 * A mesma data `meses` antes, sem transbordar. `setMonth` leva 31 de maio menos três
 * meses para 3 de março, porque fevereiro não tem dia 31; aqui fica em 28 de fevereiro.
 */
export function subtrairMeses(data: Date, meses: number): Date {
  const alvo = new Date(data.getFullYear(), data.getMonth() - meses, 1)
  const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate()
  alvo.setDate(Math.min(data.getDate(), ultimoDia))
  return alvo
}
