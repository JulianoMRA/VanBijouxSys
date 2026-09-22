/**
 * Nome como fica gravado: sem espaço nas pontas nem repetido no meio. Texto em
 * branco vira `null`, que é a venda sem cliente.
 */
export function normalizarNomeDaCliente(texto: string | null | undefined): string | null {
  const nome = (texto ?? '').replace(/\s+/g, ' ').trim()
  return nome === '' ? null : nome
}
