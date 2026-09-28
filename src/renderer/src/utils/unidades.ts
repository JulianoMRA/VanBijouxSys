import type { InsumoUnit } from '../types'

/** "un." para unidade; cm e g ficam como são. */
export function abreviacaoDaUnidade(unidade: InsumoUnit): string {
  return unidade === 'unidade' ? 'un.' : unidade
}
