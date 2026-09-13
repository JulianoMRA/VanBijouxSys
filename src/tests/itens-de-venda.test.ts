import { describe, expect, it } from 'vitest'
import { custoUnitarioDoItem } from '../renderer/src/utils/itens-de-venda'

const itensGravados = [
  { id: 10, variationId: 1, unitCost: 8 },
  { id: 11, variationId: 2, unitCost: 5 }
]

describe('custoUnitarioDoItem', () => {
  it('should_keep_the_recorded_cost_when_the_item_was_already_in_the_sale', () => {
    expect(custoUnitarioDoItem(10, { id: 1, costPrice: 12 }, itensGravados)).toBe(8)
  })

  it('should_use_the_current_cost_for_a_new_item', () => {
    expect(custoUnitarioDoItem(undefined, { id: 1, costPrice: 12 }, itensGravados)).toBe(12)
  })

  it('should_use_the_current_cost_when_the_item_now_points_to_another_variation', () => {
    expect(custoUnitarioDoItem(10, { id: 2, costPrice: 6 }, itensGravados)).toBe(6)
  })

  it('should_use_the_current_cost_when_creating_a_sale', () => {
    expect(custoUnitarioDoItem(undefined, { id: 1, costPrice: 12 }, [])).toBe(12)
  })
})
