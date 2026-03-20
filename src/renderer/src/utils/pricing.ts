/**
 * Calcula o preço de venda sugerido a partir do custo de materiais e mão de obra.
 * Fórmula: teto((materiais × 3 + mão de obra) × 1,10 + 1,00)
 */
export function calcSuggestedPrice(materials: number, labor: number): number {
  const step1 = materials * 3
  const step2 = step1 + labor
  const step3 = step2 * 1.1
  const step4 = step3 + 1
  return Math.ceil(step4)
}
