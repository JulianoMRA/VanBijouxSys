import { describe, it, expect } from 'vitest'
import {
  formatDate,
  formatDateRange,
  formatarCustoUnitario,
  formatPercent,
  partesDaData
} from '../renderer/src/utils/format'

describe('formatPercent', () => {
  it('should_use_a_decimal_comma_like_the_rest_of_the_app', () => {
    expect(formatPercent(12.5)).toBe('12,5%')
    expect(formatPercent(40)).toBe('40,0%')
    expect(formatPercent(1234.56)).toBe('1.234,6%')
  })

  it('should_round_to_the_places_asked', () => {
    expect(formatPercent(33.333, 0)).toBe('33%')
  })
})

describe('formatarCustoUnitario', () => {
  it('should_keep_four_places_below_ten_cents_so_bulk_costs_do_not_look_zero', () => {
    // Fio a R$ 0,012/cm: com duas casas, apareceria "R$ 0,01" ao lado de um total maior.
    expect(formatarCustoUnitario(0.012)).toBe('R$ 0,0120')
  })

  it('should_use_two_places_from_ten_cents_up', () => {
    expect(formatarCustoUnitario(1.5)).toBe('R$ 1,50')
    expect(formatarCustoUnitario(0)).toBe('R$ 0,00')
  })
})

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

  it('should_ignore_the_time_saved_by_old_versions', () => {
    // RN-14: registros gravados até a v1.12.1 guardam a hora que o SQLite escreveu.
    expect(formatDate('2026-03-10 14:30:00')).toBe('10/03/2026')
  })

  it('should_say_sem_data_for_a_record_saved_without_date', () => {
    // Até a 1.13 (vendas) e a 1.14 (despesas), apagar a data e salvar gravava vazio.
    expect(formatDate('')).toBe('Sem data')
  })
})

describe('partesDaData', () => {
  it('should_split_day_month_and_year_ignoring_the_time', () => {
    expect(partesDaData('2026-03-10 14:30:00')).toEqual({ dia: '10', mes: '03', ano: '2026' })
  })

  it('should_return_null_for_a_record_saved_without_date', () => {
    expect(partesDaData('')).toBeNull()
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
