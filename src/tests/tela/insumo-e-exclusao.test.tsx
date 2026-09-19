import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InsumoForm from '../../renderer/src/components/insumos/InsumoForm'
import ExcluirVariacaoDialog from '../../renderer/src/components/products/ExcluirVariacaoDialog'
import type { Product } from '../../shared/ipc/produtos'
import { instalarApiFalsa, insumoFalso, variacaoFalsa, type ApiFalsa } from './ajuda/api-falsa'

let api: ApiFalsa

beforeEach(() => {
  api = instalarApiFalsa()
})

describe('InsumoForm: unidade de medida', () => {
  it('should_lock_the_unit_of_an_insumo_used_in_recipes', async () => {
    render(
      <InsumoForm
        insumo={insumoFalso({ unit: 'cm', usadoPorVariacoesAtivas: 2 })}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'cm' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'g' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Un.' })).toBeDisabled()
    expect(
      screen.getByText(/trocar a unidade mudaria o sentido das quantidades/)
    ).toBeInTheDocument()
  })

  it('should_let_the_unit_change_when_no_recipe_uses_the_insumo', async () => {
    const usuaria = userEvent.setup()
    render(
      <InsumoForm
        insumo={insumoFalso({ unit: 'cm', usadoPorVariacoesAtivas: 0, stockQuantity: 500 })}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    )

    await usuaria.click(screen.getByRole('button', { name: 'g' }))

    // Trocar a unidade não converte nada: o aviso diz para recontar o estoque.
    expect(screen.getByText(/Nada é convertido/)).toBeInTheDocument()
  })

  it('should_send_the_new_unit_when_the_insumo_is_free_to_change', async () => {
    const usuaria = userEvent.setup()
    render(
      <InsumoForm
        insumo={insumoFalso({ unit: 'cm', usadoPorVariacoesAtivas: 0 })}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    )

    await usuaria.click(screen.getByRole('button', { name: 'g' }))
    await usuaria.click(screen.getByRole('button', { name: /Salvar/ }))

    await waitFor(() => expect(api.insumos.update).toHaveBeenCalledTimes(1))
    expect(api.insumos.update.mock.calls[0][0]).toMatchObject({ id: 1, unit: 'g' })
  })
})

const produtoFalso = (): Product => ({
  id: 1,
  name: 'Colar Aurora',
  categoryId: 1,
  categoryName: 'Colar',
  description: null,
  createdAt: '2026-05-01',
  archivedAt: null,
  variations: []
})

const receita = [
  {
    id: 1,
    variationId: 10,
    insumoId: 1,
    insumoName: 'Fio de nylon',
    unit: 'cm' as const,
    costPerUnit: 0.02,
    quantity: 12.5,
    archivedAt: null
  }
]

describe('ExcluirVariacaoDialog: devolver insumos', () => {
  it('should_offer_to_return_the_material_when_there_are_pieces_with_a_recipe', async () => {
    const usuaria = userEvent.setup()
    const confirmar = vi.fn()
    render(
      <ExcluirVariacaoDialog
        product={produtoFalso()}
        variation={variacaoFalsa({ stockQuantity: 2, insumos: receita })}
        onConfirm={confirmar}
        onClose={vi.fn()}
      />
    )

    const opcao = screen.getByRole('checkbox')
    expect(opcao).not.toBeChecked()
    expect(screen.getByText(/Devolver aos insumos o material de 2 peças/)).toBeInTheDocument()

    await usuaria.click(opcao)
    await usuaria.click(screen.getByRole('button', { name: 'Excluir' }))

    expect(confirmar).toHaveBeenCalledWith(true)
  })

  it('should_delete_without_returning_when_the_option_is_left_unchecked', async () => {
    const usuaria = userEvent.setup()
    const confirmar = vi.fn()
    render(
      <ExcluirVariacaoDialog
        product={produtoFalso()}
        variation={variacaoFalsa({ stockQuantity: 2, insumos: receita })}
        onConfirm={confirmar}
        onClose={vi.fn()}
      />
    )

    await usuaria.click(screen.getByRole('button', { name: 'Excluir' }))

    expect(confirmar).toHaveBeenCalledWith(false)
  })

  it('should_not_offer_the_option_when_there_is_no_stock_or_no_recipe', () => {
    render(
      <ExcluirVariacaoDialog
        product={produtoFalso()}
        variation={variacaoFalsa({ stockQuantity: 0, insumos: receita })}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
