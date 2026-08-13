import { describe, it, expect } from 'vitest'
import {
  buildFairCostSub,
  buildFairExpenses,
  buildTransactions,
  calcCashSummary,
  cashDateOf,
  filterCashSales,
  filterExpenses,
  getPeriodDates,
  resolveDateRange
} from '../renderer/src/utils/cash-calculations'
import type { CashExpense, Fair, Sale } from '../renderer/src/types'

function venda(over: Partial<Sale> = {}): Sale {
  return {
    id: 1,
    channel: 'WhatsApp',
    fairId: null,
    fairName: null,
    totalAmount: 100,
    totalCost: 40,
    paymentMethod: 'pix',
    feePercentage: 0,
    feeAmount: 0,
    netAmount: 100,
    soldAt: '2026-08-10',
    receivedAt: null,
    items: [
      {
        id: 1,
        variationId: 1,
        variationIdentifier: 'Dourado',
        productName: 'Colar Lua',
        quantity: 1,
        unitPrice: 100,
        unitCost: 40
      }
    ],
    ...over
  } as Sale
}

function despesa(over: Partial<CashExpense> = {}): CashExpense {
  return {
    id: 1,
    categoryId: 1,
    categoryName: 'Material',
    description: 'Fio de nylon',
    amount: 30,
    expenseDate: '2026-08-10',
    notes: null,
    createdAt: '2026-08-10',
    ...over
  }
}

function feira(over: Partial<Fair> = {}): Fair {
  return {
    id: 1,
    name: 'Feira do Bosque',
    location: 'Praça',
    organizer: null,
    date: '2026-08-10',
    endDate: null,
    enrollmentCost: 0,
    additionalCosts: [],
    createdAt: '2026-08-01',
    ...over
  }
}

describe('getPeriodDates', () => {
  const hoje = new Date(2026, 7, 12) // 12/08/2026

  it('should_return_null_for_tudo_meaning_no_filter', () => {
    expect(getPeriodDates('tudo', hoje)).toBeNull()
  })

  it('should_start_the_month_period_on_the_first_day', () => {
    expect(getPeriodDates('mes', hoje)).toEqual({
      startDate: '2026-08-01',
      endDate: '2026-08-12'
    })
  })

  it('should_go_back_three_months', () => {
    expect(getPeriodDates('3meses', hoje)).toEqual({
      startDate: '2026-05-12',
      endDate: '2026-08-12'
    })
  })

  it('should_go_back_six_months_crossing_the_year', () => {
    expect(getPeriodDates('6meses', new Date(2026, 1, 15))).toEqual({
      startDate: '2025-08-15',
      endDate: '2026-02-15'
    })
  })

  it('should_start_the_year_period_on_january_first', () => {
    expect(getPeriodDates('ano', hoje)).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-08-12'
    })
  })

  it('should_use_local_date_not_utc_late_at_night', () => {
    // 23h em UTC-3 já é o dia seguinte em UTC; o caixa segue o dia da usuária.
    expect(getPeriodDates('mes', new Date(2026, 7, 12, 23, 30))?.endDate).toBe('2026-08-12')
  })
})

describe('resolveDateRange', () => {
  const hoje = new Date(2026, 7, 12)

  it('should_use_the_custom_range_when_both_ends_are_filled', () => {
    expect(resolveDateRange('custom', '2026-01-01', '2026-03-31', hoje)).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-03-31'
    })
  })

  it('should_ignore_an_incomplete_custom_range', () => {
    expect(resolveDateRange('custom', '2026-01-01', '', hoje)).toBeNull()
    expect(resolveDateRange('custom', '', '2026-03-31', hoje)).toBeNull()
  })
})

describe('cashDateOf', () => {
  it('should_use_the_sale_date_when_it_was_paid_on_the_spot', () => {
    expect(cashDateOf({ soldAt: '2026-08-10', receivedAt: null })).toBe('2026-08-10')
  })

  it('should_use_the_receipt_date_for_a_settled_credit_sale', () => {
    expect(cashDateOf({ soldAt: '2026-07-02', receivedAt: '2026-08-11' })).toBe('2026-08-11')
  })

  it('should_trim_a_full_timestamp_to_the_day', () => {
    expect(cashDateOf({ soldAt: '2026-08-10 14:32:11', receivedAt: null })).toBe('2026-08-10')
  })
})

describe('filterCashSales', () => {
  const range = { startDate: '2026-08-01', endDate: '2026-08-31' }

  it('should_exclude_pending_credit_sales_from_cash', () => {
    const vendas = [venda({ id: 1, paymentMethod: 'areceber' }), venda({ id: 2 })]
    expect(filterCashSales(vendas, range).map((s) => s.id)).toEqual([2])
  })

  it('should_include_a_credit_sale_settled_inside_the_period', () => {
    const vendas = [
      venda({ id: 3, paymentMethod: 'pix', soldAt: '2026-06-20', receivedAt: '2026-08-05' })
    ]
    expect(filterCashSales(vendas, range).map((s) => s.id)).toEqual([3])
  })

  it('should_exclude_a_sale_settled_outside_the_period', () => {
    const vendas = [
      venda({ id: 4, paymentMethod: 'pix', soldAt: '2026-08-02', receivedAt: '2026-09-03' })
    ]
    expect(filterCashSales(vendas, range)).toEqual([])
  })

  it('should_include_sales_on_the_range_boundaries', () => {
    const vendas = [venda({ id: 5, soldAt: '2026-08-01' }), venda({ id: 6, soldAt: '2026-08-31' })]
    expect(filterCashSales(vendas, range).map((s) => s.id)).toEqual([5, 6])
  })

  it('should_keep_every_eligible_sale_when_there_is_no_range', () => {
    const vendas = [venda({ id: 7, soldAt: '2020-01-01' }), venda({ id: 8 })]
    expect(filterCashSales(vendas, null)).toHaveLength(2)
  })
})

describe('filterExpenses', () => {
  it('should_keep_only_expenses_inside_the_range', () => {
    const lista = [
      despesa({ id: 1, expenseDate: '2026-07-31' }),
      despesa({ id: 2, expenseDate: '2026-08-01' }),
      despesa({ id: 3, expenseDate: '2026-08-31' }),
      despesa({ id: 4, expenseDate: '2026-09-01' })
    ]
    const resultado = filterExpenses(lista, { startDate: '2026-08-01', endDate: '2026-08-31' })
    expect(resultado.map((e) => e.id)).toEqual([2, 3])
  })
})

describe('buildFairExpenses', () => {
  it('should_ignore_a_fair_without_any_cost', () => {
    expect(buildFairExpenses([feira({ enrollmentCost: 0 })], null)).toEqual([])
  })

  it('should_sum_enrollment_and_additional_costs', () => {
    const f = feira({
      enrollmentCost: 80,
      additionalCosts: [
        { id: 1, fairId: 1, description: 'Estacionamento', amount: 20 },
        { id: 2, fairId: 1, description: 'Almoço', amount: 35 }
      ]
    })
    expect(buildFairExpenses([f], null)[0].amount).toBe(135)
  })

  it('should_create_a_row_for_a_fair_with_only_additional_costs', () => {
    const f = feira({
      enrollmentCost: 0,
      additionalCosts: [{ id: 1, fairId: 1, description: 'Estacionamento', amount: 20 }]
    })
    expect(buildFairExpenses([f], null)).toHaveLength(1)
  })

  it('should_filter_fairs_by_their_date', () => {
    const dentro = feira({ id: 1, date: '2026-08-10', enrollmentCost: 50 })
    const fora = feira({ id: 2, date: '2026-07-10', enrollmentCost: 50 })
    const rows = buildFairExpenses([dentro, fora], {
      startDate: '2026-08-01',
      endDate: '2026-08-31'
    })
    expect(rows.map((r) => r.fairId)).toEqual([1])
  })
})

describe('buildFairCostSub', () => {
  it('should_describe_enrollment_and_each_extra_cost', () => {
    const texto = buildFairCostSub(
      feira({
        enrollmentCost: 80,
        additionalCosts: [{ id: 1, fairId: 1, description: 'Estacionamento', amount: 20 }]
      })
    )
    expect(texto).toContain('Inscrição')
    expect(texto).toContain('Estacionamento')
    expect(texto).toContain('·')
  })

  it('should_fall_back_when_there_is_nothing_to_describe', () => {
    expect(buildFairCostSub(feira())).toBe('Sem detalhes')
  })
})

describe('calcCashSummary', () => {
  it('should_use_net_amount_of_sales_as_income_discounting_card_fees', () => {
    const resumo = calcCashSummary({
      openingBalance: 0,
      sales: [venda({ totalAmount: 100, netAmount: 95, feeAmount: 5 })],
      expenses: [],
      fairExpenses: []
    })
    expect(resumo.totalIncome).toBe(95)
  })

  it('should_count_fair_costs_as_expenses', () => {
    const resumo = calcCashSummary({
      openingBalance: 0,
      sales: [],
      expenses: [despesa({ amount: 30 })],
      fairExpenses: [{ fairId: 1, date: '2026-08-10', label: 'Feira', sub: '', amount: 80 }]
    })
    expect(resumo.totalExpenses).toBe(110)
  })

  it('should_add_the_opening_balance_to_the_current_balance', () => {
    const resumo = calcCashSummary({
      openingBalance: 500,
      sales: [venda({ netAmount: 100 })],
      expenses: [despesa({ amount: 30 })],
      fairExpenses: []
    })
    expect(resumo.currentBalance).toBe(570)
  })

  it('should_allow_a_negative_balance_when_expenses_exceed_income', () => {
    const resumo = calcCashSummary({
      openingBalance: 0,
      sales: [],
      expenses: [despesa({ amount: 200 })],
      fairExpenses: []
    })
    expect(resumo.currentBalance).toBe(-200)
  })

  it('should_return_zeros_for_an_empty_period', () => {
    const resumo = calcCashSummary({
      openingBalance: 0,
      sales: [],
      expenses: [],
      fairExpenses: []
    })
    expect(resumo).toEqual({ totalIncome: 0, totalExpenses: 0, currentBalance: 0 })
  })
})

describe('buildTransactions', () => {
  it('should_sort_every_kind_together_from_newest_to_oldest', () => {
    const rows = buildTransactions(
      [venda({ id: 1, soldAt: '2026-08-05' })],
      [despesa({ id: 2, expenseDate: '2026-08-20' })],
      [{ fairId: 3, date: '2026-08-12', label: 'Feira', sub: '', amount: 80 }]
    )
    expect(rows.map((r) => r.date)).toEqual(['2026-08-20', '2026-08-12', '2026-08-05'])
  })

  it('should_place_a_settled_credit_sale_on_its_receipt_date', () => {
    const rows = buildTransactions(
      [venda({ id: 1, soldAt: '2026-06-01', receivedAt: '2026-08-25' })],
      [despesa({ id: 2, expenseDate: '2026-08-20' })],
      []
    )
    expect(rows[0].date).toBe('2026-08-25')
  })

  it('should_name_a_single_item_sale_after_the_product', () => {
    const rows = buildTransactions([venda()], [], [])
    expect(rows[0].label).toBe('Colar Lua — Dourado')
  })

  it('should_summarize_a_multi_item_sale_by_count', () => {
    const v = venda()
    const rows = buildTransactions([{ ...v, items: [...v.items, ...v.items, ...v.items] }], [], [])
    expect(rows[0].label).toBe('3 itens vendidos')
  })

  it('should_mark_a_settled_sale_as_received_in_the_subtitle', () => {
    const rows = buildTransactions([venda({ receivedAt: '2026-08-11' })], [], [])
    expect(rows[0].sub).toContain('recebido')
  })

  it('should_show_the_fair_name_in_the_subtitle_when_present', () => {
    const rows = buildTransactions([venda({ channel: 'Feira', fairName: 'Bosque' })], [], [])
    expect(rows[0].sub).toContain('Bosque')
  })

  it('should_keep_gross_and_net_apart_on_an_income_row', () => {
    const rows = buildTransactions(
      [venda({ totalAmount: 100, netAmount: 95, feeAmount: 5 })],
      [],
      []
    )
    const linha = rows[0]
    expect(linha.kind).toBe('income')
    if (linha.kind === 'income') {
      expect(linha.amount).toBe(100)
      expect(linha.netAmount).toBe(95)
    }
  })
})
