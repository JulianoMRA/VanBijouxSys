import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import ErrorBoundary from '../../renderer/src/components/ui/ErrorBoundary'
import { registrarErroDaTela } from '../../renderer/src/utils/registro-de-erros'
import { instalarApiFalsa, type ApiFalsa } from './ajuda/api-falsa'

let api: ApiFalsa

beforeEach(() => {
  api = instalarApiFalsa()
})

function Quebra(): JSX.Element {
  throw new Error("Cannot read properties of null (reading 'split')")
}

describe('Erro de tela vai para o log do app', () => {
  it('should_send_a_render_error_caught_by_the_boundary', async () => {
    // O React e o ErrorBoundary escrevem no console, que o app empacotado não tem.
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <Quebra />
      </ErrorBoundary>
    )

    expect(screen.getByText('Erro ao renderizar a página')).toBeInTheDocument()
    await waitFor(() => expect(api.app.registrarErroDaTela).toHaveBeenCalledTimes(1))
    expect(api.app.registrarErroDaTela.mock.calls[0][0]).toMatchObject({
      origem: 'renderizacao',
      mensagem: "Cannot read properties of null (reading 'split')"
    })
    vi.restoreAllMocks()
  })

  it('should_cut_a_huge_message_to_what_the_channel_accepts', () => {
    registrarErroDaTela('promessa', new Error('x'.repeat(5000)))

    expect(api.app.registrarErroDaTela.mock.calls[0][0].mensagem).toHaveLength(2000)
  })

  it('should_not_create_another_error_when_logging_fails', async () => {
    api.app.registrarErroDaTela.mockRejectedValue(new Error('canal indisponível'))

    expect(() => registrarErroDaTela('excecao', 'falhou')).not.toThrow()
    // A rejeição do canal é engolida: sem isso, cada falha de log gerava outra.
    await new Promise((pronto) => setTimeout(pronto, 0))
  })
})
