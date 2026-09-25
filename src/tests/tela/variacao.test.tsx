import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VariationForm from '../../renderer/src/components/products/VariationForm'
import { instalarApiFalsa, insumoFalso, variacaoFalsa, type ApiFalsa } from './ajuda/api-falsa'

let api: ApiFalsa

beforeEach(() => {
  api = instalarApiFalsa()
  api.insumos.getAll.mockResolvedValue([insumoFalso()])
  localStorage.clear()
})

function abrirCadastro(): void {
  render(
    <VariationForm productId={1} productName="Colar Aurora" onSave={vi.fn()} onClose={vi.fn()} />
  )
}

function abrirEdicao(estoque: number, comReceita = true): void {
  render(
    <VariationForm
      productId={1}
      productName="Colar Aurora"
      variation={variacaoFalsa({
        stockQuantity: estoque,
        insumos: comReceita
          ? [
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
          : []
      })}
      onSave={vi.fn()}
      onClose={vi.fn()}
    />
  )
}

const campo = (rotulo: string): HTMLElement => screen.getByLabelText(rotulo)

async function preencherReceita(usuaria: ReturnType<typeof userEvent.setup>): Promise<void> {
  await usuaria.click(await screen.findByRole('button', { name: /Adicionar insumo/ }))
  const seletor = screen.getByRole('combobox')
  await usuaria.selectOptions(seletor, '1')
  await usuaria.type(screen.getByPlaceholderText('Qtd.'), '12,5')
}

describe('VariationForm: pergunta de onde veio o estoque', () => {
  it('should_ask_where_the_initial_stock_came_from_when_there_is_a_recipe', async () => {
    const usuaria = userEvent.setup()
    abrirCadastro()

    await usuaria.type(campo('Identificador'), 'Dourado')
    await usuaria.type(campo('Preço de custo (R$)'), '3,50')
    await usuaria.type(campo('Preço de venda (R$)'), '25')
    await preencherReceita(usuaria)
    await usuaria.clear(campo('Quantidade em estoque'))
    await usuaria.type(campo('Quantidade em estoque'), '4')
    await usuaria.click(screen.getByRole('button', { name: 'Cadastrar variação' }))

    expect(await screen.findByText('Estoque inicial')).toBeInTheDocument()
    expect(api.variations.create).not.toHaveBeenCalled()

    await usuaria.click(screen.getByRole('button', { name: /Fiz agora/ }))

    await waitFor(() => expect(api.variations.create).toHaveBeenCalledTimes(1))
    expect(api.variations.create.mock.calls[0][0]).toMatchObject({
      productId: 1,
      identifier: 'Dourado',
      costPrice: 3.5,
      salePrice: 25,
      stockQuantity: 4,
      motivoDoEstoqueInicial: 'producao',
      insumos: [{ insumoId: 1, quantity: 12.5 }]
    })
  })

  it('should_save_as_counting_when_pieces_were_already_made', async () => {
    const usuaria = userEvent.setup()
    abrirCadastro()

    await usuaria.type(campo('Identificador'), 'Dourado')
    await usuaria.type(campo('Preço de custo (R$)'), '3')
    await usuaria.type(campo('Preço de venda (R$)'), '25')
    await preencherReceita(usuaria)
    await usuaria.clear(campo('Quantidade em estoque'))
    await usuaria.type(campo('Quantidade em estoque'), '4')
    await usuaria.click(screen.getByRole('button', { name: 'Cadastrar variação' }))
    await usuaria.click(await screen.findByRole('button', { name: /Já estavam prontas/ }))

    await waitFor(() => expect(api.variations.create).toHaveBeenCalledTimes(1))
    expect(api.variations.create.mock.calls[0][0]).toMatchObject({
      motivoDoEstoqueInicial: 'contagem'
    })
  })

  it('should_not_ask_anything_when_the_variation_has_no_recipe', async () => {
    const usuaria = userEvent.setup()
    abrirCadastro()

    await usuaria.type(campo('Identificador'), 'Sem receita')
    await usuaria.type(campo('Preço de custo (R$)'), '3')
    await usuaria.type(campo('Preço de venda (R$)'), '25')
    await usuaria.clear(campo('Quantidade em estoque'))
    await usuaria.type(campo('Quantidade em estoque'), '4')
    await usuaria.click(screen.getByRole('button', { name: 'Cadastrar variação' }))

    await waitFor(() => expect(api.variations.create).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('Estoque inicial')).not.toBeInTheDocument()
    expect(api.variations.create.mock.calls[0][0]).toMatchObject({
      motivoDoEstoqueInicial: 'contagem',
      insumos: []
    })
  })

  it('should_close_only_the_question_on_escape_and_keep_what_was_typed', async () => {
    // Com a pergunta aberta sobre o formulário, Esc fechava os dois e a variação
    // digitada se perdia.
    const fecharFormulario = vi.fn()
    const usuaria = userEvent.setup()
    render(
      <VariationForm
        productId={1}
        productName="Colar Aurora"
        onSave={vi.fn()}
        onClose={fecharFormulario}
      />
    )

    await usuaria.type(campo('Identificador'), 'Dourado')
    await usuaria.type(campo('Preço de custo (R$)'), '3')
    await usuaria.type(campo('Preço de venda (R$)'), '25')
    await preencherReceita(usuaria)
    await usuaria.clear(campo('Quantidade em estoque'))
    await usuaria.type(campo('Quantidade em estoque'), '4')
    await usuaria.click(screen.getByRole('button', { name: 'Cadastrar variação' }))
    await screen.findByText('Estoque inicial')

    await usuaria.keyboard('{Escape}')

    expect(screen.queryByText('Estoque inicial')).not.toBeInTheDocument()
    expect(fecharFormulario).not.toHaveBeenCalled()
    expect(campo('Identificador')).toHaveValue('Dourado')
  })
})

describe('VariationForm: edição', () => {
  it('should_ask_the_reason_when_the_stock_changed', async () => {
    const usuaria = userEvent.setup()
    abrirEdicao(4)
    await screen.findByDisplayValue('Rosa')

    await usuaria.clear(campo('Quantidade em estoque'))
    await usuaria.type(campo('Quantidade em estoque'), '6')
    await usuaria.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText('Estoque de 4 para 6')).toBeInTheDocument()
    await usuaria.click(screen.getByRole('button', { name: /Produzi/ }))

    await waitFor(() => expect(api.variations.update).toHaveBeenCalledTimes(1))
    expect(api.variations.update.mock.calls[0][0]).toMatchObject({
      id: 10,
      ajusteDeEstoque: { novoEstoque: 6, motivo: 'producao' }
    })
  })

  it('should_not_ask_and_send_no_adjustment_when_the_stock_did_not_change', async () => {
    const usuaria = userEvent.setup()
    abrirEdicao(4)
    await screen.findByDisplayValue('Rosa')

    await usuaria.clear(campo('Preço de venda (R$)'))
    await usuaria.type(campo('Preço de venda (R$)'), '27')
    await usuaria.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(api.variations.update).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(/Estoque de/)).not.toBeInTheDocument()
    expect(api.variations.update.mock.calls[0][0]).toMatchObject({
      salePrice: 27,
      ajusteDeEstoque: undefined
    })
  })

  it('should_keep_the_recipe_that_is_on_screen_when_saving', async () => {
    const usuaria = userEvent.setup()
    abrirEdicao(4)
    await screen.findByDisplayValue('Rosa')

    await usuaria.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(api.variations.update).toHaveBeenCalledTimes(1))
    expect(api.variations.update.mock.calls[0][0]).toMatchObject({
      insumos: [{ insumoId: 1, quantity: 12.5 }]
    })
  })
})
