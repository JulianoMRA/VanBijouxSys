import { describe, expect, it } from 'vitest'
import { celulaDeCsv, montarCsvDeInsumos } from '../renderer/src/utils/csv-de-insumos'
import type { Insumo } from '../renderer/src/types'

const insumo = (dados: Partial<Insumo> = {}): Insumo => ({
  id: 1,
  name: 'Fio de nylon',
  unit: 'cm',
  costPerUnit: 0.02,
  stockQuantity: 500,
  minimumStock: 0,
  createdAt: '2026-05-01',
  archivedAt: null,
  usadoPorVariacoesAtivas: 0,
  usadoEmReceitas: 0,
  ...dados
})

describe('celulaDeCsv', () => {
  it('should_double_the_quotes_inside_a_quoted_cell', () => {
    // Com a aspa solta, a linha do insumo saía partida em colunas erradas no Excel.
    expect(celulaDeCsv('Fio "encerado"')).toBe('"Fio ""encerado"""')
  })

  it('should_keep_a_name_that_starts_like_a_formula_as_text', () => {
    // O Excel executa o conteúdo de uma célula que começa com =, +, - ou @.
    expect(celulaDeCsv('=HIPERLINK("x")')).toBe('"\'=HIPERLINK(""x"")"')
    expect(celulaDeCsv('+55 fio')).toBe('"\'+55 fio"')
    expect(celulaDeCsv('@fio')).toBe('"\'@fio"')
  })

  it('should_leave_an_ordinary_name_alone', () => {
    expect(celulaDeCsv('Miçanga dourada')).toBe('"Miçanga dourada"')
  })
})

describe('montarCsvDeInsumos', () => {
  it('should_write_the_header_and_one_line_per_insumo_with_semicolons', () => {
    const csv = montarCsvDeInsumos([insumo({ stockQuantity: 30, minimumStock: 50 })])

    expect(csv.split('\r\n')).toEqual([
      'Nome;Unidade;Estoque Atual;Estoque Mínimo;Déficit',
      '"Fio de nylon";cm;30 cm;50 cm;20 cm'
    ])
  })

  it('should_escape_the_name_of_each_insumo', () => {
    const [, linha] = montarCsvDeInsumos([
      insumo({ name: 'Fio "encerado"', unit: 'unidade' })
    ]).split('\r\n')

    expect(linha).toBe('"Fio ""encerado""";un.;500 un.;—;—')
  })
})
