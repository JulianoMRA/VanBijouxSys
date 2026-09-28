import { abreviacaoDaUnidade } from './unidades'
import type { Insumo } from '../types'

/** Primeiro caractere que faz o Excel ler a célula como fórmula. */
const COMECA_COMO_FORMULA = /^[=+\-@\t\r]/

/**
 * Texto livre numa célula de CSV para o Excel. A aspa dentro do texto vai dobrada —
 * solta, ela partia a linha em colunas erradas. Texto que começa como fórmula ganha um
 * apóstrofo na frente, senão o Excel executaria o que estivesse no nome do insumo.
 */
export function celulaDeCsv(texto: string): string {
  const seguro = COMECA_COMO_FORMULA.test(texto) ? `'${texto}` : texto
  return `"${seguro.replace(/"/g, '""')}"`
}

/** Lista de insumos para abrir no Excel: ponto e vírgula e números no jeito brasileiro. */
export function montarCsvDeInsumos(insumos: Insumo[]): string {
  const cabecalho = ['Nome', 'Unidade', 'Estoque Atual', 'Estoque Mínimo', 'Déficit']
  const linhas = insumos.map((insumo) => {
    const unidade = abreviacaoDaUnidade(insumo.unit)
    const comUnidade = (valor: number): string => `${valor.toLocaleString('pt-BR')} ${unidade}`
    const deficit =
      insumo.minimumStock > 0 && insumo.stockQuantity < insumo.minimumStock
        ? comUnidade(insumo.minimumStock - insumo.stockQuantity)
        : '—'
    return [
      celulaDeCsv(insumo.name),
      unidade,
      comUnidade(insumo.stockQuantity),
      insumo.minimumStock > 0 ? comUnidade(insumo.minimumStock) : '—',
      deficit
    ].join(';')
  })
  return [cabecalho.join(';'), ...linhas].join('\r\n')
}
