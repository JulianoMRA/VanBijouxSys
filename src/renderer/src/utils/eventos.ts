/**
 * A sidebar mostra quantos insumos precisam de reposição, mas quem altera esse
 * número é a tela de Estoque. Sem um evento, o contador só se atualizaria na
 * próxima navegação — e um contador errado é pior do que nenhum.
 */
export const EVENTO_INSUMOS_ALTERADOS = 'vanbijoux:insumos-alterados'

export function avisarInsumosAlterados(): void {
  window.dispatchEvent(new Event(EVENTO_INSUMOS_ALTERADOS))
}
