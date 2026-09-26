import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProductForm from '../../renderer/src/components/products/ProductForm'
import FairForm from '../../renderer/src/components/fairs/FairForm'
import ExpenseForm from '../../renderer/src/components/cash/ExpenseForm'
import AddStockForm from '../../renderer/src/components/products/AddStockForm'
import AddInsumoStockForm from '../../renderer/src/components/insumos/AddInsumoStockForm'
import Cash from '../../renderer/src/pages/Cash'
import { instalarApiFalsa, insumoFalso, variacaoFalsa, type ApiFalsa } from './ajuda/api-falsa'

/**
 * O processo principal escreve a recusa para ela ler (README, "Fronteira IPC"). Estes
 * formulários trocavam esse texto por um genérico, e ela ficava sem saber o motivo.
 */
const RECUSA = 'Mensagem escrita pelo app para ela ler.'

let api: ApiFalsa

beforeEach(() => {
  api = instalarApiFalsa()
})

describe('Formulários mostram a recusa do app', () => {
  it('should_show_the_refusal_when_saving_a_product', async () => {
    api.products.create.mockRejectedValue(new Error(RECUSA))
    const usuaria = userEvent.setup()
    render(
      <ProductForm categories={[{ id: 1, name: 'Colar' }]} onSave={vi.fn()} onClose={vi.fn()} />
    )

    await usuaria.type(screen.getByPlaceholderText('Ex: Pulseira de Cristal'), 'Colar Lua')
    await usuaria.click(screen.getByRole('button', { name: 'Cadastrar produto' }))

    expect(await screen.findByText(RECUSA)).toBeInTheDocument()
  })

  it('should_show_the_refusal_when_saving_a_fair', async () => {
    api.fairs.create.mockRejectedValue(new Error(RECUSA))
    const usuaria = userEvent.setup()
    const { container } = render(<FairForm onSave={vi.fn()} onClose={vi.fn()} />)

    await usuaria.type(screen.getByPlaceholderText('Ex: Feira de Artesanato do Centro'), 'Feira')
    await usuaria.type(screen.getByPlaceholderText('Ex: Praça da República'), 'Praça')
    fireEvent.change(container.querySelector('input[type="date"]') as HTMLInputElement, {
      target: { value: '2026-10-10' }
    })
    await usuaria.click(screen.getByRole('button', { name: 'Cadastrar feira' }))

    expect(await screen.findByText(RECUSA)).toBeInTheDocument()
  })

  it('should_show_the_refusal_when_saving_an_expense', async () => {
    api.cashExpenses.create.mockRejectedValue(new Error(RECUSA))
    const usuaria = userEvent.setup()
    render(
      <ExpenseForm
        categories={[{ id: 1, name: 'Material', createdAt: '2026-01-01 00:00:00' }]}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    )

    await usuaria.selectOptions(screen.getByRole('combobox'), '1')
    await usuaria.type(screen.getByPlaceholderText(/Compra de correntes/), 'Fio')
    await usuaria.type(screen.getByPlaceholderText('0,00'), '30')
    await usuaria.click(screen.getByRole('button', { name: 'Registrar despesa' }))

    expect(await screen.findByText(RECUSA)).toBeInTheDocument()
  })

  it('should_show_the_refusal_when_adding_pieces', async () => {
    api.variations.addStock.mockRejectedValue(new Error(RECUSA))
    const usuaria = userEvent.setup()
    render(
      <AddStockForm
        variation={variacaoFalsa()}
        productName="Colar Aurora"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    )

    await usuaria.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(await screen.findByText(RECUSA)).toBeInTheDocument()
  })

  it('should_show_the_refusal_when_adding_insumo_stock', async () => {
    api.insumos.addStock.mockRejectedValue(new Error(RECUSA))
    const usuaria = userEvent.setup()
    render(<AddInsumoStockForm insumo={insumoFalso()} onSave={vi.fn()} onClose={vi.fn()} />)

    await usuaria.type(screen.getByPlaceholderText('0'), '100')
    await usuaria.click(screen.getByRole('button', { name: 'Adicionar ao estoque' }))

    expect(await screen.findByText(RECUSA)).toBeInTheDocument()
  })

  it('should_not_blame_a_duplicate_name_for_any_category_failure', async () => {
    // Qualquer falha ao criar categoria virava "Já existe uma categoria com esse nome.".
    api.expenseCategories.create.mockRejectedValue(new Error(RECUSA))
    const usuaria = userEvent.setup()
    render(<Cash />)

    await usuaria.click(await screen.findByRole('button', { name: 'Categorias' }))
    await usuaria.type(screen.getByPlaceholderText('Nome da categoria'), 'Material')
    await usuaria.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(await screen.findByText(RECUSA)).toBeInTheDocument()
    expect(screen.queryByText('Já existe uma categoria com esse nome.')).not.toBeInTheDocument()
  })
})
