/**
 * Arredonda para centavos. Soma de ponto flutuante deixa resíduo (3 × 28,67 dá
 * 86,00999999999999), e "quanto falta receber" precisa dar zero exato quando a
 * conta fecha. O `+ 0` transforma em zero o -0 que o arredondamento produz.
 */
export function emCentavos(valor: number): number {
  return Math.round(valor * 100) / 100 + 0
}

/** "R$ 36,00", para as mensagens que o processo principal escreve. */
export function emReais(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
