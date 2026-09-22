import { eq, sql, type SQL } from 'drizzle-orm'
import type { ConexaoBanco } from '../database/conexao'
import { insumos, productVariations, variationInsumos } from '../database/schema'
import { ErroDeNegocio } from '../ipc/mensagens'

type Db = ConexaoBanco['db']

/**
 * RN-03, RN-04. Novo saldo de insumo depois de somar `variacao` (negativa para baixa).
 *
 * O saldo pode ficar negativo de propósito: negativo quer dizer que faltou
 * registrar uma compra, ou que a receita pede mais do que se usa. Truncar em
 * zero descartava essa diferença e fazia o resultado depender da ordem em que
 * compra e produção eram lançadas.
 *
 * Insumo é fracionário (0,1 g de cola), e somas de ponto flutuante deixam
 * resíduo: 0,3 - 3 x 0,1 dá -2,8e-17, que a tela mostra como "-0" e o alerta de
 * esgotado não reconhece. Quatro casas bastam para cm, g e unidade; o `+ 0.0`
 * transforma o -0,0 do arredondamento em zero.
 */
export function saldoArredondado(variacao: number): SQL {
  return sql`ROUND(stock_quantity + ${variacao}, 4) + 0.0`
}

/** RN-06. Estoque de peças digitado: inteiro e não negativo. */
export function validarEstoqueDePecas(quantidade: number): void {
  if (!Number.isInteger(quantidade) || quantidade < 0) {
    throw new ErroDeNegocio('Quantidade em estoque inválida.')
  }
}

/**
 * RN-01. Única escrita de estoque de peças fora das vendas. `pecas` negativo retira.
 * Com `acompanharInsumos`, a receita segue o movimento: peça a mais consome
 * insumo, peça a menos devolve. Precisa rodar dentro de uma transação.
 */
export function movimentarEstoqueDaVariacao(
  db: Db,
  variationId: number,
  pecas: number,
  acompanharInsumos: boolean
): void {
  if (pecas === 0) return

  db.update(productVariations)
    .set({ stockQuantity: sql`stock_quantity + ${pecas}` })
    .where(eq(productVariations.id, variationId))
    .run()

  if (!acompanharInsumos) return

  const receita = db
    .select()
    .from(variationInsumos)
    .where(eq(variationInsumos.variationId, variationId))
    .all()
  for (const item of receita) {
    db.update(insumos)
      .set({ stockQuantity: saldoArredondado(-item.quantity * pecas) })
      .where(eq(insumos.id, item.insumoId))
      .run()
  }
}
