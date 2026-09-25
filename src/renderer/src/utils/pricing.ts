/**
 * RN-09. Calcula o preço de venda sugerido a partir do custo de materiais e mão de obra.
 * Fórmula: teto((materiais × 3 + mão de obra) × 1,10 + 1,00)
 *
 * A conta é feita em centavos inteiros. Em ponto flutuante, 50 × 1,1 dá
 * 55,00000000000001, e o teto subia o preço um real em mais da metade das bases
 * redondas. A base é arredondada para centavos antes, como a tela mostra os
 * materiais: custo de insumo com quatro casas não deve decidir o real do preço.
 */
export function calcSuggestedPrice(materials: number, labor: number): number {
  const baseEmCentavos = Math.round((materials * 3 + labor) * 100)
  // × 1,10 em centavos: inteiro vezes 11, dividido por 10, no máximo meio centavo.
  const comMargemEmCentavos = (baseEmCentavos * 11) / 10
  return Math.ceil((comMargemEmCentavos + 100) / 100)
}
