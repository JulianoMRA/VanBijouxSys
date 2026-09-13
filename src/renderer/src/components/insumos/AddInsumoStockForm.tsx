import { useState } from 'react'
import Modal from '../ui/Modal'
import CampoNumerico from '../ui/CampoNumerico'
import { interpretarNumero } from '../../utils/numero'
import type { Insumo } from '../../types'

interface AddInsumoStockFormProps {
  insumo: Insumo
  onSave: () => void
  onClose: () => void
}

export default function AddInsumoStockForm({
  insumo,
  onSave,
  onClose
}: AddInsumoStockFormProps): JSX.Element {
  const [quantity, setQuantity] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const unitLabel = insumo.unit === 'unidade' ? 'un.' : insumo.unit
  const quantidadeLida = interpretarNumero(quantity)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const qty = quantidadeLida
    if (qty === null || qty <= 0) {
      setError('Informe uma quantidade válida.')
      return
    }

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
        <p className="text-body text-ink-600">
          Estoque atual:{' '}
          <span className="font-semibold tabular-nums text-ink-900">
            {insumo.stockQuantity.toLocaleString('pt-BR')} {unitLabel}
          </span>
        </p>

        <div>
          <label className="label">Quantidade a adicionar ({unitLabel})</label>
          <CampoNumerico
            className="input"
            placeholder="0"
            value={quantity}
            onChange={setQuantity}
            autoFocus
          />
        </div>

        {quantidadeLida !== null && (
          <p className="text-micro font-medium text-wine-500">
            Novo estoque: {(insumo.stockQuantity + quantidadeLida).toLocaleString('pt-BR')}{' '}
            {unitLabel}
          </p>
        )}

        {error && <p className="text-body text-clay-500">{error}</p>}

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
