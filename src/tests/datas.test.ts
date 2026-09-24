import { describe, it, expect } from 'vitest'
import { diaLocal } from '../shared/datas'
import { computePeriodDates } from '../main/repositorios/painel'
import { noFusoDaCliente } from './helpers/fuso'

noFusoDaCliente()

/** 30/09/2026 às 23h30 no horário da cliente: em UTC já é 01/10. */
const noiteDoDia30 = (): Date => new Date(2026, 8, 30, 23, 30)

describe('diaLocal', () => {
  it('should_run_in_a_time_zone_where_late_night_is_already_tomorrow_in_utc', () => {
    // Premissa dos testes abaixo: sem ela, eles passariam até com o defeito.
    expect(noiteDoDia30().toISOString().slice(0, 10)).toBe('2026-10-01')
  })

  it('should_keep_the_local_day_late_at_night', () => {
    expect(diaLocal(noiteDoDia30())).toBe('2026-09-30')
  })

  it('should_pad_month_and_day', () => {
    expect(diaLocal(new Date(2026, 0, 5, 9, 0))).toBe('2026-01-05')
  })
})

describe('períodos do painel à noite', () => {
  it('should_end_the_month_today_and_not_tomorrow', () => {
    expect(computePeriodDates('month', noiteDoDia30())).toEqual({
      fromDate: '2026-09-01',
      toDate: '2026-09-30',
      prevFromDate: '2026-08-01',
      prevToDate: '2026-08-31'
    })
  })

  it('should_start_the_quarter_exactly_three_months_back', () => {
    expect(computePeriodDates('quarter', noiteDoDia30())).toEqual({
      fromDate: '2026-06-30',
      toDate: '2026-09-30',
      prevFromDate: '2026-03-30',
      prevToDate: '2026-06-29'
    })
  })

  it('should_start_the_half_year_exactly_six_months_back', () => {
    expect(computePeriodDates('halfyear', noiteDoDia30())).toMatchObject({
      fromDate: '2026-03-30',
      toDate: '2026-09-30'
    })
  })

  it('should_not_leak_into_next_year_on_new_years_eve', () => {
    expect(computePeriodDates('year', new Date(2026, 11, 31, 23, 30))).toEqual({
      fromDate: '2026-01-01',
      toDate: '2026-12-31',
      prevFromDate: '2025-01-01',
      prevToDate: '2025-12-31'
    })
  })

  it('should_have_no_bounds_for_everything', () => {
    expect(computePeriodDates('all', noiteDoDia30())).toEqual({
      fromDate: null,
      toDate: null,
      prevFromDate: null,
      prevToDate: null
    })
  })
})
