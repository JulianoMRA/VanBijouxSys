import { useState } from 'react'
import Modal from '../ui/Modal'
import type { Insumo, InsumoUnit } from '../../types'

interface InsumoFormProps {
  insumo?: Insumo
  initialName?: string
  onSave: (insumo: Insumo) => void
  onClose: () => void
}

const UNITS: { value: InsumoUnit; label: string }[] = [
  { value: 'unidade', label: 'Unidade (un.)' },
  { value: 'cm', label: 'Centímetro (cm)' },
  { value: 'g', label: 'Grama (g)' }
]

export default function InsumoForm({ insumo, initialName = '', onSave, onClose }: InsumoFormProps): JSX.Element {
  const [name, setName] = useState(insumo?.name ?? initialName)
  const [unit, setUnit] = useState<InsumoUnit>(insumo?.unit ?? 'unidade')
  const [costPerUnit, setCostPerUnit] = useState(insumo?.costPerUnit.toString() ?? '')
  const [stockQuantity, setStockQuantity] = useState(insumo?.stockQuantity.toString() ?? '0')
  const [minimumStock, setMinimumStock] = useState(insumo?.minimumStock.toString() ?? '0')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEditing = !!insumo

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!name.trim()) { setError('O nome é obrigatório.'); return }
    const cost = parseFloat(costPerUnit)
    const stock = parseFloat(stockQuantity)
    const minStock = parseFloat(minimumStock)
    if (isNaN(cost) || cost < 0) { setError('Custo por unidade inválido.'); return }
    if (isNaN(stock) || stock < 0) { setError('Quantidade em estoque inválida.'); return }
    if (isNaN(minStock) || minStock < 0) { setError('Estoque mínimo inválido.'); return }

    setSaving(true)
    try {
      if (isEditing) {
        await window.api.insumos.update({
          id: insumo.id,
          name: name.trim(),
          unit,
          costPerUnit: cost,
          stockQuantity: stock,
          minimumStock: minStock
        })
        onSave({ ...insumo, name: name.trim(), unit, costPerUnit: cost, stockQuantity: stock, minimumStock: minStock })
      } else {
        const result = await window.api.insumos.create({
          name: name.trim(),
          unit,
          costPerUnit: cost,
          stockQuantity: stock,
          minimumStock: minStock
        })
        onSave({
          id: result.id,
          name: name.trim(),
          unit,
          costPerUnit: cost,
          stockQuantity: stock,
          minimumStock: minStock,
          createdAt: new Date().toISOString()
        })
      }
      onClose()
    } catch {
      setError('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const unitLabel = UNITS.find((u) => u.value === unit)?.label ?? ''

  return (
    <Modal title={isEditing ? 'Editar Insumo' : 'Novo Insumo'} onClose={onClose} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Nome do insumo</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Fio de nylon, Miçanga dourada, Argola…"
            autoFocus
          />
        </div>

        <div>
          <label className="label">Unidade de medida</label>
          <div className="flex gap-2">
            {UNITS.map((u) => (
              <button
                key={u.value}
                type="button"
                onClick={() => setUnit(u.value)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                  unit === u.value
                    ? 'bg-blush-500 text-white'
                    : 'bg-cream-100 text-gray-600 hover:bg-cream-200'
                }`}
              >
                {u.value === 'unidade' ? 'Un.' : u.value}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Custo por {unitLabel}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">R$</span>
            <input
              className="input pl-8"
              type="number"
              min="0"
              step="0.0001"
              placeholder="0,0000"
              value={costPerUnit}
              onChange={(e) => setCostPerUnit(e.target.value)}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Ex: se o fio custa R$20,00 por 100cm, o custo por cm é R$0,20.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Estoque atual ({unit === 'unidade' ? 'un.' : unit})</label>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Estoque mínimo ({unit === 'unidade' ? 'un.' : unit})</label>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={minimumStock}
              onChange={(e) => setMinimumStock(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-sm text-rose-500">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Salvando…' : isEditing ? 'Salvar alterações' : 'Cadastrar insumo'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
