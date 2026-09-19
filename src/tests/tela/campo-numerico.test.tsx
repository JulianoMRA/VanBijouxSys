import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CampoNumerico from '../../renderer/src/components/ui/CampoNumerico'

/**
 * O campo vive controlado pelo formulário: guardar o texto aqui reproduz o que
 * acontece na tela, inclusive a reescrita ao sair do campo.
 */
function CampoDeProva({ inicial = '' }: { inicial?: string }): JSX.Element {
  const [valor, setValor] = useState(inicial)
  return (
    <>
      <label htmlFor="quantidade">Quantidade</label>
      <CampoNumerico id="quantidade" value={valor} onChange={setValor} />
      <button type="button">sair</button>
    </>
  )
}

const campo = (): HTMLInputElement => screen.getByLabelText('Quantidade') as HTMLInputElement

describe('CampoNumerico', () => {
  it('should_read_a_thousand_written_with_a_dot_as_one_thousand', async () => {
    const usuaria = userEvent.setup()
    render(<CampoDeProva />)

    await usuaria.type(campo(), '1.000')
    await usuaria.tab()

    expect(campo()).toHaveValue('1000')
  })

  it('should_read_a_decimal_written_with_a_comma', async () => {
    const usuaria = userEvent.setup()
    render(<CampoDeProva />)

    await usuaria.type(campo(), '0,35')
    await usuaria.tab()

    expect(campo()).toHaveValue('0,35')
  })

  it('should_rewrite_a_dot_decimal_the_way_it_was_understood', async () => {
    const usuaria = userEvent.setup()
    render(<CampoDeProva />)

    await usuaria.type(campo(), '2.5')
    await usuaria.tab()

    expect(campo()).toHaveValue('2,5')
  })

  it('should_keep_text_that_is_not_a_number_for_the_form_to_point_out', async () => {
    const usuaria = userEvent.setup()
    render(<CampoDeProva />)

    await usuaria.type(campo(), 'dez')
    await usuaria.tab()

    expect(campo()).toHaveValue('dez')
  })

  it('should_stay_empty_when_nothing_is_typed', async () => {
    const usuaria = userEvent.setup()
    render(<CampoDeProva />)

    await usuaria.click(campo())
    await usuaria.tab()

    expect(campo()).toHaveValue('')
  })
})
