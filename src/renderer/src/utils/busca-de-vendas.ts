import type { Sale } from '../types'

/** Minúsculas e sem acento: "Márcia" e "marcia" viram a mesma chave. */
export function chaveDeBusca(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** A busca da tela de Vendas olha cliente, feira, produto e variação. Termo em branco aceita tudo. */
export function vendaCorrespondeABusca(venda: Sale, termo: string): boolean {
  const procurado = chaveDeBusca(termo.trim())
  if (!procurado) return true

  const campos = [
    venda.customerName ?? '',
    venda.fairName ?? '',
    ...venda.items.flatMap((item) => [item.productName, item.variationIdentifier])
  ]
  return campos.some((campo) => chaveDeBusca(campo).includes(procurado))
}
