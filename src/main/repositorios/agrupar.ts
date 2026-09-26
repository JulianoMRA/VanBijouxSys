/**
 * Junta as linhas de uma consulta pelo registro a que pertencem, na ordem em que
 * vieram. As listagens buscam os filhos de todos os registros numa consulta só, em
 * vez de uma consulta por registro.
 */
export function agruparPor<Linha, Chave, Valor>(
  linhas: Linha[],
  chaveDe: (linha: Linha) => Chave,
  valorDe: (linha: Linha) => Valor
): Map<Chave, Valor[]> {
  const grupos = new Map<Chave, Valor[]>()
  for (const linha of linhas) {
    const chave = chaveDe(linha)
    const grupo = grupos.get(chave)
    if (grupo) grupo.push(valorDe(linha))
    else grupos.set(chave, [valorDe(linha)])
  }
  return grupos
}
