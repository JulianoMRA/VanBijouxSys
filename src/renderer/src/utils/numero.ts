/**
 * RN-13. Leitura de números digitados no formato brasileiro.
 *
 * O `<input type="number">` do Chromium segue o idioma do Windows e erra em
 * silêncio: em português, "1.000" vira 1; em inglês, "0,5" vira 5. Os campos do
 * app passam a ser texto, lido por aqui.
 */

const SO_DIGITOS = /^\d+$/

/** "1.000", "12.500", "1.000.000": ponto separando grupos de três é milhar. */
const MILHAR_COM_PONTO = /^[1-9]\d{0,2}(\.\d{3})+$/

function parteInteiraValida(texto: string, milhar: string): boolean {
  if (SO_DIGITOS.test(texto)) return true
  const agrupado = new RegExp(`^[1-9]\\d{0,2}(\\${milhar}\\d{3})+$`)
  return agrupado.test(texto)
}

function comSeparadorDecimal(corpo: string, decimal: string, milhar: string): number | null {
  const partes = corpo.split(decimal)
  if (partes.length !== 2) return null

  const inteira = partes[0] === '' ? '0' : partes[0]
  const fracao = partes[1]
  if (!parteInteiraValida(inteira, milhar)) return null
  if (fracao !== '' && !SO_DIGITOS.test(fracao)) return null

  return Number(`${inteira.split(milhar).join('')}.${fracao || '0'}`)
}

function interpretarSemSinal(corpo: string): number | null {
  const ultimaVirgula = corpo.lastIndexOf(',')
  const ultimoPonto = corpo.lastIndexOf('.')

  if (ultimaVirgula === -1 && ultimoPonto === -1) {
    return SO_DIGITOS.test(corpo) ? Number(corpo) : null
  }
  if (ultimaVirgula !== -1 && ultimoPonto !== -1) {
    return ultimaVirgula > ultimoPonto
      ? comSeparadorDecimal(corpo, ',', '.')
      : comSeparadorDecimal(corpo, '.', ',')
  }
  if (ultimaVirgula !== -1) return comSeparadorDecimal(corpo, ',', '.')
  if (MILHAR_COM_PONTO.test(corpo)) return Number(corpo.split('.').join(''))
  return comSeparadorDecimal(corpo, '.', ',')
}

/** Número digitado, ou `null` quando o texto não é um número. */
export function interpretarNumero(texto: string): number | null {
  const limpo = texto.replace(/\s/g, '')
  if (limpo === '') return null

  const negativo = limpo.startsWith('-')
  const valor = interpretarSemSinal(negativo ? limpo.slice(1) : limpo)
  if (valor === null) return null
  return negativo ? -valor : valor
}

/**
 * Valor para preencher um campo. Sem agrupamento de milhar e sempre com vírgula:
 * `String(1.125)` daria "1.125", que o campo leria como mil cento e vinte e cinco.
 */
export function formatarNumeroParaCampo(valor: number): string {
  return valor.toLocaleString('pt-BR', { useGrouping: false, maximumFractionDigits: 6 })
}

/**
 * O localStorage guarda o número no formato do JavaScript, o mesmo que o campo
 * numérico antigo gravava. Assim valores salvos antes e depois da troca se leem
 * do mesmo jeito.
 */
export function numeroParaArmazenamento(texto: string): string | null {
  const valor = interpretarNumero(texto)
  return valor === null ? null : String(valor)
}

export function numeroDoArmazenamento(salvo: string | null): string {
  if (salvo === null || salvo.trim() === '') return ''
  const valor = Number(salvo)
  return Number.isFinite(valor) ? formatarNumeroParaCampo(valor) : ''
}
