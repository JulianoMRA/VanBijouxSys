import type { Sale } from '../types'
import { chaveDeBusca } from './busca-de-vendas'

/**
 * Nomes que o campo Cliente sugere: um por pessoa, na grafia da venda mais
 * recente, em ordem alfabética. "Maria" e "maria" contam como a mesma cliente,
 * para a sugestão não espalhar a cobrança de alguém em dois nomes.
 */
export function nomesDeClientes(vendas: Array<Pick<Sale, 'customerName'>>): string[] {
  const porChave = new Map<string, string>()
  for (const { customerName } of vendas) {
    if (!customerName) continue
    const chave = chaveDeBusca(customerName)
    if (!porChave.has(chave)) porChave.set(chave, customerName)
  }
  return [...porChave.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}
