import { describe, expect, it } from 'vitest'
import {
  formatarNumeroParaCampo,
  interpretarNumero,
  numeroDoArmazenamento,
  numeroParaArmazenamento
} from '../renderer/src/utils/numero'

describe('interpretarNumero', () => {
  it('should_read_comma_as_the_decimal_separator', () => {
    expect(interpretarNumero('0,5')).toBe(0.5)
    expect(interpretarNumero('1,25')).toBe(1.25)
  })

  it('should_read_a_dot_followed_by_groups_of_three_digits_as_thousands', () => {
    expect(interpretarNumero('1.000')).toBe(1000)
    expect(interpretarNumero('12.500')).toBe(12500)
    expect(interpretarNumero('1.000.000')).toBe(1000000)
  })

  it('should_read_thousands_and_decimals_together_in_the_brazilian_format', () => {
    expect(interpretarNumero('1.000,5')).toBe(1000.5)
    expect(interpretarNumero('12.345,67')).toBe(12345.67)
  })

  it('should_read_a_lone_dot_that_is_not_a_thousands_group_as_decimal', () => {
    expect(interpretarNumero('2.5')).toBe(2.5)
    expect(interpretarNumero('0.012')).toBe(0.012)
    expect(interpretarNumero('1.2345')).toBe(1.2345)
  })

  it('should_treat_the_last_separator_as_decimal_when_both_appear', () => {
    expect(interpretarNumero('1,000.50')).toBe(1000.5)
  })

  it('should_accept_integers_negatives_spaces_and_a_missing_leading_zero', () => {
    expect(interpretarNumero('10')).toBe(10)
    expect(interpretarNumero('-3')).toBe(-3)
    expect(interpretarNumero(' 7 ')).toBe(7)
    expect(interpretarNumero(',5')).toBe(0.5)
  })

  it('should_return_null_for_anything_that_is_not_a_number', () => {
    for (const texto of ['', '  ', 'abc', '1e3', '1.2.3', '1,2,3', '10.00,5', '--1', '1-']) {
      expect(interpretarNumero(texto)).toBeNull()
    }
  })
})

describe('formatarNumeroParaCampo', () => {
  it('should_write_decimals_with_comma_and_without_thousands_grouping', () => {
    expect(formatarNumeroParaCampo(1000.5)).toBe('1000,5')
    expect(formatarNumeroParaCampo(0.012)).toBe('0,012')
    expect(formatarNumeroParaCampo(-3)).toBe('-3')
  })

  it('should_round_trip_through_interpretarNumero_even_with_three_decimals', () => {
    for (const valor of [1.125, 0.0125, 1250, 3.499, 23.5]) {
      expect(interpretarNumero(formatarNumeroParaCampo(valor))).toBe(valor)
    }
  })
})

describe('armazenamento local', () => {
  it('should_store_the_number_in_a_format_that_is_not_ambiguous', () => {
    expect(numeroParaArmazenamento('1.000')).toBe('1000')
    expect(numeroParaArmazenamento('3,49')).toBe('3.49')
    expect(numeroParaArmazenamento('abc')).toBeNull()
  })

  it('should_read_values_saved_by_the_old_number_input_back_into_the_field_format', () => {
    expect(numeroDoArmazenamento('12.5')).toBe('12,5')
    expect(numeroDoArmazenamento('1.125')).toBe('1,125')
    expect(numeroDoArmazenamento(null)).toBe('')
    expect(numeroDoArmazenamento('lixo')).toBe('')
  })
})
