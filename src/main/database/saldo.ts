import { sql, type SQL } from 'drizzle-orm'

/**
 * Novo saldo de insumo depois de somar `variacao` (negativa para baixa).
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
