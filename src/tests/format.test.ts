import { describe, it, expect } from 'vitest'
import { formatDate, formatDateRange, calcSaleTotals } from '../renderer/src/utils/format'

describe('formatDate', () => {
  it('should format ISO date string to dd/mm/yyyy', () => {
    expect(formatDate('2025-03-15')).toBe('15/03/2025')
  })

  it('should pad single-digit day and month', () => {
    expect(formatDate('2025-01-05')).toBe('05/01/2025')
  })

  it('should handle end-of-year dates', () => {
    expect(formatDate('2024-12-31')).toBe('31/12/2024')
  })
})

describe('formatDateRange', () => {
  it('should return single date when endDate is null', () => {
    expect(formatDateRange('2025-03-15', null)).toBe('15/03/2025')
  })

  it('should return single date when start and end are equal', () => {
    expect(formatDateRange('2025-03-15', '2025-03-15')).toBe('15/03/2025')
  })

  it('should use short range format when same month and year', () => {
    expect(formatDateRange('2025-03-14', '2025-03-16')).toBe('14 a 16/03/2025')
  })

  it('should use full date range when different months', () => {
    expect(formatDateRange('2025-03-30', '2025-04-01')).toBe('30/03/2025 a 01/04/2025')
  })

  it('should use full date range when different years', () => {
    expect(formatDateRange('2024-12-31', '2025-01-01')).toBe('31/12/2024 a 01/01/2025')
  })
})

describe('calcSaleTotals', () => {
  it('should return zeros for empty items array', () => {
    const result = calcSaleTotals([])
    expect(result).toEqual({ totalAmount: 0, totalCost: 0, profit: 0 })
  })

  it('should calculate totals for a single item', () => {
    const result = calcSaleTotals([{ quantity: 2, unitPrice: 50, unitCost: 15 }])
    expect(result.totalAmount).toBe(100)
    expect(result.totalCost).toBe(30)
    expect(result.profit).toBe(70)
  })

  it('should sum multiple items correctly', () => {
    const result = calcSaleTotals([
      { quantity: 1, unitPrice: 40, unitCost: 12 },
      { quantity: 3, unitPrice: 25, unitCost: 8 }
    ])
    expect(result.totalAmount).toBe(115) // 40 + 75
    expect(result.totalCost).toBe(36)    // 12 + 24
    expect(result.profit).toBe(79)       // 115 - 36
  })

  it('should calculate profit as totalAmount minus totalCost', () => {
    const result = calcSaleTotals([{ quantity: 1, unitPrice: 30, unitCost: 30 }])
    expect(result.profit).toBe(0)
  })

  it('should handle fractional prices correctly', () => {
    const result = calcSaleTotals([{ quantity: 2, unitPrice: 12.5, unitCost: 4.75 }])
    expect(result.totalAmount).toBeCloseTo(25)
    expect(result.totalCost).toBeCloseTo(9.5)
    expect(result.profit).toBeCloseTo(15.5)
  })
})
