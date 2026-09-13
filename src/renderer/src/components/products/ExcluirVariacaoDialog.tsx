import { useState } from 'react'
import ConfirmDialog from '../ui/ConfirmDialog'
import type { Product, ProductVariation } from '../../types'

interface ExcluirVariacaoDialogProps {
  product: Product
  variation: ProductVariation
  onConfirm: (devolverInsumos: boolean) => void
  onClose: () => void
}

/**
 * Excluir só é permitido para variação nunca vendida. Se ela tem peças e
 * receita, a exclusão pode ser o conserto de um cadastro errado — e aí os
 * insumos baixados por essas peças precisam voltar. Desmarcado por padrão:
 * sem o engano, as peças existiram e o material foi mesmo usado.
 */
export default function ExcluirVariacaoDialog({
  product,
  variation,
  onConfirm,
  onClose
}: ExcluirVariacaoDialogProps): JSX.Element {
  const [devolverInsumos, setDevolverInsumos] = useState(false)
  const podeDevolver = variation.stockQuantity > 0 && variation.insumos.length > 0
  const pecas = `${variation.stockQuantity} peça${variation.stockQuantity !== 1 ? 's' : ''}`

  return (
    <ConfirmDialog
      title="Excluir variação"
      message={`Excluir a variação "${variation.identifier}" de "${product.name}"?`}
      confirmLabel="Excluir"
      danger
      onConfirm={() => onConfirm(podeDevolver && devolverInsumos)}
      onClose={onClose}
    >
      {podeDevolver && (
        <label className="flex cursor-pointer items-start gap-2.5 rounded-control bg-bone-100 p-3 text-body text-ink-600">
          <input
            type="checkbox"
            className="mt-1"
            checked={devolverInsumos}
            onChange={(e) => setDevolverInsumos(e.target.checked)}
          />
          <span>
            Devolver aos insumos o material de {pecas}.
            <span className="mt-0.5 block text-micro text-ink-400">
              Marque se o cadastro foi um engano e essas peças nunca foram feitas.
            </span>
          </span>
        </label>
      )}
    </ConfirmDialog>
  )
}
