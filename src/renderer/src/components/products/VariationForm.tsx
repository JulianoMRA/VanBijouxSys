import { useState } from 'react'
import Modal from '../ui/Modal'
import type { ProductVariation } from '../../types'

interface VariationFormProps {
  productId: number
  productName: string
  variation?: ProductVariation
  onSave: () => void
  onClose: () => void
}

export default function VariationForm({
  productId,
  productName,
  variation,
  onSave,
  onClose
}: VariationFormProps): JSX.Element {
  const [identifier, setIdentifier] = useState(variation?.identifier ?? '')
  const [costPrice, setCostPrice] = useState(variation?.costPrice.toString() ?? '')
  const [salePrice, setSalePrice] = useState(variation?.salePrice.toString() ?? '')
  const [stockQuantity, setStockQuantity] = useState(variation?.stockQuantity.toString() ?? '0')
  const [minimumStock, setMinimumStock] = useState(variation?.minimumStock.toString() ?? '1')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEditing = !!variation

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!identifier.trim()) {
      setError('O identificador é obrigatório (ex: Rosa, Dourado, Fimo unicórnio).')
      return
    }
    const cost = parseFloat(costPrice)
    const sale = parseFloat(salePrice)
    const stock = parseInt(stockQuantity)
    const minStock = parseInt(minimumStock)

    if (isNaN(cost) || cost < 0) { setError('Preço de custo inválido.'); return }
    if (isNaN(sale) || sale < 0) { setError('Preço de venda inválido.'); return }
    if (isNaN(stock) || stock < 0) { setError('Quantidade em estoque inválida.'); return }
    if (isNaN(minStock) || minStock < 0) { setError('Estoque mínimo inválido.'); return }

    setSaving(true)
    try {
      if (isEditing) {
        await window.api.variations.update({
          id: variation.id,
          productId,
          identifier: identifier.trim(),
          costPrice: cost,
          salePrice: sale,
          stockQuantity: stock,
          minimumStock: minStock
        })
      } else {
        await window.api.variations.create({
          productId,
          identifier: identifier.trim(),
          costPrice: cost,
          salePrice: sale,
          stockQuantity: stock,
          minimumStock: minStock
        })
      }
      onSave()
      onClose()
    } catch {
      setError('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={isEditing ? 'Editar Variação' : `Nova Variação — ${productName}`}
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Identificador</label>
          <input
            className="input"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Ex: Rosa, Dourado, Fimo unicórnio, Cristal azul…"
            autoFocus
          />
          <p className="text-xs text-gray-400 mt-1">
            Pode ser uma cor, material, tipo de fimo, ou qualquer diferencial desta variação.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Preço de custo (R$)</label>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div>
            <label className="label">Preço de venda (R$)</label>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              placeholder="0,00"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Quantidade em estoque</label>
            <input
              className="input"
              type="number"
              min="0"
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Estoque mínimo</label>
            <input
              className="input"
              type="number"
              min="0"
              value={minimumStock}
              onChange={(e) => setMinimumStock(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              Alerta aparece quando estoque ficar abaixo deste valor.
            </p>
          </div>
        </div>

        {error && <p className="text-sm text-rose-500">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Salvando…' : isEditing ? 'Salvar alterações' : 'Cadastrar variação'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
