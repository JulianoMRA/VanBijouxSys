import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PriceCalculator from '../../renderer/src/pages/PriceCalculator'
import type { Product } from '../../shared/ipc/produtos'
import { instalarApiFalsa, insumoFalso, variacaoFalsa, type ApiFalsa } from './ajuda/api-falsa'

let api: ApiFalsa

const produto = (): Product => ({
  id: 1,
  name: 'Colar Aurora',
  categoryId: 1,
  categoryName: 'Colar',
  description: null,
  createdAt: '2026-05-01',
  archivedAt: null,
  variations: [
    variacaoFalsa({
      id: 10,
      identifier: 'Rosa',
      costPrice: 3,
      salePrice: 25,
      insumos: [
        {
          id: 1,
          variationId: 10,
          insumoId: 1,
          insumoName: 'Fio de nylon',
          unit: 'cm',
          costPerUnit: 0.02,
          quantity: 12.5,
          archivedAt: null
        }
      ]
    })
  ]
})

beforeEach(() => {
  api = instalarApiFalsa()
  api.products.getAll.mockResolvedValue([produto()])
  api.insumos.getAll.mockResolvedValue([insumoFalso()])
  localStorage.clear()
})

describe('Precificação: aplicar preço a uma variação', () => {
  it('should_change_only_the_sale_price_and_never_rewrite_the_variation', async () => {
    const usuaria = userEvent.setup()
    render(<PriceCalculator />)
    // Sem custo digitado não há preço para aplicar: a mão de obra basta.
    const maoDeObra = screen.getAllByPlaceholderText('0,00').at(-1) as HTMLInputElement
    await usuaria.type(maoDeObra, '10')

    // Os seletores existem antes dos produtos chegarem: esperar a opção, não o select.
    const opcaoProduto = await screen.findByRole('option', { name: /Colar Aurora/ })
    const seletorProduto = opcaoProduto.closest('select') as HTMLSelectElement

    await usuaria.selectOptions(seletorProduto, '1')
    const opcaoVariacao = await screen.findByRole('option', { name: /Rosa/ })
    await usuaria.selectOptions(opcaoVariacao.closest('select') as HTMLSelectElement, '10')
    await usuaria.click(await screen.findByRole('button', { name: /^Aplicar R\$/ }))

    await waitFor(() => expect(api.variations.setSalePrice).toHaveBeenCalledTimes(1))
    // O defeito da 1.11.0: a Precificação chamava o update da variação e apagava
    // a receita. Aqui, só o canal de preço pode ser chamado.
    expect(api.variations.update).not.toHaveBeenCalled()
    expect(api.variations.create).not.toHaveBeenCalled()
    expect(api.variations.setSalePrice.mock.calls[0][0]).toBe(10)
  })

  it('should_keep_the_apply_button_disabled_until_a_variation_is_chosen', async () => {
    render(<PriceCalculator />)
    await screen.findAllByRole('combobox')

    expect(screen.getByRole('button', { name: 'Escolha o produto e a variação' })).toBeDisabled()
    expect(api.variations.setSalePrice).not.toHaveBeenCalled()
  })
})

describe('Precificação: falhas aparecem na tela', () => {
  it('should_explain_when_applying_the_price_fails', async () => {
    // Sem catch, a falha virava uma rejeição sem tratamento e o botão voltava ao
    // normal como se nada tivesse acontecido.
    api.variations.setSalePrice.mockRejectedValue(new Error('Variação não encontrada.'))
    const usuaria = userEvent.setup()
    render(<PriceCalculator />)
    const maoDeObra = screen.getAllByPlaceholderText('0,00').at(-1) as HTMLInputElement
    await usuaria.type(maoDeObra, '10')
    const opcaoProduto = await screen.findByRole('option', { name: /Colar Aurora/ })
    await usuaria.selectOptions(opcaoProduto.closest('select') as HTMLSelectElement, '1')
    const opcaoVariacao = await screen.findByRole('option', { name: /Rosa/ })
    await usuaria.selectOptions(opcaoVariacao.closest('select') as HTMLSelectElement, '10')

    await usuaria.click(await screen.findByRole('button', { name: /^Aplicar R\$/ }))

    expect(await screen.findByText('Variação não encontrada.')).toBeInTheDocument()
    expect(screen.queryByText(/Preço aplicado/)).not.toBeInTheDocument()
  })

  it('should_say_when_products_and_insumos_could_not_load', async () => {
    api.products.getAll.mockRejectedValue(new Error('falhou'))

    render(<PriceCalculator />)

    expect(
      await screen.findByText('Não foi possível carregar os produtos e insumos.')
    ).toBeInTheDocument()
  })
})
