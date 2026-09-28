import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Modal from '../../renderer/src/components/ui/Modal'

/** O fundo escurecido em volta da caixa do modal. */
function fundoDe(titulo: string): HTMLElement {
  return screen.getByRole('dialog', { name: titulo }).parentElement as HTMLElement
}

describe('Modal: Esc', () => {
  it('should_close_only_the_modal_on_top', async () => {
    // Cada modal ouvia o Esc no documento: com uma pergunta aberta sobre um
    // formulário, os dois fechavam, e o que ela tinha digitado se perdia.
    const fecharFormulario = vi.fn()
    const fecharPergunta = vi.fn()
    const usuaria = userEvent.setup()
    render(
      <>
        <Modal title="Nova Variação" onClose={fecharFormulario}>
          <input aria-label="Identificador" />
        </Modal>
        <Modal title="Estoque inicial" onClose={fecharPergunta}>
          <p>De onde vieram as peças?</p>
        </Modal>
      </>
    )

    await usuaria.keyboard('{Escape}')

    expect(fecharPergunta).toHaveBeenCalledTimes(1)
    expect(fecharFormulario).not.toHaveBeenCalled()
  })

  it('should_close_a_modal_that_is_alone', async () => {
    const fechar = vi.fn()
    const usuaria = userEvent.setup()
    render(
      <Modal title="Nova despesa" onClose={fechar}>
        <input aria-label="Descrição" />
      </Modal>
    )

    await usuaria.keyboard('{Escape}')

    expect(fechar).toHaveBeenCalledTimes(1)
  })
})

describe('Modal: clique fora', () => {
  it('should_keep_a_form_open_when_clicking_outside', () => {
    // Um clique ao lado da caixa descartava a venda inteira, com todos os itens.
    const fechar = vi.fn()
    render(
      <Modal title="Registrar Venda" onClose={fechar}>
        <input aria-label="Cliente" />
      </Modal>
    )

    fireEvent.mouseDown(fundoDe('Registrar Venda'))
    fireEvent.click(fundoDe('Registrar Venda'))

    expect(fechar).not.toHaveBeenCalled()
  })

  it('should_close_a_dialog_that_allows_it_when_clicking_outside', () => {
    const fechar = vi.fn()
    render(
      <Modal title="Excluir venda" onClose={fechar} fechaAoClicarFora>
        <p>Tem certeza?</p>
      </Modal>
    )

    fireEvent.mouseDown(fundoDe('Excluir venda'))
    fireEvent.click(fundoDe('Excluir venda'))

    expect(fechar).toHaveBeenCalledTimes(1)
  })

  it('should_not_close_when_a_text_selection_ends_outside', () => {
    // Selecionar o texto de um campo arrastando o mouse para fora da caixa gera um
    // clique no fundo; ele não pode valer como "clicar fora".
    const fechar = vi.fn()
    render(
      <Modal title="Ver detalhes" onClose={fechar} fechaAoClicarFora>
        <input aria-label="Observação" />
      </Modal>
    )

    fireEvent.mouseDown(screen.getByLabelText('Observação'))
    fireEvent.click(fundoDe('Ver detalhes'))

    expect(fechar).not.toHaveBeenCalled()
  })
})
