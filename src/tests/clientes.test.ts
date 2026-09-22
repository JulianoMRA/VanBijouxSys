import { describe, expect, it } from 'vitest'
import { normalizarNomeDaCliente } from '../shared/clientes'

describe('normalizarNomeDaCliente', () => {
  it('should_trim_and_collapse_inner_spaces', () => {
    expect(normalizarNomeDaCliente('  Maria   da  Silva ')).toBe('Maria da Silva')
  })

  it('should_return_null_for_empty_or_blank_text', () => {
    expect(normalizarNomeDaCliente('')).toBeNull()
    expect(normalizarNomeDaCliente('   ')).toBeNull()
  })

  it('should_return_null_when_there_is_no_name', () => {
    expect(normalizarNomeDaCliente(undefined)).toBeNull()
    expect(normalizarNomeDaCliente(null)).toBeNull()
  })

  it('should_keep_capitalization_and_accents_as_typed', () => {
    expect(normalizarNomeDaCliente('Márcia')).toBe('Márcia')
  })
})
