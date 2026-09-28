import { numeroDoArmazenamento, numeroParaArmazenamento } from './numero'

/**
 * A mão de obra padrão que a Precificação e o formulário da variação oferecem. As
 * duas telas leem e gravam a mesma chave: salvar numa vale na outra.
 */
const CHAVE_DA_MAO_DE_OBRA = 'pricing_default_labor_cost'

/** O padrão como texto de campo ("12,5"); vazio quando nunca foi salvo. */
export function maoDeObraPadrao(): string {
  return numeroDoArmazenamento(localStorage.getItem(CHAVE_DA_MAO_DE_OBRA))
}

export function salvarMaoDeObraPadrao(texto: string): void {
  localStorage.setItem(CHAVE_DA_MAO_DE_OBRA, numeroParaArmazenamento(texto) ?? '')
}
