/**
 * O dia no fuso da máquina, em AAAA-MM-DD. `toISOString()` converte para UTC, e no
 * horário da cliente (UTC-3) ele já devolve o dia seguinte a partir das 21h.
 */
export function diaLocal(data: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`
}
