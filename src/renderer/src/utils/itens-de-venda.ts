interface ItemGravado {
  id: number
  variationId: number
  unitCost: number
}

/**
 * O custo gravado na venda é histórico: é o custo da peça na época, e é dele que
 * sai o lucro daquele mês. Editar a venda depois (para trocar a forma de
 * pagamento, por exemplo) não pode reescrevê-lo com o custo de hoje. Só item
 * novo, ou item que passou a apontar para outra variação, usa o custo atual.
 */
export function custoUnitarioDoItem(
  idDoItemGravado: number | undefined,
  variacao: { id: number; costPrice: number },
  itensGravados: ItemGravado[]
): number {
  const gravado = itensGravados.find((item) => item.id === idDoItemGravado)
  return gravado && gravado.variationId === variacao.id ? gravado.unitCost : variacao.costPrice
}
