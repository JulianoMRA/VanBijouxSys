/** Erro cuja mensagem já está escrita para a usuária final ler. */
export class ErroDeNegocio extends Error {}

const MENSAGENS_VINCULO: Record<string, string> = {
  'products:delete':
    'Este produto não pode ser excluído porque já possui vendas registradas — excluir apagaria o histórico.',
  'variations:delete':
    'Esta variação não pode ser excluída porque já foi vendida — excluir apagaria o histórico.',
  'fairs:delete': 'Esta feira não pode ser excluída porque já possui vendas registradas.',
  'insumos:delete':
    'Este insumo não pode ser excluído porque está vinculado a variações de produtos.',
  'expense-categories:delete':
    'Esta categoria não pode ser excluída porque possui despesas vinculadas. Remova as despesas antes.'
}

const MENSAGENS_DUPLICADO: Record<string, string> = {
  'expense-categories:create': 'Já existe uma categoria com esse nome.',
  'expense-categories:update': 'Já existe uma categoria com esse nome.'
}

export const MENSAGEM_GENERICA = 'Não foi possível concluir a operação. Tente novamente.'

/**
 * Traduz a falha para uma frase que a cliente entenda. Sem isso, o texto que
 * chega à tela é "SqliteError: FOREIGN KEY constraint failed".
 */
export function mensagemPara(canal: string, err: unknown): string {
  if (err instanceof ErroDeNegocio) return err.message

  const texto = err instanceof Error ? err.message : String(err)

  if (/FOREIGN KEY constraint failed/i.test(texto)) {
    return (
      MENSAGENS_VINCULO[canal] ??
      'Este item está vinculado a outros registros e não pode ser excluído.'
    )
  }
  if (/UNIQUE constraint failed/i.test(texto)) {
    return MENSAGENS_DUPLICADO[canal] ?? 'Já existe um registro com esses dados.'
  }
  return MENSAGEM_GENERICA
}
