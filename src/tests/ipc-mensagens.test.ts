import { describe, it, expect } from 'vitest'
import { ErroDeNegocio, MENSAGEM_GENERICA, mensagemPara } from '../main/ipc/mensagens'

describe('mensagemPara', () => {
  it('should_keep_business_error_message_as_written', () => {
    const err = new ErroDeNegocio('O arquivo está corrompido e não pode ser restaurado.')
    expect(mensagemPara('backup:restaurar', err)).toBe(
      'O arquivo está corrompido e não pode ser restaurado.'
    )
  })

  it('should_explain_why_a_sold_product_cannot_be_deleted', () => {
    const err = new Error('FOREIGN KEY constraint failed')
    expect(mensagemPara('products:delete', err)).toContain('já possui vendas registradas')
  })

  it('should_explain_why_a_sold_variation_cannot_be_deleted', () => {
    const err = new Error('FOREIGN KEY constraint failed')
    expect(mensagemPara('variations:delete', err)).toContain('já foi vendida')
  })

  it('should_explain_why_a_fair_with_sales_cannot_be_deleted', () => {
    const err = new Error('FOREIGN KEY constraint failed')
    expect(mensagemPara('fairs:delete', err)).toContain('vendas registradas')
  })

  it('should_fall_back_to_generic_link_message_for_unmapped_channel', () => {
    const err = new Error('SqliteError: FOREIGN KEY constraint failed')
    expect(mensagemPara('canal:desconhecido', err)).toBe(
      'Este item está vinculado a outros registros e não pode ser excluído.'
    )
  })

  it('should_report_duplicate_expense_category_by_name', () => {
    const err = new Error('UNIQUE constraint failed: expense_categories.name')
    expect(mensagemPara('expense-categories:create', err)).toBe(
      'Já existe uma categoria com esse nome.'
    )
  })

  it('should_hide_technical_details_of_unexpected_errors', () => {
    const err = new Error('SQLITE_BUSY: database is locked')
    expect(mensagemPara('sales:create', err)).toBe(MENSAGEM_GENERICA)
  })

  it('should_handle_thrown_values_that_are_not_errors', () => {
    expect(mensagemPara('sales:create', 'falha crua')).toBe(MENSAGEM_GENERICA)
  })

  it('should_never_leak_the_raw_sqlite_text', () => {
    const err = new Error('SqliteError: FOREIGN KEY constraint failed')
    for (const canal of ['products:delete', 'variations:delete', 'fairs:delete']) {
      expect(mensagemPara(canal, err)).not.toMatch(/FOREIGN KEY|SqliteError/)
    }
  })
})
