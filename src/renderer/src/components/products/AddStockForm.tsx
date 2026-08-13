import { useState } from 'react'
import Modal from '../ui/Modal'
import type { ProductVariation } from '../../types'

interface AddStockFormProps {
  variation: ProductVariation
  productName: string
  onSave: () => void
  onClose: () => void
}

export default function AddStockForm({
  variation,
  productName,
  onSave,
  onClose
}: AddStockFormProps): JSX.Element {
  const [quantity, setQuantity] = useState('1')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const qty = parseInt(quantity)
    if (isNaN(qty) || qty <= 0) {
      setError('Informe uma quantidade válida.')
      return
    }
    setSaving(true)
    try {
      await window.api.variations.addStock(variation.id, qty)
      onSave()
      onClose()
    } catch {
      setError('Erro ao adicionar estoque. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Adicionar ao Estoque" onClose={onClose} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-bone-200 rounded-control p-3 text-body">
          <p className="font-medium text-ink-800">{productName}</p>
          <p className="text-ink-600">{variation.identifier}</p>
          <p className="text-ink-600 mt-1">
            Estoque atual:{' '}
            <span className="font-semibold tabular-nums text-ink-900">
              {variation.stockQuantity} unidades
            </span>
          </p>
        </div>

        <div>
          <label className="label">Quantidade a adicionar</label>
          <input
            className="input"
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            autoFocus
          />
        </div>

        {error && <p className="text-body text-clay-500">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Salvando…' : 'Adicionar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
