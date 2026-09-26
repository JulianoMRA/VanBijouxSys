import { describe, expect, it } from 'vitest'
import { agruparPor } from '../main/repositorios/agrupar'

describe('agruparPor', () => {
  it('should_group_the_rows_by_their_parent_keeping_the_query_order', () => {
    const linhas = [
      { saleId: 2, id: 10 },
      { saleId: 1, id: 11 },
      { saleId: 2, id: 12 }
    ]

    const grupos = agruparPor(
      linhas,
      (linha) => linha.saleId,
      (linha) => linha.id
    )

    expect([...grupos.entries()]).toEqual([
      [2, [10, 12]],
      [1, [11]]
    ])
  })

  it('should_leave_out_a_parent_without_rows', () => {
    expect(agruparPor([], String, String).get('1')).toBeUndefined()
  })
})
