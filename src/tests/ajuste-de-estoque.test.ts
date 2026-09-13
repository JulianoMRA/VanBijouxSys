import { describe, expect, it } from 'vitest'
import {
  descreverPerguntaDeEstoque,
  precisaPerguntarMotivo
} from '../renderer/src/utils/ajuste-de-estoque'

describe('precisaPerguntarMotivo', () => {
  it('should_ask_when_a_new_variation_starts_with_stock_and_has_a_recipe', () => {
    expect(precisaPerguntarMotivo(null, 5, true)).toBe(true)
  })

  it('should_not_ask_when_a_new_variation_starts_without_stock', () => {
    expect(precisaPerguntarMotivo(null, 0, true)).toBe(false)
  })

  it('should_ask_when_the_stock_changed_on_an_existing_variation_with_a_recipe', () => {
    expect(precisaPerguntarMotivo(4, 7, true)).toBe(true)
    expect(precisaPerguntarMotivo(4, 1, true)).toBe(true)
  })

  it('should_not_ask_when_the_stock_did_not_change', () => {
    expect(precisaPerguntarMotivo(4, 4, true)).toBe(false)
  })

  it('should_not_ask_when_there_is_no_recipe_because_no_insumo_would_move', () => {
    expect(precisaPerguntarMotivo(null, 5, false)).toBe(false)
    expect(precisaPerguntarMotivo(4, 7, false)).toBe(false)
  })
})

describe('descreverPerguntaDeEstoque', () => {
  it('should_offer_production_first_when_registering_initial_stock', () => {
    const pergunta = descreverPerguntaDeEstoque(null, 5)

    expect(pergunta.titulo).toBe('Estoque inicial')
    expect(pergunta.opcoes.map((o) => o.motivo)).toEqual(['producao', 'contagem'])
    expect(pergunta.opcoes[0].detalhe).toContain('5 peças')
  })

  it('should_describe_the_extra_pieces_when_stock_goes_up', () => {
    const pergunta = descreverPerguntaDeEstoque(4, 7)

    expect(pergunta.titulo).toBe('Estoque de 4 para 7')
    expect(pergunta.opcoes[0].titulo).toBe('Produzi 3 peças')
  })

  it('should_frame_production_as_a_mistake_to_undo_when_stock_goes_down', () => {
    const pergunta = descreverPerguntaDeEstoque(4, 3)

    expect(pergunta.opcoes[0].motivo).toBe('producao')
    expect(pergunta.opcoes[0].detalhe).toContain('Devolve')
    expect(pergunta.opcoes[0].detalhe).toContain('1 peça.')
  })
})
