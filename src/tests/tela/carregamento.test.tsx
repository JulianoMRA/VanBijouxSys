import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import SaleForm from '../../renderer/src/components/sales/SaleForm'
import VariationForm from '../../renderer/src/components/products/VariationForm'
import { instalarApiFalsa, type ApiFalsa } from './ajuda/api-falsa'

let api: ApiFalsa

beforeEach(() => {
  api = instalarApiFalsa()
  localStorage.clear()
})

describe('Formulários: falha ao carregar as listas', () => {
  // Sem catch, a falha virava rejeição sem tratamento e os seletores ficavam vazios,
  // como se não houvesse produto, feira ou insumo cadastrado.
  it('should_say_when_the_sale_form_could_not_load_products_and_fairs', async () => {
    api.products.getAll.mockRejectedValue(new Error('falhou'))

    render(<SaleForm onSave={vi.fn()} onClose={vi.fn()} />)

    expect(
      await screen.findByText(
        'Não foi possível carregar os produtos e as feiras. Feche e abra de novo.'
      )
    ).toBeInTheDocument()
  })

  it('should_say_when_the_variation_form_could_not_load_insumos', async () => {
    api.insumos.getAll.mockRejectedValue(new Error('falhou'))

    render(
      <VariationForm productId={1} productName="Colar Aurora" onSave={vi.fn()} onClose={vi.fn()} />
    )

    expect(
      await screen.findByText('Não foi possível carregar os insumos. Feche e abra de novo.')
    ).toBeInTheDocument()
  })
})
