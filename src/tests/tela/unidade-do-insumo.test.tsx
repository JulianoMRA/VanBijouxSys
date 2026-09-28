import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import InsumoForm from '../../renderer/src/components/insumos/InsumoForm'
import { instalarApiFalsa, insumoFalso } from './ajuda/api-falsa'

beforeEach(() => {
  instalarApiFalsa()
})

describe('InsumoForm: unidade travada por receita arquivada (RN-05)', () => {
  it('should_lock_the_unit_when_only_archived_variations_use_the_insumo', () => {
    // O app recusa a troca para qualquer receita, porque a variação arquivada pode
    // voltar; a tela deixava escolher outra unidade e a recusa só vinha ao salvar.
    render(
      <InsumoForm
        insumo={insumoFalso({ unit: 'cm', usadoPorVariacoesAtivas: 0, usadoEmReceitas: 1 })}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'cm' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'g' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Un.' })).toBeDisabled()
    expect(screen.getByText(/Usado em receitas de variações arquivadas/)).toBeInTheDocument()
  })
})
