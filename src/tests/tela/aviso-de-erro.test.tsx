import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AvisoDeErro from '../../renderer/src/components/ui/AvisoDeErro'

describe('AvisoDeErro', () => {
  it('should_show_the_message_and_close_on_the_x', async () => {
    const usuaria = userEvent.setup()
    const fechar = vi.fn()
    render(<AvisoDeErro mensagem="Não foi possível carregar o caixa." onFechar={fechar} />)

    expect(screen.getByText('Não foi possível carregar o caixa.')).toBeInTheDocument()
    await usuaria.click(screen.getByRole('button', { name: '×' }))

    expect(fechar).toHaveBeenCalledTimes(1)
  })

  it('should_render_nothing_without_a_message', () => {
    const { container } = render(<AvisoDeErro mensagem="" onFechar={vi.fn()} />)

    expect(container).toBeEmptyDOMElement()
  })
})
