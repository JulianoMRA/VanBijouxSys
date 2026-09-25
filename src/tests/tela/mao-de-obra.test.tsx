import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VariationForm from '../../renderer/src/components/products/VariationForm'
import { instalarApiFalsa, variacaoFalsa, type ApiFalsa } from './ajuda/api-falsa'

let api: ApiFalsa

beforeEach(() => {
  api = instalarApiFalsa()
  localStorage.clear()
  // "Salvar como padrão" na calculadora de preço guardou R$ 8 de mão de obra.
  localStorage.setItem('pricing_default_labor_cost', '8')
})

describe('VariationForm: mão de obra padrão', () => {
  it('should_keep_a_zero_labor_cost_when_editing_a_variation', async () => {
    // Com mão de obra zero, o campo nascia com o padrão e a edição gravava R$ 8 na
    // variação, mesmo com a calculadora fechada e sem ela mexer no campo.
    const usuaria = userEvent.setup()
    render(
      <VariationForm
        productId={1}
        productName="Colar Aurora"
        variation={variacaoFalsa({ laborCost: 0, insumos: [] })}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    )
    await screen.findByDisplayValue('Rosa')

    await usuaria.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(api.variations.update).toHaveBeenCalledTimes(1))
    expect(api.variations.update.mock.calls[0][0].laborCost).toBe(0)
  })

  it('should_still_offer_the_default_for_a_new_variation', async () => {
    const usuaria = userEvent.setup()
    render(
      <VariationForm productId={1} productName="Colar Aurora" onSave={vi.fn()} onClose={vi.fn()} />
    )

    await usuaria.type(screen.getByLabelText('Identificador'), 'Dourado')
    await usuaria.type(screen.getByLabelText('Preço de custo (R$)'), '3')
    await usuaria.type(screen.getByLabelText('Preço de venda (R$)'), '25')
    await usuaria.click(screen.getByRole('button', { name: 'Cadastrar variação' }))

    await waitFor(() => expect(api.variations.create).toHaveBeenCalledTimes(1))
    expect(api.variations.create.mock.calls[0][0].laborCost).toBe(8)
  })
})
