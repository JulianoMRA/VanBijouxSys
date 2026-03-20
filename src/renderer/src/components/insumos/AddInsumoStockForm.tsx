import { useState } from 'react'
import Modal from '../ui/Modal'
import type { Insumo } from '../../types'

interface AddInsumoStockFormProps {
  insumo: Insumo
  onSave: () => void
  onClose: () => void
}

export default function AddInsumoStockForm({ insumo, onSave, onClose }: AddInsumoStockFormProps): JSX.Element {
  const [quantity, setQuantity] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const unitLabel = insumo.unit === 'unidade' ? 'un.' : insumo.unit

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const qty = parseFloat(quantity)
    if (isNaN(qty) || qty <= 0) { setError('Informe uma quantidade válida.'); return }

    setSaving(true)
    try {
      await window.api.insumos.addStock(insumo.id, qty)
      onSave()
      onClose()
    } catch {
      setError('Erro ao adicionar estoque.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Adicionar estoque — ${insumo.name}`} onClose={onClose} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-500">
          Estoque atual:{' '}
          <span className="font-medium text-gray-700">
            {insumo.stockQuantity} {unitLabel}
          </span>
        </p>

        <div>
          <label className="label">Quantidade a adicionar ({unitLabel})</label>
          <input
            className="input"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            autoFocus
          />
        </div>

        {quantity && !isNaN(parseFloat(quantity)) && (
          <p className="text-xs text-blush-600">
            Novo estoque: {(insumo.stockQuantity + parseFloat(quantity)).toLocaleString('pt-BR')} {unitLabel}
          </p>
        )}

        {error && <p className="text-sm text-rose-500">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Salvando…' : 'Adicionar ao estoque'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
