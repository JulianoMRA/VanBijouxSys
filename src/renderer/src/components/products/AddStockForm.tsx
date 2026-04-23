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
        <div className="bg-[var(--surface-alt)] rounded-[var(--radius-md)] p-3 text-sm">
          <p className="font-medium" style={{ color: 'var(--ink-2)' }}>{productName}</p>
          <p style={{ color: 'var(--ink-3)' }}>{variation.identifier}</p>
          <p className="mt-1" style={{ color: 'var(--ink-3)' }}>
            Estoque atual: <span className="font-medium" style={{ color: 'var(--ink-2)' }}>{variation.stockQuantity} unidades</span>
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

        {error && <p className="text-sm" style={{ color: 'var(--bad)' }}>{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Salvando…' : 'Adicionar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
