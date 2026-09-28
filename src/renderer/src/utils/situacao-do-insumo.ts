import type { Insumo } from '../types'

export type SituacaoDoInsumo = 'out' | 'low' | 'ok'

/**
 * RN-19. Esgotado: sem estoque, zero ou negativo, com mínimo definido ou não. Abaixo
 * do mínimo: tem estoque, mas menos que o mínimo que ela definiu. É a mesma regra das
 * consultas do Painel (`src/main/database/consultas-estoque.ts`); a tela de Estoque e
 * a barra lateral tinham cada uma a sua cópia.
 */
export function situacaoDoInsumo(
  insumo: Pick<Insumo, 'stockQuantity' | 'minimumStock'>
): SituacaoDoInsumo {
  if (insumo.stockQuantity <= 0) return 'out'
  if (insumo.minimumStock > 0 && insumo.stockQuantity < insumo.minimumStock) return 'low'
  return 'ok'
}

export function precisaDeReposicao(
  insumo: Pick<Insumo, 'stockQuantity' | 'minimumStock'>
): boolean {
  return situacaoDoInsumo(insumo) !== 'ok'
}
