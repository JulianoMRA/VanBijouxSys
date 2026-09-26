import Modal from '../ui/Modal'
import { descreverPerguntaDeEstoque } from '../../utils/ajuste-de-estoque'
import type { MotivoDeAjuste } from '../../types'

interface MotivoDoEstoqueDialogProps {
  /** Nulo no cadastro da variação. */
  estoqueAnterior: number | null
  novoEstoque: number
  onEscolher: (motivo: MotivoDeAjuste) => void
  onClose: () => void
}

export default function MotivoDoEstoqueDialog({
  estoqueAnterior,
  novoEstoque,
  onEscolher,
  onClose
}: MotivoDoEstoqueDialogProps): JSX.Element {
  const { titulo, pergunta, opcoes } = descreverPerguntaDeEstoque(estoqueAnterior, novoEstoque)

  return (
    <Modal title={titulo} onClose={onClose} size="sm" fechaAoClicarFora>
      <p className="mb-4 text-body text-ink-600">{pergunta}</p>
      <div className="space-y-2">
        {opcoes.map((opcao) => (
          <button
            key={opcao.motivo}
            type="button"
            onClick={() => onEscolher(opcao.motivo)}
            className="w-full rounded-control border border-bone-400 bg-bone-50 px-4 py-3 text-left transition-colors hover:border-wine-500 hover:bg-bone-100"
          >
            <span className="block text-body font-semibold text-ink-900">{opcao.titulo}</span>
            <span className="mt-0.5 block text-micro text-ink-400">{opcao.detalhe}</span>
          </button>
        ))}
      </div>
      <div className="mt-5 flex justify-end">
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </Modal>
  )
}
