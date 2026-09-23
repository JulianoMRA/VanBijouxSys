import { describe, expect, it } from 'vitest'
import { nomesDeClientes } from '../renderer/src/utils/sugestoes-de-clientes'

describe('nomesDeClientes', () => {
  it('should_list_each_customer_once_in_alphabetical_order', () => {
    expect(
      nomesDeClientes([
        { customerName: 'Maria' },
        { customerName: 'Ana' },
        { customerName: 'Maria' }
      ])
    ).toEqual(['Ana', 'Maria'])
  })

  it('should_treat_names_differing_only_in_case_or_accents_as_the_same_customer', () => {
    expect(
      nomesDeClientes([
        { customerName: 'Márcia' },
        { customerName: 'marcia' },
        { customerName: 'MARCIA' }
      ])
    ).toEqual(['Márcia'])
  })

  it('should_keep_the_spelling_of_the_most_recent_sale', () => {
    // A lista de vendas chega da mais recente para a mais antiga.
    expect(
      nomesDeClientes([{ customerName: 'Maria Souza' }, { customerName: 'maria souza' }])
    ).toEqual(['Maria Souza'])
  })

  it('should_ignore_sales_without_customer', () => {
    expect(nomesDeClientes([{ customerName: null }, { customerName: 'Ana' }])).toEqual(['Ana'])
  })

  it('should_sort_accented_names_among_their_letter', () => {
    expect(
      nomesDeClientes([
        { customerName: 'Zilda' },
        { customerName: 'Álvaro' },
        { customerName: 'Bia' }
      ])
    ).toEqual(['Álvaro', 'Bia', 'Zilda'])
  })
})
